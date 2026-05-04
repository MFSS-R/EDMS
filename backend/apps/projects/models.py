"""
项目模型
"""
from django.db import models
from django.conf import settings


class Project(models.Model):
    """
    项目模型
    一个用户可以拥有多个项目
    """
    STATUS_CHOICES = [
        ('in_progress', '进行中'),
        ('completed', '已完成'),
        ('archived', '已归档'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
        verbose_name='所属用户'
    )
    name = models.CharField('项目名称', max_length=200)
    description = models.TextField('项目描述', blank=True, default='')
    status = models.CharField(
        '项目状态',
        max_length=20,
        choices=STATUS_CHOICES,
        default='in_progress'
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'projects'
        verbose_name = '项目'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def sample_count(self):
        """
        获取项目下的样品数量
        """
        from apps.samples.models import Sample
        sample_type_ids = self.sample_types.values_list('id', flat=True)
        return Sample.objects.filter(sample_type_id__in=sample_type_ids).count()

    @property
    def sample_type_count(self):
        """
        获取项目下的样品类型数量
        """
        return self.sample_types.count()

    @property
    def test_type_count(self):
        """
        获取项目下的测试类型数量
        """
        return self.test_types.count()
