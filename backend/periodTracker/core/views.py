import os
from datetime import date
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from openai import OpenAI
from .models import PeriodLog, UserProfile, ChatMessage
from .serializers import PeriodLogSerializer, UserProfileSerializer
from datetime import timedelta
from collections import Counter
from .models import MoodLog
from .serializers import MoodLogSerializer
from .models import SymptomLog
from .serializers import SymptomLogSerializer

import math



# -------------------- OpenAI Helper --------------------
def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


# -------------------- Period Context Helpers --------------------
def _parse_ymd(s: str):
    y, m, d = [int(x) for x in s.split("-")]
    return date(y, m, d)


def _days_between(a: date, b: date) -> int:
    return (b - a).days


def _safe_avg(nums):
    if not nums:
        return None
    return round(sum(nums) / len(nums), 1)


def build_user_context(user):
    logs = PeriodLog.objects.filter(user=user).order_by("-start_date")[:10]
    logs = list(logs)

    if not logs:
        return "No period logs yet."

    logs_sorted = sorted(logs, key=lambda x: x.start_date)

    period_lengths = []
    for l in logs_sorted:
        if l.start_date and l.end_date:
            s = _parse_ymd(str(l.start_date))
            e = _parse_ymd(str(l.end_date))
            period_lengths.append(_days_between(s, e) + 1)

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
    recent_summary = "; ".join(recent_text) if recent_text else "No recent mood/symptom notes."

    return (
        f"User tracking summary:\n"
        f"- Average cycle length: {avg_cycle if avg_cycle is not None else 'unknown'} days\n"
        f"- Average period length: {avg_period if avg_period is not None else 'unknown'} days\n"
        f"- Last period: {last_start} to {last_end}\n"
        f"- Recent notes: {recent_summary}\n"
        f"Use this info to personalize answers."
    )


