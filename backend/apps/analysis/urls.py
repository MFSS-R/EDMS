"""
分析应用URL配置
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DataProcessingAlgorithmViewSet,
    PlotDataViewSet,
    CanvasLayoutViewSet,
)

router = DefaultRouter()
router.register(r'algorithms', DataProcessingAlgorithmViewSet, basename='algorithm')
router.register(r'plot-data', PlotDataViewSet, basename='plot-data')
router.register(r'canvas-layouts', CanvasLayoutViewSet, basename='canvas-layout')

urlpatterns = [
    path('', include(router.urls)),
]
