from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import apps.agent_imports.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0002_initial'),
        ('samples', '0005_remove_sample_material_abbreviation'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('idempotency_key', models.CharField(blank=True, default='', max_length=255)),
                ('source', models.CharField(default='hermes', max_length=100)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('created', 'Created'),
                            ('uploaded', 'Uploaded'),
                            ('awaiting_confirmation', 'Awaiting confirmation'),
                            ('importing', 'Importing'),
                            ('succeeded', 'Succeeded'),
                            ('failed', 'Failed'),
                            ('partial_failed', 'Partial failed'),
                        ],
                        default='created',
                        max_length=32,
                    ),
                ),
                ('counts', models.JSONField(blank=True, default=apps.agent_imports.models.default_counts)),
                ('error', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'created_by',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='agent_import_jobs',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'experiment',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='agent_import_jobs',
                        to='samples.experiment',
                    ),
                ),
                (
                    'project',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='agent_import_jobs',
                        to='projects.project',
                    ),
                ),
            ],
            options={
                'db_table': 'agent_import_jobs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AgentImportItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_key', models.CharField(blank=True, default='', max_length=500)),
                ('original_filename', models.CharField(blank=True, default='', max_length=255)),
                ('sha256', models.CharField(blank=True, default='', max_length=64)),
                ('size', models.BigIntegerField(default=0)),
                ('content_type', models.CharField(blank=True, default='', max_length=100)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('uploaded', 'Uploaded'),
                            ('parsed', 'Parsed'),
                            ('imported', 'Imported'),
                            ('failed', 'Failed'),
                        ],
                        default='uploaded',
                        max_length=32,
                    ),
                ),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('errors', models.JSONField(blank=True, default=list)),
                ('warnings', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='items',
                        to='agent_imports.agentimportjob',
                    ),
                ),
            ],
            options={
                'db_table': 'agent_import_items',
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='AuditEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=100)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'actor',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='agent_import_audit_events',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'item',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='audit_events',
                        to='agent_imports.agentimportitem',
                    ),
                ),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='audit_events',
                        to='agent_imports.agentimportjob',
                    ),
                ),
            ],
            options={
                'db_table': 'agent_import_audit_events',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='agentimportitem',
            index=models.Index(fields=['job', 'file_key'], name='agent_impor_job_id_4d74ab_idx'),
        ),
        migrations.AddIndex(
            model_name='agentimportitem',
            index=models.Index(fields=['job', 'sha256'], name='agent_impor_job_id_65b082_idx'),
        ),
        migrations.AddConstraint(
            model_name='agentimportjob',
            constraint=models.UniqueConstraint(
                condition=models.Q(('idempotency_key', ''), _negated=True),
                fields=('created_by', 'idempotency_key'),
                name='unique_agent_import_idempotency_per_user',
            ),
        ),
    ]
