from django.db import models
from django.contrib.auth.models import User
class UserProfile(models.Model):
    TONE_CHOICES = [
        ("gentle", "Gentle"),
        ("friendly", "Friendly"),
        ("direct", "Direct"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    tone = models.CharField(max_length=20, choices=TONE_CHOICES, default="friendly")
    nickname = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} profile"

class PeriodLog(models.Model):
    FLOW_CHOICES = [
        ("light", "Light"),
        ("medium", "Medium"),
        ("heavy", "Heavy"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="period_logs")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    cycle_length = models.IntegerField(null=True, blank=True)
    flow_level = models.CharField(max_length=10, choices=FLOW_CHOICES, blank=True, default="")

    mood = models.CharField(max_length=100, blank=True, default="")
    symptoms = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} | {self.start_date} → {self.end_date or '-'}"
class ChatMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_messages")
    role = models.CharField(max_length=10)  # "user" or "assistant"
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user.username} ({self.role}) {self.created_at}"    
    
