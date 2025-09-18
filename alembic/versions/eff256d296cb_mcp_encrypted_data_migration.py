"""mcp encrypted data migration

Revision ID: eff256d296cb
Revises: 7f7933666957
Create Date: 2025-09-16 16:01:58.943318

"""

import json
import os

# Add the app directory to path to import our crypto utils
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import JSON, String, Text
from sqlalchemy.sql import column, table

from alembic import op
from letta.helpers.crypto_utils import CryptoUtils

# revision identifiers, used by Alembic.
revision: str = "eff256d296cb"
down_revision: Union[str, None] = "7f7933666957"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if encryption key is available
    encryption_key = os.environ.get("LETTA_ENCRYPTION_KEY")
    if not encryption_key:
        print("WARNING: LETTA_ENCRYPTION_KEY not set. Skipping data encryption migration.")
        print("You can run a separate migration script later to encrypt existing data.")
        return

    # Get database connection
    connection = op.get_bind()

    # Batch processing configuration
    BATCH_SIZE = 1000  # Process 1000 rows at a time

    # Migrate mcp_oauth data
    print("Migrating mcp_oauth encrypted fields...")
    mcp_oauth = table(
        "mcp_oauth",
        column("id", String),
        column("access_token", Text),
        column("access_token_enc", Text),
        column("refresh_token", Text),
        column("refresh_token_enc", Text),
        column("client_secret", Text),
        column("client_secret_enc", Text),
    )

    # Count total rows to process
    total_count_result = connection.execute(
        sa.select(sa.func.count())
        .select_from(mcp_oauth)
        .where(
            sa.and_(
                sa.or_(mcp_oauth.c.access_token.isnot(None), mcp_oauth.c.refresh_token.isnot(None), mcp_oauth.c.client_secret.isnot(None)),
                # Only count rows that need encryption
                sa.or_(
                    sa.and_(mcp_oauth.c.access_token.isnot(None), mcp_oauth.c.access_token_enc.is_(None)),
                    sa.and_(mcp_oauth.c.refresh_token.isnot(None), mcp_oauth.c.refresh_token_enc.is_(None)),
                    sa.and_(mcp_oauth.c.client_secret.isnot(None), mcp_oauth.c.client_secret_enc.is_(None)),
                ),
            )
        )
    ).scalar()

    if total_count_result and total_count_result > 0:
        print(f"Found {total_count_result} mcp_oauth records that need encryption")

        encrypted_count = 0
        skipped_count = 0
        offset = 0

        # Process in batches
        while True:
            # Select batch of rows
            oauth_rows = connection.execute(
                sa.select(
                    mcp_oauth.c.id,
                    mcp_oauth.c.access_token,
                    mcp_oauth.c.access_token_enc,
                    mcp_oauth.c.refresh_token,
                    mcp_oauth.c.refresh_token_enc,
                    mcp_oauth.c.client_secret,
                    mcp_oauth.c.client_secret_enc,
                )
                .where(
                    sa.and_(
                        sa.or_(
                            mcp_oauth.c.access_token.isnot(None),
                            mcp_oauth.c.refresh_token.isnot(None),
                            mcp_oauth.c.client_secret.isnot(None),
                        ),
                        # Only select rows that need encryption
                        sa.or_(
                            sa.and_(mcp_oauth.c.access_token.isnot(None), mcp_oauth.c.access_token_enc.is_(None)),
                            sa.and_(mcp_oauth.c.refresh_token.isnot(None), mcp_oauth.c.refresh_token_enc.is_(None)),
                            sa.and_(mcp_oauth.c.client_secret.isnot(None), mcp_oauth.c.client_secret_enc.is_(None)),
                        ),
                    )
                )
                .order_by(mcp_oauth.c.id)  # Ensure consistent ordering
                .limit(BATCH_SIZE)
                .offset(offset)
            ).fetchall()

            if not oauth_rows:
                break  # No more rows to process

            # Prepare batch updates
            batch_updates = []

            for row in oauth_rows:
                updates = {"id": row.id}
                has_updates = False

                # Encrypt access_token if present and not already encrypted
                if row.access_token and not row.access_token_enc:
                    try:
                        updates["access_token_enc"] = CryptoUtils.encrypt(row.access_token, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt access_token for mcp_oauth id={row.id}: {e}")
                elif row.access_token_enc:
                    skipped_count += 1

                # Encrypt refresh_token if present and not already encrypted
                if row.refresh_token and not row.refresh_token_enc:
                    try:
                        updates["refresh_token_enc"] = CryptoUtils.encrypt(row.refresh_token, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt refresh_token for mcp_oauth id={row.id}: {e}")
                elif row.refresh_token_enc:
                    skipped_count += 1

                # Encrypt client_secret if present and not already encrypted
                if row.client_secret and not row.client_secret_enc:
                    try:
                        updates["client_secret_enc"] = CryptoUtils.encrypt(row.client_secret, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt client_secret for mcp_oauth id={row.id}: {e}")
                elif row.client_secret_enc:
                    skipped_count += 1

                if has_updates:
                    batch_updates.append(updates)
                    encrypted_count += 1

            # Execute batch update if there are updates
            if batch_updates:
                # Use bulk update for better performance
                for update_data in batch_updates:
                    row_id = update_data.pop("id")
                    if update_data:  # Only update if there are fields to update
                        connection.execute(mcp_oauth.update().where(mcp_oauth.c.id == row_id).values(**update_data))

            # Progress indicator for large datasets
            if encrypted_count > 0 and encrypted_count % 10000 == 0:
                print(f"  Progress: Encrypted {encrypted_count} mcp_oauth records...")

            offset += BATCH_SIZE

            # For very large datasets, commit periodically to avoid long transactions
            if encrypted_count > 0 and encrypted_count % 50000 == 0:
                connection.commit()

        print(f"mcp_oauth: Encrypted {encrypted_count} records, skipped {skipped_count} already encrypted fields")
    else:
        print("mcp_oauth: No records need encryption")

    # Migrate mcp_server data
    print("Migrating mcp_server encrypted fields...")
    mcp_server = table(
        "mcp_server",
        column("id", String),
        column("token", String),
        column("token_enc", Text),
        column("custom_headers", JSON),
        column("custom_headers_enc", Text),
    )

    # Count total rows to process
    total_count_result = connection.execute(
        sa.select(sa.func.count())
        .select_from(mcp_server)
        .where(
            sa.and_(
                sa.or_(mcp_server.c.token.isnot(None), mcp_server.c.custom_headers.isnot(None)),
                # Only count rows that need encryption
                sa.or_(
                    sa.and_(mcp_server.c.token.isnot(None), mcp_server.c.token_enc.is_(None)),
                    sa.and_(mcp_server.c.custom_headers.isnot(None), mcp_server.c.custom_headers_enc.is_(None)),
                ),
            )
        )
    ).scalar()

    if total_count_result and total_count_result > 0:
        print(f"Found {total_count_result} mcp_server records that need encryption")

        encrypted_count = 0
        skipped_count = 0
        offset = 0

        # Process in batches
        while True:
            # Select batch of rows
            server_rows = connection.execute(
                sa.select(
                    mcp_server.c.id,
                    mcp_server.c.token,
                    mcp_server.c.token_enc,
                    mcp_server.c.custom_headers,
                    mcp_server.c.custom_headers_enc,
                )
                .where(
                    sa.and_(
                        sa.or_(mcp_server.c.token.isnot(None), mcp_server.c.custom_headers.isnot(None)),
                        # Only select rows that need encryption
                        sa.or_(
                            sa.and_(mcp_server.c.token.isnot(None), mcp_server.c.token_enc.is_(None)),
                            sa.and_(mcp_server.c.custom_headers.isnot(None), mcp_server.c.custom_headers_enc.is_(None)),
                        ),
                    )
                )
                .order_by(mcp_server.c.id)  # Ensure consistent ordering
                .limit(BATCH_SIZE)
                .offset(offset)
            ).fetchall()

            if not server_rows:
                break  # No more rows to process

            # Prepare batch updates
            batch_updates = []

            for row in server_rows:
                updates = {"id": row.id}
                has_updates = False

                # Encrypt token if present and not already encrypted
                if row.token and not row.token_enc:
                    try:
                        updates["token_enc"] = CryptoUtils.encrypt(row.token, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt token for mcp_server id={row.id}: {e}")
                elif row.token_enc:
                    skipped_count += 1

                # Encrypt custom_headers if present (JSON field) and not already encrypted
                if row.custom_headers and not row.custom_headers_enc:
                    try:
                        # Convert JSON to string for encryption
                        headers_json = json.dumps(row.custom_headers)
                        updates["custom_headers_enc"] = CryptoUtils.encrypt(headers_json, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt custom_headers for mcp_server id={row.id}: {e}")
                elif row.custom_headers_enc:
                    skipped_count += 1

                if has_updates:
                    batch_updates.append(updates)
                    encrypted_count += 1

            # Execute batch update if there are updates
            if batch_updates:
                # Use bulk update for better performance
                for update_data in batch_updates:
                    row_id = update_data.pop("id")
                    if update_data:  # Only update if there are fields to update
                        connection.execute(mcp_server.update().where(mcp_server.c.id == row_id).values(**update_data))

            # Progress indicator for large datasets
            if encrypted_count > 0 and encrypted_count % 10000 == 0:
                print(f"  Progress: Encrypted {encrypted_count} mcp_server records...")

            offset += BATCH_SIZE

            # For very large datasets, commit periodically to avoid long transactions
            if encrypted_count > 0 and encrypted_count % 50000 == 0:
                connection.commit()

        print(f"mcp_server: Encrypted {encrypted_count} records, skipped {skipped_count} already encrypted fields")
    else:
        print("mcp_server: No records need encryption")
    print("Migration complete. Plaintext columns are retained for rollback safety.")


def downgrade() -> None:
    pass
