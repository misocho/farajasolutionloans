"""
Loan service — business logic for loan lifecycle, interest, installments, and penalties.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.time import as_nairobi_date, today_nairobi
from app.models.client import Client
from app.models.enums import InstallmentStatus, LoanStatus
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.loan_product import LoanProduct
from app.models.repayment import Repayment


# ── Auto-number helpers ────────────────────────────────────────────────────────


def _next_client_number(db: Session) -> str:
    year = today_nairobi().year
    last = db.scalar(
        select(func.max(Client.client_number)).where(Client.client_number.like(f"CL-{year}-%"))
    )
    n = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"CL-{year}-{n:03d}"


def _next_loan_number(db: Session) -> str:
    year = today_nairobi().year
    last = db.scalar(
        select(func.max(Loan.loan_number)).where(Loan.loan_number.like(f"LN-{year}-%"))
    )
    n = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"LN-{year}-{n:03d}"


# ── Interest & fee calculations ────────────────────────────────────────────────


def calculate_interest(product: LoanProduct, amount: Decimal) -> Decimal:
    """Flat interest on principal."""
    return (amount * product.interest_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_application_fee(amount: Decimal, is_existing_client: bool) -> Decimal:
    """Tiered application fee based on loan amount.

    Raises ValueError for amounts below the minimum loan (KES 4,000).
    """
    if amount < Decimal("4000"):
        raise ValueError("Minimum loan amount is KES 4,000")
    if amount <= Decimal("10000"):
        return Decimal("600") if is_existing_client else Decimal("800")
    return Decimal("1000") if is_existing_client else Decimal("1500")


def calculate_installment_amount(total_repayable: Decimal, num_weeks: int) -> Decimal:
    """Equal weekly installments."""
    return (total_repayable / num_weeks).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quote_loan(product: LoanProduct, amount: Decimal) -> dict:
    """Estimate a loan against a product plan — same math as disbursement.

    Returns interest, totals, installment schedule shape, and both application
    fee tiers (new vs existing client). Raises ValueError below the minimum loan.
    """
    if amount < Decimal("4000"):
        raise ValueError("Minimum loan amount is KES 4,000")
    interest = calculate_interest(product, amount)
    total = amount + interest
    num_weeks = product.duration_days // 7
    if num_weeks < 1:
        raise ValueError("Product duration must allow at least one weekly installment")
    return {
        "interest_amount": interest,
        "total_repayable": total,
        "num_installments": num_weeks,
        "installment_amount": calculate_installment_amount(total, num_weeks),
        "application_fee_new": calculate_application_fee(amount, False),
        "application_fee_existing": calculate_application_fee(amount, True),
    }


def calculate_penalty(
    outstanding: Decimal,
    due_date: datetime,
    penalty_rate: Decimal,
    interval_days: int,
    max_penalty_amount: Decimal | None = None,
) -> dict:
    """3% every 2 days on outstanding balance after due date.

    `max_penalty_amount` caps the total penalty when the product defines one.
    """
    today = today_nairobi()
    due = as_nairobi_date(due_date)
    if not due or today <= due:
        return {"days_overdue": 0, "penalty": Decimal("0")}
    days_overdue = (today - due).days
    periods = days_overdue // interval_days
    penalty = (outstanding * penalty_rate * periods).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if max_penalty_amount is not None and penalty > max_penalty_amount:
        penalty = max_penalty_amount
    return {"days_overdue": days_overdue, "penalty": penalty}


def get_computed_loan_status(loan: Loan, outstanding: Decimal) -> str:
    """
    Derive display status from DB status + dates + outstanding balance.
    Returns one of: Pending, Approved, Disbursed, Almost Due, Due, Performing,
                    Arrears, Past Maturity, Defaulter, Closed, Rejected
    """
    if loan.status in (
        LoanStatus.PENDING,
        LoanStatus.APPROVED,
        LoanStatus.REJECTED,
        LoanStatus.CLOSED,
    ):
        return loan.status.value

    if loan.status == LoanStatus.DISBURSED and loan.due_date:
        today = today_nairobi()
        due = as_nairobi_date(loan.due_date)
        days_overdue = (today - due).days

        # Fully repaid loans are always "Paid" — a manual override must not
        # keep a paid loan flagged (e.g. stuck as "Defaulter").
        if outstanding <= 0:
            return "Paid"
        # Manual status override (Manager/Director) wins over the derived state.
        if loan.status_override:
            return loan.status_override
        if days_overdue > 30:
            return "Defaulter"
        if days_overdue > 0:
            return "Past Maturity"
        if today == due:
            return "Due"
        if (due - today).days <= 2:
            return "Almost Due"
        # Behind schedule: verified payments are short of what is due so far
        due_to_date = sum(
            i.amount for i in loan.installments if as_nairobi_date(i.due_date) <= today
        )
        expected_outstanding = loan.total_repayable - due_to_date
        if outstanding > expected_outstanding:
            return "Arrears"
        # Up to date (or ahead of) the schedule: some payments made / due installments covered
        if due_to_date > 0 or outstanding < loan.total_repayable:
            return "Performing"

    return loan.status.value


# ── Installment schedule ────────────────────────────────────────────────────────


def generate_installment_schedule(
    db: Session,
    loan: Loan,
    disbursed_date: datetime,
    num_weeks: int,
) -> list[Installment]:
    """Create weekly installments starting 1 week after disbursement.

    The last installment absorbs the rounding difference so the installments
    always sum exactly to `total_repayable` — otherwise an uneven division
    leaves a sub-cent residual outstanding and the loan can never close.
    """
    installments = []
    base = loan.installment_amount
    last_amount = loan.total_repayable - base * (num_weeks - 1)
    for week in range(1, num_weeks + 1):
        inst = Installment(
            loan_id=loan.id,
            due_date=disbursed_date + timedelta(weeks=week),
            amount=last_amount if week == num_weeks else base,
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
        select(func.coalesce(func.sum(Repayment.amount), 0)).where(
            Repayment.loan_id == loan.id, Repayment.verified == True
        )
    ) or Decimal("0")
    return max(loan.total_repayable - Decimal(str(verified_paid)), Decimal("0"))


# ── Installment payment status ──────────────────────────────────────────────────


def mark_installments_paid(db: Session, loan: Loan) -> None:
    """
    Mark installments as Paid, oldest-first, based on verified repayments.
    An installment is paid only when cumulative verified payments fully cover it.
    """
    paid_total = db.scalar(
        select(func.coalesce(func.sum(Repayment.amount), 0)).where(
            Repayment.loan_id == loan.id, Repayment.verified == True
        )
    ) or Decimal("0")

    installments = db.scalars(
        select(Installment).where(Installment.loan_id == loan.id).order_by(Installment.due_date)
    ).all()

    remaining = Decimal(str(paid_total))
    for inst in installments:
        if inst.status == InstallmentStatus.PAID:
            remaining -= inst.amount
            continue
        if remaining >= inst.amount:
            inst.status = InstallmentStatus.PAID
            inst.paid_at = datetime.now(timezone.utc)
            remaining -= inst.amount
        else:
            break
    db.flush()


def installment_paid_amounts(db: Session, loan: Loan) -> dict[UUID, Decimal]:
    """Cumulative verified payments applied oldest-first to each installment.

    A partially covered installment (e.g. final one with a residual balance)
    reports the amount actually paid against it; fully unpaid ones report 0.
    """
    paid_total = db.scalar(
        select(func.coalesce(func.sum(Repayment.amount), 0)).where(
            Repayment.loan_id == loan.id, Repayment.verified.is_(True)
        )
    ) or Decimal("0")

    installments = db.scalars(
        select(Installment).where(Installment.loan_id == loan.id).order_by(Installment.due_date)
    ).all()

    remaining = Decimal(str(paid_total))
    amounts: dict[UUID, Decimal] = {}
    for inst in installments:
        applied = min(remaining, inst.amount)
        amounts[inst.id] = applied
        remaining -= applied
    return amounts
