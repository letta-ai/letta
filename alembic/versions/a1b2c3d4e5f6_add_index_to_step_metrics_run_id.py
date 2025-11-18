"""add index to step_metrics run_id

Revision ID: a1b2c3d4e5f6
Revises: d798609d65ff
Create Date: 2025-11-11 19:16:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d798609d65ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Add index to step_metrics.run_id for efficient foreign key cascade operations
    # This prevents full table scans when runs are deleted (ondelete="SET NULL")
    op.create_index("ix_step_metrics_run_id", "step_metrics", ["run_id"], unique=False, if_not_exists=True)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_index("ix_step_metrics_run_id", table_name="step_metrics", if_exists=True)
