from django.contrib import admin
from django.urls import path
from core.views import register_user, login_user

urlpatterns = [
    path('admin/', admin.site.urls),     # ✅ ADD THIS LINE
    path("api/register/", register_user),
    path("api/login/", login_user),
]
