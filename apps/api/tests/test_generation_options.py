from app.config import Settings


def test_generation_options_defaults() -> None:
    settings = Settings.model_validate({"PIXVERSE_API_KEY": "x"})
    assert settings.available_models == ["v3.5", "v4", "v4.5", "v5.6", "c1"]
    assert settings.available_qualities == ["360p", "540p", "720p", "1080p"]
    assert settings.available_durations == [5, 8]
    assert settings.available_motion_modes == ["normal", "fast"]
    assert settings.available_aspect_ratios == ["16:9", "9:16", "1:1", "3:4", "4:3"]
    assert len(settings.available_camera_movements) > 5
    assert settings.default_camera_movement is None


def test_generation_options_parsing() -> None:
    settings = Settings.model_validate(
        {
            "PIXVERSE_API_KEY": "x",
            "GENERATION_MODELS": "v5.6, v6",
            "GENERATION_QUALITIES": "720p,1080p",
            "GENERATION_DURATIONS": "5,8,bad",
            "GENERATION_MOTION_MODES": "normal,fast",
            "GENERATION_ASPECT_RATIOS": "16:9,9:16",
            "GENERATION_CAMERA_MOVEMENTS": "zoom_in,pan_left",
        }
    )
    assert settings.available_models == ["v3.5", "v4", "v4.5", "v5.6", "c1"]
    assert settings.available_qualities == ["360p", "540p", "720p", "1080p"]
    assert settings.available_durations == [5, 8]
    assert settings.available_motion_modes == ["normal", "fast"]
    assert settings.available_aspect_ratios == ["16:9", "9:16", "1:1", "3:4", "4:3"]
    assert "zoom_in" in settings.available_camera_movements
    assert "pan_left" in settings.available_camera_movements
