# Repară erori Windows EPERM la `prisma generate` (DLL blocat).
# Rulează din align-app: npm run db:repair-win
# Pasul 1: oprește manual `npm run dev` / alte terminale Node pe acest proiect.

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[db:repair-win] Șterg node_modules\.prisma ..."
Remove-Item -Recurse -Force "node_modules\.prisma" -ErrorAction SilentlyContinue

Write-Host "[db:repair-win] prisma generate"
& npx --yes prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[db:repair-win] Gata. Continuă cu: npm run db:setup sau npm run db:push"
