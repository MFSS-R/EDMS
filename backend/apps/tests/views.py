"""
测试相关视图
"""
import os
import time
import uuid
import json
from pathlib import PurePosixPath
from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.http import FileResponse
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, inline_serializer
from rest_framework import serializers
from django.db import transaction

from .models import TestType, TestData, TestFile
from .serializers import (
    TestTypeSerializer,
    TestTypeCreateSerializer,
    TestTypeListSerializer,
    TestDataSerializer,
    TestDataCreateSerializer,
    TestDataUpdateSerializer,
    TestDataListSerializer,
    TestFileSerializer,
    FileUploadSerializer,
    BatchUploadRequestSerializer
)
from apps.samples.models import Sample
from apps.utils.responses import success_response, error_response
from django.http import HttpResponse
from django.utils import timezone


def _delete_file_paths(file_paths):
    for file_path in file_paths:
        if file_path and os.path.isfile(file_path):
            os.remove(file_path)


def _record_created_file(created_file_paths, test_file):
    if test_file.file_path:
        created_file_paths.append(test_file.file_path.path)
    return test_file


def _safe_zip_member_name(info):
    filename = info.filename
    for encoding in ['utf-8', 'gbk', 'gb2312', 'big5']:
        try:
            filename = info.filename.encode('cp437').decode(encoding)
            break
        except Exception:
            continue

    normalized = filename.replace('\\', '/')
    if (
        not normalized
        or normalized.startswith('/')
        or os.path.isabs(filename)
        or os.path.isabs(normalized)
        or (len(normalized) >= 2 and normalized[1] == ':')
    ):
        raise ValueError('zip文件包含不安全路径')

    parts = PurePosixPath(normalized).parts
    if any(part in ('..', '') for part in parts):
        raise ValueError('zip文件包含不安全路径')

    return normalized


def _safe_zip_target_path(root_dir, member_name):
    root_dir = os.path.abspath(root_dir)
    target_path = os.path.abspath(os.path.join(root_dir, member_name))
    if os.path.commonpath([root_dir, target_path]) != root_dir:
        raise ValueError('zip文件包含不安全路径')
    return target_path


