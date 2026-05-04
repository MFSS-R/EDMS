"""
自定义异常处理
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    自定义异常处理器，统一返回格式
    """
    response = exception_handler(exc, context)
    
    if response is not None:
        error_message = ''
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                error_message = response.data['detail']
            elif 'message' in response.data:
                error_message = response.data['message']
            else:
                error_messages = []
                for key, value in response.data.items():
                    if isinstance(value, list):
                        error_messages.extend([f"{key}: {v}" for v in value])
                    else:
                        error_messages.append(f"{key}: {value}")
                error_message = '; '.join(error_messages)
        elif isinstance(response.data, list):
            error_message = '; '.join(str(item) for item in response.data)
        else:
            error_message = str(response.data)
        
        response.data = {
            'code': response.status_code,
            'data': None,
            'message': error_message
        }
    else:
        logger.error(f"Unhandled exception: {exc}")
        response = Response(
            {
                'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                'data': None,
                'message': '服务器内部错误'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response
