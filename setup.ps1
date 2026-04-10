param(
  [switch]$SkipNpm,
  [switch]$SkipPython
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiSetup = Join-Path $repoRoot "apps\api\setup.ps1"
$webSetup = Join-Path $repoRoot "apps\web\setup.ps1"

Write-Host "Repository root: $repoRoot"

if (-not $SkipPython) {
  Write-Host "`n[1/2] Running backend setup..."
  & $apiSetup
}

if (-not $SkipNpm) {
  Write-Host "`n[2/2] Running frontend setup..."
  & $webSetup
}

Write-Host "`nSetup completed."
Write-Host "Update apps/api/.env with your PIXVERSE_API_KEY (and optional XAI_API_KEY)."
