from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.utils.responses import success_response
from apps.utils.version import get_app_version


class AppVersionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return success_response({
            'version': get_app_version(),
        })
