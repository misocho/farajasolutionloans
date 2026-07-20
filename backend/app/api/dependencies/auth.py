from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import (
    AuthService,
    AuthenticationError,
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)


def get_auth_service(
    db: Session = Depends(get_db),
) -> AuthService:
    repository = AuthRepository(db)
    return AuthService(repository)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        return auth_service.current_user(token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )
