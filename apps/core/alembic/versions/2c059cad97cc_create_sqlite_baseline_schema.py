"""create_sqlite_baseline_schema

Revision ID: 2c059cad97cc
Revises: 495f3f474131
Create Date: 2025-07-16 14:34:21.280233

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "2c059cad97cc"
down_revision: Union[str, None] = "495f3f474131"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only run this migration for SQLite
    if settings.letta_pg_uri_no_default:
        return

    # Create the exact schema that matches the current PostgreSQL state
    # This is a snapshot of the schema at the time of this migration
    # Based on the schema provided by Andy

    # Organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("privileged_tools", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Agents table
    op.create_table(
        "agents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("message_ids", sa.JSON(), nullable=True),
        sa.Column("system", sa.String(), nullable=True),
        sa.Column("agent_type", sa.String(), nullable=True),
        sa.Column("llm_config", sa.JSON(), nullable=True),
        sa.Column("embedding_config", sa.JSON(), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("tool_rules", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.Column("template_id", sa.String(), nullable=True),
        sa.Column("base_template_id", sa.String(), nullable=True),
        sa.Column("message_buffer_autoclear", sa.Boolean(), nullable=False),
        sa.Column("enable_sleeptime", sa.Boolean(), nullable=True),
        sa.Column("response_format", sa.JSON(), nullable=True),
        sa.Column("last_run_completion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_duration_ms", sa.Integer(), nullable=True),
        sa.Column("timezone", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )
    op.create_index("ix_agents_created_at", "agents", ["created_at", "id"])

    # Block history table (created before block table so block can reference it)
    op.create_table(
        "block_history",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("limit", sa.BigInteger(), nullable=False),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("actor_type", sa.String(), nullable=True),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("block_id", sa.String(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        # Note: block_id foreign key will be added later since block table doesn't exist yet
    )
    op.create_index("ix_block_history_block_id_sequence", "block_history", ["block_id", "sequence_number"], unique=True)

    # Block table
    op.create_table(
        "block",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("limit", sa.Integer(), nullable=False),
        sa.Column("template_name", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_template", sa.Boolean(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("current_history_entry_id", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("read_only", sa.Boolean(), nullable=False),
        sa.Column("preserve_on_migration", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["current_history_entry_id"], ["block_history.id"], name="fk_block_current_history_entry"),
        sa.UniqueConstraint("id", "label", name="unique_block_id_label"),
    )
    op.create_index("created_at_label_idx", "block", ["created_at", "label"])
    op.create_index("ix_block_current_history_entry_id", "block", ["current_history_entry_id"])

    # Note: Foreign key constraint for block_history.block_id cannot be added in SQLite after table creation
    # This will be enforced at the ORM level

    # Sources table
    op.create_table(
        "sources",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("embedding_config", sa.JSON(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("instructions", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("name", "organization_id", name="uq_source_name_organization"),
    )
    op.create_index("source_created_at_id_idx", "sources", ["created_at", "id"])

    # Files table
    op.create_table(
        "files",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("file_type", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("file_creation_date", sa.String(), nullable=True),
        sa.Column("file_last_modified_date", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("processing_status", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("original_file_name", sa.String(), nullable=True),
        sa.Column("total_chunks", sa.Integer(), nullable=True),
        sa.Column("chunks_embedded", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )
    # Note: SQLite doesn't support expression indexes, so these are simplified
    op.create_index("ix_files_org_created", "files", ["organization_id"])
    op.create_index("ix_files_processing_status", "files", ["processing_status"])
    op.create_index("ix_files_source_created", "files", ["source_id"])

    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )

    # Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("job_type", sa.String(), nullable=False),
        sa.Column("request_config", sa.JSON(), nullable=True),
        sa.Column("callback_url", sa.String(), nullable=True),
        sa.Column("callback_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("callback_status_code", sa.Integer(), nullable=True),
        sa.Column("callback_error", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_jobs_created_at", "jobs", ["created_at", "id"])

    # Tools table
    op.create_table(
        "tools",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_code", sa.String(), nullable=True),
        sa.Column("json_schema", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("return_char_limit", sa.Integer(), nullable=True),
        sa.Column("tool_type", sa.String(), nullable=False),
        sa.Column("args_json_schema", sa.JSON(), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("pip_requirements", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("name", "organization_id", name="uix_name_organization"),
    )
    op.create_index("ix_tools_created_at_name", "tools", ["created_at", "name"])

    # Additional tables based on Andy's schema

    # Agents tags table
    op.create_table(
        "agents_tags",
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("tag", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.UniqueConstraint("agent_id", "tag", name="unique_agent_tag"),
    )
    op.create_index("ix_agents_tags_agent_id_tag", "agents_tags", ["agent_id", "tag"])

    # Sandbox configs table
    op.create_table(
        "sandbox_configs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),  # sandboxtype in PG
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("type", "organization_id", name="uix_type_organization"),
    )

    # Sandbox environment variables table
    op.create_table(
        "sandbox_environment_variables",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("sandbox_config_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["sandbox_config_id"], ["sandbox_configs.id"]),
        sa.UniqueConstraint("key", "sandbox_config_id", name="uix_key_sandbox_config"),
    )

    # Blocks agents table
    op.create_table(
        "blocks_agents",
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("block_id", sa.String(), nullable=False),
        sa.Column("block_label", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["block_id", "block_label"], ["block.id", "block.label"], deferrable=True, initially="DEFERRED"),
        sa.UniqueConstraint("agent_id", "block_label", name="unique_label_per_agent"),
        sa.UniqueConstraint("agent_id", "block_id", name="unique_agent_block"),
    )
    op.create_index("ix_blocks_agents_block_label_agent_id", "blocks_agents", ["block_label", "agent_id"])
    op.create_index("ix_blocks_block_label", "blocks_agents", ["block_label"])

    # Tools agents table
    op.create_table(
        "tools_agents",
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("tool_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tool_id"], ["tools.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("agent_id", "tool_id", name="unique_agent_tool"),
    )

    # Sources agents table
    op.create_table(
        "sources_agents",
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("agent_id", "source_id"),
    )

    # Agent passages table (using BLOB for vectors in SQLite)
    op.create_table(
        "agent_passages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("embedding_config", sa.JSON(), nullable=False),
        sa.Column("metadata_", sa.JSON(), nullable=False),
        sa.Column("embedding", sa.BLOB(), nullable=True),  # CommonVector becomes BLOB in SQLite
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
    )
    # Note: agent_passages_org_idx is not created for SQLite as it's expected to be different
    op.create_index("agent_passages_created_at_id_idx", "agent_passages", ["created_at", "id"])
    op.create_index("ix_agent_passages_org_agent", "agent_passages", ["organization_id", "agent_id"])

    # Source passages table (using BLOB for vectors in SQLite)
    op.create_table(
        "source_passages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("embedding_config", sa.JSON(), nullable=False),
        sa.Column("metadata_", sa.JSON(), nullable=False),
        sa.Column("embedding", sa.BLOB(), nullable=True),  # CommonVector becomes BLOB in SQLite
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=True),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
    )
    # Note: source_passages_org_idx is not created for SQLite as it's expected to be different
    op.create_index("source_passages_created_at_id_idx", "source_passages", ["created_at", "id"])

    # Message sequence is handled by the sequence_id field in messages table

    # Messages table
    op.create_table(
        "messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("tool_calls", sa.JSON(), nullable=False),
        sa.Column("tool_call_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("step_id", sa.String(), nullable=True),
        sa.Column("otid", sa.String(), nullable=True),
        sa.Column("tool_returns", sa.JSON(), nullable=True),
        sa.Column("group_id", sa.String(), nullable=True),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("sequence_id", sa.BigInteger(), nullable=False),
        sa.Column("sender_id", sa.String(), nullable=True),
        sa.Column("batch_item_id", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["step_id"], ["steps.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("sequence_id", name="uq_messages_sequence_id"),
    )
    op.create_index("ix_messages_agent_created_at", "messages", ["agent_id", "created_at"])
    op.create_index("ix_messages_created_at", "messages", ["created_at", "id"])
    op.create_index("ix_messages_agent_sequence", "messages", ["agent_id", "sequence_id"])
    op.create_index("ix_messages_org_agent", "messages", ["organization_id", "agent_id"])

    # Create sequence table for SQLite message sequence_id generation
    op.create_table(
        "message_sequence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("next_val", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Initialize the sequence table with the next available sequence_id
    op.execute("INSERT INTO message_sequence (id, next_val) VALUES (1, 1)")

    # Now create the rest of the tables that might reference messages/steps

    # Add missing tables and columns identified from alembic check

    # Identities table
    op.create_table(
        "identities",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("identifier_key", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("identity_type", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("identifier_key", "project_id", "organization_id", name="unique_identifier_key_project_id_organization_id"),
    )

    # MCP Server table
    op.create_table(
        "mcp_server",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("server_name", sa.String(), nullable=False),
        sa.Column("server_type", sa.String(), nullable=False),
        sa.Column("server_url", sa.String(), nullable=True),
        sa.Column("stdio_config", sa.JSON(), nullable=True),
        sa.Column("token", sa.String(), nullable=True),
        sa.Column("custom_headers", sa.JSON(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("server_name", "organization_id", name="uix_name_organization_mcp_server"),
    )

    # Providers table
    op.create_table(
        "providers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("api_key", sa.String(), nullable=True),
        sa.Column("access_key", sa.String(), nullable=True),
        sa.Column("region", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("provider_type", sa.String(), nullable=True),
        sa.Column("base_url", sa.String(), nullable=True),
        sa.Column("provider_category", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("name", "organization_id", name="unique_name_organization_id"),
    )

    # Agent environment variables table
    op.create_table(
        "agent_environment_variables",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("key", "agent_id", name="uix_key_agent"),
    )
    op.create_index("idx_agent_environment_variables_agent_id", "agent_environment_variables", ["agent_id"])

    # Groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("manager_type", sa.String(), nullable=False),
        sa.Column("manager_agent_id", sa.String(), nullable=True),
        sa.Column("termination_token", sa.String(), nullable=True),
        sa.Column("max_turns", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("agent_ids", sa.JSON(), nullable=False),
        sa.Column("sleeptime_agent_frequency", sa.Integer(), nullable=True),
        sa.Column("turns_counter", sa.Integer(), nullable=True),
        sa.Column("last_processed_message_id", sa.String(), nullable=True),
        sa.Column("max_message_buffer_length", sa.Integer(), nullable=True),
        sa.Column("min_message_buffer_length", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["manager_agent_id"], ["agents.id"], ondelete="RESTRICT"),
    )

    # Steps table
    op.create_table(
        "steps",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, default=0),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, default=0),
        sa.Column("total_tokens", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=True),
        sa.Column("provider_id", sa.String(), nullable=True),
        sa.Column("provider_name", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("context_window_limit", sa.Integer(), nullable=True),
        sa.Column("completion_tokens_details", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("tid", sa.String(), nullable=True),
        sa.Column("model_endpoint", sa.String(), nullable=True),
        sa.Column("trace_id", sa.String(), nullable=True),
        sa.Column("agent_id", sa.String(), nullable=True),
        sa.Column("provider_category", sa.String(), nullable=True),
        sa.Column("feedback", sa.String(), nullable=True),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["provider_id"], ["providers.id"], ondelete="RESTRICT"),
    )

    # Note: Foreign key constraint for block.current_history_entry_id -> block_history.id
    # would need to be added here, but SQLite doesn't support ALTER TABLE ADD CONSTRAINT
    # This will be handled by the ORM at runtime

    # Add missing columns to existing tables

    # All missing columns have been added to the table definitions above

    # step_id was already added in the messages table creation above
    # op.add_column('messages', sa.Column('step_id', sa.String(), nullable=True))
    # op.create_foreign_key('fk_messages_step_id', 'messages', 'steps', ['step_id'], ['id'], ondelete='SET NULL')

    # Add index to source_passages for file_id
    op.create_index("source_passages_file_id_idx", "source_passages", ["file_id"])

    # Unique constraint for sources was added during table creation above

    # Create remaining association tables

    # Identities agents table
    op.create_table(
        "identities_agents",
        sa.Column("identity_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["identity_id"], ["identities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("identity_id", "agent_id"),
    )

    # Identities blocks table
    op.create_table(
        "identities_blocks",
        sa.Column("identity_id", sa.String(), nullable=False),
        sa.Column("block_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["identity_id"], ["identities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["block_id"], ["block.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("identity_id", "block_id"),
    )

    # Files agents table
    op.create_table(
        "files_agents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("visible_content", sa.Text(), nullable=True),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id", "file_id", "agent_id"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("file_id", "agent_id", name="uq_file_agent"),
        sa.UniqueConstraint("agent_id", "file_name", name="uq_agent_filename"),
    )
    op.create_index("ix_agent_filename", "files_agents", ["agent_id", "file_name"])
    op.create_index("ix_file_agent", "files_agents", ["file_id", "agent_id"])

    # Groups agents table
    op.create_table(
        "groups_agents",
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "agent_id"),
    )

    # Groups blocks table
    op.create_table(
        "groups_blocks",
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("block_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["block_id"], ["block.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "block_id"),
    )

    # LLM batch job table
    op.create_table(
        "llm_batch_job",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("llm_provider", sa.String(), nullable=False),
        sa.Column("create_batch_response", sa.JSON(), nullable=False),
        sa.Column("latest_polling_response", sa.JSON(), nullable=True),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("letta_batch_job_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["letta_batch_job_id"], ["jobs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_llm_batch_job_created_at", "llm_batch_job", ["created_at"])
    op.create_index("ix_llm_batch_job_status", "llm_batch_job", ["status"])

    # LLM batch items table
    op.create_table(
        "llm_batch_items",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("llm_config", sa.JSON(), nullable=False),
        sa.Column("request_status", sa.String(), nullable=False),
        sa.Column("step_status", sa.String(), nullable=False),
        sa.Column("step_state", sa.JSON(), nullable=False),
        sa.Column("batch_request_result", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("agent_id", sa.String(), nullable=False),
        sa.Column("llm_batch_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["llm_batch_id"], ["llm_batch_job.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_llm_batch_items_agent_id", "llm_batch_items", ["agent_id"])
    op.create_index("ix_llm_batch_items_llm_batch_id", "llm_batch_items", ["llm_batch_id"])
    op.create_index("ix_llm_batch_items_status", "llm_batch_items", ["request_status"])

    # Job messages table
    op.create_table(
        "job_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("message_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("job_id", "message_id", name="unique_job_message"),
    )

    # File contents table
    op.create_table(
        "file_contents",
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("file_id", "id"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("file_id", name="uq_file_contents_file_id"),
    )

    # Provider traces table
    op.create_table(
        "provider_traces",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("request_json", sa.JSON(), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("step_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("(FALSE)"), nullable=False),
        sa.Column("_created_by_id", sa.String(), nullable=True),
        sa.Column("_last_updated_by_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )
    op.create_index("ix_step_id", "provider_traces", ["step_id"])

    # Complete the SQLite schema alignment by adding any remaining missing elements
    try:
        # Unique constraints for files_agents are already created with correct names in table definition above

        # Foreign key for files_agents.source_id is already created in table definition above
        # Foreign key for messages.step_id is already created in table definition above
        pass

    except Exception:
        # Some operations may fail if the column/constraint already exists
        # This is expected in some cases and we can continue
        pass

    # Note: The remaining alembic check differences are expected for SQLite:
    # 1. Type differences (BLOB vs CommonVector) - Expected and handled by ORM
    # 2. Foreign key constraint differences - SQLite handles these at runtime
    # 3. Index differences - SQLite doesn't support all PostgreSQL index features
    # 4. Some constraint naming differences - Cosmetic differences
    #
    # These differences do not affect functionality as the ORM handles the abstraction
    # between SQLite and PostgreSQL appropriately.


def downgrade() -> None:
    # Only run this migration for SQLite
    if settings.letta_pg_uri_no_default:
        return

    # SQLite downgrade is not supported
    raise NotImplementedError("SQLite downgrade is not supported. Use a fresh database instead.")
