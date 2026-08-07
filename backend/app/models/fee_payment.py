from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import FeeType, PaymentMode


class FeePayment(BaseModel):
    __tablename__ = "fee_payments"
    __table_args__ = (UniqueConstraint("reference", name="uq_fee_payments_reference"),)

    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    loan_id: Mapped[UUID | None] = mapped_column(ForeignKey("loans.id", ondelete="SET NULL"), nullable=True, index=True)

    fee_type: Mapped[FeeType] = mapped_column(Enum(FeeType), nullable=False, default=FeeType.APPLICATION)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    mode: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), nullable=False, default=PaymentMode.CASH)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recorded_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship("Client", foreign_keys=[client_id], lazy="joined")  # type: ignore
    loan: Mapped["Loan | None"] = relationship("Loan", foreign_keys=[loan_id], lazy="joined")  # type: ignore
    recorded_by: Mapped["User | None"] = relationship("User", foreign_keys=[recorded_by_id], lazy="joined")  # type: ignore
    verified_by: Mapped["User | None"] = relationship("User", foreign_keys=[verified_by_id], lazy="joined")  # type: ignore

    def __repr__(self) -> str:
        return f"<FeePayment(client={self.client_id}, amount={self.amount}, verified={self.verified})>"
