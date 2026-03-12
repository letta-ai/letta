"""add_usage_columns_to_steps

Revision ID: 3e54e2fa2f7e
Revises: a1b2c3d4e5f8
Create Date: 2026-02-03 16:35:51.327031

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3e54e2fa2f7e"
down_revision: Union[str, None] = "a1b2c3d4e5f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("steps", sa.Column("model_handle", sa.String(), nullable=True))
    op.add_column("steps", sa.Column("cached_input_tokens", sa.Integer(), nullable=True))
    op.add_column("steps", sa.Column("cache_write_tokens", sa.Integer(), nullable=True))
    op.add_column("steps", sa.Column("reasoning_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("steps", "reasoning_tokens")
    op.drop_column("steps", "cache_write_tokens")
    op.drop_column("steps", "cached_input_tokens")
    op.drop_column("steps", "model_handle")
