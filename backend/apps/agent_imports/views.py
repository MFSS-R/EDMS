import hashlib

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.utils.responses import error_response, success_response

from .models import AgentImportItem, AgentImportJob, AuditEvent
from .serializers import (
    AgentImportItemSerializer,
    AgentImportJobCreateSerializer,
    AgentImportJobSerializer,
)


def _error(message, http_status, error_code, extra=None):
    data = {'error_code': error_code}
    if extra:
        data.update(extra)
    return error_response(message, http_status, data)


def _plain_detail(value):
    if isinstance(value, dict):
        return {key: _plain_detail(detail) for key, detail in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_detail(detail) for detail in value]
    return str(value)


def _getlist(data, key):
    if hasattr(data, 'getlist'):
        return data.getlist(key)
    value = data.get(key, [])
    return value if isinstance(value, list) else [value]


class AgentImportJobViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            AgentImportJob.objects.filter(Q(created_by=user) | Q(project__user=user))
            .select_related('project', 'experiment', 'created_by')
            .distinct()
        )

    def get_object(self):
        return self.get_queryset().get(pk=self.kwargs['pk'])

    def list(self, request):
        queryset = self.get_queryset()
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return success_response({
            'count': queryset.count(),
            'results': AgentImportJobSerializer(queryset, many=True).data,
        })

    def create(self, request):
        serializer = AgentImportJobCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return _error(
                'validation error',
                status.HTTP_400_BAD_REQUEST,
                'validation_error',
                {'validation_errors': _plain_detail(serializer.errors)},
            )

        idempotency_key = serializer.validated_data.get('idempotency_key', '')
        if idempotency_key:
            existing = AgentImportJob.objects.filter(
                created_by=request.user,
                idempotency_key=idempotency_key,
            ).first()
            if existing:
                return success_response(AgentImportJobSerializer(existing).data)

        job = serializer.save(created_by=request.user)
        AuditEvent.objects.create(
            job=job,
            actor=request.user,
            event_type='job_created',
            payload={'source': job.source, 'idempotency_key': job.idempotency_key},
        )
        return success_response(
            AgentImportJobSerializer(job).data,
            'import job created',
            status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')
        return success_response(AgentImportJobSerializer(job).data)

    @action(methods=['post'], detail=True, parser_classes=[MultiPartParser, FormParser])
    def files(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')

        uploads = request.FILES.getlist('files')
        if not uploads:
            return _error('files[] is required', status.HTTP_400_BAD_REQUEST, 'files_required')

        file_keys = _getlist(request.data, 'file_keys')
        sha256_values = _getlist(request.data, 'sha256')
        created_items = []
        skipped_items = []

        for index, upload in enumerate(uploads):
            file_key = (file_keys[index] if index < len(file_keys) else '') or upload.name
            expected_sha256 = (sha256_values[index] if index < len(sha256_values) else '').strip().lower()
            actual_sha256 = self._hash_upload(upload)
            if expected_sha256 and expected_sha256 != actual_sha256:
                return _error(
                    'sha256 does not match uploaded file',
                    status.HTTP_400_BAD_REQUEST,
                    'sha256_mismatch',
                    {
                        'file_key': file_key,
                        'expected_sha256': expected_sha256,
                        'actual_sha256': actual_sha256,
                    },
                )

            duplicate_query = Q()
            if file_key:
                duplicate_query |= Q(file_key=file_key)
            if actual_sha256:
                duplicate_query |= Q(sha256=actual_sha256)
            duplicate = job.items.filter(duplicate_query).first() if duplicate_query else None
            if duplicate:
                skipped_items.append(duplicate)
                continue

            item = AgentImportItem.objects.create(
                job=job,
                file_key=file_key,
                original_filename=upload.name,
                sha256=actual_sha256,
                size=upload.size,
                content_type=getattr(upload, 'content_type', '') or '',
                status=AgentImportItem.STATUS_UPLOADED,
            )
            created_items.append(item)

        if created_items and job.status == AgentImportJob.STATUS_CREATED:
            job.status = AgentImportJob.STATUS_UPLOADED
        job.refresh_counts()
        job.save(update_fields=['status', 'counts', 'updated_at'])

        AuditEvent.objects.create(
            job=job,
            actor=request.user,
            event_type='files_uploaded',
            payload={'created': len(created_items), 'skipped': len(skipped_items)},
        )
        return success_response({
            'job': AgentImportJobSerializer(job).data,
            'created': AgentImportItemSerializer(created_items, many=True).data,
            'skipped': AgentImportItemSerializer(skipped_items, many=True).data,
        })

    def _hash_upload(self, upload):
        digest = hashlib.sha256()
        for chunk in upload.chunks():
            digest.update(chunk)
        upload.seek(0)
        return digest.hexdigest()

    @action(methods=['post'], detail=True)
    def parse(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')

        items = list(job.items.all())
        if not items:
            job.status = AgentImportJob.STATUS_FAILED
            job.error = {'error_code': 'no_valid_items', 'detail': 'At least one uploaded item is required.'}
            job.refresh_counts()
            job.save(update_fields=['status', 'error', 'counts', 'updated_at'])
            return _error('at least one uploaded item is required', status.HTTP_409_CONFLICT, 'no_valid_items')

        has_errors = False
        for item in items:
            errors = []
            if not item.file_key:
                errors.append({'error_code': 'file_key_required', 'detail': 'file_key is required.'})
            if not item.sha256:
                errors.append({'error_code': 'sha256_required', 'detail': 'sha256 is required.'})
            item.errors = errors
            item.warnings = [] if job.project_id else [
                {'error_code': 'project_not_set', 'detail': 'Job is not associated with a project.'}
            ]
            item.status = AgentImportItem.STATUS_FAILED if errors else AgentImportItem.STATUS_PARSED
            item.save(update_fields=['errors', 'warnings', 'status', 'updated_at'])
            has_errors = has_errors or bool(errors)

        job.status = AgentImportJob.STATUS_PARTIAL_FAILED if has_errors else AgentImportJob.STATUS_AWAITING_CONFIRMATION
        job.error = {'error_code': 'parse_failed'} if has_errors else {}
        job.refresh_counts()
        job.save(update_fields=['status', 'error', 'counts', 'updated_at'])
        AuditEvent.objects.create(job=job, actor=request.user, event_type='job_parsed', payload={'status': job.status})
        return success_response(self._preview_payload(job))

    @action(methods=['get'], detail=True)
    def preview(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')
        return success_response(self._preview_payload(job))

    @action(methods=['post'], detail=True)
    def confirm(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')

        parsed_items = job.items.filter(status=AgentImportItem.STATUS_PARSED)
        if job.status != AgentImportJob.STATUS_AWAITING_CONFIRMATION or not parsed_items.exists():
            return _error('import job is not ready to confirm', status.HTTP_409_CONFLICT, 'job_not_ready')

        job.status = AgentImportJob.STATUS_IMPORTING
        job.save(update_fields=['status', 'updated_at'])
        imported_count = parsed_items.count()
        parsed_items.update(status=AgentImportItem.STATUS_IMPORTED)
        job.status = AgentImportJob.STATUS_SUCCEEDED
        job.error = {}
        job.refresh_counts()
        job.save(update_fields=['status', 'error', 'counts', 'updated_at'])
        AuditEvent.objects.create(
            job=job,
            actor=request.user,
            event_type='import_confirmed',
            payload={'imported': imported_count},
        )
        return success_response(AgentImportJobSerializer(job).data)

    @action(methods=['post'], detail=True)
    def retry(self, request, pk=None):
        try:
            job = self.get_object()
        except AgentImportJob.DoesNotExist:
            return _error('import job not found', status.HTTP_404_NOT_FOUND, 'job_not_found')

        item_id = request.data.get('item_id')
        if item_id:
            try:
                item = job.items.get(pk=item_id)
            except AgentImportItem.DoesNotExist:
                return _error('import item not found', status.HTTP_404_NOT_FOUND, 'item_not_found')
            if item.status != AgentImportItem.STATUS_FAILED:
                return _error('import item is not retryable', status.HTTP_409_CONFLICT, 'retry_not_allowed')
            item.status = AgentImportItem.STATUS_UPLOADED
            item.errors = []
            item.warnings = []
            item.save(update_fields=['status', 'errors', 'warnings', 'updated_at'])
        elif job.status in {AgentImportJob.STATUS_FAILED, AgentImportJob.STATUS_PARTIAL_FAILED}:
            job.items.filter(status=AgentImportItem.STATUS_FAILED).update(
                status=AgentImportItem.STATUS_UPLOADED,
                errors=[],
                warnings=[],
            )
        else:
            return _error('import job is not retryable', status.HTTP_409_CONFLICT, 'retry_not_allowed')

        job.status = AgentImportJob.STATUS_UPLOADED if job.items.exists() else AgentImportJob.STATUS_CREATED
        job.error = {}
        job.refresh_counts()
        job.save(update_fields=['status', 'error', 'counts', 'updated_at'])
        AuditEvent.objects.create(job=job, actor=request.user, event_type='job_retry_requested', payload={})
        return success_response(AgentImportJobSerializer(job).data)

    def _preview_payload(self, job):
        items = list(job.items.all())
        errors = []
        warnings = []
        for item in items:
            for error in item.errors:
                errors.append({'item_id': item.id, **error})
            for warning in item.warnings:
                warnings.append({'item_id': item.id, **warning})
        if job.error:
            errors.append(job.error)
        return {
            'job': AgentImportJobSerializer(job).data,
            'items': AgentImportItemSerializer(items, many=True).data,
            'errors': errors,
            'warnings': warnings,
        }
