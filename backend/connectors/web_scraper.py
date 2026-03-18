from connectors.base import BaseConnector, ConnectorDocument, register_connector


class WebScraperConnector(BaseConnector):
    connector_type = "web_scraper"
    display_name = "Web Reference"
    description = "Scrape and index any URL — client sites, competitor references, inspiration pages"
    icon = "globe"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("urls"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement web scraping with BeautifulSoup
        return []

    def get_config_schema(self) -> dict:
        return {
            "urls": {"type": "textarea", "label": "URLs (one per line)", "required": True},
            "depth": {"type": "number", "label": "Crawl Depth", "required": False, "default": 1},
        }


register_connector(WebScraperConnector())
