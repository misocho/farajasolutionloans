"""
Audit Router — Faraja Solution Loans (E2)

GET /audit-logs — audit trail (audit.view), branch-scoped for non-view_all users
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter()


# ── Permission helper ─────────────────────────────────────────────────────────

def _require_permission(db: Session, user: User, perm: str) -> None:
    user_perms = get_user_permissions(db, user)
    if perm not in user_perms:
        raise HTTPException(status_code=403, detail=f"Permission '{perm}' required.")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def list_audit_logs(
    action: str | None = Query(None),
    entity: str | None = Query(None),
    branch_id: UUID | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_permission(db, current_user, "audit.view")
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= date_to)

    branch_ids = get_user_branch_ids(db, current_user)
    if branch_id is not None:
        if branch_ids is not None and branch_id not in branch_ids:
            raise HTTPException(status_code=403, detail="Not allowed to view that branch.")
        stmt = stmt.where(AuditLog.branch_id == branch_id)
    elif branch_ids is not None:
        stmt = stmt.where(
            or_(AuditLog.branch_id.in_(branch_ids), AuditLog.branch_id.is_(None))
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    logs = db.scalars(stmt.offset(offset).limit(limit)).all()
    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "actor_name": log.actor_name,
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "branch_id": log.branch_id,
                "meta": log.meta,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }
