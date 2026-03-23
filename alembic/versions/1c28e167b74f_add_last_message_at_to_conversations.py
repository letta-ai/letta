"""add last_message_at to conversations

Revision ID: 1c28e167b74f
Revises: a08c972e781b
Create Date: 2026-03-22 19:07:27.266449

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1c28e167b74f"
down_revision: Union[str, None] = "a08c972e781b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    conversation_columns = {column["name"] for column in inspector.get_columns("conversations")}
    if "last_message_at" not in conversation_columns:
        op.add_column("conversations", sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True))

    conversation_indexes = {index["name"] for index in inspector.get_indexes("conversations")}
    if "ix_conversations_org_agent_last_message_at" not in conversation_indexes:
        op.create_index(
            "ix_conversations_org_agent_last_message_at", "conversations", ["organization_id", "agent_id", "last_message_at"], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    conversation_indexes = {index["name"] for index in inspector.get_indexes("conversations")}
    if "ix_conversations_org_agent_last_message_at" in conversation_indexes:
        op.drop_index("ix_conversations_org_agent_last_message_at", table_name="conversations")

    conversation_columns = {column["name"] for column in inspector.get_columns("conversations")}
    if "last_message_at" in conversation_columns:
        op.drop_column("conversations", "last_message_at")
