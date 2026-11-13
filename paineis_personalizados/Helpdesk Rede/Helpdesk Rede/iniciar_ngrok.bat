@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   HELPDESK TI - TUNEL NGROK
echo ==============================================
echo.

where ngrok >nul 2>nul
if errorlevel 1 (
    echo [ERRO] ngrok nao foi encontrado no PATH.
    echo Instale o ngrok e execute novamente.
    echo.
    echo Windows: winget install ngrok -s msstore
    echo.
    pause
    exit /b 1
)

echo [1/2] Verificando Helpdesk em http://127.0.0.1:5000 ...
python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000', timeout=3)" >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Helpdesk nao esta rodando na porta 5000.
    echo Primeiro execute iniciar.bat e aguarde o navegador abrir.
    echo.
    pause
    exit /b 1
)

echo [2/2] Abrindo tunel publico ngrok para a porta 5000...
echo.
echo A URL HTTPS sera exibida pelo ngrok.
echo Compartilhe essa URL com a filial.
echo.
ngrok http 5000

endlocal
