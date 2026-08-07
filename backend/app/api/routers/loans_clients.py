"""
Loan & Client Router — Faraja Solution Loans (PostgreSQL backend)

Loan Workflow:
  Loan Officer  → POST /loans               (status: Pending)
  Manager/Dir   → PATCH /loans/{id}/approve  (Pending → Approved)
  Manager/Dir   → PATCH /loans/{id}/reject   (Pending/Approved → Rejected)
  Director      → PATCH /loans/{id}/disburse (Approved → Disbursed + schedule generated)
  Director      → PATCH /loans/{id}/close    (Disbursed, fully repaid → Closed)

Repayment Workflow:
  Loan Officer  → POST /repayments           (verified: false)
  Manager/Dir   → PATCH /repayments/{id}/verify
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_permissions
from app.db.session import get_db
from app.models.client import Client
from app.models.enums import LoanStatus, PaymentMode
from app.models.fee_payment import FeePayment
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.loan_product import LoanProduct
from app.models.repayment import Repayment
from app.models.user import User
from app.services import fee_service, loan_service

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


def _get_user_branch_ids(user: User) -> list | None:
    """
    Returns None for Directors and System Admins (unrestricted access).
    Returns a list of branch UUIDs for Loan Officers and Managers.
    An empty list means no branch assigned — they will see nothing (safer than seeing all).
    """
    UNRESTRICTED_ROLES = {"Director", "System Admin", "Auditor"}
    role_names = {ur.role.name for ur in user.roles}
    if role_names & UNRESTRICTED_ROLES:
        return None  # No filter — sees everything
    # Scoped roles: return their assigned branch IDs
    return [ub.branch_id for ub in user.branches]


def _enrich_loan(loan: Loan, db: Session) -> dict:
    outstanding = loan_service.get_outstanding(db, loan)
    computed_status = loan_service.get_computed_loan_status(loan, outstanding)

    penalty_info = {"days_overdue": 0, "penalty": Decimal("0")}
    if loan.loan_product and loan.status == LoanStatus.DISBURSED and loan.due_date:
        penalty_info = loan_service.calculate_penalty(
            outstanding,
            loan.due_date,
            loan.loan_product.penalty_rate,
            loan.loan_product.penalty_interval_days,
        )

    return {
        "id": str(loan.id),
        "loan_number": loan.loan_number,
        "client": loan.client.name if loan.client else "",
        "client_id": str(loan.client_id),
        "sector": loan.sector,
        "amount": float(loan.amount),
        "interest_amount": float(loan.interest_amount),
        "total_repayable": float(loan.total_repayable),
        "application_fee": float(loan.application_fee),
        "installment_amount": float(loan.installment_amount),
        "duration_days": loan.duration_days,
        "status": computed_status,
        "db_status": loan.status.value,
        "notes": loan.notes,
        "approval_note": loan.approval_note,
        "rejection_reason": loan.rejection_reason,
        "product": loan.loan_product.name if loan.loan_product else None,
        "product_id": str(loan.loan_product_id) if loan.loan_product_id else None,
        "branch": loan.branch.name if loan.branch else None,
        "submitted_by": _user_str(loan.submitted_by),
        "approved_by": _user_str(loan.approved_by),
        "disbursed_by": _user_str(loan.disbursed_by),
        "date": loan.date_submitted.isoformat() if loan.date_submitted else None,
        "disbursed_date": loan.disbursed_date.isoformat() if loan.disbursed_date else None,
        "due_date": loan.due_date.date().isoformat() if loan.due_date else None,
        "outstanding": float(outstanding),
        "amount_repaid": float(loan.total_repayable - outstanding) if loan.status == LoanStatus.DISBURSED else 0.0,
        "is_overdue": penalty_info["days_overdue"] > 0,
        "days_overdue": penalty_info["days_overdue"],
        "penalty_amount": float(penalty_info["penalty"]),
    }


def _user_str(user: User | None) -> str | None:
    if not user:
        return None
    role = user.roles[0].role.name if user.roles else ""
    return f"{user.first_name} {user.last_name} ({role[:3].upper()})" if role else user.full_name


# ── Request / Response Schemas ─────────────────────────────────────────────────

class NextOfKinSchema(BaseModel):
    fullName: str
    idNo: Optional[str] = None
    relationship: str
    phone: str
    address: Optional[str] = None
    occupation: Optional[str] = None


class DependantSchema(BaseModel):
    fullName: str
    age: str
    relationship: str
    is_school_going: bool = False
    school_name: Optional[str] = None
    school_grade: Optional[str] = None
    occupation: Optional[str] = None


class PropertyItemSchema(BaseModel):
    description: str
    makeModel: Optional[str] = None
    serialNo: Optional[str] = None
    estValue: str


class ClientCreateRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    id_no: Optional[str] = None
    pin: Optional[str] = None
    gender: Optional[str] = "Male"
    marital_status: Optional[str] = "Single"
    occupation: Optional[str] = None
    address: Optional[str] = None
    period_years: Optional[str] = None
    accommodation: Optional[str] = "Family"
    landmark: Optional[str] = None
    residential_maps_link: Optional[str] = None
    business_maps_link: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_id: Optional[str] = None
    spouse_phone: Optional[str] = None
    spouse_occupation: Optional[str] = None
    spouse_address: Optional[str] = None
    applicant_dependants: List[DependantSchema] = []
    spouse_dependants: List[DependantSchema] = []
    dependants_count: Optional[str] = None
    dependants_ages: Optional[str] = None
    school_going_count: Optional[str] = None
    school_details: Optional[str] = None
    next_of_kin_list: List[NextOfKinSchema] = []
    business_name: Optional[str] = None
    business_type: str = "Retail"
    business_sector_custom: Optional[str] = None
    business_landmark: Optional[str] = None
    business_years: Optional[str] = None
    business_location: Optional[str] = None
    estimated_asset_value: Optional[float] = None
    guarantor_surname: Optional[str] = None
    guarantor_first_name: Optional[str] = None
    guarantor_middle_name: Optional[str] = None
    guarantor_id_no: Optional[str] = None
    guarantor_phone: Optional[str] = None
    guarantor_relationship: Optional[str] = None
    guarantor_address: Optional[str] = None
    guarantor_occupation: Optional[str] = None
    guarantor_period_known: Optional[str] = None
    properties_list: List[PropertyItemSchema] = []
    applicant_id_photo: Optional[str] = None
    applicant_passport_photo: Optional[str] = None
    business_photo: Optional[str] = None
    guarantor_id_photo: Optional[str] = None
    guarantor_passport_photo: Optional[str] = None
    applicant_signature: Optional[str] = None
    guarantor_signature: Optional[str] = None
    registration_fee: Optional[float] = None
    application_fee: Optional[float] = None
    branch_id: Optional[UUID] = None


class LoanCreateRequest(BaseModel):
    client_id: UUID
    loan_product_id: UUID
    amount: float
    sector: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[UUID] = None


class LoanActionRequest(BaseModel):
    note: Optional[str] = None


class RepaymentCreateRequest(BaseModel):
    loan_id: UUID
    amount: float
    mode: str = "Cash"
    reference: Optional[str] = None
    receipt_photo: Optional[str] = None  # base64 payment screenshot
    notes: Optional[str] = None
    date: Optional[str] = None  # ISO date string; defaults to today


# ── CLIENTS ────────────────────────────────────────────────────────────────────

@router.get("/clients")
def get_clients(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.view")
    branch_ids = _get_user_branch_ids(current_user)
    stmt = select(Client).order_by(Client.client_number.desc())
    if search:
        stmt = stmt.where(Client.name.ilike(f"%{search}%"))
    # Branch scoping: LOs and Managers see only their branch
    if branch_ids is not None:
        if branch_ids:
            stmt = stmt.where(Client.branch_id.in_(branch_ids))
        else:
            stmt = stmt.where(False)  # No branch assigned → see nothing
    clients = db.scalars(stmt).all()
    return [_serialize_client(c) for c in clients]


@router.get("/clients/{client_id}")
def get_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.view")
    client = db.scalar(select(Client).where(Client.id == client_id))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return _serialize_client(client)


@router.post("/clients", status_code=status.HTTP_201_CREATED)
def create_client(
    request: ClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.create")
    client_number = loan_service._next_client_number(db)
    client = Client(
        client_number=client_number,
        registered_by_id=current_user.id,
        **request.model_dump(),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return _serialize_client(client)


@router.put("/clients/{client_id}")
def update_client(
    client_id: UUID,
    request: ClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.update")
    client = db.scalar(select(Client).where(Client.id == client_id))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    data = request.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, list):
            setattr(client, k, [i.model_dump() if hasattr(i, "model_dump") else i for i in v])
        else:
            setattr(client, k, v)
    db.commit()
    db.refresh(client)
    return _serialize_client(client)


def _serialize_client(c: Client) -> dict:
    return {
        "id": str(c.id),
        "client_number": c.client_number,
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "id_no": c.id_no,
        "pin": c.pin,
        "gender": c.gender,
        "marital_status": c.marital_status,
        "occupation": c.occupation,
        "address": c.address,
        "period_years": c.period_years,
        "accommodation": c.accommodation,
        "landmark": c.landmark,
        "residential_maps_link": c.residential_maps_link,
        "business_maps_link": c.business_maps_link,
        "spouse_name": c.spouse_name,
        "spouse_id": c.spouse_id,
        "spouse_phone": c.spouse_phone,
        "spouse_occupation": c.spouse_occupation,
        "spouse_address": c.spouse_address,
        "applicant_dependants": c.applicant_dependants or [],
        "spouse_dependants": c.spouse_dependants or [],
        "dependants_count": c.dependants_count,
        "dependants_ages": c.dependants_ages,
        "school_going_count": c.school_going_count,
        "school_details": c.school_details,
        "next_of_kin_list": c.next_of_kin_list or [],
        "business_name": c.business_name,
        "business_type": c.business_type,
        "business_sector_custom": c.business_sector_custom,
        "business_landmark": c.business_landmark,
        "business_years": c.business_years,
        "business_location": c.business_location,
        "estimated_asset_value": (
            float(c.estimated_asset_value) if c.estimated_asset_value is not None else None
        ),
        "guarantor_surname": c.guarantor_surname,
        "guarantor_first_name": c.guarantor_first_name,
        "guarantor_middle_name": c.guarantor_middle_name,
        "guarantor_id_no": c.guarantor_id_no,
        "guarantor_phone": c.guarantor_phone,
        "guarantor_relationship": c.guarantor_relationship,
        "guarantor_address": c.guarantor_address,
        "guarantor_occupation": c.guarantor_occupation,
        "guarantor_period_known": c.guarantor_period_known,
        "properties_list": c.properties_list or [],
        "applicant_id_photo": c.applicant_id_photo,
        "applicant_passport_photo": c.applicant_passport_photo,
        "business_photo": c.business_photo,
        "guarantor_id_photo": c.guarantor_id_photo,
        "guarantor_passport_photo": c.guarantor_passport_photo,
        "applicant_signature": c.applicant_signature,
        "guarantor_signature": c.guarantor_signature,
        "registration_fee": c.registration_fee,
        "application_fee": c.application_fee,
        "branch": c.branch.name if c.branch else None,
        "branch_id": str(c.branch_id) if c.branch_id else None,
        "registered_by": c.registered_by.full_name if c.registered_by else None,
        "date_registered": c.created_at.isoformat() if c.created_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ── LOAN PRODUCTS ──────────────────────────────────────────────────────────────

@router.get("/loan-products")
def get_loan_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = db.scalars(select(LoanProduct).where(LoanProduct.is_active == True).order_by(LoanProduct.name)).all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "product_type": p.product_type.value,
            "duration_days": p.duration_days,
            "interest_rate": float(p.interest_rate),
            "penalty_rate": float(p.penalty_rate),
            "penalty_interval_days": p.penalty_interval_days,
            "max_penalty_amount": float(p.max_penalty_amount) if p.max_penalty_amount else None,
        }
        for p in products
    ]


# ── LOANS ──────────────────────────────────────────────────────────────────────

@router.get("/loans")
def get_loans(
    status_filter: Optional[str] = Query(None, alias="status"),
    client_id: Optional[UUID] = Query(None),
    branch_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.view")
    branch_ids = _get_user_branch_ids(current_user)
    stmt = (
        select(Loan)
        .options(
            joinedload(Loan.client),
            joinedload(Loan.loan_product),
            joinedload(Loan.branch),
            joinedload(Loan.submitted_by),
            joinedload(Loan.approved_by),
            joinedload(Loan.disbursed_by),
        )
        .order_by(Loan.created_at.desc())
    )
    if client_id:
        stmt = stmt.where(Loan.client_id == client_id)
    # Explicit branch filter from query param (Directors use this to drill into a branch)
    if branch_id:
        stmt = stmt.where(Loan.branch_id == branch_id)
    # Branch scoping: LOs and Managers see only their branch
    elif branch_ids is not None:
        if branch_ids:
            stmt = stmt.where(Loan.branch_id.in_(branch_ids))
        else:
            stmt = stmt.where(False)

    loans = db.scalars(stmt).unique().all()
    enriched = [_enrich_loan(loan, db) for loan in loans]

    # Apply computed status filter after enrichment
    if status_filter:
        enriched = [l for l in enriched if l["status"].lower() == status_filter.lower()]
    return enriched


@router.get("/loans/{loan_id}")
def get_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.view")
    loan = _load_loan(loan_id, db)
    result = _enrich_loan(loan, db)
    # Include installments
    installments = db.scalars(
        select(Installment).where(Installment.loan_id == loan_id).order_by(Installment.due_date)
    ).all()
    result["installments"] = [
        {
            "id": str(i.id),
            "due_date": i.due_date.date().isoformat(),
            "amount": float(i.amount),
            "status": i.status.value,
            "paid_at": i.paid_at.isoformat() if i.paid_at else None,
        }
        for i in installments
    ]
    return result


@router.get("/installments/calendar")
def get_installments_calendar(
    weeks_ahead: int = Query(8, ge=1, le=26),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns installments for active loans covering 6 months past + N weeks ahead."""
    _require_permission(db, current_user, "loans.view")
    from datetime import datetime
    from datetime import timedelta

    from app.core.time import today_nairobi
    today = today_nairobi()
    start = today - timedelta(days=180)
    end = today + timedelta(weeks=weeks_ahead)

    rows = db.scalars(
        select(Installment)
        .join(Loan, Installment.loan_id == Loan.id)
        .options(joinedload(Installment.loan).joinedload(Loan.client))
        .where(
            Loan.status == LoanStatus.DISBURSED,
            Installment.due_date >= start,
            Installment.due_date <= end,
        )
        .order_by(Installment.due_date)
    ).unique().all()

    events = []
    for i in rows:
        due = i.due_date.date() if isinstance(i.due_date, datetime) else i.due_date
        is_overdue = due < today and i.status.value.lower() != "paid"
        events.append({
            "id": str(i.id),
            "loan_id": str(i.loan_id),
            "loan_number": i.loan.loan_number if i.loan else "",
            "client": i.loan.client.name if (i.loan and i.loan.client) else "",
            "client_phone": i.loan.client.phone if (i.loan and i.loan.client) else "",
            "due_date": due.isoformat(),
            "amount": float(i.amount),
            "status": i.status.value,
            "is_overdue": is_overdue,
            "is_today": due == today,
            "days_overdue": (today - due).days if is_overdue else 0,
        })

    return {"period": {"from": start.isoformat(), "to": end.isoformat()}, "total": len(events), "events": events}


