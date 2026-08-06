from datetime import datetime
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.enums import UserStatus
from app.models.user_invite import InviteStatus
from decimal import Decimal


# ── Shared Sub-schemas ────────────────────────────────────────────────────────

class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None
    approval_limit_amount: Decimal | None


class BranchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    code: str
    active: bool


class UserRoleDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: RoleResponse


class UserBranchDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    branch: BranchResponse


# ── User Responses ────────────────────────────────────────────────────────────

class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    employee_number: str
    email: EmailStr
    first_name: str
    last_name: str
    status: UserStatus
    last_login_at: datetime | None
    roles: list[UserRoleDetailResponse]
    branches: list[UserBranchDetailResponse]


# ── Role/Permission Requests ──────────────────────────────────────────────────

class UpdateUserRolesRequest(BaseModel):
    role_names: list[str]


class UpdateRolePermissionsRequest(BaseModel):
    permission_names: list[str]


# ── Invite Schemas ────────────────────────────────────────────────────────────

class InviteUserRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role_name: str
    branch_id: Optional[UUID] = None


class InviterInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    first_name: str
    last_name: str
    employee_number: str


class BranchInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    code: str


class UserInviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    first_name: str
    last_name: str
    role_name: str
    status: InviteStatus
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime
    branch: BranchInfo | None
    invited_by: InviterInfo | None


# ── Accept Invite ─────────────────────────────────────────────────────────────

class AcceptInviteRequest(BaseModel):
    token: str
    password: str


class AcceptInviteResponse(BaseModel):
    message: str
    employee_number: str


# ── Status / Password ─────────────────────────────────────────────────────────

class UpdateUserStatusRequest(BaseModel):
    status: UserStatus


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    """Director-triggered reset — sends email with reset link."""
    pass  # No body needed; uses user_id from path

