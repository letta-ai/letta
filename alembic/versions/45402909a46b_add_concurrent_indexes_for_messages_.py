"""add concurrent indexes for messages listing

Revision ID: 45402909a46b
Revises: b2c3d4e5f6a8
Create Date: 2026-03-03 21:23:50.802684

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "45402909a46b"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    connection.commit()
    autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
    autocommit_connection.exec_driver_sql(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_on_updated_at
        ON messages USING btree (updated_at)
        """
    )
    autocommit_connection.exec_driver_sql(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_messages_agent_conversation_sequence
        ON messages USING btree (agent_id, conversation_id, sequence_id)
        """
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.commit()
    autocommit_connection = connection.execution_options(isolation_level="AUTOCOMMIT")
    autocommit_connection.exec_driver_sql("DROP INDEX CONCURRENTLY IF EXISTS ix_messages_agent_conversation_sequence")
    autocommit_connection.exec_driver_sql("DROP INDEX CONCURRENTLY IF EXISTS idx_messages_on_updated_at")
