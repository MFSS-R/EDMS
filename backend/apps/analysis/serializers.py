"""
数据处理算法序列化器
"""
from rest_framework import serializers
from .models import DataProcessingAlgorithm, PlotData, CanvasLayout
from .script_validation import validate_algorithm_script


class DataProcessingAlgorithmSerializer(serializers.ModelSerializer):
    test_type_name = serializers.CharField(source='test_type.name', read_only=True)
    validation = serializers.SerializerMethodField()

    class Meta:
        model = DataProcessingAlgorithm
        fields = [
            'id', 'test_type', 'test_type_name', 'name', 'description',
            'script', 'is_active', 'created_at', 'updated_at', 'validation'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_validation(self, obj):
        return validate_algorithm_script(obj.script)

    def validate_script(self, value):
        validation_result = validate_algorithm_script(value)
        if not validation_result['valid']:
            raise serializers.ValidationError(validation_result['errors'])
        return value


class CanvasLayoutSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CanvasLayout
        fields = ['id', 'user', 'username', 'name', 'layout_data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('布局名称不能为空')
        return value.strip()

    def validate_layout_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('布局数据必须是JSON对象')
        return value


class DataProcessingAlgorithmCreateSerializer(serializers.ModelSerializer):
    script_file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = DataProcessingAlgorithm
        fields = ['test_type', 'name', 'description', 'script', 'script_file', 'is_active']

    def validate_test_type(self, value):
        request = self.context.get('request')
        if request and value.project.user != request.user:
            raise serializers.ValidationError('无效的测试类型')
        return value

    def validate(self, attrs):
        script = attrs.get('script', '')
        script_file = attrs.get('script_file')

        if script_file:
            try:
                attrs['script'] = script_file.read().decode('utf-8')
            except Exception:
                raise serializers.ValidationError({'script_file': '无法读取脚本文件，请确保文件为UTF-8编码的文本文件'})
            del attrs['script_file']
        elif not script:
            raise serializers.ValidationError({'script': '请输入Python脚本或上传.py文件'})

        validation_result = validate_algorithm_script(attrs.get('script', ''))
        if not validation_result['valid']:
            raise serializers.ValidationError({'script': validation_result['errors']})

        attrs.pop('script_file', None)
        return attrs


class DataProcessingAlgorithmListSerializer(serializers.ModelSerializer):
    test_type_name = serializers.CharField(source='test_type.name', read_only=True)
    validation = serializers.SerializerMethodField()

    class Meta:
        model = DataProcessingAlgorithm
        fields = [
            'id', 'test_type', 'test_type_name', 'name', 'description',
            'is_active', 'created_at', 'validation'
        ]

    def get_validation(self, obj):
        return validate_algorithm_script(obj.script)


class PlotDataSerializer(serializers.ModelSerializer):
    test_data_id = serializers.IntegerField(source='test_data.id', read_only=True)
    sample_id = serializers.CharField(source='test_data.sample.sample_id', read_only=True)
    sample_name = serializers.CharField(source='test_data.sample.name', read_only=True)
    test_type_name = serializers.CharField(source='test_data.test_type.name', read_only=True)
    algorithm_name = serializers.CharField(source='algorithm.name', read_only=True, default=None)

    class Meta:
        model = PlotData
        fields = [
            'id', 'test_data', 'test_data_id', 'sample_id', 'sample_name',
            'test_type_name', 'algorithm', 'algorithm_name',
            'dimensions', 'x_column', 'x_unit', 'y_column', 'y_unit',
            'series', 'columns', 'data',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
