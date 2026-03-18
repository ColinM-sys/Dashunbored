from connectors.base import BaseConnector, ConnectorDocument, register_connector


class DropboxConnector(BaseConnector):
    connector_type = "dropbox"
    display_name = "Dropbox"
    description = "Connect to Dropbox and sync files"
    icon = "dropbox"

    async def validate_connection(self, config: dict) -> bool:
        token = config.get("access_token")
        return bool(token)

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Dropbox API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "access_token": {"type": "password", "label": "Access Token", "required": True},
            "folder_path": {"type": "text", "label": "Folder Path", "required": False, "default": "/"},
        }


register_connector(DropboxConnector())
