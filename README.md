# PixVerse Studio

A monorepo with clean frontend/backend separation:

- `apps/web`: React + Vite frontend
- `apps/api`: FastAPI backend
- `packages/contracts`: shared API contracts/types
- `docs/integration-matrix.md`: documentation-backed feature map

## Quick Start

### Root scripts (Windows / PowerShell)

```powershell
.\setup.ps1
.\run.ps1
```

### Backend

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd apps/web
npm install
npm run dev
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
