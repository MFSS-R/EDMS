"""
项目序列化器
"""
from rest_framework import serializers
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """
    项目序列化器
    """
    sample_count = serializers.ReadOnlyField()
    sample_type_count = serializers.ReadOnlyField()
    test_type_count = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user_name = serializers.CharField(source='user.display_name', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'user', 'user_name', 'name', 'description', 'status', 
            'status_display', 'sample_count', 'sample_type_count', 
            'test_type_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class ProjectCreateSerializer(serializers.ModelSerializer):
    """
    项目创建序列化器
    """
    class Meta:
        model = Project
        fields = ['name', 'description', 'status']


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """
    项目更新序列化器
    """
    class Meta:
        model = Project
        fields = ['name', 'description', 'status']


class ExperimentListSerializer(serializers.Serializer):
    """
    实验列表序列化器（用于项目列表中包含实验信息）
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    sample_count = serializers.IntegerField()


class ProjectListSerializer(serializers.ModelSerializer):
    """
    项目列表序列化器
    """
    sample_count = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    experiments_count = serializers.SerializerMethodField()
    experiments = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'status', 'status_display', 
            'sample_count', 'experiments_count', 'experiments',
            'created_at', 'updated_at'
        ]

    def get_experiments_count(self, obj):
        return obj.experiments.count()

    def get_experiments(self, obj):
        experiments = obj.experiments.all()
        return [
            {
                'id': exp.id,
                'name': exp.name,
                'description': exp.description,
                'sample_count': exp.sample_count
            }
            for exp in experiments
        ]