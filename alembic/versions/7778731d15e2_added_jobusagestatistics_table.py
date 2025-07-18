"""Added JobUsageStatistics table

Revision ID: 7778731d15e2
Revises: 8d70372ad130
Create Date: 2025-01-09 13:20:25.555740

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "7778731d15e2"
down_revision: Union[str, None] = "8d70372ad130"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Create job_usage_statistics table
    op.create_table(
        "job_usage_statistics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("step_id", sa.String(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("total_tokens", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("step_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], name="fk_job_usage_statistics_job_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_job_usage_statistics"),
    )

    # Create indexes
    op.create_index("ix_job_usage_statistics_created_at", "job_usage_statistics", ["created_at"])
    op.create_index("ix_job_usage_statistics_job_id", "job_usage_statistics", ["job_id"])


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Drop indexes
    op.drop_index("ix_job_usage_statistics_created_at", "job_usage_statistics")
    op.drop_index("ix_job_usage_statistics_job_id", "job_usage_statistics")

    # Drop table
    op.drop_table("job_usage_statistics")
