"""
测试相关URL配置
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TestTypeViewSet, TestDataSetViewSet, TestFileViewSet

router = DefaultRouter()
router.register(r'types', TestTypeViewSet, basename='test-type')
router.register(r'data', TestDataSetViewSet, basename='test-data')
router.register(r'files', TestFileViewSet, basename='test-file')

urlpatterns = [
    path('', include(router.urls)),
]
