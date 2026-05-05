from rest_framework.permissions import BasePermission


class IsStaffUser(BasePermission):
    """
    Allow access only to authenticated staff/admin users.
    """

    message = '仅管理员可执行此操作'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and user.is_staff)
