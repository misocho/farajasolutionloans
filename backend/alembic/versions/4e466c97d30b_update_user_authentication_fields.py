"""update user authentication fields

Revision ID: 4e466c97d30b
Revises: 942b9ff118aa
Create Date: 2026-07-19 15:50:22.645711
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4e466c97d30b"
down_revision: Union[str, Sequence[str], None] = "942b9ff118aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.alter_column(
        "users",
        "password_hash",
        new_column_name="hashed_password",
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.alter_column(
        "users",
        "hashed_password",
        new_column_name="password_hash",
    )
