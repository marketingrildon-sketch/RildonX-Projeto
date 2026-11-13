HELPDESK V22 - RUSTDESK CORRIGIDO

Correções:
- O servidor Flask não tenta executar o RustDesk.
- O navegador da máquina de TI abre diretamente o protocolo rustdesk://.
- O acesso remoto não fica bloqueado caso o registro do histórico apresente erro.
- O endpoint de histórico foi protegido contra erros SQLite e compatibilidade de banco.
- Acesso remoto continua validando ID de 6 a 20 números.
- O computador e o ID RustDesk vinculados ao usuário continuam sendo preenchidos automaticamente.
- O ID continua editável no chamado.
- O acesso é confirmado antes da abertura do RustDesk.

IMPORTANTE:
1. Feche a versão anterior do Helpdesk.
2. Substitua os arquivos pela V22.
3. Inicie novamente pelo iniciar.bat.
4. Faça Ctrl+F5 no navegador.
5. O RustDesk precisa estar instalado na máquina do técnico e o protocolo rustdesk:// precisa estar registrado pelo Windows.
