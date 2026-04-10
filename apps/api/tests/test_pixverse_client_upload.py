import pytest

from app.services.pixverse_client import PixverseClient, PixverseError


@pytest.mark.asyncio
async def test_upload_image_uses_image_form_field() -> None:
    client = PixverseClient(api_key="x", base_url="https://example.com")
    captured_files: dict | None = None

    async def fake_request(method: str, path: str, **kwargs):  # type: ignore[no-untyped-def]
        nonlocal captured_files
        assert method == "POST"
        assert path == "/openapi/v2/image/upload"
        captured_files = kwargs["files"]
        return {"img_id": 123}

    client._request = fake_request  # type: ignore[method-assign]

    result = await client.upload_image("clip.png", b"abc", "image/png")

    assert result == 123
    assert captured_files is not None
    assert "image" in captured_files


@pytest.mark.asyncio
async def test_upload_image_falls_back_to_file_field_on_provider_400017() -> None:
    client = PixverseClient(api_key="x", base_url="https://example.com")
    attempted_fields: list[str] = []

    async def fake_request(method: str, path: str, **kwargs):  # type: ignore[no-untyped-def]
        assert method == "POST"
        assert path == "/openapi/v2/image/upload"
        files = kwargs["files"]
        attempted_field = next(iter(files.keys()))
        attempted_fields.append(attempted_field)
        if attempted_field == "image":
            raise PixverseError(message="bad upload field", provider_code=400017)
        return {"img_id": 456}

    client._request = fake_request  # type: ignore[method-assign]

    result = await client.upload_image("clip.png", b"abc", "image/png")

    assert result == 456
    assert attempted_fields == ["image", "file"]
