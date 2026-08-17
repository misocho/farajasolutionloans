"""
Timezone helpers — the system operates on Kenya time (Africa/Nairobi).
All "today" boundaries must use Nairobi's date, not UTC.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import overload
from zoneinfo import ZoneInfo

from app.core.config import settings

_NAIROBI = ZoneInfo(settings.DEFAULT_TIMEZONE)


def today_nairobi() -> date:
    """Current calendar date in Africa/Nairobi (the business timezone)."""
    return datetime.now(_NAIROBI).date()


@overload
def as_nairobi_date(dt: datetime) -> date: ...
@overload
def as_nairobi_date(dt: None) -> None: ...


def as_nairobi_date(dt: datetime | None) -> date | None:
    """Calendar date in Africa/Nairobi for a stored datetime.

    Stored timestamps are UTC instants; naive datetimes are treated as UTC,
    matching how the app writes them.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(_NAIROBI).date()


def utc_instant(d: date) -> datetime:
    """Instant at Nairobi midnight of the given calendar date, expressed in UTC.

    Use for DB window comparisons against stored UTC timestamps so that
    "today", "tomorrow", etc. mean Nairobi days, not UTC days.
    """
    return datetime.combine(d, time.min, tzinfo=_NAIROBI).astimezone(ZoneInfo("UTC"))
