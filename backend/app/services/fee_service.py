"""
Fee service — application fee quoting, recording, and verification.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.enums import FeeType, LoanStatus
from app.models.fee_payment import FeePayment
from app.models.loan import Loan
from app.services.loan_service import calculate_application_fee

MIN_LOAN_AMOUNT = Decimal("4000")


def has_loan_history(db: Session, client_id: object) -> bool:
    """True if the client has at least one disbursed or closed loan."""
    return (
        db.scalar(
            select(Loan.id)
            .where(
                Loan.client_id == client_id,
                Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]),
            )
            .limit(1)
        )
        is not None
    )


def quote_application_fee(db: Session, client_id: object, amount: Decimal) -> dict:
    """Compute the application fee for a loan application."""
    client = db.get(Client, client_id)
    if not client:
        raise ValueError("Client not found")
    is_existing = has_loan_history(db, client_id)
    fee = calculate_application_fee(amount, is_existing)
    return {
        "amount": float(fee),
        "tier": "existing" if is_existing else "new",
        "is_existing_client": is_existing,
        "minimum_amount": float(MIN_LOAN_AMOUNT),
    }


def get_verified_fee(
    db: Session, client_id: object, expected_amount: Decimal
) -> FeePayment:
    """Latest verified, unlinked application fee for a client matching the expected amount."""
    return db.scalar(
        select(FeePayment)
        .where(
            FeePayment.client_id == client_id,
            FeePayment.fee_type == FeeType.APPLICATION,
            FeePayment.verified.is_(True),
            FeePayment.loan_id.is_(None),
            FeePayment.amount == expected_amount,
        )
        .order_by(FeePayment.verified_at.desc())
        .limit(1)
    )
