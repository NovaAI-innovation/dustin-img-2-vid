from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.models import ApiEnvelope, UploadImageResponse, UploadSourceResponse
from app.routers.utils import envelope, raise_pixverse_http_error
from app.services.pixverse_client import PixverseClient, PixverseError

router = APIRouter(prefix="/api/v1/media", tags=["media"])
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024


def get_pixverse_client(settings: Settings = Depends(get_settings)) -> PixverseClient:
    return PixverseClient(api_key=settings.pixverse_api_key, base_url=settings.pixverse_base_url)


@router.post("/image", response_model=ApiEnvelope)
async def upload_image(
    file: UploadFile = File(...),
    pixverse: PixverseClient = Depends(get_pixverse_client),
) -> ApiEnvelope:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type == "image/jpg":
        content_type = "image/jpeg"
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image format. Use image/png, image/jpeg, or image/webp.",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds {MAX_IMAGE_BYTES // (1024 * 1024)}MB limit.",
        )
    try:
        img_id = await pixverse.upload_image(file.filename, content, content_type)
    except PixverseError as exc:
        raise_pixverse_http_error(exc)
    return envelope(data=UploadImageResponse(img_id=img_id).model_dump())


@router.post("/source", response_model=ApiEnvelope)
async def upload_source(
    file: UploadFile = File(...),
    pixverse: PixverseClient = Depends(get_pixverse_client),
) -> ApiEnvelope:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")
    content = await file.read()
    try:
        payload = await pixverse.upload_media(file.filename, content, file.content_type or "application/octet-stream")
    except PixverseError as exc:
        raise_pixverse_http_error(exc)

    source_id = str(payload.get("media_id") or payload.get("id") or "")
    source_type = str(payload.get("type") or "media")
    return envelope(data=UploadSourceResponse(source_id=source_id, source_type=source_type).model_dump())
