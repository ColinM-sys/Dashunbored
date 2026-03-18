from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ConnectorDocument:
    content: str
    filename: str
    metadata: dict = None


class BaseConnector(ABC):
    connector_type: str = ""
    display_name: str = ""
    description: str = ""
    icon: str = ""

    @abstractmethod
    async def validate_connection(self, config: dict) -> bool:
        """Test if the connection config is valid."""
        ...

    @abstractmethod
    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        """Fetch all documents from this source."""
        ...

    @abstractmethod
    def get_config_schema(self) -> dict:
        """Return the config fields the admin needs to fill out."""
        ...


# Registry of all available connectors
_registry: dict[str, BaseConnector] = {}


def register_connector(connector: BaseConnector):
    _registry[connector.connector_type] = connector


def get_connector(connector_type: str) -> BaseConnector | None:
    return _registry.get(connector_type)


def get_all_connectors() -> dict[str, BaseConnector]:
    return _registry
