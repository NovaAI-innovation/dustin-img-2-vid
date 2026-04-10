$ErrorActionPreference = "Stop"

$webDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Web directory: $webDir"
Write-Host "Installing frontend dependencies..."

Push-Location $webDir
try {
  npm install
} finally {
  Pop-Location
}

Write-Host "Frontend setup complete."
