"""
Expenses Router — Faraja Solution Loans (PostgreSQL)

GET  /expenses                — list expenses (expenses.view)
POST /expenses                — record an expense (expenses.create)
POST /expenses/{id}/verify    — approve an expense (expenses.approve)
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.db.session import get_db
from app.models.branch import Branch
from app.models.enums import ExpenseCategory, PaymentMode
from app.models.expense import Expense
from app.models.user import User

router = APIRouter()


# ── Permission helper ─────────────────────────────────────────────────────────


def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


# ── Schemas ───────────────────────────────────────────────────────────────────


class ExpenseCreateRequest(BaseModel):
    category: ExpenseCategory = ExpenseCategory.OPERATIONS
    amount: Decimal = Field(gt=0, description="Amount in KES")
    expense_date: date | None = None
    mode: PaymentMode = PaymentMode.CASH
    reference: str | None = Field(default=None, max_length=100)
    description: str | None = None
    branch_id: UUID | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/expenses")
def list_expenses(
    date_from: date | None = Query(None, description="ISO date e.g. 2026-08-01"),
    date_to: date | None = Query(None, description="ISO date e.g. 2026-08-31"),
    branch_id: UUID | None = None,
    verified: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "expenses.view")

    scope = _resolve_branch_filter(db, current_user, branch_id)
    stmt = select(Expense).order_by(Expense.expense_date.desc(), Expense.created_at.desc())
    if scope is not None:
        stmt = stmt.where(Expense.branch_id.in_(scope) if scope else False)
    if date_from:
        stmt = stmt.where(Expense.expense_date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.expense_date <= date_to)
    if verified is not None:
        stmt = stmt.where(Expense.verified == verified)

    expenses = db.scalars(stmt).all()
    return [_serialize_expense(e) for e in expenses]


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
def create_expense(
    request: ExpenseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "expenses.create")

    branch_id = _resolve_branch_assignment(db, current_user, request.branch_id)
    expense = Expense(
        branch_id=branch_id,
        category=request.category,
        amount=request.amount,
        expense_date=request.expense_date or date.today(),
        mode=request.mode,
        reference=request.reference,
        description=request.description,
        recorded_by_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)


@router.post("/expenses/{expense_id}/verify")
def verify_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "expenses.approve")

    expense = db.scalar(select(Expense).where(Expense.id == expense_id))
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")
    if expense.verified:
        raise HTTPException(status_code=400, detail="Expense is already verified.")
    if expense.recorded_by_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="You cannot verify an expense you recorded yourself."
        )
    expense.verified = True
    expense.verified_by_id = current_user.id
    expense.verified_at = datetime.now(UTC)
    db.commit()
    db.refresh(expense)
    return _serialize_expense(expense)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _resolve_branch_filter(db: Session, user: User, branch_id: UUID | None) -> list | None:
    """None = unrestricted, [] = see nothing, list = allowed branch ids."""
    branch_ids = get_user_branch_ids(db, user)
    if branch_id is not None:
        if branch_ids is not None and branch_id not in branch_ids:
            raise HTTPException(status_code=403, detail="Not allowed to view that branch.")
        return [branch_id]
    return branch_ids


def _resolve_branch_assignment(db: Session, user: User, branch_id: UUID | None) -> UUID:
    """Scoped users default to their first branch; unrestricted must supply one."""
    branch_ids = get_user_branch_ids(db, user)
    if branch_ids is not None:
        if branch_id is None:
            if not branch_ids:
                raise HTTPException(status_code=403, detail="No branch assigned to your account.")
            return branch_ids[0]
        if branch_id not in branch_ids:
            raise HTTPException(status_code=403, detail="Not allowed to assign that branch.")
        return branch_id
    if branch_id is None:
        raise HTTPException(status_code=400, detail="branch_id is required.")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found.")
    return branch_id


def _serialize_expense(expense: Expense) -> dict:
    return {
        "id": str(expense.id),
        "branch_id": str(expense.branch_id) if expense.branch_id else None,
        "branch_name": expense.branch.name if expense.branch else None,
        "category": expense.category.value,
        "amount": float(expense.amount),
        "expense_date": expense.expense_date.isoformat(),
        "mode": expense.mode.value,
        "reference": expense.reference,
        "description": expense.description,
        "recorded_by": expense.recorded_by.full_name if expense.recorded_by else None,
        "verified": expense.verified,
        "verified_by": expense.verified_by.full_name if expense.verified_by else None,
        "verified_at": expense.verified_at.isoformat() if expense.verified_at else None,
        "created_at": expense.created_at.isoformat(),
    }
