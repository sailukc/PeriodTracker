from django.contrib import admin
from django.urls import path
from core.views import (
    register_user,
    login_user,
    period_logs,
    delete_period_log,
    chatbot,profile,chat_history, chat_clear,ai_insights,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/register/", register_user),
    path("api/login/", login_user),
    path("api/profile/", profile),

    path("api/period-logs/", period_logs),
    path("api/period-logs/<int:pk>/", delete_period_log),
    path("api/chat/history/", chat_history),
    path("api/chatbot/", chatbot),
    path("api/chat/clear/", chat_clear),
    path("api/ai/insights/", ai_insights),

]
