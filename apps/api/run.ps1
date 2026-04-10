$ErrorActionPreference = "Stop"

$apiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $apiDir ".venv\Scripts\python.exe"
$requirements = Join-Path $apiDir "requirements.txt"

if (-not (Test-Path $venvPython)) {
  throw "Backend virtual environment is missing. Run .\setup.ps1 from apps\api first."
}

& $venvPython -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('multipart') else 1)"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Missing backend dependency detected (python-multipart). Installing requirements..."
  & $venvPython -m pip install -r $requirements
}

Push-Location $apiDir
try {
  & $venvPython -m uvicorn app.main:app --reload --port 8000
} finally {
  Pop-Location
}
