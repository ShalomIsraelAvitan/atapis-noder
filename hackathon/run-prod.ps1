<#
run-prod.ps1
Builds the frontend and starts the Flask server to serve the built `dist`.

Usage:
  .\run-prod.ps1      # build frontend, copy dist to python/dist, start backend
  .\run-prod.ps1 -OpenBrowser  # also opens the app in the browser
#>

param(
    [switch]$OpenBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Output "Building frontend (npm run build)..."
cmd.exe /c "npm run build"

$dist = Join-Path $root 'dist'
$target = Join-Path $root 'python\dist'

if (-not (Test-Path $dist)) {
    Write-Output "Build failed: dist/ not found. Aborting."
    exit 1
}

if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
}

Write-Output "Copying dist -> python/dist..."
Copy-Item -Path $dist -Destination $target -Recurse -Force

# Ensure venv python exists
$pythonExe = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonExe)) {
    Write-Output "Virtual environment not found at $pythonExe. Creating .venv and installing requirements..."
    python -m venv .venv
    & (Join-Path $root '.venv\Scripts\python.exe') -m pip install -r python\requirements.txt
}

Write-Output "Starting backend (serving built frontend)..."
Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList "-NoProfile -Command Set-Location -Path '$root\python'; & '$pythonExe' server.py" -WindowStyle Normal

Start-Sleep -Seconds 2
if ($OpenBrowser) {
    Start-Process 'http://localhost:5000/'
}

Write-Output "Production server started on http://127.0.0.1:5000"
