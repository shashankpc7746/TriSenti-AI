# Backend Startup Script
# Checks prerequisites before launching, then starts uvicorn via py -3.10

$ProjectRoot    = "d:\SHASHANK\Vs-code\Multimodal Sentiment Analysis by Shashank"
$VenvPackages   = "$ProjectRoot\multimodal_env\Lib\site-packages"
$ApiDir         = "$ProjectRoot\api"
$Port           = 8000

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TriSenti AI — Backend Startup"         -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Pre-flight check 1: py -3.10 available ────────────────────────────────────
Write-Host "Checking Python 3.10..." -ForegroundColor Yellow
$pyCheck = & py -3.10 --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'py -3.10' not found. Install Python 3.10 and ensure the" -ForegroundColor Red
    Write-Host "       Python Launcher for Windows is in your PATH."              -ForegroundColor Red
    Read-Host  "Press Enter to exit"
    exit 1
}
Write-Host "  Found: $pyCheck" -ForegroundColor Green

# ── Pre-flight check 2: port not already occupied ─────────────────────────────
Write-Host "Checking port $Port..." -ForegroundColor Yellow
$occupied = netstat -ano | Select-String ":$Port\s"
if ($occupied) {
    Write-Host "WARNING: Port $Port appears to be in use. The server may fail to bind." -ForegroundColor Yellow
    Write-Host "         Run 'netstat -ano | findstr :$Port' to identify the process."  -ForegroundColor Yellow
    Write-Host ""
}
else {
    Write-Host "  Port $Port is free." -ForegroundColor Green
}

# ── Pre-flight check 3: models directory present ──────────────────────────────
Write-Host "Checking models directory..." -ForegroundColor Yellow
if (-not (Test-Path "$ProjectRoot\models")) {
    Write-Host "ERROR: 'models' directory not found at $ProjectRoot\models"     -ForegroundColor Red
    Write-Host "       Ensure the trained model files are present before starting." -ForegroundColor Red
    Read-Host  "Press Enter to exit"
    exit 1
}
Write-Host "  Models directory found." -ForegroundColor Green

# ── Launch ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Loading ML models — this takes ~2-4 minutes on first run." -ForegroundColor Yellow
Write-Host ""
Write-Host "  API URL  : http://localhost:$Port"      -ForegroundColor Cyan
Write-Host "  API Docs : http://localhost:$Port/docs" -ForegroundColor Cyan
Write-Host ""

$env:PYTHONPATH = "$VenvPackages;$ApiDir;$ProjectRoot"
Set-Location $ApiDir
py -3.10 -m uvicorn main:app --reload --port $Port

Write-Host ""
Write-Host "Backend stopped." -ForegroundColor Red
Read-Host  "Press Enter to exit"
