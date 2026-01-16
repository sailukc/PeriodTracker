from django.contrib import admin
from django.urls import path
from core.views import (
    register_user,
    login_user,
    profile,
    period_logs,
    delete_period_log,
    chat_history,
    chatbot,
    chat_clear,
    ai_insights,
    mood_logs,
    mood_log_detail,
    symptom_logs,
    delete_symptom_log,
    ai_mood_tip,
    ai_symptom_tip,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/register/", register_user),
    path("api/login/", login_user),

    # Profile
    path("api/profile/", profile),

    # Period logs
    path("api/period-logs/", period_logs),
    path("api/period-logs/<int:pk>/", delete_period_log),

    # Chat
    path("api/chat/history/", chat_history),
    path("api/chatbot/", chatbot),
    path("api/chat/clear/", chat_clear),

    # AI
    path("api/ai/insights/", ai_insights),
    path("api/ai/mood/", ai_mood_tip),
    path("api/ai/symptoms/", ai_symptom_tip),

    path("api/mood-logs/", mood_logs),
    path("api/mood-logs/<int:pk>/", mood_log_detail),

    # Symptom logs
    path("api/symptom-logs/", symptom_logs),
    path("api/symptom-logs/<int:pk>/", delete_symptom_log),
    path("api/ai/symptoms/", ai_symptom_tip),

]
