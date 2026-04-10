# PixVerse Studio

A monorepo with clean frontend/backend separation:

- `apps/web`: React + Vite frontend
- `apps/api`: FastAPI backend
- `packages/contracts`: shared API contracts/types
- `docs/integration-matrix.md`: documentation-backed feature map

## Quick Start

### Backend only (Windows / PowerShell)

```powershell
cd apps/api
.\setup.ps1
.\run.ps1
```

### Frontend only (Windows / PowerShell)

```powershell
cd apps/web
.\setup.ps1
.\run.ps1
```

### Full stack (orchestration wrappers)

```powershell
.\setup.ps1
.\run.ps1
```

### npm helpers

```powershell
npm run setup:api
npm run run:api
npm run setup:web
npm run run:web
```

The frontend expects backend API at `http://localhost:8000` (via Vite proxy).
Default Vite proxy target is `http://127.0.0.1:8000`; override with `VITE_PROXY_TARGET` if needed.

`.\run.ps1` now auto-reinstalls backend requirements if `python-multipart` is missing in `apps/api/.venv`.

## Environment

See `apps/api/.env.example` for required and optional variables:

- `PIXVERSE_API_KEY` (required)
- `ENABLE_PROMPT_ASSIST` (`true`/`false`)
- `XAI_API_KEY` (required only when prompt assist is enabled)
- `PIXVERSE_WEBHOOK_SECRET` (optional unless webhook endpoint is used)

## VPS Deployment (Docker)

Use the production-oriented compose file and root env file:

1. Prepare env on the server:

```bash
cp .env.vps.example .env
```

2. Edit `.env` and set at least:

- `PIXVERSE_API_KEY`
- `XAI_API_KEY` (only if `ENABLE_PROMPT_ASSIST=true`)

3. Build and start on VPS:

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

4. Check health:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs --tail 100 api
docker compose -f docker-compose.vps.yml logs --tail 100 web
```

Notes:
- Frontend is served by Nginx on `WEB_PORT` (default `80`).
- Backend runs on the internal Docker network and is proxied via `/api` from the frontend container.
- API job data persists in the named Docker volume `api_data`.

If your provider auto-deploys `docker-compose.yml` from Git:
- Set `PIXVERSE_API_KEY` in the provider's environment variables UI.
- The stack now uses a named volume (`api_data`) by default to avoid host bind-mount permission issues with non-root containers.
