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
from typing import Any, List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.core.time import as_nairobi_date
from app.db.session import get_db
from app.models.branch import Branch
from app.models.client import Client
from app.models.enums import LoanStatus, PaymentMode
from app.models.fee_payment import FeePayment
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.loan_product import LoanProduct
from app.models.repayment import Repayment
from app.models.user import User
from app.schemas.loan_products import LoanQuoteResponse
from app.services import audit_service, email_service, fee_service, loan_service, pdf_service

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────


def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


# ── Branch scoping ──────────────────────────────────────────────────────────────


def _resolve_branch_filter(db: Session, user: User, branch_id: UUID | None) -> list | None:
    """Resolve an explicit branch_id against the user's scope.

    Returns None = unrestricted, [] = see nothing, list = allowed branch ids.
    Raises 403 when the explicit branch is outside the user's scope.
    """
    branch_ids = get_user_branch_ids(db, user)
    if branch_id is not None:
        if branch_ids is not None and branch_id not in branch_ids:
            raise HTTPException(status_code=403, detail="Not allowed to view that branch.")
        return [branch_id]
    return branch_ids


def _scoped_expr(column, scope: list | None):
    """SQLAlchemy condition for a resolved branch scope (None = no filter)."""
    if scope is None:
        return None
    return column.in_(scope) if scope else False


def _assert_branch_visible(db: Session, user: User, branch_id: UUID | None) -> None:
    """403 when a scoped user cannot access the branch a record belongs to."""
    branch_ids = get_user_branch_ids(db, user)
    if branch_ids is not None and (branch_id is None or branch_id not in branch_ids):
        raise HTTPException(status_code=403, detail="Not allowed to access that branch.")


def _resolve_branch_assignment(
    db: Session, user: User, branch_id: UUID | None, *, fallback: UUID | None = None
) -> UUID:
    """Resolve the branch a new record gets assigned to, enforcing user scope.

    Scoped users (LO/Manager): default to their first branch; an explicit
    branch outside their scope is a 403. Unrestricted users: an explicit
    branch must exist (400); missing branch falls back or is a 400.
    """
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
        if fallback is not None:
            return fallback
        raise HTTPException(status_code=400, detail="branch_id is required.")
    branch = db.scalar(select(Branch).where(Branch.id == branch_id))
    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found.")
    return branch_id


# ── CLIENTS ────────────────────────────────────────────────────────────────────


def _enrich_loan(loan: Loan, db: Session) -> dict[str, Any]:
    outstanding = loan_service.get_outstanding(db, loan)
    computed_status = loan_service.get_computed_loan_status(loan, outstanding)

    penalty_info = {"days_overdue": 0, "penalty": Decimal("0")}
    if loan.loan_product and loan.status == LoanStatus.DISBURSED and loan.due_date:
        penalty_info = loan_service.calculate_penalty(
            outstanding,
            loan.due_date,
            loan.loan_product.penalty_rate,
            loan.loan_product.penalty_interval_days,
            loan.loan_product.max_penalty_amount,
        )

    due_date_display = as_nairobi_date(loan.due_date)
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
        "status_override": loan.status_override,
        "status_override_by": _user_str(loan.status_override_by),
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
        "due_date": due_date_display.isoformat() if due_date_display else None,
        "outstanding": float(outstanding),
        "amount_repaid": float(loan.total_repayable - outstanding)
        if loan.status == LoanStatus.DISBURSED
        else 0.0,
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


