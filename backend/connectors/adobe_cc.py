"""Adobe Creative Cloud connector.

Pulls assets and metadata from:
- Lightroom: albums, photo metadata (ratings, labels, captions, keywords, camera EXIF)
- Creative Cloud Libraries: colors, character styles, graphics, brushes, layer styles

OAuth flow: Admin provides Client ID + Client Secret from Adobe Developer Console.
Users then connect their own Adobe accounts via the /api/adobe/auth endpoint.

API docs: https://developer.adobe.com/lightroom/lightroom-api-docs/
         https://developer.adobe.com/creative-cloud-libraries/docs/
"""

import json
from connectors.base import BaseConnector, ConnectorDocument, register_connector


class AdobeCCConnector(BaseConnector):
    connector_type = "adobe_cc"
    display_name = "Adobe Creative Cloud"
    description = "Sync Lightroom albums, photo metadata, and CC Library assets (colors, styles, graphics)"
    icon = "adobe"

    async def validate_connection(self, config: dict) -> bool:
        return bool(config.get("access_token") or config.get("client_id"))

    async def fetch_documents(self, config: dict) -> list[ConnectorDocument]:
        access_token = config.get("access_token")
        if not access_token:
            return []

        docs = []
        try:
            import httpx
            headers = {
                "Authorization": f"Bearer {access_token}",
                "X-API-Key": config.get("client_id", ""),
            }

            async with httpx.AsyncClient() as client:
                # Pull Lightroom catalog / albums
                lr_resp = await client.get(
                    "https://lr.adobe.io/v2/catalog",
                    headers=headers,
                    timeout=15,
                )
                if lr_resp.status_code == 200:
                    catalog = lr_resp.json()
                    catalog_id = catalog.get("id")
                    if catalog_id:
                        # Fetch albums
                        albums_resp = await client.get(
                            f"https://lr.adobe.io/v2/catalogs/{catalog_id}/albums",
                            headers=headers,
                            timeout=15,
                        )
                        if albums_resp.status_code == 200:
                            for album in albums_resp.json().get("resources", []):
                                name = album.get("payload", {}).get("name", "Untitled Album")
                                album_id = album.get("id")
                                docs.append(ConnectorDocument(
                                    content=f"Lightroom Album: {name}\nAlbum ID: {album_id}",
                                    filename=f"lr_album_{album_id}.txt",
                                    metadata={"source": "lightroom", "type": "album", "name": name},
                                ))

                        # Fetch recent assets (up to 100)
                        assets_resp = await client.get(
                            f"https://lr.adobe.io/v2/catalogs/{catalog_id}/assets",
                            headers={**headers, "X-Generate-Renditions": "false"},
                            params={"limit": 100},
                            timeout=20,
                        )
                        if assets_resp.status_code == 200:
                            for asset in assets_resp.json().get("resources", []):
                                payload = asset.get("payload", {})
                                develop = payload.get("develop", {})
                                xmp = payload.get("xmp", {})
                                caption = xmp.get("dc:description", [{}])[0].get("value", "") if xmp.get("dc:description") else ""
                                keywords = ", ".join(xmp.get("dc:subject", []))
                                rating = payload.get("rating", "")
                                color_label = payload.get("colorLabel", "")
                                camera = develop.get("cameraProfile", "")
                                iso = develop.get("ISO", "")
                                focal = develop.get("FocalLength", "")
                                lines = [
                                    f"Lightroom Asset: {asset.get('id')}",
                                    f"Caption: {caption}" if caption else "",
                                    f"Keywords: {keywords}" if keywords else "",
                                    f"Rating: {rating}" if rating else "",
                                    f"Color Label: {color_label}" if color_label else "",
                                    f"Camera Profile: {camera}" if camera else "",
                                    f"ISO: {iso}" if iso else "",
                                    f"Focal Length: {focal}" if focal else "",
                                ]
                                content = "\n".join(l for l in lines if l)
                                docs.append(ConnectorDocument(
                                    content=content,
                                    filename=f"lr_asset_{asset.get('id')}.txt",
                                    metadata={"source": "lightroom", "type": "asset"},
                                ))

                # Pull CC Libraries
                libs_resp = await client.get(
                    "https://cc-libraries.adobe.io/api/v1/libraries",
                    headers=headers,
                    timeout=15,
                )
                if libs_resp.status_code == 200:
                    for lib in libs_resp.json().get("libraries", []):
                        lib_id = lib.get("id")
                        lib_name = lib.get("name", "Untitled Library")
                        elements_resp = await client.get(
                            f"https://cc-libraries.adobe.io/api/v1/libraries/{lib_id}/elements",
                            headers=headers,
                            timeout=15,
                        )
                        if elements_resp.status_code == 200:
                            elements = elements_resp.json().get("elements", [])
                            colors, styles, graphics = [], [], []
                            for el in elements:
                                el_type = el.get("type", "")
                                el_name = el.get("name", "")
                                if "color" in el_type:
                                    value = el.get("representation", {}).get("color", {})
                                    colors.append(f"{el_name}: {json.dumps(value)}")
                                elif "characterstyle" in el_type or "paragraphstyle" in el_type:
                                    styles.append(el_name)
                                else:
                                    graphics.append(el_name)

                            content_parts = [f"CC Library: {lib_name}"]
                            if colors:
                                content_parts.append("Colors:\n" + "\n".join(f"  - {c}" for c in colors))
                            if styles:
                                content_parts.append("Character/Paragraph Styles:\n" + "\n".join(f"  - {s}" for s in styles))
                            if graphics:
                                content_parts.append("Graphics & Assets:\n" + "\n".join(f"  - {g}" for g in graphics))

                            docs.append(ConnectorDocument(
                                content="\n".join(content_parts),
                                filename=f"cc_library_{lib_id}.txt",
                                metadata={"source": "adobe_cc_library", "type": "library", "name": lib_name},
                            ))

        except Exception as e:
            docs.append(ConnectorDocument(
                content=f"Adobe CC sync error: {str(e)}",
                filename="adobe_cc_error.txt",
                metadata={"source": "adobe_cc", "type": "error"},
            ))

        return docs

    def get_config_schema(self) -> dict:
        return {
            "client_id": {
                "type": "text",
                "label": "Adobe Client ID",
                "required": True,
                "help": "From Adobe Developer Console → Your App → Credentials",
            },
            "client_secret": {
                "type": "password",
                "label": "Adobe Client Secret",
                "required": True,
                "help": "From Adobe Developer Console → Your App → Credentials",
            },
            "access_token": {
                "type": "password",
                "label": "Access Token (OAuth)",
                "required": False,
                "help": "Leave blank — obtained automatically after OAuth login",
            },
        }


register_connector(AdobeCCConnector())
