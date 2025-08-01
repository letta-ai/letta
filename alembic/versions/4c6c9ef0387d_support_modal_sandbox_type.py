"""support modal sandbox type

Revision ID: 4c6c9ef0387d
Revises: 4537f0996495
Create Date: 2025-07-29 15:10:08.996251

"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op
from letta.settings import DatabaseChoice, settings

# revision identifiers, used by Alembic.
revision: str = "4c6c9ef0387d"
down_revision: Union[str, None] = "4537f0996495"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite just uses strings
    if settings.database_engine == DatabaseChoice.POSTGRES:
        op.execute("ALTER TYPE sandboxtype ADD VALUE 'MODAL' AFTER 'E2B'")


def downgrade() -> None:
    if settings.database_engine == DatabaseChoice.POSTGRES:
        connection = op.get_bind()

        data_conflicts = connection.execute(
            text(
                """
            SELECT COUNT(*)
            FROM sandbox_configs
            WHERE "type" NOT IN ('E2B', 'LOCAL')
        """
            )
        ).fetchone()
        if data_conflicts[0]:
            raise RuntimeError(
                (
                    "Cannot downgrade enum: Data conflicts are detected in sandbox_configs.sandboxtype.\n"
                    "Please manually handle these records before handling the downgrades.\n"
                    f"{data_conflicts} invalid sandboxtype values"
                )
            )

        # Postgres does not support dropping enum values. Create a new enum and swap them.
        op.execute("CREATE TYPE sandboxtype_old AS ENUM ('E2B', 'LOCAL')")
        op.execute('ALTER TABLE sandbox_configs ALTER COLUMN "type" TYPE sandboxtype_old USING "type"::text::sandboxtype_old')
        op.execute("DROP TYPE sandboxtype")
        op.execute("ALTER TYPE sandboxtype_old RENAME to sandboxtype")
