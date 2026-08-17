"""
Notifications Router — Faraja Solution Loans

Generates real-time in-app notifications based on live database state:
  - Today's dues
  - Tomorrow's dues
  - Almost-due loans (2 days)
  - Loans in arrears
  - Unverified repayments pending manager action
  - Loans pending approval

GET /notifications           — fetch all notifications for current user
PATCH /notifications/read-all — mark all read (clears badge count)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.core.time import as_nairobi_date, today_nairobi, utc_instant
from app.db.session import get_db
from app.models.enums import LoanStatus
from app.models.loan import Loan
from app.models.notification_pref import DEFAULT_PREFS, NotificationPref
from app.models.notification_read import NotificationRead
from app.models.repayment import Repayment
from app.models.user import User
from app.services.loan_service import get_outstanding
from app.schemas.notifications import (
    NotificationPrefs,
    NotificationPrefsResponse,
    UpdateNotificationPrefsRequest,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_prefs(db: Session, user_id: UUID) -> dict[str, bool]:
    prefs = dict(DEFAULT_PREFS)
    row = db.get(NotificationPref, user_id)
    if row is not None and row.prefs:
        prefs.update(row.prefs)
    return prefs


def _priority(days_overdue: int) -> str:
    if days_overdue > 14:
        return "critical"
    if days_overdue > 7:
        return "high"
    if days_overdue > 0:
        return "medium"
    return "low"


def _build_notifications(db: Session, current_user: User) -> list[dict]:
    """Compute all live notifications for the current user (no read flags)."""
    today = today_nairobi()
    tomorrow = today + timedelta(days=1)
    day_after_tomorrow = today + timedelta(days=2)
    now = datetime.now(UTC)

    notifications = []
    prefs = _get_prefs(db, current_user.id)

    # Branch scope: None = unrestricted roles (see all); list = scoped to those branches
    branch_ids = get_user_branch_ids(current_user)
    scoped = [] if branch_ids is None else [Loan.branch_id.in_(branch_ids)]

    # 1. Loans due today
    if prefs.get("due_today", True):
        due_today = (
            db.scalars(
                select(Loan)
                .options(joinedload(Loan.client))
                .where(
                    Loan.status == LoanStatus.DISBURSED,
                    Loan.due_date >= utc_instant(today),
                    Loan.due_date < utc_instant(tomorrow),
                    *scoped,
                )
            )
            .unique()
            .all()
        )

        for loan in due_today:
            outstanding = get_outstanding(db, loan)
            if outstanding <= 0:
                continue  # Fully repaid but not yet closed — not actually due
            notifications.append(
                {
                    "id": f"due-today-{loan.id}",
                    "type": "due_today",
                    "priority": "critical",
                    "title": "Loan Due Today",
                    "description": (
                        f"{loan.client.name} — {loan.loan_number} is due today. "
                        f"Outstanding: KES {outstanding:,.0f}"
                    ),
                    "time": now.isoformat(),
                    "loan_id": str(loan.id),
                }
            )

    # 2. Loans due tomorrow
    if prefs.get("due_tomorrow", True):
        due_tomorrow = (
            db.scalars(
                select(Loan)
                .options(joinedload(Loan.client))
                .where(
                    Loan.status == LoanStatus.DISBURSED,
                    Loan.due_date >= utc_instant(tomorrow),
                    Loan.due_date < utc_instant(day_after_tomorrow),
                    *scoped,
                )
            )
            .unique()
            .all()
        )

        for loan in due_tomorrow:
            if get_outstanding(db, loan) <= 0:
                continue
            notifications.append(
                {
                    "id": f"due-tomorrow-{loan.id}",
                    "type": "due_tomorrow",
                    "priority": "high",
                    "title": "Due Tomorrow",
                    "description": f"{loan.client.name} — {loan.loan_number} is due tomorrow.",
                    "time": now.isoformat(),
                    "loan_id": str(loan.id),
                }
            )

    # 3. Almost due (within 2 days, not today or tomorrow)
    if prefs.get("almost_due", True):
        almost_due = (
            db.scalars(
                select(Loan)
                .options(joinedload(Loan.client))
                .where(
                    Loan.status == LoanStatus.DISBURSED,
                    Loan.due_date >= utc_instant(day_after_tomorrow),
                    Loan.due_date < utc_instant(day_after_tomorrow + timedelta(days=1)),
                    *scoped,
                )
            )
            .unique()
            .all()
        )

        for loan in almost_due:
            if get_outstanding(db, loan) <= 0:
                continue
            due_display = as_nairobi_date(loan.due_date)
            notifications.append(
                {
                    "id": f"almost-due-{loan.id}",
                    "type": "almost_due",
                    "priority": "medium",
                    "title": "Loan Almost Due",
                    "description": (
                        f"{loan.client.name} — {loan.loan_number} is due in 2 days "
                        f"({due_display.isoformat() if due_display else ''})."
                    ),
                    "time": now.isoformat(),
                    "loan_id": str(loan.id),
                }
            )

    # 4. Overdue loans (arrears)
    if prefs.get("arrears", True):
        overdue = (
            db.scalars(
                select(Loan)
                .options(joinedload(Loan.client))
                .where(
                    Loan.status == LoanStatus.DISBURSED,
                    Loan.due_date < utc_instant(today),
                    *scoped,
                )
            )
            .unique()
            .all()
        )

        for loan in overdue:
            if get_outstanding(db, loan) <= 0:
                continue  # Fully repaid but not yet closed — not in arrears
            due = as_nairobi_date(loan.due_date)
            days = (today - due).days if due else 0
            notifications.append(
                {
                    "id": f"arrears-{loan.id}",
                    "type": "arrears",
                    "priority": _priority(days),
                    "title": "Loan in Arrears",
                    "description": f"{loan.client.name} — {loan.loan_number} is {days} day{'s' if days != 1 else ''} overdue.",
                    "time": now.isoformat(),
                    "loan_id": str(loan.id),
                }
            )

    # 5. Unverified repayments
    if prefs.get("repayment_pending", True):
        unverified_query = (
            select(Repayment)
            .options(joinedload(Repayment.loan), joinedload(Repayment.client))
            .where(Repayment.verified == False)
            .order_by(Repayment.date.desc())
            .limit(20)
        )
        if branch_ids is not None:
            unverified_query = unverified_query.join(Repayment.loan).where(
                Loan.branch_id.in_(branch_ids)
            )
        unverified = db.scalars(unverified_query).unique().all()

        for rep in unverified:
            notifications.append(
                {
                    "id": f"unverified-{rep.id}",
                    "type": "repayment_pending",
                    "priority": "medium",
                    "title": "Payment Awaiting Verification",
                    "description": f"KES {float(rep.amount):,.0f} from {rep.client.name if rep.client else 'client'} — recorded and pending Manager/Director approval.",
                    "time": rep.date.isoformat() if rep.date else now.isoformat(),
                    "repayment_id": str(rep.id),
                    "loan_id": str(rep.loan_id),
                }
            )

    # 6. Loans pending approval (for managers/directors)
    if prefs.get("pending_approval", True):
        user_perms = get_user_permissions(db, current_user)
        if "loans.approve" in user_perms:
            pending_loans = (
                db.scalars(
                    select(Loan)
                    .options(joinedload(Loan.client))
                    .where(Loan.status == LoanStatus.PENDING, *scoped)
                    .order_by(Loan.date_submitted.desc())
                    .limit(10)
                )
                .unique()
                .all()
            )

            for loan in pending_loans:
                notifications.append(
                    {
                        "id": f"pending-approval-{loan.id}",
                        "type": "pending_approval",
                        "priority": "high",
                        "title": "Loan Awaiting Approval",
                        "description": f"{loan.client.name if loan.client else 'Client'} — {loan.loan_number} (KES {float(loan.amount):,.0f}) is awaiting your approval.",
                        "time": loan.date_submitted.isoformat()
                        if loan.date_submitted
                        else now.isoformat(),
                        "loan_id": str(loan.id),
                    }
                )

    # Sort by priority: critical → high → medium → low
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    notifications.sort(key=lambda n: priority_order.get(n["priority"], 99))
    return notifications


def _get_read_ids(db: Session, user_id: UUID) -> set[str]:
    return set(
        db.scalars(
            select(NotificationRead.notification_id).where(NotificationRead.user_id == user_id)
        ).all()
    )


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = _build_notifications(db, current_user)
    read_ids = _get_read_ids(db, current_user.id)
    for n in notifications:
        n["read"] = n["id"] in read_ids

    unread_count = sum(1 for n in notifications if not n["read"])

    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications),
    }


@router.get("/preferences", response_model=NotificationPrefsResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = _get_prefs(db, current_user.id)
    return NotificationPrefsResponse(preferences=NotificationPrefs(**prefs))


@router.patch("/preferences", response_model=NotificationPrefsResponse)
def update_preferences(
    request: UpdateNotificationPrefsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    merged = _get_prefs(db, current_user.id)
    merged.update(request.preferences.model_dump())
    row = db.get(NotificationPref, current_user.id)
    if row is None:
        db.add(NotificationPref(user_id=current_user.id, prefs=merged))
    else:
        row.prefs = merged
    db.commit()
    return NotificationPrefsResponse(preferences=NotificationPrefs(**merged))


@router.patch("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = _build_notifications(db, current_user)
    db.execute(delete(NotificationRead).where(NotificationRead.user_id == current_user.id))
    for n in notifications:
        db.add(NotificationRead(user_id=current_user.id, notification_id=n["id"]))
    db.commit()
    return {"status": "ok", "message": "All notifications marked as read"}


@router.patch("/{notification_id}/read")
def mark_one_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exists = db.scalar(
        select(NotificationRead).where(
            NotificationRead.user_id == current_user.id,
            NotificationRead.notification_id == notification_id,
        )
    )
    if not exists:
        db.add(NotificationRead(user_id=current_user.id, notification_id=notification_id))
        db.commit()
    return {"status": "ok", "message": "Notification marked as read"}
