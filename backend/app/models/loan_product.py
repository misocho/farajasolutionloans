from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, Enum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import LoanProductType


class LoanProduct(BaseModel):
    __tablename__ = "loan_products"

    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    product_type: Mapped[LoanProductType] = mapped_column(Enum(LoanProductType), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)  # 28, 35, or agreed term
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)  # 0.2000, 0.3000
    penalty_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0.0300"))
    penalty_interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    max_penalty_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<LoanProduct(name='{self.name}', rate={self.interest_rate})>"
