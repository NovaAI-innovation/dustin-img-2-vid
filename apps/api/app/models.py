from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.config import DOC_ASPECT_RATIOS, DOC_CAMERA_MOVEMENTS, DOC_DURATIONS, DOC_MODELS, DOC_MOTION_MODES, DOC_QUALITIES

class ApiError(BaseModel):
    code: str
    message: str
    trace_id: str | None = None
    provider_code: int | None = None


class ApiEnvelope(BaseModel):
    ok: bool = True
    error: ApiError | None = None
    data: Any | None = None


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    moderated = "moderated"
    failed = "failed"


class FeaturesResponse(BaseModel):
    prompt_assist_enabled: bool
    webhook_enabled: bool
    polling_interval_seconds: int


class GenerationDefaultsResponse(BaseModel):
    model: str
    quality: str
    duration: int
    motion_mode: str
    aspect_ratio: str
    camera_movement: str | None = None


class GenerationOptionsResponse(BaseModel):
    models: list[str]
    qualities: list[str]
    durations: list[int]
    motion_modes: list[str]
    aspect_ratios: list[str]
    camera_movements: list[str] = []
    defaults: GenerationDefaultsResponse


class PromptAssistRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    goal: str | None = Field(default="Improve clarity and cinematic detail for short video generation.")


class PromptAssistResponse(BaseModel):
    assisted_prompt: str


class TextToVideoRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2048)
    negative_prompt: str | None = Field(default=None, max_length=2048)
    duration: int = 5
    model: str = "v3.5"
    quality: str = "720p"
    motion_mode: str = "normal"
    aspect_ratio: str = "16:9"
    camera_movement: str | None = None
    seed: int | None = Field(default=None, ge=0, le=2147483647)
    webhook_id: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def normalize_fields(self) -> "TextToVideoRequest":
        self.prompt = self.prompt.strip()
        if not self.prompt:
            raise ValueError("prompt must not be blank.")
        if self.negative_prompt is not None:
            self.negative_prompt = self.negative_prompt.strip() or None
        if self.camera_movement is not None:
            self.camera_movement = self.camera_movement.strip() or None
        if self.webhook_id is not None:
            self.webhook_id = self.webhook_id.strip() or None
        return self

    @model_validator(mode="after")
    def validate_parameter_compatibility(self) -> "TextToVideoRequest":
        if self.model not in DOC_MODELS:
            raise ValueError(f"model must be one of: {', '.join(DOC_MODELS)}.")

        if self.quality not in DOC_QUALITIES:
            raise ValueError(f"quality must be one of: {', '.join(DOC_QUALITIES)}.")

        if self.duration not in DOC_DURATIONS:
            raise ValueError(f"duration must be one of: {', '.join(str(value) for value in DOC_DURATIONS)}.")

        if self.motion_mode not in DOC_MOTION_MODES:
            raise ValueError(f"motion_mode must be one of: {', '.join(DOC_MOTION_MODES)}.")

        # PixVerse docs: fast motion mode supports 5s clips only.
        if self.motion_mode == "fast" and self.duration != 5:
            raise ValueError("motion_mode='fast' only supports duration=5.")

        # PixVerse docs: 1080p does not support 10s clips.
        if self.quality == "1080p" and self.duration == 10:
            raise ValueError("quality='1080p' does not support duration=10.")

        # PixVerse docs: 1080p does not support fast mode.
        if self.quality == "1080p" and self.motion_mode == "fast":
            raise ValueError("quality='1080p' does not support motion_mode='fast'.")

        if self.aspect_ratio not in DOC_ASPECT_RATIOS:
            raise ValueError(f"aspect_ratio must be one of: {', '.join(DOC_ASPECT_RATIOS)}.")

        if self.camera_movement and self.camera_movement not in DOC_CAMERA_MOVEMENTS:
            raise ValueError(
                f"camera_movement must be one of: {', '.join(DOC_CAMERA_MOVEMENTS)}."
            )

        # PixVerse docs: camera movement controls are supported on select model families only.
        if self.camera_movement and self.model not in {"v4", "v4.5"}:
            raise ValueError("camera_movement is only supported for model='v4' or model='v4.5'.")

        return self


class ImageToVideoRequest(TextToVideoRequest):
    img_id: int = Field(gt=0)


class CreateJobResponse(BaseModel):
    job_id: str
    provider_video_id: int
    status: JobStatus


class JobDetailResponse(BaseModel):
    job_id: str
    provider_video_id: int
    status: JobStatus
    provider_status: int | None = None
    video_url: str | None = None
    fail_reason: str | None = None


class JobListItemResponse(JobDetailResponse):
    created_at: str
    updated_at: str


class BalanceResponse(BaseModel):
    account_id: int
    credit_monthly: int
    credit_package: int


class UploadImageResponse(BaseModel):
    img_id: int


class UploadSourceResponse(BaseModel):
    source_id: str
    source_type: str


class UploadRequest(BaseModel):
    file_name: str
    content_type: str = "application/octet-stream"
    data_base64: str


class WebhookPayload(BaseModel):
    id: str
    status: int
    url: str | None = None
    fail_reason: str | None = None
