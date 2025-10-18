# Diagnostic script for Python environment issue
# Run this in PowerShell from your project directory

Write-Host "=== Current Directory ===" -ForegroundColor Cyan
Get-Location

Write-Host "`n=== Python Version ===" -ForegroundColor Cyan
C:\Python313\python.exe --version

Write-Host "`n=== Checking for virtual environment ===" -ForegroundColor Cyan
if (Test-Path ".venv") {
    Write-Host "Virtual environment found at .venv" -ForegroundColor Green
    if (Test-Path ".venv\Scripts\python.exe") {
        Write-Host "Python executable exists in venv" -ForegroundColor Green
        & .venv\Scripts\python.exe --version
    }
} else {
    Write-Host "No .venv directory found" -ForegroundColor Yellow
}

Write-Host "`n=== Installed packages in system Python ===" -ForegroundColor Cyan
C:\Python313\python.exe -m pip list | Select-String "aspose"

Write-Host "`n=== Checking if uv is installed ===" -ForegroundColor Cyan
try {
    uv --version
    Write-Host "uv is installed" -ForegroundColor Green
} catch {
    Write-Host "uv is NOT installed" -ForegroundColor Red
}

Write-Host "`n=== Project structure ===" -ForegroundColor Cyan
Get-ChildItem -Name

Write-Host "`n=== Checking script ===" -ForegroundColor Cyan
if (Test-Path "drawio\vss-to-svg-converter.py") {
    Write-Host "Script found" -ForegroundColor Green
    Write-Host "`nFirst 20 lines of the script:"
    Get-Content "drawio\vss-to-svg-converter.py" -TotalCount 20
} else {
    Write-Host "Script NOT found" -ForegroundColor Red
}
