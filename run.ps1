$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $repoRoot "apps\api"
$venvPython = Join-Path $apiDir ".venv\Scripts\python.exe"
$apiRequirements = Join-Path $apiDir "requirements.txt"

if (-not (Test-Path $venvPython)) {
  throw "Backend virtual environment is missing. Run .\setup.ps1 first."
}

if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  throw "Node dependencies are missing. Run .\setup.ps1 first."
}

$hasMultipart = (& $venvPython -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('multipart') else 1)")
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Missing backend dependency detected (python-multipart). Installing requirements...'
  & $venvPython -m pip install -r $apiRequirements
}

$backendCmd = "Set-Location '$apiDir'; & '$venvPython' -m uvicorn app.main:app --reload --port 8000"
$frontendCmd = "Set-Location '$repoRoot'; npm run dev:web"

Write-Host "Starting backend on http://localhost:8000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "`nBoth services were started in separate PowerShell windows."
