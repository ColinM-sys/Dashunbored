"""Behance connector.

Pulls creative portfolio data:
- Projects: title, description, tags, tools used, publish date
- Project modules: text blocks, image captions
- Appreciations and view counts (engagement signal)
- Owner profile: name, location, specialization

API: https://www.behance.net/dev/api/endpoints/
Auth: API key from Adobe Developer Console (same account as Adobe CC connector)
     Create an app at developer.adobe.com → Add Behance API product
"""

from connectors.base import BaseConnector, ConnectorDocument, register_connector


class BehanceConnector(BaseConnector):
    connector_type = "behance"
    display_name = "Behance"
    description = "Sync portfolio projects, tags, tools, and engagement data from Behance"
    icon = "behance"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("api_key"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        api_key = config.get("api_key")
        username = config.get("username", "").strip()
        if not api_key:
            return []

        docs = []
        try:
            import httpx
            params_base = {"api_key": api_key, "client_id": api_key}

            async with httpx.AsyncClient() as client:
                # If a specific username is given, pull their projects
                if username:
                    usernames = [u.strip() for u in username.split(",") if u.strip()]
                else:
                    usernames = []

                for uname in usernames:
                    projects_resp = await client.get(
                        f"https://api.behance.net/v2/users/{uname}/projects",
                        params={**params_base, "per_page": 20},
                        timeout=15,
                    )
                    if projects_resp.status_code != 200:
                        continue

                    for project in projects_resp.json().get("projects", []):
                        proj_id = project.get("id")
                        title = project.get("name", "Untitled")
                        description = project.get("description", "")
                        tags = ", ".join(project.get("tags", []))
                        tools = ", ".join(t.get("title", "") for t in project.get("tools", []))
                        appreciations = project.get("appreciations", 0)
                        views = project.get("views", 0)
                        published = project.get("published_on", "")
                        owner = project.get("owners", [{}])[0]
                        owner_name = owner.get("display_name", "")
                        owner_location = owner.get("location", "")
                        url = project.get("url", "")
                        fields = ", ".join(project.get("fields", []))

                        # Fetch full project for module text
                        detail_resp = await client.get(
                            f"https://api.behance.net/v2/projects/{proj_id}",
                            params=params_base,
                            timeout=15,
                        )
                        module_texts = []
                        if detail_resp.status_code == 200:
                            for module in detail_resp.json().get("project", {}).get("modules", []):
                                mtype = module.get("type", "")
                                if mtype == "text":
                                    module_texts.append(module.get("text", ""))
                                elif mtype == "image":
                                    caption = module.get("caption", "")
                                    if caption:
                                        module_texts.append(f"[Image caption] {caption}")

                        lines = [
                            f"Behance Project: {title}",
                            f"By: {owner_name}" + (f" ({owner_location})" if owner_location else ""),
                            f"URL: {url}",
                            f"Fields: {fields}" if fields else "",
                            f"Tools: {tools}" if tools else "",
                            f"Tags: {tags}" if tags else "",
                            f"Appreciations: {appreciations} | Views: {views}",
                            f"Published: {published}",
                            f"Description: {description}" if description else "",
                        ]
                        if module_texts:
                            lines.append("\nProject content:")
                            lines.extend(f"  {t}" for t in module_texts[:10])

                        docs.append(ConnectorDocument(
                            content="\n".join(l for l in lines if l),
                            filename=f"behance_{proj_id}.txt",
                            metadata={
                                "source": "behance",
                                "type": "project",
                                "name": title,
                                "owner": owner_name,
                                "tags": tags,
                                "tools": tools,
                                "appreciations": appreciations,
                            },
                        ))

                # If no username given, pull trending/featured as inspiration
                if not usernames:
                    featured_resp = await client.get(
                        "https://api.behance.net/v2/projects",
                        params={**params_base, "per_page": 20, "sort": "appreciations"},
                        timeout=15,
                    )
                    if featured_resp.status_code == 200:
                        for project in featured_resp.json().get("projects", []):
                            title = project.get("name", "Untitled")
                            proj_id = project.get("id")
                            tags = ", ".join(project.get("tags", []))
                            tools = ", ".join(t.get("title", "") for t in project.get("tools", []))
                            appreciations = project.get("appreciations", 0)
                            owner_name = project.get("owners", [{}])[0].get("display_name", "")
                            url = project.get("url", "")
                            fields = ", ".join(project.get("fields", []))
                            docs.append(ConnectorDocument(
                                content="\n".join(filter(None, [
                                    f"Behance Featured Project: {title}",
                                    f"By: {owner_name}",
                                    f"URL: {url}",
                                    f"Fields: {fields}" if fields else "",
                                    f"Tools: {tools}" if tools else "",
                                    f"Tags: {tags}" if tags else "",
                                    f"Appreciations: {appreciations}",
                                ])),
                                filename=f"behance_featured_{proj_id}.txt",
                                metadata={"source": "behance", "type": "featured", "name": title},
                            ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Behance sync error: {str(e)}",
                filename="behance_error.txt",
                metadata={"source": "behance", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "api_key": {
                "type": "password",
                "label": "Behance API Key",
                "required": True,
                "help": "Adobe Developer Console → Create App → Add Behance v2 API → Copy Client ID",
            },
            "username": {
                "type": "text",
                "label": "Behance Username(s)",
                "required": False,
                "help": "Comma-separated usernames to sync (e.g. johndoe, janedoe). Leave blank to pull trending projects.",
            },
        }


register_connector(BehanceConnector())
