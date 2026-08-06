from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import (
    get_auth_service,
    get_current_user,
)
from app.schemas.auth import (
    AuthUser,
    LoginRequest,
    TokenResponse,
)
from app.schemas.users import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    ChangePasswordRequest,
)
from app.services.auth_service import (
    AuthService,
    AuthenticationError,
)
from app.services import invite_service
from app.services.invite_service import InviteError
from app.core.security import verify_password, get_password_hash
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        access_token = auth_service.login(
            employee_number=request.employee_number,
            password=request.password,
        )
        return TokenResponse(access_token=access_token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.get("/me", response_model=AuthUser)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/accept-invite", response_model=AcceptInviteResponse, status_code=status.HTTP_201_CREATED)
def accept_invite(
    request: AcceptInviteRequest,
    db: Session = Depends(get_db),
):
    """Accept an invite token and create a new user account (status: PENDING_APPROVAL)."""
    try:
        user = invite_service.accept_invite(
            db=db,
            token=request.token,
            password=request.password,
        )
        db.commit()
        return AcceptInviteResponse(
            message="Account created successfully. Awaiting Director approval before you can log in.",
            employee_number=user.employee_number,
        )
    except InviteError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated user changes their own password."""
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters.",
        )
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}

