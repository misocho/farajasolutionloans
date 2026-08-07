"""
Timezone helpers — the system operates on Kenya time (Africa/Nairobi).
All "today" boundaries must use Nairobi's date, not UTC.
"""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def today_nairobi() -> date:
    """Current calendar date in Africa/Nairobi (the business timezone)."""
    return datetime.now(ZoneInfo(settings.DEFAULT_TIMEZONE)).date()
