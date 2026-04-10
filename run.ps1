$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiRun = Join-Path $repoRoot "apps\api\run.ps1"
$webRun = Join-Path $repoRoot "apps\web\run.ps1"

if (-not (Test-Path $apiRun) -or -not (Test-Path $webRun)) {
  throw "Missing app run scripts. Ensure apps\api\run.ps1 and apps\web\run.ps1 exist."
}

$backendCmd = "& '$apiRun'"
$frontendCmd = "& '$webRun'"

Write-Host "Starting backend on http://localhost:8000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "`nBoth services were started in separate PowerShell windows."
