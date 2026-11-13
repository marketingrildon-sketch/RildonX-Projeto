@echo off
setlocal
chcp 65001 >nul
if "%~1"=="" (
 echo USO: RESTAURAR_EM_NOVO_AMBIENTE.bat "C:\caminho\backup.dump"
 echo ESTE SCRIPT NAO CRIA BANCO NEM EXECUTA RESTAURACAO SEM REVISAO.
 echo Destino recomendado: banco NOVO e VAZIO no servidor receptor.
 pause
 exit /b 1
)
echo ATENCAO: restaure somente apos criar banco VAZIO e usuario apropriado.
echo Exemplo manual para o DBA:
echo pg_restore --host=HOST_NOVO --username=USUARIO_NOVO --dbname=BANCO_NOVO --no-owner --no-acl --exit-on-error --verbose "%~1"
echo Revise roles, extensoes e permissao de acesso antes de executar.
pause