class TestTypeViewSet(viewsets.ModelViewSet):
    """
    测试类型视图集
    """
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    search_fields = ['name', 'description']
    ordering = ['-usage_count', 'name']

    def get_queryset(self):
        return TestType.objects.filter(project__user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return TestTypeCreateSerializer
        elif self.action == 'list':
            return TestTypeListSerializer
        return TestTypeSerializer

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
        serializer = self.get_serializer(instance)
        return success_response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            TestTypeSerializer(serializer.instance).data,
            '测试类型创建成功',
            status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = TestTypeSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, '测试类型更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='测试类型删除成功')


class TestDataSetViewSet(viewsets.ModelViewSet):
    """
    测试数据视图集
    """
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['sample', 'test_type', 'test_date']
    search_fields = ['sample__sample_id', 'sample__name']
    ordering_fields = ['test_date', 'created_at']
    ordering = ['-test_date', '-created_at']

    def get_queryset(self):
        queryset = TestData.objects.filter(
            sample__sample_type__project__user=self.request.user
        ).select_related(
            'sample', 'sample__sample_type', 'sample__sample_type__project', 'test_type'
        ).prefetch_related('files')
        
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(sample__sample_type__project_id=project_id)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return TestDataCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TestDataUpdateSerializer
        elif self.action == 'list':
            return TestDataListSerializer
        return TestDataSerializer

    def list(self, request, *args, **kwargs):
        try:
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
                'results': serializer.data
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return error_response(str(e), code=500)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = TestDataSerializer(instance)
        return success_response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        created_file_paths = []
        try:
            with transaction.atomic():
                test_data = TestData.objects.create(
                    sample=serializer.validated_data['sample'],
                    test_type=serializer.validated_data['test_type'],
                    test_date=serializer.validated_data.get('test_date'),
                    instrument=serializer.validated_data.get('instrument', ''),
                    tester=serializer.validated_data.get('tester', ''),
                    structured_data=serializer.validated_data.get('structured_data', {}),
                    notes=serializer.validated_data.get('notes', '')
                )
                
                files = serializer.validated_data.get('files', [])
                for file in files:
                    ext = os.path.splitext(file.name)[1]
                    saved_filename = f"{uuid.uuid4()}{ext}"
                    _record_created_file(
                        created_file_paths,
                        TestFile.objects.create(
                            test_data=test_data,
                            original_filename=file.name,
                            saved_filename=saved_filename,
                            file_path=file
                        )
                    )
        except Exception:
            _delete_file_paths(created_file_paths)
            return error_response('测试数据创建失败', status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return success_response(
            TestDataSerializer(test_data).data,
            '测试数据创建成功',
            status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(
            TestDataSerializer(instance).data,
            '测试数据更新成功'
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='测试数据删除成功')

    @extend_schema(
        summary='下载测试数据的所有文件（打包为zip）',
        responses={200: OpenApiTypes.BINARY}
    )
    @action(methods=['get'], detail=True)
    def download(self, request, pk=None):
        """
        下载测试数据的所有文件，打包为zip
        """
        import tempfile
        import zipfile
        from io import BytesIO
        
        test_data = self.get_object()
        files = test_data.files.all()
        
        if not files.exists():
            return error_response('没有可下载的文件', status.HTTP_404_NOT_FOUND)
        
        # 创建内存中的zip文件
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for test_file in files:
                if test_file.file_path:
                    try:
                        with test_file.file_path.open('rb') as f:
                            zf.writestr(test_file.original_filename, f.read())
                    except Exception:
                        pass
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/zip')
        sample_name = test_data.sample.sample_id
        test_type_name = test_data.test_type.name
        zip_filename = f"{sample_name}-{test_type_name}.zip"
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response

    @extend_schema(
        summary='上传文件到测试数据',
        request=FileUploadSerializer,
        responses={201: TestFileSerializer(many=True)}
    )
    @action(methods=['post'], detail=False)
    def upload_files(self, request):
        """
        上传文件到测试数据
        """
        serializer = FileUploadSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        test_data_id = serializer.validated_data['test_data_id']
        files = serializer.validated_data['files']
        
        try:
            test_data = TestData.objects.get(id=test_data_id)
        except TestData.DoesNotExist:
            return error_response('测试数据不存在', status.HTTP_404_NOT_FOUND)
        
        uploaded_files = []
        created_file_paths = []
        try:
            with transaction.atomic():
                for file in files:
                    ext = os.path.splitext(file.name)[1]
                    saved_filename = f"{uuid.uuid4()}{ext}"
                    test_file = _record_created_file(
                        created_file_paths,
                        TestFile.objects.create(
                            test_data=test_data,
                            original_filename=file.name,
                            saved_filename=saved_filename,
                            file_path=file
                        )
                    )
                    uploaded_files.append(test_file)
        except Exception:
            _delete_file_paths(created_file_paths)
            return error_response('文件上传失败', status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return success_response(
            TestFileSerializer(uploaded_files, many=True, context={'request': request}).data,
            f'成功上传{len(uploaded_files)}个文件',
            status.HTTP_201_CREATED
        )

    @extend_schema(
        summary='生成标准数据包',
        request=inline_serializer(
            name='GeneratePackageRequest',
            fields={
                'sample_ids': serializers.ListField(child=serializers.CharField()),
                'test_type_ids': serializers.ListField(child=serializers.IntegerField()),
            },
        ),
        responses={200: OpenApiTypes.OBJECT}
    )
    @action(methods=['post'], detail=False)
    def generate_package(self, request):
        """
        生成标准数据包
        创建空文件夹结构并打包成zip文件
        """
        import tempfile
        from zipfile import ZipFile
        
        sample_ids = request.data.get('sample_ids', [])
        test_type_ids = request.data.get('test_type_ids', [])
        
        if not sample_ids:
            return error_response('请选择样品', status.HTTP_400_BAD_REQUEST)
        if not test_type_ids:
            return error_response('请选择测试类型', status.HTTP_400_BAD_REQUEST)
        
        # 获取样品和测试类型
        samples = Sample.objects.filter(sample_id__in=sample_ids)
        test_types = TestType.objects.filter(id__in=test_type_ids)
        
        # 创建临时目录
        with tempfile.TemporaryDirectory() as temp_dir:
            # 为每个样品创建文件夹
            for sample in samples:
                sample_dir = os.path.join(temp_dir, sample.sample_id)
                os.makedirs(sample_dir, exist_ok=True)
                
                # 为每个测试类型创建子文件夹
                for test_type in test_types:
                    test_type_dir = os.path.join(sample_dir, test_type.name)
                    os.makedirs(test_type_dir, exist_ok=True)
            
            # 创建zip文件
            zip_path = os.path.join(temp_dir, 'data-package.zip')
            with ZipFile(zip_path, 'w') as zipf:
                for root, dirs, files in os.walk(temp_dir):
                    for dir_name in dirs:
                        dir_path = os.path.join(root, dir_name)
                        arcname = os.path.relpath(dir_path, temp_dir)
                        zipf.write(dir_path, arcname)
            
            # 读取zip文件并返回
            with open(zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = f'attachment; filename=data-package-{int(time.time())}.zip'
                return response

    @extend_schema(
        summary='上传数据包',
        request=FileUploadSerializer,
        responses={200: OpenApiTypes.OBJECT}
    )
    @action(methods=['post'], detail=False)
    def upload_package(self, request):
        """
        上传数据包
        解析zip文件并创建测试数据
        """
        import re
        import tempfile
        from zipfile import BadZipFile, ZipFile
        
        file = request.FILES.get('file')
        if not file:
            return error_response('请上传文件', status.HTTP_400_BAD_REQUEST)
        
        if not file.name.endswith('.zip'):
            return error_response('请上传zip文件', status.HTTP_400_BAD_REQUEST)
        
        created_count = 0
        errors = []
        
        created_file_paths = []
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, 'upload.zip')
                extract_dir = os.path.join(temp_dir, 'extracted')
                os.makedirs(extract_dir, exist_ok=True)

                with open(zip_path, 'wb') as f:
                    for chunk in file.chunks():
                        f.write(chunk)
                
                with ZipFile(zip_path, 'r') as zipf:
                    for info in zipf.infolist():
                        member_name = _safe_zip_member_name(info)
                        target_path = _safe_zip_target_path(extract_dir, member_name)
                        if info.is_dir() or member_name.endswith('/'):
                            os.makedirs(target_path, exist_ok=True)
                            continue

                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with open(target_path, 'wb') as f:
                            f.write(zipf.read(info))
                
                actual_root = extract_dir
                temp_dir_contents = [
                    d for d in os.listdir(extract_dir)
                    if os.path.isdir(os.path.join(extract_dir, d))
                ]
                
                if len(temp_dir_contents) == 1:
                    potential_root = os.path.join(extract_dir, temp_dir_contents[0])
                    potential_name = temp_dir_contents[0]
                    is_sample_id_pattern = bool(re.search(r'[-_]', potential_name)) and any(c.isdigit() for c in potential_name)
                    if not is_sample_id_pattern:
                        actual_root = potential_root
                
                with transaction.atomic():
                    # 遍历实际的样品目录
                    for sample_dir in os.listdir(actual_root):
                        if sample_dir.startswith('.') or sample_dir.startswith('__'):
                            continue
                        
                        sample_path = os.path.join(actual_root, sample_dir)
                        if not os.path.isdir(sample_path):
                            continue
                        
                        # 查找对应的样品
                        try:
                            sample = Sample.objects.get(sample_id=sample_dir)
                        except Sample.DoesNotExist:
                            errors.append(f'样品 {sample_dir} 不存在')
                            continue
                        
                        # 遍历测试类型文件夹
                        for test_type_dir in os.listdir(sample_path):
                            test_type_path = os.path.join(sample_path, test_type_dir)
                            if not os.path.isdir(test_type_path):
                                continue
                            
                            # 先收集该文件夹下的所有有效文件（排除隐藏文件和空格开头的文件）
                            file_list = []
                            for file_name in os.listdir(test_type_path):
                                file_path_item = os.path.join(test_type_path, file_name)
                                if os.path.isfile(file_path_item) and not file_name.startswith('.') and not file_name.startswith('__') and not file_name.startswith(' '):
                                    file_list.append((file_name.strip(), file_path_item))
                            
                            # 如果没有文件，跳过此测试类型文件夹
                            if not file_list:
                                continue
                            
                            # 查找对应的测试类型
                            try:
                                test_type = TestType.objects.get(name=test_type_dir, project=sample.sample_type.project)
                            except TestType.DoesNotExist:
                                # 自动创建测试类型
                                test_type = TestType.objects.create(
                                    name=test_type_dir,
                                    project=sample.sample_type.project,
                                    description='自动创建'
                                )
                            
                            # 创建测试数据记录
                            test_data = TestData.objects.create(
                                sample=sample,
                                test_type=test_type,
                                test_date=timezone.now().date()
                            )
                            
                            # 处理测试文件
                            for file_name, file_path_item in file_list:
                                from django.utils import timezone as tz
                                from django.core.files.base import ContentFile
                                with open(file_path_item, 'rb') as f:
                                    file_content = f.read()
                                
                                ext = os.path.splitext(file_name)[1]
                                # 命名规则: 样品名称-测试类型-添加时间-文件原名称
                                add_time = tz.now().strftime('%Y%m%d%H%M%S')
                                sample_name = sample.name or sample.sample_id
                                # 清理文件名中的特殊字符
                                safe_sample_name = sample_name.replace(' ', '_').replace('/', '-').replace('\\', '-')
                                safe_test_type = test_type_dir.replace(' ', '_').replace('/', '-').replace('\\', '-')
                                safe_orig_name = file_name.replace('/', '-').replace('\\', '-')
                                saved_filename = f"{safe_sample_name}-{safe_test_type}-{add_time}-{safe_orig_name}"
                                # 确保文件名不超过255个字符
                                if len(saved_filename) > 255 - len(ext):
                                    saved_filename = saved_filename[:255 - len(ext)]
                                saved_filename = saved_filename + ext
                                
                                content_file = ContentFile(file_content, name=saved_filename)
                                _record_created_file(
                                    created_file_paths,
                                    TestFile.objects.create(
                                        test_data=test_data,
                                        original_filename=file_name,
                                        saved_filename=saved_filename,
                                        file_path=content_file
                                    )
                                )
                            
                            created_count += 1
        except ValueError as exc:
            _delete_file_paths(created_file_paths)
            return error_response(str(exc), status.HTTP_400_BAD_REQUEST)
        except BadZipFile:
            _delete_file_paths(created_file_paths)
            return error_response('zip文件格式不正确', status.HTTP_400_BAD_REQUEST)
        except Exception:
            _delete_file_paths(created_file_paths)
            return error_response('数据包上传失败', status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        result = {
            'created_count': created_count,
            'error_count': len(errors),
            'errors': errors
        }
        
        return success_response(result, f'成功创建{created_count}条测试数据')


    @extend_schema(
        summary='批量直接上传测试文件',
        request=BatchUploadRequestSerializer,
        responses={200: OpenApiTypes.OBJECT}
    )
    @action(methods=['post'], detail=False)
    def batch_upload(self, request):
        """
        批量直接上传测试文件，按前端确认的映射关系入库。
        """
        raw_items = request.data.get('items', [])
        if isinstance(raw_items, str):
            try:
                raw_items = json.loads(raw_items)
            except json.JSONDecodeError:
                return error_response('上传映射数据格式不正确', status.HTTP_400_BAD_REQUEST)

        serializer = BatchUploadRequestSerializer(
            data={
                'items': raw_items,
                'files': request.FILES.getlist('files'),
            },
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        validated_items = serializer.context.get('validated_items', [])
        files = request.FILES.getlist('files')
        file_keys = request.data.getlist('file_keys')
        file_map = {}
        for index, upload_file in enumerate(files):
            mapped_key = file_keys[index] if index < len(file_keys) else upload_file.name
            file_map[mapped_key] = upload_file

        created_count = 0
        file_count = 0
        errors = []
        created_file_paths = []

        missing_file_keys = [
            item['file_key'] for item in validated_items
            if item['file_key'] not in file_map
        ]
        if missing_file_keys:
            return error_response(
                f"文件未找到: {', '.join(missing_file_keys)}",
                status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                for item in validated_items:
                    file_key = item['file_key']
                    upload_file = file_map[file_key]

                    test_data = TestData.objects.create(
                        sample=item['resolved_sample'],
                        test_type=item['resolved_test_type'],
                        test_date=item.get('test_date'),
                        instrument=item.get('instrument', ''),
                        tester=item.get('tester', ''),
                        notes=item.get('notes', '')
                    )

                    ext = os.path.splitext(upload_file.name)[1]
                    saved_filename = f"{uuid.uuid4()}{ext}"
                    _record_created_file(
                        created_file_paths,
                        TestFile.objects.create(
                            test_data=test_data,
                            original_filename=upload_file.name,
                            saved_filename=saved_filename,
                            file_path=upload_file
                        )
                    )

                    created_count += 1
                    file_count += 1
        except Exception:
            _delete_file_paths(created_file_paths)
            return error_response('批量上传失败', status.HTTP_500_INTERNAL_SERVER_ERROR)

        result = {
            'created_count': created_count,
            'file_count': file_count,
            'error_count': len(errors),
            'errors': errors
        }
        return success_response(result, f'成功导入 {created_count} 条测试数据')


class TestFileViewSet(viewsets.ModelViewSet):
    """
    测试文件视图集
    """
    serializer_class = TestFileSerializer

    def get_queryset(self):
        return TestFile.objects.filter(
            test_data__sample__sample_type__project__user=self.request.user
        )

    @extend_schema(
        summary='下载测试文件',
        responses={200: OpenApiTypes.BINARY}
    )
    @action(methods=['get'], detail=True)
    def download(self, request, pk=None):
        """
        下载测试文件
        """
        test_file = self.get_object()
        response = FileResponse(
            test_file.file_path.open('rb'),
            as_attachment=True,
            filename=test_file.original_filename
        )
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.file_path:
            if os.path.isfile(instance.file_path.path):
                os.remove(instance.file_path.path)
        self.perform_destroy(instance)
        return success_response(message='文件删除成功')
