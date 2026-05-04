"""
用户序列化器
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    is_admin = serializers.ReadOnlyField(source='is_staff')

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'real_name', 'phone', 'avatar',
                  'display_name', 'is_admin', 'is_active', 'is_staff',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserListSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    is_admin = serializers.ReadOnlyField(source='is_staff')
    project_count = serializers.SerializerMethodField()
    sample_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'real_name', 'phone',
                  'display_name', 'is_admin', 'is_active', 'is_staff',
                  'project_count', 'sample_count', 'created_at', 'updated_at']

    def get_project_count(self, obj):
        return obj.projects.count() if hasattr(obj, 'projects') else 0

    def get_sample_count(self, obj):
        from apps.samples.models import Sample
        return Sample.objects.filter(sample_type__project__user=obj).count()


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='确认密码')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'real_name']
        extra_kwargs = {
            'email': {'required': True},
            'real_name': {'required': False}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': '两次密码输入不一致'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'real_name', 'phone', 'avatar']


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='确认密码')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'real_name',
                  'phone', 'is_active', 'is_staff']
        extra_kwargs = {
            'email': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': '两次密码输入不一致'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        is_staff = validated_data.pop('is_staff', False)
        user = User.objects.create_user(**validated_data)
        user.is_staff = is_staff
        user.save()
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'real_name', 'phone', 'is_active', 'is_staff']

    def validate_is_staff(self, value):
        request = self.context.get('request')
        if request and request.user == self.instance and not value:
            raise serializers.ValidationError('不能取消自己的管理员权限')
        return value


class AdminPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True, label='确认新密码')

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password2': '两次密码输入不一致'})
        return attrs

    def save(self):
        user = self.context['user']
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True, label='确认新密码')

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('原密码错误')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password2': '两次密码输入不一致'})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
