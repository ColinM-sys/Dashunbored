from connectors.base import BaseConnector, ConnectorDocument, register_connector


class SlackConnector(BaseConnector):
    connector_type = "slack"
    display_name = "Slack"
    description = "Connect to Slack and index channel messages"
    icon = "slack"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("bot_token"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Slack API fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "bot_token": {"type": "password", "label": "Bot Token (xoxb-...)", "required": True},
            "channels": {"type": "text", "label": "Channel Names (comma separated)", "required": False},
        }


class TeamsConnector(BaseConnector):
    connector_type = "teams"
    display_name = "Microsoft Teams"
    description = "Connect to Microsoft Teams and index messages"
    icon = "microsoft-teams"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("client_id") and config.get("client_secret"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Microsoft Graph API fetch for Teams
        return []

    def get_config_schema(self) -> dict:
        return {
            "client_id": {"type": "text", "label": "Client ID", "required": True},
            "client_secret": {"type": "password", "label": "Client Secret", "required": True},
            "tenant_id": {"type": "text", "label": "Tenant ID", "required": True},
            "team_name": {"type": "text", "label": "Team Name (optional)", "required": False},
        }


register_connector(SlackConnector())
register_connector(TeamsConnector())
