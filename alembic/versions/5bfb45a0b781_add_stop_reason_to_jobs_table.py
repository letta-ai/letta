"""add stop_reason to jobs table

Revision ID: 5bfb45a0b781
Revises: 5d27a719b24d
Create Date: 2025-09-15 16:55:11.291915

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5bfb45a0b781"
down_revision: Union[str, None] = "5d27a719b24d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("stop_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "stop_reason")
