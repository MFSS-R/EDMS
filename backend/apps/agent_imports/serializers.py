from rest_framework import serializers

from apps.projects.models import Project
from apps.samples.models import Experiment

from .models import AgentImportItem, AgentImportJob, AuditEvent


class AgentImportItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentImportItem
        fields = [
            'id',
            'file_key',
            'original_filename',
            'sha256',
            'size',
            'content_type',
            'status',
            'metadata',
            'errors',
            'warnings',
            'created_at',
            'updated_at',
        ]


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditEvent
        fields = ['id', 'event_type', 'payload', 'actor', 'actor_username', 'item', 'created_at']


class AgentImportJobSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)
    experiment = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    item_count = serializers.IntegerField(source='items.count', read_only=True)
    audit_events = AuditEventSerializer(many=True, read_only=True)

    class Meta:
        model = AgentImportJob
        fields = [
            'id',
            'idempotency_key',
            'source',
            'project',
            'experiment',
            'status',
            'counts',
            'error',
            'created_by',
            'item_count',
            'audit_events',
            'created_at',
            'updated_at',
        ]


class AgentImportJobCreateSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True,
    )
    experiment = serializers.PrimaryKeyRelatedField(
        queryset=Experiment.objects.select_related('project').all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AgentImportJob
        fields = ['idempotency_key', 'source', 'project', 'experiment']

    def validate_project(self, project):
        request = self.context['request']
        if project and project.user_id != request.user.id:
            raise serializers.ValidationError({
                'error_code': 'project_not_found',
                'detail': 'Project is not available for this user.',
            })
        return project

    def validate_experiment(self, experiment):
        request = self.context['request']
        if experiment and experiment.project.user_id != request.user.id:
            raise serializers.ValidationError({
                'error_code': 'experiment_not_found',
                'detail': 'Experiment is not available for this user.',
            })
        return experiment

    def validate(self, attrs):
        project = attrs.get('project')
        experiment = attrs.get('experiment')
        if experiment and project and experiment.project_id != project.id:
            raise serializers.ValidationError({
                'error_code': 'experiment_project_mismatch',
                'detail': 'Experiment does not belong to the selected project.',
            })
        if experiment and not project:
            attrs['project'] = experiment.project
        return attrs
