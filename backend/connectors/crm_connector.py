from connectors.base import BaseConnector, ConnectorDocument, register_connector


class SalesforceConnector(BaseConnector):
    connector_type = "salesforce"
    display_name = "Salesforce"
    description = "Connect to Salesforce CRM"
    icon = "salesforce"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("client_id") and config.get("client_secret"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Salesforce API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "client_id": {"type": "text", "label": "Consumer Key", "required": True},
            "client_secret": {"type": "password", "label": "Consumer Secret", "required": True},
            "username": {"type": "text", "label": "Username", "required": True},
            "instance_url": {"type": "text", "label": "Instance URL", "required": True},
        }


class HubSpotConnector(BaseConnector):
    connector_type = "hubspot"
    display_name = "HubSpot"
    description = "Connect to HubSpot CRM"
    icon = "hubspot"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("api_key"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement HubSpot API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "api_key": {"type": "password", "label": "Private App Token", "required": True},
        }


register_connector(SalesforceConnector())
register_connector(HubSpotConnector())
