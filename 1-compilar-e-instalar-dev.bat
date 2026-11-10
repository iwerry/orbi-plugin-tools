@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Compilando Orbi Plugin Tools... (log em logs\build.txt)
echo === build %date% %time% === > logs\build.txt
cargo test -p orbi-engine --release >> logs\build.txt 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File tools\dev-install.ps1 >> logs\build.txt 2>&1
echo EXIT=%errorlevel% >> logs\build.txt
echo FIM >> logs\build.txt
