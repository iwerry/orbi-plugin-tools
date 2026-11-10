@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Gerando o instalador... (log em logs\instalador.txt)
set /p V=<VERSION
echo === instalador %date% %time% === > logs\instalador.txt
cargo build -p orbi-engine --release >> logs\instalador.txt 2>&1
node tools\build.mjs >> logs\instalador.txt 2>&1
cargo build -p orbi-installer --release >> logs\instalador.txt 2>&1
if not exist out mkdir out
copy /Y target\release\Orbi-Plugin-Tools-Setup.exe out\Orbi-Plugin-Tools-Setup-%V%.exe >> logs\instalador.txt 2>&1
out\Orbi-Plugin-Tools-Setup-%V%.exe --list >> logs\instalador.txt 2>&1
rem volta o modo desenvolvimento (paineis ligados por junction)
node tools\build.mjs --dev >> logs\instalador.txt 2>&1
dir out >> logs\instalador.txt 2>&1
echo FIM >> logs\instalador.txt
