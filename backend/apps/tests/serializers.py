"""
Serializers for test types, test data, and uploaded files.
"""

from rest_framework import serializers

from .models import TestData, TestFile, TestType


class StructuredDataField(serializers.Field):
    def to_representation(self, value):
        return value or {}

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError('结构化数据必须是 JSON 对象')
        return data


class TestTypeSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = TestType
        fields = ['id', 'project', 'project_name', 'name', 'description', 'usage_count', 'created_at']
        read_only_fields = ['id', 'usage_count', 'created_at']


class TestTypeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestType
        fields = ['project', 'name', 'description']


class TestTypeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestType
        fields = ['id', 'name', 'description', 'usage_count', 'created_at']


class TestFileSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TestFile
        fields = [
            'id',
            'test_data',
            'original_filename',
            'saved_filename',
            'file_path',
            'file_url',
            'file_size',
            'file_size_display',
            'file_type',
            'uploaded_at',
        ]
        read_only_fields = ['id', 'saved_filename', 'file_size', 'file_type', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file_path:
            return obj.file_path.url
        return None


class BaseTestDataSerializer(serializers.ModelSerializer):
    structured_data = StructuredDataField(required=False)
    test_type_name = serializers.CharField(source='test_type.name', read_only=True)
    sample_id = serializers.CharField(source='sample.sample_id', read_only=True)
    sample_name = serializers.CharField(source='sample.name', read_only=True)
    sample_display_code = serializers.CharField(source='sample.display_code', read_only=True)
    sample_primary_label = serializers.CharField(source='sample.primary_label', read_only=True)
    sample_secondary_label = serializers.CharField(source='sample.secondary_label', read_only=True)
    sample_full_label = serializers.CharField(source='sample.full_label', read_only=True)
    project_id = serializers.IntegerField(source='sample.sample_type.project.id', read_only=True)
    project_name = serializers.CharField(source='sample.sample_type.project.name', read_only=True)
    file_count = serializers.ReadOnlyField()
    files = TestFileSerializer(many=True, read_only=True)


class TestDataSerializer(BaseTestDataSerializer):
    class Meta:
        model = TestData
        fields = [
            'id',
            'sample',
            'sample_id',
            'sample_name',
            'sample_display_code',
            'sample_primary_label',
            'sample_secondary_label',
            'sample_full_label',
            'test_type',
            'test_type_name',
            'project_id',
            'project_name',
            'test_date',
            'instrument',
            'tester',
            'structured_data',
            'notes',
            'file_count',
            'files',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TestDataCreateSerializer(serializers.ModelSerializer):
    structured_data = StructuredDataField(required=False)
    files = serializers.ListField(child=serializers.FileField(), write_only=True, required=False)
    create_test_type = serializers.BooleanField(write_only=True, required=False, default=False)
    test_type_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = TestData
        fields = [
            'sample',
            'test_type',
            'test_type_name',
            'create_test_type',
            'test_date',
            'instrument',
            'tester',
            'structured_data',
            'notes',
            'files',
        ]

    def validate_sample(self, value):
        request = self.context.get('request')
        if request and value.sample_type.project.user != request.user:
            raise serializers.ValidationError('无效的样品')
        return value

    def validate(self, attrs):
        test_type = attrs.get('test_type')
        test_type_name = (attrs.get('test_type_name') or '').strip()
        create_test_type = attrs.get('create_test_type', False)

        if not test_type and not test_type_name:
            raise serializers.ValidationError({'test_type': '请选择或创建测试类型'})

        if test_type_name and create_test_type:
            sample = attrs.get('sample')
            project = sample.sample_type.project
            test_type, _ = TestType.objects.get_or_create(
                project=project,
                name=test_type_name,
                defaults={'description': ''},
            )
            attrs['test_type'] = test_type

        return attrs


class TestDataUpdateSerializer(serializers.ModelSerializer):
    structured_data = StructuredDataField(required=False)

    class Meta:
        model = TestData
        fields = ['test_date', 'instrument', 'tester', 'structured_data', 'notes']


class TestDataListSerializer(BaseTestDataSerializer):
    class Meta:
        model = TestData
        fields = [
            'id',
            'sample',
            'sample_id',
            'sample_name',
            'sample_display_code',
            'sample_primary_label',
            'sample_secondary_label',
            'sample_full_label',
            'test_type',
            'test_type_name',
            'project_id',
            'project_name',
            'test_date',
            'instrument',
            'tester',
            'file_count',
            'files',
            'created_at',
        ]


class FileUploadSerializer(serializers.Serializer):
    test_data_id = serializers.IntegerField()
    files = serializers.ListField(child=serializers.FileField(), min_length=1)

    def validate_test_data_id(self, value):
        request = self.context.get('request')
        try:
            test_data = TestData.objects.get(id=value)
        except TestData.DoesNotExist as exc:
            raise serializers.ValidationError('测试数据不存在') from exc

        if request and test_data.sample.sample_type.project.user != request.user:
            raise serializers.ValidationError('无效的测试数据')
        return value


class BatchUploadItemSerializer(serializers.Serializer):
    file_key = serializers.CharField(max_length=255)
    sample_id = serializers.CharField(max_length=50)
    test_type_id = serializers.IntegerField(required=False, allow_null=True)
    test_type_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    test_date = serializers.DateField(required=False, allow_null=True)
    instrument = serializers.CharField(required=False, allow_blank=True, max_length=200)
    tester = serializers.CharField(required=False, allow_blank=True, max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_sample_id(self, value):
        request = self.context.get('request')
        sample_model = TestData._meta.get_field('sample').related_model
        try:
            sample = sample_model.objects.select_related('experiment__project', 'sample_type__project').get(sample_id=value)
        except sample_model.DoesNotExist as exc:
            raise serializers.ValidationError('样品不存在') from exc

        if request and sample.experiment.project.user != request.user:
            raise serializers.ValidationError('无效的样品')

        self.context.setdefault('_sample_cache', {})[value] = sample
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        sample = self.context.get('_sample_cache', {}).get(attrs['sample_id'])
        if not sample:
            return attrs

        test_type_id = attrs.get('test_type_id')
        test_type_name = (attrs.get('test_type_name') or '').strip()

        if not test_type_id and not test_type_name:
            raise serializers.ValidationError({'test_type_name': '请选择或填写测试类型'})

        if test_type_id:
            try:
                test_type = TestType.objects.get(id=test_type_id, project=sample.experiment.project)
            except TestType.DoesNotExist as exc:
                raise serializers.ValidationError({'test_type_id': '测试类型不存在或不属于当前项目'}) from exc

            if request and test_type.project.user != request.user:
                raise serializers.ValidationError({'test_type_id': '无效的测试类型'})
            attrs['resolved_test_type'] = test_type
        else:
            test_type, _ = TestType.objects.get_or_create(
                project=sample.experiment.project,
                name=test_type_name,
                defaults={'description': '批量上传自动创建'},
            )
            attrs['resolved_test_type'] = test_type

        attrs['resolved_sample'] = sample
        return attrs


class BatchUploadRequestSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.JSONField(), min_length=1)
    files = serializers.ListField(child=serializers.FileField(), min_length=1)

    def validate_items(self, value):
        request = self.context.get('request')
        item_serializer = BatchUploadItemSerializer(
            data=value,
            many=True,
            context={'request': request},
        )
        item_serializer.is_valid(raise_exception=True)
        self.context['validated_items'] = item_serializer.validated_data
        return value
