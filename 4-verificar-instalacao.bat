@echo off
chcp 65001 >nul
cd /d "%~dp0"
set LOG=logs\verificacao.txt
echo === verificacao %date% %time% === > %LOG%
echo [dev - deve estar vazio de com.orbi] >> %LOG%
dir "%APPDATA%\Adobe\CEP\extensions" /b >> %LOG% 2>&1
echo [extensoes instaladas] >> %LOG%
dir "%CommonProgramFiles(x86)%\Adobe\CEP\extensions" /b >> %LOG% 2>&1
for /d %%D in ("%CommonProgramFiles(x86)%\Adobe\CEP\extensions\com.orbi.*") do if exist "%%D\CSXS\manifest.xml" (echo OK manifest %%~nxD >> %LOG%) else (echo FALTA manifest %%~nxD >> %LOG%)
echo [programa] >> %LOG%
dir "%ProgramFiles%\Orbi Plugin Tools" /s /b >> %LOG% 2>&1
echo [motor] >> %LOG%
"%ProgramFiles%\Orbi Plugin Tools\bin\orbi-engine.exe" version >> %LOG% 2>&1
echo [registro desinstalar] >> %LOG%
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OrbiPluginTools" >> %LOG% 2>&1
echo [PlayerDebugMode] >> %LOG%
reg query HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode >> %LOG% 2>&1
echo FIM >> %LOG%
