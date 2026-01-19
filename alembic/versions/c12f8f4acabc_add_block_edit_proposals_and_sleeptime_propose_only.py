"""Add block edit proposals and sleeptime propose-only flag

Revision ID: c12f8f4acabc
Revises: ffb17eb241fc
Create Date: 2025-12-16 15:12:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c12f8f4acabc"
down_revision: Union[str, None] = "ffb17eb241fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("sleeptime_propose_only", sa.Boolean(), nullable=True))

    op.create_table(
        "block_edit_proposals",
        sa.Column("block_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("proposed_update", sa.JSON(), nullable=False),
        sa.Column("actor_type", sa.String(), nullable=True),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("base_block_version", sa.Integer(), nullable=True),
        sa.Column("base_history_entry_id", sa.String(), nullable=True),
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["base_history_entry_id"], ["block_history.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["block_id"], ["block.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_block_edit_proposals_block_id_status",
        "block_edit_proposals",
        ["block_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_block_edit_proposals_block_id_status", table_name="block_edit_proposals")
    op.drop_table("block_edit_proposals")
    op.drop_column("groups", "sleeptime_propose_only")
