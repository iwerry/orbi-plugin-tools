@echo off
chcp 65001 >nul
cd /d "%~dp0"
set LOG=logs\diagnostico.txt
echo === ORBI diagnostico %date% %time% === > %LOG%
echo [cargo] >> %LOG%
where cargo >> %LOG% 2>&1
cargo --version >> %LOG% 2>&1
rustc --version >> %LOG% 2>&1
rustup show >> %LOG% 2>&1
echo [node] >> %LOG%
where node >> %LOG% 2>&1
node --version >> %LOG% 2>&1
echo [vs] >> %LOG%
"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath >> %LOG% 2>&1
echo [cep] >> %LOG%
dir "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" /b >> %LOG% 2>&1
dir "%APPDATA%\Adobe\CEP\extensions" /b >> %LOG% 2>&1
reg query HKCU\Software\Adobe\CSXS.12 >> %LOG% 2>&1
reg query HKCU\Software\Adobe\CSXS.11 >> %LOG% 2>&1
echo [apps] >> %LOG%
dir "%ProgramFiles%\Adobe" /b >> %LOG% 2>&1
echo FIM >> %LOG%
