"""
测试相关模型
包含测试类型、测试数据和测试文件三个模型
"""
import os
import uuid
from django.db import models
from django.conf import settings
from apps.projects.models import Project
from apps.samples.models import Sample


def test_file_upload_path(instance, filename):
    """
    生成测试文件上传路径：edms/test_files/年/月/日/
    """
    from django.utils import timezone
    now = timezone.now()
    return os.path.join(
        'test_files',
        str(now.year),
        str(now.month),
        str(now.day),
        filename
    )


class TestType(models.Model):
    """
    测试类型模型
    完全动态，不预先定义任何测试类型，仅在用户上传测试数据时创建
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='test_types',
        verbose_name='所属项目'
    )
    name = models.CharField('测试类型名称', max_length=100)
    description = models.TextField('测试类型描述', blank=True, default='')
    usage_count = models.IntegerField('使用次数', default=0)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        db_table = 'test_types'
        verbose_name = '测试类型'
        verbose_name_plural = verbose_name
        ordering = ['-usage_count', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                name='unique_project_test_type'
            )
        ]

    def __str__(self):
        return f"{self.project.name} - {self.name}"

    def increment_usage(self):
        """
        增加使用次数
        """
        self.usage_count += 1
        self.save(update_fields=['usage_count'])


class TestData(models.Model):
    """
    测试数据模型
    一个样品可以拥有多个测试数据，一个测试类型可以被多个样品使用
    """
    sample = models.ForeignKey(
        Sample,
        on_delete=models.CASCADE,
        related_name='test_data',
        verbose_name='所属样品'
    )
    test_type = models.ForeignKey(
        TestType,
        on_delete=models.CASCADE,
        related_name='test_data',
        verbose_name='测试类型'
    )
    test_date = models.DateField('测试日期', null=True, blank=True)
    instrument = models.CharField('测试仪器', max_length=200, blank=True, default='')
    tester = models.CharField('测试人员', max_length=100, blank=True, default='')
    structured_data = models.JSONField(
        '结构化数据',
        default=dict,
        blank=True,
        help_text='存储结构化的测试数据'
    )
    notes = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'test_data'
        verbose_name = '测试数据'
        verbose_name_plural = verbose_name
        ordering = ['-test_date', '-created_at']

    def __str__(self):
        return f"{self.sample.sample_id} - {self.test_type.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.test_type.increment_usage()

    @property
    def project(self):
        return self.sample.sample_type.project

    @property
    def file_count(self):
        return self.files.count()


class TestFile(models.Model):
    """
    测试文件模型
    一个测试数据可以拥有多个测试文件
    """
    test_data = models.ForeignKey(
        TestData,
        on_delete=models.CASCADE,
        related_name='files',
        verbose_name='所属测试数据'
    )
    original_filename = models.CharField('原始文件名', max_length=255)
    saved_filename = models.CharField('保存后的文件名', max_length=255)
    file_path = models.FileField('文件路径', upload_to=test_file_upload_path)
    file_size = models.BigIntegerField('文件大小（字节）', default=0)
    file_type = models.CharField('文件类型', max_length=100, blank=True, default='')
    uploaded_at = models.DateTimeField('上传时间', auto_now_add=True)

    class Meta:
        db_table = 'test_files'
        verbose_name = '测试文件'
        verbose_name_plural = verbose_name
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.original_filename

    def save(self, *args, **kwargs):
        if self.file_path:
            self.file_size = self.file_path.size
            filename = self.file_path.name
            ext = os.path.splitext(filename)[1].lower()
            self.file_type = ext.lstrip('.')
        super().save(*args, **kwargs)

    @property
    def file_size_display(self):
        """
        返回人类可读的文件大小
        """
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} TB"


from django.db.models.signals import post_delete
from django.dispatch import receiver


@receiver(post_delete, sender=TestFile)
def delete_test_file_on_deletion(sender, instance, **kwargs):
    """
    当TestFile记录被删除时，自动删除磁盘上的对应文件
    """
    if instance.file_path:
        if os.path.isfile(instance.file_path.path):
            os.remove(instance.file_path.path)


@receiver(post_delete, sender=TestData)
def delete_test_data_files_on_deletion(sender, instance, **kwargs):
    """
    当TestData记录被删除时，自动删除其关联的所有测试文件（磁盘上）
    """
    for test_file in instance.files.all():
        if test_file.file_path and os.path.isfile(test_file.file_path.path):
            os.remove(test_file.file_path.path)
