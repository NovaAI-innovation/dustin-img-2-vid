from app.config import Settings, get_settings
from app.services.grok_client import GrokClient
from app.services.jobs import JobStore
from app.services.pixverse_client import PixverseClient


def get_pixverse_client(settings: Settings = get_settings()) -> PixverseClient:
    return PixverseClient(
        api_key=settings.pixverse_api_key,
        base_url=settings.pixverse_base_url,
    )


def get_grok_client(settings: Settings = get_settings()) -> GrokClient:
    return GrokClient(
        api_key=settings.xai_api_key,
        base_url=settings.xai_base_url,
    )


job_store = JobStore()


def get_job_store() -> JobStore:
    return job_store

