from connectors.base import BaseConnector, ConnectorDocument, register_connector


class S3Connector(BaseConnector):
    connector_type = "aws_s3"
    display_name = "Amazon S3"
    description = "Connect to AWS S3 buckets"
    icon = "aws"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("access_key") and config.get("secret_key") and config.get("bucket"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement S3 fetch with boto3
        return []

    def get_config_schema(self) -> dict:
        return {
            "access_key": {"type": "text", "label": "Access Key ID", "required": True},
            "secret_key": {"type": "password", "label": "Secret Access Key", "required": True},
            "bucket": {"type": "text", "label": "Bucket Name", "required": True},
            "prefix": {"type": "text", "label": "Prefix / Folder (optional)", "required": False},
            "region": {"type": "text", "label": "Region", "required": False, "default": "us-east-1"},
        }


class AzureBlobConnector(BaseConnector):
    connector_type = "azure_blob"
    display_name = "Azure Blob Storage"
    description = "Connect to Azure Blob Storage containers"
    icon = "azure"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("connection_string") and config.get("container"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        # TODO: Implement Azure Blob fetch
        return []

    def get_config_schema(self) -> dict:
        return {
            "connection_string": {"type": "password", "label": "Connection String", "required": True},
            "container": {"type": "text", "label": "Container Name", "required": True},
            "prefix": {"type": "text", "label": "Prefix / Folder (optional)", "required": False},
        }


register_connector(S3Connector())
register_connector(AzureBlobConnector())
