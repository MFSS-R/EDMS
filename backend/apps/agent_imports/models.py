from django.conf import settings
from django.db import models
from django.db.models import Q


def default_counts():
    return {
        'files': 0,
        'items': 0,
        'uploaded': 0,
        'parsed': 0,
        'imported': 0,
        'errors': 0,
        'warnings': 0,
    }


class AgentImportJob(models.Model):
    STATUS_CREATED = 'created'
    STATUS_UPLOADED = 'uploaded'
    STATUS_AWAITING_CONFIRMATION = 'awaiting_confirmation'
    STATUS_IMPORTING = 'importing'
    STATUS_SUCCEEDED = 'succeeded'
    STATUS_FAILED = 'failed'
    STATUS_PARTIAL_FAILED = 'partial_failed'

    STATUS_CHOICES = [
        (STATUS_CREATED, 'Created'),
        (STATUS_UPLOADED, 'Uploaded'),
        (STATUS_AWAITING_CONFIRMATION, 'Awaiting confirmation'),
        (STATUS_IMPORTING, 'Importing'),
        (STATUS_SUCCEEDED, 'Succeeded'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_PARTIAL_FAILED, 'Partial failed'),
    ]

    idempotency_key = models.CharField(max_length=255, blank=True, default='')
    source = models.CharField(max_length=100, default='hermes')
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_import_jobs',
    )
    experiment = models.ForeignKey(
        'samples.Experiment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_import_jobs',
    )
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_CREATED)
    counts = models.JSONField(default=default_counts, blank=True)
    error = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_import_jobs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_import_jobs'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['created_by', 'idempotency_key'],
                condition=~Q(idempotency_key=''),
                name='unique_agent_import_idempotency_per_user',
            )
        ]

    def __str__(self):
        return f"{self.source}:{self.id}"

    def refresh_counts(self):
        items = self.items.all()
        self.counts = {
            'files': items.count(),
            'items': items.count(),
            'uploaded': items.filter(status=AgentImportItem.STATUS_UPLOADED).count(),
            'parsed': items.filter(status=AgentImportItem.STATUS_PARSED).count(),
            'imported': items.filter(status=AgentImportItem.STATUS_IMPORTED).count(),
            'errors': items.exclude(errors=[]).count(),
            'warnings': items.exclude(warnings=[]).count(),
        }


class AgentImportItem(models.Model):
    STATUS_UPLOADED = 'uploaded'
    STATUS_PARSED = 'parsed'
    STATUS_IMPORTED = 'imported'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_UPLOADED, 'Uploaded'),
        (STATUS_PARSED, 'Parsed'),
        (STATUS_IMPORTED, 'Imported'),
        (STATUS_FAILED, 'Failed'),
    ]

    job = models.ForeignKey(AgentImportJob, on_delete=models.CASCADE, related_name='items')
    file_key = models.CharField(max_length=500, blank=True, default='')
    original_filename = models.CharField(max_length=255, blank=True, default='')
    sha256 = models.CharField(max_length=64, blank=True, default='')
    size = models.BigIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_UPLOADED)
    metadata = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_import_items'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['job', 'file_key']),
            models.Index(fields=['job', 'sha256']),
        ]

    def __str__(self):
        return self.file_key or self.original_filename or str(self.id)


class AuditEvent(models.Model):
    job = models.ForeignKey(AgentImportJob, on_delete=models.CASCADE, related_name='audit_events')
    item = models.ForeignKey(
        AgentImportItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_import_audit_events',
    )
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_import_audit_events'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type}:{self.job_id}"
