"""Unsplash connector.

Pulls photo inspiration and reference data:
- Collections saved to your Unsplash account
- Photo metadata: title, description, photographer, tags, color palette, dimensions
- Useful for building mood boards and sourcing reference imagery

API: https://unsplash.com/developers
Auth: Access Key from Unsplash Developer Apps
"""

from connectors.base import BaseConnector, ConnectorDocument, register_connector


class UnsplashConnector(BaseConnector):
    connector_type = "unsplash"
    display_name = "Unsplash"
    description = "Sync saved collections and photo references from Unsplash for mood boarding and inspiration"
    icon = "photo"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("access_key"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        access_key = config.get("access_key")
        username = config.get("username", "").strip()
        if not access_key:
            return []

        docs = []
        try:
            import httpx
            headers = {"Authorization": f"Client-ID {access_key}"}

            async with httpx.AsyncClient() as client:
                # Fetch user collections if username provided
                if username:
                    collections_resp = await client.get(
                        f"https://api.unsplash.com/users/{username}/collections",
                        headers=headers,
                        params={"per_page": 20},
                        timeout=15,
                    )
                    if collections_resp.status_code == 200:
                        for col in collections_resp.json():
                            col_id = col.get("id")
                            col_title = col.get("title", "Untitled Collection")
                            col_desc = col.get("description", "")
                            tags = ", ".join(t.get("title", "") for t in col.get("tags", []))

                            # Fetch photos in collection
                            photos_resp = await client.get(
                                f"https://api.unsplash.com/collections/{col_id}/photos",
                                headers=headers,
                                params={"per_page": 30},
                                timeout=15,
                            )
                            photo_lines = []
                            if photos_resp.status_code == 200:
                                for photo in photos_resp.json():
                                    desc = photo.get("description") or photo.get("alt_description", "")
                                    photographer = photo.get("user", {}).get("name", "")
                                    color = photo.get("color", "")
                                    w = photo.get("width", "")
                                    h = photo.get("height", "")
                                    photo_tags = ", ".join(t.get("title", "") for t in photo.get("tags", [])[:5])
                                    photo_lines.append(f"  Photo: {desc} | By: {photographer} | Color: {color} | {w}x{h} | Tags: {photo_tags}")

                            content = f"Unsplash Collection: {col_title}\n"
                            if col_desc:
                                content += f"Description: {col_desc}\n"
                            if tags:
                                content += f"Tags: {tags}\n"
                            content += "\n".join(photo_lines)

                            docs.append(ConnectorDocument(
                                content=content,
                                filename=f"unsplash_collection_{col_id}.txt",
                                metadata={"source": "unsplash", "type": "collection", "name": col_title},
                            ))
                else:
                    # Fetch curated photos as inspiration reference
                    curated_resp = await client.get(
                        "https://api.unsplash.com/photos",
                        headers=headers,
                        params={"order_by": "editorial", "per_page": 30},
                        timeout=15,
                    )
                    if curated_resp.status_code == 200:
                        lines = ["Unsplash Editorial Photos (inspiration reference):"]
                        for photo in curated_resp.json():
                            desc = photo.get("description") or photo.get("alt_description", "")
                            photographer = photo.get("user", {}).get("name", "")
                            color = photo.get("color", "")
                            photo_tags = ", ".join(t.get("title", "") for t in photo.get("tags", [])[:5])
                            lines.append(f"  {desc} | {photographer} | {color} | {photo_tags}")
                        docs.append(ConnectorDocument(
                            content="\n".join(lines),
                            filename="unsplash_editorial.txt",
                            metadata={"source": "unsplash", "type": "editorial"},
                        ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Unsplash sync error: {str(e)}",
                filename="unsplash_error.txt",
                metadata={"source": "unsplash", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "access_key": {
                "type": "password",
                "label": "Unsplash Access Key",
                "required": True,
                "help": "Unsplash → Your Apps → New Application → Copy Access Key",
            },
            "username": {
                "type": "text",
                "label": "Unsplash Username (optional)",
                "required": False,
                "help": "Your Unsplash username to sync your saved collections. Leave blank for editorial feed.",
            },
        }


register_connector(UnsplashConnector())
