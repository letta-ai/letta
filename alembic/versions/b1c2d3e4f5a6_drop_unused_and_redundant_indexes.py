"""drop unused and redundant indexes

Revision ID: b1c2d3e4f5a6
Revises: 2dbb2cf49e07
Create Date: 2025-11-11 21:16:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "2dbb2cf49e07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Drop unused indexes
    op.drop_index("ix_passage_tags_archive_tag", table_name="passage_tags", if_exists=True)
    op.drop_index("ix_jobs_created_at", table_name="jobs", if_exists=True)
    op.drop_index("ix_block_project_id", table_name="block", if_exists=True)
    op.drop_index("ix_block_label", table_name="block", if_exists=True)

    # Drop redundant indexes (covered by other composite indexes or FKs)
    op.drop_index("ix_messages_run_id", table_name="messages", if_exists=True)  # Redundant with ix_messages_run_sequence
    op.drop_index("ix_files_agents_agent_id", table_name="files_agents", if_exists=True)  # Redundant with FK index
    op.drop_index(
        "ix_agents_organization_id", table_name="agents", if_exists=True
    )  # Redundant with ix_agents_organization_id_deployment_id
    op.drop_index(
        "ix_passage_tags_archive_id", table_name="passage_tags", if_exists=True
    )  # Redundant with ix_passage_tags_archive_tag and ix_passage_tags_org_archive
    op.drop_index(
        "ix_blocks_block_label", table_name="blocks_agents", if_exists=True
    )  # Redundant with ix_blocks_agents_block_label_agent_id
    op.drop_index("ix_block_organization_id", table_name="block", if_exists=True)  # Redundant with ix_block_org_project_template
    op.drop_index(
        "archival_passages_org_idx", table_name="archival_passages", if_exists=True
    )  # Redundant with ix_archival_passages_org_archive

    # Drop unused table (leftover from PlanetScale migration)
    op.drop_table("_planetscale_import", if_exists=True)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Re-create indexes in reverse order
    op.create_index("archival_passages_org_idx", "archival_passages", ["organization_id"], unique=False, if_not_exists=True)
    op.create_index("ix_block_organization_id", "block", ["organization_id"], unique=False, if_not_exists=True)
    op.create_index("ix_blocks_block_label", "blocks_agents", ["block_label"], unique=False, if_not_exists=True)
    op.create_index("ix_passage_tags_archive_id", "passage_tags", ["archive_id"], unique=False, if_not_exists=True)
    op.create_index("ix_agents_organization_id", "agents", ["organization_id"], unique=False, if_not_exists=True)
    op.create_index("ix_files_agents_agent_id", "files_agents", ["agent_id"], unique=False, if_not_exists=True)
    op.create_index("ix_messages_run_id", "messages", ["run_id"], unique=False, if_not_exists=True)
    op.create_index("ix_block_label", "block", ["label"], unique=False, if_not_exists=True)
    op.create_index("ix_block_project_id", "block", ["project_id"], unique=False, if_not_exists=True)
    op.create_index("ix_jobs_created_at", "jobs", ["created_at", "id"], unique=False, if_not_exists=True)
    op.create_index("ix_passage_tags_archive_tag", "passage_tags", ["archive_id", "tag"], unique=False, if_not_exists=True)

    # Note: Not recreating _planetscale_import table in downgrade as it's application-specific
