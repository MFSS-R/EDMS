import hashlib

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project


User = get_user_model()


class AgentImportJobAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='agent-user', password='pass')
        self.other_user = User.objects.create_user(username='other-user', password='pass')
        self.project = Project.objects.create(user=self.user, name='Hermes Project')
        self.other_project = Project.objects.create(user=self.other_user, name='Other Project')
        self.client.force_authenticate(self.user)
        self.list_url = '/api/agent/import-jobs/'

    def create_job(self, idempotency_key='job-key', project=None, expected_status=status.HTTP_201_CREATED):
        response = self.client.post(
            self.list_url,
            {
                'idempotency_key': idempotency_key,
                'source': 'hermes',
                'project': (project or self.project).id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, expected_status)
        return response

    def test_idempotency_key_duplicate_create_returns_same_job(self):
        payload = {
            'idempotency_key': 'hermes-run-001',
            'source': 'hermes',
            'project': self.project.id,
        }

        first = self.client.post(self.list_url, payload, format='json')
        second = self.client.post(self.list_url, payload, format='json')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['data']['id'], second.data['data']['id'])
        self.assertEqual(second.data['data']['idempotency_key'], 'hermes-run-001')

    def test_user_cannot_access_other_users_job(self):
        self.client.force_authenticate(self.other_user)
        created = self.create_job('private-job', self.other_project)
        self.client.force_authenticate(self.user)

        response = self.client.get(f"{self.list_url}{created.data['data']['id']}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_returns_only_current_users_jobs_and_supports_status_filter(self):
        own_created = self.create_job('own-created')
        own_uploaded = self.create_job('own-uploaded')
        self.client.force_authenticate(self.other_user)
        self.create_job('other-created', self.other_project)
        self.client.force_authenticate(self.user)

        from apps.agent_imports.models import AgentImportJob

        AgentImportJob.objects.filter(pk=own_uploaded.data['data']['id']).update(status=AgentImportJob.STATUS_UPLOADED)

        list_response = self.client.get(self.list_url)
        filtered_response = self.client.get(self.list_url, {'status': AgentImportJob.STATUS_UPLOADED})

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['data']['count'], 2)
        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered_response.data['data']['count'], 1)
        self.assertEqual(filtered_response.data['data']['results'][0]['id'], own_uploaded.data['data']['id'])

    def test_upload_rejects_mismatched_sha256(self):
        created = self.create_job('sha-job')
        upload = SimpleUploadedFile('data.csv', b'x,y\n1,2\n', content_type='text/csv')

        response = self.client.post(
            f"{self.list_url}{created.data['data']['id']}/files/",
            {
                'files': [upload],
                'file_keys': ['data.csv'],
                'sha256': ['not-the-real-sha'],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['data']['error_code'], 'sha256_mismatch')

    def test_confirm_unparsed_or_empty_job_is_rejected(self):
        created = self.create_job('empty-job')

        response = self.client.post(f"{self.list_url}{created.data['data']['id']}/confirm/", {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['data']['error_code'], 'job_not_ready')

    def test_status_and_preview_are_readable_after_parse(self):
        created = self.create_job('preview-job')
        content = b'x,y\n1,2\n'
        upload = SimpleUploadedFile('data.csv', content, content_type='text/csv')
        digest = hashlib.sha256(content).hexdigest()
        self.client.post(
            f"{self.list_url}{created.data['data']['id']}/files/",
            {'files': [upload], 'file_keys': ['data.csv'], 'sha256': [digest]},
            format='multipart',
        )
        parse = self.client.post(f"{self.list_url}{created.data['data']['id']}/parse/", {}, format='json')

        status_response = self.client.get(f"{self.list_url}{created.data['data']['id']}/")
        preview_response = self.client.get(f"{self.list_url}{created.data['data']['id']}/preview/")

        self.assertEqual(parse.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.data['data']['status'], 'awaiting_confirmation')
        self.assertIn('audit_events', status_response.data['data'])
        self.assertGreaterEqual(len(status_response.data['data']['audit_events']), 1)
        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(preview_response.data['data']['items']), 1)
        self.assertEqual(preview_response.data['data']['items'][0]['file_key'], 'data.csv')
        self.assertIn('errors', preview_response.data['data'])
        self.assertIn('warnings', preview_response.data['data'])

    def test_retry_imported_item_is_rejected_and_does_not_regress_status(self):
        from apps.agent_imports.models import AgentImportItem, AgentImportJob

        created = self.create_job('imported-retry-job')
        content = b'x,y\n1,2\n'
        upload = SimpleUploadedFile('data.csv', content, content_type='text/csv')
        digest = hashlib.sha256(content).hexdigest()
        self.client.post(
            f"{self.list_url}{created.data['data']['id']}/files/",
            {'files': [upload], 'file_keys': ['data.csv'], 'sha256': [digest]},
            format='multipart',
        )
        self.client.post(f"{self.list_url}{created.data['data']['id']}/parse/", {}, format='json')
        self.client.post(f"{self.list_url}{created.data['data']['id']}/confirm/", {}, format='json')
        job = AgentImportJob.objects.get(pk=created.data['data']['id'])
        item = job.items.get()

        response = self.client.post(
            f"{self.list_url}{job.id}/retry/",
            {'item_id': item.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['data']['error_code'], 'retry_not_allowed')
        item.refresh_from_db()
        job.refresh_from_db()
        self.assertEqual(item.status, AgentImportItem.STATUS_IMPORTED)
        self.assertEqual(job.status, AgentImportJob.STATUS_SUCCEEDED)

    def test_create_validation_error_preserves_structured_detail(self):
        response = self.client.post(
            self.list_url,
            {
                'idempotency_key': 'invalid-project-job',
                'source': 'hermes',
                'project': self.other_project.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['data']['error_code'], 'validation_error')
        self.assertIn('project', response.data['data']['validation_errors'])
