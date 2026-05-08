"""Add blocks_conversations table for conversation-isolated blocks

Revision ID: a1b2c3d4e5f7
Revises: cf3c4d025dbc
Create Date: 2026-01-14 02:22:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "cf3c4d025dbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create blocks_conversations junction table
    op.create_table(
        "blocks_conversations",
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("block_id", sa.String(), nullable=False),
        sa.Column("block_label", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["block_id"],
            ["block.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("conversation_id", "block_id", "block_label"),
        sa.UniqueConstraint("conversation_id", "block_label", name="unique_label_per_conversation"),
        sa.UniqueConstraint("conversation_id", "block_id", name="unique_conversation_block"),
    )
    op.create_index("ix_blocks_conversations_block_id", "blocks_conversations", ["block_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_blocks_conversations_block_id", table_name="blocks_conversations")
    op.drop_table("blocks_conversations")
