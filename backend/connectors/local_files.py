from connectors.base import BaseConnector, ConnectorDocument, register_connector


class LocalFileConnector(BaseConnector):
    connector_type = "local_files"
    display_name = "Local Files"
    description = "Upload files directly from your computer"
    icon = "folder"

    async def validate_connection(self, config: dict) -> bool:
        return True

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # Local files are uploaded directly via the API, not fetched
        return []

    def get_config_schema(self) -> dict:
        return {}  # No config needed - files are uploaded directly


# Auto-register
register_connector(LocalFileConnector())
