"""
Invite service — token generation, validation, and acceptance.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.branch import Branch
from app.models.role import Role
from app.models.user import User
from app.models.user_branch import UserBranch
from app.models.user_invite import InviteStatus, UserInvite
from app.models.user_role import UserRole
from app.models.enums import UserStatus
from app.services.email_service import send_invite_email


class InviteError(Exception):
    pass


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


def _next_employee_number(db: Session, role_name: str) -> str:
    """Auto-generate employee number in format FS-PRE001."""
    prefix_map = {
        "Director": "DIR",
        "Manager": "MGR",
        "Loan Officer": "LO",
        "Finance Officer": "ACC",
        "System Admin": "SYS",
        "Auditor": "AUD",
    }
    prefix = prefix_map.get(role_name, "STF")
    pattern = f"FS-{prefix}%"
    existing = db.scalars(
        select(User.employee_number)
        .where(User.employee_number.like(pattern))
        .order_by(User.employee_number.desc())
    ).all()
    next_num = len(existing) + 1
    return f"FS-{prefix}{next_num:03d}"


def create_invite(
    db: Session,
    email: str,
    first_name: str,
    last_name: str,
    role_name: str,
    branch_id: UUID | None,
    invited_by: User,
) -> UserInvite:
    """Create an invite record and send the email."""
    email = email.strip().lower()

    # Block re-invite when an account already exists for this email
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user:
        raise InviteError("An account with this email already exists.")

    # Check for existing pending invite for same email
    existing = db.scalar(
        select(UserInvite).where(
            UserInvite.email == email,
            UserInvite.status == InviteStatus.PENDING,
        )
    )
    if existing:
        # Expire old one and issue fresh
        existing.status = InviteStatus.EXPIRED
        db.flush()

    token = _generate_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.INVITE_TOKEN_EXPIRE_HOURS
    )

    invite = UserInvite(
        email=email,
        first_name=first_name,
        last_name=last_name,
        token=token,
        role_name=role_name,
        branch_id=branch_id,
        invited_by_id=invited_by.id,
        status=InviteStatus.PENDING,
        expires_at=expires_at,
    )
    db.add(invite)
    db.flush()

    invite_link = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
    send_invite_email(
        to_email=email,
        first_name=first_name,
        invite_link=invite_link,
        invited_by_name=invited_by.full_name,
    )

    return invite


def validate_token(db: Session, token: str) -> UserInvite:
    """Validate an invite token — raises InviteError if invalid/expired."""
    invite = db.scalar(
        select(UserInvite).where(UserInvite.token == token)
    )
    if not invite:
        raise InviteError("Invalid invitation link.")
    if invite.status == InviteStatus.ACCEPTED:
        raise InviteError("This invitation has already been used.")
    if invite.status in (InviteStatus.EXPIRED, InviteStatus.CANCELLED):
        raise InviteError("This invitation has expired or been cancelled.")
    if datetime.now(timezone.utc) > invite.expires_at.replace(tzinfo=timezone.utc):
        invite.status = InviteStatus.EXPIRED
        db.flush()
        raise InviteError("This invitation link has expired.")
    return invite


def accept_invite(db: Session, token: str, password: str) -> User:
    """
    Accept an invite: create the User with PENDING_APPROVAL status,
    assign role and branch. The invite stays PENDING until the user
    completes their profile (see complete_profile).
    """
    invite = validate_token(db, token)

    # Check email not already registered
    existing_user = db.scalar(
        select(User).where(User.email == invite.email.strip().lower())
    )
    if existing_user:
        # Idempotent re-submit after a partial setup (password step done,
        # profile step pending) — the invite is still PENDING, so return
        # the existing user instead of erroring.
        if invite.status == InviteStatus.PENDING:
            return existing_user
        raise InviteError("An account with this email already exists.")

    employee_number = _next_employee_number(db, invite.role_name)

    user = User(
        employee_number=employee_number,
        email=invite.email,
        first_name=invite.first_name,
        last_name=invite.last_name,
        hashed_password=get_password_hash(password),
        status=UserStatus.PENDING_APPROVAL,  # Director must approve
    )
    db.add(user)
    db.flush()

    # Assign role
    role = db.scalar(select(Role).where(Role.name == invite.role_name))
    if role:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    # Assign branch
    if invite.branch_id:
        branch = db.scalar(select(Branch).where(Branch.id == invite.branch_id))
        if branch:
            db.add(UserBranch(user_id=user.id, branch_id=branch.id))

    return user


def complete_profile(
    db: Session,
    token: str,
    phone: str,
    id_no: str,
    photo: str | None = None,
) -> User:
    """Save the invited user's profile (phone/ID/photo) and mark the invite accepted."""
    invite = validate_token(db, token)

    user = db.scalar(
        select(User).where(User.email == invite.email.strip().lower())
    )
    if not user:
        raise InviteError("Complete the password step before saving your profile.")

    user.phone = phone
    user.id_no = id_no
    user.profile_photo = photo
    db.flush()

    # Profile complete — the invite is fully consumed now
    invite.status = InviteStatus.ACCEPTED
    invite.accepted_at = datetime.now(timezone.utc)
    db.flush()

    return user
