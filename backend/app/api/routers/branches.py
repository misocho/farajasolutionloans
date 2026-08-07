"""
Branches Router — Faraja Solution Loans (PostgreSQL)

GET    /branches                     — list all branches with real stats
GET    /branches/{id}                — single branch detail + users
POST   /branches                     — create branch (branches.manage)
PATCH  /branches/{id}                — update branch (branches.manage)
DELETE /branches/{id}                — soft-deactivate (branches.manage)
GET    /branches/{id}/users          — list users assigned to branch
POST   /branches/{id}/users          — assign user to branch (branches.manage)
DELETE /branches/{id}/users/{uid}    — remove user from branch (branches.manage)
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.db.session import get_db
from app.models.branch import Branch
from app.models.client import Client
from app.models.enums import LoanStatus
from app.models.loan import Loan
from app.models.repayment import Repayment
from app.models.user import User
from app.models.user_branch import UserBranch

router = APIRouter()


# ── Permission helper ─────────────────────────────────────────────────────────

def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


# ── Schemas ───────────────────────────────────────────────────────────────────

class BranchCreateRequest(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BranchUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None
    is_active: Optional[bool] = None  # frontend alias for active


class AssignUserRequest(BaseModel):
    user_id: UUID


# ── Serializers ───────────────────────────────────────────────────────────────

def _branch_stats(branch_id: UUID, db: Session) -> dict:
    total_clients = db.scalar(
        select(func.count()).select_from(Client).where(Client.branch_id == branch_id)
    ) or 0

    active_loans = db.scalar(
        select(func.count()).select_from(Loan).where(
            Loan.branch_id == branch_id, Loan.status == LoanStatus.DISBURSED
        )
    ) or 0

    overdue_loans = db.scalar(
        select(func.count()).select_from(Loan).where(
            Loan.branch_id == branch_id,
            Loan.status == LoanStatus.DISBURSED,
            Loan.due_date < func.now(),
        )
    ) or 0

    disbursed_amount = db.scalar(
        select(func.coalesce(func.sum(Loan.amount), 0)).where(
            Loan.branch_id == branch_id,
            Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]),
        )
    ) or Decimal("0")

    collected_amount = db.scalar(
        select(func.coalesce(func.sum(Repayment.amount), 0))
        .join(Loan, Repayment.loan_id == Loan.id)
        .where(Loan.branch_id == branch_id, Repayment.verified == True)
    ) or Decimal("0")

    return {
        "total_clients": total_clients,
        "active_loans": active_loans,
        "overdue_loans": overdue_loans,
        "disbursed_amount": float(disbursed_amount),
        "collected_amount": float(collected_amount),
    }


def _serialize_branch(b: Branch, db: Session, include_stats: bool = True) -> dict:
    out: dict = {
        "id": str(b.id),
        "name": b.name,
        "code": b.code,
        "address": b.address,
        "phone": b.phone,
        "email": b.email,
        "active": b.active,
        "is_active": b.active,   # frontend compat alias
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "stats": _branch_stats(b.id, db) if include_stats else {},
    }
    return out


def _next_branch_code(db: Session, name: str) -> str:
    """Auto-generate a unique branch code from the name, e.g. 'MMB' or 'MMB-2'."""
    base = "".join(w[0] for w in name.split() if w[0].isalpha()).upper()[:4] or "BR"
    code = base
    seq = 1
    while db.scalar(select(Branch).where(Branch.code == code)):
        seq += 1
        code = f"{base}-{seq}"
    return code


def _serialize_user(u: User) -> dict:
    role_names = [ur.role.name for ur in u.roles]
    branch_ids = [str(ub.branch_id) for ub in u.branches]
    return {
        "id": str(u.id),
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": u.full_name,
        "email": u.email,
        "employee_number": u.employee_number,
        "is_active": u.is_active,
        "roles": role_names,
        "branch_ids": branch_ids,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/branches")
def get_branches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.view")
    stmt = select(Branch).order_by(Branch.name)
    # Branch scoping: scoped roles (LO/Manager) see only their assigned branches
    branch_ids = get_user_branch_ids(current_user)
    if branch_ids is not None:
        stmt = stmt.where(Branch.id.in_(branch_ids) if branch_ids else False)
    branches = db.scalars(stmt).all()
    return [_serialize_branch(b, db) for b in branches]


@router.get("/branches/{branch_id}")
def get_branch(
    branch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.view")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch_ids = get_user_branch_ids(current_user)
    if branch_ids is not None and branch.id not in branch_ids:
        raise HTTPException(status_code=403, detail="Not allowed to view that branch.")
    return _serialize_branch(branch, db)


@router.post("/branches", status_code=status.HTTP_201_CREATED)
def create_branch(
    request: BranchCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.manage")

    # Check uniqueness
    if db.scalar(select(Branch).where(Branch.name == request.name)):
        raise HTTPException(status_code=409, detail="A branch with this name already exists.")

    code = (request.code or _next_branch_code(db, request.name)).upper()
    if db.scalar(select(Branch).where(Branch.code == code)):
        raise HTTPException(status_code=409, detail="A branch with this code already exists.")

    branch = Branch(
        name=request.name,
        code=code,
        address=request.address,
        phone=request.phone,
        email=request.email,
        active=True,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _serialize_branch(branch, db)


@router.patch("/branches/{branch_id}")
def update_branch(
    branch_id: UUID,
    request: BranchUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.manage")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    data = request.model_dump(exclude_unset=True)
    if "is_active" in data:
        data["active"] = data.pop("is_active")
    for k, v in data.items():
        setattr(branch, k, v)

    db.commit()
    db.refresh(branch)
    return _serialize_branch(branch, db)


@router.delete("/branches/{branch_id}", status_code=status.HTTP_200_OK)
def deactivate_branch(
    branch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.manage")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.active = False
    db.commit()
    return {"status": "ok", "message": f"Branch '{branch.name}' deactivated."}


# ── Branch ↔ User assignment ──────────────────────────────────────────────────

@router.get("/branches/{branch_id}/users")
def get_branch_users(
    branch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.view")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    user_branches = db.scalars(
        select(UserBranch).where(UserBranch.branch_id == branch_id)
    ).all()
    users = []
    for ub in user_branches:
        u = db.scalar(select(User).where(User.id == ub.user_id))
        if u:
            users.append(_serialize_user(u))
    return users


@router.post("/branches/{branch_id}/users", status_code=status.HTTP_201_CREATED)
def assign_user_to_branch(
    branch_id: UUID,
    request: AssignUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.manage")

    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    user = db.scalar(select(User).where(User.id == request.user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.scalar(
        select(UserBranch).where(
            UserBranch.branch_id == branch_id,
            UserBranch.user_id == request.user_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="User already assigned to this branch.")

    ub = UserBranch(branch_id=branch_id, user_id=request.user_id)
    db.add(ub)
    db.commit()
    return {"status": "ok", "message": f"{user.full_name} assigned to {branch.name}"}


@router.delete("/branches/{branch_id}/users/{user_id}", status_code=status.HTTP_200_OK)
def remove_user_from_branch(
    branch_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "branches.manage")
    ub = db.scalar(
        select(UserBranch).where(
            UserBranch.branch_id == branch_id,
            UserBranch.user_id == user_id,
        )
    )
    if not ub:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(ub)
    db.commit()
    return {"status": "ok", "message": "User removed from branch"}
