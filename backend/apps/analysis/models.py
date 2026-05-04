"""
数据处理算法模型
"""
from django.db import models
from django.conf import settings
from apps.tests.models import TestType, TestData


class DataProcessingAlgorithm(models.Model):
    """
    数据处理算法模型
    用于存储和管理不同测试类型的数据处理算法
    """
    test_type = models.ForeignKey(
        TestType,
        on_delete=models.CASCADE,
        related_name='algorithms',
        verbose_name='测试类型'
    )
    name = models.CharField('算法名称', max_length=200)
    description = models.TextField('算法描述', blank=True, default='')
    script = models.TextField('Python脚本', help_text='用于处理数据并输出JSON格式画图数据的Python代码')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)
    is_active = models.BooleanField('是否启用', default=True)

    class Meta:
        db_table = 'data_processing_algorithms'
        verbose_name = '数据处理算法'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['test_type', 'name'],
                name='unique_test_type_algorithm'
            )
        ]

    def __str__(self):
        return f"{self.test_type.name} - {self.name}"


class PlotData(models.Model):
    """
    画图数据模型
    存储算法处理后的干净数据，用于快速生成图表
    """
    test_data = models.OneToOneField(
        TestData,
        on_delete=models.CASCADE,
        related_name='plot_data',
        verbose_name='实验数据'
    )
    algorithm = models.ForeignKey(
        DataProcessingAlgorithm,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plot_data',
        verbose_name='使用的算法'
    )
    dimensions = models.IntegerField('数据维度', help_text='2表示二维图，3表示三维图')
    x_column = models.CharField('X轴列名', max_length=200, default='', help_text='X轴的列名，如"频率"')
    x_unit = models.CharField('X轴单位', max_length=50, default='', blank=True, help_text='X轴的单位，如"Hz"')
    y_column = models.CharField('Y轴列名', max_length=200, default='', blank=True, help_text='Y轴的列名，如"磁导率"')
    y_unit = models.CharField('Y轴单位', max_length=50, default='', blank=True, help_text='Y轴的单位，如"μH/m"')
    series = models.JSONField('数据系列', default=list, help_text='如[{"name": "实部", "data": [[1,2],[3,4]]}]')
    columns = models.JSONField('数据列名(旧格式)', default=None, null=True, blank=True, help_text='旧格式兼容字段')
    data = models.JSONField('处理后的数据(旧格式)', default=None, null=True, blank=True, help_text='旧格式兼容字段')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'plot_data'
        verbose_name = '画图数据'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.test_data} - {self.dimensions}D"


class CanvasLayout(models.Model):
    """
    画布布局模型
    用于保存用户的画布对比分析布局配置
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='canvas_layouts',
        verbose_name='所属用户'
    )
    name = models.CharField('布局名称', max_length=200)
    layout_data = models.JSONField(
        '布局数据',
        default=dict,
        help_text='包含卡片位置、大小、图表配置等'
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'canvas_layouts'
        verbose_name = '画布布局'
        verbose_name_plural = verbose_name
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} - {self.name}"