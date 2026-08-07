"""add pending_approval to userstatus enum

Revision ID: 5df95998dc2f
Revises: a9213f2dd78e
Create Date: 2026-08-07 01:50:43.016558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5df95998dc2f'
down_revision: Union[str, Sequence[str], None] = 'a9213f2dd78e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE userstatus ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE userstatus RENAME TO userstatus_old")
    op.execute("CREATE TYPE userstatus AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED')")
    op.execute("ALTER TABLE users ALTER COLUMN status TYPE userstatus USING status::text::userstatus")
    op.execute("DROP TYPE userstatus_old")
