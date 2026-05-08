"""add telemetry context fields to provider_traces

Revision ID: 539afa667cff
Revises: a1b2c3d4e5f7
Create Date: 2026-01-16 18:29:29.811385

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "539afa667cff"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("provider_traces", sa.Column("agent_id", sa.String(), nullable=True))
    op.add_column("provider_traces", sa.Column("agent_tags", sa.JSON(), nullable=True))
    op.add_column("provider_traces", sa.Column("call_type", sa.String(), nullable=True))
    op.add_column("provider_traces", sa.Column("run_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("provider_traces", "run_id")
    op.drop_column("provider_traces", "call_type")
    op.drop_column("provider_traces", "agent_tags")
    op.drop_column("provider_traces", "agent_id")
