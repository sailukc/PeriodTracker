from rest_framework import serializers
from .models import PeriodLog, UserProfile, ChatMessage, MoodLog, SymptomLog

class PeriodLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodLog
        fields = [
            "id",
            "start_date",
            "end_date",
            "cycle_length",
            "flow_level",
            "mood",
            "symptoms",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        return attrs
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("tone", "nickname")
class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "created_at"]      
class MoodLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodLog
        fields = ["id", "date", "mood", "intensity", "note", "created_at"]  
class SymptomLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SymptomLog
        fields = ["id", "date", "symptoms", "severity", "note", "created_at"]
