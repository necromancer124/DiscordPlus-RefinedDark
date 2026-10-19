@echo off
rem Discord+ Refined Dark - install or update. Extra options: INSTALL.bat -Reinject / -UpdateVencord / -SkipInject
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install.ps1" %*
pause
