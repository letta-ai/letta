"""Remove job_usage_statistics indices and update job_messages

Revision ID: 25fc99e97839
Revises: f595e0e8013e
Create Date: 2025-01-16 16:48:21.000000

"""

from typing import Sequence, Union

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "25fc99e97839"
down_revision: Union[str, None] = "f595e0e8013e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Remove indices from job_messages
    op.drop_index("ix_job_messages_created_at", table_name="job_messages")
    op.drop_index("ix_job_messages_job_id", table_name="job_messages")

    # Remove indices from job_usage_statistics
    op.drop_index("ix_job_usage_statistics_created_at", table_name="job_usage_statistics")
    op.drop_index("ix_job_usage_statistics_job_id", table_name="job_usage_statistics")

    # Add foreign key constraint for message_id
    op.create_foreign_key("fk_job_messages_message_id", "job_messages", "messages", ["message_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Remove the foreign key constraint
    op.drop_constraint("fk_job_messages_message_id", "job_messages", type_="foreignkey")

    # Recreate indices for job_messages
    op.create_index("ix_job_messages_job_id", "job_messages", ["job_id"])
    op.create_index("ix_job_messages_created_at", "job_messages", ["created_at"])

    # Recreate indices for job_usage_statistics
    op.create_index("ix_job_usage_statistics_job_id", "job_usage_statistics", ["job_id"])
    op.create_index("ix_job_usage_statistics_created_at", "job_usage_statistics", ["created_at"])
