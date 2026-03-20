# Eliberează porturile folosite de Next.js (Windows PowerShell).
# Rulează din align-app: npm run ports:free
# Opțional: drepturi „Run as administrator” dacă un proces refuză să se oprească.

$ports = 3000..3010
$killed = @()

foreach ($port in $ports) {
  try {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $listeners) {
      $pid = $c.OwningProcess
      if ($pid -and $pid -gt 0) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match 'node|nodejs') {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          $killed += "${port}:PID $pid ($($proc.ProcessName))"
        }
      }
    }
  } catch {
    # ignoră
  }
}

if ($killed.Count -eq 0) {
  Write-Host "[ports:free] Niciun listener Node pe 3000-3010 (sau deja liber)."
} else {
  Write-Host "[ports:free] Oprite:"
  $killed | ForEach-Object { Write-Host "  - $_" }
}
Write-Host "Porneste app: npm run dev  ->  http://localhost:3005"
