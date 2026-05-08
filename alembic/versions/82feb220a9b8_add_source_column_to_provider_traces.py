"""add source column to provider_traces

Revision ID: 82feb220a9b8
Revises: 539afa667cff
Create Date: 2026-01-18 21:09:59.529688

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "82feb220a9b8"
down_revision: Union[str, None] = "539afa667cff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("provider_traces", sa.Column("source", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("provider_traces", "source")
