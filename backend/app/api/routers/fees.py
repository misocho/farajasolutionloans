"""
Fees Router — Faraja Solution Loans (PostgreSQL)

GET   /fees/quote?client_id=&amount=   — quote the application fee (fees.view)
GET   /fees?client_id=                 — list fee payments (fees.view)
POST  /fees                            — record a fee payment (fees.record)
POST  /fees/{id}/verify                — verify a fee payment (fees.verify)
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import false, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.db.session import get_db
from app.models.client import Client
from app.models.enums import FeeType, PaymentMode
from app.models.fee_payment import FeePayment
from app.models.user import User
from app.services import audit_service, fee_service

router = APIRouter()


# ── Permission helper ─────────────────────────────────────────────────────────

def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


def _assert_branch_visible(db: Session, user: User, branch_id: UUID | None) -> None:
    """403 when a scoped user cannot access the branch a record belongs to."""
    branch_ids = get_user_branch_ids(db, user)
    if branch_ids is not None and (branch_id is None or branch_id not in branch_ids):
        raise HTTPException(status_code=403, detail="Not allowed to access that branch.")


# ── Schemas ───────────────────────────────────────────────────────────────────

class FeeCreateRequest(BaseModel):
    client_id: UUID
    amount: float
    mode: str = "Cash"
    reference: Optional[str] = None
    notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/fees/quote")
def quote_fee(
    client_id: UUID,
    amount: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "fees.view")
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    _assert_branch_visible(db, current_user, client.branch_id)
    try:
        return fee_service.quote_application_fee(db, client_id, Decimal(str(amount)))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/fees")
def list_fees(
    client_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "fees.view")
    branch_ids = get_user_branch_ids(db, current_user)
    stmt = (
        select(FeePayment)
        .join(Client, FeePayment.client_id == Client.id)
        .order_by(FeePayment.created_at.desc())
    )
    if branch_ids is not None:
        if branch_ids:
            stmt = stmt.where(Client.branch_id.in_(branch_ids))
        else:
            stmt = stmt.where(false())
    if client_id:
        stmt = stmt.where(FeePayment.client_id == client_id)
    fees = db.scalars(stmt).all()
    return [_serialize_fee(f) for f in fees]


@router.post("/fees", status_code=status.HTTP_201_CREATED)
def record_fee(
    request: FeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "fees.record")
    client = db.get(Client, request.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    _assert_branch_visible(db, current_user, client.branch_id)
    amount = Decimal(str(request.amount))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Fee amount must be positive")
    if request.mode not in PaymentMode._value2member_map_:
        raise HTTPException(status_code=400, detail=f"Invalid payment mode '{request.mode}'")

    fee = FeePayment(
        client_id=request.client_id,
        fee_type=FeeType.APPLICATION,
        amount=amount,
        mode=PaymentMode(request.mode),
        reference=request.reference,
        notes=request.notes,
        recorded_by_id=current_user.id,
    )
    db.add(fee)
    try:
        db.flush()
        audit_service.write_audit_log(
            db, current_user.id, current_user.full_name, "fee.record", "fee",
            fee.id, branch_id=client.branch_id,
            meta={"amount": str(amount), "mode": PaymentMode(request.mode).value},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A fee payment with this reference already exists") from None
    db.refresh(fee)
    return _serialize_fee(fee)


@router.post("/fees/{fee_id}/verify")
def verify_fee(
    fee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "fees.verify")
    fee = db.get(FeePayment, fee_id)
    if not fee:
        raise HTTPException(status_code=404, detail="Fee payment not found")
    _assert_branch_visible(db, current_user, fee.client.branch_id)
    if fee.verified:
        raise HTTPException(status_code=400, detail="Already verified")
    fee.verified = True
    fee.verified_by_id = current_user.id
    fee.verified_at = datetime.now(timezone.utc)
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "fee.verify", "fee",
        fee.id, branch_id=fee.client.branch_id, meta={"amount": str(fee.amount)},
    )
    db.commit()
    db.refresh(fee)
    return _serialize_fee(fee)


# ── Serializer ────────────────────────────────────────────────────────────────

def _serialize_fee(f: FeePayment) -> dict:
    return {
        "id": str(f.id),
        "client_id": str(f.client_id),
        "client": f.client.name if f.client else "",
        "loan_id": str(f.loan_id) if f.loan_id else None,
        "loan_number": f.loan.loan_number if f.loan else None,
        "fee_type": f.fee_type.value,
        "amount": float(f.amount),
        "mode": f.mode.value,
        "reference": f.reference,
        "notes": f.notes,
        "recorded_by": f.recorded_by.full_name if f.recorded_by else None,
        "verified": f.verified,
        "verified_by": f.verified_by.full_name if f.verified_by else None,
        "verified_at": f.verified_at.isoformat() if f.verified_at else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
