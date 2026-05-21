from app.models.user import User
from app.models.tracked_product import TrackedProduct
from app.models.scraper_profile import ScraperProfile
from app.models.proxy import Proxy
from app.models.extraction_config import ExtractionConfig
from app.models.competitor_listing import CompetitorListing  # needs TrackedProduct
from app.models.scrape_job import ScrapeJob                  # needs CompetitorListing, ScraperProfile
from app.models.price_snapshot import PriceSnapshot          # needs CompetitorListing, ScrapeJob
from app.models.alert import Alert    