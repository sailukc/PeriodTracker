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
def ai_insights(request):
    user = request.user
    logs = PeriodLog.objects.filter(user=user).order_by("start_date")

    if logs.count() < 2:
        return Response({
            "error": "Add at least 2 period logs to generate insights."
        }, status=400)

    # --- Calculate cycle lengths ---
    start_dates = [l.start_date for l in logs if l.start_date]
    cycle_lengths = []
    for i in range(len(start_dates) - 1):
        cycle_lengths.append((start_dates[i+1] - start_dates[i]).days)

    avg_cycle = round(sum(cycle_lengths) / len(cycle_lengths), 1)

    # --- Period lengths ---
    period_lengths = []
    for l in logs:
        if l.end_date:
            period_lengths.append((l.end_date - l.start_date).days + 1)
    avg_period = round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else None

    # --- Next period prediction ---
    last_start = logs.last().start_date
    predicted_next = last_start + timedelta(days=round(avg_cycle))

    # --- Fertility window (simple estimation) ---
    # ovulation ~ 14 days before next period
    ovulation = predicted_next - timedelta(days=14)
    fertile_start = ovulation - timedelta(days=5)
    fertile_end = ovulation + timedelta(days=1)

    # --- Mood & symptom trends ---
    moods = []
    symptoms = []
    for l in logs.order_by("-start_date")[:10]:
        if l.mood:
            moods.append(l.mood.strip().lower())
        if l.symptoms:
            symptoms += [s.strip().lower() for s in l.symptoms.split(",") if s.strip()]

    top_moods = [m for m, _ in Counter(moods).most_common(3)]
    top_symptoms = [s for s, _ in Counter(symptoms).most_common(5)]

    # --- Safety warnings (basic) ---
    warnings = []
    if avg_cycle < 21 or avg_cycle > 35:
        warnings.append("Your cycle length looks outside the typical 21–35 day range. If this continues, consider talking to a clinician.")
    if avg_period and avg_period > 8:
        warnings.append("Your period length seems longer than 7–8 days. If heavy or persistent, consider medical advice.")

    # --- Optional OpenAI-generated insight summary ---
    prof, _ = UserProfile.objects.get_or_create(user=user)
    tone = prof.tone

    ai_text = None
    client = get_openai_client()

    if client:
        try:
            prompt = f"""
Generate short personalized period tracking insights in a {tone} tone.

Stats:
- Average cycle: {avg_cycle} days
- Average period: {avg_period} days
- Next period: {predicted_next}
- Ovulation estimate: {ovulation}
- Fertile window: {fertile_start} to {fertile_end}
- Top moods: {top_moods}
- Top symptoms: {top_symptoms}

Write 4-6 bullet points. Be medically cautious.
"""
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a period tracker assistant. Be supportive and medically cautious."},
                    {"role": "user", "content": prompt},
                ],
            )
            ai_text = resp.choices[0].message.content.strip()
        except Exception:
            ai_text = None

    if not ai_text:
        # fallback insight
        ai_text = (
            f"- Avg cycle: {avg_cycle} days\n"
            f"- Next period: {predicted_next}\n"
            f"- Fertile window: {fertile_start} to {fertile_end}\n"
            f"- Most common symptoms: {', '.join(top_symptoms) if top_symptoms else 'none'}\n"
            f"- Most common moods: {', '.join(top_moods) if top_moods else 'none'}\n"
        )

    return Response({
        "avg_cycle": avg_cycle,
        "avg_period": avg_period,
        "predicted_next_period": str(predicted_next),
        "ovulation_estimate": str(ovulation),
        "fertile_window": {
            "start": str(fertile_start),
            "end": str(fertile_end),
        },
        "top_moods": top_moods,
        "top_symptoms": top_symptoms,
        "warnings": warnings,
        "ai_summary": ai_text,
    })