@router.post("/loans", status_code=status.HTTP_201_CREATED)
def create_loan(
    request: LoanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.create")

    client = db.scalar(select(Client).where(Client.id == request.client_id))
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    product = db.scalar(select(LoanProduct).where(LoanProduct.id == request.loan_product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Loan product not found")

    amount = Decimal(str(request.amount))
    is_existing = fee_service.has_loan_history(db, request.client_id)
    try:
        fee = loan_service.calculate_application_fee(amount, is_existing)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    paid_fee = fee_service.get_verified_fee(db, request.client_id, fee)
    if paid_fee is None:
        raise HTTPException(
            status_code=400,
            detail=f"Application fee of KES {fee} must be paid and verified before applying",
        )

    loan = Loan(
        loan_number=loan_service._next_loan_number(db),
        client_id=request.client_id,
        loan_product_id=request.loan_product_id,
        branch_id=request.branch_id or client.branch_id,
        amount=amount,
        application_fee=fee,
        duration_days=product.duration_days,
        sector=request.sector,
        notes=request.notes,
        status=LoanStatus.PENDING,
        submitted_by_id=current_user.id,
        date_submitted=datetime.now(timezone.utc),
    )
    db.add(loan)
    db.flush()
    paid_fee.loan_id = loan.id
    db.commit()
    db.refresh(loan)
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/approve")
def approve_loan(
    loan_id: UUID,
    request: LoanActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.approve")
    loan = _load_loan(loan_id, db)
    try:
        loan_service.approve_loan(db, loan, current_user.id, request.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/reject")
def reject_loan(
    loan_id: UUID,
    request: LoanActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.approve")
    loan = _load_loan(loan_id, db)
    try:
        loan_service.reject_loan(db, loan, current_user.id, request.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/disburse")
def disburse_loan(
    loan_id: UUID,
    request: LoanActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.disburse")
    loan = _load_loan(loan_id, db)
    if not loan.loan_product:
        raise HTTPException(status_code=400, detail="Loan has no product assigned")
    try:
        loan_service.disburse_loan(db, loan, current_user.id, loan.loan_product)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/close")
def close_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.disburse")
    loan = _load_loan(loan_id, db)
    outstanding = loan_service.get_outstanding(db, loan)
    if outstanding > Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot close: KES {outstanding:,.2f} still outstanding",
        )
    try:
        loan_service.close_loan(db, loan, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return _enrich_loan(loan, db)


def _load_loan(loan_id: UUID, db: Session) -> Loan:
    loan = db.scalar(
        select(Loan)
        .options(
            joinedload(Loan.client),
            joinedload(Loan.loan_product),
            joinedload(Loan.branch),
            joinedload(Loan.submitted_by),
            joinedload(Loan.approved_by),
            joinedload(Loan.disbursed_by),
        )
        .where(Loan.id == loan_id)
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


# ── REPAYMENTS ─────────────────────────────────────────────────────────────────

@router.get("/repayments")
def get_repayments(
    loan_id: Optional[UUID] = Query(None),
    verified: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "repayments.view")
    branch_ids = _get_user_branch_ids(current_user)
    stmt = (
        select(Repayment)
        .options(
            joinedload(Repayment.loan),
            joinedload(Repayment.client),
            joinedload(Repayment.recorded_by),
            joinedload(Repayment.verified_by),
        )
        .order_by(Repayment.date.desc())
    )
    if loan_id:
        stmt = stmt.where(Repayment.loan_id == loan_id)
    if verified is not None:
        stmt = stmt.where(Repayment.verified == verified)
    # Branch scoping via the loan's branch
    if branch_ids is not None:
        if branch_ids:
            stmt = stmt.join(Loan, Repayment.loan_id == Loan.id).where(
                Loan.branch_id.in_(branch_ids)
            )
        else:
            stmt = stmt.where(False)

    repayments = db.scalars(stmt).unique().all()
    return [_serialize_repayment(r) for r in repayments]


@router.post("/repayments", status_code=status.HTTP_201_CREATED)
def create_repayment(
    request: RepaymentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "repayments.record")
    loan = db.scalar(select(Loan).options(joinedload(Loan.client)).where(Loan.id == request.loan_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != LoanStatus.DISBURSED:
        raise HTTPException(status_code=400, detail="Can only record repayments on disbursed loans")

    # Parse payment mode
    mode_map = {
        "cash": PaymentMode.CASH,
        "mpesa": PaymentMode.MPESA,
        "m-pesa": PaymentMode.MPESA,
        "bank": PaymentMode.BANK_TRANSFER,
        "banktransfer": PaymentMode.BANK_TRANSFER,
        "cheque": PaymentMode.CHEQUE,
    }
    pay_mode = mode_map.get(request.mode.lower().replace(" ", ""), PaymentMode.CASH)

    payment_date = (
        datetime.fromisoformat(request.date).replace(tzinfo=timezone.utc)
        if request.date
        else datetime.now(timezone.utc)
    )

    repayment = Repayment(
        loan_id=loan.id,
        client_id=loan.client_id,
        amount=Decimal(str(request.amount)),
        date=payment_date,
        mode=pay_mode,
        reference=request.reference,
        receipt_photo=request.receipt_photo,
        notes=request.notes,
        recorded_by_id=current_user.id,
        verified=False,
    )
    db.add(repayment)
    db.commit()
    db.refresh(repayment)
    return _serialize_repayment(repayment)


@router.patch("/repayments/{repayment_id}/verify")
def verify_repayment(
    repayment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "repayments.verify")
    repayment = db.scalar(
        select(Repayment)
        .options(joinedload(Repayment.loan), joinedload(Repayment.client), joinedload(Repayment.recorded_by), joinedload(Repayment.verified_by))
        .where(Repayment.id == repayment_id)
    )
    if not repayment:
        raise HTTPException(status_code=404, detail="Repayment not found")
    if repayment.verified:
        raise HTTPException(status_code=400, detail="Already verified")
    repayment.verified = True
    repayment.verified_by_id = current_user.id
    repayment.verified_at = datetime.now(timezone.utc)
    loan_service.mark_installments_paid(db, repayment.loan)
    db.commit()
    return _serialize_repayment(repayment)


def _serialize_repayment(r: Repayment) -> dict:
    return {
        "id": str(r.id),
        "loan_id": str(r.loan_id),
        "loan_number": r.loan.loan_number if r.loan else None,
        "client": r.client.name if r.client else "",
        "client_id": str(r.client_id),
        "client_phone": r.client.phone if r.client else None,
        "amount": float(r.amount),
        "date": r.date.date().isoformat() if r.date else None,
        "mode": r.mode.value,
        "reference": r.reference,
        "receipt_photo": r.receipt_photo,
        "notes": r.notes,
        "recorded_by": r.recorded_by.full_name if r.recorded_by else None,
        "verified": r.verified,
        "verified_by": r.verified_by.full_name if r.verified_by else None,
        "verified_at": r.verified_at.isoformat() if r.verified_at else None,
    }


# ── DASHBOARD STATS ────────────────────────────────────────────────────────────

@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_clients = db.scalar(select(func.count()).select_from(Client)) or 0
    total_loans = db.scalar(select(func.count()).select_from(Loan)) or 0
    active_loans = db.scalar(select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.DISBURSED)) or 0
    pending_loans = db.scalar(select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.PENDING)) or 0

    total_disbursed = db.scalar(
        select(func.coalesce(func.sum(Loan.amount), 0)).where(Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]))
    ) or Decimal("0")

    total_collected = db.scalar(
        select(func.coalesce(func.sum(Repayment.amount), 0)).where(Repayment.verified == True)
    ) or Decimal("0")

    unverified_repayments = db.scalar(
        select(func.count()).select_from(Repayment).where(Repayment.verified == False)
    ) or 0

    fee_income = db.scalar(
        select(func.coalesce(func.sum(FeePayment.amount), 0)).where(FeePayment.verified == True)
    ) or Decimal("0")

    return {
        "total_clients": total_clients,
        "total_loans": total_loans,
        "active_loans": active_loans,
        "pending_loans": pending_loans,
        "total_disbursed": float(total_disbursed),
        "total_collected": float(total_collected),
        "unverified_repayments": unverified_repayments,
        "fee_income": float(fee_income),
    }
