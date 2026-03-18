from connectors.base import BaseConnector, ConnectorDocument, register_connector


class DatabaseConnector(BaseConnector):
    connector_type = "database"
    display_name = "Database (SQL / MongoDB)"
    description = "Connect to SQL or MongoDB databases"
    icon = "database"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("connection_string"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement database query and document extraction
        return []

    def get_config_schema(self) -> dict:
        return {
            "db_type": {"type": "select", "label": "Database Type", "required": True, "options": ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "SQL Server"]},
            "connection_string": {"type": "password", "label": "Connection String", "required": True},
            "query": {"type": "textarea", "label": "Query (optional)", "required": False},
        }


register_connector(DatabaseConnector())
