"""Daily penalty snapshot (D2) — read-time penalty persisted per loan per day."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class PenaltySnapshot(BaseModel):
    __tablename__ = "penalty_snapshots"
    __table_args__ = (
        UniqueConstraint("loan_id", "snapshot_date", name="uq_penalty_snapshot_loan_date"),
    )

    loan_id: Mapped[UUID] = mapped_column(
        ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    outstanding: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    penalty: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    days_overdue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)