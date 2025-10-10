"""Add additional indexes

Revision ID: 3d2e9fb40a3c
Revises: 57bcea83af3f
Create Date: 2025-09-20 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3d2e9fb40a3c"
down_revision: Union[str, None] = "57bcea83af3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    """Create an index if it does not already exist.

    Uses SQLAlchemy inspector to avoid duplicate index errors across environments.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {ix["name"] for ix in inspector.get_indexes(table_name)}
    if index_name not in existing:
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    # files_agents: speed up WHERE agent_id IN (...)
    _create_index_if_missing("ix_files_agents_agent_id", "files_agents", ["agent_id"])

    # block: speed up common org+deployment filters
    _create_index_if_missing(
        "ix_block_organization_id_deployment_id",
        "block",
        ["organization_id", "deployment_id"],
    )

    # agents: speed up common org+deployment filters
    _create_index_if_missing(
        "ix_agents_organization_id_deployment_id",
        "agents",
        ["organization_id", "deployment_id"],
    )

    # Note: The index on block.current_history_entry_id (ix_block_current_history_entry_id)
    # already exists from prior migrations. If drift is suspected, consider verifying
    # and recreating it manually to avoid duplicate indexes under different names.


def downgrade() -> None:
    # Drop indexes added in this migration (ignore if missing for portability)
    for name, table in [
        ("ix_agents_organization_id_deployment_id", "agents"),
        ("ix_block_organization_id_deployment_id", "block"),
        ("ix_files_agents_agent_id", "files_agents"),
    ]:
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            # Be permissive in environments where indexes may have different names
            pass
