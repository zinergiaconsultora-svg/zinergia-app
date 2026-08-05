# Fleet Monitor - OpenCode Watcher
$logDir = ".agents\logs\"
if (-not (Test-Path $logDir)) {
    Write-Host "No active logs directory found in $logDir" -ForegroundColor Yellow
    exit
}

while ($true) {
    Clear-Host
    Write-Host "=============================" -ForegroundColor Cyan
    Write-Host "   OPENCODE FLEET MONITOR    " -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    Write-Host ""
    
    $logs = Get-ChildItem -Path $logDir -Filter "opencode_handoff_*.log"
    if ($logs.Count -eq 0) {
        Write-Host "No active tasks." -ForegroundColor DarkGray
    } else {
        foreach ($log in $logs) {
            $lastLine = Get-Content $log.FullName -Tail 1 -ErrorAction SilentlyContinue
            $status = "RUNNING"
            $color = "Yellow"
            if ($lastLine -match "done" -or $lastLine -match "success" -or $lastLine -match "Completed") {
                $status = "DONE"
                $color = "Green"
            } elseif ($lastLine -match "error" -or $lastLine -match "failed") {
                $status = "FAILED"
                $color = "Red"
            }
            Write-Host "[$status] $($log.Name)" -ForegroundColor $color
            Write-Host "   > $lastLine" -ForegroundColor DarkGray
        }
    }
    
    Start-Sleep -Seconds 3
}