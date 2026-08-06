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

from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.enums import LoanStatus
from app.models.loan import Loan
from app.models.repayment import Repayment
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

# In-memory store for read state (per user session — lightweight).
# A proper solution would use a DB table; this keeps it simple for now.
_read_timestamps: dict[str, datetime] = {}


def _priority(days_overdue: int) -> str:
    if days_overdue > 14:
        return "critical"
    if days_overdue > 7:
        return "high"
    if days_overdue > 0:
        return "medium"
    return "low"


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    almost_due_threshold = today + timedelta(days=2)

    # Determine user's last read timestamp
    user_key = str(current_user.id)
    last_read = _read_timestamps.get(user_key)

    notifications = []

    # 1. Loans due today
    due_today = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client))
        .where(
            Loan.status == LoanStatus.DISBURSED,
            Loan.due_date >= datetime(today.year, today.month, today.day, tzinfo=timezone.utc),
            Loan.due_date < datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc),
        )
    ).unique().all()

    for loan in due_today:
        notifications.append({
            "id": f"due-today-{loan.id}",
            "type": "due_today",
            "priority": "critical",
            "title": "Loan Due Today",
            "description": f"{loan.client.name} — {loan.loan_number} is due today. Outstanding: KES {loan.total_repayable:,.0f}",
            "time": now.isoformat(),
            "read": last_read is not None and last_read > now - timedelta(hours=1),
            "loan_id": str(loan.id),
        })

    # 2. Loans due tomorrow
    due_tomorrow = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client))
        .where(
            Loan.status == LoanStatus.DISBURSED,
            Loan.due_date >= datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc),
            Loan.due_date < datetime((tomorrow + timedelta(days=1)).year,
                                     (tomorrow + timedelta(days=1)).month,
                                     (tomorrow + timedelta(days=1)).day, tzinfo=timezone.utc),
        )
    ).unique().all()

    for loan in due_tomorrow:
        notifications.append({
            "id": f"due-tomorrow-{loan.id}",
            "type": "due_tomorrow",
            "priority": "high",
            "title": "Due Tomorrow",
            "description": f"{loan.client.name} — {loan.loan_number} is due tomorrow.",
            "time": now.isoformat(),
            "read": last_read is not None,
            "loan_id": str(loan.id),
        })

    # 3. Almost due (within 2 days, not today or tomorrow)
    day_after_tomorrow = tomorrow + timedelta(days=1)
    almost_due = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client))
        .where(
            Loan.status == LoanStatus.DISBURSED,
            Loan.due_date >= datetime(day_after_tomorrow.year, day_after_tomorrow.month, day_after_tomorrow.day, tzinfo=timezone.utc),
            Loan.due_date < datetime(almost_due_threshold.year, almost_due_threshold.month, almost_due_threshold.day, tzinfo=timezone.utc) + timedelta(days=1),
        )
    ).unique().all()

    for loan in almost_due:
        notifications.append({
            "id": f"almost-due-{loan.id}",
            "type": "almost_due",
            "priority": "medium",
            "title": "Loan Almost Due",
            "description": f"{loan.client.name} — {loan.loan_number} is due in 2 days ({loan.due_date.date().isoformat() if loan.due_date else ''}).",
            "time": now.isoformat(),
            "read": last_read is not None,
            "loan_id": str(loan.id),
        })

    # 4. Overdue loans (arrears)
    overdue = db.scalars(
        select(Loan)
        .options(joinedload(Loan.client))
        .where(
            Loan.status == LoanStatus.DISBURSED,
            Loan.due_date < datetime(today.year, today.month, today.day, tzinfo=timezone.utc),
        )
    ).unique().all()

    for loan in overdue:
        days = (today - loan.due_date.date()).days if loan.due_date else 0
        notifications.append({
            "id": f"arrears-{loan.id}",
            "type": "arrears",
            "priority": _priority(days),
            "title": "Loan in Arrears",
            "description": f"{loan.client.name} — {loan.loan_number} is {days} day{'s' if days != 1 else ''} overdue.",
            "time": now.isoformat(),
            "read": False,  # Arrears are always unread until resolved
            "loan_id": str(loan.id),
        })

    # 5. Unverified repayments
    unverified = db.scalars(
        select(Repayment)
        .options(joinedload(Repayment.loan), joinedload(Repayment.client))
        .where(Repayment.verified == False)
        .order_by(Repayment.date.desc())
        .limit(20)
    ).unique().all()

    for rep in unverified:
        notifications.append({
            "id": f"unverified-{rep.id}",
            "type": "repayment_pending",
            "priority": "medium",
            "title": "Payment Awaiting Verification",
            "description": f"KES {float(rep.amount):,.0f} from {rep.client.name if rep.client else 'client'} — recorded and pending Manager/Director approval.",
            "time": rep.date.isoformat() if rep.date else now.isoformat(),
            "read": last_read is not None,
            "repayment_id": str(rep.id),
            "loan_id": str(rep.loan_id),
        })

    # 6. Loans pending approval (for managers/directors)
    user_perms = {rp.permission.name for ur in current_user.roles for rp in ur.role.permissions}
    if "loans.approve" in user_perms:
        pending_loans = db.scalars(
            select(Loan)
            .options(joinedload(Loan.client))
            .where(Loan.status == LoanStatus.PENDING)
            .order_by(Loan.date_submitted.desc())
            .limit(10)
        ).unique().all()

        for loan in pending_loans:
            notifications.append({
                "id": f"pending-approval-{loan.id}",
                "type": "pending_approval",
                "priority": "high",
                "title": "Loan Awaiting Approval",
                "description": f"{loan.client.name if loan.client else 'Client'} — {loan.loan_number} (KES {float(loan.amount):,.0f}) is awaiting your approval.",
                "time": loan.date_submitted.isoformat() if loan.date_submitted else now.isoformat(),
                "read": last_read is not None,
                "loan_id": str(loan.id),
            })

    # Sort by priority: critical → high → medium → low
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    notifications.sort(key=lambda n: priority_order.get(n["priority"], 99))

    unread_count = sum(1 for n in notifications if not n["read"])

    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications),
    }


@router.patch("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _read_timestamps[str(current_user.id)] = datetime.now(timezone.utc)
    return {"status": "ok", "message": "All notifications marked as read"}
