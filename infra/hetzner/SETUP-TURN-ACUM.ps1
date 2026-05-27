# Rulează dublu-click sau: powershell -ExecutionPolicy Bypass -File SETUP-TURN-ACUM.ps1
# Copiază comenzile în clipboard și deschide consola Hetzner în browser.

$ErrorActionPreference = "Stop"

$commands = @'
export TURN_STATIC_SECRET='450623c03a2666bf3211674938e8a3080a2dcccb6ca891aed89aab3bd98453a3'
apt-get update -qq && apt-get install -y coturn ufw
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn
cat > /etc/turnserver.conf << 'ENDCONF'
listening-port=3478
listening-ip=0.0.0.0
external-ip=178.104.2.31
realm=turn.diebel.ro
server-name=turn.diebel.ro
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=450623c03a2666bf3211674938e8a3080a2dcccb6ca891aed89aab3bd98453a3
min-port=49152
max-port=49200
no-tls
no-dtls
log-file=/var/log/turn.log
verbose
ENDCONF
touch /var/log/turn.log
ufw allow 3478/tcp 2>/dev/null; ufw allow 3478/udp 2>/dev/null; ufw allow 49152:49200/udp 2>/dev/null
systemctl enable coturn
systemctl restart coturn
sleep 2
echo "=== PORT 3478 ==="
ss -tulnp | grep 3478
echo "=== STATUS ==="
systemctl status coturn --no-pager | head -15
'@

Set-Clipboard -Value $commands

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TURN Diebel - setup (3 pasi)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Comenzile sunt COPIATE in clipboard." -ForegroundColor Green
Write-Host "2. Se deschide Hetzner Cloud in browser..." -ForegroundColor Yellow
Write-Host "3. Server -> Console -> click in fereastra -> Ctrl+V -> Enter" -ForegroundColor Yellow
Write-Host ""
Write-Host "Daca nu esti logat: https://console.hetzner.cloud" -ForegroundColor Gray
Write-Host ""

Start-Process "https://console.hetzner.cloud"

$response = Read-Host "Ai rulat comenzile in consola? (d/n)"
if ($response -match '^[dDyY]') {
    Write-Host "Verific port 3478 de pe PC..." -ForegroundColor Cyan
    $t = Test-NetConnection -ComputerName turn.diebel.ro -Port 3478 -WarningAction SilentlyContinue
    if ($t.TcpTestSucceeded) {
        Write-Host "OK - TURN raspunde pe 3478!" -ForegroundColor Green
    } else {
        Write-Host "Inca NU raspunde. Deschide in Hetzner Firewall: 3478 TCP+UDP, 49152-49200 UDP" -ForegroundColor Red
    }
}

Read-Host "Apasa Enter pentru a inchide"
