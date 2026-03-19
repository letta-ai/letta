"""backfill hidden for role:subagent agents

Revision ID: 9fa274fb0b83
Revises: 45402909a46b
Create Date: 2026-03-18 16:46:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9fa274fb0b83"
down_revision: Union[str, None] = "45402909a46b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE agents a
        SET hidden = true
        FROM agents_tags at
        WHERE (a.hidden IS NULL OR a.hidden = false)
          AND a.id = at.agent_id
          AND at.tag = 'role:subagent'
        """
    )


def downgrade() -> None:
    # Data-only backfill; no safe automatic rollback.
    pass
