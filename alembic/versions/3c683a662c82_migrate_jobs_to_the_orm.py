"""Migrate jobs to the orm

Revision ID: 3c683a662c82
Revises: 5987401b40ae
Create Date: 2024-12-04 15:59:41.708396

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3c683a662c82"
down_revision: Union[str, None] = "5987401b40ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("jobs", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True))
    op.add_column("jobs", sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False))
    op.add_column("jobs", sa.Column("_created_by_id", sa.String(), nullable=True))
    op.add_column("jobs", sa.Column("_last_updated_by_id", sa.String(), nullable=True))
    op.alter_column("jobs", "status", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("jobs", "completed_at", existing_type=postgresql.TIMESTAMP(timezone=True), type_=sa.DateTime(), existing_nullable=True)
    op.alter_column("jobs", "user_id", existing_type=sa.VARCHAR(), nullable=False)
    op.create_foreign_key(None, "jobs", "users", ["user_id"], ["id"])
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, "jobs", type_="foreignkey")
    op.alter_column("jobs", "user_id", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column("jobs", "completed_at", existing_type=sa.DateTime(), type_=postgresql.TIMESTAMP(timezone=True), existing_nullable=True)
    op.alter_column("jobs", "status", existing_type=sa.VARCHAR(), nullable=True)
    op.drop_column("jobs", "_last_updated_by_id")
    op.drop_column("jobs", "_created_by_id")
    op.drop_column("jobs", "is_deleted")
    op.drop_column("jobs", "updated_at")
    # ### end Alembic commands ###
