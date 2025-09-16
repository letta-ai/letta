"""add stop_reason and background columns to jobs table, create agents_runs association table

Revision ID: 5bfb45a0b781
Revises: 5d27a719b24d
Create Date: 2025-09-15 16:55:11.291915

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5bfb45a0b781"
down_revision: Union[str, None] = "5d27a719b24d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add stop_reason column to jobs table
    op.add_column("jobs", sa.Column("stop_reason", sa.String(), nullable=True))

    # Add background column to jobs table
    op.add_column("jobs", sa.Column("background", sa.Boolean(), nullable=True, server_default=sa.false()))

    # Create agents_runs association table
    op.create_table(
        "agents_runs",
        sa.Column("agent_id", sa.String(), sa.ForeignKey("agents.id"), primary_key=True),
        sa.Column("run_id", sa.String(), sa.ForeignKey("jobs.id"), primary_key=True),
        sa.UniqueConstraint("agent_id", "run_id", name="unique_agent_run"),
    )

    # Add indexes
    op.create_index("ix_agents_runs_agent_id_run_id", "agents_runs", ["agent_id", "run_id"])
    op.create_index("ix_agents_runs_run_id_agent_id", "agents_runs", ["run_id", "agent_id"])

    # Check if we're using SQLite
    connection = op.get_bind()
    dialect_name = connection.dialect.name

    if dialect_name == "sqlite":
        # For SQLite, we don't perform the complex JSON-based updates
        # The columns are added as nullable and will remain null
        # SQLite doesn't support the JSONB operators used in the PostgreSQL updates
        pass
    else:
        # For PostgreSQL, migrate existing data from metadata to new columns
        # Update background field from metadata
        connection.execute(
            sa.text("""
                UPDATE jobs
                SET background = CASE
                    WHEN metadata_::jsonb->>'background' = 'true' THEN true
                    WHEN metadata_::jsonb->>'background' = 'false' THEN false
                    ELSE false
                END
                WHERE metadata_ IS NOT NULL
                AND metadata_::jsonb ? 'background'
            """)
        )

        # Populate agents_runs table from metadata for jobs with job_type 'RUN'
        connection.execute(
            sa.text("""
                INSERT INTO agents_runs (agent_id, run_id)
                SELECT
                    metadata_::jsonb->>'agent_id' as agent_id,
                    id as run_id
                FROM jobs
                WHERE metadata_ IS NOT NULL
                AND metadata_::jsonb ? 'agent_id'
                AND metadata_::jsonb->>'agent_id' IS NOT NULL
                AND job_type = 'RUN'
                ON CONFLICT (agent_id, run_id) DO NOTHING
            """)
        )


def downgrade() -> None:
    # Drop indexes and table
    op.drop_index("ix_agents_runs_run_id_agent_id", "agents_runs")
    op.drop_index("ix_agents_runs_agent_id_run_id", "agents_runs")
    # Note: Unique constraint will be dropped automatically with the table
    op.drop_table("agents_runs")

    # Drop columns from jobs table
    op.drop_column("jobs", "background")
    op.drop_column("jobs", "stop_reason")
