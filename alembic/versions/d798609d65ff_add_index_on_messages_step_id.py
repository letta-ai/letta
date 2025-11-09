"""add_index_on_messages_step_id

Revision ID: d798609d65ff
Revises: 89fd4648866b
Create Date: 2025-11-07 15:43:59.446292

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "d798609d65ff"
down_revision: Union[str, None] = "89fd4648866b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.create_index("idx_messages_step_id", "messages", ["step_id"], if_not_exists=True)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_index("idx_messages_step_id", table_name="messages", if_exists=True)
