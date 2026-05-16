"""email verification

Revision ID: 0005
Revises: b2c3d4e5f6a7
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('verification_token', sa.String(), nullable=True))

    # OAuth users are already verified
    op.execute("""
               UPDATE users
               SET is_verified = TRUE
               WHERE github_id IS NOT NULL OR google_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column('users', 'verification_token')
    op.drop_column('users', 'is_verified')