from app.config import Settings


def test_prompt_assist_disabled_without_key() -> None:
    settings = Settings.model_validate(
        {
            "PIXVERSE_API_KEY": "x",
            "ENABLE_PROMPT_ASSIST": True,
            "XAI_API_KEY": "",
        }
    )
    assert settings.prompt_assist_enabled is False


def test_prompt_assist_enabled_with_key() -> None:
    settings = Settings.model_validate(
        {
            "PIXVERSE_API_KEY": "x",
            "ENABLE_PROMPT_ASSIST": True,
            "XAI_API_KEY": "k",
        }
    )
    assert settings.prompt_assist_enabled is True

