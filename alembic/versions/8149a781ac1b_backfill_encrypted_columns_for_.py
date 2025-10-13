"""backfill encrypted columns for providers, mcp, sandbox

Revision ID: 8149a781ac1b
Revises: 066857381578
Create Date: 2025-10-13 13:35:55.929562

"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import String, Text
from sqlalchemy.sql import column, table

from alembic import op
from letta.helpers.crypto_utils import CryptoUtils

# revision identifiers, used by Alembic.
revision: str = "8149a781ac1b"
down_revision: Union[str, None] = "066857381578"
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

    # Migrate providers data
    print("Migrating providers encrypted fields...")
    providers = table(
        "providers",
        column("id", String),
        column("api_key", String),
        column("api_key_enc", Text),
        column("access_key", String),
        column("access_key_enc", Text),
    )

    # Count total rows to process
    total_count_result = connection.execute(
        sa.select(sa.func.count())
        .select_from(providers)
        .where(
            sa.and_(
                sa.or_(providers.c.api_key.isnot(None), providers.c.access_key.isnot(None)),
                # Only count rows that need encryption
                sa.or_(
                    sa.and_(providers.c.api_key.isnot(None), providers.c.api_key_enc.is_(None)),
                    sa.and_(providers.c.access_key.isnot(None), providers.c.access_key_enc.is_(None)),
                ),
            )
        )
    ).scalar()

    if total_count_result and total_count_result > 0:
        print(f"Found {total_count_result} providers records that need encryption")

        encrypted_count = 0
        skipped_count = 0
        offset = 0

        # Process in batches
        while True:
            # Select batch of rows
            provider_rows = connection.execute(
                sa.select(
                    providers.c.id,
                    providers.c.api_key,
                    providers.c.api_key_enc,
                    providers.c.access_key,
                    providers.c.access_key_enc,
                )
                .where(
                    sa.and_(
                        sa.or_(providers.c.api_key.isnot(None), providers.c.access_key.isnot(None)),
                        # Only select rows that need encryption
                        sa.or_(
                            sa.and_(providers.c.api_key.isnot(None), providers.c.api_key_enc.is_(None)),
                            sa.and_(providers.c.access_key.isnot(None), providers.c.access_key_enc.is_(None)),
                        ),
                    )
                )
                .order_by(providers.c.id)  # Ensure consistent ordering
                .limit(BATCH_SIZE)
                .offset(offset)
            ).fetchall()

            if not provider_rows:
                break  # No more rows to process

            # Prepare batch updates
            batch_updates = []

            for row in provider_rows:
                updates = {"id": row.id}
                has_updates = False

                # Encrypt api_key if present and not already encrypted
                if row.api_key and not row.api_key_enc:
                    try:
                        updates["api_key_enc"] = CryptoUtils.encrypt(row.api_key, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt api_key for providers id={row.id}: {e}")
                elif row.api_key_enc:
                    skipped_count += 1

                # Encrypt access_key if present and not already encrypted
                if row.access_key and not row.access_key_enc:
                    try:
                        updates["access_key_enc"] = CryptoUtils.encrypt(row.access_key, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt access_key for providers id={row.id}: {e}")
                elif row.access_key_enc:
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
                        connection.execute(providers.update().where(providers.c.id == row_id).values(**update_data))

            # Progress indicator for large datasets
            if encrypted_count > 0 and encrypted_count % 10000 == 0:
                print(f"  Progress: Encrypted {encrypted_count} providers records...")

            offset += BATCH_SIZE

            # For very large datasets, commit periodically to avoid long transactions
            if encrypted_count > 0 and encrypted_count % 50000 == 0:
                connection.commit()

        print(f"providers: Encrypted {encrypted_count} records, skipped {skipped_count} already encrypted fields")
    else:
        print("providers: No records need encryption")

    # Migrate sandbox_environment_variables data
    print("Migrating sandbox_environment_variables encrypted fields...")
    sandbox_environment_variables = table(
        "sandbox_environment_variables",
        column("id", String),
        column("value", String),
        column("value_enc", Text),
    )

    # Count total rows to process
    total_count_result = connection.execute(
        sa.select(sa.func.count())
        .select_from(sandbox_environment_variables)
        .where(
            sa.and_(
                sandbox_environment_variables.c.value.isnot(None),
                sandbox_environment_variables.c.value_enc.is_(None),
            )
        )
    ).scalar()

    if total_count_result and total_count_result > 0:
        print(f"Found {total_count_result} sandbox_environment_variables records that need encryption")

        encrypted_count = 0
        skipped_count = 0
        offset = 0

        # Process in batches
        while True:
            # Select batch of rows
            env_var_rows = connection.execute(
                sa.select(
                    sandbox_environment_variables.c.id,
                    sandbox_environment_variables.c.value,
                    sandbox_environment_variables.c.value_enc,
                )
                .where(
                    sa.and_(
                        sandbox_environment_variables.c.value.isnot(None),
                        sandbox_environment_variables.c.value_enc.is_(None),
                    )
                )
                .order_by(sandbox_environment_variables.c.id)  # Ensure consistent ordering
                .limit(BATCH_SIZE)
                .offset(offset)
            ).fetchall()

            if not env_var_rows:
                break  # No more rows to process

            # Prepare batch updates
            batch_updates = []

            for row in env_var_rows:
                updates = {"id": row.id}
                has_updates = False

                # Encrypt value if present and not already encrypted
                if row.value and not row.value_enc:
                    try:
                        updates["value_enc"] = CryptoUtils.encrypt(row.value, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt value for sandbox_environment_variables id={row.id}: {e}")
                elif row.value_enc:
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
                        connection.execute(
                            sandbox_environment_variables.update().where(sandbox_environment_variables.c.id == row_id).values(**update_data)
                        )

            # Progress indicator for large datasets
            if encrypted_count > 0 and encrypted_count % 10000 == 0:
                print(f"  Progress: Encrypted {encrypted_count} sandbox_environment_variables records...")

            offset += BATCH_SIZE

            # For very large datasets, commit periodically to avoid long transactions
            if encrypted_count > 0 and encrypted_count % 50000 == 0:
                connection.commit()

        print(f"sandbox_environment_variables: Encrypted {encrypted_count} records, skipped {skipped_count} already encrypted fields")
    else:
        print("sandbox_environment_variables: No records need encryption")

    # Migrate mcp_oauth data (only authorization_code field)
    print("Migrating mcp_oauth encrypted fields...")
    mcp_oauth = table(
        "mcp_oauth",
        column("id", String),
        column("authorization_code", Text),
        column("authorization_code_enc", Text),
    )

    # Count total rows to process
    total_count_result = connection.execute(
        sa.select(sa.func.count())
        .select_from(mcp_oauth)
        .where(
            sa.and_(
                mcp_oauth.c.authorization_code.isnot(None),
                mcp_oauth.c.authorization_code_enc.is_(None),
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
                    mcp_oauth.c.authorization_code,
                    mcp_oauth.c.authorization_code_enc,
                )
                .where(
                    sa.and_(
                        mcp_oauth.c.authorization_code.isnot(None),
                        mcp_oauth.c.authorization_code_enc.is_(None),
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

                # Encrypt authorization_code if present and not already encrypted
                if row.authorization_code and not row.authorization_code_enc:
                    try:
                        updates["authorization_code_enc"] = CryptoUtils.encrypt(row.authorization_code, encryption_key)
                        has_updates = True
                    except Exception as e:
                        print(f"Warning: Failed to encrypt authorization_code for mcp_oauth id={row.id}: {e}")
                elif row.authorization_code_enc:
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
    print("Migration complete. Plaintext columns are retained for rollback safety.")


def downgrade() -> None:
    pass
