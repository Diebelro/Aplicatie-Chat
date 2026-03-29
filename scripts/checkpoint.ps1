#Requires -Version 5.1
<#
.SYNOPSIS
  Production checkpoint: verify build, commit, tag, release branch, push to origin.
.DESCRIPTION
  Runs tsc, eslint, and next build from align-app/. On success: stages all changes,
  commits if there are diffs, creates annotated tag prod-baseline-YYYY-MM-DD (suffix if exists),
  branch release/<same>, pushes main + tag + branch.
  Run from repo root; checkout `main` before running (script enforces current branch = main).
.EXAMPLE
  .\scripts\checkpoint.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-LastExitCode {
  param([string] $Step)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$Step failed (exit $LASTEXITCODE)."
    exit $LASTEXITCODE
  }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$AppDir = Join-Path $RepoRoot 'align-app'

if (-not (Test-Path $AppDir)) {
  Write-Error "align-app folder not found at: $AppDir"
  exit 1
}

$current = (git -C $RepoRoot branch --show-current 2>$null).Trim()
if ($current -ne 'main') {
  Write-Error "Checkout branch 'main' before running checkpoint (current: '$current')."
  exit 1
}

Write-Host "==> Typecheck (align-app)" -ForegroundColor Cyan
Push-Location $AppDir
try {
  & npx --yes tsc --noEmit
  Test-LastExitCode 'npx tsc --noEmit'

  Write-Host "==> Lint" -ForegroundColor Cyan
  & npm run lint
  Test-LastExitCode 'npm run lint'

  Write-Host "==> Build" -ForegroundColor Cyan
  & npm run build
  Test-LastExitCode 'npm run build'
}
finally {
  Pop-Location
}

Write-Host "==> Git: stage / commit (if changes)" -ForegroundColor Cyan
Set-Location $RepoRoot

& git add -A
Test-LastExitCode 'git add -A'

$dirty = (& git status --porcelain)
if ($dirty) {
  & git commit -m "chore: production checkpoint"
  Test-LastExitCode 'git commit'

