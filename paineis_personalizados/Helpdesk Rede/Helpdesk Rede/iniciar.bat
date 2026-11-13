@echo off
setlocal
title Helpdesk TI - Servidor
cd /d "%~dp0"
echo.
echo ==================================================
echo              HELPDESK TI - SERVIDOR
echo ==================================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (set "PYTHON=py") else (where python >nul 2>nul && set "PYTHON=python")
if not defined PYTHON (
 echo ERRO: Python nao foi encontrado.
 echo Instale o Python 3 e marque "Add Python to PATH".
 pause
 exit /b 1
)
echo Python encontrado: & %PYTHON% --version
if not exist ".venv\Scripts\python.exe" (
 echo Criando ambiente virtual...
 %PYTHON% -m venv .venv
 if errorlevel 1 (echo ERRO ao criar ambiente virtual.& pause& exit /b 1)
)
set "VENV_PYTHON=%CD%\.venv\Scripts\python.exe"
echo.
echo Verificando dependencias...
"%VENV_PYTHON%" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (echo ERRO ao instalar dependencias.& pause& exit /b 1)
echo.
echo Iniciando servidor Flask...
start "Helpdesk TI - Flask" /min cmd /c ""%VENV_PYTHON%" app.py"
echo Aguardando o servidor iniciar...
set /a TENTATIVAS=0
:AGUARDAR
set /a TENTATIVAS+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
if %errorlevel%==0 goto ABRIR
if %TENTATIVAS% GEQ 20 goto ERRO_SERVIDOR
timeout /t 1 /nobreak >nul
goto AGUARDAR
:ABRIR
echo.
echo ==================================================
echo       HELPDESK INICIADO COM SUCESSO
echo ==================================================
echo.
echo Acesso neste computador: http://127.0.0.1:5000
echo Para outros computadores: http://IP-DESTE-PC:5000
echo.
start "" "http://127.0.0.1:5000"
echo Navegador aberto. O servidor esta rodando.
echo Para encerrar, feche a janela "Helpdesk TI - Flask".
echo.
pause
endlocal
exit /b 0
:ERRO_SERVIDOR
echo.
echo ERRO: o servidor Flask nao respondeu na porta 5000.
echo Verifique a janela "Helpdesk TI - Flask".
pause
endlocal
exit /b 1
