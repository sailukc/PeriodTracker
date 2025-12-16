from rest_framework import serializers
from .models import PeriodLog


class PeriodLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodLog
        fields = [
            'id',
            'start_date',
            'end_date',
            'cycle_length',
            'flow_level',
            'mood',
            'symptoms',
            'notes',
            'created_at',
        ]
