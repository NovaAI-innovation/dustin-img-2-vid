$ErrorActionPreference = "Stop"

$webDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $webDir
try {
  npm run dev
} finally {
  Pop-Location
}
