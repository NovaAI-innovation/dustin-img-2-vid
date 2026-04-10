param(
  [switch]$SkipEnvFile
)

$ErrorActionPreference = "Stop"

$apiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir = Join-Path $apiDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$requirements = Join-Path $apiDir "requirements.txt"
$envFile = Join-Path $apiDir ".env"
$envExample = Join-Path $apiDir ".env.example"

Write-Host "API directory: $apiDir"
Write-Host "Setting up backend virtual environment..."

if (-not (Test-Path $venvPython)) {
  python -m venv $venvDir
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r $requirements

if (-not $SkipEnvFile -and -not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Write-Host "Creating .env from .env.example..."
  Copy-Item -LiteralPath $envExample -Destination $envFile
}

Write-Host "Backend setup complete."
