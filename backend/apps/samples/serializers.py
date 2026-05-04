"""
样品序列化器
"""

from rest_framework import serializers
from .models import SampleType, Sample, Experiment


class PreparationConditionField(serializers.Field):
    """
    制备条件字段序列化器
    """

    def to_representation(self, value):
        return value or {}

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError('制备条件必须是 JSON 对象')
        return data


class ExperimentSerializer(serializers.ModelSerializer):
    sample_count = serializers.ReadOnlyField()
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = Experiment
        fields = ['id', 'project', 'project_name', 'name', 'description', 'sample_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExperimentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experiment
        fields = ['project', 'name', 'description']


class ExperimentListSerializer(serializers.ModelSerializer):
    sample_count = serializers.ReadOnlyField()
    project = serializers.SerializerMethodField()

    class Meta:
        model = Experiment
        fields = ['id', 'project', 'name', 'description', 'sample_count', 'created_at']

    def get_project(self, obj):
        return obj.project.id


class SampleTypeSerializer(serializers.ModelSerializer):
    sample_count = serializers.ReadOnlyField()
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = SampleType
        fields = ['id', 'project', 'project_name', 'name', 'description', 'sample_count', 'created_at']
        read_only_fields = ['id', 'created_at']


class SampleTypeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleType
        fields = ['project', 'name', 'description']


class SampleTypeListSerializer(serializers.ModelSerializer):
    sample_count = serializers.ReadOnlyField()
    project = serializers.SerializerMethodField()

    class Meta:
        model = SampleType
        fields = ['id', 'project', 'name', 'description', 'sample_count', 'created_at']

    def get_project(self, obj):
        return obj.project.id


class BaseSampleSerializer(serializers.ModelSerializer):
    preparation_conditions = PreparationConditionField(required=False)
    sample_type_name = serializers.CharField(source='sample_type.name', read_only=True)
    experiment_name = serializers.CharField(source='experiment.name', read_only=True)
    project_id = serializers.IntegerField(source='experiment.project.id', read_only=True)
    project_name = serializers.CharField(source='experiment.project.name', read_only=True)
    test_types = serializers.ReadOnlyField()
    test_data_count = serializers.ReadOnlyField()
    display_name = serializers.ReadOnlyField()
    primary_label = serializers.ReadOnlyField()
    secondary_label = serializers.ReadOnlyField()
    full_label = serializers.ReadOnlyField()


class SampleSerializer(BaseSampleSerializer):
    class Meta:
        model = Sample
        fields = [
            'sample_id', 'experiment', 'experiment_name', 'sample_type', 'sample_type_name',
            'project_id', 'project_name', 'name', 'display_code', 'display_name',
            'primary_label', 'secondary_label', 'full_label',
            'preparation_conditions', 'synthesis_date',
            'batch_number', 'mark', 'notes', 'test_types', 'test_data_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['sample_id', 'created_at', 'updated_at']


class SampleCreateSerializer(serializers.ModelSerializer):
    preparation_conditions = PreparationConditionField(required=False)

    class Meta:
        model = Sample
        fields = [
            'experiment', 'sample_type', 'name', 'display_code',
            'preparation_conditions', 'synthesis_date', 'batch_number', 'mark', 'notes',
        ]

    def validate_experiment(self, value):
        request = self.context.get('request')
        if request and value.project.user != request.user:
            raise serializers.ValidationError('无效的实验')
        return value

    def validate_sample_type(self, value):
        request = self.context.get('request')
        if request and value.project.user != request.user:
            raise serializers.ValidationError('无效的样品类型')
        return value


class SampleUpdateSerializer(serializers.ModelSerializer):
    preparation_conditions = PreparationConditionField(required=False)

    class Meta:
        model = Sample
        fields = [
            'experiment', 'sample_type', 'name', 'display_code', 'preparation_conditions',
            'synthesis_date', 'batch_number', 'mark', 'notes',
        ]

    def validate_experiment(self, value):
        request = self.context.get('request')
        if request and value.project.user != request.user:
            raise serializers.ValidationError('无效的实验')
        return value

    def validate_sample_type(self, value):
        request = self.context.get('request')
        if request and value.project.user != request.user:
            raise serializers.ValidationError('无效的样品类型')
        return value


class SampleListSerializer(BaseSampleSerializer):
    class Meta:
        model = Sample
        fields = [
            'sample_id', 'experiment', 'experiment_name', 'sample_type', 'sample_type_name',
            'project_id', 'project_name', 'name', 'display_code', 'display_name',
            'primary_label', 'secondary_label', 'full_label',
            'preparation_conditions', 'synthesis_date',
            'batch_number', 'mark', 'test_types', 'test_data_count', 'created_at',
        ]


class BatchCreateSampleSerializer(serializers.Serializer):
    experiment_id = serializers.IntegerField()
    sample_type_id = serializers.IntegerField()
    count = serializers.IntegerField(min_value=1, max_value=100)
    display_code_prefix = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def validate_experiment_id(self, value):
        request = self.context.get('request')
        try:
            experiment = Experiment.objects.get(id=value)
            if request and experiment.project.user != request.user:
                raise serializers.ValidationError('无效的实验')
            return value
        except Experiment.DoesNotExist:
            raise serializers.ValidationError('实验不存在')

    def validate_sample_type_id(self, value):
        request = self.context.get('request')
        try:
            sample_type = SampleType.objects.get(id=value)
            if request and sample_type.project.user != request.user:
                raise serializers.ValidationError('无效的样品类型')
            return value
        except SampleType.DoesNotExist:
            raise serializers.ValidationError('样品类型不存在')


class BatchDeleteSampleSerializer(serializers.Serializer):
    sample_ids = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=1,
    )


class BatchMarkSampleSerializer(serializers.Serializer):
    sample_ids = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=1,
    )
    mark = serializers.CharField(max_length=100, allow_blank=True)
