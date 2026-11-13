@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=rildon_app"
set "PGDATABASE=rildon_gestao"
set "PG_BIN="
for /f "delims=" %%P in ('where pg_dump 2^>nul') do if not defined PG_BIN set "PG_BIN=%%P"
if not defined PG_BIN if exist "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" set "PG_BIN=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if not defined PG_BIN (
 echo ERRO: pg_dump nao encontrado. Instale as ferramentas PostgreSQL ou adicione bin ao PATH.
 pause
 exit /b 1
)
if not exist "BACKUP_GERADO" mkdir "BACKUP_GERADO"
set "ARQUIVO=%CD%\BACKUP_GERADO\rildon_gestao_backup_completo.dump"
echo Banco: %PGDATABASE% ^| Servidor: %PGHOST%:%PGPORT% ^| Usuario: %PGUSER%
echo O PostgreSQL pode pedir a senha do usuario. Nada sera excluido ou modificado.
"%PG_BIN%" -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" --format=custom --blobs --no-owner --no-acl --file="%ARQUIVO%" --verbose
if errorlevel 1 (
 echo ERRO NO BACKUP. Verifique o log, as permissoes e a senha.
 pause
 exit /b 1
)
set "RESTORE_LIST="
for %%A in ("%PG_BIN%") do set "RESTORE_LIST=%%~dpApg_restore.exe"
if exist "%RESTORE_LIST%" (
 "%RESTORE_LIST%" --list "%ARQUIVO%" > "BACKUP_GERADO\LISTA_OBJETOS.txt"
 if errorlevel 1 (echo FALHA NA VALIDACAO DO BACKUP. & pause & exit /b 1)
)
for %%A in ("%ARQUIVO%") do echo BACKUP FINALIZADO: %%~zA bytes
certutil -hashfile "%ARQUIVO%" SHA256 > "BACKUP_GERADO\SHA256_BACKUP.txt"
echo Envie o arquivo .dump e o SHA256 ao setor receptor por canal seguro.
pause
