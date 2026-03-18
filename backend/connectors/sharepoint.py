from connectors.base import BaseConnector, ConnectorDocument, register_connector


class SharePointConnector(BaseConnector):
    connector_type = "sharepoint"
    display_name = "SharePoint / OneDrive"
    description = "Connect to Microsoft SharePoint or OneDrive"
    icon = "microsoft"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("client_id") and config.get("client_secret"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Microsoft Graph API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "client_id": {"type": "text", "label": "Client ID", "required": True},
            "client_secret": {"type": "password", "label": "Client Secret", "required": True},
            "tenant_id": {"type": "text", "label": "Tenant ID", "required": True},
            "site_url": {"type": "text", "label": "SharePoint Site URL", "required": False},
        }


register_connector(SharePointConnector())
