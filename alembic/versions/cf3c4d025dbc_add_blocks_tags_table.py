"""Add blocks tags table

Revision ID: cf3c4d025dbc
Revises: 27de0f58e076
Create Date: 2026-01-08 23:36:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "cf3c4d025dbc"
down_revision: Union[str, None] = "27de0f58e076"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Create blocks_tags table with timestamps and org scoping for filtering
    # Note: Matches agents_tags structure but follows SQLite baseline pattern (no separate id column)
    op.create_table(
        "blocks_tags",
        sa.Column("block_id", sa.String(), nullable=False),
        sa.Column("tag", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["block_id"],
            ["block.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("block_id", "tag"),
        sa.UniqueConstraint("block_id", "tag", name="unique_block_tag"),
    )


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_table("blocks_tags")
