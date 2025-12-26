from rest_framework import serializers
from .models import PeriodLog

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
