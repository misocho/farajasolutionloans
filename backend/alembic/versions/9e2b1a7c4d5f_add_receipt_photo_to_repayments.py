"""add receipt_photo to repayments

Revision ID: 9e2b1a7c4d5f
Revises: d3aa1130642d
Create Date: 2026-08-07 03:48:04.422110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e2b1a7c4d5f'
down_revision: Union[str, Sequence[str], None] = 'd3aa1130642d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("repayments", sa.Column("receipt_photo", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("repayments", "receipt_photo")
