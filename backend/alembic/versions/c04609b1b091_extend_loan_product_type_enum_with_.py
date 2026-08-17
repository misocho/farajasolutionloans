"""extend loan product type enum with custom

Revision ID: c04609b1b091
Revises: 71f36ff96244
Create Date: 2026-08-17 10:29:42.780898

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c04609b1b091'
down_revision: str | Sequence[str] | None = '71f36ff96244'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE loanproducttype ADD VALUE IF NOT EXISTS 'CUSTOM'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres cannot drop enum values without recreating the type; once
    # applied this migration is effectively irreversible (safe to keep the
    # extra value — it is unused by downgraded code).
    pass
