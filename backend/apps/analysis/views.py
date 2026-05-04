"""
数据处理算法视图集
"""
import os
import json
import tempfile
import subprocess
import sys
from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import DataProcessingAlgorithm, PlotData, CanvasLayout
from .serializers import (
    DataProcessingAlgorithmSerializer,
    DataProcessingAlgorithmCreateSerializer,
    DataProcessingAlgorithmListSerializer,
    PlotDataSerializer,
    CanvasLayoutSerializer
)
from .script_validation import validate_algorithm_script
from apps.utils.responses import success_response, error_response


def normalize_plot_output(output):
    """
    将算法输出统一转换为series格式
    支持两种输入格式:
    1. 新格式(series): {"dimensions": 2, "x_column": "频率", "x_unit": "Hz", "y_column": "磁导率", "y_unit": "μH/m", "series": [...]}
    2. 旧格式(columns+data): {"dimensions": 2, "columns": ["频率","磁导率"], "data": [[1,2],[3,4]]}
    """
    if 'series' in output and output['series']:
        if 'x_column' not in output or not output['x_column']:
            if output['series'] and output['series'][0].get('data'):
                first_point = output['series'][0]['data'][0] if output['series'][0]['data'] else None
                if first_point and len(first_point) > 0:
                    output['x_column'] = 'X'
        output.setdefault('x_unit', '')
        output.setdefault('y_column', '')
        output.setdefault('y_unit', '')
        return output

    if 'columns' in output and 'data' in output:
        columns = output['columns']
        data = output['data']
        dimensions = output.get('dimensions', 2)

        if not data:
            output['x_column'] = columns[0] if columns else 'X'
            output['series'] = []
            output.setdefault('x_unit', '')
            output.setdefault('y_column', '')
            output.setdefault('y_unit', '')
            return output

        x_column = columns[0]
        series = []
        for i in range(1, len(columns)):
            series_data = []
            for row in data:
                if len(row) > i:
                    point = [row[0], row[i]] if dimensions == 2 else [row[0], row[1], row[i]] if len(row) > 2 and i > 1 else [row[0], row[i]]
                    series_data.append(point)
            series.append({
                'name': columns[i],
                'data': series_data
            })

        output['x_column'] = x_column
        output['series'] = series
        output.setdefault('x_unit', '')
        output.setdefault('y_column', '')
        output.setdefault('y_unit', '')
        return output

    raise Exception('脚本输出格式不正确，需要包含series字段或columns+data字段')


def validate_series_item(series_item, dimensions):
    if 'name' not in series_item:
        raise Exception('每个 series 都必须包含 name 字段')

    has_point_data = 'data' in series_item
    has_grid_data = (
        series_item.get('format') == 'grid'
        or (
            'x_values' in series_item
            and 'y_values' in series_item
            and 'z_matrix' in series_item
        )
    )

    if not has_point_data and not has_grid_data:
        raise Exception(f'series "{series_item.get("name", "")}" 必须包含 data 或 grid 结构')

    if has_point_data:
        if not isinstance(series_item['data'], list):
            raise Exception(f'series "{series_item.get("name", "")}" 的 data 字段必须为列表')
        return

    x_values = series_item.get('x_values')
    y_values = series_item.get('y_values')
    z_matrix = series_item.get('z_matrix')

    if not isinstance(x_values, list) or not isinstance(y_values, list) or not isinstance(z_matrix, list):
        raise Exception(f'series "{series_item.get("name", "")}" 的 grid 结构必须包含列表类型的 x_values、y_values、z_matrix')

    if dimensions != 3:
        raise Exception('grid 结构目前仅支持 dimensions=3 的三维数据')

    if len(z_matrix) != len(y_values):
        raise Exception(f'series "{series_item.get("name", "")}" 的 z_matrix 行数必须与 y_values 长度一致')

    for row in z_matrix:
        if not isinstance(row, list):
            raise Exception(f'series "{series_item.get("name", "")}" 的 z_matrix 每一行都必须是列表')
        if len(row) != len(x_values):
            raise Exception(f'series "{series_item.get("name", "")}" 的 z_matrix 每一行长度必须与 x_values 长度一致')


def build_runtime_script(script_text):
    return (
        "import os\n"
        "import socket\n"
        "import subprocess\n"
        "\n"
        "def _blocked(*args, **kwargs):\n"
        "    raise RuntimeError('当前算法环境禁止使用该能力')\n"
        "\n"
        "socket.socket = _blocked\n"
        "subprocess.Popen = _blocked\n"
        "subprocess.run = _blocked\n"
        "subprocess.call = _blocked\n"
        "subprocess.check_output = _blocked\n"
        "os.system = _blocked\n"
        "os.popen = _blocked\n"
        "\n"
        f"{script_text}"
    )


