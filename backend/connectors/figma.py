"""Figma connector.

Pulls design data:
- Team projects and files
- Component names and descriptions from published libraries
- Design tokens (colors, text styles) from shared libraries
- File comments (useful for review feedback)

API: https://www.figma.com/developers/api
Auth: Personal access token from Figma Account Settings → Security → Personal access tokens
"""

from connectors.base import BaseConnector, ConnectorDocument, register_connector


class FigmaConnector(BaseConnector):
    connector_type = "figma"
    display_name = "Figma"
    description = "Sync design files, components, color/text styles, and review comments from Figma"
    icon = "figma"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("access_token"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        token = config.get("access_token")
        team_id = config.get("team_id", "").strip()
        if not token:
            return []

        docs = []
        headers = {"X-Figma-Token": token}

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                if not team_id:
                    # Try to get teams from /v1/me
                    me_resp = await client.get("https://api.figma.com/v1/me", headers=headers, timeout=10)
                    if me_resp.status_code != 200:
                        return []

                # Get projects in team
                projects_resp = await client.get(
                    f"https://api.figma.com/v1/teams/{team_id}/projects",
                    headers=headers,
                    timeout=15,
                )
                if projects_resp.status_code != 200:
                    return []

                for project in projects_resp.json().get("projects", []):
                    proj_name = project.get("name", "Untitled")
                    proj_id = project.get("id")

                    files_resp = await client.get(
                        f"https://api.figma.com/v1/projects/{proj_id}/files",
                        headers=headers,
                        timeout=15,
                    )
                    if files_resp.status_code != 200:
                        continue

                    for file in files_resp.json().get("files", []):
                        file_key = file.get("key")
                        file_name = file.get("name", "Untitled File")
                        last_modified = file.get("last_modified", "")

                        # Get file styles and components
                        file_resp = await client.get(
                            f"https://api.figma.com/v1/files/{file_key}",
                            headers=headers,
                            params={"depth": 1},
                            timeout=20,
                        )
                        content_lines = [f"Figma File: {file_name} (Project: {proj_name})", f"Last modified: {last_modified}"]

                        if file_resp.status_code == 200:
                            file_data = file_resp.json()
                            styles = file_data.get("styles", {})
                            components = file_data.get("components", {})

                            if styles:
                                content_lines.append("\nStyles:")
                                for node_id, style in list(styles.items())[:50]:
                                    content_lines.append(f"  [{style.get('style_type','?')}] {style.get('name','')}: {style.get('description','')}")

                            if components:
                                content_lines.append("\nComponents:")
                                for node_id, comp in list(components.items())[:50]:
                                    desc = comp.get("description", "")
                                    content_lines.append(f"  {comp.get('name','')}" + (f": {desc}" if desc else ""))

                        # Get comments
                        comments_resp = await client.get(
                            f"https://api.figma.com/v1/files/{file_key}/comments",
                            headers=headers,
                            timeout=10,
                        )
                        if comments_resp.status_code == 200:
                            comments = comments_resp.json().get("comments", [])
                            if comments:
                                content_lines.append(f"\nReview Comments ({len(comments)}):")
                                for c in comments[:20]:
                                    author = c.get("user", {}).get("handle", "Unknown")
                                    message = c.get("message", "")
                                    content_lines.append(f"  {author}: {message}")

                        docs.append(ConnectorDocument(
                            content="\n".join(content_lines),
                            filename=f"figma_{file_key}.txt",
                            metadata={"source": "figma", "type": "file", "name": file_name, "project": proj_name},
                        ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Figma sync error: {str(e)}",
                filename="figma_error.txt",
                metadata={"source": "figma", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "access_token": {
                "type": "password",
                "label": "Figma Personal Access Token",
                "required": True,
                "help": "Figma → Account Settings → Security → Personal access tokens → Generate new token",
            },
            "team_id": {
                "type": "text",
                "label": "Team ID",
                "required": True,
                "help": "From your Figma team URL: figma.com/files/team/TEAM_ID/...",
            },
        }


register_connector(FigmaConnector())
