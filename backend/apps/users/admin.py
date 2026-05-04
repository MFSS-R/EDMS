from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'real_name', 'is_active', 'is_staff', 'created_at']
    list_filter = ['is_active', 'is_staff', 'created_at']
    search_fields = ['username', 'email', 'real_name']
    readonly_fields = ['created_at', 'updated_at', 'last_login']
    fieldsets = (
        ('基本信息', {
            'fields': ('username', 'email', 'real_name', 'phone', 'avatar')
        }),
        ('权限', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at', 'last_login', 'date_joined')
        }),
    )
