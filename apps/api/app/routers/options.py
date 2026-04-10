from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import GenerationDefaultsResponse, GenerationOptionsResponse

router = APIRouter(prefix="/api/v1/options", tags=["options"])


@router.get("", response_model=GenerationOptionsResponse)
def get_generation_options(settings: Settings = Depends(get_settings)) -> GenerationOptionsResponse:
    return GenerationOptionsResponse(
        models=settings.available_models,
        qualities=settings.available_qualities,
        durations=settings.available_durations,
        motion_modes=settings.available_motion_modes,
        aspect_ratios=settings.available_aspect_ratios,
        camera_movements=settings.available_camera_movements,
        defaults=GenerationDefaultsResponse(
            model=settings.default_model,
            quality=settings.default_quality,
            duration=settings.default_duration,
            motion_mode=settings.default_motion_mode,
            aspect_ratio=settings.default_aspect_ratio,
            camera_movement=settings.default_camera_movement,
        ),
    )