class LoanNoteRequest(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class LoanStatusOverrideRequest(BaseModel):
    status_override: Optional[str] = None


# Manual statuses a Manager/Director may set on a disbursed loan.
# "Paid" is excluded on purpose: fully repaid loans derive it automatically
# and an override could otherwise hide outstanding debt.
_STATUS_OVERRIDES = {"Defaulter", "Past Maturity", "Arrears", "Performing", "Almost Due", "Due"}


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
    branch_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.view")
    scope = _resolve_branch_filter(db, current_user, branch_id)
    stmt = select(Client).order_by(Client.client_number.desc())
    if search:
        stmt = stmt.where(Client.name.ilike(f"%{search}%"))
    # Branch scoping: LOs and Managers see only their branch(es)
    cond = _scoped_expr(Client.branch_id, scope)
    if cond is not None:
        stmt = stmt.where(cond)
    clients = db.scalars(stmt).all()
    return [_serialize_client(c, include_media=False) for c in clients]


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
    _assert_branch_visible(db, current_user, client.branch_id)
    return _serialize_client(client)


@router.get("/clients/{client_id}/pdf")
def download_client_pdf(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _require_permission(db, current_user, "clients.view")
    client = db.scalar(
        select(Client)
        .options(joinedload(Client.loans))
        .where(Client.id == client_id)
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    _assert_branch_visible(db, current_user, client.branch_id)
    pdf = pdf_service.build_client_pdf(client, list(client.loans))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="client-{client.client_number}.pdf"'},
    )


@router.post("/clients", status_code=status.HTTP_201_CREATED)
def create_client(
    request: ClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "clients.create")
    required_kyc_images = (
        "applicant_id_photo",
        "applicant_passport_photo",
        "guarantor_id_photo",
        "guarantor_passport_photo",
        "applicant_signature",
        "guarantor_signature",
    )
    missing = next((f for f in required_kyc_images if not getattr(request, f)), None)
    if missing:
        raise HTTPException(status_code=400, detail=f"{missing.replace('_', ' ')} is required")
    client_number = loan_service._next_client_number(db)
    data = request.model_dump()
    data["branch_id"] = _resolve_branch_assignment(db, current_user, request.branch_id)
    client = Client(
        client_number=client_number,
        registered_by_id=current_user.id,
        **data,
    )
    db.add(client)
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "client.create", "client",
        client.id, branch_id=client.branch_id,
    )
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
    _assert_branch_visible(db, current_user, client.branch_id)
    data = request.model_dump(exclude_unset=True)
    if "branch_id" in data:
        data["branch_id"] = _resolve_branch_assignment(db, current_user, data["branch_id"])
    for k, v in data.items():
        if isinstance(v, list):
            setattr(client, k, [i.model_dump() if hasattr(i, "model_dump") else i for i in v])
        else:
            setattr(client, k, v)
    db.commit()
    db.refresh(client)
    return _serialize_client(client)


def _serialize_client(c: Client, include_media: bool = True) -> dict[str, Any]:
    data = {
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
    if not include_media:
        for key in (
            "applicant_id_photo",
            "applicant_passport_photo",
            "business_photo",
            "guarantor_id_photo",
            "guarantor_passport_photo",
            "applicant_signature",
            "guarantor_signature",
        ):
            data[key] = None
    return data


# ── LOAN PRODUCTS ──────────────────────────────────────────────────────────────


@router.get("/loan-products")
def get_loan_products(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_permission(db, current_user, "loans.view")
    products = db.scalars(
        select(LoanProduct).where(LoanProduct.is_active == True).order_by(LoanProduct.name)
    ).all()
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


@router.get("/loan-products/{product_id}/quote", response_model=LoanQuoteResponse)
def quote_loan_estimate(
    product_id: UUID,
    amount: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.view")
    product = db.get(LoanProduct, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan product not found")
    try:
        return loan_service.quote_loan(product, Decimal(str(amount)))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


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
    scope = _resolve_branch_filter(db, current_user, branch_id)
    stmt = (
        select(Loan)
        .options(
            joinedload(Loan.client),
            joinedload(Loan.loan_product),
            joinedload(Loan.branch),
            joinedload(Loan.submitted_by),
            joinedload(Loan.approved_by),
            joinedload(Loan.disbursed_by),
            joinedload(Loan.status_override_by),
        )
        .order_by(Loan.created_at.desc())
    )
    if client_id:
        stmt = stmt.where(Loan.client_id == client_id)
    # Branch scoping: explicit branch filter must stay inside the user's scope
    cond = _scoped_expr(Loan.branch_id, scope)
    if cond is not None:
        stmt = stmt.where(cond)

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
    _assert_branch_visible(db, current_user, loan.branch_id)
    result = _enrich_loan(loan, db)
    # Include installments
    installments = db.scalars(
        select(Installment).where(Installment.loan_id == loan_id).order_by(Installment.due_date)
    ).all()
    result["installments"] = [
        {
            "id": str(i.id),
            "due_date": (as_nairobi_date(i.due_date).isoformat() if i.due_date else None),
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
    from datetime import timedelta

    from app.core.time import as_nairobi_date, today_nairobi, utc_instant

    today = today_nairobi()
    start = utc_instant(today - timedelta(days=180))
    end = utc_instant(today + timedelta(weeks=weeks_ahead, days=1))

    rows = (
        db.scalars(
            select(Installment)
            .join(Loan, Installment.loan_id == Loan.id)
            .options(joinedload(Installment.loan).joinedload(Loan.client))
            .where(
                Loan.status == LoanStatus.DISBURSED,
                Installment.due_date >= start,
                Installment.due_date < end,
            )
            .order_by(Installment.due_date)
        )
        .unique()
        .all()
    )

    events = []
    for i in rows:
        due = as_nairobi_date(i.due_date)
        is_overdue = due is not None and due < today and i.status.value.lower() != "paid"
        events.append(
            {
                "id": str(i.id),
                "loan_id": str(i.loan_id),
                "loan_number": i.loan.loan_number if i.loan else "",
                "client": i.loan.client.name if (i.loan and i.loan.client) else "",
                "client_phone": i.loan.client.phone if (i.loan and i.loan.client) else "",
                "due_date": due.isoformat() if due else "",
                "amount": float(i.amount),
                "status": i.status.value,
                "is_overdue": is_overdue,
                "is_today": due == today,
                "days_overdue": (today - due).days if is_overdue and due else 0,
            }
        )

    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "total": len(events),
        "events": events,
    }


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
    _assert_branch_visible(db, current_user, client.branch_id)

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
        branch_id=_resolve_branch_assignment(
            db, current_user, request.branch_id, fallback=client.branch_id
        ),
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
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.create", "loan",
        loan.id, branch_id=loan.branch_id,
    )
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
    _assert_branch_visible(db, current_user, loan.branch_id)
    try:
        loan_service.approve_loan(db, loan, current_user.id, request.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.approve", "loan",
        loan.id, branch_id=loan.branch_id, meta={"note": request.note} if request.note else None,
    )
    db.commit()
    if loan.submitted_by and loan.submitted_by.email:
        try:
            email_service.send_loan_approved_email(
                loan.submitted_by.email, loan.loan_number, loan.client.name
            )
        except Exception:
            pass
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
    _assert_branch_visible(db, current_user, loan.branch_id)
    try:
        loan_service.reject_loan(db, loan, current_user.id, request.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.reject", "loan",
        loan.id, branch_id=loan.branch_id, meta={"reason": request.note} if request.note else None,
    )
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
    _assert_branch_visible(db, current_user, loan.branch_id)
    if not loan.loan_product:
        raise HTTPException(status_code=400, detail="Loan has no product assigned")
    try:
        loan_service.disburse_loan(db, loan, current_user.id, loan.loan_product)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.disburse", "loan",
        loan.id, branch_id=loan.branch_id,
    )
    db.commit()
    if loan.submitted_by and loan.submitted_by.email:
        try:
            email_service.send_loan_disbursed_email(
                loan.submitted_by.email, loan.loan_number, loan.client.name
            )
        except Exception:
            pass
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/close")
def close_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "loans.disburse")
    loan = _load_loan(loan_id, db)
    _assert_branch_visible(db, current_user, loan.branch_id)
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
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.close", "loan",
        loan.id, branch_id=loan.branch_id,
    )
    db.commit()
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/notes")
def add_loan_note(
    loan_id: UUID,
    request: LoanNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_permission(db, current_user, "loans.update")
    loan = _load_loan(loan_id, db)
    _assert_branch_visible(db, current_user, loan.branch_id)
    now_nairobi = datetime.now(ZoneInfo(settings.DEFAULT_TIMEZONE))
    entry = f"[{now_nairobi:%d %b %Y %H:%M} — {current_user.full_name}] {request.note.strip()}"
    loan.notes = f"{loan.notes}\n{entry}" if loan.notes else entry
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.note", "loan",
        loan.id, branch_id=loan.branch_id, meta={"note": request.note.strip()},
    )
    db.commit()
    return _enrich_loan(loan, db)


@router.patch("/loans/{loan_id}/status")
def set_loan_status_override(
    loan_id: UUID,
    request: LoanStatusOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_permission(db, current_user, "loans.update")
    loan = _load_loan(loan_id, db)
    _assert_branch_visible(db, current_user, loan.branch_id)
    if loan.status != LoanStatus.DISBURSED:
        raise HTTPException(
            status_code=400,
            detail="Status override only applies to disbursed loans",
        )
    value = request.status_override
    if value is not None and value not in _STATUS_OVERRIDES:
        allowed = ", ".join(sorted(_STATUS_OVERRIDES))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status override: {value}. Allowed: {allowed}",
        )
    loan.status_override = value
    loan.status_override_by_id = current_user.id if value else None
    loan.status_override_at = datetime.now(timezone.utc) if value else None
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "loan.status_override", "loan",
        loan.id, branch_id=loan.branch_id, meta={"status_override": value} if value else None,
    )
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
            joinedload(Loan.status_override_by),
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
    branch_id: Optional[UUID] = Query(None),
    verified: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "repayments.view")
    scope = _resolve_branch_filter(db, current_user, branch_id)
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
    cond = _scoped_expr(Loan.branch_id, scope)
    if cond is not None:
        stmt = stmt.join(Loan, Repayment.loan_id == Loan.id).where(cond)

    repayments = db.scalars(stmt).unique().all()
    return [_serialize_repayment(r) for r in repayments]


