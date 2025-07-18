"""change JobMessage unique constraint to (job_id,message_id)

Revision ID: 7f652fdd3dba
Revises: 22a6e413d89c
Create Date: 2025-01-13 14:36:13.626344

"""

from typing import Sequence, Union

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "7f652fdd3dba"
down_revision: Union[str, None] = "22a6e413d89c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Drop the old unique constraint
    op.drop_constraint("uq_job_messages_message_id", "job_messages", type_="unique")

    # Add the new composite unique constraint
    op.create_unique_constraint("unique_job_message", "job_messages", ["job_id", "message_id"])


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Drop the new composite constraint
    op.drop_constraint("unique_job_message", "job_messages", type_="unique")

    # Restore the old unique constraint
    op.create_unique_constraint("uq_job_messages_message_id", "job_messages", ["message_id"])
