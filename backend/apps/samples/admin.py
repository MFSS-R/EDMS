from django.contrib import admin
from .models import SampleType, Sample


@admin.register(SampleType)
class SampleTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'sample_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description', 'project__name']
    raw_id_fields = ['project']

    def sample_count(self, obj):
        return obj.sample_count
    sample_count.short_description = '样品数量'


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ['sample_id', 'name', 'sample_type', 'synthesis_date', 'mark', 'created_at']
    list_filter = ['synthesis_date', 'created_at', 'sample_type']
    search_fields = ['sample_id', 'name', 'batch_number']
    raw_id_fields = ['sample_type']
