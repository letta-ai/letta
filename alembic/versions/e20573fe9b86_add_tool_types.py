"""Add tool types

Revision ID: e20573fe9b86
Revises: 915b68780108
Create Date: 2025-01-09 15:11:47.779646

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from letta.constants import BASE_MEMORY_TOOLS, BASE_TOOLS
from letta.schemas.enums import ToolType
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "e20573fe9b86"
down_revision: Union[str, None] = "915b68780108"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Step 1: Add the column as nullable with no default
    op.add_column("tools", sa.Column("tool_type", sa.String(), nullable=True))

    # Step 2: Backpopulate the tool_type column based on tool name
    # Define the list of Letta core tools
    letta_core_value = ToolType.LETTA_CORE.value
    letta_memory_core_value = ToolType.LETTA_MEMORY_CORE.value
    custom_value = ToolType.CUSTOM.value

    # Update tool_type for Letta core tools
    op.execute(
        f"""
        UPDATE tools
        SET tool_type = '{letta_core_value}'
        WHERE name IN ({','.join(f"'{name}'" for name in BASE_TOOLS)});
        """
    )

    op.execute(
        f"""
        UPDATE tools
        SET tool_type = '{letta_memory_core_value}'
        WHERE name IN ({','.join(f"'{name}'" for name in BASE_MEMORY_TOOLS)});
        """
    )

    # Update tool_type for all other tools
    op.execute(
        f"""
        UPDATE tools
        SET tool_type = '{custom_value}'
        WHERE tool_type IS NULL;
        """
    )

    # Step 3: Alter the column to be non-nullable
    op.alter_column("tools", "tool_type", nullable=False)
    op.alter_column("tools", "json_schema", existing_type=postgresql.JSON(astext_type=sa.Text()), nullable=True)


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Revert the changes made during the upgrade
    op.alter_column("tools", "json_schema", existing_type=postgresql.JSON(astext_type=sa.Text()), nullable=False)
    op.drop_column("tools", "tool_type")
    # ### end Alembic commands ###
