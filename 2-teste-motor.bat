@echo off
chcp 65001 >nul
cd /d "%~dp0"
set E=target\release\orbi-engine.exe
echo === motor %date% %time% === > logs\motor.txt
%E% version >> logs\motor.txt 2>&1
%E% probe "test-media\orbi-teste-fala-vertical.mp4" >> logs\motor.txt 2>&1
%E% silence "test-media\orbi-teste-fala-vertical.mp4" >> logs\motor.txt 2>&1
%E% beats "test-media\orbi-teste-batida-128bpm.mp3" --params "{\"every\":4}" >> logs\motor.txt 2>&1
%E% guides --out-dir "%TEMP%\orbi\guides" --width 1080 --height 1920 --only tiktok >> logs\motor.txt 2>&1
echo FIM >> logs\motor.txt
