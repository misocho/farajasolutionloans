"""add notification_reads table

Revision ID: 2af447094139
Revises: 5df95998dc2f
Create Date: 2026-08-07 02:14:20.741709

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2af447094139'
down_revision: Union[str, Sequence[str], None] = '5df95998dc2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notification_reads',
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, index=True),
        sa.Column('notification_id', sa.String(length=120), primary_key=True),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notification_reads')
