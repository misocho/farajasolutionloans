from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import InstallmentStatus


class Installment(BaseModel):
    __tablename__ = "installments"

    loan_id: Mapped[UUID] = mapped_column(ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True)
    due_date: Mapped[datetime] = mapped_column(nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[InstallmentStatus] = mapped_column(
        Enum(InstallmentStatus), nullable=False, default=InstallmentStatus.PENDING
    )
    paid_at: Mapped[datetime | None] = mapped_column(nullable=True)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="installments")  # type: ignore

    def __repr__(self) -> str:
        return f"<Installment(loan={self.loan_id}, due={self.due_date}, status='{self.status}')>"
