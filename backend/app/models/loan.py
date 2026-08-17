from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import LoanStatus


class Loan(BaseModel):
    __tablename__ = "loans"

    # Auto-generated loan number e.g. LN-2026-001
    loan_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)

    # ── References ────────────────────────────────────────────────────────────
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[UUID | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    loan_product_id: Mapped[UUID | None] = mapped_column(ForeignKey("loan_products.id", ondelete="SET NULL"), nullable=True)

    # ── Financials ────────────────────────────────────────────────────────────
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    interest_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    total_repayable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    application_fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    installment_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    # ── Loan meta ─────────────────────────────────────────────────────────────
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus), nullable=False, default=LoanStatus.PENDING)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Manual status override (Manager/Director): a computed status (e.g. "Defaulter")
    # that takes precedence over the read-time computed status for disbursed loans.
    status_override: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status_override_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status_override_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # ── Officers ──────────────────────────────────────────────────────────────
    submitted_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    disbursed_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # ── Dates ─────────────────────────────────────────────────────────────────
    date_submitted: Mapped[datetime | None] = mapped_column(nullable=True)
    date_approved: Mapped[datetime | None] = mapped_column(nullable=True)
    disbursed_date: Mapped[datetime | None] = mapped_column(nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    client: Mapped["Client"] = relationship("Client", back_populates="loans", lazy="joined")  # type: ignore
    branch: Mapped["Branch | None"] = relationship("Branch", foreign_keys=[branch_id], lazy="joined")  # type: ignore
    loan_product: Mapped["LoanProduct | None"] = relationship("LoanProduct", foreign_keys=[loan_product_id], lazy="joined")  # type: ignore
    submitted_by: Mapped["User | None"] = relationship("User", foreign_keys=[submitted_by_id], lazy="joined")  # type: ignore
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id], lazy="joined")  # type: ignore
    disbursed_by: Mapped["User | None"] = relationship("User", foreign_keys=[disbursed_by_id], lazy="joined")  # type: ignore
    status_override_by: Mapped["User | None"] = relationship("User", foreign_keys=[status_override_by_id], lazy="joined")  # type: ignore
    installments: Mapped[list["Installment"]] = relationship("Installment", back_populates="loan", cascade="all, delete-orphan", lazy="select")
    repayments: Mapped[list["Repayment"]] = relationship("Repayment", back_populates="loan", cascade="all, delete-orphan", lazy="select")

    def __repr__(self) -> str:
        return f"<Loan(number='{self.loan_number}', status='{self.status}', amount={self.amount})>"
