"""Add v2 protocol fields to provider_traces

Revision ID: 9275f62ad282
Revises: 297e8217e952
Create Date: 2026-01-22

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "9275f62ad282"
down_revision: Union[str, None] = "297e8217e952"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("provider_traces", sa.Column("org_id", sa.String(), nullable=True))
    op.add_column("provider_traces", sa.Column("user_id", sa.String(), nullable=True))
    op.add_column("provider_traces", sa.Column("compaction_settings", sa.JSON(), nullable=True))
    op.add_column("provider_traces", sa.Column("llm_config", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("provider_traces", "llm_config")
    op.drop_column("provider_traces", "compaction_settings")
    op.drop_column("provider_traces", "user_id")
    op.drop_column("provider_traces", "org_id")
