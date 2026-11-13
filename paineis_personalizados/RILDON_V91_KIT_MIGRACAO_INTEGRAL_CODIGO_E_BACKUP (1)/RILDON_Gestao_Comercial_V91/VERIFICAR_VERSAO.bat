@echo off
cd /d "%~dp0"
py -3 --version >nul 2>&1
if errorlevel 1 (python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8789/api/build', timeout=3).read().decode())") else (py -3 -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8789/api/build', timeout=3).read().decode())")
pause
