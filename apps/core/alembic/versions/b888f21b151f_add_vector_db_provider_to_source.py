"""Add vector db provider to source

Revision ID: b888f21b151f
Revises: 750dd87faa12
Create Date: 2025-09-08 14:49:58.846429

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "b888f21b151f"
down_revision: Union[str, None] = "750dd87faa12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # determine backfill value based on current pinecone settings
    try:
        from pinecone import IndexEmbed, PineconeAsyncio

        pinecone_available = True
    except ImportError:
        pinecone_available = False

    use_pinecone = all(
        [
            pinecone_available,
            settings.enable_pinecone,
            settings.pinecone_api_key,
            settings.pinecone_agent_index,
            settings.pinecone_source_index,
        ]
    )

    if settings.letta_pg_uri_no_default:
        # commit required before altering enum in postgresql
        connection = op.get_bind()
        connection.execute(sa.text("COMMIT"))
        connection.execute(sa.text("ALTER TYPE vectordbprovider ADD VALUE IF NOT EXISTS 'PINECONE'"))
        connection.execute(sa.text("COMMIT"))

        vectordbprovider = sa.Enum("NATIVE", "TPUF", "PINECONE", name="vectordbprovider", create_type=False)

        op.add_column("sources", sa.Column("vector_db_provider", vectordbprovider, nullable=True))

        if use_pinecone:
            op.execute("UPDATE sources SET vector_db_provider = 'PINECONE' WHERE vector_db_provider IS NULL")
        else:
            op.execute("UPDATE sources SET vector_db_provider = 'NATIVE' WHERE vector_db_provider IS NULL")

        op.alter_column("sources", "vector_db_provider", nullable=False)
    else:
        op.add_column("sources", sa.Column("vector_db_provider", sa.String(), nullable=True))

        if use_pinecone:
            op.execute("UPDATE sources SET vector_db_provider = 'PINECONE' WHERE vector_db_provider IS NULL")
        else:
            op.execute("UPDATE sources SET vector_db_provider = 'NATIVE' WHERE vector_db_provider IS NULL")


def downgrade() -> None:
    op.drop_column("sources", "vector_db_provider")
    # enum type remains as postgresql doesn't support removing values
