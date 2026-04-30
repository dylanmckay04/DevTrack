"""github_oauth_fields

Revision ID: a1b2c3d4e5f6
Revises: 122b0945b5a7
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '122b0945b5a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'hashed_password', nullable=True)
    op.add_column('users', sa.Column('github_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_github_id', 'users', ['github_id'])
    op.create_index('ix_users_github_id', 'users', ['github_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_github_id', table_name='users')
    op.drop_constraint('uq_users_github_id', 'users', type_='unique')
    op.drop_column('users', 'github_id')
    op.alter_column('users', 'hashed_password', nullable=False)
