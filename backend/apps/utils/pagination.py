from rest_framework.pagination import PageNumberPagination


class CustomPageNumberPagination(PageNumberPagination):
    """
    自定义分页类，支持从请求参数中获取page_size
    """
    page_size_query_param = 'page_size'  # 允许通过page_size参数指定每页大小
    max_page_size = 1000  # 最大每页大小限制
