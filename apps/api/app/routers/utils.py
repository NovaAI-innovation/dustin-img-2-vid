from fastapi import HTTPException

from app.models import ApiError, ApiEnvelope
from app.services.pixverse_client import PixverseError


def envelope(data=None) -> ApiEnvelope:
    return ApiEnvelope(ok=True, data={} if data is None else data)


def raise_pixverse_http_error(exc: PixverseError) -> None:
    status_code = 502
    message = exc.message
    if exc.provider_code == 400017:
        status_code = 400
        message = "PixVerse rejected the upload payload. Ensure multipart form field contains an image file."
    if exc.provider_code == 400032:
        status_code = 400
        message = "Invalid or expired image ID. Upload a fresh source image and try again."

    detail = ApiEnvelope(
        ok=False,
        error=ApiError(
            code="PIXVERSE_ERROR",
            message=message,
            trace_id=exc.trace_id,
            provider_code=exc.provider_code,
        ),
    ).model_dump()
    raise HTTPException(status_code=status_code, detail=detail)
