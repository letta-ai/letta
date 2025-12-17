"""Add prompt_tokens_details to steps table

Revision ID: 175dd10fb916
Revises: b1c2d3e4f5a6
Create Date: 2025-11-28 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "175dd10fb916"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add prompt_tokens_details JSON column to steps table
    # This stores detailed prompt token breakdown (cached_tokens, cache_read_tokens, cache_creation_tokens)
    op.add_column("steps", sa.Column("prompt_tokens_details", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("steps", "prompt_tokens_details")
