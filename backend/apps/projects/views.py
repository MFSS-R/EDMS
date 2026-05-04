"""
项目视图
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, inline_serializer

from .models import Project
from .serializers import (
    ProjectSerializer,
    ProjectCreateSerializer,
    ProjectUpdateSerializer,
    ProjectListSerializer
)
from apps.utils.responses import success_response, error_response


class ProjectViewSet(viewsets.ModelViewSet):
    """
    项目视图集
    提供项目的CRUD操作
    """
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        只返回当前用户的项目
        """
        return Project.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        """
        根据操作类型返回不同的序列化器
        """
        if self.action == 'create':
            return ProjectCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProjectUpdateSerializer
        elif self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def perform_create(self, serializer):
        """
        创建项目时自动关联当前用户
        """
        serializer.save(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        """
        获取项目详情
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return success_response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        创建项目
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            ProjectSerializer(serializer.instance).data,
            '项目创建成功',
            status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        """
        更新项目
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(
            ProjectSerializer(instance).data,
            '项目更新成功'
        )

    def destroy(self, request, *args, **kwargs):
        """
        删除项目
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='项目删除成功')

    @extend_schema(
        summary='批量删除项目',
        request=inline_serializer(
            name='BatchDeleteProjectRequest',
            fields={'ids': serializers.ListField(child=serializers.IntegerField())},
        ),
        responses={200: OpenApiTypes.OBJECT}
    )
    @action(methods=['post'], detail=False)
    def batch_delete(self, request):
        """
        批量删除项目
        """
        ids = request.data.get('ids', [])
        if not ids:
            return error_response('请选择要删除的项目', status.HTTP_400_BAD_REQUEST)
        
        deleted_count = self.get_queryset().filter(id__in=ids).delete()[0]
        return success_response({'deleted_count': deleted_count}, f'成功删除{deleted_count}个项目')

    @extend_schema(
        summary='获取项目统计信息',
        responses={200: OpenApiTypes.OBJECT}
    )
    @action(methods=['get'], detail=False)
    def statistics(self, request):
        """
        获取项目统计信息
        """
        queryset = self.get_queryset()
        total = queryset.count()
        in_progress = queryset.filter(status='in_progress').count()
        completed = queryset.filter(status='completed').count()
        archived = queryset.filter(status='archived').count()
        
        return success_response({
            'total': total,
            'in_progress': in_progress,
            'completed': completed,
            'archived': archived
        })
