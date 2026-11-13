# Benchmark e diagnóstico do RildonX

**Data da análise:** 5 de novembro de 2026  
**Escopo:** Mural, Tarefas, Mensagens, Projetos, Documentos, Calendário, painéis de Meu Espaço e segurança.

## 1. Resumo executivo

O RildonX já reúne páginas integradas ao Supabase e estado compartilhado, quadro Kanban com tarefas e comentários, projetos em lista/grade, feed com enquetes e anexos, conversas, documentos recentes relacionados a mensagens e um Calendário com visões mensal, semanal, diária e agenda. Meu Espaço possui módulos para Marketing, TI, RH/DP, Comercial, Compras, Financeiro/Fiscal, Logística, Qualidade e Gestão.

O maior potencial não está em copiar a amplitude de um ERP, mas em conectar processos: transformar solicitações em tarefas, tarefas em entregas de projeto, arquivos em documentos compartilhados e atividades em indicadores confiáveis. Prioridades:

1. **Confiabilidade e segurança:** rever acesso por perfil/setor, proteção de arquivos, RLS, backup e recuperação.
2. **Fluxos entre páginas:** caixa de entrada de pendências, ações de conversão e links consistentes entre as áreas.
3. **Métricas rastreáveis:** mostrar somente dados disponíveis, com fonte, período, atualização e ausência de dados explícita.
4. **Concluir antes de expandir:** priorizar pesquisa, estados vazios, notificações e permissões.
5. **Atualizar documentação:** o README ainda descreve o produto como protótipo estático sem backend, divergindo do código integrado ao Supabase.

Este relatório é benchmark e recomendação de produto. **Não é auditoria de segurança, teste de invasão, validação do ambiente Supabase nem avaliação jurídica.** Os recursos dos fornecedores variam por plano, região e configuração.

## 2. Método e estado observado

Foram consultadas páginas e materiais oficiais dos fornecedores e inspecionados os arquivos do repositório, distinguindo capacidades encontradas de sugestões. A seleção não é ranking; recursos anunciados podem variar por plano.

- **Mural:** feed com publicações, anexos, prévias de tipos de publicação, enquetes com resultados e eventos; a página inicial mostra publicações recentes.
- **Tarefas:** Kanban agrupado por projeto, busca, movimentação entre etapas conforme permissão, prazo, checklist, responsáveis, comentários e anexos.
- **Mensagens:** lista de conversas diretas e em grupo, ordenada por atividade, com arquivos que podem ser abertos e integrados a Documentos.
- **Projetos:** lista/grade persistida, busca, filtros de status, datas, progresso, contagem de tarefas, participantes, atividade e abas de tarefas/documentos/atividade.
- **Documentos:** lista/grade, pastas, recentes, abertura, download, compartilhamento e separação de documentos gerais e arquivos relacionados a Mensagens, Mural, tarefas e projetos.
- **Calendário:** visões mensal, semanal, diária e agenda; mini-calendário; navegação por período; categorias com cores e filtros; eventos de dia inteiro, local, descrição e visibilidade pessoal/equipe; associação a projeto; exportação `.ics`; integração configurável com Google Calendar. Datas de tarefas e projetos também podem gerar eventos sincronizados.
- **Meu Espaço:** catálogo com calendários e indicadores de Marketing; chamados, manutenção e base de conhecimento de TI; treinamento, recrutamento, férias e exames de RH/DP; vendas e clientes; compras, fornecedores e pedidos; contas, caixa e obrigações fiscais; estoque e entregas; auditorias, riscos, 5W2H, 5S, Kaizen, documentos e indicadores de Qualidade; painéis de Gestão.

A presença de componentes ou definições no código não comprova que todo módulo esteja operacional em produção, com dados completos, autorização correta ou processo validado.

## 3. Diagnóstico e recomendações por página

### 3.1 Mural

