from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import FeaturesResponse

router = APIRouter(prefix="/api/v1/features", tags=["features"])


@router.get("", response_model=FeaturesResponse)
def get_features(settings: Settings = Depends(get_settings)) -> FeaturesResponse:
    return FeaturesResponse(
        prompt_assist_enabled=settings.prompt_assist_enabled,
        webhook_enabled=settings.webhook_enabled,
        polling_interval_seconds=settings.polling_interval_seconds,
    )

