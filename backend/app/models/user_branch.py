from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class UserBranch(BaseModel):
    __tablename__ = "user_branches"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    branch_id: Mapped[UUID] = mapped_column(
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="branches")

    branch: Mapped["Branch"] = relationship()

    def __repr__(self) -> str:
        return f"<UserBranch(user={self.user_id}, branch={self.branch_id})>"
