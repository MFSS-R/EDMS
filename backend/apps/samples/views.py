"""
Viewsets for experiments, sample types, and samples.
"""

from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action

from apps.utils.excel import ExcelImporter
from apps.utils.export import ExcelExporter
from apps.utils.responses import error_response, success_response

from .models import Experiment, Sample, SampleType
from .serializers import (
    BatchCreateSampleSerializer,
    BatchDeleteSampleSerializer,
    BatchMarkSampleSerializer,
    ExperimentCreateSerializer,
    ExperimentListSerializer,
    ExperimentSerializer,
    SampleCreateSerializer,
    SampleListSerializer,
    SampleSerializer,
    SampleTypeCreateSerializer,
    SampleTypeListSerializer,
    SampleTypeSerializer,
    SampleUpdateSerializer,
)


class ExperimentViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    search_fields = ['name', 'description']
    ordering = ['-created_at']

    def get_queryset(self):
        return Experiment.objects.filter(project__user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return ExperimentCreateSerializer
        if self.action == 'list':
            return ExperimentListSerializer
        return ExperimentSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response({
            'count': len(serializer.data),
            'next': None,
            'previous': None,
            'results': serializer.data,
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            ExperimentSerializer(serializer.instance).data,
            '实验创建成功',
            status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = ExperimentSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, '实验更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='实验删除成功')


class SampleTypeViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    search_fields = ['name', 'description']
    ordering = ['name']

    def get_queryset(self):
        return SampleType.objects.filter(project__user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return SampleTypeCreateSerializer
        if self.action == 'list':
            return SampleTypeListSerializer
        return SampleTypeSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response({
            'count': len(serializer.data),
            'next': None,
            'previous': None,
            'results': serializer.data,
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            SampleTypeSerializer(serializer.instance).data,
            '样品类型创建成功',
            status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = SampleTypeSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, '样品类型更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='样品类型删除成功')


class SampleViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['sample_type', 'synthesis_date', 'mark', 'experiment']
    search_fields = ['sample_id', 'display_code', 'name']
    ordering_fields = ['created_at', 'synthesis_date']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Sample.objects.filter(
            experiment__project__user=self.request.user
        ).select_related('sample_type', 'experiment', 'experiment__project')

        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(experiment__project_id=project_id)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return SampleCreateSerializer
        if self.action in ['update', 'partial_update']:
            return SampleUpdateSerializer
        if self.action == 'list':
            return SampleListSerializer
        return SampleSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(SampleSerializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            SampleSerializer(serializer.instance).data,
            '样品创建成功',
            status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(SampleSerializer(instance).data, '样品更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='样品删除成功')

    @extend_schema(
        summary='批量创建空白样品',
        request=BatchCreateSampleSerializer,
        responses={201: OpenApiTypes.OBJECT},
    )
    @action(methods=['post'], detail=False)
    def batch_create(self, request):
        serializer = BatchCreateSampleSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        experiment_id = serializer.validated_data['experiment_id']
        sample_type_id = serializer.validated_data['sample_type_id']
        count = serializer.validated_data['count']
        display_code_prefix = serializer.validated_data.get('display_code_prefix', '').strip()

        try:
            experiment = Experiment.objects.get(id=experiment_id, project__user=request.user)
            sample_type = SampleType.objects.get(id=sample_type_id, project__user=request.user)
        except (Experiment.DoesNotExist, SampleType.DoesNotExist):
            return error_response('实验或样品类型不存在', status=status.HTTP_404_NOT_FOUND)

        created_samples = []
        for index in range(count):
            sample = Sample.objects.create(
                experiment=experiment,
                sample_type=sample_type,
                display_code=f'{display_code_prefix}{index + 1:02d}' if display_code_prefix else '',
                synthesis_date=timezone.now().date(),
            )
            created_samples.append(sample)

        return success_response(
            SampleListSerializer(created_samples, many=True).data,
            f'成功创建 {count} 个样品',
            status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary='批量删除样品',
        request=BatchDeleteSampleSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(methods=['post'], detail=False)
    def batch_delete(self, request):
        serializer = BatchDeleteSampleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sample_ids = serializer.validated_data['sample_ids']
        deleted_count = self.get_queryset().filter(sample_id__in=sample_ids).delete()[0]
        return success_response({'deleted_count': deleted_count}, f'成功删除 {deleted_count} 个样品')

    @extend_schema(
        summary='批量标记样品',
        request=BatchMarkSampleSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(methods=['post'], detail=False)
    def batch_mark(self, request):
        serializer = BatchMarkSampleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sample_ids = serializer.validated_data['sample_ids']
        mark = serializer.validated_data['mark']
        updated_count = self.get_queryset().filter(sample_id__in=sample_ids).update(mark=mark)
        return success_response({'updated_count': updated_count}, f'成功标记 {updated_count} 个样品')

    @extend_schema(
        summary='复制样品制备条件',
        parameters=[
            OpenApiParameter(
                name='source_sample_id',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='源样品 ID',
                required=True,
            )
        ],
    )
    @action(methods=['get'], detail=True)
    def copy_preparation_conditions(self, request, pk=None):
        source_sample_id = request.query_params.get('source_sample_id')
        if not source_sample_id:
            return error_response('请提供源样品 ID', status=status.HTTP_400_BAD_REQUEST)

        try:
            source_sample = self.get_queryset().get(sample_id=source_sample_id)
        except Sample.DoesNotExist:
            return error_response('源样品不存在', status=status.HTTP_404_NOT_FOUND)

        return success_response({'preparation_conditions': source_sample.preparation_conditions})

    @extend_schema(
        summary='导出样品列表 Excel',
        parameters=[
            OpenApiParameter(
                name='project_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='项目 ID（可选）',
            )
        ],
    )
    @action(methods=['get'], detail=False)
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        buffer = ExcelExporter.export_samples(queryset)
        return ExcelExporter.create_response(buffer, 'samples.xlsx')

    @extend_schema(
        summary='下载样品批量导入模板',
        responses={200: OpenApiTypes.BINARY},
    )
    @action(methods=['get'], detail=False)
    def download_template(self, request):
        buffer = ExcelImporter.create_template()
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename=sample_import_template.xlsx'
        return response

    @extend_schema(
        summary='批量导入样品',
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(methods=['post'], detail=False)
    def batch_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return error_response('请上传 Excel 文件', status=status.HTTP_400_BAD_REQUEST)

        try:
            samples_data = ExcelImporter.parse_uploaded_file(file)
            if not samples_data:
                return error_response('Excel 文件中没有有效数据', status=status.HTTP_400_BAD_REQUEST)

            result = ExcelImporter.validate_and_create_samples(samples_data, user=request.user)

            if result['error_count'] > 0:
                return success_response(
                    result,
                    f'成功导入 {result["created_count"]} 个样品，{result["error_count"]} 个失败',
                )

            return success_response(result, f'成功导入 {result["created_count"]} 个样品')
        except Exception as exc:
            return error_response(f'导入失败: {exc}', status=status.HTTP_500_INTERNAL_SERVER_ERROR)
