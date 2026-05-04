"""
用户认证视图
"""
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import get_user_model

from .serializers import UserSerializer, UserListSerializer, UserRegisterSerializer, UserUpdateSerializer, PasswordChangeSerializer, AdminUserCreateSerializer, AdminUserUpdateSerializer, AdminPasswordResetSerializer
from apps.utils.responses import success_response, error_response

User = get_user_model()


class LoginView(TokenObtainPairView):
    """
    用户登录
    """
    pass


class RegisterView(APIView):
    """
    用户注册
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary='用户注册',
        request=UserRegisterSerializer,
        responses={201: UserSerializer},
    )
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            return success_response(
                UserSerializer(user).data,
                '注册成功',
                status.HTTP_201_CREATED
            )
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    用户登出
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='用户登出')
    def post(self, request):
        return success_response(message='登出成功')


class UserProfileView(APIView):
    """
    用户资料
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='获取用户资料', responses={200: UserSerializer})
    def get(self, request):
        serializer = UserSerializer(request.user)
        return success_response(serializer.data)

    @extend_schema(summary='更新用户资料', request=UserUpdateSerializer, responses={200: UserSerializer})
    def put(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return success_response(serializer.data, '用户信息更新成功')
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary='部分更新用户资料', request=UserUpdateSerializer, responses={200: UserSerializer})
    def patch(self, request):
        return self.put(request)


class PasswordChangeView(APIView):
    """
    修改密码
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='修改密码', request=PasswordChangeSerializer, responses={200: '密码修改成功'})
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return success_response(message='密码修改成功')
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)


class AdminUserListView(APIView):
    """
    管理员用户列表
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='获取用户列表', responses={200: UserListSerializer(many=True)})
    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        serializer = UserListSerializer(users, many=True, context={'request': request})
        return success_response(serializer.data)

    @extend_schema(summary='创建用户', request=AdminUserCreateSerializer, responses={201: UserSerializer})
    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            return success_response(UserSerializer(user).data, '用户创建成功', status.HTTP_201_CREATED)
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)


class AdminUserDetailView(APIView):
    """
    管理员用户详情
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    @extend_schema(summary='获取用户详情', responses={200: UserSerializer})
    def get(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return error_response('用户不存在', status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user)
        return success_response(serializer.data)

    @extend_schema(summary='更新用户', request=AdminUserUpdateSerializer, responses={200: UserSerializer})
    def put(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return error_response('用户不存在', status.HTTP_404_NOT_FOUND)
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return success_response(UserSerializer(user).data, '用户更新成功')
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary='部分更新用户', request=AdminUserUpdateSerializer, responses={200: UserSerializer})
    def patch(self, request, pk):
        return self.put(request, pk)

    @extend_schema(summary='删除用户')
    def delete(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return error_response('用户不存在', status.HTTP_404_NOT_FOUND)
        user.delete()
        return success_response(message='用户删除成功')


class AdminPasswordResetView(APIView):
    """
    管理员重置用户密码
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='重置用户密码', request=AdminPasswordResetSerializer, responses={200: '密码重置成功'})
    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return error_response('用户不存在', status.HTTP_404_NOT_FOUND)
        
        serializer = AdminPasswordResetSerializer(data=request.data, context={'user': user})
        if serializer.is_valid():
            serializer.save()
            return success_response(message='密码重置成功')
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)


class AdminUserToggleActiveView(APIView):
    """
    管理员切换用户激活状态
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='切换用户激活状态', responses={200: UserSerializer})
    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return error_response('用户不存在', status.HTTP_404_NOT_FOUND)
        
        user.is_active = not user.is_active
        user.save()
        return success_response(UserSerializer(user).data, '用户状态已更新')
