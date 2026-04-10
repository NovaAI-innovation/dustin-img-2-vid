param(
  [switch]$SkipNpm,
  [switch]$SkipPython
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $repoRoot "apps\api"
$webDir = Join-Path $repoRoot "apps\web"
$venvDir = Join-Path $apiDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$apiRequirements = Join-Path $apiDir "requirements.txt"
$envFile = Join-Path $apiDir ".env"
$envExample = Join-Path $apiDir ".env.example"

Write-Host "Repository root: $repoRoot"

if (-not $SkipPython) {
  Write-Host "`n[1/3] Setting up backend virtual environment..."
  if (-not (Test-Path $venvPython)) {
    python -m venv $venvDir
  }
  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r $apiRequirements
}

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Write-Host "`n[2/3] Creating backend .env from .env.example..."
  Copy-Item -LiteralPath $envExample -Destination $envFile
}

if (-not $SkipNpm) {
  Write-Host "`n[3/3] Installing frontend/workspace dependencies..."
  Push-Location $repoRoot
  try {
    npm install
  } finally {
    Pop-Location
  }
}

Write-Host "`nSetup completed."
Write-Host "Update apps/api/.env with your PIXVERSE_API_KEY (and optional XAI_API_KEY)."
