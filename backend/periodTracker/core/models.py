from django.db import models
from django.contrib.auth.models import User


class PeriodLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="period_logs")
    start_date = models.DateField()
    end_date = models.DateField()
    cycle_length = models.IntegerField(null=True, blank=True)        # days
    flow_level = models.CharField(max_length=20, blank=True)         # light/medium/heavy
    mood = models.CharField(max_length=50, blank=True)
    symptoms = models.TextField(blank=True)                          # comma separated, or text
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.start_date} to {self.end_date}"
