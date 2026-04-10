import base64
import hashlib
import hmac
import json
import urllib.parse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.config import Settings, get_settings
from app.models import WebhookPayload
from app.services.jobs import JobStore

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def _url_encode_payload(payload: dict) -> str:
    parts = []
    for key in sorted(payload.keys()):
        value = payload[key]
        parts.append(f"{urllib.parse.quote_plus(str(key))}={urllib.parse.quote_plus(str(value))}")
    return "&".join(parts)


def _verify_signature(secret: str, timestamp: str, nonce: str, signature: str, payload: dict) -> bool:
    encoded_payload = _url_encode_payload(payload)
    sign_string = f"{timestamp}\n{nonce}\n{encoded_payload}"
    digest = hmac.new(secret.encode("utf-8"), sign_string.encode("utf-8"), hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, signature)


@router.post("/pixverse", response_class=PlainTextResponse)
async def handle_pixverse_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
    job_store: JobStore = Depends(get_job_store),
    webhook_timestamp: str = Header(alias="Webhook-Timestamp"),
    webhook_nonce: str = Header(alias="Webhook-Nonce"),
    webhook_signature: str = Header(alias="Webhook-Signature"),
) -> PlainTextResponse:
    if not settings.webhook_enabled or not settings.pixverse_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook handling is disabled.")

    raw_body = await request.body()
    payload_dict = json.loads(raw_body.decode("utf-8"))
    if not _verify_signature(
        secret=settings.pixverse_webhook_secret,
        timestamp=webhook_timestamp,
        nonce=webhook_nonce,
        signature=webhook_signature,
        payload=payload_dict,
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    payload = WebhookPayload.model_validate(payload_dict)
    provider_id = int(payload.id)
    record = job_store.get_by_provider_id(provider_id)
    if record:
        job_store.update_from_provider(
            job_id=record.job_id,
            provider_status=payload.status,
            video_url=payload.url,
            fail_reason=payload.fail_reason,
        )

    # PixVerse requires literal "ok" body.
    return PlainTextResponse("ok")
