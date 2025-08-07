"""add archival memory sharing

Revision ID: 74e860718e0d
Revises: 15b577c62f3f
Create Date: 2025-07-30 16:15:49.424711

"""

import time
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# Import custom columns if needed
try:
    from letta.orm.custom_columns import CommonVector, EmbeddingConfigColumn
except ImportError:
    # For environments where these aren't available
    EmbeddingConfigColumn = sa.JSON
    CommonVector = sa.BLOB

# revision identifiers, used by Alembic.
revision: str = "74e860718e0d"
down_revision: Union[str, None] = "15b577c62f3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # get database connection to check DB type
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # create new tables with appropriate defaults
    if is_sqlite:
        op.create_table(
            "archives",
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("metadata_", sa.JSON(), nullable=True),
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0"), nullable=False),
            sa.Column("_created_by_id", sa.String(), nullable=True),
            sa.Column("_last_updated_by_id", sa.String(), nullable=True),
            sa.Column("organization_id", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(
                ["organization_id"],
                ["organizations.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        # Check if archives table already exists
        connection = op.get_bind()
        result = connection.execute(
            sa.text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'archives'
                )
            """
            )
        )
        archives_exists = result.scalar()

        if not archives_exists:
            op.create_table(
                "archives",
                sa.Column("name", sa.String(), nullable=False),
                sa.Column("description", sa.String(), nullable=True),
                sa.Column("metadata_", sa.JSON(), nullable=True),
                sa.Column("id", sa.String(), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
                sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
                sa.Column("_created_by_id", sa.String(), nullable=True),
                sa.Column("_last_updated_by_id", sa.String(), nullable=True),
                sa.Column("organization_id", sa.String(), nullable=False),
                sa.ForeignKeyConstraint(
                    ["organization_id"],
                    ["organizations.id"],
                ),
                sa.PrimaryKeyConstraint("id"),
            )

    op.create_index("ix_archives_created_at", "archives", ["created_at", "id"], unique=False)
    op.create_index("ix_archives_organization_id", "archives", ["organization_id"], unique=False)

    if is_sqlite:
        op.create_table(
            "archives_agents",
            sa.Column("agent_id", sa.String(), nullable=False),
            sa.Column("archive_id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("datetime('now')"), nullable=False),
            sa.Column("is_owner", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["archive_id"], ["archives.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("agent_id", "archive_id"),
            # TODO: Remove this constraint when we support multiple archives per agent
            sa.UniqueConstraint("agent_id", name="unique_agent_archive"),
        )
    else:
        op.create_table(
            "archives_agents",
            sa.Column("agent_id", sa.String(), nullable=False),
            sa.Column("archive_id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("is_owner", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["archive_id"], ["archives.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("agent_id", "archive_id"),
            # TODO: Remove this constraint when we support multiple archives per agent
            sa.UniqueConstraint("agent_id", name="unique_agent_archive"),
        )

    if is_sqlite:
        # For SQLite
        # create temporary table to preserve existing agent_passages data
        op.execute(
            """
            CREATE TEMPORARY TABLE temp_agent_passages AS
            SELECT * FROM agent_passages WHERE is_deleted = 0;
            """
        )

        # create default archives and migrate data
        # First, create archives for each agent that has passages
        op.execute(
            """
            INSERT INTO archives (id, name, description, organization_id, created_at, updated_at, is_deleted)
            SELECT DISTINCT
                'archive-' || lower(hex(randomblob(16))),
                COALESCE(a.name, 'Agent ' || a.id) || '''s Archive',
                'Default archive created during migration',
                a.organization_id,
                datetime('now'),
                datetime('now'),
                0
            FROM temp_agent_passages ap
            JOIN agents a ON ap.agent_id = a.id;
            """
        )

        # create archives_agents relationships
        op.execute(
            """
            INSERT INTO archives_agents (agent_id, archive_id, is_owner, created_at)
            SELECT
                a.id as agent_id,
                ar.id as archive_id,
                1 as is_owner,
                datetime('now') as created_at
            FROM agents a
            JOIN archives ar ON ar.organization_id = a.organization_id
                AND ar.name = COALESCE(a.name, 'Agent ' || a.id) || '''s Archive'
            WHERE EXISTS (
                SELECT 1 FROM temp_agent_passages ap WHERE ap.agent_id = a.id
            );
            """
        )

        # drop the old agent_passages table
        op.drop_index("ix_agent_passages_org_agent", table_name="agent_passages")
        op.drop_table("agent_passages")

        # create the new archival_passages table with the new schema
        op.create_table(
            "archival_passages",
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("embedding_config", EmbeddingConfigColumn, nullable=False),
            sa.Column("metadata_", sa.JSON(), nullable=False),
            sa.Column("embedding", CommonVector, nullable=True),  # SQLite uses CommonVector for embeddings
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0"), nullable=False),
            sa.Column("_created_by_id", sa.String(), nullable=True),
            sa.Column("_last_updated_by_id", sa.String(), nullable=True),
            sa.Column("organization_id", sa.String(), nullable=False),
            sa.Column("archive_id", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(
                ["organization_id"],
                ["organizations.id"],
            ),
            sa.ForeignKeyConstraint(["archive_id"], ["archives.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

        # migrate data from temp table to archival_passages with archive_id
        op.execute(
            """
            INSERT INTO archival_passages (
                id, text, embedding_config, metadata_, embedding,
                created_at, updated_at, is_deleted,
                _created_by_id, _last_updated_by_id,
                organization_id, archive_id
            )
            SELECT
                ap.id, ap.text, ap.embedding_config, ap.metadata_, ap.embedding,
                ap.created_at, ap.updated_at, ap.is_deleted,
                ap._created_by_id, ap._last_updated_by_id,
                ap.organization_id, ar.id as archive_id
            FROM temp_agent_passages ap
            JOIN agents a ON ap.agent_id = a.id
            JOIN archives ar ON ar.organization_id = a.organization_id
                AND ar.name = COALESCE(a.name, 'Agent ' || a.id) || '''s Archive';
            """
        )

        # drop temporary table
        op.execute("DROP TABLE temp_agent_passages;")

        # create indexes
        op.create_index("ix_archival_passages_archive_id", "archival_passages", ["archive_id"])
        op.create_index("ix_archival_passages_org_archive", "archival_passages", ["organization_id", "archive_id"])
        op.create_index("archival_passages_created_at_id_idx", "archival_passages", ["created_at", "id"])

    else:
        # PostgreSQL
        # add archive_id to agent_passages
        op.add_column("agent_passages", sa.Column("archive_id", sa.String(), nullable=True))

        # get connection for batch processing
        connection = op.get_bind()

        # get total count of agents with passages
        total_agents_result = connection.execute(
            sa.text(
                """
                SELECT COUNT(DISTINCT a.id)
                FROM agent_passages ap
                JOIN agents a ON ap.agent_id = a.id
                WHERE ap.is_deleted = FALSE
            """
            )
        )
        total_agents = total_agents_result.scalar()

        if total_agents > 0:
            print(f"Starting archival memory migration for {total_agents} agents...")
            start_time = time.time()

            batch_size = 1000

            # process agents one by one to maintain proper relationships
            offset = 0
            while offset < total_agents:
                # Get batch of agents that need archives
                batch_result = connection.execute(
                    sa.text(
                        """
                        SELECT DISTINCT a.id, a.name, a.organization_id
                        FROM agent_passages ap
                        JOIN agents a ON ap.agent_id = a.id
                        WHERE ap.is_deleted = FALSE
                        AND NOT EXISTS (
                            SELECT 1 FROM archives_agents aa
                            WHERE aa.agent_id = a.id
                        )
                        ORDER BY a.id
                        LIMIT :batch_size
                    """
                    ).bindparams(batch_size=batch_size)
                )

                agents_batch = batch_result.fetchall()
                if not agents_batch:
                    break  # No more agents to process

                batch_count = len(agents_batch)
                print(f"Processing batch of {batch_count} agents (offset: {offset})...")

                # Create archive and relationship for each agent
                for agent_id, agent_name, org_id in agents_batch:
                    try:
                        # Create archive
                        archive_result = connection.execute(
                            sa.text(
                                """
                                INSERT INTO archives (id, name, description, organization_id, created_at)
                                VALUES (
                                    'archive-' || gen_random_uuid(),
                                    :archive_name,
                                    'Default archive created during migration',
                                    :org_id,
                                    NOW()
                                )
                                RETURNING id
                            """
                            ).bindparams(archive_name=f"{agent_name or f'Agent {agent_id}'}'s Archive", org_id=org_id)
                        )
                        archive_id = archive_result.scalar()

                        # Create agent-archive relationship
                        connection.execute(
                            sa.text(
                                """
                                INSERT INTO archives_agents (agent_id, archive_id, is_owner, created_at)
                                VALUES (:agent_id, :archive_id, TRUE, NOW())
                            """
                            ).bindparams(agent_id=agent_id, archive_id=archive_id)
                        )
                    except Exception as e:
                        print(f"Warning: Failed to create archive for agent {agent_id}: {e}")
                        # Continue with other agents

                offset += batch_count

            print("Archive creation completed. Starting archive_id updates...")

            # update agent_passages with archive_id in batches
            total_passages_result = connection.execute(
                sa.text(
                    """
                    SELECT COUNT(*)
                    FROM agent_passages ap
                    WHERE ap.archive_id IS NULL
                    AND ap.is_deleted = FALSE
                """
                )
            )
            total_passages = total_passages_result.scalar()

            if total_passages > 0:
                print(f"Updating archive_id for {total_passages} passages...")

                updated_passages = 0
                update_batch_size = 5000  # larger batch size for updates

                while updated_passages < total_passages:
                    print(
                        f"Updating passages {updated_passages + 1} to {min(updated_passages + update_batch_size, total_passages)} of {total_passages}..."
                    )

                    # Use connection.execute instead of op.execute to get rowcount
                    result = connection.execute(
                        sa.text(
                            """
                            UPDATE agent_passages ap
                            SET archive_id = aa.archive_id
                            FROM archives_agents aa
                            WHERE ap.agent_id = aa.agent_id
                            AND ap.archive_id IS NULL
                            AND ap.is_deleted = FALSE
                            AND ap.id IN (
                                SELECT id FROM agent_passages
                                WHERE archive_id IS NULL
                                AND is_deleted = FALSE
                                LIMIT :batch_size
                            )
                        """
                        ).bindparams(batch_size=update_batch_size)
                    )

                    rows_updated = result.rowcount
                    if rows_updated == 0:
                        break  # no more rows to update

                    updated_passages += rows_updated

                print(f"Archive_id update completed. Updated {updated_passages} passages.")

            elapsed_time = time.time() - start_time
            print(f"Data migration completed successfully in {elapsed_time:.2f} seconds.")
        else:
            print("No agents with passages found. Skipping data migration.")

        # schema changes
        op.alter_column("agent_passages", "archive_id", nullable=False)
        op.create_foreign_key("agent_passages_archive_id_fkey", "agent_passages", "archives", ["archive_id"], ["id"], ondelete="CASCADE")

        # drop old indexes and constraints
        op.drop_index("ix_agent_passages_org_agent", table_name="agent_passages")
        op.drop_index("agent_passages_org_idx", table_name="agent_passages")
        op.drop_index("agent_passages_created_at_id_idx", table_name="agent_passages")
        op.drop_constraint("agent_passages_agent_id_fkey", "agent_passages", type_="foreignkey")
        op.drop_column("agent_passages", "agent_id")

        # rename table and create new indexes
        op.rename_table("agent_passages", "archival_passages")
        op.create_index("ix_archival_passages_archive_id", "archival_passages", ["archive_id"])
        op.create_index("ix_archival_passages_org_archive", "archival_passages", ["organization_id", "archive_id"])
        op.create_index("archival_passages_org_idx", "archival_passages", ["organization_id"])
        op.create_index("archival_passages_created_at_id_idx", "archival_passages", ["created_at", "id"])


def downgrade() -> None:
    # Get database connection to check DB type
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if is_sqlite:
        # For SQLite, we need to migrate data back carefully
        # create temporary table to preserve existing archival_passages data
        op.execute(
            """
            CREATE TEMPORARY TABLE temp_archival_passages AS
            SELECT * FROM archival_passages WHERE is_deleted = 0;
            """
        )

        # drop the archival_passages table and indexes
        op.drop_index("ix_archival_passages_org_archive", table_name="archival_passages")
        op.drop_index("ix_archival_passages_archive_id", table_name="archival_passages")
        op.drop_index("archival_passages_created_at_id_idx", table_name="archival_passages")
        op.drop_table("archival_passages")

        # recreate agent_passages with old schema
        op.create_table(
            "agent_passages",
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("embedding_config", EmbeddingConfigColumn, nullable=False),
            sa.Column("metadata_", sa.JSON(), nullable=False),
            sa.Column("embedding", CommonVector, nullable=True),  # SQLite uses CommonVector for embeddings
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0"), nullable=False),
            sa.Column("_created_by_id", sa.String(), nullable=True),
            sa.Column("_last_updated_by_id", sa.String(), nullable=True),
            sa.Column("organization_id", sa.String(), nullable=False),
            sa.Column("agent_id", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(
                ["organization_id"],
                ["organizations.id"],
            ),
            sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

        # restore data from archival_passages back to agent_passages
        # use the owner relationship from archives_agents to determine agent_id
        op.execute(
            """
            INSERT INTO agent_passages (
                id, text, embedding_config, metadata_, embedding,
                created_at, updated_at, is_deleted,
                _created_by_id, _last_updated_by_id,
                organization_id, agent_id
            )
            SELECT
                ap.id, ap.text, ap.embedding_config, ap.metadata_, ap.embedding,
                ap.created_at, ap.updated_at, ap.is_deleted,
                ap._created_by_id, ap._last_updated_by_id,
                ap.organization_id, aa.agent_id
            FROM temp_archival_passages ap
            JOIN archives_agents aa ON ap.archive_id = aa.archive_id AND aa.is_owner = 1;
            """
        )

        # drop temporary table
        op.execute("DROP TABLE temp_archival_passages;")

        # create original indexes
        op.create_index("ix_agent_passages_org_agent", "agent_passages", ["organization_id", "agent_id"])
        op.create_index("agent_passages_org_idx", "agent_passages", ["organization_id"])
        op.create_index("agent_passages_created_at_id_idx", "agent_passages", ["created_at", "id"])

        # drop new tables for SQLite
        op.drop_table("archives_agents")
        op.drop_index("ix_archives_organization_id", table_name="archives")
        op.drop_index("ix_archives_created_at", table_name="archives")
        op.drop_table("archives")
    else:
        # PostgreSQL:
        # rename table back
        op.drop_index("ix_archival_passages_org_archive", table_name="archival_passages")
        op.drop_index("ix_archival_passages_archive_id", table_name="archival_passages")
        op.drop_index("archival_passages_org_idx", table_name="archival_passages")
        op.drop_index("archival_passages_created_at_id_idx", table_name="archival_passages")
        op.rename_table("archival_passages", "agent_passages")

        # add agent_id column back
        op.add_column("agent_passages", sa.Column("agent_id", sa.String(), nullable=True))

        # restore agent_id from archives_agents (use the owner relationship)
        op.execute(
            """
            UPDATE agent_passages ap
            SET agent_id = aa.agent_id
            FROM archives_agents aa
            WHERE ap.archive_id = aa.archive_id AND aa.is_owner = TRUE;
        """
        )

        # schema changes
        op.alter_column("agent_passages", "agent_id", nullable=False)
        op.create_foreign_key("agent_passages_agent_id_fkey", "agent_passages", "agents", ["agent_id"], ["id"], ondelete="CASCADE")

        # drop archive_id column and constraint
        op.drop_constraint("agent_passages_archive_id_fkey", "agent_passages", type_="foreignkey")
        op.drop_column("agent_passages", "archive_id")

        # restore original indexes
        op.create_index("ix_agent_passages_org_agent", "agent_passages", ["organization_id", "agent_id"])
        op.create_index("agent_passages_org_idx", "agent_passages", ["organization_id"])
        op.create_index("agent_passages_created_at_id_idx", "agent_passages", ["created_at", "id"])

        # drop new tables for PostgreSQL
        op.drop_table("archives_agents")
        op.drop_index("ix_archives_organization_id", table_name="archives")
        op.drop_index("ix_archives_created_at", table_name="archives")
        op.drop_table("archives")
