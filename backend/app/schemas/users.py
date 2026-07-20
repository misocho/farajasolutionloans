from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.enums import UserStatus
from decimal import Decimal

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

class UpdateUserRolesRequest(BaseModel):
    role_names: list[str]

class UpdateRolePermissionsRequest(BaseModel):
    permission_names: list[str]
