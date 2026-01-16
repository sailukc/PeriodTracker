# core/views.py  ✅ Clean + complete Gemini version

import os
from datetime import date

from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

# ✅ Gemini SDK
from google import genai

from .models import PeriodLog, UserProfile, ChatMessage, MoodLog, SymptomLog
from .serializers import (
    PeriodLogSerializer,
    UserProfileSerializer,
    MoodLogSerializer,
    SymptomLogSerializer,
)

# ---------------------------
# Gemini helpers
# ---------------------------

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _get_gemini_client():
    """
    Reads GEMINI_API_KEY from environment variables.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def gemini_text(system_text: str, user_text: str, model: str = GEMINI_MODEL):
    """
    Returns (text, error_string_or_None)
    """
    client = _get_gemini_client()
    if client is None:
        return None, "GEMINI_API_KEY is not set on the server."

    prompt = f"{system_text}\n\nUSER:\n{user_text}"

    try:
        resp = client.models.generate_content(model=model, contents=prompt)
        text = (getattr(resp, "text", "") or "").strip()
        return text, None
    except Exception as e:
        return None, str(e)


# ---------------------------
# Personalization helpers
# ---------------------------

def _parse_ymd(s: str) -> date:
    y, m, d = [int(x) for x in s.split("-")]
    return date(y, m, d)


def _days_between(a: date, b: date) -> int:
    return (b - a).days


def _safe_avg(nums):
    if not nums:
        return None
    return round(sum(nums) / len(nums), 1)


def build_user_context(user) -> str:
    """
    Small, safe summary from recent logs + profile settings.
    Used ONLY for personalization (not diagnosis).
    """
    logs = list(PeriodLog.objects.filter(user=user).order_by("-start_date")[:10])

    prof = getattr(user, "profile", None)
    nickname = prof.nickname if prof and prof.nickname else user.username
    tone = prof.tone if prof else "friendly"

    if not logs:
        return (
            f"User nickname: {nickname}\n"
            f"Preferred tone: {tone}\n"
            f"No period logs yet.\n"
        )

    logs_sorted = sorted(logs, key=lambda x: x.start_date)

    # Period length: end - start + 1 (when end exists)
    period_lengths = []
    for l in logs_sorted:
        if l.start_date and l.end_date:
            s = _parse_ymd(str(l.start_date))
            e = _parse_ymd(str(l.end_date))
            period_lengths.append(_days_between(s, e) + 1)

    # Cycle length: next_start - current_start
    cycle_lengths = []
    for i in range(len(logs_sorted) - 1):
        s1 = _parse_ymd(str(logs_sorted[i].start_date))
        s2 = _parse_ymd(str(logs_sorted[i + 1].start_date))
        cycle_lengths.append(_days_between(s1, s2))

    avg_cycle = _safe_avg(cycle_lengths)
    avg_period = _safe_avg(period_lengths)

    last = logs_sorted[-1]
    last_start = str(last.start_date) if last.start_date else "unknown"
    last_end = str(last.end_date) if last.end_date else "unknown"

    recent_text = []
    for l in logs[:5]:
        if l.mood:
            recent_text.append(f"mood: {l.mood}")
        if l.symptoms:
            recent_text.append(f"symptoms: {l.symptoms}")
    recent_summary = "; ".join(recent_text) if recent_text else "No recent notes."

    return (
        f"User nickname: {nickname}\n"
        f"Preferred tone: {tone}\n"
        f"Average cycle length: {avg_cycle if avg_cycle is not None else 'unknown'} days\n"
        f"Average period length: {avg_period if avg_period is not None else 'unknown'} days\n"
        f"Last period: {last_start} to {last_end}\n"
        f"Recent notes: {recent_summary}\n"
    )


# ---------------------------
# AUTH
# ---------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    username = (request.data.get("username") or "").strip()
    email = (request.data.get("email") or "").strip()
    password = request.data.get("password") or ""

    if not username or not email or not password:
        return Response(
            {"error": "username, email and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

    User.objects.create_user(username=username, email=email, password=password)
    return Response({"message": "User registered successfully"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    if not username or not password:
        return Response(
            {"error": "username and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)
    if user is None:
        return Response({"error": "Invalid username or password"}, status=status.HTTP_400_BAD_REQUEST)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username}, status=status.HTTP_200_OK)


# ---------------------------
# PROFILE
# ---------------------------

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    prof, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(UserProfileSerializer(prof).data, status=status.HTTP_200_OK)

    ser = UserProfileSerializer(prof, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=status.HTTP_200_OK)

    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------
# PERIOD LOGS
# ---------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def period_logs(request):
    if request.method == "GET":
        logs = PeriodLog.objects.filter(user=request.user).order_by("-start_date")
        return Response(PeriodLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)

    ser = PeriodLogSerializer(data=request.data)
    if ser.is_valid():
        ser.save(user=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_period_log(request, pk):
    try:
        log = PeriodLog.objects.get(pk=pk, user=request.user)
    except PeriodLog.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    log.delete()
    return Response({"message": "Deleted"}, status=status.HTTP_200_OK)


# ---------------------------
# CHAT: history / clear / chatbot
# ---------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def chat_history(request):
    msgs = ChatMessage.objects.filter(user=request.user).order_by("created_at")[:200]
    data = [
        {"role": m.role, "content": m.content, "created_at": m.created_at}
        for m in msgs
    ]
    return Response(data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def chat_clear(request):
    ChatMessage.objects.filter(user=request.user).delete()
    return Response({"message": "Chat cleared"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chatbot(request):
    prompt = (request.data.get("prompt") or "").strip()
    if not prompt:
        return Response({"error": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Save user message
    ChatMessage.objects.create(user=request.user, role="user", content=prompt)

    user_context = build_user_context(request.user)

    system_msg = (
        "You are a helpful Period Tracker assistant.\n"
        "Rules:\n"
        "- Be supportive and medically cautious.\n"
        "- You are not a doctor.\n"
        "- If severe pain, heavy bleeding, fainting, fever, pregnancy concern, "
        "or urgent symptoms: advise seeking a clinician.\n"
        "- Personalize using the user context.\n"
        "- Keep answers clear, short, and practical.\n"
    )

    user_text = f"USER CONTEXT:\n{user_context}\n\nUSER QUESTION:\n{prompt}"

    reply, err = gemini_text(system_msg, user_text)
    if err:
        ChatMessage.objects.create(user=request.user, role="assistant", content=f"[AI error] {err}")
        return Response({"error": f"AI error: {err}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not reply:
        reply = "Sorry, I couldn’t generate a reply right now."

    ChatMessage.objects.create(user=request.user, role="assistant", content=reply)
    return Response({"reply": reply}, status=status.HTTP_200_OK)


# ---------------------------
# AI: Insights / Mood Tip / Symptom Tip
# ---------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_insights(request):
    user_context = build_user_context(request.user)

    system_msg = (
        "You are a period-tracking insights assistant.\n"
        "Rules:\n"
        "- Use ONLY the given tracking data.\n"
        "- Give 3–6 bullet insights.\n"
        "- No diagnosis.\n"
        "- Add 1 safety note if symptoms are severe or unusual.\n"
        "- Friendly tone.\n"
    )

    prompt = f"Generate helpful cycle insights based on:\n{user_context}"

    reply, err = gemini_text(system_msg, prompt)
    if err:
        return Response({"error": err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"text": reply}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_mood_tip(request):
    mood = (request.data.get("mood") or "").strip()
    intensity = request.data.get("intensity", 5)

    if not mood:
        return Response({"error": "mood is required"}, status=status.HTTP_400_BAD_REQUEST)

    system_msg = (
        "You are a supportive mood assistant for menstrual health.\n"
        "Rules:\n"
        "- Validate feelings.\n"
        "- Give gentle coping tips.\n"
        "- No diagnosis.\n"
        "- Encourage rest and self-care.\n"
        "- If the user mentions self-harm or feeling unsafe, suggest professional help.\n"
    )

    prompt = f"The user feels '{mood}' with intensity {intensity}. Give gentle advice."

    reply, err = gemini_text(system_msg, prompt)
    if err:
        return Response({"error": err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"text": reply}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_symptom_tip(request):
    symptoms = request.data.get("symptoms", [])
    if not isinstance(symptoms, list):
        return Response({"error": "symptoms must be a list"}, status=status.HTTP_400_BAD_REQUEST)

    symptoms = [str(s).strip() for s in symptoms if str(s).strip()]
    if not symptoms:
        return Response({"error": "symptoms required"}, status=status.HTTP_400_BAD_REQUEST)

    system_msg = (
        "You are a menstrual symptom assistant.\n"
        "Rules:\n"
        "- Give general relief tips.\n"
        "- No diagnosis.\n"
        "- If severe symptoms are mentioned, advise seeing a clinician.\n"
        "- Keep it short and practical.\n"
    )

    prompt = f"User has symptoms: {', '.join(symptoms)}. Give general guidance."

    reply, err = gemini_text(system_msg, prompt)
    if err:
        return Response({"error": err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"text": reply}, status=status.HTTP_200_OK)


# ---------------------------
# MOOD LOGS
# ---------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mood_logs(request):
    if request.method == "GET":
        logs = MoodLog.objects.filter(user=request.user).order_by("-date")
        return Response(MoodLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)

    ser = MoodLogSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        obj = MoodLog.objects.create(
            user=request.user,
            date=ser.validated_data["date"],
            mood=ser.validated_data["mood"],
            intensity=ser.validated_data.get("intensity", 5),
            note=ser.validated_data.get("note", ""),
        )
        return Response(MoodLogSerializer(obj).data, status=status.HTTP_201_CREATED)
    except Exception:
        return Response({"error": "Mood for this date already exists."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def mood_log_detail(request, pk):
    try:
        log = MoodLog.objects.get(pk=pk, user=request.user)
    except MoodLog.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        log.delete()
        return Response({"message": "Deleted"}, status=status.HTTP_200_OK)

    ser = MoodLogSerializer(log, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=status.HTTP_200_OK)

    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------
# SYMPTOM LOGS
# ---------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def symptom_logs(request):
    if request.method == "GET":
        logs = SymptomLog.objects.filter(user=request.user).order_by("-date")
        return Response(SymptomLogSerializer(logs, many=True).data, status=status.HTTP_200_OK)

    ser = SymptomLogSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        obj = SymptomLog.objects.create(
            user=request.user,
            date=ser.validated_data["date"],
            symptoms=ser.validated_data.get("symptoms", []),
            severity=ser.validated_data.get("severity", 5),
            note=ser.validated_data.get("note", ""),
        )
        return Response(SymptomLogSerializer(obj).data, status=status.HTTP_201_CREATED)
    except Exception:
        return Response({"error": "Symptoms for this date already exist."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_symptom_log(request, pk):
    try:
        log = SymptomLog.objects.get(pk=pk, user=request.user)
    except SymptomLog.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    log.delete()
    return Response({"message": "Deleted"}, status=status.HTTP_200_OK)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_symptom_tip(request):
    symptoms = request.data.get("symptoms", [])
    severity = request.data.get("severity", 5)

    if not symptoms or not isinstance(symptoms, list):
        return Response({"error": "symptoms must be a non-empty list"}, status=400)

    system_msg = (
        "You are a menstrual symptom relief assistant.\n"
        "Rules:\n"
        "- Give general relief tips (hydration, heat pad, rest, gentle stretching, OTC suggestions in general terms)\n"
        "- No diagnosis\n"
        "- If severity is high (8+), heavy bleeding, fainting, fever, pregnancy concern: advise seeing a doctor.\n"
        "- Keep answer short and practical (5-8 bullet points).\n"
    )

    prompt = (
        f"The user selected symptoms: {', '.join(symptoms)}.\n"
        f"Severity level: {severity}/10.\n"
        "Give general relief tips and one safety note."
    )

    reply, err = gemini_text(system_msg, prompt, model="gemini-2.5-flash")
    if err:
        return Response({"error": f"AI error: {err}"}, status=500)

    return Response({"text": reply}, status=200)
