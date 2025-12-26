from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/register/", views.register_user),
    path("api/login/", views.login_user),

    path("api/period-logs/", views.period_logs),
    path("api/period-logs/<int:pk>/", views.delete_period_log),
]
