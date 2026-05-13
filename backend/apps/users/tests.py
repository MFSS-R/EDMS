from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import User


@override_settings(
    PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
)
class AuthTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_returns_user_and_tokens_for_immediate_login(self):
        response = self.client.post(
            reverse('register'),
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password': 'strong-password-123',
                'password2': 'strong-password-123',
                'real_name': 'New User',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()['data']
        self.assertEqual(payload['user']['username'], 'newuser')
        self.assertIn('access', payload['token'])
        self.assertIn('refresh', payload['token'])

    def test_logout_blacklists_refresh_token(self):
        User.objects.create_user(
            username='logoutuser',
            email='logoutuser@example.com',
            password='strong-password-123',
        )
        login_response = self.client.post(
            reverse('login'),
            {'username': 'logoutuser', 'password': 'strong-password-123'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        refresh = login_response.json()['refresh']
        access = login_response.json()['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        logout_response = self.client.post(
            reverse('logout'),
            {'refresh': refresh},
            format='json',
        )

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        refresh_response = self.client.post(
            reverse('token_refresh'),
            {'refresh': refresh},
            format='json',
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
