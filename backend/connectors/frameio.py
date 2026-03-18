"""Frame.io connector.

Pulls video project data:
- Projects and their folder structure
- Asset metadata (clips, resolution, duration, frame rate)
- Review comments and timestamps (reviewer name, timecode, comment text)

API: https://developer.frame.io/api/reference/
Auth: Personal access token from Frame.io Account Settings → Developer → Tokens
"""

from connectors.base import BaseConnector, ConnectorDocument, register_connector


class FrameIOConnector(BaseConnector):
    connector_type = "frameio"
    display_name = "Frame.io"
    description = "Sync video projects, clip metadata, and review comments from Frame.io"
    icon = "video"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("access_token"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        token = config.get("access_token")
        if not token:
            return []

        docs = []
        try:
            import httpx
            headers = {"Authorization": f"Bearer {token}"}

            async with httpx.AsyncClient() as client:
                # Get account teams
                me_resp = await client.get("https://api.frame.io/v2/me", headers=headers, timeout=10)
                if me_resp.status_code != 200:
                    return []
                account_id = me_resp.json().get("account_id")

                # Get projects
                projects_resp = await client.get(
                    f"https://api.frame.io/v2/accounts/{account_id}/projects",
                    headers=headers,
                    timeout=15,
                )
                if projects_resp.status_code != 200:
                    return []

                for project in projects_resp.json():
                    proj_name = project.get("name", "Untitled Project")
                    proj_id = project.get("id")
                    root_asset_id = project.get("root_asset_id")

                    # Fetch assets in project root
                    assets_resp = await client.get(
                        f"https://api.frame.io/v2/assets/{root_asset_id}/children",
                        headers=headers,
                        params={"type": "file", "page_size": 50},
                        timeout=15,
                    )
                    asset_lines = []
                    if assets_resp.status_code == 200:
                        for asset in assets_resp.json():
                            name = asset.get("name", "")
                            duration = asset.get("duration", "")
                            fps = asset.get("fps", "")
                            w = asset.get("original_width", "")
                            h = asset.get("original_height", "")
                            asset_id = asset.get("id")
                            asset_lines.append(f"  Clip: {name} | {w}x{h} | {fps}fps | {duration}s | ID: {asset_id}")

                            # Fetch review comments for this clip
                            comments_resp = await client.get(
                                f"https://api.frame.io/v2/assets/{asset_id}/comments",
                                headers=headers,
                                timeout=10,
                            )
                            if comments_resp.status_code == 200:
                                for comment in comments_resp.json():
                                    author = comment.get("owner", {}).get("name", "Unknown")
                                    text = comment.get("text", "")
                                    timestamp = comment.get("timestamp", "")
                                    tc = f" @ {timestamp:.2f}s" if isinstance(timestamp, (int, float)) else ""
                                    asset_lines.append(f"    Comment ({author}{tc}): {text}")

                    content = f"Frame.io Project: {proj_name}\n" + "\n".join(asset_lines)
                    docs.append(ConnectorDocument(
                        content=content,
                        filename=f"frameio_project_{proj_id}.txt",
                        metadata={"source": "frameio", "type": "project", "name": proj_name},
                    ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Frame.io sync error: {str(e)}",
                filename="frameio_error.txt",
                metadata={"source": "frameio", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "access_token": {
                "type": "password",
                "label": "Frame.io Access Token",
                "required": True,
                "help": "Frame.io → Account Settings → Developer → Personal Access Tokens → Create",
            },
        }


register_connector(FrameIOConnector())
