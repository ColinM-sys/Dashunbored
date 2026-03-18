from connectors.base import BaseConnector, ConnectorDocument, register_connector


class GoogleDriveConnector(BaseConnector):
    connector_type = "google_drive"
    display_name = "Google Drive"
    description = "Connect to Google Drive and sync documents"
    icon = "google-drive"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("credentials_json"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Google Drive API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "credentials_json": {"type": "file", "label": "Service Account JSON", "required": True},
            "folder_id": {"type": "text", "label": "Folder ID (optional)", "required": False},
        }


register_connector(GoogleDriveConnector())
