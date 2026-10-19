@echo off
rem Discord+ Refined Dark - revert (menu: remove Discord+ only, or restore original Discord)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\uninstall.ps1" %*
pause
