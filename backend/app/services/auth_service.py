from datetime import UTC, datetime
from uuid import UUID

from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from app.models.enums import UserStatus
from app.models.user import User
from app.repositories.auth_repository import AuthRepository


class AuthenticationError(Exception):
    pass


class AuthService:

    MAX_FAILED_ATTEMPTS = 5

    def __init__(
        self,
        repository: AuthRepository,
    ):
        self.repository = repository

    def login(
        self,
        employee_number: str,
        password: str,
    ) -> str:

        user = self.repository.get_by_employee_number(employee_number)

        if user is None:
            raise AuthenticationError(
                "Invalid employee number or password."
            )

        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError(
                "Your account is not active."
            )

        if not verify_password(
            password,
            user.hashed_password,
        ):
            self._failed_login(user)
            raise AuthenticationError(
                "Invalid employee number or password."
            )

        self._successful_login(user)

        return create_access_token(str(user.id))

    def current_user(
        self,
        token: str,
    ) -> User:

        payload = decode_access_token(token)

        user_id = UUID(payload["sub"])

        user = self.repository.get_by_id(user_id)

        if user is None:
            raise AuthenticationError("User not found.")

        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError("User account is not active.")

        return user

    def _failed_login(
        self,
        user: User,
    ) -> None:

        user.failed_login_attempts += 1

        if (
            user.failed_login_attempts
            >= self.MAX_FAILED_ATTEMPTS
        ):
            user.status = UserStatus.LOCKED
            user.locked_at = datetime.now(UTC)

        self.repository.save(user)

    def _successful_login(
        self,
        user: User,
    ) -> None:

        user.failed_login_attempts = 0
        user.last_login_at = datetime.now(UTC)

        self.repository.save(user)
