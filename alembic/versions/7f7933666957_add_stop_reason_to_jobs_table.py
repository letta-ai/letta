"""add stop_reason to jobs table

Revision ID: 7f7933666957
Revises: d06594144ef3
Create Date: 2025-09-16 13:20:42.368007

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7f7933666957"
down_revision: Union[str, None] = "d06594144ef3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add stop_reason column to jobs table
    op.add_column("jobs", sa.Column("stop_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "stop_reason")
