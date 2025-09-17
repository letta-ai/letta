"""convert_stop_reason_from_enum_to_string

Revision ID: 887a4367b560
Revises: d5103ee17ed5
Create Date: 2025-08-27 16:34:45.605580

"""

from typing import Sequence, Union

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "887a4367b560"
down_revision: Union[str, None] = "d5103ee17ed5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite it doesn't enforce column types strictly,
    # so the existing enum values will continue to work as strings.
    if not settings.letta_pg_uri_no_default:
        return

    op.execute(
        """
        ALTER TABLE steps
        ALTER COLUMN stop_reason TYPE VARCHAR
        USING stop_reason::VARCHAR
        """
    )


def downgrade() -> None:
    # This is a one-way migration as we can't easily recreate the enum type
    # If needed, you would need to create the enum type and cast back
    pass
