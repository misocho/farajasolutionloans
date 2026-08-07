"""add estimated_asset_value to clients

Revision ID: 56abb241f073
Revises: 2af447094139
Create Date: 2026-08-07 02:16:36.566096

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56abb241f073'
down_revision: Union[str, Sequence[str], None] = '2af447094139'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('clients', sa.Column('estimated_asset_value', sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('clients', 'estimated_asset_value')
