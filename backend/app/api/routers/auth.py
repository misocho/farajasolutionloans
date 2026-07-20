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
from app.services.auth_service import (
    AuthService,
    AuthenticationError,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        access_token = auth_service.login(
            employee_number=request.employee_number,
            password=request.password,
        )

        return TokenResponse(
            access_token=access_token,
        )

    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.get(
    "/me",
    response_model=AuthUser,
)
def me(
    current_user=Depends(get_current_user),
):
    return current_user
