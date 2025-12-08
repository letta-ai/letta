"""add project_id to tools

Revision ID: 2e5e90d3cdf8
Revises: af842aa6f743
Create Date: 2025-12-03 11:55:57.355341

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2e5e90d3cdf8"
down_revision: Union[str, None] = "af842aa6f743"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tools", sa.Column("project_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tools", "project_id")
