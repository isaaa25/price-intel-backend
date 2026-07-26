"""update_discovered_by_constraint

Revision ID: 2ca9dfdd8613
Revises: 2b1a30222c98
Create Date: 2026-07-06 16:07:22.956331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ca9dfdd8613'
down_revision: Union[str, Sequence[str], None] = '2b1a30222c98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        'competitor_listings_discovered_by_check',
        'competitor_listings',
        type_='check'
    )
    op.create_check_constraint(
        'competitor_listings_discovered_by_check',
        'competitor_listings',
        """discovered_by IN (
            'manual',
            'google_shopping',
            'daraz_search',
            'shopify_search',
            'noon_search',
            'noon_store',
            'search_scraper',
            'store_scraper'
        )"""
    )


def downgrade() -> None:
    op.drop_constraint(
        'competitor_listings_discovered_by_check',
        'competitor_listings',
        type_='check'
    )
    op.create_check_constraint(
        'competitor_listings_discovered_by_check',
        'competitor_listings',
        "discovered_by IN ('manual', 'google_shopping', 'daraz_search', 'shopify_search')"
    )
