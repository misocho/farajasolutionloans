from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ExpenseCategory, PaymentMode

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.user import User


class Expense(BaseModel):
    __tablename__ = "expenses"

    branch_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[ExpenseCategory] = mapped_column(
        Enum(ExpenseCategory), nullable=False, default=ExpenseCategory.OPERATIONS
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    mode: Mapped[PaymentMode] = mapped_column(
        Enum(PaymentMode), nullable=False, default=PaymentMode.CASH
    )
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    recorded_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Relationships
    branch: Mapped[Branch | None] = relationship("Branch", lazy="joined")
    recorded_by: Mapped[User | None] = relationship(
        "User", foreign_keys=[recorded_by_id], lazy="joined"
    )
    verified_by: Mapped[User | None] = relationship(
        "User", foreign_keys=[verified_by_id], lazy="joined"
    )

    def __repr__(self) -> str:
        return (
            f"<Expense(category={self.category}, amount={self.amount}, verified={self.verified})>"
        )
