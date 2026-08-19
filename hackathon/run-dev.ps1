<#
run-dev.ps1
Starts the Python backend and the Vite frontend for development in one command.

Usage:
  .\run-dev.ps1      # starts backend (hidden) and frontend (visible)
  .\run-dev.ps1 -OpenBrowser  # also opens the frontend in the default browser
#>

param(
    [switch]$OpenBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Ensure logs directory
$logsDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
$backendLog = Join-Path $logsDir 'backend-dev.log'
$frontendLog = Join-Path $logsDir 'frontend-dev.log'

foreach ($logPath in @($backendLog, $frontendLog)) {
    if (Test-Path $logPath) {
        Remove-Item $logPath -Force
    }
}

function Wait-ForHttpEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [int]$TimeoutSeconds = 25,

        [System.Diagnostics.Process]$Process = $null
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            # Retry until timeout or process exit.
        }

        if ($Process -ne $null) {
            try {
                $Process.Refresh()
            } catch {
            }

            if ($Process.HasExited) {
                return $false
            }
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Show-LogTail {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [string]$Label = 'Log',

        [int]$Lines = 20
    )

    if (-not (Test-Path $Path)) {
        Write-Output "$Label not found: $Path"
        return
    }

    Write-Output ""
    Write-Output "$Label (last $Lines lines):"
    Get-Content -Path $Path -Tail $Lines
}

function Stop-IfRunning {
    param(
        [System.Diagnostics.Process]$Process = $null
    )

    if ($Process -eq $null) {
        return
    }

    try {
        $Process.Refresh()
        if (-not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {
    }
}

# Python executable inside venv
$pythonExe = Join-Path $root '.venv\Scripts\python.exe'

if (-not (Test-Path $pythonExe)) {
    Write-Output "Virtual environment not found at $pythonExe. Creating .venv and installing requirements..."
    python -m venv .venv
    & (Join-Path $root '.venv\Scripts\python.exe') -m pip install -r python\requirements.txt
}

Write-Output "Starting backend (Flask)..."
$backendCommand = "Set-Location -Path '$root\python'; & '$pythonExe' server.py *> '$backendLog'"
$backendProcess = Start-Process `
    -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $backendCommand `
    -WindowStyle Hidden `
    -PassThru

Write-Output "Waiting for backend health check on http://127.0.0.1:5000/status ..."
if (-not (Wait-ForHttpEndpoint -Url 'http://127.0.0.1:5000/status' -TimeoutSeconds 20 -Process $backendProcess)) {
    Write-Error "Backend did not become ready on http://127.0.0.1:5000/status."
    Show-LogTail -Path $backendLog -Label 'Backend log'
    Stop-IfRunning -Process $backendProcess
    exit 1
}

Write-Output "Backend is ready."

Write-Output "Starting frontend (Vite)..."
$frontendCommand = "Set-Location -Path '$root'; npm run dev 2>&1 | Tee-Object -FilePath '$frontendLog'"
$frontendProcess = Start-Process `
    -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCommand `
    -WindowStyle Normal `
    -PassThru

Write-Output "Waiting for frontend health check on http://localhost:5173/ ..."
if (-not (Wait-ForHttpEndpoint -Url 'http://localhost:5173/' -TimeoutSeconds 25 -Process $frontendProcess)) {
    Write-Error "Frontend dev server did not become ready on http://localhost:5173."
    Show-LogTail -Path $frontendLog -Label 'Frontend log'
    Stop-IfRunning -Process $frontendProcess
    Stop-IfRunning -Process $backendProcess
    exit 1
}

Write-Output "Frontend is ready."
if ($OpenBrowser) {
    Start-Process 'http://localhost:5173/'
}

Write-Output "Dev environment started. Frontend: http://localhost:5173  Backend: http://127.0.0.1:5000"
Write-Output "Logs: $frontendLog  |  $backendLog"
