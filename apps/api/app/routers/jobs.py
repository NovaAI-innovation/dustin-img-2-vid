from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.models import ApiEnvelope, CreateJobResponse, ImageToVideoRequest, JobDetailResponse, JobListItemResponse, TextToVideoRequest
from app.routers.utils import envelope, raise_pixverse_http_error
from app.services.jobs import JobStore
from app.services.pixverse_client import PixverseClient, PixverseError

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def get_pixverse_client(settings: Settings = Depends(get_settings)) -> PixverseClient:
    return PixverseClient(api_key=settings.pixverse_api_key, base_url=settings.pixverse_base_url)


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def extract_video_url(provider_payload: dict, fallback: str | None = None) -> str | None:
    keys = [
        "url",
        "video_url",
        "download_url",
        "media_url",
        "videoUrl",
        "downloadUrl",
        "mp4_url",
    ]
    for key in keys:
        value = provider_payload.get(key)
        if isinstance(value, str) and value:
            return value

    nested_video = provider_payload.get("video")
    if isinstance(nested_video, dict):
        for key in keys:
            value = nested_video.get(key)
            if isinstance(value, str) and value:
                return value

    return fallback


@router.post("/text-to-video", response_model=ApiEnvelope)
async def create_text_to_video_job(
    body: TextToVideoRequest,
    pixverse: PixverseClient = Depends(get_pixverse_client),
    job_store: JobStore = Depends(get_job_store),
) -> ApiEnvelope:
    try:
        provider_video_id = await pixverse.create_text_to_video(body.model_dump(exclude_none=True))
    except PixverseError as exc:
        raise_pixverse_http_error(exc)

    record = job_store.create(provider_video_id=provider_video_id)
    response = CreateJobResponse(job_id=record.job_id, provider_video_id=record.provider_video_id, status=record.status)
    return envelope(data=response.model_dump())


@router.post("/image-to-video", response_model=ApiEnvelope)
async def create_image_to_video_job(
    body: ImageToVideoRequest,
    pixverse: PixverseClient = Depends(get_pixverse_client),
    job_store: JobStore = Depends(get_job_store),
) -> ApiEnvelope:
    try:
        provider_video_id = await pixverse.create_image_to_video(body.model_dump(exclude_none=True))
    except PixverseError as exc:
        raise_pixverse_http_error(exc)

    record = job_store.create(provider_video_id=provider_video_id)
    response = CreateJobResponse(job_id=record.job_id, provider_video_id=record.provider_video_id, status=record.status)
    return envelope(data=response.model_dump())


@router.get("", response_model=ApiEnvelope)
async def list_jobs(job_store: JobStore = Depends(get_job_store)) -> ApiEnvelope:
    jobs = [
        JobListItemResponse(
            job_id=record.job_id,
            provider_video_id=record.provider_video_id,
            status=record.status,
            provider_status=record.provider_status,
            video_url=record.video_url,
            fail_reason=record.fail_reason,
            created_at=record.created_at.isoformat(),
            updated_at=record.updated_at.isoformat(),
        ).model_dump()
        for record in job_store.list_all()
    ]
    return envelope(data=jobs)


@router.get("/{job_id}", response_model=ApiEnvelope)
async def get_job(
    job_id: str,
    pixverse: PixverseClient = Depends(get_pixverse_client),
    job_store: JobStore = Depends(get_job_store),
) -> ApiEnvelope:
    record = job_store.get(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found.")

    try:
        provider = await pixverse.get_video_status(record.provider_video_id)
    except PixverseError as exc:
        raise_pixverse_http_error(exc)

    provider_status = int(provider.get("status", record.provider_status or 0))
    video_url = extract_video_url(provider, fallback=record.video_url)
    record = job_store.update_from_provider(
        job_id=job_id,
        provider_status=provider_status,
        video_url=video_url,
        fail_reason=provider.get("fail_reason"),
    ) or record

    response = JobDetailResponse(
        job_id=record.job_id,
        provider_video_id=record.provider_video_id,
        status=record.status,
        provider_status=record.provider_status,
        video_url=record.video_url,
        fail_reason=record.fail_reason,
    )
    return envelope(data=response.model_dump())


@router.get("/{job_id}/video")
async def resolve_job_video_url(
    job_id: str,
    pixverse: PixverseClient = Depends(get_pixverse_client),
    job_store: JobStore = Depends(get_job_store),
) -> RedirectResponse:
    record = job_store.get(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found.")

    try:
        provider = await pixverse.get_video_status(record.provider_video_id)
        provider_status = int(provider.get("status", record.provider_status or 0))
        video_url = extract_video_url(provider, fallback=record.video_url)
        fail_reason = provider.get("fail_reason")
        record = job_store.update_from_provider(
            job_id=job_id,
            provider_status=provider_status,
            video_url=video_url,
            fail_reason=fail_reason,
        ) or record
    except PixverseError:
        # Keep serving existing stored URL if provider status refresh fails.
        video_url = record.video_url

    if not video_url:
        raise HTTPException(status_code=404, detail="No video URL is currently available for this job.")

    return RedirectResponse(url=video_url, status_code=307)
