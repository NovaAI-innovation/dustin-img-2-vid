import importlib.util
import logging

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import account, features, jobs, options, prompts, webhooks
from app.services.jobs import JobStore

logger = logging.getLogger(__name__)


def include_media_routes(app: FastAPI) -> None:
    message = (
        'Media upload routes are disabled because dependency "python-multipart" is missing. '
        "Install dependencies in apps/api/.venv with: python -m pip install -r requirements.txt"
    )

    if importlib.util.find_spec("multipart") is None:
        logger.warning(message)
        fallback = APIRouter(prefix="/api/v1/media", tags=["media"])

        @fallback.post("/image")
        async def upload_image_unavailable() -> None:
            raise HTTPException(status_code=503, detail=message)

        @fallback.post("/source")
        async def upload_source_unavailable() -> None:
            raise HTTPException(status_code=503, detail=message)

        app.include_router(fallback)
        return

    from app.routers import media

    app.include_router(media.router)


def create_app() -> FastAPI:
    app = FastAPI(title="PixVerse Studio API", version="0.1.0")
    settings = get_settings()
    app.state.job_store = JobStore(settings.resolved_jobs_db_path)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(features.router)
    app.include_router(options.router)
    app.include_router(prompts.router)
    include_media_routes(app)

    app.include_router(jobs.router)
    app.include_router(account.router)
    app.include_router(webhooks.router)
    return app


app = create_app()
