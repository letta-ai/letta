"""Add model and model_settings columns to conversations table for model overrides

Revision ID: b2c3d4e5f6a8
Revises: 3e54e2fa2f7e
Create Date: 2026-02-23 02:50:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "3e54e2fa2f7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("model", sa.String(), nullable=True))
    op.add_column("conversations", sa.Column("model_settings", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "model_settings")
    op.drop_column("conversations", "model")
