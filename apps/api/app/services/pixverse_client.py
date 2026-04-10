import uuid
from typing import Any

import httpx


class PixverseError(Exception):
    def __init__(
        self,
        message: str,
        provider_code: int | None = None,
        trace_id: str | None = None,
        provider_message: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.provider_code = provider_code
        self.trace_id = trace_id
        self.provider_message = provider_message


class PixverseClient:
    def __init__(self, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "API-KEY": self._api_key,
            "Ai-trace-id": str(uuid.uuid4()),
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        headers = kwargs.pop("headers", {})
        merged_headers = {**self._headers(), **headers}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.request(method, url, headers=merged_headers, **kwargs)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                provider_code = None
                provider_message = None
                try:
                    error_payload = exc.response.json()
                    provider_code = error_payload.get("ErrCode")
                    provider_message = error_payload.get("ErrMsg")
                except Exception:  # noqa: BLE001
                    provider_message = exc.response.text

                message = f"HTTP {exc.response.status_code} from PixVerse"
                if provider_message:
                    message = f"{message}: {provider_message}"
                raise PixverseError(
                    message=message,
                    provider_code=provider_code,
                    trace_id=merged_headers.get("Ai-trace-id"),
                    provider_message=provider_message,
                ) from exc
            payload = response.json()

        err_code = payload.get("ErrCode")
        if err_code != 0:
            raise PixverseError(
                message=payload.get("ErrMsg", "PixVerse request failed"),
                provider_code=err_code,
                trace_id=merged_headers.get("Ai-trace-id"),
            )
        return payload.get("Resp", {})

    async def create_text_to_video(self, body: dict[str, Any]) -> int:
        resp = await self._request("POST", "/openapi/v2/video/text/generate", json=body)
        return int(resp["video_id"])

    async def create_image_to_video(self, body: dict[str, Any]) -> int:
        resp = await self._request("POST", "/openapi/v2/video/img/generate", json=body)
        return int(resp["video_id"])

    async def get_video_status(self, video_id: int) -> dict[str, Any]:
        return await self._request("GET", f"/openapi/v2/video/result/{video_id}")

    async def get_balance(self) -> dict[str, Any]:
        return await self._request("GET", "/openapi/v2/account/balance")

    async def upload_image(self, file_name: str, file_bytes: bytes, content_type: str) -> int:
        # PixVerse upload-image endpoint expects "image" multipart field.
        # Keep a "file" fallback for backward compatibility with older gateway behavior.
        file_payload = (file_name, file_bytes, content_type)
        last_error: PixverseError | None = None

        for field_name in ("image", "file"):
            files = {field_name: file_payload}
            try:
                resp = await self._request("POST", "/openapi/v2/image/upload", files=files)
                return int(resp["img_id"])
            except PixverseError as exc:
                last_error = exc
                if field_name == "image" and exc.provider_code == 400017:
                    continue
                raise

        if last_error:
            raise last_error
        raise PixverseError(message="Image upload failed unexpectedly")

    async def upload_media(self, file_name: str, file_bytes: bytes, content_type: str) -> dict[str, Any]:
        files = {"file": (file_name, file_bytes, content_type)}
        return await self._request("POST", "/openapi/v2/media/upload", files=files)
