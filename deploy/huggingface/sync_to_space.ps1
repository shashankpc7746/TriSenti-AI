<#
.SYNOPSIS
    Copies the backend files from this project into a cloned Hugging Face Space
    repo, and configures it so the small model files commit as plain git (no LFS).

.DESCRIPTION
    The HF Space is a SEPARATE git repo from GitHub. This script only copies
    files into the Space clone you provide via -SpacePath. It does NOT touch your
    GitHub repo and it does NOT push — you review and push from the Space folder.

.EXAMPLE
    .\deploy\huggingface\sync_to_space.ps1 -SpacePath "d:\SHASHANK\Vs-code\trisenti-ai-backend"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$SpacePath
)

$ErrorActionPreference = "Stop"

# Project root = two levels up from this script (deploy/huggingface/ -> root)
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path $SpacePath)) {
    Write-Host "ERROR: Space path not found: $SpacePath" -ForegroundColor Red
    Write-Host "Clone it first:" -ForegroundColor Yellow
    Write-Host "  git clone https://huggingface.co/spaces/<user>/trisenti-ai-backend" -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path (Join-Path $SpacePath ".git"))) {
    Write-Host "ERROR: $SpacePath is not a git repo (no .git). Did the clone succeed?" -ForegroundColor Red
    exit 1
}

Write-Host "Project root : $ProjectRoot" -ForegroundColor Cyan
Write-Host "Space repo   : $SpacePath"   -ForegroundColor Cyan
Write-Host ""

# ── Copy single files ─────────────────────────────────────────────────────────
Write-Host "Copying files..." -ForegroundColor Yellow
Copy-Item (Join-Path $ProjectRoot "Dockerfile")                  (Join-Path $SpacePath "Dockerfile") -Force
Copy-Item (Join-Path $ProjectRoot "requirements-backend.txt")    (Join-Path $SpacePath "requirements-backend.txt") -Force
# The Space README MUST be the one with the HF frontmatter:
Copy-Item (Join-Path $ProjectRoot "deploy\huggingface\README.md") (Join-Path $SpacePath "README.md") -Force

# ── Copy folders (clean each first to avoid stale files) ────────────────────────
foreach ($dir in @("api", "preprocessing", "models")) {
    $dest = Join-Path $SpacePath $dir
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item (Join-Path $ProjectRoot $dir) $dest -Recurse -Force
}

# ── Drop caches / backups that shouldn't ship ──────────────────────────────────
Get-ChildItem $SpacePath -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem (Join-Path $SpacePath "models") -Directory -Filter "backup_*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# ── Force small model files to commit as plain git (override HF's LFS defaults) ─
# HF's default .gitattributes routes *.h5/*.pkl/*.bin through git-LFS. Our model
# is ~4 MB total, so plain git is simpler and avoids LFS. We override per-extension.
$gitattributes = Join-Path $SpacePath ".gitattributes"
$override = @"
# TriSenti: small model artifacts (~4 MB) are committed as plain git, not LFS.
*.h5 -filter -diff -merge text=auto
*.pkl -filter -diff -merge text=auto
"@
Add-Content -Path $gitattributes -Value "`n$override"

Write-Host ""
Write-Host "Done. Files staged into the Space clone." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (run inside the Space folder):" -ForegroundColor Cyan
Write-Host "  cd `"$SpacePath`""                      -ForegroundColor White
Write-Host "  git add ."                              -ForegroundColor White
Write-Host "  git commit -m `"Deploy TriSenti backend`"" -ForegroundColor White
Write-Host "  git push"                               -ForegroundColor White
