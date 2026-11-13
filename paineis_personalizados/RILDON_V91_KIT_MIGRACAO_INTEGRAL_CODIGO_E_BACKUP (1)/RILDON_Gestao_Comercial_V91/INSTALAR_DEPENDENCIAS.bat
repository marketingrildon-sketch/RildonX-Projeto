@echo off
cd /d "%~dp0"
py -m pip install -r requirements_postgresql.txt
if errorlevel 1 echo ERRO: verifique sua instalacao Python e conexao com a internet.
pause
