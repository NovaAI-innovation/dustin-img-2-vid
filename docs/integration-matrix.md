# Integration Matrix (Docs-Backed)

All external integrations in this project must map to official documentation.

## PixVerse

| Capability | Provider Endpoint | Internal Endpoint | Source |
|---|---|---|---|
| Text-to-video generation | `POST /openapi/v2/video/text/generate` | `POST /api/v1/jobs/text-to-video` | https://docs.platform.pixverse.ai/text-to-video-generation-13016634e0 |
| Image-to-video generation | `POST /openapi/v2/video/img/generate` | `POST /api/v1/jobs/image-to-video` | https://docs.platform.pixverse.ai/image-to-video-generation-13016633e0 |
| Get video status | `GET /openapi/v2/video/result/{id}` | `GET /api/v1/jobs/{jobId}` | https://docs.platform.pixverse.ai/get-video-generation-status-13016632e0 |
| Upload image | `POST /openapi/v2/image/upload` | `POST /api/v1/media/image` | https://docs.platform.pixverse.ai/upload-image-13016631e0 |
| Upload video/audio | `POST /openapi/v2/media/upload` | `POST /api/v1/media/source` | https://docs.platform.pixverse.ai/upload-videoaudio-19094401e0 |
| Account balance | `GET /openapi/v2/account/balance` | `GET /api/v1/account/balance` | https://docs.platform.pixverse.ai/get-user-credit-balance-13778989e0 |
| Webhook verification | N/A (provider callback format) | `POST /api/v1/webhooks/pixverse` | https://docs.platform.pixverse.ai/how-to-use-webhook-1905378m0 |

## xAI

| Capability | Provider Endpoint | Internal Endpoint | Source |
|---|---|---|---|
| Prompt assist (optional) | `POST /v1/responses` or `POST /v1/chat/completions` | `POST /api/v1/prompts/assist` | https://docs.x.ai/docs/api-reference |

