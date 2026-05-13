import io
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project
from apps.samples.models import Experiment, Sample, SampleType
from apps.tests.models import TestData, TestFile, TestType


class UploadSafetyTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp(prefix='edms-test-media-')
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()

        self.user = get_user_model().objects.create_user(
            username='upload-safety',
            password='password',
        )
        self.client.force_authenticate(self.user)

        self.project = Project.objects.create(user=self.user, name='ProjectA')
        self.experiment = Experiment.objects.create(project=self.project, name='ExperimentA')
        self.sample_type = SampleType.objects.create(project=self.project, name='Powder')
        self.sample = Sample.objects.create(
            experiment=self.experiment,
            sample_type=self.sample_type,
            name='SampleA',
        )
        self.test_type = TestType.objects.create(project=self.project, name='XRD')

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _zip_upload(self, entries, name='package.zip'):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zip_file:
            for entry_name, content in entries.items():
                zip_file.writestr(entry_name, content)
        buffer.seek(0)
        buffer.name = name
        return buffer

    def test_upload_package_rejects_zip_path_traversal_entries(self):
        marker_name = f'edms-zip-traversal-{uuid.uuid4().hex}.txt'
        marker_path = os.path.join(tempfile.gettempdir(), marker_name)
        upload = self._zip_upload({f'../{marker_name}': b'owned'})

        try:
            response = self.client.post(
                '/api/tests/data/upload_package/',
                {'file': upload},
                format='multipart',
            )

            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('message', response.data)
            self.assertFalse(os.path.exists(marker_path))
            self.assertEqual(TestData.objects.count(), 0)
            self.assertEqual(TestFile.objects.count(), 0)
        finally:
            if os.path.exists(marker_path):
                os.remove(marker_path)

    def test_upload_package_accepts_normal_zip_package(self):
        debug_path = os.path.join(tempfile.gettempdir(), 'edms_debug.txt')
        if os.path.exists(debug_path):
            os.remove(debug_path)
        upload = self._zip_upload({
            f'{self.sample.sample_id}/{self.test_type.name}/result.txt': b'ok',
        })

        response = self.client.post(
            '/api/tests/data/upload_package/',
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['created_count'], 1)
        self.assertEqual(TestData.objects.count(), 1)
        self.assertEqual(TestFile.objects.count(), 1)
        test_file = TestFile.objects.get()
        self.assertEqual(test_file.original_filename, 'result.txt')
        self.assertTrue(os.path.exists(test_file.file_path.path))
        self.assertFalse(os.path.exists(debug_path))

    def test_batch_upload_rolls_back_records_and_files_when_later_file_save_fails(self):
        first_file = io.BytesIO(b'first')
        first_file.name = 'first.txt'
        second_file = io.BytesIO(b'second')
        second_file.name = 'second.txt'
        items = [
            {
                'file_key': 'first.txt',
                'sample_id': self.sample.sample_id,
                'test_type_id': self.test_type.id,
            },
            {
                'file_key': 'second.txt',
                'sample_id': self.sample.sample_id,
                'test_type_id': self.test_type.id,
            },
        ]

        original_create = TestFile.objects.create
        call_count = 0

        def create_then_fail(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise OSError('simulated file save failure')
            return original_create(*args, **kwargs)

        self.client.raise_request_exception = False
        with mock.patch('apps.tests.views.TestFile.objects.create', side_effect=create_then_fail):
            response = self.client.post(
                '/api/tests/data/batch_upload/',
                {
                    'items': json.dumps(items),
                    'files': [first_file, second_file],
                    'file_keys': ['first.txt', 'second.txt'],
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(TestData.objects.count(), 0)
        self.assertEqual(TestFile.objects.count(), 0)
        saved_files = []
        for root, _, files in os.walk(self.media_root):
            saved_files.extend(os.path.join(root, name) for name in files)
        self.assertEqual(saved_files, [])
