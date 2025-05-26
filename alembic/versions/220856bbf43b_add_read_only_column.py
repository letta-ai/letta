"""add read-only column

Revision ID: 220856bbf43b
Revises: 1dc0fee72dea
Create Date: 2025-05-13 14:42:17.353614

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "220856bbf43b"
down_revision: Union[str, None] = "1dc0fee72dea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # add default value of `False`
    op.add_column("block", sa.Column("read_only", sa.Boolean(), nullable=True))
    op.execute(
        f"""
        UPDATE block
        SET read_only = False
    """
    )
    op.alter_column("block", "read_only", nullable=False)


def downgrade() -> None:
    op.drop_column("block", "read_only")
