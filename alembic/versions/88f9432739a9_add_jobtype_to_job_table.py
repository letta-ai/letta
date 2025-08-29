"""add JobType to Job table

Revision ID: 88f9432739a9
Revises: 7778731d15e2
Create Date: 2025-01-10 13:46:44.089110

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "88f9432739a9"
down_revision: Union[str, None] = "7778731d15e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Add job_type column with default value
    op.add_column("jobs", sa.Column("job_type", sa.String(), nullable=True))

    # Set existing rows to have the default value of JobType.JOB
    op.execute("UPDATE jobs SET job_type = 'job' WHERE job_type IS NULL")

    # Make the column non-nullable after setting default values
    op.alter_column("jobs", "job_type", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Remove the job_type column
    op.drop_column("jobs", "job_type")
