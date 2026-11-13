HELPDESK V21 - VINCULO DE COMPUTADOR + RUSTDESK

Alterações:
- Cadastro de usuários agora possui Nome do computador.
- ID RustDesk continua vinculado ao usuário.
- O banco faz migração automática adicionando a coluna computador em instalações anteriores.
- Após o login do usuário, o formulário de chamado preenche automaticamente:
  * Nome do usuário
  * Unidade/Loja
  * Equipamento (nome do computador cadastrado)
  * ID RustDesk cadastrado
- O ID RustDesk e o equipamento continuam editáveis quando necessário.
- A lista de usuários mostra também o computador cadastrado.

Como usar:
1. Entre como administrador.
2. Abra Usuários.
3. Edite cada usuário e informe o Nome do computador e o ID RustDesk.
4. Salve.
5. Quando esse usuário entrar, o chamado já virá preenchido.
6. Se o usuário trocar de computador, basta alterar o campo no cadastro ou no chamado.

Compatibilidade:
- A migração da base existente é automática.
