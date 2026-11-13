# Painéis de Qualidade

A biblioteca de Painéis inclui a aba **Qualidade** com módulos de Auditorias, Planos 5W2H, Riscos, Indicadores, Programa 5S e Kaizen. A gestão de treinamentos é centralizada no painel do setor de RH. Os módulos usam os registros compartilhados existentes (`business_card_records`), identificados por `module_key` e pelo setor `quality`; não mantêm uma cópia independente dos dados.

## Acesso e persistência

- O perfil precisa pertencer ao setor **Qualidade**; os perfis administrativos autorizados continuam com acesso total.
- Execute [`supabase-quality-panels.sql`](./supabase-quality-panels.sql) no editor SQL do Supabase para habilitar o acesso RLS aos registros do setor Qualidade. A migração pressupõe que `business_card_records` já foi criada pela configuração dos cards setoriais.
- A migração permite o setor Qualidade e perfis administrativos/conta proprietária reconhecidos pelo projeto, preservando as políticas atuais para os demais setores.
- A conexão Supabase e a tabela `business_card_records` continuam necessárias para persistir os registros.
- Treinamentos não é duplicado nesta aba: a gestão central fica no painel **Treinamentos e Desenvolvimento** de RH. Registros antigos com `module_key = 'quality-training'`, se existirem, não são apagados pelo código, mas deixam de aparecer na biblioteca.
- Os dados da planilha e dos arquivos de demonstração do SGQ não foram importados.

## Recursos

- **Auditorias:** registro de tipo, setor, auditor, cláusula, contagem de não conformidades e próxima auditoria.
- **Planos 5W2H:** ações com origem, motivo, local, início, prazo, responsável, método, custo e verificação de eficácia; prazos vencidos são destacados.
- **Riscos:** avaliação de probabilidade × impacto, faixa de criticidade, responsável, resposta, revisão e matriz 5×5 filtrável.
- **Indicadores:** medições por competência, meta e sentido desejado; o gráfico permite selecionar um indicador e exibe até 12 medições da mesma série.
- **Programa 5S:** registros de implantação e avaliações por setor, notas de 0 a 5 para cada senso e média das avaliações por setor.
- **Kaizen:** sugestões organizadas em etapas; a situação pode ser atualizada diretamente no quadro.

Todos os módulos compartilham busca, filtros, edição, arquivamento, anexos suportados pelo sistema e exportação CSV. Riscos exportam também criticidade/faixa calculada e avaliações 5S incluem a pontuação total.
