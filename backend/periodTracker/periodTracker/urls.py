from django.contrib import admin
from django.urls import path
from core.views import register_user, login_user, period_logs, delete_period_log

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/register/", register_user),
    path("api/login/", login_user),

    path("api/period-logs/", period_logs),
    path("api/period-logs/<int:pk>/", delete_period_log),
]
