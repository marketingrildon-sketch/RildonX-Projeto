HELPDESK TI - V13
==================

NOVIDADE PRINCIPAL: MATRIZ + FILIAL

1. ABERTURA DE CHAMADO
- O formulário agora possui "Unidade / Loja".
- Opções atuais: Matriz e Filial.
- Chamados antigos são considerados Matriz automaticamente.
- A coluna Unidade aparece no painel do TI.

2. LINK DIRETO PARA A FILIAL
O mesmo túnel ngrok pode ser usado pela filial.

Depois de iniciar o Helpdesk e o ngrok, se a URL exibida for:
https://SEU-ENDERECO.ngrok-free.dev

Você pode enviar para a filial:
https://SEU-ENDERECO.ngrok-free.dev/?loja=Filial

Esse link já abre o formulário com "Filial" selecionada. A seleção continua visível para conferência.

IMPORTANTE: esse parâmetro é apenas uma facilidade de uso, não é uma barreira de segurança. Para impedir que alguém altere a unidade, será necessário implementar autenticação/permissão por filial em uma próxima etapa.

3. PAINEL DO TI
- Novo filtro "Todas as unidades / Matriz / Filial".
- Unidade aparece na tabela de chamados.
- A pesquisa também considera a unidade.
- O filtro da unidade é sincronizado com o relatório mensal.

4. RELATÓRIO
- O relatório mensal pode ser filtrado por unidade.
- CSV e PDF levam a unidade do chamado.
- O PDF mostra a unidade selecionada.
- O arquivo exportado recebe sufixo _matriz ou _filial quando aplicável.

5. BANCO DE DADOS
A V13 faz migração automática do banco existente.
Não é necessário apagar o arquivo helpdesk.db.
Chamados anteriores permanecem no banco e recebem "Matriz" como unidade padrão.

6. NGROK
- Execute iniciar.bat no computador que hospeda o Helpdesk.
- Depois execute iniciar_ngrok.bat.
- O ngrok mostrará a URL pública HTTPS.
- A filial acessa essa URL pelo navegador.
- Os chamados continuam gravados no helpdesk.db do computador principal.

7. SEGURANÇA
O ngrok torna o Helpdesk acessível pela internet. Não compartilhe o authtoken do ngrok.
Use uma senha forte para o usuário admin.
Nesta versão, a área pública de abertura/consulta continua sem login, enquanto o painel do TI exige login.

PRÓXIMA EVOLUÇÃO POSSÍVEL
- Usuário específico para cada filial.
- Cada filial visualizar somente os próprios chamados.
- TI/Matriz visualizar todas as unidades.
- Cadastro de várias lojas sem precisar alterar o código.
- Identificação automática da filial por acesso/login.
