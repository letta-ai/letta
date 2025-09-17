"""add identities table

Revision ID: a113caac453e
Revises: 7980d239ea08
Create Date: 2025-02-14 09:58:18.227122

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "a113caac453e"
down_revision: Union[str, None] = "7980d239ea08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # Create identities table
    op.create_table(
        "identities",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("identifier_key", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("identity_type", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=True),
        # From OrganizationMixin
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        # Foreign key to organizations
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        # Composite unique constraint
        sa.UniqueConstraint(
            "identifier_key",
            "project_id",
            "organization_id",
            name="unique_identifier_pid_org_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add identity_id column to agents table
    op.add_column("agents", sa.Column("identity_id", sa.String(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key("fk_agents_identity_id", "agents", "identities", ["identity_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    # First remove the foreign key constraint and column from agents
    op.drop_constraint("fk_agents_identity_id", "agents", type_="foreignkey")
    op.drop_column("agents", "identity_id")

    # Then drop the table
    op.drop_table("identities")
