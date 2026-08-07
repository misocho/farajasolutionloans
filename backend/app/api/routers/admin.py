from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.user_role import UserRole
from app.models.role_permission import RolePermission
from app.models.user_branch import UserBranch
from app.models.user_invite import UserInvite, InviteStatus
from app.models.enums import UserStatus
from app.schemas.users import (
    UserAdminResponse,
    RoleResponse,
    PermissionResponse,
    UpdateUserRolesRequest,
    UpdateRolePermissionsRequest,
    InviteUserRequest,
    UserInviteResponse,
    UpdateUserStatusRequest,
)
from app.services import invite_service
from app.services.email_service import send_account_approved_email, send_password_reset_email
import secrets

router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)


# ── Auth Helpers ───────────────────────────────────────────────────────────────

def check_is_director(current_user: User = Depends(get_current_user)) -> User:
    user_roles = [ur.role.name for ur in current_user.roles]
    if "Director" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only System Directors are authorized to perform this operation.",
        )
    return current_user


# ── User Directory ─────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserAdminResponse])
def get_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = select(User).options(
        joinedload(User.roles).joinedload(UserRole.role),
        joinedload(User.branches).joinedload(UserBranch.branch),
    ).order_by(User.employee_number)
    return db.scalars(stmt).unique().all()


# ── Invite Flow ────────────────────────────────────────────────────────────────

@router.post("/users/invite", response_model=UserInviteResponse, status_code=status.HTTP_201_CREATED)
def invite_user(
    request: InviteUserRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    invite = invite_service.create_invite(
        db=db,
        email=str(request.email),
        first_name=request.first_name,
        last_name=request.last_name,
        role_name=request.role_name,
        branch_id=request.branch_id,
        invited_by=admin_user,
    )
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/users/invites", response_model=list[UserInviteResponse])
def get_invites(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    return db.scalars(
        select(UserInvite).order_by(UserInvite.created_at.desc())
    ).all()


@router.delete("/users/invites/{invite_id}", status_code=status.HTTP_200_OK)
def cancel_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    invite = db.scalar(select(UserInvite).where(UserInvite.id == invite_id))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != InviteStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending invites can be cancelled")
    invite.status = InviteStatus.CANCELLED
    db.commit()
    return {"status": "success", "message": f"Invite for {invite.email} cancelled"}


# ── User Status Management ─────────────────────────────────────────────────────

@router.patch("/users/{user_id}/approve", status_code=status.HTTP_200_OK)
def approve_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != UserStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"User is not pending approval (status: {user.status})")
    user.status = UserStatus.ACTIVE
    db.commit()
    # Send approval email (best effort)
    try:
        send_account_approved_email(to_email=user.email, first_name=user.first_name)
    except Exception:
        pass
    return {"status": "success", "message": f"{user.full_name} account activated"}


@router.patch("/users/{user_id}/status", status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: UUID,
    request: UpdateUserStatusRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own status")
    user.status = request.status
    db.commit()
    return {"status": "success", "message": f"{user.full_name} status updated to {request.status}"}


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def reset_user_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Generate a reset token (reuse invite token mechanism)
    from app.models.user_invite import UserInvite, InviteStatus
    from datetime import datetime, timezone, timedelta
    reset_token = secrets.token_urlsafe(48)
    from app.core.config import settings
    reset_link = f"{settings.FRONTEND_URL}/accept-invite?token={reset_token}&mode=reset"
    # Store as a special invite with accepted user's email
    invite = UserInvite(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        token=reset_token,
        role_name="",
        branch_id=None,
        invited_by_id=admin_user.id,
        status=InviteStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(invite)
    db.commit()
    try:
        send_password_reset_email(
            to_email=user.email,
            first_name=user.first_name,
            reset_link=reset_link,
        )
    except Exception:
        pass
    return {"status": "success", "message": f"Password reset email sent to {user.email}"}


# ── Roles & Permissions ────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse])
def get_roles(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    return db.scalars(select(Role).order_by(Role.name)).all()


@router.get("/permissions", response_model=list[PermissionResponse])
def get_permissions(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    return db.scalars(select(Permission).order_by(Permission.name)).all()


@router.get("/roles/{role_id}/permissions", response_model=list[PermissionResponse])
def get_role_permissions(
    role_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = (
        select(Permission)
        .join(RolePermission)
        .where(RolePermission.role_id == role_id)
        .order_by(Permission.name)
    )
    return db.scalars(stmt).all()


@router.put("/users/{user_id}/roles", status_code=status.HTTP_200_OK)
def update_user_roles(
    user_id: UUID,
    request: UpdateUserRolesRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    stmt = select(Role).where(Role.name.in_(request.role_names))
    roles_to_assign = db.scalars(stmt).all()
    if len(roles_to_assign) != len(request.role_names):
        found_names = [r.name for r in roles_to_assign]
        missing_names = set(request.role_names) - set(found_names)
        raise HTTPException(status_code=400, detail=f"Some roles were not found: {list(missing_names)}")
    db.execute(UserRole.__table__.delete().where(UserRole.user_id == user_id))
    for r in roles_to_assign:
        db.add(UserRole(user_id=user_id, role_id=r.id))
    db.commit()
    return {"status": "success", "message": f"Updated roles for employee {user.employee_number}"}


@router.put("/roles/{role_id}/permissions", status_code=status.HTTP_200_OK)
def update_role_permissions(
    role_id: UUID,
    request: UpdateRolePermissionsRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    role = db.scalar(select(Role).where(Role.id == role_id))
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    stmt = select(Permission).where(Permission.name.in_(request.permission_names))
    permissions_to_assign = db.scalars(stmt).all()
    if len(permissions_to_assign) != len(request.permission_names):
        found_names = [p.name for p in permissions_to_assign]
        missing_names = set(request.permission_names) - set(found_names)
        raise HTTPException(status_code=400, detail=f"Some permissions were not found: {list(missing_names)}")
    db.execute(RolePermission.__table__.delete().where(RolePermission.role_id == role_id))
    for p in permissions_to_assign:
        db.add(RolePermission(role_id=role_id, permission_id=p.id))
    db.commit()
    return {"status": "success", "message": f"Updated permissions for role {role.name}"}


