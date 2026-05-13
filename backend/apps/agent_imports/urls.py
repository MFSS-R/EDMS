from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AgentImportJobViewSet


router = DefaultRouter()
router.register(r'', AgentImportJobViewSet, basename='agent-import-job')

urlpatterns = [
    path('', include(router.urls)),
]
