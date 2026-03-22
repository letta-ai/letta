"""add index on agents organization_id and created_by_id

Revision ID: a08c972e781b
Revises: 9fa274fb0b83
Create Date: 2026-03-22 16:16:30.094739

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a08c972e781b"
down_revision: Union[str, None] = "9fa274fb0b83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    connection.commit()
    autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
    autocommit_connection.exec_driver_sql(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_agents_organization_id_created_by_id
        ON agents USING btree (organization_id, _created_by_id)
        """
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.commit()
    autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
    autocommit_connection.exec_driver_sql(
        """
        DROP INDEX CONCURRENTLY IF EXISTS ix_agents_organization_id_created_by_id
        """
    )
