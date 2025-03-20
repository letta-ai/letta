"""update identities unique constraint and properties

Revision ID: 549eff097c71
Revises: a3047a624130
Create Date: 2025-02-20 09:53:42.743105

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "549eff097c71"
down_revision: Union[str, None] = "a3047a624130"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # Update unique constraint on identities table
    op.drop_constraint("unique_identifier_pid_org_id", "identities", type_="unique")
    op.create_unique_constraint(
        "unique_identifier_without_project",
        "identities",
        ["identifier_key", "project_id", "organization_id"],
        postgresql_nulls_not_distinct=True,
    )

    # Add properties column to identities table
    op.add_column("identities", sa.Column("properties", postgresql.JSONB, nullable=False, server_default="[]"))

    # Create identities_agents table for many-to-many relationship
    op.create_table(
        "identities_agents",
        sa.Column("identity_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["identity_id"], ["identities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("identity_id", "agent_id"),
    )

    # Migrate existing relationships
    # First, get existing relationships where identity_id is not null
    op.execute(
        """
        INSERT INTO identities_agents (identity_id, agent_id)
        SELECT DISTINCT identity_id, id as agent_id
        FROM agents
        WHERE identity_id IS NOT NULL
        """
    )

    # Remove old identity_id column from agents
    op.drop_column("agents", "identity_id")
    op.drop_column("agents", "identifier_key")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # Add back the old columns to agents
    op.add_column("agents", sa.Column("identity_id", sa.String(), nullable=True))
    op.add_column("agents", sa.Column("identifier_key", sa.String(), nullable=True))

    # Migrate relationships back
    op.execute(
        """
        UPDATE agents a
        SET identity_id = ia.identity_id
        FROM identities_agents ia
        WHERE a.id = ia.agent_id
        """
    )

    # Drop the many-to-many table
    op.drop_table("identities_agents")

    # Drop properties column
    op.drop_column("identities", "properties")

    # Restore old unique constraint
    op.drop_constraint("unique_identifier_without_project", "identities", type_="unique")
    op.create_unique_constraint("unique_identifier_pid_org_id", "identities", ["identifier_key", "project_id", "organization_id"])
    # ### end Alembic commands ###
