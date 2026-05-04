"""
Shared API response helpers.
"""

from rest_framework.response import Response


def success_response(data=None, message='success', code=200, status=None):
    """
    Return a successful API response.
    """
    status_code = code if status is None else status
    return Response(
        {
            'code': code,
            'data': data,
            'message': message,
        },
        status=status_code,
    )


def error_response(message='error', code=400, data=None, status=None):
    """
    Return an error API response.
    """
    status_code = code if status is None else status
    return Response(
        {
            'code': code,
            'data': data,
            'message': message,
        },
        status=status_code,
    )
