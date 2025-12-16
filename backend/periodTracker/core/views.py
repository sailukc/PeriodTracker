from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import PeriodLog
from .serializers import PeriodLogSerializer

@api_view(['POST'])
def register_user(request):
    try:
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=400)

        user = User.objects.create_user(username=username, email=email, password=password)
        return Response({"message": "User registered successfully"})
    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(['POST'])
def login_user(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)

    if user is None:
        return Response({"error": "Invalid username or password"}, status=400)

    token, created = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username})
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def period_logs(request):
    if request.method == "GET":
        logs = PeriodLog.objects.filter(user=request.user).order_by("-start_date")
        serializer = PeriodLogSerializer(logs, many=True)
        return Response(serializer.data)

    if request.method == "POST":
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
        log.delete()
        return Response({"message": "Deleted"}, status=status.HTTP_200_OK)
    except PeriodLog.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

