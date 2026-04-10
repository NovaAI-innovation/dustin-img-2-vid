import pytest
from pydantic import ValidationError

from app.models import ImageToVideoRequest, TextToVideoRequest


def test_fast_mode_requires_5_seconds() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", motion_mode="fast", duration=8)


def test_1080p_rejects_10_seconds() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", quality="1080p", duration=10)


def test_1080p_rejects_fast_mode() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", quality="1080p", motion_mode="fast", duration=5)


def test_invalid_aspect_ratio_rejected() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", aspect_ratio="2:1")


def test_blank_prompt_rejected() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="   ")


def test_invalid_camera_movement_rejected() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", model="v4", camera_movement="spin_around")


def test_camera_movement_model_compatibility_rejected() -> None:
    with pytest.raises(ValidationError):
        TextToVideoRequest(prompt="x", model="v3.5", camera_movement="zoom_in")


def test_image_to_video_rejects_non_positive_img_id() -> None:
    with pytest.raises(ValidationError):
        ImageToVideoRequest(prompt="x", img_id=0)
