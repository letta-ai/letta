"""add identifier key to agents

Revision ID: a3047a624130
Revises: a113caac453e
Create Date: 2025-02-14 12:24:16.123456

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "a3047a624130"
down_revision: Union[str, None] = "a113caac453e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.add_column("agents", sa.Column("identifier_key", sa.String(), nullable=True))


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_column("agents", "identifier_key")
