# Finalizează deploy Vercel: setează NEXTAUTH_* și NEXT_PUBLIC_APP_URL, apoi redeploy.
# Rulează O DATĂ: npx vercel login
# Apoi rulează acest script din align-app: .\scripts\vercel-production-env.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Verificare autentificare Vercel..."
$whoami = npx vercel whoami 2>&1 | Out-String
if ($whoami -match "No existing credentials|no-credentials") {
  Write-Host "EROARE: Nu esti autentificat la Vercel. Ruleaza o data: npx vercel login" -ForegroundColor Red
  exit 1
}

$secret = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
if (-not $secret) { Write-Host "Nu s-a putut genera NEXTAUTH_SECRET"; exit 1 }

Write-Host "Deploy initial pentru a obtine URL-ul de productie..."
$deployOut = npx vercel --prod --yes 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy esuat. Ies." -ForegroundColor Red
  exit 1
}

$url = [regex]::Match($deployOut, 'https://[^\s\)\]"]+\.vercel\.app').Value
if (-not $url) {
  $url = [regex]::Match($deployOut, 'https://[^\s\)\]"]+').Value
}
if (-not $url) {
  Write-Host "Nu s-a putut extrage URL din output. Seteaza manual NEXTAUTH_URL si NEXT_PUBLIC_APP_URL in Vercel Dashboard." -ForegroundColor Yellow
  Write-Host "Secret generat (adauga-l ca NEXTAUTH_SECRET): $secret"
  exit 0
}

Write-Host "URL productie: $url"
Write-Host "Adaug NEXTAUTH_SECRET..."
$secret | npx vercel env add NEXTAUTH_SECRET production --yes --force 2>&1
Write-Host "Adaug NEXTAUTH_URL..."
$url | npx vercel env add NEXTAUTH_URL production --yes --force 2>&1
Write-Host "Adaug NEXT_PUBLIC_APP_URL..."
$url | npx vercel env add NEXT_PUBLIC_APP_URL production --yes --force 2>&1

Write-Host "Redeploy cu noile variabile..."
npx vercel --prod --yes 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "Deploy finalizat. Aplicatia e live: $url" -ForegroundColor Green
} else {
  Write-Host "Redeploy a esuat. Verifica Vercel Dashboard." -ForegroundColor Yellow
  exit 1
}
