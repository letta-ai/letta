"""Add monotonically increasing IDs to messages table

Revision ID: e991d2e3b428
Revises: 74f2ede29317
Create Date: 2025-04-01 17:02:59.820272

"""

import sys
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op
from letta.settings import settings

# revision identifiers, used by Alembic.
revision: str = "e991d2e3b428"
down_revision: Union[str, None] = "74f2ede29317"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# --- Configuration ---
TABLE_NAME = "messages"
COLUMN_NAME = "sequence_id"
SEQUENCE_NAME = "message_seq_id"
INDEX_NAME = "ix_messages_agent_sequence"
UNIQUE_CONSTRAINT_NAME = f"uq_{TABLE_NAME}_{COLUMN_NAME}"

# Columns to determine the order for back-filling existing data
ORDERING_COLUMNS = ["created_at", "id"]


def print_flush(message):
    """Helper function to print and flush stdout immediately."""
    print(message)
    sys.stdout.flush()


def upgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    """Adds sequence_id, backfills data, adds constraints and index."""
    print_flush(f"\n--- Starting upgrade for revision {revision} ---")

    # Step 1: Add the sequence_id column to the table, initially allowing NULL values.
    # This allows us to add and backfill data without immediately enforcing NOT NULL.
    print_flush(f"Step 1: Adding nullable column '{COLUMN_NAME}' to table '{TABLE_NAME}'...")
    op.add_column(TABLE_NAME, sa.Column(COLUMN_NAME, sa.BigInteger(), nullable=True))

    # Step 2: Create a new PostgreSQL sequence.
    # This sequence will later be used as the server-side default for generating new sequence_id values.
    print_flush(f"Step 2: Creating sequence '{SEQUENCE_NAME}'...")
    op.execute(f"CREATE SEQUENCE {SEQUENCE_NAME} START 1;")

    # Step 3: Backfill the sequence_id for existing rows based on a defined ordering.
    # The SQL query does the following:
    #   - Uses a Common Table Expression named 'numbered_rows' to compute a row number for each row.
    #   - The ROW_NUMBER() window function assigns a sequential number (rn) to each row, ordered by the columns specified
    #     in ORDERING_COLUMNS (e.g., created_at, id) in ascending order.
    #   - The UPDATE statement then sets each row's sequence_id to its corresponding row number (rn)
    #     by joining the original table with the CTE on the id column.
    print_flush(f"Step 3: Backfilling '{COLUMN_NAME}' based on order: {', '.join(ORDERING_COLUMNS)}...")
    print_flush("         (This may take a while on large tables)")
    try:
        op.execute(
            f"""
            WITH numbered_rows AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY {', '.join(ORDERING_COLUMNS)} ASC) as rn
                FROM {TABLE_NAME}
            )
            UPDATE {TABLE_NAME}
            SET {COLUMN_NAME} = numbered_rows.rn
            FROM numbered_rows
            WHERE {TABLE_NAME}.id = numbered_rows.id;
            """
        )
        print_flush("         Backfill successful.")
    except Exception as e:
        print_flush(f"!!! ERROR during backfill: {e}")
        print_flush("!!! Migration failed. Manual intervention might be needed.")
        raise

    # Step 4: Set the sequence's next value to be one more than the current maximum sequence_id.
    # The query works as follows:
    #   - It calculates the maximum value in the sequence_id column using MAX({COLUMN_NAME}).
    #   - COALESCE is used to default to 0 if there are no rows (i.e., the table is empty).
    #   - It then adds 1 to ensure that the next call to nextval() returns a number higher than any existing value.
    #   - The 'false' argument tells PostgreSQL that the next nextval() should return the value as-is, without pre-incrementing.
    print_flush(f"Step 4: Setting sequence '{SEQUENCE_NAME}' to next value after backfill...")
    op.execute(
        f"""
        SELECT setval('{SEQUENCE_NAME}', COALESCE(MAX({COLUMN_NAME}), 0) + 1, false)
        FROM {TABLE_NAME};
        """
    )

    # Step 5: Now that every row has a sequence_id, alter the column to be NOT NULL.
    # This enforces that all rows must have a valid sequence_id.
    print_flush(f"Step 5: Altering column '{COLUMN_NAME}' to NOT NULL...")
    op.alter_column(TABLE_NAME, COLUMN_NAME, existing_type=sa.BigInteger(), nullable=False)

    # Step 6: Add a UNIQUE constraint on sequence_id to ensure its values remain distinct.
    # This mirrors the model definition where sequence_id is defined as unique.
    print_flush(f"Step 6: Creating unique constraint '{UNIQUE_CONSTRAINT_NAME}' on '{COLUMN_NAME}'...")
    op.create_unique_constraint(UNIQUE_CONSTRAINT_NAME, TABLE_NAME, [COLUMN_NAME])

    # Step 7: Set the server-side default for sequence_id so that future inserts automatically use the sequence.
    # The server default calls nextval() on the sequence, and the "::regclass" cast helps PostgreSQL resolve the sequence name correctly.
    print_flush(f"Step 7: Setting server default for '{COLUMN_NAME}' to use sequence '{SEQUENCE_NAME}'...")
    op.alter_column(TABLE_NAME, COLUMN_NAME, existing_type=sa.BigInteger(), server_default=sa.text(f"nextval('{SEQUENCE_NAME}'::regclass)"))

    # Step 8: Create an index on (agent_id, sequence_id) to improve performance of queries filtering on these columns.
    print_flush(f"Step 8: Creating index '{INDEX_NAME}' on (agent_id, {COLUMN_NAME})...")
    op.create_index(INDEX_NAME, TABLE_NAME, ["agent_id", COLUMN_NAME], unique=False)

    print_flush(f"--- Upgrade for revision {revision} complete ---")


def downgrade() -> None:
    # Skip this migration for SQLite
    if not settings.letta_pg_uri_no_default:
        return

    """Reverses the changes made in the upgrade function."""
    print_flush(f"\n--- Starting downgrade from revision {revision} ---")

    # 1. Drop the index
    print_flush(f"Step 1: Dropping index '{INDEX_NAME}'...")
    op.drop_index(INDEX_NAME, table_name=TABLE_NAME)

    # 2. Remove the server-side default
    print_flush(f"Step 2: Removing server default from '{COLUMN_NAME}'...")
    op.alter_column(TABLE_NAME, COLUMN_NAME, existing_type=sa.BigInteger(), server_default=None)

    # 3. Drop the unique constraint (using the explicit name)
    print_flush(f"Step 3: Dropping unique constraint '{UNIQUE_CONSTRAINT_NAME}'...")
    op.drop_constraint(UNIQUE_CONSTRAINT_NAME, TABLE_NAME, type_="unique")

    # 4. Drop the column (this implicitly removes the NOT NULL constraint)
    print_flush(f"Step 4: Dropping column '{COLUMN_NAME}'...")
    op.drop_column(TABLE_NAME, COLUMN_NAME)

    # 5. Drop the sequence
    print_flush(f"Step 5: Dropping sequence '{SEQUENCE_NAME}'...")
    op.execute(f"DROP SEQUENCE IF EXISTS {SEQUENCE_NAME};")  # Use IF EXISTS for safety

    print_flush(f"--- Downgrade from revision {revision} complete ---")
