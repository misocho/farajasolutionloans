from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class InviteStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class UserInvite(BaseModel):
    __tablename__ = "user_invites"

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    role_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    branch_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )

    invited_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[InviteStatus] = mapped_column(
        Enum(InviteStatus),
        default=InviteStatus.PENDING,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        nullable=False,
    )

    accepted_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    # Relationships
    branch: Mapped["Branch | None"] = relationship(  # type: ignore[name-defined]
        "Branch",
        foreign_keys=[branch_id],
        lazy="joined",
    )

    invited_by: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[invited_by_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<UserInvite(email='{self.email}', status='{self.status}')>"
