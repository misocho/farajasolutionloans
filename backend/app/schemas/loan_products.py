from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import LoanProductType

# ── Loan Product Responses ───────────────────────────────────────────────

class LoanProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    product_type: LoanProductType
    duration_days: int
    interest_rate: float
    penalty_rate: float
    penalty_interval_days: int
    max_penalty_amount: float | None = None
    is_active: bool


# ── Loan Product Creation ────────────────────────────────────────────────

class LoanProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    product_type: LoanProductType
    duration_days: int = Field(ge=1)
    interest_rate: Decimal = Field(ge=0, le=1, description="Decimal rate, e.g. 0.20 = 20%")
    penalty_rate: Decimal = Field(default=Decimal("0.03"), ge=0, le=1)
    penalty_interval_days: int = Field(default=2, ge=1)
    max_penalty_amount: Decimal | None = Field(default=None, ge=0)
    is_active: bool = True


# ── Loan Product Quotations ───────────────────────────────────────────────

class LoanQuoteResponse(BaseModel):
    interest_amount: Decimal
    total_repayable: Decimal
    num_installments: int
    installment_amount: Decimal
    application_fee_new: Decimal
    application_fee_existing: Decimal


# ── Loan Product Updates ─────────────────────────────────────────────────

class LoanProductUpdate(BaseModel):
    penalty_rate: Decimal | None = Field(
        default=None, ge=0, le=1, description="Decimal rate, e.g. 0.03 = 3%"
    )
    penalty_interval_days: int | None = Field(
        default=None, ge=1, description="Days between penalty assessments"
    )
    max_penalty_amount: Decimal | None = Field(
        default=None, ge=0, description="Null = no cap"
    )
    is_active: bool | None = None