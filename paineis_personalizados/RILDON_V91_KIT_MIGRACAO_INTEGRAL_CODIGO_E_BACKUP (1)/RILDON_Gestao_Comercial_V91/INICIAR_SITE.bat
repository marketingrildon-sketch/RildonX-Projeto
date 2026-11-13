@echo off
cd /d "%~dp0"
title RILDON GESTAO COMERCIAL V7.0 PostgreSQL - PORTA 8789
py -3 --version >nul 2>&1
if errorlevel 1 (python INICIAR_RILDON.py) else (py -3 INICIAR_RILDON.py)
pause
