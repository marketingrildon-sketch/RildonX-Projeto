# Central de Suporte de TI

A Central substitui o login independente do pacote Helpdesk por sessões RildonX e armazenamento compartilhado no Supabase. Novos chamados começam em branco; o banco SQLite do pacote `paineis_personalizados/Helpdesk Rede` permanece separado e não é alterado.

## Ativação

No SQL Editor do Supabase, execute o script completo de [`supabase-support-tickets.sql`](./supabase-support-tickets.sql). Ele cria as tabelas, a numeração mensal `CH-AAAA-MM-NNNN`, as funções RPC, as políticas RLS e a publicação realtime. Se já tiver executado uma versão anterior, execute novamente o script atualizado para substituir funções e políticas; ele foi escrito para poder ser reaplicado.

As políticas autorizam cada solicitante a ler os próprios chamados e a equipe de TI, gestores e administradores a ler e gerenciar a fila. Confirme que os perfis possuem `id`, `display_name`, `nickname`, `sector` e `role`, como esperado pelo restante do RildonX. Uma atualização de atendimento e seu registro de histórico são gravados na mesma transação.

## Recursos integrados

- Abertura de chamados com unidade, setor do perfil, equipamento, ID RustDesk obrigatório (6 a 20 dígitos), categoria, prioridade e descrição.
- Consulta dos chamados próprios e painel da fila para TI/gestores, com indicadores, busca e filtros.
- Atualização de status/prioridade/responsável, comentários e histórico cronológico.
- Registro da tentativa antes de abrir o protocolo `rustdesk://`, com validação do ID e confirmação.
- Alertas realtime e exportação CSV ou impressão em PDF pelo navegador.

Não há contas ou senhas separadas para o Helpdesk. A criação, ativação e edição de usuários continuam sendo administradas pelas páginas de Pessoas/Perfil do RildonX.

O formulário web não consegue ler o ID da instalação local do RustDesk. O solicitante deve informar o ID mostrado pelo aplicativo no computador com o problema; ler automaticamente esse dado exigiria um agente nativo instalado e autorizado em cada computador.
