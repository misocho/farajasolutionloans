"""Audit trail service — append-only financial event writes (E2)."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def write_audit_log(
    db: Session,
    actor_id: UUID,
    actor_name: str,
    action: str,
    entity: str,
    entity_id: UUID | str,
    branch_id: UUID | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """Append an audit event to the current transaction (caller commits)."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            actor_name=actor_name,
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            branch_id=branch_id,
            meta=meta,
        )
    )