@router.post("/repayments", status_code=status.HTTP_201_CREATED)
def create_repayment(
    request: RepaymentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "repayments.record")
    loan = db.scalar(
        select(Loan).options(joinedload(Loan.client)).where(Loan.id == request.loan_id)
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    _assert_branch_visible(db, current_user, loan.branch_id)
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
    db.flush()
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "repayment.record", "repayment",
        repayment.id, branch_id=loan.branch_id,
        meta={"amount": str(repayment.amount), "mode": pay_mode.value},
    )
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
        .options(
            joinedload(Repayment.loan),
            joinedload(Repayment.client),
            joinedload(Repayment.recorded_by),
            joinedload(Repayment.verified_by),
        )
        .where(Repayment.id == repayment_id)
    )
    if not repayment:
        raise HTTPException(status_code=404, detail="Repayment not found")
    _assert_branch_visible(db, current_user, repayment.loan.branch_id)
    if repayment.verified:
        raise HTTPException(status_code=400, detail="Already verified")
    repayment.verified = True
    repayment.verified_by_id = current_user.id
    audit_service.write_audit_log(
        db, current_user.id, current_user.full_name, "repayment.verify", "repayment",
        repayment.id, branch_id=repayment.loan.branch_id,
        meta={"amount": str(repayment.amount)},
    )
    repayment.verified_at = datetime.now(timezone.utc)
    loan_service.mark_installments_paid(db, repayment.loan)
    db.commit()
    return _serialize_repayment(repayment)


