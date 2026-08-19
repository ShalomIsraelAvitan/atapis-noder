<#
setup-new-machine.ps1
Prepare this project on a new Windows machine.

Usage:
  .\setup-new-machine.ps1
  .\setup-new-machine.ps1 -BackendOnly
#>

param(
    [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Require-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $InstallHint"
    }
}

Write-Host "Project root: $root"

Write-Step "Checking prerequisites"

Require-Command -Name "python" -InstallHint "Install Python 3.10 or newer and make sure the 'python' command is available in PATH."
$pythonVersionText = (& python -c "import sys; print('.'.join(map(str, sys.version_info[:3])))").Trim()
[version]$pythonVersion = $pythonVersionText

if ($pythonVersion.Major -lt 3 -or ($pythonVersion.Major -eq 3 -and $pythonVersion.Minor -lt 10)) {
    throw "Python 3.10 or newer is required. Detected version: $pythonVersionText"
}

Write-Host "Python version: $pythonVersionText"

if (-not $BackendOnly) {
    Require-Command -Name "npm" -InstallHint "Install Node.js + npm and make sure the 'npm' command is available in PATH."
    $npmVersionText = (& npm --version).Trim()
    Write-Host "npm version: $npmVersionText"
}

Write-Step "Preparing Python virtual environment"

$venvPython = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating .venv ..."
    & python -m venv .venv
}

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment creation failed. Expected file not found: $venvPython"
}

Write-Step "Installing Python dependencies"
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $root "python\requirements.txt")

Write-Step "Preparing .env"

$envFile = Join-Path $root ".env"
$envExample = Join-Path $root ".env.example"

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item -Path $envExample -Destination $envFile
    Write-Host "Created .env from .env.example"
}
elseif (Test-Path $envFile) {
    Write-Host ".env already exists"
}
else {
    Write-Warning ".env.example was not found. Skipping .env bootstrap."
}

if (Test-Path $envFile) {
    $envText = Get-Content $envFile -Raw
    if ($envText -match "your_username" -or $envText -match "your_password") {
        Write-Warning ".env still contains placeholder Dahua credentials. Update it before using the live RTSP camera."
    }
}

Write-Step "Checking model files"

$requiredModels = @(
    "python\yolov8n.pt",
    "python\yolov8n-pose.pt"
)

foreach ($relativePath in $requiredModels) {
    $fullPath = Join-Path $root $relativePath
    if (Test-Path $fullPath) {
        Write-Host "Found: $relativePath"
    }
    else {
        Write-Warning "Missing required model file: $relativePath"
    }
}

$weaponModelPath = Join-Path $root "python\weapon_best.pt"
if (Test-Path $weaponModelPath) {
    Write-Host "Found optional local weapon model: python\weapon_best.pt"
}
else {
    Write-Warning "python\weapon_best.pt is missing. On first backend start the app will try to download it via huggingface_hub. Keep internet access for the first run, or place the file there manually."
}

Write-Step "Checking optional tools"

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "FFmpeg found"
}
else {
    Write-Warning "FFmpeg was not found. This is only required for scenario video analysis export."
}

if (-not $BackendOnly) {
    Write-Step "Installing frontend dependencies"
    & npm install
}
else {
    Write-Host ""
    Write-Host "Skipping frontend dependency install because -BackendOnly was used."
}

Write-Step "Setup complete"

Write-Host "Recommended next steps:"
Write-Host "  1. Review .env if you use Dahua or LD2450 hardware."

if ($BackendOnly) {
    Write-Host "  2. Start the backend with:"
    Write-Host "     Set-Location .\python"
    Write-Host "     & ..\.venv\Scripts\python.exe .\server.py"
}
else {
    Write-Host "  2. Start the development environment with:"
    Write-Host "     .\run-dev.ps1"
    Write-Host "  3. Or run the production-style local flow with:"
    Write-Host "     .\run-prod.ps1"
}

Write-Host ""
Write-Host "Useful endpoints:"
Write-Host "  http://127.0.0.1:5000/status"
Write-Host "  http://127.0.0.1:5000/video_feed"
Write-Host "  http://127.0.0.1:5000/api/cameras/dahua/test"

