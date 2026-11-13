HELPDESK TI - V14
==================

V14 adiciona cadastro de usuários e controle de acesso por unidade.

PERMISSÕES
-----------
- Matriz: usuários vinculados à Matriz visualizam todos os chamados (Matriz + Filial).
- Filial: usuários vinculados à Filial visualizam somente chamados da Filial.
- Um usuário da Filial não consegue alterar um chamado da Matriz, mesmo tentando acessar a URL diretamente.
- Relatórios CSV/PDF e painel também respeitam a unidade do usuário.
- O filtro de unidade fica bloqueado para usuários da Filial.
- Somente um administrador da Matriz pode cadastrar, editar, desativar ou reativar usuários.

CADASTRO DE USUÁRIOS
--------------------
1. Entre na Área do TI com o usuário admin.
2. Clique em "Usuários".
3. Cadastre:
   - Usuário
   - Nome
   - Senha (mínimo 6 caracteres)
   - Loja: Matriz ou Filial
   - Perfil: Operador ou Administrador
4. O usuário poderá entrar pela mesma tela de login.

A conta admin original continua sendo:
- usuário: admin
- senha inicial: 1234

RECOMENDAÇÃO: altere a senha inicial imediatamente.

IMPORTANTE SOBRE O PERFIL
-------------------------
- Administrador da Matriz: pode gerenciar usuários.
- Operador da Matriz: visualiza e atende todos os chamados, mas não gerencia usuários.
- Administrador da Filial: continua limitado à Filial; não recebe acesso ao cadastro de usuários.
- Operador da Filial: limitado à Filial.

BANCO DE DADOS
--------------
A V14 faz migração automática da tabela usuarios_ti e acrescenta os campos:
- loja
- perfil
- ativo
- criado_em

Não é necessário apagar o helpdesk.db.
Os chamados antigos continuam existindo e os que não tinham unidade permanecem como Matriz.

NGROK
-----
A estrutura continua compatível com o iniciar_ngrok.bat.
A filial pode acessar o endereço público do ngrok e entrar com seu usuário próprio.

SEGURANÇA
---------
O ngrok gratuito deixa o sistema acessível pela internet. Portanto:
- use senhas fortes;
- não compartilhe a senha do usuário admin;
- não compartilhe o authtoken do ngrok;
- cadastre uma conta individual para cada usuário da filial;
- desative usuários que não devem mais ter acesso.

ARQUITETURA
-----------
Filial -> Internet -> ngrok -> PC da Matriz/Servidor -> Flask :5000 -> helpdesk.db

OBSERVAÇÃO
----------
O campo Unidade/Loja no formulário público de abertura de chamados ainda pode ser selecionado pelo solicitante.
O controle de acesso desta versão protege o PAINEL, relatórios e alterações dos chamados por usuário autenticado.
Se quiser, a próxima etapa pode vincular o formulário público da filial ao acesso da filial para impedir que o usuário escolha outra unidade.
