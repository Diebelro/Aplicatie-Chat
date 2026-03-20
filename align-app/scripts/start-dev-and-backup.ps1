<#
  Pornește `npm run dev` într-o fereastră PowerShell nouă și face backup PostgreSQL (.dump) aici.
  Regex DATABASE_URL: linia trebuie să înceapă cu DATABASE_URL= (eventual spații înainte).
#>
Param(
  [string]$ProjPath = "C:\Users\Alr\OneDrive\Documents\Proiecte\Aplicatie Chat\align-app",
  [string]$PgDump   = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
)

# Pornește dev într-o fereastră PowerShell separată
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location -LiteralPath '$ProjPath'; npm run dev"
)

# Citește DATABASE_URL din .env (fără să-l printeze)
$envPath = Join-Path $ProjPath ".env"
if (!(Test-Path $envPath)) {
  Write-Error "Nu găsesc $envPath"
  exit 1
}
$db = (
  Get-Content $envPath -Encoding UTF8 |
  Where-Object { $_ -match '^\s*DATABASE_URL=' } |
  Select-Object -First 1
) -replace '^\s*DATABASE_URL=\s*', '' -replace '\s+$', '' -replace '^["'']|["'']$', ''

if ([string]::IsNullOrWhiteSpace($db)) {
  Write-Error "DATABASE_URL gol sau lipsă din .env"
  exit 1
}

# Backup în paralel cu rularea dev (fișier cu timestamp)
$ts = Get-Date -Format "yyyyMMdd-HHmm"
$out = Join-Path $ProjPath "backup-$ts.dump"
& "$PgDump" --dbname=$db -Fc -f $out
Write-Host "Backup creat: $out"
