"""add compaction_settings to agents table

Revision ID: d0880aae6cee
Revises: 2e5e90d3cdf8
Create Date: 2025-12-10 16:17:23.595775

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.orm.custom_columns import CompactionSettingsColumn

# revision identifiers, used by Alembic.
revision: str = "d0880aae6cee"
down_revision: Union[str, None] = "2e5e90d3cdf8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("compaction_settings", CompactionSettingsColumn(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "compaction_settings")
