# Pornește `npm run dev` chiar dacă Node nu e în PATH (Windows).
# Rulează: click dreapta → Run with PowerShell, sau din align-app:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1

$nodeDir = "C:\Program Files\nodejs"
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
  Write-Host "Nu găsesc Node la $nodeDir. Instalează Node.js LTS de pe https://nodejs.org sau adaugă folderul node în PATH." -ForegroundColor Red
  exit 1
}

$env:Path = "$nodeDir;" + $env:Path
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path "node_modules")) {
  Write-Host "Prima dată: npm install ..." -ForegroundColor Yellow
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pornesc Next pe http://localhost:3005 ..." -ForegroundColor Cyan
& npm.cmd run dev
