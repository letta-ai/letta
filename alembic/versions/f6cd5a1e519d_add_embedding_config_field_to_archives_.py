"""Add embedding config field to Archives table

Revision ID: f6cd5a1e519d
Revises: c6c43222e2de
Create Date: 2025-10-23 16:33:53.661122

"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text

import letta.orm
from alembic import op
from letta.schemas.embedding_config import EmbeddingConfig

# revision identifiers, used by Alembic.
revision: str = "f6cd5a1e519d"
down_revision: Union[str, None] = "c6c43222e2de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # step 1: add column as nullable
    op.add_column("archives", sa.Column("embedding_config", letta.orm.custom_columns.EmbeddingConfigColumn(), nullable=True))

    # step 2: backfill existing archives with embedding configs in batches
    connection = op.get_bind()

    # default embedding config for archives without passages
    default_config = EmbeddingConfig.default_config(model_name="letta")
    default_embedding_config = default_config.model_dump()

    batch_size = 100
    processed = 0

    # process in batches until no more archives need backfilling
    while True:
        archives = connection.execute(
            text("SELECT id FROM archives WHERE embedding_config IS NULL LIMIT :batch_size"), {"batch_size": batch_size}
        ).fetchall()

        if not archives:
            break

        for archive in archives:
            archive_id = archive[0]

            # check if archive has passages
            first_passage = connection.execute(
                text("SELECT embedding_config FROM archival_passages WHERE archive_id = :archive_id AND is_deleted = FALSE LIMIT 1"),
                {"archive_id": archive_id},
            ).fetchone()

            if first_passage and first_passage[0]:
                embedding_config = first_passage[0]
            else:
                embedding_config = default_embedding_config

            # serialize the embedding config to JSON string for raw SQL
            config_json = json.dumps(embedding_config)

            connection.execute(
                text("UPDATE archives SET embedding_config = :config WHERE id = :archive_id"),
                {"config": config_json, "archive_id": archive_id},
            )

        processed += len(archives)
        print(f"Backfilled {processed} archives so far...")

        connection.execute(text("COMMIT"))

    print(f"Backfill complete. Total archives processed: {processed}")

    # step 3: make column non-nullable
    op.alter_column("archives", "embedding_config", nullable=False)


def downgrade() -> None:
    op.drop_column("archives", "embedding_config")
