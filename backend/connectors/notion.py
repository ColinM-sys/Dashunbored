"""Notion connector.

Pulls creative project data from Notion:
- Pages and databases shared with the integration
- Useful for syncing creative briefs, shot lists, client notes, and project docs stored in Notion

API: https://developers.notion.com/
Auth: Internal Integration Token from Notion Settings → Integrations
"""

from connectors.base import BaseConnector, ConnectorDocument, register_connector


class NotionConnector(BaseConnector):
    connector_type = "notion"
    display_name = "Notion"
    description = "Sync pages and databases from Notion — creative briefs, shot lists, client notes, project docs"
    icon = "notion"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("token"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        token = config.get("token")
        if not token:
            return []

        docs = []
        try:
            import httpx
            headers = {
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient() as client:
                # Search all pages accessible to integration
                search_resp = await client.post(
                    "https://api.notion.com/v1/search",
                    headers=headers,
                    json={"filter": {"value": "page", "property": "object"}, "page_size": 50},
                    timeout=20,
                )
                if search_resp.status_code != 200:
                    return []

                for result in search_resp.json().get("results", []):
                    page_id = result.get("id")
                    props = result.get("properties", {})

                    # Get title
                    title = "Untitled"
                    for prop in props.values():
                        if prop.get("type") == "title":
                            title_parts = prop.get("title", [])
                            if title_parts:
                                title = "".join(t.get("plain_text", "") for t in title_parts)
                            break

                    # Fetch page content blocks
                    blocks_resp = await client.get(
                        f"https://api.notion.com/v1/blocks/{page_id}/children",
                        headers=headers,
                        params={"page_size": 100},
                        timeout=15,
                    )
                    content_lines = [f"Notion Page: {title}"]
                    if blocks_resp.status_code == 200:
                        for block in blocks_resp.json().get("results", []):
                            btype = block.get("type", "")
                            bdata = block.get(btype, {})
                            rich_text = bdata.get("rich_text", [])
                            text = "".join(t.get("plain_text", "") for t in rich_text)
                            if text:
                                prefix = "# " if "heading" in btype else ("• " if btype == "bulleted_list_item" else ("  " if btype == "to_do" else ""))
                                content_lines.append(f"{prefix}{text}")

                    docs.append(ConnectorDocument(
                        content="\n".join(content_lines),
                        filename=f"notion_{page_id}.txt",
                        metadata={"source": "notion", "type": "page", "name": title},
                    ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Notion sync error: {str(e)}",
                filename="notion_error.txt",
                metadata={"source": "notion", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "token": {
                "type": "password",
                "label": "Notion Integration Token",
                "required": True,
                "help": "Notion → Settings → Connections → Develop or manage integrations → New integration → Copy Internal Integration Token. Then share pages with the integration.",
            },
        }


register_connector(NotionConnector())
