"""
样品相关模型
包含实验、样品类型和样品。
"""

from django.db import models
from apps.projects.models import Project


class Experiment(models.Model):
    """
    实验模型
    """

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='experiments',
        verbose_name='所属项目',
    )
    name = models.CharField('实验名称', max_length=200)
    description = models.TextField('实验描述', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'experiments'
        verbose_name = '实验'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                name='unique_project_experiment',
            )
        ]

    def __str__(self):
        return f"{self.project.name} - {self.name}"

    @property
    def sample_count(self):
        return self.samples.count()


class SampleType(models.Model):
    """
    样品类型模型
    """

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='sample_types',
        verbose_name='所属项目',
    )
    name = models.CharField('样品类型名称', max_length=100)
    description = models.TextField('样品类型描述', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        db_table = 'sample_types'
        verbose_name = '样品类型'
        verbose_name_plural = verbose_name
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                name='unique_project_sample_type',
            )
        ]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class Sample(models.Model):
    """
    样品模型
    主键为系统自动生成的样品编号。
    """

    sample_id = models.CharField(
        '样品编号',
        max_length=50,
        primary_key=True,
        editable=False,
    )
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE,
        related_name='samples',
        verbose_name='所属实验',
        null=True,
        blank=True,
    )
    sample_type = models.ForeignKey(
        SampleType,
        on_delete=models.CASCADE,
        related_name='samples',
        verbose_name='所属样品类型',
    )
    name = models.CharField('样品名称', max_length=200, blank=True, default='')
    display_code = models.CharField('显示编号', max_length=100, blank=True, default='')
    preparation_conditions = models.JSONField(
        '制备条件',
        default=dict,
        blank=True,
        help_text='瀹屽叏鑷敱鐨勯敭鍊煎锛屾瘡涓牱鍝佸彲浠ュ畬鍏ㄤ笉鍚?',
    )
    synthesis_date = models.DateField('合成日期', null=True, blank=True)
    batch_number = models.CharField('批次号', max_length=100, blank=True, default='')
    mark = models.CharField('标记', max_length=100, blank=True, default='', help_text='用于标记样品状态')
    notes = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'samples'
        verbose_name = '样品'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sample_id} - {self.name}" if self.name else self.sample_id

    def save(self, *args, **kwargs):
        if not self.sample_id:
            self.sample_id = self.generate_sample_id()
        super().save(*args, **kwargs)

    def generate_sample_id(self):
        """
        生成样品编号：项目名-样品类型-序号-日期
        """
        from django.utils import timezone
        import random

        today = timezone.now().date()
        date_str = today.strftime('%Y%m%d')

        project_name = self.experiment.project.name.replace(' ', '')[:10]
        sample_type_name = self.sample_type.name.replace(' ', '')[:10]
        sample_count = Sample.objects.filter(sample_type=self.sample_type).count() + 1

        max_attempts = 5
        for _ in range(max_attempts):
            sample_id = f"{project_name}-{sample_type_name}-{sample_count:03d}-{date_str}"
            if not Sample.objects.filter(sample_id=sample_id).exists():
                return sample_id
            sample_count += 1

        random_suffix = random.randint(100, 999)
        return f"{project_name}-{sample_type_name}-{sample_count:03d}-{date_str}-{random_suffix}"

    @property
    def project(self):
        return self.experiment.project

    @property
    def display_name(self):
        return self.name or self.sample_id

    @property
    def primary_label(self):
        return self.display_code or self.display_name

    @property
    def secondary_label(self):
        if self.display_code and self.name and self.name != self.display_code:
            return self.name
        return self.sample_id

    @property
    def full_label(self):
        parts = []
        if self.display_code:
            parts.append(self.display_code)
        if self.name and self.name != self.display_code:
            parts.append(self.name)
        if self.sample_id not in parts:
            parts.append(self.sample_id)
        return ' · '.join(parts)

    @property
    def test_types(self):
        from apps.tests.models import TestData

        return TestData.objects.filter(sample=self).values_list(
            'test_type__name',
            flat=True,
        ).distinct()

    @property
    def test_data_count(self):
        from apps.tests.models import TestData

        return TestData.objects.filter(sample=self).count()