def _serialize_repayment(r: Repayment) -> dict[str, Any]:
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
    branch_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_permission(db, current_user, "dashboard.view")

    scope = _resolve_branch_filter(db, current_user, branch_id)
    client_cond = _scoped_expr(Client.branch_id, scope)
    loan_cond = _scoped_expr(Loan.branch_id, scope)

    # ── Headline counts ──
    stmt = select(func.count()).select_from(Client)
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    total_clients = db.scalar(stmt) or 0

    stmt = select(func.count()).select_from(Loan)
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    total_loans = db.scalar(stmt) or 0

    stmt = select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.DISBURSED)
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    active_loans = db.scalar(stmt) or 0

    stmt = select(func.count()).select_from(Loan).where(Loan.status == LoanStatus.PENDING)
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    pending_loans = db.scalar(stmt) or 0

    stmt = select(func.coalesce(func.sum(Loan.amount), 0)).where(
        Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED])
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    total_disbursed = db.scalar(stmt) or Decimal("0")

    stmt = (
        select(func.coalesce(func.sum(Repayment.amount), 0))
        .join(Loan, Repayment.loan_id == Loan.id)
        .where(Repayment.verified == True)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    total_collected = db.scalar(stmt) or Decimal("0")

    stmt = (
        select(func.count())
        .select_from(Repayment)
        .join(Loan, Repayment.loan_id == Loan.id)
        .where(Repayment.verified == False)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    unverified_repayments = db.scalar(stmt) or 0

    stmt = (
        select(func.coalesce(func.sum(FeePayment.amount), 0))
        .join(Client, FeePayment.client_id == Client.id)
        .where(FeePayment.verified == True)
    )
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    fee_income = db.scalar(stmt) or Decimal("0")

    # ── Monthly series (last 6 months, including current) ──
    now = datetime.now(timezone.utc)
    cur_idx = now.year * 12 + (now.month - 1)
    months = [f"{idx // 12:04d}-{idx % 12 + 1:02d}" for idx in range(cur_idx - 5, cur_idx + 1)]
    series_start = datetime.strptime(months[0] + "-01", "%Y-%m-%d")

    def _month_map(column, amount_column, stmt_extra, start, joins=None, branch_column=None):
        month_expr = func.to_char(column, "YYYY-MM")
        stmt = select(month_expr, func.coalesce(func.sum(amount_column), 0))
        if joins is not None:
            stmt = stmt.join(*joins)
        conds = [stmt_extra, column >= start]
        if scope is not None:
            conds.append(branch_column.in_(scope) if scope else False)
        stmt = stmt.where(*conds).group_by(month_expr)
        rows = db.execute(stmt).all()
        return {m: float(v) for m, v in rows}

    disbursed_rows = _month_map(
        Loan.disbursed_date,
        Loan.amount,
        Loan.status.in_([LoanStatus.DISBURSED, LoanStatus.CLOSED]),
        series_start,
        branch_column=Loan.branch_id,
    )
    collected_rows = _month_map(
        Repayment.date,
        Repayment.amount,
        Repayment.verified == True,
        series_start,
        joins=(Loan, Repayment.loan_id == Loan.id),
        branch_column=Loan.branch_id,
    )
    fee_rows = _month_map(
        FeePayment.created_at,
        FeePayment.amount,
        FeePayment.verified == True,
        series_start,
        joins=(Client, FeePayment.client_id == Client.id),
        branch_column=Client.branch_id,
    )

    monthly_series = [
        {
            "month": m,
            "disbursed": disbursed_rows.get(m, 0),
            "collected": collected_rows.get(m, 0),
            "fees": fee_rows.get(m, 0),
        }
        for m in months
    ]

    disbursed_month = disbursed_rows.get(months[-1], 0)
    collected_month = collected_rows.get(months[-1], 0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = datetime.strptime(months[-2] + "-01", "%Y-%m-%d")
    stmt = select(func.count()).select_from(Client).where(Client.created_at >= month_start)
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    clients_month = db.scalar(stmt) or 0
    stmt = (
        select(func.count())
        .select_from(Client)
        .where(Client.created_at >= prev_month_start, Client.created_at < month_start)
    )
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    clients_prev_month = db.scalar(stmt) or 0

    def _pct(cur: float, prev: float) -> float | None:
        if prev <= 0:
            return None
        return round((cur - prev) / prev * 100, 1)

    changes = {
        "clients": _pct(clients_month, clients_prev_month),
        "disbursed": _pct(disbursed_month, disbursed_rows.get(months[-2], 0)),
        "collected": _pct(collected_month, collected_rows.get(months[-2], 0)),
    }

    # ── Portfolio quality (disbursed loans, schedule-aware) ──
    stmt = select(Loan).where(Loan.status == LoanStatus.DISBURSED)
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    loans = db.scalars(stmt).all()
    stmt = (
        select(Repayment.loan_id, func.coalesce(func.sum(Repayment.amount), 0))
        .join(Loan, Repayment.loan_id == Loan.id)
        .where(Repayment.verified == True)
        .group_by(Repayment.loan_id)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    repaid_map = {loan_id: float(amount) for loan_id, amount in db.execute(stmt).all()}

    arrears_count = 0
    arrears_amount = 0.0
    overdue_count = 0
    portfolio_outstanding = 0.0
    for loan in loans:
        outstanding = max(float(loan.total_repayable) - repaid_map.get(loan.id, 0.0), 0.0)
        portfolio_outstanding += outstanding
        status = loan_service.get_computed_loan_status(loan, Decimal(str(outstanding)))
        if status in ("Arrears", "Past Maturity", "Defaulter"):
            arrears_count += 1
            arrears_amount += outstanding
        if status in ("Past Maturity", "Defaulter"):
            overdue_count += 1

    # ── Recent activity feed (latest 8 across modules) ──
    stmt = (
        select(Repayment, Loan.loan_number, Client.name)
        .join(Loan, Repayment.loan_id == Loan.id)
        .join(Client, Repayment.client_id == Client.id)
        .order_by(Repayment.date.desc())
        .limit(8)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    recent_repayments = db.execute(stmt).all()
    stmt = (
        select(Loan, Client.name)
        .join(Client, Loan.client_id == Client.id)
        .where(Loan.date_submitted.isnot(None))
        .order_by(Loan.date_submitted.desc())
        .limit(8)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    recent_loans = db.execute(stmt).all()
    stmt = (
        select(Loan, Client.name)
        .join(Client, Loan.client_id == Client.id)
        .where(Loan.date_approved.isnot(None))
        .order_by(Loan.date_approved.desc())
        .limit(8)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    recent_approvals = db.execute(stmt).all()
    stmt = (
        select(Loan, Client.name)
        .join(Client, Loan.client_id == Client.id)
        .where(Loan.disbursed_date.isnot(None))
        .order_by(Loan.disbursed_date.desc())
        .limit(8)
    )
    if loan_cond is not None:
        stmt = stmt.where(loan_cond)
    recent_disbursements = db.execute(stmt).all()
    stmt = select(Client).order_by(Client.created_at.desc()).limit(8)
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    recent_clients = db.scalars(stmt).all()
    stmt = (
        select(FeePayment, Client.name)
        .join(Client, FeePayment.client_id == Client.id)
        .order_by(FeePayment.created_at.desc())
        .limit(8)
    )
    if client_cond is not None:
        stmt = stmt.where(client_cond)
    recent_fees = db.execute(stmt).all()

    events: list[dict] = []
    for r, loan_number, client_name in recent_repayments:
        events.append(
            {
                "type": "repayment",
                "title": f"Payment of KES {float(r.amount):,.0f} recorded",
                "description": f"{client_name} · {loan_number} — {'verified' if r.verified else 'pending verification'}",
                "time": r.date.isoformat(),
            }
        )
    for loan, client_name in recent_loans:
        events.append(
            {
                "type": "loan",
                "title": f"Loan application {loan.loan_number}",
                "description": f"{client_name} · KES {float(loan.amount):,.0f}",
                "time": loan.date_submitted.isoformat(),
            }
        )
    for loan, client_name in recent_approvals:
        events.append(
            {
                "type": "approval",
                "title": f"Loan {loan.loan_number} approved",
                "description": f"{client_name} · KES {float(loan.amount):,.0f}",
                "time": loan.date_approved.isoformat(),
            }
        )
    for loan, client_name in recent_disbursements:
        events.append(
            {
                "type": "disbursement",
                "title": f"Loan {loan.loan_number} disbursed",
                "description": f"{client_name} · KES {float(loan.amount):,.0f}",
                "time": loan.disbursed_date.isoformat(),
            }
        )
    for client in recent_clients:
        events.append(
            {
                "type": "client",
                "title": "New client registered",
                "description": client.name,
                "time": client.created_at.isoformat(),
            }
        )
    for fee, client_name in recent_fees:
        events.append(
            {
                "type": "fee",
                "title": f"Application fee KES {float(fee.amount):,.0f}",
                "description": f"{client_name} — {'verified' if fee.verified else 'pending verification'}",
                "time": fee.created_at.isoformat(),
            }
        )

    events.sort(key=lambda e: e["time"], reverse=True)
    recent_activity = events[:8]

    return {
        "total_clients": total_clients,
        "total_loans": total_loans,
        "active_loans": active_loans,
        "pending_loans": pending_loans,
        "total_disbursed": float(total_disbursed),
        "total_collected": float(total_collected),
        "unverified_repayments": unverified_repayments,
        "fee_income": float(fee_income),
        "portfolio_outstanding": portfolio_outstanding,
        "disbursed_month": disbursed_month,
        "collected_month": collected_month,
        "clients_month": clients_month,
        "quality": {
            "arrears_count": arrears_count,
            "arrears_amount": arrears_amount,
            "overdue_count": overdue_count,
        },
        "changes": changes,
        "monthly_series": monthly_series,
        "recent_activity": recent_activity,
    }
