from django.contrib import admin
from .models import TestType, TestData, TestFile


@admin.register(TestType)
class TestTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'usage_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description', 'project__name']
    raw_id_fields = ['project']


@admin.register(TestData)
class TestDataAdmin(admin.ModelAdmin):
    list_display = ['sample', 'test_type', 'test_date', 'instrument', 'tester', 'created_at']
    list_filter = ['test_date', 'created_at', 'test_type']
    search_fields = ['sample__sample_id', 'instrument', 'tester']
    raw_id_fields = ['sample', 'test_type']


@admin.register(TestFile)
class TestFileAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'test_data', 'file_size', 'file_type', 'uploaded_at']
    list_filter = ['file_type', 'uploaded_at']
    search_fields = ['original_filename']
    raw_id_fields = ['test_data']
