"""
Reports Router — Faraja Solution Loans

Endpoints:
  GET /reports/portfolio    — Active loan portfolio summary
  GET /reports/arrears      — Loans with overdue/missed payments
  GET /reports/collections  — Repayment collections for date range
  GET /reports/clients      — Client portfolio stats
  GET /reports/summary      — High-level executive summary
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_permissions
from app.db.session import get_db
from app.models.branch import Branch
from app.models.client import Client
from app.models.enums import LoanStatus
from app.models.expense import Expense
from app.models.fee_payment import FeePayment
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.repayment import Repayment
from app.models.user import User
from app.services.loan_service import get_outstanding, calculate_penalty

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


# ── Portfolio Report ───────────────────────────────────────────────────────────

@router.get("/portfolio")
def get_portfolio_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")
    loans = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client), joinedload(Loan.loan_product), joinedload(Loan.branch))
        .where(Loan.status == LoanStatus.DISBURSED)
    ).unique().all()

    today = datetime.now(timezone.utc).date()
    portfolio = []
    total_principal = Decimal("0")
    total_outstanding = Decimal("0")
    total_penalty = Decimal("0")
    overdue_count = 0

    for loan in loans:
        outstanding = get_outstanding(db, loan)
        penalty_info = {"days_overdue": 0, "penalty": Decimal("0")}
        is_overdue = False
        if loan.loan_product and loan.due_date:
            penalty_info = calculate_penalty(
                outstanding, loan.due_date,
                loan.loan_product.penalty_rate,
                loan.loan_product.penalty_interval_days,
            )
            is_overdue = penalty_info["days_overdue"] > 0

        total_principal += loan.amount
        total_outstanding += outstanding
        total_penalty += Decimal(str(penalty_info["penalty"]))
        if is_overdue:
            overdue_count += 1

        due_date = loan.due_date.date() if loan.due_date else None
        days_to_due = (due_date - today).days if due_date else None

        portfolio.append({
            "loan_number": loan.loan_number,
            "client": loan.client.name if loan.client else "",
            "branch": loan.branch.name if loan.branch else "",
            "product": loan.loan_product.name if loan.loan_product else "",
            "sector": loan.sector,
            "principal": float(loan.amount),
            "total_repayable": float(loan.total_repayable),
            "outstanding": float(outstanding),
            "days_overdue": penalty_info["days_overdue"],
            "penalty": float(penalty_info["penalty"]),
            "due_date": due_date.isoformat() if due_date else None,
            "days_to_due": days_to_due,
            "is_overdue": is_overdue,
            "is_almost_due": days_to_due is not None and 0 < days_to_due <= 2,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_active_loans": len(loans),
            "total_principal": float(total_principal),
            "total_outstanding": float(total_outstanding),
            "total_penalty": float(total_penalty),
            "overdue_count": overdue_count,
            "on_track_count": len(loans) - overdue_count,
        },
        "loans": sorted(portfolio, key=lambda x: x["days_overdue"], reverse=True),
    }


# ── Arrears Report ────────────────────────────────────────────────────────────

@router.get("/arrears")
def get_arrears_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")
    today = datetime.now(timezone.utc)
    overdue_loans = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client), joinedload(Loan.loan_product), joinedload(Loan.branch))
        .where(Loan.status == LoanStatus.DISBURSED, Loan.due_date < today)
    ).unique().all()

    arrears = []
    total_overdue_amount = Decimal("0")
    total_penalty = Decimal("0")

    for loan in overdue_loans:
        outstanding = get_outstanding(db, loan)
        if outstanding <= 0:
            continue  # Fully paid, skip
        penalty_info = {"days_overdue": 0, "penalty": Decimal("0")}
        if loan.loan_product:
            penalty_info = calculate_penalty(
                outstanding, loan.due_date,
                loan.loan_product.penalty_rate,
                loan.loan_product.penalty_interval_days,
            )

        total_overdue_amount += outstanding
        total_penalty += Decimal(str(penalty_info["penalty"]))

        arrears.append({
            "loan_number": loan.loan_number,
            "client": loan.client.name if loan.client else "",
            "client_phone": loan.client.phone if loan.client else "",
            "branch": loan.branch.name if loan.branch else "",
            "sector": loan.sector,
            "principal": float(loan.amount),
            "outstanding": float(outstanding),
            "days_overdue": penalty_info["days_overdue"],
            "penalty": float(penalty_info["penalty"]),
            "total_due": float(outstanding + Decimal(str(penalty_info["penalty"]))),
            "due_date": loan.due_date.date().isoformat() if loan.due_date else None,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_overdue_loans": len(arrears),
            "total_overdue_amount": float(total_overdue_amount),
            "total_penalty": float(total_penalty),
        },
        "loans": sorted(arrears, key=lambda x: x["days_overdue"], reverse=True),
    }


# ── Collections Report ────────────────────────────────────────────────────────

@router.get("/collections")
def get_collections_report(
    date_from: Optional[str] = Query(None, description="ISO date e.g. 2026-07-01"),
    date_to: Optional[str] = Query(None, description="ISO date e.g. 2026-07-31"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")

    now = datetime.now(timezone.utc)
    # Default: current calendar month
    start_dt = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc) if date_from else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_dt = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1) if date_to else now

    repayments = db.scalars(
        select(Repayment)
        .options(joinedload(Repayment.loan), joinedload(Repayment.client), joinedload(Repayment.recorded_by))
        .where(Repayment.date >= start_dt, Repayment.date < end_dt)
        .order_by(Repayment.date.desc())
    ).unique().all()

    verified = [r for r in repayments if r.verified]
    unverified = [r for r in repayments if not r.verified]

    total_verified = sum(r.amount for r in verified)
    total_unverified = sum(r.amount for r in unverified)

    return {
        "generated_at": now.isoformat(),
        "period": {
            "from": start_dt.date().isoformat(),
            "to": end_dt.date().isoformat(),
        },
        "summary": {
            "total_repayments": len(repayments),
            "verified_count": len(verified),
            "unverified_count": len(unverified),
            "total_collected": float(total_verified),
            "total_pending_verification": float(total_unverified),
        },
        "repayments": [
            {
                "id": str(r.id),
                "date": r.date.date().isoformat(),
                "client": r.client.name if r.client else "",
                "loan_number": r.loan.loan_number if r.loan else "",
                "amount": float(r.amount),
                "mode": r.mode.value,
                "reference": r.reference,
                "recorded_by": r.recorded_by.full_name if r.recorded_by else "",
                "verified": r.verified,
            }
            for r in repayments
        ],
    }


# ── Clients Report ────────────────────────────────────────────────────────────

@router.get("/clients")
def get_clients_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")

    clients = db.scalars(
        select(Client).options(joinedload(Client.branch))
    ).unique().all()

    report = []
    for client in clients:
        loan_count = db.scalar(select(func.count()).select_from(Loan).where(Loan.client_id == client.id)) or 0
        active_loans = db.scalar(select(func.count()).select_from(Loan).where(
            Loan.client_id == client.id, Loan.status == LoanStatus.DISBURSED
        )) or 0
        total_borrowed = db.scalar(
            select(func.coalesce(func.sum(Loan.amount), 0)).where(Loan.client_id == client.id)
        ) or Decimal("0")
        total_repaid = db.scalar(
            select(func.coalesce(func.sum(Repayment.amount), 0)).where(
                Repayment.client_id == client.id, Repayment.verified == True
            )
        ) or Decimal("0")
        report.append({
            "client_number": client.client_number,
            "name": client.name,
            "phone": client.phone,
            "branch": client.branch.name if client.branch else "",
            "total_loans": loan_count,
            "active_loans": active_loans,
            "total_borrowed": float(total_borrowed),
            "total_repaid": float(total_repaid),
            "registered_at": client.created_at.isoformat() if client.created_at else None,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_clients": len(report),
            "clients_with_active_loans": sum(1 for c in report if c["active_loans"] > 0),
        },
        "clients": sorted(report, key=lambda x: x["total_borrowed"], reverse=True),
    }


# ── Executive Summary ─────────────────────────────────────────────────────────

@router.get("/summary")
def get_executive_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")

    today = datetime.now(timezone.utc)
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    stats = {
        "total_clients": db.scalar(select(func.count()).select_from(Client)) or 0,
        "total_loans": db.scalar(select(func.count()).select_from(Loan)) or 0,
        "pending_loans": db.scalar(select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.PENDING)) or 0,
        "active_loans": db.scalar(select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.DISBURSED)) or 0,
        "closed_loans": db.scalar(select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.CLOSED)) or 0,
        "overdue_loans": db.scalar(select(func.count()).select_from(Loan).where(
            Loan.status == LoanStatus.DISBURSED, Loan.due_date < today
        )) or 0,
        "total_disbursed": float(db.scalar(
            select(func.coalesce(func.sum(Loan.amount), 0)).where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]))
        ) or 0),
        "total_collected": float(db.scalar(
            select(func.coalesce(func.sum(Repayment.amount), 0)).where(Repayment.verified == True)
        ) or 0),
        "collections_this_month": float(db.scalar(
            select(func.coalesce(func.sum(Repayment.amount), 0)).where(
                Repayment.verified, Repayment.date >= month_start
            )
        ) or 0),
        "disbursements_this_month": float(db.scalar(
            select(func.coalesce(func.sum(Loan.amount), 0)).where(
                Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]),
                Loan.disbursed_date >= month_start,
            )
        ) or 0),
        "unverified_repayments": db.scalar(select(func.count()).select_from(Repayment).where(Repayment.verified == False)) or 0,
        "fee_income": float(db.scalar(
            select(func.coalesce(func.sum(FeePayment.amount), 0)).where(FeePayment.verified == True)
        ) or 0),
        "fee_income_this_month": float(db.scalar(
            select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
                FeePayment.verified, FeePayment.verified_at >= month_start
            )
        ) or 0),
    }

    return {
        "generated_at": today.isoformat(),
        "period_month": month_start.strftime("%B %Y"),
        **stats,
    }


# ── Profit & Loss Report ──────────────────────────────────────────────────────

def _month_bounds(month: int, year: int) -> tuple[datetime, datetime]:
    """Start (inclusive) and end (exclusive) datetimes for a calendar month."""
    period_from = datetime(year, month, 1, tzinfo=timezone.utc)
    period_to = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(
        year, month + 1, 1, tzinfo=timezone.utc
    )
    return period_from, period_to


def _pnl_for_period(
    db: Session, period_from: datetime, period_to: datetime, branch_id: UUID | None,
    *, with_penalties: bool = True,
) -> dict:
    """Income/expense aggregations for one calendar month (accrual basis)."""
    loan_filter = [
        Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]),
        Loan.disbursed_date >= period_from,
        Loan.disbursed_date < period_to,
    ]
    if branch_id:
        loan_filter.append(Loan.branch_id == branch_id)

    interest_income = db.scalar(
        select(func.coalesce(func.sum(Loan.interest_amount), 0)).where(*loan_filter)
    ) or Decimal("0")
    principal_disbursed = db.scalar(
        select(func.coalesce(func.sum(Loan.amount), 0)).where(*loan_filter)
    ) or Decimal("0")
    loans_disbursed = db.scalar(select(func.count()).select_from(Loan).where(*loan_filter)) or 0

    fee_stmt = (
        select(func.coalesce(func.sum(FeePayment.amount), 0))
        .join(FeePayment.client)
        .where(
            FeePayment.verified,
            FeePayment.verified_at >= period_from,
            FeePayment.verified_at < period_to,
        )
    )
    fee_stmt_un = (
        select(func.coalesce(func.sum(FeePayment.amount), 0))
        .join(FeePayment.client)
        .where(
            ~FeePayment.verified,
            FeePayment.created_at >= period_from,
            FeePayment.created_at < period_to,
        )
    )
    if branch_id:
        fee_stmt = fee_stmt.where(Client.branch_id == branch_id)
        fee_stmt_un = fee_stmt_un.where(Client.branch_id == branch_id)
    application_fee_income = db.scalar(fee_stmt) or Decimal("0")
    unverified_fees = db.scalar(fee_stmt_un) or Decimal("0")

    expense_filter = [
        Expense.verified,
        Expense.expense_date >= period_from.date(),
        Expense.expense_date < period_to.date(),
    ]
    expense_filter_un = [
        ~Expense.verified,
        Expense.expense_date >= period_from.date(),
        Expense.expense_date < period_to.date(),
    ]
    if branch_id:
        expense_filter.append(Expense.branch_id == branch_id)
        expense_filter_un.append(Expense.branch_id == branch_id)
    verified_expenses = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(*expense_filter)
    ) or Decimal("0")
    unverified_expenses = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(*expense_filter_un)
    ) or Decimal("0")

    repay_stmt = (
        select(func.coalesce(func.sum(Repayment.amount), 0))
        .join(Repayment.loan)
        .where(Repayment.verified, Repayment.date >= period_from, Repayment.date < period_to)
    )
    if branch_id:
        repay_stmt = repay_stmt.where(Loan.branch_id == branch_id)
    repayments_collected = db.scalar(repay_stmt) or Decimal("0")

    penalties_accrued = Decimal("0")
    if with_penalties:
        period_loans = db.scalars(
            select(Loan)
            .options(joinedload(Loan.loan_product))
            .where(*loan_filter)
        ).unique().all()
        for loan in period_loans:
            if not loan.due_date or loan.loan_product is None:
                continue
            outstanding = get_outstanding(db, loan)
            if outstanding <= 0:
                continue
            res = calculate_penalty(
                outstanding,
                loan.due_date,
                loan.loan_product.penalty_rate,
                loan.loan_product.penalty_interval_days,
            )
            penalties_accrued += Decimal(str(res["penalty"]))

    return {
        "interest_income": interest_income,
        "application_fee_income": application_fee_income,
        "verified_expenses": verified_expenses,
        "unverified_fees": unverified_fees,
        "unverified_expenses": unverified_expenses,
        "penalties_accrued": penalties_accrued,
        "loans_disbursed": loans_disbursed,
        "principal_disbursed": principal_disbursed,
        "repayments_collected": repayments_collected,
    }


@router.get("/pnl")
def get_pnl_report(
    month: int | None = Query(None, ge=1, le=12, description="1-12, defaults to current"),
    year: int | None = Query(None, description="e.g. 2026, defaults to current"),
    branch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")

    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    period_from, period_to = _month_bounds(m, y)

    data = _pnl_for_period(db, period_from, period_to, branch_id)
    net_income = (
        data["interest_income"] + data["application_fee_income"] - data["verified_expenses"]
    )

    branch_name = None
    if branch_id:
        branch = db.scalar(select(Branch).where(Branch.id == branch_id))
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found.")
        branch_name = branch.name

    return {
        "generated_at": now.isoformat(),
        "period": {
            "month": m,
            "year": y,
            "from": period_from.date().isoformat(),
            "to": (period_to - timedelta(days=1)).date().isoformat(),
        },
        "branch_id": str(branch_id) if branch_id else None,
        "branch_name": branch_name,
        "income": {
            "interest_income": float(data["interest_income"]),
            "application_fee_income": float(data["application_fee_income"]),
            "unverified_fees": float(data["unverified_fees"]),
            "penalties_accrued": float(data["penalties_accrued"]),
        },
        "expenses": {
            "verified": float(data["verified_expenses"]),
            "unverified": float(data["unverified_expenses"]),
        },
        "net_income": float(net_income),
        "activity": {
            "loans_disbursed": data["loans_disbursed"],
            "principal_disbursed": float(data["principal_disbursed"]),
            "repayments_collected": float(data["repayments_collected"]),
        },
    }


@router.get("/pnl/series")
def get_pnl_series(
    months: int = Query(6, ge=1, le=24, description="Number of trailing months"),
    branch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "reports.view")

    now = datetime.now(timezone.utc)
    current = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    series = []
    for i in range(months - 1, -1, -1):
        total = current.year * 12 + (current.month - 1) - i
        m = total % 12 + 1
        y = total // 12
        period_from, period_to = _month_bounds(m, y)
        data = _pnl_for_period(db, period_from, period_to, branch_id, with_penalties=False)
        net = data["interest_income"] + data["application_fee_income"] - data["verified_expenses"]
        series.append({
            "month": f"{y:04d}-{m:02d}",
            "income": float(data["interest_income"] + data["application_fee_income"]),
            "expenses": float(data["verified_expenses"]),
            "net": float(net),
        })

    return {
        "generated_at": now.isoformat(),
        "branch_id": str(branch_id) if branch_id else None,
        "series": series,
    }
