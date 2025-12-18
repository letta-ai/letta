"""Add OAuth fields to providers table

Revision ID: oauth_providers_001
Revises: ffb17eb241fc
Create Date: 2025-12-17

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "oauth_providers_001"
down_revision: Union[str, None] = "d0880aae6cee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add OAuth fields to providers table for OAuth-based authentication."""

    # Add auth_type column to distinguish between API key and OAuth authentication
    op.add_column(
        "providers",
        sa.Column("auth_type", sa.String(20), nullable=False, server_default="api_key"),
    )

    # Add OAuth access token (encrypted)
    op.add_column(
        "providers",
        sa.Column("oauth_access_token_enc", sa.Text(), nullable=True),
    )

    # Add OAuth refresh token (encrypted)
    op.add_column(
        "providers",
        sa.Column("oauth_refresh_token_enc", sa.Text(), nullable=True),
    )

    # Add OAuth token type (e.g., "Bearer")
    op.add_column(
        "providers",
        sa.Column("oauth_token_type", sa.String(50), nullable=True),
    )

    # Add OAuth token expiry timestamp
    op.add_column(
        "providers",
        sa.Column("oauth_expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add OAuth scope
    op.add_column(
        "providers",
        sa.Column("oauth_scope", sa.Text(), nullable=True),
    )

    # Add OAuth client ID
    op.add_column(
        "providers",
        sa.Column("oauth_client_id", sa.Text(), nullable=True),
    )

    # Add OAuth client secret (encrypted) - needed for token refresh
    op.add_column(
        "providers",
        sa.Column("oauth_client_secret_enc", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Remove OAuth fields from providers table."""
    op.drop_column("providers", "oauth_client_secret_enc")
    op.drop_column("providers", "oauth_client_id")
    op.drop_column("providers", "oauth_scope")
    op.drop_column("providers", "oauth_expires_at")
    op.drop_column("providers", "oauth_token_type")
    op.drop_column("providers", "oauth_refresh_token_enc")
    op.drop_column("providers", "oauth_access_token_enc")
    op.drop_column("providers", "auth_type")
