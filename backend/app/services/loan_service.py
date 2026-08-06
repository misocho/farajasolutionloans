"""
Loan service — business logic for loan lifecycle, interest, installments, and penalties.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.enums import InstallmentStatus, LoanStatus
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.loan_product import LoanProduct
from app.models.repayment import Repayment


# ── Auto-number helpers ────────────────────────────────────────────────────────

def _next_client_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.scalar(select(func.count()).select_from(Client)) or 0
    return f"CL-{year}-{count + 1:03d}"


def _next_loan_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.scalar(select(func.count()).select_from(Loan)) or 0
    return f"LN-{year}-{count + 1:03d}"


# ── Interest & fee calculations ────────────────────────────────────────────────

def calculate_interest(product: LoanProduct, amount: Decimal) -> Decimal:
    """Flat interest on principal."""
    return (amount * product.interest_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_application_fee(amount: Decimal, is_existing_client: bool) -> Decimal:
    """Tiered application fee based on loan amount."""
    if Decimal("4000") <= amount <= Decimal("10000"):
        return Decimal("600") if is_existing_client else Decimal("800")
    elif amount > Decimal("10000"):
        return Decimal("1000") if is_existing_client else Decimal("1500")
    return Decimal("500")


def calculate_installment_amount(total_repayable: Decimal, num_weeks: int) -> Decimal:
    """Equal weekly installments."""
    return (total_repayable / num_weeks).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_penalty(
    outstanding: Decimal,
    due_date: datetime,
    penalty_rate: Decimal,
    interval_days: int,
) -> dict:
    """3% every 2 days on outstanding balance after due date."""
    today = datetime.now(timezone.utc).date()
    due = due_date.date() if due_date else None
    if not due or today <= due:
        return {"days_overdue": 0, "penalty": Decimal("0")}
    days_overdue = (today - due).days
    periods = days_overdue // interval_days
    penalty = (outstanding * penalty_rate * periods).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {"days_overdue": days_overdue, "penalty": penalty}


def get_computed_loan_status(loan: Loan, outstanding: Decimal) -> str:
    """
    Derive display status from DB status + dates + outstanding balance.
    Returns one of: Pending, Approved, Disbursed, Almost Due, Due, Arrears,
                    Missed Payment, Past Maturity, Defaulter, Closed, Rejected
    """
    if loan.status in (LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.REJECTED, LoanStatus.CLOSED):
        return loan.status.value

    if loan.status == LoanStatus.DISBURSED and loan.due_date:
        today = datetime.now(timezone.utc).date()
        due = loan.due_date.date()
        days_overdue = (today - due).days

        if outstanding <= 0:
            return "Paid"
        if days_overdue > 30:
            return "Defaulter"
        if days_overdue > 0:
            return "Past Maturity"
        if today == due:
            return "Due"
        if (due - today).days <= 2:
            return "Almost Due"
        # Check for partial payment (arrears)
        if outstanding < loan.total_repayable:
            return "Arrears"

    return loan.status.value


# ── Installment schedule ────────────────────────────────────────────────────────

def generate_installment_schedule(
    db: Session,
    loan: Loan,
    disbursed_date: datetime,
    num_weeks: int,
) -> list[Installment]:
    """Create equal weekly installments starting 1 week after disbursement."""
    installments = []
    for week in range(1, num_weeks + 1):
        inst = Installment(
            loan_id=loan.id,
            due_date=disbursed_date + timedelta(weeks=week),
            amount=loan.installment_amount,
            status=InstallmentStatus.PENDING,
        )
        db.add(inst)
        installments.append(inst)
    db.flush()
    return installments


# ── Loan lifecycle actions ──────────────────────────────────────────────────────

def approve_loan(db: Session, loan: Loan, approver_id: UUID, note: str | None = None) -> Loan:
    if loan.status != LoanStatus.PENDING:
        raise ValueError(f"Loan is not pending (status: {loan.status})")
    loan.status = LoanStatus.APPROVED
    loan.approved_by_id = approver_id
    loan.date_approved = datetime.now(timezone.utc)
    loan.approval_note = note
    db.flush()
    return loan


def reject_loan(db: Session, loan: Loan, rejector_id: UUID, reason: str | None = None) -> Loan:
    if loan.status not in (LoanStatus.PENDING, LoanStatus.APPROVED):
        raise ValueError(f"Cannot reject loan in status: {loan.status}")
    loan.status = LoanStatus.REJECTED
    loan.approved_by_id = rejector_id
    loan.rejection_reason = reason
    db.flush()
    return loan


def disburse_loan(db: Session, loan: Loan, disburser_id: UUID, product: LoanProduct) -> Loan:
    if loan.status != LoanStatus.APPROVED:
        raise ValueError(f"Loan is not approved (status: {loan.status})")

    now = datetime.now(timezone.utc)
    interest = calculate_interest(product, loan.amount)
    total = loan.amount + interest
    num_weeks = product.duration_days // 7

    loan.status = LoanStatus.DISBURSED
    loan.disbursed_by_id = disburser_id
    loan.disbursed_date = now
    loan.due_date = now + timedelta(days=product.duration_days)
    loan.interest_amount = interest
    loan.total_repayable = total
    loan.installment_amount = calculate_installment_amount(total, num_weeks)
    db.flush()

    generate_installment_schedule(db, loan, now, num_weeks)
    return loan


def close_loan(db: Session, loan: Loan, closer_id: UUID) -> Loan:
    if loan.status != LoanStatus.DISBURSED:
        raise ValueError(f"Cannot close loan in status: {loan.status}")
    loan.status = LoanStatus.CLOSED
    db.flush()
    return loan


# ── Outstanding balance ─────────────────────────────────────────────────────────

def get_outstanding(db: Session, loan: Loan) -> Decimal:
    verified_paid = db.scalar(
        select(func.coalesce(func.sum(Repayment.amount), 0))
        .where(Repayment.loan_id == loan.id, Repayment.verified == True)
    ) or Decimal("0")
    return max(loan.total_repayable - Decimal(str(verified_paid)), Decimal("0"))
