"""Add hidden property to agents

Revision ID: 15b577c62f3f
Revises: 4c6c9ef0387d
Create Date: 2025-07-30 13:19:15.213121

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "15b577c62f3f"
down_revision: Union[str, None] = "4c6c9ef0387d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("hidden", sa.Boolean(), nullable=True))

    # Set hidden=true for existing agents with project names starting with "templates"
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE agents SET hidden = true WHERE project_id LIKE 'templates-%'"))


def downgrade() -> None:
    op.drop_column("agents", "hidden")
