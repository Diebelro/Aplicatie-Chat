#Requires -Version 5.1
<#
.SYNOPSIS
  Production checkpoint: verify build, commit, tag, release branch, push to origin.
.DESCRIPTION
  Runs typecheck, lint, and build inside align-app/. If successful:
  - git add -A
  - commit if dirty
  - create annotated tag prod-baseline-YYYY-MM-DD (adds -1, -2... if tag exists)
  - create branch release/<same>
  - push main + tag + branch to origin
  Run from repo root (contains scripts/, docs/, align-app/). Requires current branch main.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Msg) { Write-Error $Msg; exit 1 }
function Test-Exit([string]$Step) {
  if ($LASTEXITCODE -ne 0) { Fail "$Step failed (exit $LASTEXITCODE)." }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$AppDir   = Join-Path $RepoRoot 'align-app'

if (-not (Test-Path $AppDir)) { Fail "align-app folder not found at: $AppDir" }

$current = (git -C $RepoRoot branch --show-current 2>$null).Trim()
if ($current -ne 'main') { Fail "Checkout branch 'main' before running (current: '$current')." }

Write-Host "==> Typecheck / Lint / Build (align-app)" -ForegroundColor Cyan
Push-Location $AppDir
try {
  & npx --yes tsc --noEmit
  Test-Exit 'npx tsc --noEmit'

  & npm run lint
  Test-Exit 'npm run lint'

  & npm run build
  Test-Exit 'npm run build'
}
finally { Pop-Location }

Set-Location $RepoRoot
Write-Host "==> Git add/commit (if needed)" -ForegroundColor Cyan

& git add -A
Test-Exit 'git add -A'

$dirty = (& git status --porcelain)
if ($dirty) {
  & git commit -m "chore: production checkpoint"
  Test-Exit 'git commit'
} else {
  Write-Warning "Working tree clean — tagging current HEAD."
}

$dateStr  = Get-Date -Format 'yyyy-MM-dd'
$baseTag  = "prod-baseline-$dateStr"
$finalTag = $baseTag
$suffix   = 0

while ($true) {
  git rev-parse "refs/tags/$finalTag" *> $null
  if ($LASTEXITCODE -ne 0) { break }
  $suffix++
  $finalTag = "$baseTag-$suffix"
}

Write-Host "==> Tag: $finalTag" -ForegroundColor Cyan
& git tag -a $finalTag -m "Production checkpoint: $finalTag"
Test-Exit 'git tag -a'

$releaseBranch = "release/$finalTag"
Write-Host "==> Branch: $releaseBranch" -ForegroundColor Cyan
& git branch $releaseBranch
if ($LASTEXITCODE -ne 0) { Fail "Could not create branch $releaseBranch (maybe exists?)." }

Write-Host "==> Push origin main + tag + release branch" -ForegroundColor Cyan
& git push origin main
Test-Exit 'git push origin main'

& git push origin $finalTag
Test-Exit "git push origin $finalTag"

& git push origin $releaseBranch
Test-Exit "git push origin $releaseBranch"

Write-Host ("Checkpoint complete: {0} + {1}" -f $finalTag, $releaseBranch) -ForegroundColor Green
