from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DOC_MODELS = ["v3.5", "v4", "v4.5", "v5.6", "c1"]
DOC_QUALITIES = ["360p", "540p", "720p", "1080p"]
DOC_DURATIONS = [5, 8]
DOC_MOTION_MODES = ["normal", "fast"]
DOC_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "3:4", "4:3"]
DOC_CAMERA_MOVEMENTS = [
    "horizontal_left",
    "horizontal_right",
    "vertical_up",
    "vertical_down",
    "zoom_in",
    "zoom_out",
    "crane_up",
    "quickly_zoom_in",
    "quickly_zoom_out",
    "smooth_zoom_in",
    "camera_rotation",
    "robo_arm",
    "super_dolly_out",
    "whip_pan",
    "hitchcock",
    "left_follow",
    "right_follow",
    "pan_left",
    "pan_right",
    "fix_bg",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    pixverse_api_key: str = Field(alias="PIXVERSE_API_KEY")
    pixverse_base_url: str = Field(default="https://app-api.pixverse.ai", alias="PIXVERSE_BASE_URL")

    enable_prompt_assist: bool = Field(default=False, alias="ENABLE_PROMPT_ASSIST")
    xai_api_key: str | None = Field(default=None, alias="XAI_API_KEY")
    xai_base_url: str = Field(default="https://api.x.ai", alias="XAI_BASE_URL")

    pixverse_webhook_secret: str | None = Field(default=None, alias="PIXVERSE_WEBHOOK_SECRET")
    polling_interval_seconds: int = Field(default=5, alias="POLLING_INTERVAL_SECONDS")

    generation_models: str = Field(default="v3.5", alias="GENERATION_MODELS")
    generation_qualities: str = Field(default="720p", alias="GENERATION_QUALITIES")
    generation_durations: str = Field(default="5", alias="GENERATION_DURATIONS")
    generation_motion_modes: str = Field(default="normal", alias="GENERATION_MOTION_MODES")
    generation_camera_movements: str = Field(default="", alias="GENERATION_CAMERA_MOVEMENTS")
    generation_aspect_ratios: str = Field(default="16:9,9:16,1:1,3:4,4:3", alias="GENERATION_ASPECT_RATIOS")
    jobs_db_path: str = Field(default="data/jobs.sqlite3", alias="JOBS_DB_PATH")

    @property
    def prompt_assist_enabled(self) -> bool:
        return bool(self.enable_prompt_assist and self.xai_api_key)

    @property
    def webhook_enabled(self) -> bool:
        return bool(self.pixverse_webhook_secret)

    @staticmethod
    def _csv_list(raw: str) -> list[str]:
        return [item.strip() for item in raw.split(",") if item.strip()]

    @staticmethod
    def _merge_with_defaults(parsed: list[str], defaults: list[str]) -> list[str]:
        seen: set[str] = set()
        merged: list[str] = []
        for value in [*defaults, *parsed]:
            if value in seen:
                continue
            seen.add(value)
            merged.append(value)
        return merged

    @property
    def available_models(self) -> list[str]:
        parsed = [value for value in self._csv_list(self.generation_models) if value in DOC_MODELS]
        return self._merge_with_defaults(parsed, DOC_MODELS)

    @property
    def available_qualities(self) -> list[str]:
        parsed = [value for value in self._csv_list(self.generation_qualities) if value in DOC_QUALITIES]
        return self._merge_with_defaults(parsed, DOC_QUALITIES)

    @property
    def available_durations(self) -> list[int]:
        values = []
        for value in self._csv_list(self.generation_durations):
            try:
                parsed = int(value)
            except ValueError:
                continue
            if parsed > 0:
                values.append(parsed)
        parsed = [value for value in values if value in DOC_DURATIONS]
        return sorted(set([*DOC_DURATIONS, *parsed]))

    @property
    def available_motion_modes(self) -> list[str]:
        parsed = [value for value in self._csv_list(self.generation_motion_modes) if value in DOC_MOTION_MODES]
        return self._merge_with_defaults(parsed, DOC_MOTION_MODES)

    @property
    def available_camera_movements(self) -> list[str]:
        parsed = [value for value in self._csv_list(self.generation_camera_movements) if value in DOC_CAMERA_MOVEMENTS]
        return self._merge_with_defaults(parsed, DOC_CAMERA_MOVEMENTS)

    @property
    def available_aspect_ratios(self) -> list[str]:
        parsed = [value for value in self._csv_list(self.generation_aspect_ratios) if value in DOC_ASPECT_RATIOS]
        return self._merge_with_defaults(parsed, DOC_ASPECT_RATIOS)

    @property
    def default_model(self) -> str:
        return self.available_models[0]

    @property
    def default_quality(self) -> str:
        return self.available_qualities[0]

    @property
    def default_duration(self) -> int:
        return self.available_durations[0]

    @property
    def default_motion_mode(self) -> str:
        return self.available_motion_modes[0]

    @property
    def default_camera_movement(self) -> str | None:
        return None

    @property
    def default_aspect_ratio(self) -> str:
        return self.available_aspect_ratios[0]

    @property
    def resolved_jobs_db_path(self) -> Path:
        return Path(self.jobs_db_path)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