def execute_algorithm_script(algorithm, file_path, script_override=None):
    """
    执行算法脚本并返回JSON格式的画图数据
    新格式:
    {
        "dimensions": 2,
        "x_column": "频率",
        "x_unit": "Hz",
        "y_column": "磁导率",
        "y_unit": "μH/m",
        "series": [
            {"name": "实部", "data": [[1, 2.5], [3, 2.8]]},
            {"name": "虚部", "data": [[1, 1.2], [3, 1.5]]}
        ]
    }
    旧格式(兼容):
    {
        "dimensions": 2,
        "columns": ["频率", "磁导率"],
        "data": [[1, 2.5], [3, 2.8]]
    }
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, 'algorithm.py')
        script_text = script_override if script_override is not None else algorithm.script
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(build_runtime_script(script_text))

        try:
            result = subprocess.run(
                [sys.executable, script_path, file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
        except subprocess.TimeoutExpired:
            raise Exception('脚本执行超时（30秒）')
        except Exception as e:
            try:
                result = subprocess.run(
                    f'"{sys.executable}" "{script_path}" "{file_path}"',
                    capture_output=True,
                    text=True,
                    timeout=30,
                    shell=True
                )
            except Exception as shell_error:
                raise Exception(f'脚本执行失败: {str(shell_error)}')

        if result.returncode != 0:
            raise Exception(f'脚本执行失败: {result.stderr}')

        try:
            output = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            raise Exception(f'脚本输出不是有效的JSON格式。输出内容: {result.stdout[:500]}')

        if not isinstance(output.get('dimensions'), int) or output['dimensions'] not in (2, 3):
            raise Exception('dimensions字段必须为2或3')

        has_series = 'series' in output and output['series']
        has_old_format = 'columns' in output and 'data' in output

        if not has_series and not has_old_format:
            raise Exception('脚本输出必须包含series字段或columns+data字段')

        if has_series:
            if not isinstance(output['series'], list) or len(output['series']) == 0:
                raise Exception('series字段必须为非空列表')
            for s in output['series']:
                validate_series_item(s, output['dimensions'])

        if has_old_format:
            if not isinstance(output['columns'], list) or len(output['columns']) < 2:
                raise Exception('columns字段应为长度至少为2的列表')
            if not isinstance(output['data'], list):
                raise Exception('data字段应为二维数组')

        output = normalize_plot_output(output)
        return output


class DataProcessingAlgorithmViewSet(viewsets.ModelViewSet):
    """
    数据处理算法视图集
    """
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['test_type', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['-created_at']

    def get_queryset(self):
        return DataProcessingAlgorithm.objects.filter(
            test_type__project__user=self.request.user
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return DataProcessingAlgorithmCreateSerializer
        elif self.action == 'list':
            return DataProcessingAlgorithmListSerializer
        return DataProcessingAlgorithmSerializer

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
            return error_response(str(e), status=500)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            DataProcessingAlgorithmSerializer(serializer.instance).data,
            '算法创建成功',
            status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = DataProcessingAlgorithmSerializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, '算法更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='算法删除成功')

    @action(methods=['post'], detail=False)
    def validate_script(self, request):
        script = request.data.get('script', '')
        validation_result = validate_algorithm_script(script)
        return success_response(validation_result)

    @action(methods=['post'], detail=True)
    def test_run(self, request, pk=None):
        """
        试运行算法，返回JSON格式的画图数据
        """
        try:
            algorithm = self.get_object()
            test_file = request.FILES.get('file')
            script_override = request.data.get('script')

            if not test_file:
                return error_response('请上传测试文件', status=400)

            if script_override is not None:
                validation_result = validate_algorithm_script(script_override)
                if not validation_result['valid']:
                    return error_response(
                        '当前脚本校验未通过，请先修复后再试运行',
                        status=400,
                        data=validation_result
                    )

            with tempfile.TemporaryDirectory() as temp_dir:
                file_path = os.path.join(temp_dir, test_file.name)
                with open(file_path, 'wb') as f:
                    for chunk in test_file.chunks():
                        f.write(chunk)

                try:
                    plot_result = execute_algorithm_script(
                        algorithm,
                        file_path,
                        script_override=script_override,
                    )
                except Exception as e:
                    return error_response(str(e), status=400)

            return success_response(plot_result, '试运行成功')

        except Exception as e:
            import traceback
            traceback.print_exc()
            return error_response(f'试运行失败: {str(e)}', status=500)


class PlotDataViewSet(viewsets.ModelViewSet):
    """
    画图数据视图集
    """
    serializer_class = PlotDataSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['test_data', 'algorithm', 'dimensions']
    ordering = ['-created_at']

    def get_queryset(self):
        return PlotData.objects.filter(
            test_data__sample__sample_type__project__user=self.request.user
        ).select_related(
            'test_data', 'test_data__sample', 'test_data__test_type', 'algorithm'
        )

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(queryset, many=True)
            return success_response(serializer.data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return error_response(str(e), status=500)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return success_response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='画图数据删除成功')

    @action(methods=['post'], detail=False)
    def process(self, request):
        """
        对指定的测试数据执行算法处理，生成画图数据
        """
        test_data_id = request.data.get('test_data_id')
        algorithm_id = request.data.get('algorithm_id')

        if not test_data_id:
            return error_response('请提供test_data_id', status=400)

        from apps.tests.models import TestData, TestFile

        try:
            test_data = TestData.objects.get(id=test_data_id)
        except TestData.DoesNotExist:
            return error_response('测试数据不存在', status=404)

        if test_data.sample.sample_type.project.user != request.user:
            return error_response('无权访问此测试数据', status=403)

        if algorithm_id:
            try:
                algorithm = DataProcessingAlgorithm.objects.get(id=algorithm_id)
            except DataProcessingAlgorithm.DoesNotExist:
                return error_response('算法不存在', status=404)
        else:
            algorithm = DataProcessingAlgorithm.objects.filter(
                test_type=test_data.test_type,
                is_active=True
            ).first()
            if not algorithm:
                return error_response(
                    f'测试类型"{test_data.test_type.name}"没有可用的算法，请先创建算法',
                    status=400
                )

        test_file = test_data.files.first()
        if not test_file:
            return error_response('该测试数据没有关联的文件', status=400)

        file_path = test_file.file_path.path
        if not os.path.exists(file_path):
            return error_response('测试文件不存在', status=400)

        try:
            plot_result = execute_algorithm_script(algorithm, file_path)
        except Exception as e:
            return error_response(f'算法执行失败: {str(e)}', status=400)

        plot_data, created = PlotData.objects.update_or_create(
            test_data=test_data,
            defaults={
                'algorithm': algorithm,
                'dimensions': plot_result['dimensions'],
                'x_column': plot_result.get('x_column', ''),
                'x_unit': plot_result.get('x_unit', ''),
                'y_column': plot_result.get('y_column', ''),
                'y_unit': plot_result.get('y_unit', ''),
                'series': plot_result['series'],
                'columns': plot_result.get('columns'),
                'data': plot_result.get('data'),
            }
        )

        serializer = PlotDataSerializer(plot_data)
        return success_response(
            serializer.data,
            '画图数据生成成功' if created else '画图数据更新成功'
        )

    @action(methods=['get'], detail=False)
    def by_test_data(self, request):
        """
        根据测试数据ID获取画图数据
        """
        test_data_id = request.query_params.get('test_data_id')
        if not test_data_id:
            return error_response('请提供test_data_id', status=400)

        try:
            plot_data = PlotData.objects.select_related(
                'test_data', 'test_data__sample', 'test_data__test_type', 'algorithm'
            ).get(test_data_id=test_data_id)
        except PlotData.DoesNotExist:
            return error_response('该测试数据尚未生成画图数据', status=404)

        if plot_data.test_data.sample.sample_type.project.user != request.user:
            return error_response('无权访问此数据', status=403)

        serializer = PlotDataSerializer(plot_data)
        return success_response(serializer.data)

    @action(methods=['post'], detail=False)
    def compare(self, request):
        """
        对比多个样品的同一测试类型数据，生成对比图表数据
        """
        sample_ids = list(dict.fromkeys(request.data.get('sample_ids', [])))
        test_type_id = request.data.get('test_type_id')
        algorithm_id = request.data.get('algorithm_id')

        if not sample_ids or not test_type_id:
            return error_response('请提供 sample_ids 和 test_type_id', status=400)

        if len(sample_ids) > 10:
            return error_response('最多支持对比 10 个样品', status=400)

        from apps.samples.models import Sample
        from apps.tests.models import TestData

        samples = Sample.objects.filter(
            sample_id__in=sample_ids
        ).select_related('sample_type__project')
        sample_map = {sample.sample_id: sample for sample in samples}

        missing_samples = [sample_id for sample_id in sample_ids if sample_id not in sample_map]
        if missing_samples:
            return error_response(
                f'以下样品不存在: {", ".join(missing_samples)}',
                status=404
            )

        for sample_id in sample_ids:
            sample = sample_map[sample_id]
            if sample.sample_type.project.user != request.user:
                return error_response(f'无权访问样品 {sample.sample_id}', status=403)

        test_data_candidates = TestData.objects.filter(
            sample_id__in=sample_ids,
            test_type_id=test_type_id
        ).select_related('sample', 'test_type').prefetch_related('files')

        if not test_data_candidates.exists():
            return error_response('所选样品没有该测试类型的数据', status=404)

        test_data_by_sample = {}
        for test_data in test_data_candidates:
            if test_data.sample_id not in test_data_by_sample:
                test_data_by_sample[test_data.sample_id] = test_data

        missing_data = [sample_id for sample_id in sample_ids if sample_id not in test_data_by_sample]
        if missing_data:
            return error_response(
                f'以下样品没有该测试类型的数据: {", ".join(missing_data)}',
                status=404
            )

        if algorithm_id:
            try:
                algorithm = DataProcessingAlgorithm.objects.get(id=algorithm_id)
            except DataProcessingAlgorithm.DoesNotExist:
                return error_response('算法不存在', status=404)
        else:
            algorithm = DataProcessingAlgorithm.objects.filter(
                test_type_id=test_type_id,
                is_active=True
            ).first()
            if not algorithm:
                return error_response(
                    '该测试类型没有可用的算法，请先创建算法',
                    status=400
                )

        series = []
        warnings = []
        successful_sample_ids = []
        x_column = ''
        x_unit = ''
        y_column = ''
        y_unit = ''
        dimensions = 2

        def format_algorithm_error(exc):
            error_text = str(exc).strip()
            lines = [line.strip() for line in error_text.splitlines() if line.strip()]

            for line in reversed(lines):
                if (
                    line.startswith('Traceback')
                    or line.startswith('File "')
                    or line.startswith('~~~~')
                    or line == '^'
                ):
                    continue
                return line

            return error_text

        for sample_id in sample_ids:
            test_data = test_data_by_sample[sample_id]
            sample_label = test_data.sample.name or test_data.sample.sample_id
            test_file = test_data.files.first()
            if not test_file:
                warnings.append(f'样品 {test_data.sample.sample_id} 缺少测试文件，已跳过')
                continue

            file_path = getattr(test_file.file_path, 'path', '')
            if not file_path or not os.path.exists(file_path):
                warnings.append(f'样品 {test_data.sample.sample_id} 的测试文件不存在，已跳过')
                continue

            try:
                plot_result = execute_algorithm_script(algorithm, file_path)
            except Exception as e:
                warnings.append(
                    f'样品 {test_data.sample.sample_id} 算法执行失败: {format_algorithm_error(e)}'
                )
                continue

            current_series = plot_result.get('series') or []
            if not current_series:
                warnings.append(f'样品 {test_data.sample.sample_id} 未生成可用曲线，已跳过')
                continue

            successful_sample_ids.append(sample_id)

            for s in current_series:
                series.append({
                    'name': f'{sample_label} - {s["name"]}' if len(sample_ids) > 1 else s['name'],
                    'data': s['data'],
                })

            if not x_column:
                x_column = plot_result.get('x_column', '')
                x_unit = plot_result.get('x_unit', '')
                y_column = plot_result.get('y_column', '')
                y_unit = plot_result.get('y_unit', '')
                dimensions = plot_result.get('dimensions', 2)

        if not series:
            return error_response(
                '所选样品都未能生成对比图，请检查测试文件或算法配置',
                status=400,
                data={
                    'warnings': warnings,
                    'failed_sample_ids': sample_ids,
                }
            )

        failed_sample_ids = [sample_id for sample_id in sample_ids if sample_id not in successful_sample_ids]
        result = {
            'dimensions': dimensions,
            'x_column': x_column,
            'x_unit': x_unit,
            'y_column': y_column,
            'y_unit': y_unit,
            'series': series,
            'warnings': warnings,
            'failed_sample_ids': failed_sample_ids,
            'successful_sample_ids': successful_sample_ids,
        }

        message = '对比数据生成成功'
        if failed_sample_ids:
            message = f'对比数据已生成，已自动跳过 {len(failed_sample_ids)} 个异常样品'

        return success_response(result, message)


class CanvasLayoutViewSet(viewsets.ModelViewSet):
    """
    画布布局视图集
    """
    serializer_class = CanvasLayoutSerializer
    queryset = CanvasLayout.objects.none()
    ordering = ['-updated_at']

    def get_queryset(self):
        return CanvasLayout.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return success_response({
                'count': len(serializer.data),
                'results': serializer.data,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return error_response(str(e), status=500)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return success_response(
            serializer.data,
            '布局保存成功',
            status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, '布局更新成功')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response(message='布局删除成功')
