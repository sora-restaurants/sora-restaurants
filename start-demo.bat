@echo off
rem Double-click to run the Sora local demo. Close this window (or press Ctrl-C) to stop it.
cd /d "%~dp0"
if not exist node_modules call npx -y pnpm@10.18.0 install
call npx -y pnpm@10.18.0 demo
pause
