from django.contrib import admin
from django.urls import path
from core.views import (
    register_user,
    login_user,
    period_logs,
    delete_period_log,
    chatbot,profile,chat_history, chat_clear, insights, mood_logs, mood_log_detail, symptom_logs, delete_symptom_log

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
    path("api/insights/", insights),
    path("api/mood-logs/", mood_logs),
    path("api/mood-logs/<int:pk>/", mood_log_detail),
    path("api/symptom-logs/", symptom_logs),
    path("api/symptom-logs/<int:pk>/", delete_symptom_log),


]
