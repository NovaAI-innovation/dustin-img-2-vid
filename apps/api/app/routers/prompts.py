from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.models import ApiEnvelope, PromptAssistRequest, PromptAssistResponse
from app.routers.utils import envelope
from app.services.grok_client import GrokClient

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


def get_grok_client(settings: Settings = Depends(get_settings)) -> GrokClient:
    return GrokClient(api_key=settings.xai_api_key, base_url=settings.xai_base_url)


@router.post("/assist", response_model=ApiEnvelope)
async def assist_prompt(
    request: PromptAssistRequest,
    settings: Settings = Depends(get_settings),
    grok: GrokClient = Depends(get_grok_client),
) -> ApiEnvelope:
    if not settings.prompt_assist_enabled:
        raise HTTPException(status_code=503, detail="Prompt assist is disabled by backend configuration.")

    try:
        assisted = await grok.assist_prompt(request.prompt, request.goal or "")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Prompt assist provider error: {exc}") from exc
    body = PromptAssistResponse(assisted_prompt=assisted)
    return envelope(data=body.model_dump())
