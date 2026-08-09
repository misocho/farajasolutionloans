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