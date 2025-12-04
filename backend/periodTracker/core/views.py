from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

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
