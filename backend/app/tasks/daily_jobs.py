"""Daily scheduled jobs (D2): email digest + penalty snapshot. APScheduler."""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import get_user_branch_ids, get_user_permissions
from app.core.time import as_nairobi_date, today_nairobi
from app.db.session import SessionLocal
from app.models.enums import LoanStatus, UserStatus
from app.models.loan import Loan
from app.models.notification_pref import DEFAULT_PREFS, NotificationPref
from app.models.penalty_snapshot import PenaltySnapshot
from app.models.user import User
from app.services import email_service
from app.services.loan_service import calculate_penalty, get_outstanding

logger = logging.getLogger(__name__)


def _prefs(db: Session, user_id: UUID) -> dict[str, bool]:
    prefs = dict(DEFAULT_PREFS)
    row = db.get(NotificationPref, user_id)
    if row is not None and row.prefs:
        prefs.update(row.prefs)
    return prefs


def _digest_rows(db: Session) -> dict[str, list[dict[str, Any]]]:
    """Group active loans into digest sections, keyed by notification type."""
    today = today_nairobi()
    sections: dict[str, list[dict[str, Any]]] = {
        "almost_due": [],
        "due_tomorrow": [],
        "due_today": [],
        "arrears": [],
    }
    loans = (
        db.scalars(
            select(Loan)
            .options(joinedload(Loan.client), joinedload(Loan.loan_product))
            .where(Loan.status == LoanStatus.DISBURSED)
        )
        .unique()
        .all()
    )
    for loan in loans:
        outstanding = get_outstanding(db, loan)
        if outstanding <= 0:
            continue
        due_date = loan.due_date
        if due_date is None:
            continue
        due = as_nairobi_date(due_date)
        days_to_due = (due - today).days
        row = {
            "client_name": loan.client.name,
            "loan_number": loan.loan_number,
            "loan_id": str(loan.id),
            "branch_id": loan.branch_id,
            "outstanding": outstanding,
        }
        if days_to_due == 2:
            sections["almost_due"].append(row)
        elif days_to_due == 1:
            sections["due_tomorrow"].append(row)
        elif days_to_due == 0:
            row["penalty"] = _penalty_for(db, loan, due_date, outstanding)
            sections["due_today"].append(row)
        elif days_to_due < 0:
            row["days_overdue"] = -days_to_due
            row["penalty"] = _penalty_for(db, loan, due_date, outstanding)
            sections["arrears"].append(row)
    return sections


def _penalty_for(db: Session, loan: Loan, due_date: datetime, outstanding: Decimal) -> Decimal:
    product = loan.loan_product
    result = calculate_penalty(
        outstanding,
        due_date,
        product.penalty_rate if product else Decimal("0.03"),
        product.penalty_interval_days if product else 2,
        product.max_penalty_amount if product else None,
    )
    return Decimal(str(result["penalty"]))


def daily_digest_job() -> None:
    """Send one due/arrears digest email per loans.view user, respecting prefs."""
    db = SessionLocal()
    try:
        sections = _digest_rows(db)
        if not any(sections.values()):
            logger.info("daily digest: nothing to report")
            return
        users = db.scalars(select(User).where(User.status == UserStatus.ACTIVE)).all()

        for user in users:
            if "loans.view" not in get_user_permissions(db, user):
                continue
            branch_ids = get_user_branch_ids(db, user)
            prefs = _prefs(db, user.id)
            user_sections: list[tuple[str, list[dict[str, Any]]]] = []
            for kind, rows in sections.items():
                if not prefs.get(kind, True):
                    continue
                scoped = [
                    r
                    for r in rows
                    if branch_ids is None or (r["branch_id"] is not None and r["branch_id"] in branch_ids)
                ]
                if scoped:
                    user_sections.append((kind, scoped))
            if user_sections:
                try:
                    email_service.send_daily_digest_email(user.email, user.first_name, user_sections)
                    logger.info(
                        "daily digest emailed to %s (%s items)",
                        user.email,
                        sum(len(r) for _, r in user_sections),
                    )
                except Exception:
                    logger.exception("daily digest email failed for %s", user.email)
    finally:
        db.close()


def penalty_snapshot_job() -> None:
    """Persist today's outstanding + penalty per active overdue loan (idempotent per day)."""
    today = today_nairobi()
    db = SessionLocal()
    try:
        loans = (
            db.scalars(
                select(Loan)
                .options(joinedload(Loan.loan_product))
                .where(Loan.status == LoanStatus.DISBURSED)
            )
            .unique()
            .all()
        )
        count = 0
        for loan in loans:
            due = as_nairobi_date(loan.due_date)
            if due is None or due >= today:
                continue
            outstanding = get_outstanding(db, loan)
            if outstanding <= 0:
                continue
            due_date = loan.due_date
            if due_date is None:
                continue
            penalty = _penalty_for(db, loan, due_date, outstanding)
            existing = db.scalar(
                select(PenaltySnapshot).where(
                    PenaltySnapshot.loan_id == loan.id,
                    PenaltySnapshot.snapshot_date == today,
                )
            )
            if existing:
                existing.outstanding = outstanding
                existing.penalty = penalty
                existing.days_overdue = (today - due).days
            else:
                db.add(
                    PenaltySnapshot(
                        loan_id=loan.id,
                        snapshot_date=today,
                        outstanding=outstanding,
                        penalty=penalty,
                        days_overdue=(today - due).days,
                    )
                )
            count += 1
        db.commit()
        logger.info("penalty snapshot: %s loans recorded for %s", count, today)
    finally:
        db.close()
