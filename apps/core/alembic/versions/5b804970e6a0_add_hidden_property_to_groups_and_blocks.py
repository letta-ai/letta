"""add_hidden_property_to_groups_and_blocks

Revision ID: 5b804970e6a0
Revises: ddb69be34a72
Create Date: 2025-09-03 22:19:03.825077

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b804970e6a0"
down_revision: Union[str, None] = "ddb69be34a72"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hidden column to groups table
    op.add_column("groups", sa.Column("hidden", sa.Boolean(), nullable=True))

    # Add hidden column to block table
    op.add_column("block", sa.Column("hidden", sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Remove hidden column from block table
    op.drop_column("block", "hidden")

    # Remove hidden column from groups table
    op.drop_column("groups", "hidden")
