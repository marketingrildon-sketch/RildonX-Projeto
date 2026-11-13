# Painel Manutenção

O painel mantém um inventário compartilhado de equipamentos e sistemas, com manutenção preventiva e corretiva, alertas por prazo/medidor e histórico de serviços. O acesso aos dados é permitido ao setor de TI e aos perfis administrativos autorizados.

## Ativar

1. No editor SQL do projeto Supabase, execute [`supabase-infrastructure-maintenance.sql`](./supabase-infrastructure-maintenance.sql).
2. Confirme que as tabelas `infrastructure_assets` e `infrastructure_maintenance_events`, a função `infrastructure_can_manage_assets()` e a RPC `register_infrastructure_maintenance(...)` foram criadas.
3. O script inclui as tabelas de inventário e histórico em `supabase_realtime` quando essa publicação existe, permitindo atualizar os cards e o histórico sem recarregar a página.
4. Recarregue Início ou Meu Espaço e abra **Manutenção** na biblioteca de painéis.

O script preserva e converte os registros anteriormente cadastrados no módulo genérico `it-infrastructure`, quando a tabela compartilhada `business_card_records` existe. Ele não importa a planilha de demonstração nem seus endereços de rede; o inventário fica vazio quando não há registros existentes.

## Recursos

- Inventário com patrimônio, categoria, modelo, série, endereço IP/hostname, setor, localização, responsável, criticidade, aquisição e garantia.
- Pesquisa e filtros por categoria, status e vencimento.
- Alertas de preventivas vencidas ou próximas (30 dias), garantia vencida e limites de uso configurados para impressoras ou outros medidores.
- Reagendamento automático por intervalo em dias e por leitura do medidor após cada manutenção preventiva.
- Histórico imutável de inspeções, manutenções preventivas e corretivas, incluindo técnico, data, leitura, custo, indisponibilidade e chamado relacionado.
- Exportação CSV do inventário filtrado.
- Arquivamento sem apagar o equipamento ou o histórico associado.

Os dados são novos registros do Supabase, compartilhados somente com usuários autorizados. O painel não envia notificações externas; os alertas são exibidos no próprio painel e no card de resumo.
