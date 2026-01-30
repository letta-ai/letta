"""create provider_trace_metadata table

Revision ID: a1b2c3d4e5f8
Revises: 9275f62ad282
Create Date: 2026-01-28

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

revision: str = "a1b2c3d4e5f8"
down_revision: Union[str, None] = "9275f62ad282"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not settings.letta_pg_uri_no_default:
        return

    op.create_table(
        "provider_trace_metadata",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("step_id", sa.String(), nullable=True),
        sa.Column("agent_id", sa.String(), nullable=True),
        sa.Column("agent_tags", sa.JSON(), nullable=True),
        sa.Column("call_type", sa.String(), nullable=True),
        sa.Column("run_id", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("org_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("created_at", "id"),
    )
    op.create_index("ix_provider_trace_metadata_step_id", "provider_trace_metadata", ["step_id"], unique=False)
    op.create_index("ix_provider_trace_metadata_id", "provider_trace_metadata", ["id"], unique=True)


def downgrade() -> None:
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_index("ix_provider_trace_metadata_id", table_name="provider_trace_metadata")
    op.drop_index("ix_provider_trace_metadata_step_id", table_name="provider_trace_metadata")
    op.drop_table("provider_trace_metadata")
