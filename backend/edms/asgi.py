"""
EDMS项目ASGI配置
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edms.settings')

application = get_asgi_application()
