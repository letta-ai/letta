"""adding JobMessages table

Revision ID: 8d70372ad130
Revises: cdb3db091113
Create Date: 2025-01-08 17:57:20.325596

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "8d70372ad130"
down_revision: Union[str, None] = "cdb3db091113"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.create_table(
        "job_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("message_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name="fk_job_messages_job_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], name="fk_job_messages_message_id", ondelete="CASCADE", use_alter=True),
        sa.PrimaryKeyConstraint("id", name="pk_job_messages"),
        sa.UniqueConstraint("message_id", name="uq_job_messages_message_id"),
    )

    # Add indexes
    op.create_index("ix_job_messages_job_id", "job_messages", ["job_id"], unique=False)
    op.create_index("ix_job_messages_created_at", "job_messages", ["created_at"], unique=False)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_index("ix_job_messages_created_at", "job_messages")
    op.drop_index("ix_job_messages_job_id", "job_messages")
    op.drop_table("job_messages")
