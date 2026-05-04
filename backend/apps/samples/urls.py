"""
样品URL配置
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SampleTypeViewSet, SampleViewSet, ExperimentViewSet

router = DefaultRouter()
router.register(r'experiments', ExperimentViewSet, basename='experiment')
router.register(r'types', SampleTypeViewSet, basename='sample-type')
router.register(r'', SampleViewSet, basename='sample')

urlpatterns = [
    path('', include(router.urls)),
]