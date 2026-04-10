from typing import Any

import httpx


class GrokClient:
    def __init__(self, api_key: str | None, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def assist_prompt(self, prompt: str, goal: str) -> str:
        if not self._api_key:
            raise ValueError("XAI_API_KEY is not configured.")

        payload: dict[str, Any] = {
            "model": "grok-3-mini",
            "input": [
                {
                    "role": "system",
                    "content": (
                        "You help rewrite prompts for AI video generation. "
                        "Return one optimized prompt only."
                    ),
                },
                {"role": "user", "content": f"Goal: {goal}\nPrompt: {prompt}"},
            ],
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base_url}/v1/responses",
                headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        output = data.get("output", [])
        if output and "content" in output[0] and output[0]["content"]:
            first = output[0]["content"][0]
            text = first.get("text")
            if text:
                return text.strip()

        # Fallback for compatible variants
        text_out = data.get("output_text")
        if text_out:
            return str(text_out).strip()

        raise ValueError("No prompt assist text returned by xAI API.")

