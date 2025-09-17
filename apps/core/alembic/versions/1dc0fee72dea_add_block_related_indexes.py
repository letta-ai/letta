"""add block-related indexes

Revision ID: 1dc0fee72dea
Revises: 18e300709530
Create Date: 2025-05-12 17:06:32.055091

"""

from typing import Sequence, Union

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "1dc0fee72dea"
down_revision: Union[str, None] = "18e300709530"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # add index for blocks_agents table
    op.create_index("ix_blocks_agents_block_label_agent_id", "blocks_agents", ["block_label", "agent_id"], unique=False)

    # add index for just block_label
    op.create_index("ix_blocks_block_label", "blocks_agents", ["block_label"], unique=False)

    # add index for agent_tags for agent_id and tag
    op.create_index("ix_agents_tags_agent_id_tag", "agents_tags", ["agent_id", "tag"], unique=False)


def downgrade():
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_index("ix_blocks_agents_block_label_agent_id", table_name="blocks_agents")
    op.drop_index("ix_blocks_block_label", table_name="blocks_agents")
    op.drop_index("ix_agents_tags_agent_id_tag", table_name="agents_tags")
