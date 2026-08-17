"""
Search Router — Faraja Solution Loans

GET /search?q= — global search across clients and loans (branch-scoped).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.db.session import get_db
from app.models.client import Client
from app.models.loan import Loan
from app.models.user import User

router = APIRouter()


def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


@router.get("/search")
def global_search(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search clients (name/phone/ID) and loans (loan number), branch-scoped."""
    _require_permission(db, current_user, "dashboard.view")

    term = (q or "").strip()
    if len(term) < 2:
        return []

    pattern = f"%{term}%"
    branch_ids = get_user_branch_ids(db, current_user)
    results: list[dict] = []

    # ── Clients ──
    client_stmt = (
        select(Client)
        .where(
            or_(
                Client.name.ilike(pattern),
                Client.phone.ilike(pattern),
                Client.id_no.ilike(pattern),
            )
        )
        .order_by(Client.name)
        .limit(5)
    )
    if branch_ids is not None:
        client_stmt = client_stmt.where(
            Client.branch_id.in_(branch_ids) if branch_ids else False
        )
    for client in db.scalars(client_stmt):
        results.append(
            {
                "type": "client",
                "id": str(client.id),
                "title": client.name,
                "subtitle": f"{client.client_number} · {client.phone or 'No phone'}",
            }
        )

    # ── Loans ──
    loan_stmt = (
        select(Loan)
        .options(joinedload(Loan.client))
        .where(Loan.loan_number.ilike(pattern))
        .order_by(Loan.loan_number.desc())
        .limit(5)
    )
    if branch_ids is not None:
        loan_stmt = loan_stmt.where(Loan.branch_id.in_(branch_ids) if branch_ids else False)
    for loan in db.scalars(loan_stmt):
        results.append(
            {
                "type": "loan",
                "id": str(loan.id),
                "title": loan.loan_number,
                "subtitle": (
                    f"{loan.client.name if loan.client else 'Client'} · "
                    f"KES {float(loan.amount):,.0f}"
                ),
            }
        )

    return results
