"""Add file processing status to FileMetadata and related indices

Revision ID: 9792f94e961d
Revises: cdd4a1c11aee
Create Date: 2025-06-05 18:51:57.022594

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "9792f94e961d"
down_revision: Union[str, None] = "cdd4a1c11aee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Step 1: Create constraint
    op.create_unique_constraint("uq_file_contents_file_id", "file_contents", ["file_id"])

    # Step 2: Add processing_status as nullable first
    op.add_column("files", sa.Column("processing_status", sa.String(), nullable=True))
    op.add_column("files", sa.Column("error_message", sa.Text(), nullable=True))

    # Step 3: Backfill existing rows with 'completed'
    op.execute("UPDATE files SET processing_status = 'completed'")

    # Step 4: Make the column non-nullable now that it's backfilled
    op.alter_column("files", "processing_status", nullable=False)

    # Step 5: Create indices
    op.create_index("ix_files_org_created", "files", ["organization_id", sa.literal_column("created_at DESC")], unique=False)
    op.create_index("ix_files_processing_status", "files", ["processing_status"], unique=False)
    op.create_index("ix_files_source_created", "files", ["source_id", sa.literal_column("created_at DESC")], unique=False)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("ix_files_source_created", table_name="files")
    op.drop_index("ix_files_processing_status", table_name="files")
    op.drop_index("ix_files_org_created", table_name="files")
    op.drop_column("files", "error_message")
    op.drop_column("files", "processing_status")
    op.drop_constraint("uq_file_contents_file_id", "file_contents", type_="unique")
    # ### end Alembic commands ###
