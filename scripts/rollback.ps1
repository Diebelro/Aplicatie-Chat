#Requires -Version 5.1
<#
.SYNOPSIS
  Checkout a production baseline tag for inspection or redeploy.
.PARAMETER Tag
  Tag to use (e.g. prod-baseline-2026-03-29). If omitted, uses newest prod-baseline-* by creation date.
.EXAMPLE
  .\scripts\rollback.ps1
  .\scripts\rollback.ps1 -Tag prod-baseline-2026-03-29
#>

param([string]$Tag = '')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Msg) { Write-Error $Msg; exit 1 }

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

Write-Host "==> git fetch --tags origin" -ForegroundColor Cyan
git fetch --tags origin
if ($LASTEXITCODE -ne 0) { Fail "git fetch failed." }

if (-not $Tag) {
  $Tag = (git tag -l 'prod-baseline-*' --sort=-creatordate | Select-Object -First 1).Trim()
}

if (-not $Tag) { Fail "No tag matching prod-baseline-*. Pass -Tag explicitly." }

git rev-parse "refs/tags/$Tag" *> $null
if ($LASTEXITCODE -ne 0) { Fail "Tag not found locally after fetch: $Tag" }

Write-Host "==> Checking out $Tag (detached HEAD)" -ForegroundColor Cyan
git checkout $Tag
if ($LASTEXITCODE -ne 0) { Fail "git checkout failed." }

Write-Host ""
Write-Host "--- Rollback checkout done ---" -ForegroundColor Green
Write-Host "You are on tag: $Tag (detached HEAD). Do not commit here unless you create a branch."
Write-Host ""
Write-Host "Next steps (Vercel): Deployments -> find commit -> Promote to Production / Redeploy." -ForegroundColor Yellow
Write-Host "Optional hotfix branch: git switch -c hotfix/rollback-$Tag" -ForegroundColor Yellow
