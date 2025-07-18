"""Add file name to source passages

Revision ID: c96263433aef
Revises: 9792f94e961d
Create Date: 2025-06-06 12:06:57.328127
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "c96263433aef"
down_revision: Union[str, None] = "9792f94e961d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Add the new column
    op.add_column("source_passages", sa.Column("file_name", sa.String(), nullable=True))

    # Backfill file_name using SQL UPDATE JOIN
    op.execute(
        """
        UPDATE source_passages
        SET file_name = files.file_name
        FROM files
        WHERE source_passages.file_id = files.id
    """
    )

    # Enforce non-null constraint after backfill
    op.alter_column("source_passages", "file_name", nullable=False)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    op.drop_column("source_passages", "file_name")
