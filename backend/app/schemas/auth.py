from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserStatus


class LoginRequest(BaseModel):
    employee_number: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_number: str
    email: EmailStr
    first_name: str
    last_name: str
    status: UserStatus
    last_login_at: datetime | None
    role: str | None = None
    roles: list[str] = []
    permissions: list[str] = []
