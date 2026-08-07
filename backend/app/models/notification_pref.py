"""Persisted per-user notification preferences."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

DEFAULT_PREFS: dict[str, bool] = {
    "due_today": True,
    "due_tomorrow": True,
    "almost_due": True,
    "arrears": True,
    "repayment_pending": True,
    "pending_approval": True,
}


class NotificationPref(Base):
    __tablename__ = "notification_prefs"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    prefs: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: dict(DEFAULT_PREFS),
        nullable=False,
    )