**Referências:** [Staffbase](https://staffbase.com/platform) (comunicação interna), [Simpplr](https://www.simpplr.com/overview/) (intranet e descoberta de conteúdo), [Microsoft Viva Engage](https://www.microsoft.com/en-us/microsoft-viva/engage) (comunidades e participação social).

**Diagnóstico:** publicações, anexos, enquetes e eventos dão boa base social. O próximo passo é tornar avisos importantes encontráveis, direcionados e verificáveis, sem misturá-los com conversas informais.

**Layout e experiência visual:** manter uma coluna de leitura central com largura confortável e separar a criação de publicação do feed, recolhendo o compositor após publicar. Dar maior hierarquia visual a comunicados fixados e urgentes, usando rótulo e ícone além da cor. Usar cartões consistentes para publicações, com autor/data, conteúdo e anexos em ordem previsível; recolher textos longos com opção de expandir. Manter filtros e busca em uma barra compacta, com filtros ativos fáceis de remover. Em telas pequenas, priorizar o feed e mover filtros secundários para um painel; evitar colunas laterais que comprimam o conteúdo.

**Implementar/melhorar:** categorias para comunicados institucionais, urgentes e sociais; destinatários por setor e validade; fixação, pesquisa e filtros por tipo/autor/período; confirmação de ciência para avisos críticos; rascunho, prévia, agendamento e aprovação de comunicados; menções e notificações configuráveis; estados claros de carregamento, erro, vazio e acesso negado.

**Evitar:** transformar o Mural em chat ou e-mail; replicar manualmente o mesmo comunicado em várias páginas; enviar notificações irrelevantes sem preferências e resumo.

### 3.2 Tarefas

**Referências:** [Asana](https://asana.com/features/project-management) (coordenação de trabalho), [ClickUp](https://clickup.com/features/tasks) (visualizações e organização de tarefas), [monday.com](https://monday.com/w/use-cases/ai-project-management-software) (quadros e fluxos configuráveis).

**Diagnóstico:** Kanban, busca, movimentação, checklist, comentários, anexos, prazos e responsáveis já estão presentes. A oportunidade é conectar capacidade, dependências e priorização sem sobrecarregar os cartões.

**Layout e experiência visual:** manter uma barra superior enxuta com título, ação principal “Nova tarefa”, busca e filtros; agrupar opções avançadas em filtros expansíveis. No Kanban, mostrar primeiro o seletor de projeto e permitir recolher grupos de projeto, pois empilhar vários quadros pode alongar muito a página. Padronizar cartões com título, responsável, prazo e prioridade como informação primária; checklist e sinais de comentários/anexos ficam em segundo plano. Usar cores apenas como reforço de status, com texto/ícone e contraste acessível. Em telas estreitas, oferecer lista compacta ou rolagem horizontal com cabeçalhos de coluna persistentes; não reduzir os cartões a texto ilegível.

**Implementar/melhorar:** visões “Minhas tarefas”, “Hoje”, “Atrasadas” e “Aguardando terceiros”; filtros salvos; dependências, bloqueios, recorrência e marcos; modelos de solicitação com campos e critérios de aceite; carga de trabalho por responsável e período; conversão de mensagens, posts e solicitações em tarefas mantendo origem e anexos; diferenciação explícita entre prazo, prioridade e estado.

**Evitar:** estados redundantes sem governança, rankings de produtividade individual baseados apenas em volume concluído e cópias da tarefa em notas paralelas.

### 3.3 Mensagens

**Referências:** [Slack](https://slack.com/features) (canais, pesquisa e integrações), [Microsoft Teams](https://www.microsoft.com/en-us/microsoft-teams/group-chat-software) (chat e colaboração), [Google Chat — compartilhamento de arquivos](https://support.google.com/chat/answer/7651457?hl=pt-BR) (anexos e arquivos compartilhados em conversas).

**Diagnóstico:** conversas diretas e em grupo, mensagens recentes e integração de anexos com Documentos já existem. O foco deve ser descoberta, contexto e organização.

**Layout e experiência visual:** preservar o padrão de duas áreas: lista de conversas com busca/filtros e painel de conversa com cabeçalho, histórico e compositor fixo na parte inferior. Diferenciar não lidas por peso tipográfico e marcador, sem depender de cor; exibir prévia e horário sem excesso de metadados. Manter o cabeçalho da conversa visível durante a rolagem e agrupar anexos em cartões compactos. Em celular, usar navegação de uma tela por vez com ação clara de voltar à lista. Colocar ações menos frequentes (silenciar, arquivar, detalhes) em menu contextual, não junto ao botão de enviar.

**Implementar/melhorar:** estados distintos de não lida/lida/silenciada/arquivada; pesquisa de mensagens e anexos; filtros por pessoa/grupo; respostas em thread ou citação; menções configuráveis; salvar/converter mensagem em tarefa com autor, data, conversa e arquivo de origem; área de arquivos por conversa com permissões coerentes; retenção e auditoria segundo política definida.

**Evitar:** grupos duplicados sem responsável/finalidade; tratar leitura de mensagem como ciência formal de comunicado; notificar toda atividade por padrão.

### 3.4 Projetos

**Referências:** [Jira](https://www.atlassian.com/software/jira/features) (planejamento e acompanhamento), [Smartsheet](https://www.smartsheet.com/content/project-management-software) (cronogramas e relatórios), [Wrike PMO](https://www.wrike.com/project-management-office/) (portfólio e risco).

**Diagnóstico:** lista/grade, busca, filtros, progresso, datas, tarefas, participantes, atividades e documentos associados já existem. Falta apoiar previsibilidade e decisões de portfólio sem duplicar o Kanban.

**Implementação:** o resumo compacto destaca totais e projetos que requerem atenção; filtros, ordenação, agrupamento por setor/responsável/fase/saúde e modo de visualização são preservados localmente. A saúde usa prazo vencido, bloqueios/dependências e tempo desde a atualização (7 dias para acompanhar, 14 para atenção); sem baseline, escopo não é pontuado. A linha do tempo reutiliza as tarefas e seus marcos/dependências. Decisões, riscos e mudanças entram no histórico já sincronizado, com data e autor. Checklists de início/encerramento são indicadores derivados dos dados do projeto, não tarefas duplicadas.

**Fórmula de progresso:** soma dos pesos das tarefas concluídas dividida pela soma dos pesos de todas as tarefas vinculadas. O peso pode ser definido no detalhe da tarefa em `metadata.progressWeight`; valor ausente ou inválido vale 1. O estado da fase continua derivado de tarefas concluídas, e o avanço ponderado é exibido em porcentagem com rótulo textual.

**Layout e experiência visual:** apresentar primeiro um resumo curto (totais e alertas acionáveis), depois filtros e lista/grade; evitar vários cartões KPI decorativos que empurrem os projetos para baixo. Na grade, manter cartões com nome, estado, intervalo de datas, progresso e participantes; na lista, alinhar os mesmos campos em colunas para facilitar comparação. Ordenação, filtros e modo de visualização devem ficar agrupados e manter estado ao retornar da página de detalhes. Abrir detalhes em modal central ou painel amplo com abas claras e um cabeçalho persistente contendo nome, estado e ações principais; em celular, usar página/tela cheia em vez de modal estreito. Garantir que o gráfico de progresso tenha rótulo textual equivalente.

**Implementar/melhorar:** marcos, dependências e linha do tempo; saúde do projeto com critérios transparentes (prazo, escopo, bloqueios e atualização); visão executiva de portfólio por setor/responsável/fase/risco; registro de decisões, riscos e mudanças com data e responsável; modelos e checklist de início/encerramento; aviso de projeto sem atualização; fórmula de progresso documentada.

**Evitar:** PMO completo sem processos e dados definidos; duplicar atividades/documentos; calcular progresso só pela quantidade de tarefas quando pesos e critérios diferem.

### 3.5 Documentos

**Referências:** [SharePoint](https://www.microsoft.com/en-us/microsoft-365/sharepoint/collaboration) (bibliotecas e colaboração), [Google Drive](https://workspace.google.com/products/drive/) (arquivos compartilhados), [Dropbox Business](https://www.dropbox.com/business) (armazenamento e compartilhamento).

**Diagnóstico:** lista/grade, pastas, recentes, abertura, download, compartilhamento e separação por contexto já existem. O objetivo deve ser uma fonte confiável, sem cópias independentes.

**Implementação:** barra única com busca, filtros por tipo/pasta/responsável/projeto/setor/período, ordenação, favoritos e visualização; preferências e favoritos são locais ao navegador e separados por conta. Arquivos vinculados a tarefas/projetos permanecem o mesmo registro e exibem link para a origem; anexos salvos de Mensagens continuam usando o registro/objeto existente. A listagem apresenta proprietário, data, tipo, origem e estado de acesso, com ações explícitas, confirmação de remoção, Recentes e cartões responsivos. A abertura e o download renovam URL assinada curta, e novos uploads passam a armazenar um endereço assinado de uma hora em vez de um link público permanente. Uploads parciais mostram estado por arquivo e permitem tentar novamente somente os que falharam.

**Limites de dados e governança:** o esquema atual de `documents` não contém classificação, validade nem histórico/versionamento; por isso a interface não inventa esses valores. Fluxos de revisão, retenção e descarte precisam de uma política definida antes de automação. A URL assinada reduz exposição acidental, mas a privacidade efetiva dos objetos também depende das políticas e da configuração do bucket Supabase; a página não altera configuração global compartilhada com fotos e anexos.

**Layout e experiência visual:** criar uma barra de ferramentas única com busca em destaque, botão de upload e alternância lista/grade; manter filtros e ordenação junto à busca, sem espalhar controles pela página. Mostrar pastas como navegação secundária e deixar “Recentes” visível sem competir com a biblioteca principal. Na lista, priorizar nome, tipo, data, proprietário e ações; na grade, limitar metadados a poucas linhas e deixar ações secundárias em menu. Ações de compartilhar/remover devem ser distintas e confirmadas, evitando ícones ambíguos. Em celular, trocar tabela larga por cartões informativos e manter download/abertura acessíveis. Incluir estados vazios úteis, progresso de upload e erro com opção segura de tentar novamente.

**Implementar/melhorar:** metadados consistentes de nome, tipo, proprietário, origem, data, classificação, permissão e validade; busca e filtros por tipo/pasta/autor/projeto/setor/data; contexto e link de volta para conversa/tarefa/projeto; favoritos; permissões claras; versionamento e histórico; revisão, retenção e descarte para documentos controlados; armazenamento privado, URL temporária e validação no servidor para arquivos confidenciais.

**Evitar:** duplicar anexos de Mensagens em vez de referenciar o mesmo objeto; usar árvore profunda de pastas como única organização; links públicos permanentes para documentos internos.

### 3.6 Calendário

**Referências:** [Google Calendar](https://support.google.com/calendar/answer/2465776?hl=en) (eventos, múltiplos calendários e compartilhamento), [Calendário do Outlook](https://www.microsoft.com/en-us/microsoft-365/outlook/calendar-app) (calendários compartilhados, permissões e diferenciação por cores), [Teamup](https://www.teamup.com/) (subcalendários, filtros e múltiplas visualizações).

**Diagnóstico:** o Calendário já oferece quatro perspectivas — mês, semana, dia e agenda —, criação/edição/exclusão de eventos, eventos de dia inteiro, categorias, visibilidade pessoal ou da equipe, vínculo a projeto e exportação `.ics`. Também há integração preparada para sincronizar datas de tarefas e projetos e conectar uma conta Google. A disponibilidade real da sincronização externa depende das Edge Functions e configurações do Supabase, não verificadas nesta análise. As preferências de categorias personalizadas e categorias ocultas são locais ao navegador.

**Layout e experiência visual:** manter as quatro visões acessíveis e a navegação “Hoje/anterior/próximo” junto ao período exibido. Deixar a ação “Novo evento” evidente sem competir com o calendário; agrupar conexão e exportação como ações secundárias. Manter mini-calendário e filtros de categoria em uma lateral recolhível, dando prioridade à grade ou à agenda principal. Em mês, limitar a prévia diária e oferecer acesso claro aos demais eventos; em semana/dia, preservar legibilidade dos horários e detalhes. Em telas estreitas, preferir agenda/lista e seleção explícita de data em vez de comprimir sete colunas.

**Implementar/melhorar:** busca e filtros por categoria, projeto, origem, responsável e período; participantes e respostas a convites; recorrência e exceções; detecção de conflito e disponibilidade de salas quando houver dados confiáveis; lembretes configuráveis; persistência sincronizada das preferências de categorias entre dispositivos; link de origem para eventos derivados de tarefas/projetos e indicação visual de evento sincronizado; estados claros da conexão, última sincronização e conflitos. Propagar permissões do registro de origem para os eventos relacionados e testar a sincronização com os serviços externos habilitados.

**Evitar:** criar cópias independentes de tarefas ou marcos só para exibi-los no calendário; tratar exportação `.ics` como sincronização contínua; mostrar detalhes privados em calendários de equipe; introduzir recorrência, convites ou alertas sem regras de edição, cancelamento e notificação definidas.

### Mudanças estruturais possíveis

As mudanças abaixo são alternativas de organização da experiência, não uma proposta para remover funcionalidades. Podem ser introduzidas gradualmente, validando cada etapa com usuários e preservando os fluxos atuais.

- **Navegação principal:** agrupar os destinos em blocos com nomes orientados ao trabalho, por exemplo **Comunicação** (Mural, Mensagens), **Execução** (Tarefas, Projetos), **Conteúdo** (Documentos) e **Meu Espaço**. Manter Início como visão geral e evitar adicionar todos os módulos setoriais à navegação principal; eles pertencem à área contextual de Meu Espaço.
- **Início como central de ação:** priorizar itens que exigem atenção — tarefas próximas/atrasadas, comunicados fixados ainda não vistos, solicitações pendentes e atividade relevante — e deixar resumos informativos em segundo plano. Os cards devem levar ao registro original, não criar um segundo lugar de gestão.
- **Mural:** separar estruturalmente o feed social dos comunicados oficiais, por meio de abas ou filtros persistentes como “Atualizações” e “Comunicados”. Se houver aprovação e confirmação de ciência, esses estados ficam na área de comunicados, sem duplicar o post.
- **Tarefas e Projetos:** reservar Tarefas para o trabalho executável e seu fluxo diário; Projetos para objetivo, escopo, pessoas, cronograma, decisões e visão agregada das tarefas. A tarefa continua sendo um registro único, acessível pelo quadro e pela aba do projeto.
- **Calendário:** funcionar como uma visão temporal dos eventos e prazos, não como repositório paralelo de tarefas/projetos. Eventos automáticos devem manter referência ao registro original, respeitar suas permissões e deixar claro quando a data sincronizada é atualizada.
- **Mensagens:** manter a conversa como origem da comunicação; documentos compartilhados e itens salvos aparecem em áreas de referência da conversa, enquanto tarefas criadas a partir dela mantêm link de retorno à mensagem.
- **Documentos:** organizar em uma biblioteca central com filtros contextuais (pessoal, compartilhado, Mensagens, Projetos, Tarefas) em vez de criar cópias ou subbibliotecas isoladas por página. Os contextos devem ser atalhos para o mesmo arquivo e obedecer às mesmas permissões.
- **Meu Espaço:** separar por setor e oferecer uma página inicial configurável com poucos módulos favoritos/pendentes. Dentro de cada setor, distinguir **Painéis** (consulta e indicadores) de **Processos** (cadastros, solicitações e atualização de dados); evitar que painéis de leitura misturem formulários operacionais extensos.
- **Detalhes sem navegação excessiva:** usar painéis ou modais para consulta rápida e edição curta; para formulários longos, conteúdo rico ou fluxos com várias etapas, abrir uma página de detalhe completa com URL própria e retorno preservando filtros/posição.
- **Camadas de complexidade:** mostrar primeiro ações frequentes e informações essenciais; colocar configurações, campos raros, filtros avançados e ações administrativas em áreas secundárias com rótulos explícitos e permissão adequada.

### Princípios visuais compartilhados

- Manter a identidade visual azulada já adotada, usando cores semânticas com parcimônia e sem depender exclusivamente delas para comunicar estado.
- Reutilizar os mesmos padrões de cabeçalho, botão primário, busca, filtros, cartões, modais, tabelas, estados vazios e notificações em todas as páginas.
- Aplicar divulgação progressiva: ações principais sempre visíveis; filtros avançados, metadados e ações raras aparecem sob demanda.
- Dar prioridade ao conteúdo e à tarefa principal da página; reduzir painéis laterais e indicadores que não ajudam a tomar uma ação imediata.
- Oferecer densidade adequada: espaçamento confortável por padrão e opção de visualização compacta para listas longas, sem sacrificar legibilidade.
- Projetar estados de carregamento, erro, vazio, sucesso, permissão negada e salvamento em andamento; evitar páginas que pareçam travadas.
- Garantir responsividade, foco de teclado, áreas de clique adequadas, contraste e hierarquia tipográfica; preservar controles importantes em telas estreitas.
- Usar microinterações discretas para confirmar ações e transições, sem animações que atrasem tarefas repetidas.

## 4. Meu Espaço: painéis e evolução

O catálogo em `assets/js/dashboard-core.js` já contém módulos setoriais. Priorizar painéis acionáveis, com dados rastreáveis e atalhos para resolver pendências; várias sugestões abaixo são melhorias do que existe, não necessariamente novos módulos.

Na navegação do Meu Espaço, manter o painel pessoal configurável separado do catálogo setorial. No catálogo, identificar claramente **Painéis** (consulta e indicadores) e **Processos** (cadastros, solicitações e atualização de dados); processos abertos a partir da biblioteca devem manter um endereço próprio e retornar ao setor, tipo e posição anteriores. Não misturar dados de demonstração com o conteúdo operacional.

| Setor | Base encontrada | Melhorias prioritárias |
|---|---|---|
| **Marketing** | Calendário de conteúdo, indicadores/importação, branding, demandas internas. | Fluxo briefing → produção → aprovação → publicação; fila/SLA; indicadores só do relatório enviado, com unidade, período, origem e atualização; comparar períodos somente quando os dados permitirem. |
| **TI** | Chamados, manutenção, base de conhecimento. | Fila por prioridade/idade/SLA; recorrência; inventário se houver cadastro confiável; ligar soluções aprovadas a artigos. |
| **RH/DP** | Aniversários, férias, treinamento, exames, recrutamento e funcionários. | Jornada de recrutamento, onboarding, capacitação e prazos. Restringir dados pessoais e de saúde; preferir métricas agregadas. |
| **Comercial** | Vendas, sinalização de produtos, folgas, clientes/parceiros. | Pipeline e conversão somente com registros completos; carteira/próximos contatos; vincular pedidos a tarefas e entregas; distinguir dados internos dos resultados financeiros oficiais. |
| **Compras** | Dashboard, saldos, pedidos/entregas, avaliação, comparação, fornecedores. | Requisições/aprovações, ciclo, atrasos e desempenho de fornecedor; trilha de cotação e justificativa; distinguir estimativas de dados confirmados. |
| **Financeiro/Fiscal** | Contas a pagar/receber, fluxo de caixa, obrigações fiscais. | Vencimentos, conciliação e alertas; controle de acesso e auditoria reforçados; validar com sistemas oficiais. |
| **Logística** | Estoque, entregas/transporte, fornecedores. | Itens críticos, pedidos em trânsito e entregas no prazo; unidade/local/data de atualização; não estimar cobertura sem consumo confiável. |
| **Qualidade** | Auditorias, 5W2H, riscos, indicadores, 5S, Kaizen, documentos. | Não conformidades e ações corretivas vencidas; responsável, causa, evidência, eficácia e prazo; revisão documental e definição/fonte de indicadores. |
| **Gestão/Gerência** | Dashboard geral, performance por setor, projetos estratégicos. | Painel executivo enxuto de metas aprovadas, riscos, projetos atrasados e decisões; drill-down à origem; período, cobertura e limitações visíveis; não somar métricas heterogêneas como equivalentes. |

### Estado desta revisão

- **Biblioteca:** o painel pessoal permanece separado do catálogo setorial; o catálogo permite filtrar Todos, Painéis e Processos, mantém a ordem alfabética na visão geral e restaura setor, tipo e posição ao voltar de um processo. Os registros marcados como demonstração não entram nos módulos operacionais.
- **Indicadores de Marketing:** os gráficos usam métricas reconhecidas nos relatórios importados; a tabela identifica zero, valor ausente, não aplicável e falha de leitura, e exibe unidade, período, fonte, atualização e filtros. Comparações entre fontes diferentes são sinalizadas; evolução usa linha e comparações/rankings usam barras.
- **Classificação:** Saldos de Compras, Indicadores de Qualidade e Performance por Setor são Processos, pois permitem cadastrar ou atualizar dados. Módulos de consulta permanecem Painéis.
- **Ainda requer definição operacional:** SLAs e recorrência de chamados, etapas e aprovações, alertas financeiros, regras de conciliação e definições de indicadores variam por setor e fonte de verdade. Não foram inferidos nem preenchidos com métricas fictícias; devem ser definidos pelos responsáveis dos processos antes de automatizá-los.
- **Próxima etapa:** controles de autorização, auditoria e restrição de dados pessoais/financeiros continuam na seção 6 e ficam para a etapa de segurança solicitada separadamente.

### Padrão para indicadores e gráficos

- Mostrar apenas métricas presentes nos dados de origem; não inventar indicadores padrão.
- Exibir rótulo, unidade, período, fonte, atualização e filtros.
- Distinguir zero, valor ausente, falha de importação e métrica não aplicável.
- Escolher o gráfico conforme a pergunta: linha para evolução temporal, barras para comparação e composição somente para partes de um total significativo. Evitar pizza para ranking ou séries longas.
- Permitir abrir os registros de origem conforme a permissão; documentar fórmulas e não comparar definições/coberturas diferentes sem aviso.
- Restringir detalhes e exportação de dados sensíveis de RH, saúde, finanças e desempenho.

## 5. Recomendações transversais

1. **Caixa de entrada de trabalho:** reunir menções, ciência pendente, tarefas atribuídas, aprovações e solicitações; sempre ligar ao registro original.
2. **Pesquisa unificada:** localizar pessoas, mensagens, tarefas, projetos e documentos, aplicando autorização antes de exibir resultados.
3. **Conversão com contexto:** converter solicitação, mensagem ou comentário em tarefa preservando origem, responsável, anexos autorizados e histórico.
4. **Notificações governadas:** preferências por tipo/canal, agrupamento e resumo; reservar urgência a ações que realmente a exigem.
5. **Erro e recuperação:** comunicar falhas de sincronização/upload, permitir nova tentativa segura e registrar operações relevantes.
6. **Acessibilidade:** teclado, foco visível, rótulos, contraste e padrões consistentes para vazio, erro e modal.
7. **Dono do processo:** definir responsável, aprovador, fonte de verdade, retenção e indicador de sucesso para cada módulo.

## 6. Segurança e proteção de dados

Os pontos abaixo são verificações recomendadas; não foi confirmado nesta análise se já estão configurados.

### Prioridade crítica antes de ampliar o uso

- **Banco/RLS:** revisar RLS em todas as tabelas expostas e grants correspondentes; negar por padrão e limitar por usuário, grupo, setor e função. Ocultar botão na interface não é autorização.
- **Storage:** verificar buckets privados, políticas de leitura/escrita/exclusão e titularidade; usar URLs assinadas de curta duração para conteúdo restrito e não persistir URL pública confidencial.
- **Segredos/ambientes:** garantir que `service_role` e chaves privilegiadas não estejam no JavaScript cliente, repositório ou artefatos públicos. Separar desenvolvimento, homologação e produção.
- **Autenticação/sessão:** revisar provedores, recuperação, expiração/renovação, revogação de sessões, proteção contra abuso e MFA para administradores/perfis de alto impacto.
- **Ações sensíveis:** validar no servidor/banco permissões para compartilhar, baixar, excluir, administrar usuários e visualizar dados pessoais; atenção especial a dados médicos, financeiros e de RH.

### Prioridade alta

- **Upload:** tipos permitidos, limite de tamanho/quantidade, validação do conteúdo no servidor, nomes aleatórios, isolamento de arquivos não verificados e proteção contra conteúdo malicioso; não confiar apenas em extensão/MIME do navegador.
- **Auditoria:** registrar ator, ação, objeto, horário, resultado e contexto para permissões, exclusão, exportação e administração; proteger logs e definir retenção.
- **Backup:** cópia independente, retenção e testes regulares de restauração; documentar RPO/RTO e resposta a incidentes.
- **Abuso:** limites de taxa para login, mensagens, upload e operações custosas; monitorar falhas e picos.
- **Navegador:** configurar CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options`, referrer policy e cookies quando aplicável à hospedagem.
- **Dependências/deploy:** inventariar versões, acompanhar vulnerabilidades, revisar alterações e impedir publicar configuração, logs ou dados reais.
- **LGPD:** mapear dados pessoais, finalidade, base legal, retenção, compartilhamentos e responsáveis; minimizar coleta e planejar resposta a incidentes com orientação jurídica.

### Referências de segurança

[OWASP ASVS](https://asvs.owasp.org/), [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), documentação Supabase sobre [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage](https://supabase.com/docs/guides/storage/security/access-control) e [MFA](https://supabase.com/docs/guides/auth/auth-mfa). A `service_role` ignora RLS e deve permanecer exclusivamente em ambiente confiável de servidor.

## 7. Priorização recomendada

| Horizonte | Entregas sugeridas | Critério de conclusão |
|---|---|---|
| **0–30 dias: reduzir risco e atrito** | Revisar RLS/grants e Storage; conferir segredos; corrigir README; documentar fonte/permissão dos dados; melhorar feedback de erro e upload; verificar a implantação e as permissões da integração do Calendário. | Matriz de acesso e testes de permitido/negado; instruções de execução/publicação coerentes com a arquitetura; sincronização externa validada ou sinalizada como indisponível. |
| **30–60 dias: conectar fluxos** | Caixa de entrada; converter mensagem/solicitação em tarefa; origem do documento; busca/filtros; preferências de notificação; busca/filtros no Calendário e links entre eventos e registros de origem. | Links mantêm origem, responsável, permissão e histórico; pesquisa não revela dados fora do acesso; eventos derivados não duplicam os registros originais. |
| **60–90 dias: melhorar decisões** | Marcos/dependências e saúde de projetos; ciência de comunicados; dashboards prioritários com dados reais; auditoria e teste de restauração. | Fórmulas, fontes e atualização visíveis; permissões verificadas; validação por usuários-piloto. |
| **Após validar uso** | Versionamento/retenção avançados; automações setoriais; novos módulos ERP/CRM quando processo e integração estiverem definidos. | Adoção e redução de retrabalho justificam custo de manutenção e governança. |

## 8. Indicadores de sucesso

Medir linha de base antes de fixar metas. Sugestões: tempo até primeira resposta; solicitações dentro do SLA; tarefas bloqueadas/vencidas; projetos sem atualização; ciência de comunicados críticos; tempo para localizar arquivo; falhas/repetições de upload; completude e atualização dos painéis; incidentes de acesso indevido; restaurações de backup testadas.

Não usar ranking individual sem contexto nem publicar dados de RH/saúde em painéis amplos. Métricas devem melhorar processos, não incentivar atalhos.

## 9. Fontes oficiais do benchmark

- **Mural:** [Staffbase](https://staffbase.com/platform), [Simpplr](https://www.simpplr.com/overview/), [Microsoft Viva Engage](https://www.microsoft.com/en-us/microsoft-viva/engage).
- **Tarefas:** [Asana](https://asana.com/features/project-management), [ClickUp](https://clickup.com/features/tasks), [monday.com](https://monday.com/w/use-cases/ai-project-management-software).
- **Mensagens:** [Slack](https://slack.com/features), [Microsoft Teams](https://www.microsoft.com/en-us/microsoft-teams/group-chat-software), [Google Chat — arquivos](https://support.google.com/chat/answer/7651457?hl=pt-BR).
- **Projetos:** [Jira](https://www.atlassian.com/software/jira/features), [Smartsheet](https://www.smartsheet.com/content/project-management-software), [Wrike PMO](https://www.wrike.com/project-management-office/).
- **Documentos:** [SharePoint](https://www.microsoft.com/en-us/microsoft-365/sharepoint/collaboration), [Google Drive](https://workspace.google.com/products/drive/), [Dropbox Business](https://www.dropbox.com/business).
- **Calendário:** [Google Calendar](https://support.google.com/calendar/answer/2465776?hl=en), [Calendário do Outlook](https://www.microsoft.com/en-us/microsoft-365/outlook/calendar-app), [Teamup](https://www.teamup.com/).
- **Segurança:** [OWASP ASVS](https://asvs.owasp.org/), [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).