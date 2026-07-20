from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.models.user_branch import UserBranch
from app.models.user_role import UserRole


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_employee_number(
        self,
        employee_number: str,
    ) -> User | None:
        stmt = (
            select(User)
            .options(
                joinedload(User.roles).joinedload(UserRole.role),
                joinedload(User.branches).joinedload(UserBranch.branch),
            )
            .where(User.employee_number == employee_number)
        )

        return self.db.scalar(stmt)

    def get_by_id(
        self,
        user_id: UUID,
    ) -> User | None:
        stmt = (
            select(User)
            .options(
                joinedload(User.roles).joinedload(UserRole.role),
                joinedload(User.branches).joinedload(UserBranch.branch),
            )
            .where(User.id == user_id)
        )

        return self.db.scalar(stmt)

    def save(
        self,
        user: User,
    ) -> None:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