# -------------------- Auth --------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")

    if not username or not email or not password:
        return Response({"error": "username, email and password are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

    User.objects.create_user(username=username, email=email, password=password)
    return Response({"message": "User registered successfully"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response({"error": "username and password are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=username, password=password)
    if user is None:
        return Response({"error": "Invalid username or password"}, status=status.HTTP_400_BAD_REQUEST)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username}, status=status.HTTP_200_OK)


# -------------------- Profile --------------------
@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    prof, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(UserProfileSerializer(prof).data, status=200)

    ser = UserProfileSerializer(prof, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=200)

    return Response(ser.errors, status=400)


# -------------------- Period Logs --------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def period_logs(request):
    if request.method == "GET":
        logs = PeriodLog.objects.filter(user=request.user).order_by("-start_date")
        serializer = PeriodLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    serializer = PeriodLogSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_period_log(request, pk):
    try:
        log = PeriodLog.objects.get(pk=pk, user=request.user)
    except PeriodLog.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    log.delete()
    return Response({"message": "Deleted"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def chat_history(request):
    limit = int(request.GET.get("limit", 30))
    msgs = ChatMessage.objects.filter(user=request.user).order_by("-created_at")[:limit]
    msgs = list(reversed(msgs))  # return oldest -> newest

    data = [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]
    return Response(data, status=200)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_clear(request):
    ChatMessage.objects.filter(user=request.user).delete()
    return Response({"message": "Chat cleared"}, status=200)

# -------------------- Chatbot (SAVE + FALLBACK) --------------------
def fallback_reply(prompt: str, tone: str = "friendly") -> str:
    base = {
        "gentle": "I’m here with you 💛 ",
        "friendly": "Got you 🙂 ",
        "direct": "Okay. ",
    }.get(tone, "Got you 🙂 ")

    tips = (
        "For period cramps, quick options: warm heat pad, gentle stretching, hydration, "
        "and rest. Some people find OTC pain relief helpful (only if safe for you). "
        "If pain is severe, sudden, or unusual, or you have heavy bleeding/fainting/fever, please see a clinician."
    )
    if len(prompt.strip()) <= 3:
        return base + "Hi! Tell me what you’re feeling and I’ll help. " + tips
    return base + tips


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chatbot(request):
    prompt = request.data.get("prompt", "").strip()
    if not prompt:
        return Response({"error": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Save USER message first
    ChatMessage.objects.create(user=request.user, role="user", content=prompt)

    # Load tone from profile
    prof, _ = UserProfile.objects.get_or_create(user=request.user)
    tone = prof.tone

    client = get_openai_client()
    if client is None:
        reply = fallback_reply(prompt, tone=tone)
        ChatMessage.objects.create(user=request.user, role="assistant", content=reply)
        return Response({"reply": reply, "source": "fallback"}, status=200)

    user_context = build_user_context(request.user)

    system_msg = (
        "You are a helpful Period Tracker assistant.\n"
        "Rules:\n"
        "- Be supportive and medically cautious.\n"
        "- You are not a doctor.\n"
        "- If the user has severe pain, heavy bleeding, fainting, fever, pregnancy concern, "
        "or urgent symptoms, advise seeking a clinician.\n"
        "- Personalize using user tracking summary.\n"
        "- Keep answers clear and practical.\n"
    )

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "system", "content": f"Tone preference: {tone}"},
                {"role": "system", "content": user_context},
                {"role": "user", "content": prompt},
            ],
        )

        reply = resp.choices[0].message.content.strip()
        if not reply:
            reply = fallback_reply(prompt, tone=tone)

        # Save ASSISTANT message
        ChatMessage.objects.create(user=request.user, role="assistant", content=reply)

        return Response({"reply": reply, "source": "openai"}, status=200)

    except Exception:
        # If OpenAI fails (quota/network/key), we fallback but STILL SAVE
        reply = fallback_reply(prompt, tone=tone)
        ChatMessage.objects.create(user=request.user, role="assistant", content=reply)
        return Response(
            {"reply": reply, "source": "fallback"},
            status=200
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def insights(request):
    logs = list(PeriodLog.objects.filter(user=request.user).order_by("start_date"))

    if len(logs) < 2:
        return Response({"error": "Add at least 2 logs to generate insights."}, status=400)

    # --- cycle lengths ---
    cycle_lengths = []
    for i in range(len(logs) - 1):
        cycle_lengths.append((logs[i+1].start_date - logs[i].start_date).days)

    avg_cycle = sum(cycle_lengths) / len(cycle_lengths)

    # Std deviation -> confidence
    if len(cycle_lengths) >= 2:
        variance = sum((x - avg_cycle) ** 2 for x in cycle_lengths) / (len(cycle_lengths) - 1)
        std = math.sqrt(variance)
    else:
        std = 0

    # Confidence mapping (lower std => higher confidence)
    if std <= 1:
        confidence = "Very High"
    elif std <= 3:
        confidence = "High"
    elif std <= 6:
        confidence = "Medium"
    else:
        confidence = "Low"

    # --- period lengths ---
    period_lengths = []
    for l in logs:
        if l.end_date:
            period_lengths.append((l.end_date - l.start_date).days + 1)

    avg_period = sum(period_lengths) / len(period_lengths) if period_lengths else 5

    last_start = logs[-1].start_date
    next_period = last_start + timedelta(days=round(avg_cycle))

    # ovulation estimate
    ovulation = next_period - timedelta(days=14)

    fertile_start = ovulation - timedelta(days=5)
    fertile_end = ovulation + timedelta(days=1)

    # Mood & symptoms (top from recent 10 logs)
    moods = [l.mood.strip().lower() for l in logs[-10:] if l.mood.strip()]
    symptoms = []
    for l in logs[-10:]:
        if l.symptoms.strip():
            symptoms += [s.strip().lower() for s in l.symptoms.split(",") if s.strip()]

    top_moods = [m for m, _ in Counter(moods).most_common(3)]
    top_symptoms = [s for s, _ in Counter(symptoms).most_common(5)]

    # Phase description
    today = date.today()
    days_until_period = (next_period - today).days

    if days_until_period < 0:
        phase = "Late cycle / period might be due"
    elif days_until_period <= 5:
        phase = "PMS phase likely"
    elif fertile_start <= today <= fertile_end:
        phase = "Fertile window"
    else:
        phase = "Normal cycle phase"

    return Response({
        "avg_cycle": round(avg_cycle, 1),
        "avg_period": round(avg_period, 1),
        "std_cycle": round(std, 1),
        "confidence": confidence,

        "next_period": str(next_period),
        "days_until_period": days_until_period,

        "ovulation": str(ovulation),
        "fertile_window": {
            "start": str(fertile_start),
            "end": str(fertile_end)
        },

        "phase": phase,
        "predicted_moods": top_moods,
        "predicted_symptoms": top_symptoms,
    })
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mood_logs(request):
    """
    GET  -> list current user's mood logs
    POST -> create a mood log (one per day due to unique_together)
    """
    if request.method == "GET":
        logs = MoodLog.objects.filter(user=request.user).order_by("-date")
        return Response(MoodLogSerializer(logs, many=True).data, status=200)

    # POST
    ser = MoodLogSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=400)

    # Save with user
    try:
        mood_obj = MoodLog.objects.create(
            user=request.user,
            date=ser.validated_data["date"],
            mood=ser.validated_data["mood"],
            intensity=ser.validated_data.get("intensity", 5),
            note=ser.validated_data.get("note", ""),
        )
        return Response(MoodLogSerializer(mood_obj).data, status=201)
    except Exception:
        # likely unique_together conflict
        return Response(
            {"error": "Mood for this date already exists. Edit or delete it."},
            status=400
        )


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def mood_log_detail(request, pk):
    try:
        log = MoodLog.objects.get(pk=pk, user=request.user)
    except MoodLog.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    if request.method == "DELETE":
        log.delete()
        return Response({"message": "Deleted"}, status=200)

    # PUT
    ser = MoodLogSerializer(log, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=200)
    return Response(ser.errors, status=400)
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def symptom_logs(request):
    if request.method == "GET":
        logs = SymptomLog.objects.filter(user=request.user).order_by("-date")
        return Response(SymptomLogSerializer(logs, many=True).data, status=200)

    ser = SymptomLogSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=400)

    try:
        obj = SymptomLog.objects.create(
            user=request.user,
            date=ser.validated_data["date"],
            symptoms=ser.validated_data.get("symptoms", []),
            severity=ser.validated_data.get("severity", 5),
            note=ser.validated_data.get("note", "")
        )
        return Response(SymptomLogSerializer(obj).data, status=201)

    except Exception:
        return Response({"error": "Symptoms for this date already exist."}, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_symptom_log(request, pk):
    try:
        log = SymptomLog.objects.get(pk=pk, user=request.user)
    except SymptomLog.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    log.delete()
    return Response({"message": "Deleted"}, status=200)
