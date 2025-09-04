"""add privileged_tools to Organization

Revision ID: bdddd421ec41
Revises: 1e553a664210
Create Date: 2025-03-21 17:55:30.405519

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "bdddd421ec41"
down_revision: Union[str, None] = "1e553a664210"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Step 1: Add `privileged_tools` column with nullable=True
    op.add_column("organizations", sa.Column("privileged_tools", sa.Boolean(), nullable=True))

    # fill in column with `False`
    op.execute(
        """
        UPDATE organizations
        SET privileged_tools = False
        """
    )

    # Step 2: Make `privileged_tools` non-nullable
    op.alter_column("organizations", "privileged_tools", nullable=False)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_column("organizations", "privileged_tools")
