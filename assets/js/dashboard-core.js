(function () {
  const STORAGE_KEY = 'rildonx_dashboard_config_v2';
  const LEGACY_STORAGE_KEY = 'rildonx_dashboard_config';
  const HOME_CARDS_STORAGE_KEY = 'rildonx_home_dashboard_cards';
  const HOME_CARDS_LIMIT = 3;
  let activeStorageKey = STORAGE_KEY + ':local';
  let activeHomeCardsStorageKey = HOME_CARDS_STORAGE_KEY + ':local';
  let authenticatedUserId = null;
  let authenticatedUserName = '';
  let authenticatedUserLogin = '';

  const CARD_CATALOG = {
    tarefas: {
      label: 'Tarefas',
      icon: 'task',
      defaults: {
        show: 'pendentes',
        sort: 'prazo',
        quantity: 5
      },
      filters: { pendentes: 'Pendentes', andamento: 'Em andamento', concluidas: 'Concluídas', atrasadas: 'Atrasadas', todas: 'Todas' },
      sorts: { prazo: 'Prazo', recente: 'Mais recentes', prioridade: 'Prioridade' },
      href: 'tarefas.html'
    },
    projetos: {
      label: 'Projetos',
      icon: 'project',
      defaults: {
        show: 'em-andamento',
        sort: 'progresso',
        quantity: 5
      },
      filters: { 'em-andamento': 'Em andamento', planejamento: 'Planejamento', concluidos: 'Concluídos', todos: 'Todos' },
      sorts: { progresso: 'Progresso', recente: 'Atualizados recentemente', prazo: 'Data de conclusão' },
      href: 'projetos.html'
    },
    comunicacao: {
      label: 'Comunicação',
      icon: 'chat',
      defaults: {
        show: 'recentes',
        sort: 'recente',
        quantity: 5
      },
      filters: { recentes: 'Recentes' },
      sorts: { recente: 'Mais recentes' },
      href: 'mensagens.html'
    },
    documentos: {
      label: 'Documentos',
      icon: 'doc',
      defaults: {
        show: 'recentes',
        sort: 'data',
        quantity: 5
      },
      filters: { recentes: 'Recentes' },
      sorts: { data: 'Data de envio', nome: 'Nome' },
      href: 'documentos.html'
    },
    calendario: {
      label: 'Calendário',
      icon: 'calendar',
      defaults: {
        show: 'hoje',
        sort: 'data',
        quantity: 5
      },
      filters: { hoje: 'Hoje', proximos: 'Próximos eventos', todos: 'Todos os próximos' },
      sorts: { data: 'Data e horário' },
      href: 'calendario.html'
    },
    indicadores: {
      label: 'Indicadores',
      icon: 'chart',
      defaults: {
        show: 'kpi-individual',
        sort: 'meta',
        quantity: 4
      },
      filters: { 'kpi-individual': 'Resumo individual' },
      sorts: { meta: 'Resumo' },
      href: 'tarefas.html'
    },
    atividade: {
      label: 'Atividade recente',
      icon: 'activity',
      defaults: { show: 'recentes', sort: 'recente', quantity: 5 },
      filters: { recentes: 'Recentes' },
      sorts: { recente: 'Mais recentes' }
    },
    atalhos: {
      label: 'Ações rápidas',
      icon: 'quick',
      defaults: { show: 'principais', sort: 'personalizada', quantity: 4 },
      filters: { principais: 'Principais ações' },
      sorts: { personalizada: 'Ordem padrão' }
    },
    comemoracoes: {
      label: 'Datas comemorativas',
      icon: 'calendar',
      defaults: { show: 'todas', sort: 'data', quantity: 5 },
      filters: {
        todas: 'Feriados, aniversários e ações comerciais',
        feriado: 'Feriados e datas comemorativas',
        aniversario: 'Aniversários',
        acao_comercial: 'Ações comerciais'
      },
      sorts: { data: 'Próxima data' }
    }

  };

  const BUSINESS_CARD_MODULES = [
    {
      id: 'marketing-content-calendar', sector: 'Marketing', sectorKey: 'marketing', title: 'Calendário de Conteúdo', icon: 'calendar', tone: 'blue',
      defaultStatus: 'Banco de ideias',
      description: 'Planejamento e acompanhamento de publicações e campanhas.', features: ['Visualizar calendário', 'Status das publicações', 'Anexos e briefing', 'Filtros por canal'],
      fields: [
        { key: 'title', label: 'Título do conteúdo', type: 'text', required: true },
        { key: 'status', label: 'Etapa', type: 'select', required: true, options: ['Banco de ideias', 'Em produção', 'Aguardando aprovação', 'Aprovado', 'Agendado', 'Publicado', 'Arquivo'] },
        { key: 'objective', label: 'Objetivo', type: 'text' },
        { key: 'theme', label: 'Tema ou categoria', type: 'text' },
        { key: 'campaign', label: 'Campanha relacionada', type: 'text' },
        { key: 'channel', label: 'Canal', type: 'select', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Blog', 'Site', 'Outro'] },
        { key: 'format', label: 'Formato', type: 'select', options: ['Imagem', 'Carrossel', 'Vídeo', 'Reels', 'Stories', 'Artigo', 'Outro'] },
        { key: 'publishAt', label: 'Data prevista de publicação', type: 'date' },
        { key: 'publishTime', label: 'Horário previsto', type: 'text' },
        { key: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Normal', 'Alta', 'Urgente'] },
        { key: 'owner', label: 'Responsável pela criação', type: 'text' },
        { key: 'participants', label: 'Participantes', type: 'text' },
        { key: 'caption', label: 'Legenda ou texto da publicação', type: 'textarea' },
        { key: 'hashtags', label: 'Hashtags', type: 'text' },
        { key: 'callToAction', label: 'Chamada para ação', type: 'text' },
        { key: 'referenceUrl', label: 'Referência ou link', type: 'url' },
        { key: 'publishedAt', label: 'Data efetiva de publicação', type: 'date' },
        { key: 'publishedUrl', label: 'Link da publicação original', type: 'url' },
        { key: 'notes', label: 'Briefing e observações', type: 'textarea' }
      ]
    },
    {
      id: 'marketing-insights', sector: 'Marketing', sectorKey: 'marketing', title: 'Indicadores de Marketing', icon: 'chart', tone: 'blue',
      description: 'Importe relatórios para acompanhar visibilidade, engajamento e oportunidades comerciais em um só lugar.',
      features: ['Relatórios recentes', 'Redes sociais e campanhas', 'Tráfego e conversões', 'Comparativo mensal e PDF'],
      fields: [
        { key: 'title', label: 'Nome do relatório', type: 'text', required: true }
      ]
    },
    {
      id: 'marketing-materials', sector: 'Marketing', sectorKey: 'marketing', title: 'Branding e Id. Visual', icon: 'doc', tone: 'blue',
      description: 'Central de arquivos, identidade visual e materiais aprovados do Marketing.',
      features: ['Banco de materiais', 'Identidade visual', 'Favoritos', 'Arquivos compartilhados com Documentos'],
      fields: [
        { key: 'title', label: 'Nome do material', type: 'text', required: true },
        { key: 'category', label: 'Categoria', type: 'select', options: ['Logo', 'Identidade visual', 'Imagem', 'Vídeo', 'Apresentação', 'Documento', 'Outro'] },
        { key: 'tags', label: 'Tags', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'marketing-internal-demands', sector: 'Marketing', sectorKey: 'marketing', title: 'Demandas internas', icon: 'task', tone: 'blue',
      description: 'Centralize pedidos de artes, campanhas, materiais e comunicações recebidos de outros setores.',
      features: ['Solicitações recebidas', 'Demandas pendentes', 'Aprovações necessárias', 'Demandas por setor', 'Tempo de atendimento', 'Briefings incompletos'],
      defaultStatus: 'Recebida',
      fields: [
        { key: 'title', label: 'Título da demanda', type: 'text', required: true },
        { key: 'requester', label: 'Solicitante', type: 'text', required: true },
        { key: 'requesterSector', label: 'Setor solicitante', type: 'text', required: true },
        { key: 'description', label: 'Descrição do pedido', type: 'textarea', required: true },
        { key: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Normal', 'Alta', 'Urgente'], defaultValue: 'Normal' },
        { key: 'owner', label: 'Responsável pelo atendimento', type: 'text' },
        { key: 'dueDate', label: 'Prazo', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['Recebida', 'Em triagem', 'Em produção', 'Aguardando aprovação', 'Aguardando solicitante', 'Concluída', 'Cancelada'] },
        { key: 'approvalStatus', label: 'Aprovação', type: 'select', options: ['Não necessária', 'Pendente', 'Aprovada', 'Reprovada'], defaultValue: 'Não necessária' },
        { key: 'briefingObjective', label: 'Briefing · Objetivo', type: 'textarea' },
        { key: 'briefingAudience', label: 'Briefing · Público-alvo', type: 'text' },
        { key: 'briefingDeliverables', label: 'Briefing · Peças e formatos', type: 'text' },
        { key: 'briefingReferences', label: 'Briefing · Referências e observações', type: 'textarea' }
      ]
    },
    {
      id: 'it-support-tickets', sector: 'TI', sectorKey: 'ti', title: 'Chamados de Suporte', icon: 'support', tone: 'cyan',
      description: 'Centralize solicitações, acompanhe a fila de atendimento e registre cada atualização do suporte técnico.', features: ['Abertura e acompanhamento', 'Fila, indicadores e filtros', 'Status e histórico', 'Acesso RustDesk e relatórios'],
      fields: [
        { key: 'title', label: 'Resumo do chamado', type: 'text', required: true },
        { key: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Urgente'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Fechado'] },
        { key: 'assignedTo', label: 'Responsável', type: 'text' },
        { key: 'attachmentUrl', label: 'Link de anexo', type: 'url' },
        { key: 'description', label: 'Descrição', type: 'textarea', required: true }
      ]
    },
    {
      id: 'it-infrastructure', sector: 'TI', sectorKey: 'ti', title: 'Manutenção', icon: 'server', tone: 'cyan',
      description: 'Inventário compartilhado de equipamentos e sistemas, com manutenção preventiva e corretiva, histórico de serviços e alertas de vencimento.',
      features: ['Inventário de equipamentos', 'Alertas por prazo e medidor', 'Histórico preventivo e corretivo', 'Garantia, criticidade e exportação'],
      fields: [
        { key: 'title', label: 'Sistema ou equipamento', type: 'text', required: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Operacional', 'Atenção', 'Indisponível', 'Em manutenção'] },
        { key: 'owner', label: 'Responsável', type: 'text' },
        { key: 'lastCheck', label: 'Última verificação', type: 'date' },
        { key: 'nextMaintenance', label: 'Próxima manutenção', type: 'date' },
        { key: 'monitoringUrl', label: 'Link do monitoramento', type: 'url' },
        { key: 'incidentNotes', label: 'Ocorrência ou ação necessária', type: 'textarea' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'it-knowledge-base', sector: 'TI', sectorKey: 'ti', title: 'Base de Conhecimento', icon: 'book', tone: 'cyan',
      description: 'Centralize tutoriais, manuais, procedimentos e soluções técnicas.', features: ['Busca inteligente', 'Tutoriais em vídeo', 'Documentos técnicos', 'FAQ'],
      fields: [
        { key: 'title', label: 'Título do artigo', type: 'text', required: true },
        { key: 'category', label: 'Categoria', type: 'text' },
        { key: 'url', label: 'Link do conteúdo', type: 'url' },
        { key: 'body', label: 'Conteúdo ou solução', type: 'textarea', required: true }
      ]
    },
    {
      id: 'hr-birthdays', sector: 'RH/DP', sectorKey: 'rh', title: 'Aniversariantes', icon: 'birthday', tone: 'purple',
      description: 'Consulte os aniversariantes do mês e da equipe.', features: ['Lista por dia', 'Enviar parabéns', 'Filtrar por setor', 'Exportar lista'],
      source: 'profiles', fields: []
    },
    {
      id: 'hr-leave-attendance', sector: 'RH/DP', sectorKey: 'rh', title: 'Férias e Ponto', icon: 'calendar', tone: 'purple',
      description: 'Acompanhe férias, banco de horas e registros de ponto.', features: ['Solicitações e aprovações', 'Saldo de férias', 'Ponto do dia', 'Histórico'],
      fields: [
        { key: 'title', label: 'Colaborador', type: 'text', required: true },
        { key: 'kind', label: 'Tipo de registro', type: 'select', options: ['Férias', 'Banco de horas', 'Ajuste de ponto', 'Ausência'] },
        { key: 'startDate', label: 'Data inicial', type: 'date' },
        { key: 'endDate', label: 'Data final', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['Solicitado', 'Aprovado', 'Recusado', 'Concluído'] },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'hr-training', sector: 'RH/DP', sectorKey: 'rh', title: 'Treinamentos e Desenvolvimento', icon: 'training', tone: 'purple',
      description: 'Gerencie turmas, participações, cobertura, validade, pendências e investimentos em capacitação.',
      features: ['Turmas com vários funcionários', 'Cobertura e carga horária', 'Histórico, pendências e vencimentos', 'Investimentos e CSV'],
      fields: [
        { key: 'title', label: 'Treinamento ou curso', type: 'text', required: true },
        { key: 'trainingType', label: 'Tipo', type: 'select', options: ['Curso', 'Palestra', 'Workshop', 'Outro'] },
        { key: 'date', label: 'Data de realização', type: 'date', required: true },
        { key: 'durationHours', label: 'Carga horária (horas)', type: 'number', required: true },
        { key: 'instructor', label: 'Instrutor', type: 'text' },
        { key: 'validityMonths', label: 'Validade (meses)', type: 'number' },
        { key: 'participants', label: 'Funcionários participantes', type: 'employees', required: true }
      ]
    },
    {
      id: 'hr-medical-exams', sector: 'RH/DP', sectorKey: 'rh', title: 'Agendamento de Exames', icon: 'calendar', tone: 'purple',
      description: 'Agende exames ocupacionais, acompanhe prazos e mantenha documentos em área privada do RH.',
      features: ['Agenda integrada ao calendário', 'Vencimentos próximos e atrasados', 'Filtros por tipo e situação', 'Documentos privados por funcionário'],
      fields: []
    },
    {
      id: 'hr-recruitment', sector: 'RH/DP', sectorKey: 'rh', title: 'Recrutamento e Seleção', icon: 'users', tone: 'purple',
      description: 'Organize vagas, talentos, etapas seletivas e avaliações em um fluxo compartilhado e restrito ao RH.',
      features: ['Vagas abertas e responsáveis', 'Pipeline em quadro Kanban ou lista', 'Busca, filtros e etiquetas', 'Histórico, comentários e indicadores'],
      fields: []
    },
    {
      id: 'hr-employee-control', sector: 'RH/DP', sectorKey: 'rh', title: 'Controle de Funcionários', icon: 'users', tone: 'purple',
      description: 'Consulte e gerencie o diretório central de pessoas, cadastros profissionais e acessos aos painéis.',
      features: ['Diretório central de Pessoas', 'Cadastro por convite de e-mail', 'Edição de dados profissionais', 'Permissões individuais de painéis'],
      source: 'profiles', fields: []
    },
    {
      id: 'sales-pipeline', sector: 'Comercial', sectorKey: 'comercial', title: 'Pipeline de Vendas', icon: 'funnel', tone: 'green',
      description: 'Acompanhe oportunidades e etapas do funil comercial.', features: ['Estágios do funil', 'Próximos contatos', 'Valor das negociações', 'Responsável'],
      fields: [
        { key: 'title', label: 'Oportunidade', type: 'text', required: true },
        { key: 'company', label: 'Empresa', type: 'text' },
        { key: 'amount', label: 'Valor estimado (R$)', type: 'number' },
        { key: 'status', label: 'Etapa', type: 'select', options: ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Ganho', 'Perdido'] },
        { key: 'owner', label: 'Responsável', type: 'text' },
        { key: 'nextContact', label: 'Próximo contato', type: 'date' }
      ]
    },
    {
      id: 'sales-product-signals', sector: 'Comercial', sectorKey: 'comercial', title: 'Sinalização de Produtos', icon: 'cart', tone: 'green',
      description: 'Sinalize produtos para Compras e acompanhe as respostas enviadas.', features: ['Nova sinalização', 'Abas Pendentes e Respondidas', 'Filtros de acompanhamento', 'Respostas compartilhadas com Compras'],
      fields: []
    },
    {
      id: 'sales-time-off', sector: 'Comercial', sectorKey: 'comercial', title: 'Escala de Folga', icon: 'calendar', tone: 'green',
      description: 'Planeje duas folgas aos sábados por pessoa a cada mês, com limites por data, rodízio equilibrado, prévia de reajustes e histórico de exceções.',
      features: ['Duas folgas mensais por pessoa', 'Limites de capacidade por sábado', 'Prévia com redistribuição mínima', 'Histórico e exceções autorizadas'],
      fields: []
    },
    {
      id: 'purchase-parts-requests', sector: 'Compras', sectorKey: 'compras', title: 'Sinalização de Produtos', icon: 'cart', tone: 'orange',
      description: 'Consulte e responda as sinalizações recebidas do Comercial.', features: ['Fila de sinalizações recebidas', 'Resposta e previsão de chegada', 'Gerenciar fornecedores', 'Notificações de novos produtos'],
      fields: []
    },
    {
      id: 'purchase-dashboard', sector: 'Compras', sectorKey: 'compras', title: 'Dashboard', icon: 'chart', tone: 'orange',
      description: 'Acompanhe indicadores consolidados de fornecedores, pedidos, avaliações e orçamento.', features: ['Indicadores do período', 'Prazo médio e frete FOB', 'Resumo dos pedidos', 'Dados compartilhados de Compras'],
      fields: []
    },
    {
      id: 'purchase-balances', sector: 'Compras', sectorKey: 'compras', title: 'Saldos', icon: 'chart', tone: 'orange',
      description: 'Consulte e configure o orçamento mensal e a evolução cronológica dos saldos de Compras.', features: ['Orçamento mensal', 'Saldo acumulado entre competências', 'Comprometimento por pedidos', 'Exportação de evolução'],
      fields: []
    },
    {
      id: 'purchase-orders', sector: 'Compras', sectorKey: 'compras', title: 'Pedidos e Entregas', icon: 'truck', tone: 'orange',
      description: 'Acompanhe pedidos, entregas, recebimentos acumulados e saldos pendentes.', features: ['Pedidos e entregas', 'Prazos e status operacionais', 'Recebido, cancelado e pendente', 'Filtros e exportação'],
      fields: []
    },
    {
      id: 'purchase-evaluations', sector: 'Compras', sectorKey: 'compras', title: 'Avaliação', icon: 'star', tone: 'orange',
      description: 'Consulte e registre avaliações de fornecedores pela metodologia 3-RHO.', features: ['Notas de qualidade, preço, entrega e estoque', 'Cálculo da nota final', 'Prazos mensais de entrega', 'Histórico e exportação'],
      fields: []
    },
    {
      id: 'purchase-comparison', sector: 'Compras', sectorKey: 'compras', title: 'Comparativo', icon: 'chart', tone: 'orange',
      description: 'Compare indicadores de dois a cinco fornecedores no mesmo período.', features: ['Métricas compartilhadas', 'Período comum', 'Comparação lado a lado', 'Exportação do comparativo'],
      fields: []
    },
    {
      id: 'purchase-suppliers', sector: 'Compras', sectorKey: 'compras', title: 'Gestão de Fornecedores', icon: 'truck', tone: 'orange',
      description: 'Mantenha o cadastro de fornecedores e compradores e consulte a rastreabilidade do módulo.',
      features: ['Cadastro e histórico de fornecedores', 'Cadastro de compradores', 'Situação dos cadastros', 'Rastreabilidade administrativa'],
      fields: []
    },
    {
      id: 'sales-clients', sector: 'Comercial', sectorKey: 'comercial', title: 'Clientes e Parceiros', icon: 'users', tone: 'green',
      description: 'Consulte informações, contatos e histórico de relacionamento comercial.', features: ['Dados cadastrais', 'Histórico de compras', 'Contatos', 'Documentos'],
      fields: [
        { key: 'title', label: 'Cliente ou parceiro', type: 'text', required: true },
        { key: 'contact', label: 'Pessoa de contato', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'phone', label: 'Telefone', type: 'tel' },
        { key: 'status', label: 'Relacionamento', type: 'select', options: ['Prospecto', 'Ativo', 'Inativo', 'Parceiro'] },
        { key: 'notes', label: 'Histórico ou observações', type: 'textarea' }
      ]
    },
    {
      id: 'finance-payables-receivables', sector: 'Financeiro / Fiscal', sectorKey: 'financeiro', title: 'Contas a Pagar e Receber', icon: 'doc', tone: 'orange',
      description: 'Acompanhe vencimentos, pagamentos e recebimentos.', features: ['Vencimentos', 'Status dos pagamentos', 'Filtros e categorias', 'Relatórios'],
      fields: [
        { key: 'title', label: 'Lançamento', type: 'text', required: true },
        { key: 'kind', label: 'Tipo', type: 'select', options: ['A pagar', 'A receber'] },
        { key: 'amount', label: 'Valor (R$)', type: 'number', required: true },
        { key: 'dueDate', label: 'Vencimento', type: 'date', required: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Pago', 'Recebido', 'Atrasado', 'Cancelado'] },
        { key: 'category', label: 'Categoria', type: 'text' }
      ]
    },
    {
      id: 'finance-cashflow', sector: 'Financeiro / Fiscal', sectorKey: 'financeiro', title: 'Fluxo de Caixa', icon: 'chart', tone: 'orange',
      description: 'Acompanhe a movimentação financeira da empresa.', features: ['Entradas e saídas', 'Projeção de saldo', 'Comparativo por período', 'Gráficos'],
      fields: [
        { key: 'title', label: 'Movimentação', type: 'text', required: true },
        { key: 'kind', label: 'Tipo', type: 'select', options: ['Entrada', 'Saída'] },
        { key: 'amount', label: 'Valor (R$)', type: 'number', required: true },
        { key: 'date', label: 'Data', type: 'date', required: true },
        { key: 'category', label: 'Categoria', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'finance-tax-obligations', sector: 'Financeiro / Fiscal', sectorKey: 'financeiro', title: 'Obrigações Fiscais', icon: 'shield', tone: 'orange',
      description: 'Controle prazos e documentos fiscais.', features: ['Calendário fiscal', 'Documentos pendentes', 'Arquivos e relatórios', 'Alertas'],
      fields: [
        { key: 'title', label: 'Obrigação fiscal', type: 'text', required: true },
        { key: 'dueDate', label: 'Prazo', type: 'date', required: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Em preparação', 'Enviada', 'Concluída', 'Atrasada'] },
        { key: 'url', label: 'Link do documento', type: 'url' },
        { key: 'owner', label: 'Responsável', type: 'text' }
      ]
    },
    {
      id: 'logistics-inventory', sector: 'Logística', sectorKey: 'logistica', title: 'Estoque', icon: 'box', tone: 'cyan',
      description: 'Acompanhe saldos, movimentações e alertas de estoque.', features: ['Saldo por produto', 'Entradas e saídas', 'Alertas de mínimo', 'Histórico'],
      fields: [
        { key: 'title', label: 'Produto', type: 'text', required: true },
        { key: 'sku', label: 'Código / SKU', type: 'text' },
        { key: 'quantity', label: 'Quantidade atual', type: 'number', required: true },
        { key: 'minimum', label: 'Estoque mínimo', type: 'number' },
        { key: 'location', label: 'Localização', type: 'text' }
      ]
    },
    {
      id: 'logistics-deliveries', sector: 'Logística', sectorKey: 'logistica', title: 'Entregas e Transportes', icon: 'truck', tone: 'cyan',
      description: 'Monitore entregas, coletas e status de transporte.', features: ['Rastreamento', 'Status da entrega', 'Motoristas', 'Comprovantes'],
      fields: [
        { key: 'title', label: 'Entrega ou coleta', type: 'text', required: true },
        { key: 'tracking', label: 'Código de rastreio', type: 'text' },
        { key: 'carrier', label: 'Transportadora', type: 'text' },
        { key: 'destination', label: 'Destino', type: 'text' },
        { key: 'dueDate', label: 'Previsão de entrega', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['Aguardando coleta', 'Em trânsito', 'Saiu para entrega', 'Entregue', 'Atrasada', 'Cancelada'] }
      ]
    },
    {
      id: 'logistics-suppliers', sector: 'Logística', sectorKey: 'logistica', title: 'Fornecedores', icon: 'users', tone: 'cyan',
      description: 'Gerencie informações e desempenho dos fornecedores.', features: ['Dados cadastrais', 'Pedidos e entregas', 'Avaliações', 'Histórico'],
      fields: [
        { key: 'title', label: 'Fornecedor', type: 'text', required: true },
        { key: 'contact', label: 'Contato', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'phone', label: 'Telefone', type: 'tel' },
        { key: 'rating', label: 'Avaliação (1-5)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Em avaliação', 'Suspenso', 'Inativo'] }
      ]
    },
    {
      id: 'quality-audits', sector: 'Qualidade', sectorKey: 'quality', title: 'Auditorias', icon: 'search', tone: 'pink', defaultStatus: 'Agendada',
      description: 'Registre auditorias internas, cláusulas avaliadas, não conformidades e próximos prazos.',
      features: ['Tipo e setor auditado', 'Auditor e cláusula ISO', 'Contagem de não conformidades', 'Próxima auditoria'],
      fields: [
        { key: 'title', label: 'Identificação da auditoria', type: 'text', required: true },
        { key: 'date', label: 'Data da auditoria', type: 'date', required: true },
        { key: 'auditType', label: 'Tipo de auditoria', type: 'text', required: true },
        { key: 'sector', label: 'Setor auditado', type: 'text', required: true },
        { key: 'auditor', label: 'Auditor responsável', type: 'text' },
        { key: 'isoClause', label: 'Cláusula ISO', type: 'text' },
        { key: 'nonconformities', label: 'Não conformidades encontradas', type: 'number', required: true },
        { key: 'status', label: 'Situação', type: 'select', required: true, options: ['Agendada', 'Concluída'] },
        { key: 'nextAuditDate', label: 'Prazo para próxima auditoria', type: 'date' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'quality-5w2h', sector: 'Qualidade', sectorKey: 'quality', title: 'Planos 5W2H', icon: 'target', tone: 'pink', defaultStatus: 'Aberto',
      description: 'Estruture ações de melhoria com origem, motivo, local, prazo, responsável, método e custo estimado.',
      features: ['Plano 5W2H completo', 'Prazos e responsáveis', 'Acompanhamento de execução', 'Verificação de eficácia'],
      fields: [
        { key: 'title', label: 'O que será feito (What)', type: 'text', required: true },
        { key: 'origin', label: 'Origem / registro relacionado', type: 'text' },
        { key: 'why', label: 'Por que será feito (Why)', type: 'textarea' },
        { key: 'where', label: 'Onde / setor (Where)', type: 'text' },
        { key: 'startDate', label: 'Início / quando (When)', type: 'date' },
        { key: 'dueDate', label: 'Prazo da ação', type: 'date' },
        { key: 'responsible', label: 'Responsável (Who)', type: 'text' },
        { key: 'how', label: 'Como será feito (How)', type: 'textarea' },
        { key: 'estimatedCost', label: 'Quanto / custo estimado (How much)', type: 'number' },
        { key: 'status', label: 'Situação', type: 'select', required: true, options: ['Aberto', 'Em Andamento', 'Concluído'] },
        { key: 'efficacyVerified', label: 'Eficácia verificada', type: 'select', options: ['Não', 'Sim'] },
        { key: 'efficacyNotes', label: 'Evidência / observações da eficácia', type: 'textarea' }
      ]
    },
    {
      id: 'quality-risks', sector: 'Qualidade', sectorKey: 'quality', title: 'Riscos', icon: 'shield', tone: 'pink', defaultStatus: 'Identificado',
      description: 'Avalie riscos por probabilidade e impacto, acompanhe respostas e revisões em uma matriz 5 × 5.',
      features: ['Probabilidade × impacto', 'Matriz de criticidade', 'Resposta e responsável', 'Alertas de revisão'],
      fields: [
        { key: 'title', label: 'Descrição da ameaça / risco', type: 'text', required: true },
        { key: 'identifiedOn', label: 'Data de identificação', type: 'date', required: true },
        { key: 'process', label: 'Processo / setor', type: 'text', required: true },
        { key: 'probability', label: 'Probabilidade (1 a 5)', type: 'select', required: true, options: ['1 - Raro', '2 - Improvável', '3 - Possível', '4 - Provável', '5 - Quase Certo'] },
        { key: 'impact', label: 'Impacto (1 a 5)', type: 'select', required: true, options: ['1 - Leve', '2 - Menor', '3 - Moderado', '4 - Maior', '5 - Catastrófico'] },
        { key: 'response', label: 'Resposta ao risco', type: 'select', required: true, options: ['Evitar', 'Mitigar', 'Transferir', 'Aceitar'] },
        { key: 'responsible', label: 'Responsável', type: 'text', required: true },
        { key: 'nextReview', label: 'Próxima revisão', type: 'date' },
        { key: 'status', label: 'Situação', type: 'select', required: true, options: ['Identificado', 'Em Tratamento', 'Encerrado'] }
      ]
    },
    {
      id: 'quality-indicators', sector: 'Qualidade', sectorKey: 'quality', title: 'Indicadores', icon: 'chart', tone: 'pink',
      description: 'Cadastre metas mensais e registre resultados por competência, setor e sentido da meta.',
      features: ['Metas e periodicidade mensal', 'Histórico por competência', 'Gráfico de resultados', 'Direção da meta configurável'],
      fields: [
        { key: 'title', label: 'Nome do indicador', type: 'text', required: true },
        { key: 'sector', label: 'Setor', type: 'text' },
        { key: 'measurementMonth', label: 'Competência', type: 'month', required: true },
        { key: 'value', label: 'Resultado do mês', type: 'number', required: true },
        { key: 'target', label: 'Meta', type: 'number', required: true },
        { key: 'unit', label: 'Unidade de medida', type: 'text' },
        { key: 'direction', label: 'Sentido desejado', type: 'select', required: true, options: ['Quanto maior, melhor', 'Quanto menor, melhor'] },
        { key: 'responsible', label: 'Responsável', type: 'text' },
        { key: 'source', label: 'Fonte / método de apuração', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'quality-5s', sector: 'Qualidade', sectorKey: 'quality', title: 'Programa 5S', icon: 'check', tone: 'pink', defaultStatus: 'Planejada',
      description: 'Acompanhe a implantação por setor e registre avaliações periódicas dos cinco sensos.',
      features: ['Implantação e próximas avaliações', 'Notas de 0 a 5 por senso', 'Média por setor', 'Histórico de avaliações'],
      fields: [
        { key: 'title', label: 'Registro / identificação', type: 'text', required: true },
        { key: 'recordType', label: 'Tipo de registro', type: 'select', required: true, options: ['Implantação', 'Avaliação'] },
        { key: 'sector', label: 'Setor', type: 'text', required: true },
        { key: 'date', label: 'Data da implantação / avaliação', type: 'date', required: true },
        { key: 'responsible', label: 'Responsável / auditor', type: 'text', required: true },
        { key: 'status', label: 'Situação', type: 'select', required: true, options: ['Planejada', 'Em Andamento', 'Concluída'] },
        { key: 'nextEvaluation', label: 'Próxima avaliação', type: 'date' },
        { key: 'seiri', label: 'Seiri · Utilização (0 a 5)', type: 'number' },
        { key: 'seiton', label: 'Seiton · Organização (0 a 5)', type: 'number' },
        { key: 'seiso', label: 'Seiso · Limpeza (0 a 5)', type: 'number' },
        { key: 'seiketsu', label: 'Seiketsu · Padronização (0 a 5)', type: 'number' },
        { key: 'shitsuke', label: 'Shitsuke · Disciplina (0 a 5)', type: 'number' },
        { key: 'notes', label: 'Observações / plano de implantação', type: 'textarea' }
      ]
    },
    {
      id: 'quality-kaizen', sector: 'Qualidade', sectorKey: 'quality', title: 'Kaizen', icon: 'activity', tone: 'pink', defaultStatus: 'Sugerido',
      description: 'Receba e acompanhe sugestões de melhoria em um fluxo visual desde a ideia até a implementação.',
      features: ['Problema e ideia de melhoria', 'Benefício esperado', 'Fluxo Kanban por situação', 'Acompanhamento por setor'],
      fields: [
        { key: 'title', label: 'Ideia de melhoria', type: 'text', required: true },
        { key: 'date', label: 'Data da sugestão', type: 'date', required: true },
        { key: 'author', label: 'Autor da sugestão', type: 'text', required: true },
        { key: 'sector', label: 'Setor', type: 'text' },
        { key: 'problem', label: 'Problema observado', type: 'textarea', required: true },
        { key: 'idea', label: 'Proposta de melhoria', type: 'textarea', required: true },
        { key: 'expectedBenefit', label: 'Benefício esperado', type: 'textarea', required: true },
        { key: 'status', label: 'Situação', type: 'select', required: true, options: ['Sugerido', 'Avaliando', 'Aprovado', 'Implementado', 'Rejeitado'] }
      ]
    },
    {
      id: 'quality-documents', sector: 'Qualidade', sectorKey: 'quality', title: 'Gestão de Documentos', icon: 'doc', tone: 'pink',
      description: 'Cadastre e consulte documentos internos, responsáveis por etapa e links para anexos externos.',
      features: ['Código, versão, setor e situação', 'Pessoas por etapa documental', 'Filtro por setor', 'Exportação CSV e PDF'],
      fields: []
    },
    {
      id: 'management-overview', sector: 'Gerência / Gestão', sectorKey: 'gerencia', title: 'Dashboard Geral', icon: 'chart', tone: 'red',
      description: 'Visão consolidada dos principais indicadores da empresa.', features: ['Indicadores gerais', 'Gráficos e comparativos', 'Acesso rápido', 'Exportação de relatórios'],
      source: 'overview', fields: []
    },
    {
      id: 'management-sector-performance', sector: 'Gerência / Gestão', sectorKey: 'gerencia', title: 'Performance por Setor', icon: 'users', tone: 'red',
      description: 'Compare resultados, metas e indicadores entre setores.', features: ['Metas e resultados', 'Ranking de setores', 'Indicadores personalizados', 'Comparativos'],
      fields: [
        { key: 'title', label: 'Indicador ou meta', type: 'text', required: true },
        { key: 'sector', label: 'Setor avaliado', type: 'select', options: ['Marketing', 'TI', 'RH', 'Comercial', 'Financeiro', 'Logística'] },
        { key: 'target', label: 'Meta', type: 'number' },
        { key: 'value', label: 'Resultado atual', type: 'number' },
        { key: 'period', label: 'Período', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea' }
      ]
    },
    {
      id: 'management-strategic-projects', sector: 'Gerência / Gestão', sectorKey: 'gerencia', title: 'Projetos Estratégicos', icon: 'target', tone: 'red',
      description: 'Acompanhe iniciativas prioritárias da empresa.', features: ['Status e prazos', 'Responsáveis', 'Marcos e entregas', 'Riscos e pendências'],
      source: 'projects', fields: []
    }
  ];

  window.RildonXPanelCatalog = BUSINESS_CARD_MODULES.map(function (module) {
    return { id: module.id, title: module.title, sector: module.sector, tone: module.tone };
  });

  BUSINESS_CARD_MODULES.forEach(function (module) {
    CARD_CATALOG[module.id] = {
      label: module.title,
      icon: module.icon,
      moduleType: true,
      module: module.id,
      sector: module.sectorKey,
      defaults: { show: 'todos', sort: 'recente', quantity: 5 },
      filters: { todos: 'Todos', pendentes: 'Pendentes', andamento: 'Em andamento', concluidos: 'Concluídos' },
      sorts: { recente: 'Mais recentes', nome: 'Nome' },
      href: 'meu-espaco.html'
    };
  });

  const DEFAULT_DASHBOARD = {
    columns: 2,
    density: 'comfortable',
    cards: [
      {
        id: 'card-minhas-tarefas',
        type: 'tarefas',
        title: 'Minhas tarefas',
        enabled: true,
        position: 0,
        filters: { show: 'pendentes', sort: 'prazo', quantity: 5 }
      },
      {
        id: 'card-meus-projetos',
        type: 'projetos',
        title: 'Meus projetos',
        enabled: true,
        position: 1,
        filters: { show: 'em-andamento', sort: 'progresso', quantity: 5 }
      },
      {
        id: 'card-kpi-individual',
        type: 'indicadores',
        title: 'KPI individual',
        enabled: true,
        position: 2,
        size: 'large',
        filters: { show: 'kpi-individual', sort: 'meta', quantity: 4 }
      },
      {
        id: 'cardagenda-dia',
        type: 'calendario',
        title: 'Agenda do dia',
        enabled: true,
        position: 3,
        filters: { show: 'hoje', sort: 'data', quantity: 5 }
      },
      {
        id: 'card-atividade',
        type: 'atividade',
        title: 'Atividade recente',
        enabled: true,
        position: 4,
        filters: { show: 'recentes', sort: 'recente', quantity: 5 }
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function iconMarkup(name) {
    const paths = {
      task: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3h8M8 11l2 2 4-4M8 17h8"/>',
      project: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
      doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
      chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/><path d="M8 12h8M8 9h5"/>',
      chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 6-7"/>',
      activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
      quick: '<path d="M12 5v14M5 12h14"/>',
      star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-1.7 2.94-.08-.03a1.65 1.65 0 0 0-1.85.33l-.06.06h-3.4l-.03-.08a1.65 1.65 0 0 0-1.52-1.1 1.65 1.65 0 0 0-.73.16l-.08.04-2.94-1.7.03-.08a1.65 1.65 0 0 0-.33-1.85l-.06-.06v-3.4l.08-.03a1.65 1.65 0 0 0 1.1-1.52 1.65 1.65 0 0 0-.16-.73l-.04-.08 1.7-2.94.08.03a1.65 1.65 0 0 0 1.85-.33l.06-.06h3.4l.03.08a1.65 1.65 0 0 0 1.52 1.1 1.65 1.65 0 0 0 .73-.16l.08-.04 2.94 1.7-.03.08a1.65 1.65 0 0 0 .33 1.85l.06.06v3.4z"/>',
      resize: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M13 17h8M17 13v8"/>',
      birthday: '<path d="M4 12h16v8H4zM2 20h20M12 12V5M12 5c-3-4-6 0-2 2M12 5c3-4 6 0 2 2M4 16h16"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      support: '<path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2zM19 13h-2v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM17 19c-1 2-3 2-5 2"/>',
      server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7h.01M7 16h.01M11 7h6M11 16h6"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20M8 7h8M8 11h8"/>',
      training: '<path d="m2 10 10-6 10 6-10 6z"/><path d="M6 12v5c4 3 8 3 12 0v-5M22 10v6"/>',
      move: '<path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"/>',
      funnel: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
      cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.5 12.5a2 2 0 0 0 2 1.5h9a2 2 0 0 0 2-1.5L21 8H5"/>',
      shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
      box: '<path d="m12 3 9 5v8l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
      truck: '<path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="19" r="2"/><circle cx="17.5" cy="19" r="2"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || paths.activity) + '</svg>';
  }

  function appState() {
    return window.RildonXStore ? window.RildonXStore.getState() : {};
  }

  function getCurrentProfile(data) {
    const user = data.user || {};
    return (data.profiles || []).find(function (profile) {
      return profile.id === (authenticatedUserId || user.id);
    }) || Object.assign({}, user, {
      id: authenticatedUserId || user.id,
      name: authenticatedUserName || user.name
    });
  }

  function currentUserNames(data) {
    const profile = getCurrentProfile(data);
    return [profile.displayName, profile.nickname, profile.name].filter(Boolean).map(function (name) {
      return String(name).trim().toLocaleLowerCase('pt-BR');
    });
  }

  function normalizedSector(value) {
    const sector = String(value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (sector.indexOf('marketing') === 0 || sector.indexOf('comunicacao') === 0) return 'marketing';
    if (sector === 'ti' || sector.indexOf('tecnologia') === 0 || sector.indexOf('infra') === 0) return 'ti';
    if (sector.indexOf('qualidade') === 0 || sector === 'quality' || sector.indexOf('sgq') === 0) return 'quality';
    if (sector === 'rh' || sector.indexOf('rh/') === 0 || sector.indexOf('rhdp') === 0 ||
        sector.indexOf('recursos humanos') === 0) return 'rh';
    if (sector.indexOf('compras') === 0) return 'compras';
    if (sector.indexOf('comercial') === 0 || sector.indexOf('vendas') === 0) return 'comercial';
    if (sector.indexOf('financeiro') === 0 || sector.indexOf('fiscal') === 0) return 'financeiro';
    if (sector.indexOf('logistica') === 0 || sector.indexOf('estoque') === 0) return 'logistica';
    if (sector.indexOf('gerencia') === 0 || sector.indexOf('gestao') === 0 || sector.indexOf('diretoria') === 0) return 'gerencia';
    return sector;
  }

  function isBusinessCardManager(data) {
    const profile = getCurrentProfile(data);
    const role = String(profile.role || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const accountNames = [profile.nickname, profile.email, authenticatedUserLogin, data.user && data.user.email]
      .filter(Boolean).map(function (value) { return String(value).trim().toLocaleLowerCase('pt-BR'); });
    const isAdsonAccount = accountNames.some(function (value) {
      return value === 'adson.ri' || value.indexOf('adson.ri@') === 0;
    });
    return isAdsonAccount || normalizedSector(profile.sector) === 'gerencia' || /adm|gerente|gestor|diretor/.test(role);
  }

  function canManagePeopleProfiles(data) {
    const profile = getCurrentProfile(data);
    return profile.active !== false && (isBusinessCardManager(data) || normalizedSector(profile.sector) === 'rh');
  }

  function canAccessRecruitment(data) {
    const profile = getCurrentProfile(data);
    return profile.active !== false && (
      isBusinessCardManager(data) ||
      (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf('hr-recruitment') !== -1)
    );
  }

  function isPurchasePartsBuyer(data) {
    const profile = getCurrentProfile(data);
    return profile.active !== false && (isBusinessCardManager(data) ||
      normalizedSector(profile.sector) === 'compras' ||
      String(profile.sector || '').toLocaleLowerCase('pt-BR').includes('compras'));
  }

  function canAccessBusinessCard(module, data) {
    const profile = getCurrentProfile(data);
    if (profile.active === false) return false;
    if (module.id === 'hr-employee-control' || module.id === 'hr-medical-exams') return canManagePeopleProfiles(data);
    if (module.id === 'hr-recruitment') return canAccessRecruitment(data);
    if (module.id === 'purchase-parts-requests') return isPurchasePartsBuyer(data);
    if (module.id.indexOf('purchase-') === 0 && module.id !== 'purchase-parts-requests') {
      return isBusinessCardManager(data) || normalizedSector(profile.sector).indexOf('compras') !== -1 ||
        (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (module.id === 'sales-product-signals') {
      return isBusinessCardManager(data) ||
        (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (module.id === 'sales-time-off') {
      return isBusinessCardManager(data) || normalizedSector(profile.sector) === 'comercial' ||
        (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (isBusinessCardManager(data)) return true;
    return Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1;
  }

  function profileCanAccessBusinessCard(module, profile) {
    if (!profile || profile.active === false) return false;
    const role = String(profile.role || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const accountNames = [profile.nickname, profile.email, profile.workEmail, profile.work_email]
      .filter(Boolean).map(function (value) { return String(value).trim().toLocaleLowerCase('pt-BR'); });
    const isAdsonAccount = accountNames.some(function (value) {
      return value === 'adson.ri' || value.indexOf('adson.ri@') === 0;
    });
    const isManager = isAdsonAccount || normalizedSector(profile.sector) === 'gerencia' ||
      /adm|gerente|gestor|diretor/.test(role);
    if (module.id === 'hr-employee-control' || module.id === 'hr-medical-exams') {
      return isManager || normalizedSector(profile.sector) === 'rh';
    }
    if (module.id === 'hr-recruitment') {
      return isManager || (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (module.id === 'purchase-parts-requests') {
      return isManager || normalizedSector(profile.sector).indexOf('compras') !== -1 ||
        String(profile.sector || '').toLocaleLowerCase('pt-BR').includes('compras');
    }
    if (module.id.indexOf('purchase-') === 0 && module.id !== 'purchase-parts-requests') {
      return isManager || normalizedSector(profile.sector) === 'compras' ||
        (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (module.id === 'sales-product-signals') {
      return isManager || (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (module.id === 'sales-time-off') {
      return isManager || normalizedSector(profile.sector) === 'comercial' ||
        (Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1);
    }
    if (isManager) return true;
    return Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(module.id) !== -1;
  }

  function isOwnTask(task, data) {
    const user = getCurrentProfile(data);
    if (task.createdBy && user.id && task.createdBy === user.id) return true;
    if ((Array.isArray(task.viewerIds) ? task.viewerIds : []).some(function (viewerId) {
      return String(viewerId) === String(user.id);
    })) return true;
    const names = currentUserNames(data);
    return (task.assignees || []).some(function (assignee) {
      const value = typeof assignee === 'object' && assignee
        ? assignee.id || assignee.userId || assignee.name || assignee.displayName
        : assignee;
      if (!value) return false;
      return String(value) === String(user.id) || names.indexOf(String(value).trim().toLocaleLowerCase('pt-BR')) !== -1;
    });
  }

  function isTaskDone(task) {
    return /conclu|complete|done/i.test(String(task.status || ''));
  }

  function isProjectVisible(project, data) {
    if (!project || project.isDemo || project.archived) return false;
    const currentUser = getCurrentProfile(data);
    return project.allUsers || !project.createdBy || project.createdBy === currentUser.id ||
      (project.members || []).some(function (member) {
        const memberId = typeof member === 'object' && member ? member.id || member.userId : member;
        return String(memberId) === String(currentUser.id) ||
          currentUserNames(data).indexOf(String(memberId || '').toLocaleLowerCase('pt-BR')) >= 0;
      });
  }

  function dateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateLabel(value, options) {
    const date = dateValue(value);
    return date ? date.toLocaleDateString('pt-BR', options || { day: '2-digit', month: 'short' }) : 'Sem data';
  }

  function timeLabel(value) {
    const date = dateValue(value);
    return date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  function withinDays(value, days) {
    const date = dateValue(value);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = Math.round((target.getTime() - today.getTime()) / 86400000);
    return offset >= 0 && offset <= days;
  }

  function eventCoversDate(event, date) {
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const startDate = event.allDay && event.allDayStartDate
      ? String(event.allDayStartDate).slice(0, 10)
      : event.startsAt ? String(event.startsAt).slice(0, 10) : '';
    if (!startDate) return false;
    if (event.allDay) {
      const endDate = String(event.allDayEndDate || startDate).slice(0, 10);
      return key >= startDate && key < endDate;
    }
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const start = dateValue(event.startsAt);
    const end = dateValue(event.endsAt);
    if (!start) return false;
    return end ? start < dayEnd && end > dayStart : start >= dayStart && start < dayEnd;
  }

  function isActiveTrainingEmployee(profile) {
    return profile && profile.id && profile.active !== false && String(profile.active).toLowerCase() !== 'false' &&
      normalizeSearchText(profile.status || '') !== 'inativo';
  }

  function trainingEmployees(data) {
    return (data.profiles || []).filter(isActiveTrainingEmployee).slice().sort(function (a, b) {
      return String(a.displayName || a.nickname || a.name || '').localeCompare(
        String(b.displayName || b.nickname || b.name || ''), 'pt-BR'
      );
    });
  }

  function trainingRecords(data, includeArchived) {
    return (data.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === 'hr-training' && (includeArchived || !record.archived) &&
        (!record.data || record.data.recordType !== 'investment');
    });
  }

  function trainingInvestments(data, includeArchived) {
    return (data.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === 'hr-training' && (includeArchived || !record.archived) &&
        record.data && record.data.recordType === 'investment';
    });
  }

  function trainingParticipantId(participant) {
    return String(participant && (participant.employeeId || participant.userId || participant.id) || '');
  }

  function trainingRecordParticipants(record) {
    return Array.isArray(record && record.data && record.data.participants) ? record.data.participants : [];
  }

  function isTrainingCompletionRecord(record) {
    const status = normalizeSearchText(record && record.status || '');
    return !/nao|cancel|anulad/.test(status) && /realizad|conclu|completed/i.test(status);
  }

  function trainingParticipantData(record, participant) {
    return Object.assign({}, record && record.data || {}, participant && participant.overrides || {});
  }

  function parseCalendarDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3]) ? date : null;
  }

  function trainingExpiryDate(record, participant) {
    const data = trainingParticipantData(record, participant);
    const date = parseCalendarDate(data.date);
    const months = Number(data.validityMonths);
    if (!date || !Number.isInteger(months) || months <= 0) return null;
    date.setMonth(date.getMonth() + months);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function trainingWorkingDaysBetween(start, end) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const target = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    cursor.setDate(cursor.getDate() + 1);
    const dayCount = Math.max(0, (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
      Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())) / 86400000 + 1);
    const fullWeeks = Math.floor(dayCount / 7);
    const remainder = dayCount % 7;
    let days = fullWeeks * 5;
    for (let index = 0; index < remainder; index++) {
      const weekday = (cursor.getDay() + index) % 7;
      if (weekday !== 0 && weekday !== 6) days++;
    }
    return days;
  }

  function trainingExpiryAlerts(records) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return records.reduce(function (alerts, record) {
      if (!isTrainingCompletionRecord(record)) return alerts;
      trainingRecordParticipants(record).forEach(function (participant) {
        const expiry = trainingExpiryDate(record, participant);
        if (!expiry) return;
        const day = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
        if (day < today) {
          alerts.push({ record: record, participant: participant, date: day, overdue: true, days: 0 });
          return;
        }
        const days = trainingWorkingDaysBetween(today, day);
        if (days <= 60) alerts.push({ record: record, participant: participant, date: day, overdue: false, days: days });
      });
      return alerts;
    }, []).sort(function (a, b) { return a.date - b.date; });
  }

  function dateIsPast(value) {
    const date = dateValue(value);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()) < today;
  }

  function trainingSummary(data) {
    const employees = trainingEmployees(data);
    const employeeIds = new Set(employees.map(function (employee) { return String(employee.id); }));
    const records = trainingRecords(data).slice().sort(function (a, b) {
      return String(a.data && a.data.date || '').localeCompare(String(b.data && b.data.date || ''));
    });
    const participations = [];
    const trainedIds = new Set();
    const courseCounts = {};
    const sectorCounts = {};
    let classHours = 0;
    let participationHours = 0;
    records.forEach(function (record) {
      const eligible = (isTrainingCompletionRecord(record) ? trainingRecordParticipants(record) : []).filter(function (participant) {
        return employeeIds.has(trainingParticipantId(participant));
      });
      eligible.forEach(function (participant) {
        const id = trainingParticipantId(participant);
        const participantData = trainingParticipantData(record, participant);
        const duration = Number(participantData.durationHours);
        trainedIds.add(id);
        participations.push({ record: record, participant: participant, data: participantData });
        if (eligible[0] === participant && Number.isFinite(duration)) classHours += duration;
        participationHours += Number.isFinite(duration) ? duration : 0;
        const course = String(participantData.title || record.title || '').trim() || 'Sem curso';
        courseCounts[course] = (courseCounts[course] || 0) + 1;
        const employee = employees.find(function (item) { return String(item.id) === id; });
        const sector = String(employee && employee.sector || participant.sector || '').trim() || 'Sem setor';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      });
    });
    const courseRank = Object.keys(courseCounts).map(function (name) { return { name: name, count: courseCounts[name] }; })
      .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'); });
    const sectorRank = Object.keys(sectorCounts).map(function (name) { return { name: name, count: sectorCounts[name] }; })
      .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'); });
    return {
      employees: employees,
      records: records,
      participations: participations,
      trainedCount: trainedIds.size,
      missing: employees.filter(function (employee) { return !trainedIds.has(String(employee.id)); }),
      classHours: classHours,
      participationHours: participationHours,
      coverage: employees.length ? Math.round(trainedIds.size * 1000 / employees.length) / 10 : 0,
      averageHours: employees.length ? Math.round(participationHours * 10 / employees.length) / 10 : 0,
      latest: participations.slice().sort(function (a, b) {
        return String(b.data.date || '').localeCompare(String(a.data.date || ''));
      }).slice(0, 5),
      courseRank: courseRank,
      sectorRank: sectorRank,
      alerts: trainingExpiryAlerts(records)
    };
  }

  function taskListForDashboard(data) {
    return (data.tasks || []).filter(function (task) {
      return task && !task.isDemo && isOwnTask(task, data);
    });
  }

  function projectProgress(project, data) {
    const tasks = (data.tasks || []).filter(function (task) {
      return task && !task.isDemo && String(task.projectId || '') === String(project.id);
    });
    const completed = tasks.filter(isTaskDone).length;
    return {
      tasks: tasks,
      completed: completed,
      progress: tasks.length ? Math.round(completed * 100 / tasks.length) : 0
    };
  }

  function projectStatus(project, data) {
    if (project.archived) return 'Arquivado';
    const progress = projectProgress(project, data);
    if (progress.tasks.length && progress.completed === progress.tasks.length) return 'Concluído';
    if (progress.completed) return 'Em andamento';
    return 'Planejamento';
  }

  function readableStatus(status) {
    const value = String(status || '').toLocaleLowerCase('pt-BR');
    if (/conclu|complete|done/.test(value)) return 'Concluída';
    if (/andamento|progress/.test(value)) return 'Em andamento';
    if (/backlog/.test(value)) return 'Backlog';
    return 'Pendente';
  }

  function documentList(data) {
    const user = getCurrentProfile(data);
    return (data.documents || []).filter(function (item) {
      if (!item) return false;
      const folder = String(item.folder || '').trim().toLocaleLowerCase('pt-BR');
      if (!item.name || item.url === '#') return false;
      if (folder === 'mural' || folder.indexOf('mensagens não salvas') === 0) return false;
      if (item.relatedTaskId || item.relatedProjectId) return false;
      if (item.ownerId && user.id && item.ownerId !== user.id &&
          (item.viewerIds || []).indexOf(user.id) === -1 && folder !== 'equipe' && folder !== 'mensagens') return false;
      return !item.messageId || folder === 'mensagens';
    });
  }

  function businessCardData(card, data) {
    const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === card.type; });
    if (!module || !canAccessBusinessCard(module, data)) {
      return { count: 0, summary: 'Acesso restrito ao setor', items: [], empty: 'Este card é reservado ao setor ' + (module && module.sector || '') + '.' };
    }
    const quantity = Math.max(1, Math.min(20, Number(card.filters.quantity) || 5));
    if (module.id === 'it-support-tickets') {
      const tickets = Array.isArray(data.supportTickets) ? data.supportTickets : [];
      const open = tickets.filter(function (ticket) { return ticket.status === 'Aberto'; }).length;
      const working = tickets.filter(function (ticket) { return ticket.status === 'Em atendimento'; }).length;
      const resolved = tickets.filter(function (ticket) {
        return ticket.status === 'Resolvido' || ticket.status === 'Encerrado';
      }).length;
      return {
        count: tickets.length,
        summary: tickets.length + ' chamado(s)',
        items: tickets.slice(0, quantity).map(function (ticket) {
          return {
            title: ticket.ticket_number || 'Chamado',
            meta: [ticket.requester_name, ticket.category, ticket.status].filter(Boolean).join(' · '),
            ticketId: ticket.id
          };
        }),
        metrics: [
          { value: tickets.length, label: 'Chamados', icon: module.icon },
          { value: open + working, label: 'Em aberto', icon: 'clock' },
          { value: resolved, label: 'Resolvidos', icon: 'check' }
        ],
        chart: [],
        empty: data.supportTicketsLoadError || 'Nenhum chamado foi aberto.'
      };
    }
    if (module.id === 'it-infrastructure') {
      const assets = (Array.isArray(data.infrastructureAssets) ? data.infrastructureAssets : [])
        .filter(function (asset) { return asset && !asset.archived; });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueSoon = assets.filter(function (asset) {
        const date = dateValue(asset.next_maintenance_on);
        const reading = Number(asset.meter_reading);
        const threshold = Number(asset.meter_threshold);
        const days = date ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - today.getTime()) / 86400000) : null;
        return days !== null && days <= 30 || asset.meter_threshold != null && reading >= threshold;
      });
      const operational = assets.filter(function (asset) { return asset.status === 'Operacional'; }).length;
      const underMaintenance = assets.filter(function (asset) { return asset.status === 'Em manutenção'; }).length;
      const orderedAssets = assets.slice().sort(function (first, second) {
        return new Date(first.next_maintenance_on || '2999-12-31') - new Date(second.next_maintenance_on || '2999-12-31');
      });
      return {
        count: assets.length,
        summary: assets.length + ' equipamento(s)',
        items: orderedAssets.slice(0, quantity).map(function (asset) {
          return {
            title: asset.name || asset.asset_tag || 'Equipamento',
            meta: [asset.asset_tag, asset.status, asset.next_maintenance_on ? 'Preventiva: ' + dateLabel(asset.next_maintenance_on) : 'Sem preventiva agendada']
              .filter(Boolean).join(' · '),
            recordId: asset.id
          };
        }),
        metrics: [
          { value: assets.length, label: 'Equipamentos', icon: module.icon },
          { value: dueSoon.length, label: 'Manutenções em alerta', icon: 'alert' },
          { value: operational, label: 'Operacionais', icon: 'check' }
        ],
        chart: [
          { label: 'Operacionais', value: operational },
          { label: 'Em manutenção', value: underMaintenance },
          { label: 'Preventivas em alerta', value: dueSoon.length }
        ],
        empty: data.infrastructureAssetsLoadError || 'Cadastre o primeiro equipamento no painel de Infraestrutura.'
      };
    }
    if (module.id === 'hr-training') {
      const summary = trainingSummary(data);
      return {
        count: summary.records.length,
        summary: summary.records.length + ' turma(s)',
        items: summary.latest.slice(0, quantity).map(function (item) {
          const employee = summary.employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(item.participant);
          });
          return {
            title: item.record.title || 'Capacitação',
            meta: [employee && (employee.displayName || employee.nickname || employee.name) || item.participant.name,
              item.data.date, item.data.durationHours + ' h'].filter(Boolean).join(' · '),
            href: 'meu-espaco.html',
            recordId: item.record.id
          };
        }),
        metrics: [
          { value: summary.employees.length, label: 'Funcionários ativos', icon: 'users' },
          { value: summary.coverage + '%', label: 'Cobertura', icon: 'chart' },
          { value: summary.classHours + ' h', label: 'Carga horária', icon: 'clock' },
          { value: summary.missing.length, label: 'Sem treinamento', icon: 'alert' }
        ],
        chart: [
          { label: 'Com treinamento', value: summary.trainedCount },
          { label: 'Sem treinamento', value: summary.missing.length }
        ],
        empty: 'Registre uma turma e selecione os funcionários participantes.'
      };
    }
    let records = (data.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === module.id && !record.archived;
    });
    if (module.id === 'sales-time-off') {
      const nextSaturday = new Date();
      nextSaturday.setHours(0, 0, 0, 0);
      nextSaturday.setDate(nextSaturday.getDate() + (6 - nextSaturday.getDay() + 7) % 7);
      const saturdayKey = [
        nextSaturday.getFullYear(),
        String(nextSaturday.getMonth() + 1).padStart(2, '0'),
        String(nextSaturday.getDate()).padStart(2, '0')
      ].join('-');
      const saturdayLabel = nextSaturday.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      });
      const schedule = records.filter(function (record) {
        return record.data && record.data.month === saturdayKey.slice(0, 7) &&
          Array.isArray(record.data.assignments);
      }).sort(function (first, second) {
        return new Date(second.updatedAt || second.createdAt || 0) -
          new Date(first.updatedAt || first.createdAt || 0);
      })[0];
      const assignments = schedule ? schedule.data.assignments : [];
      const people = assignments.filter(function (assignment) {
        return assignment && Array.isArray(assignment.dates) &&
          assignment.dates.indexOf(saturdayKey) !== -1;
      }).map(function (assignment) {
        const profile = (data.profiles || []).find(function (item) {
          return item && String(item.id) === String(assignment.userId);
        });
        return {
          userId: String(assignment.userId || ''),
          name: assignment.name || profile &&
            (profile.displayName || profile.nickname || profile.name) || 'Colaborador'
        };
      }).filter(function (person, index, list) {
        return list.findIndex(function (candidate) {
          return person.userId ? candidate.userId === person.userId : candidate.name === person.name;
        }) === index;
      }).sort(function (first, second) {
        return first.name.localeCompare(second.name, 'pt-BR');
      });
      return {
        count: people.length,
        summary: people.length + ' pessoa(s) de folga em ' + saturdayLabel,
        items: people.map(function (person) {
          return {
            title: person.name,
            meta: 'Folga no sábado, ' + saturdayLabel,
            href: 'meu-espaco.html?businessCard=' + encodeURIComponent(module.id)
          };
        }),
        metrics: [],
        chart: [],
        empty: data.businessCardRecordsLoadError || (schedule
          ? 'Ninguém está de folga no próximo sábado (' + saturdayLabel + ').'
          : 'Nenhuma escala confirmada para o próximo sábado (' + saturdayLabel + ').')
      };
    }
    if (card.filters.show === 'pendentes') records = records.filter(function (record) {
      return !/conclu|resolvido|fechado|publicado|ganho|pago|recebido|entregue|ativo/i.test(String(record.status || ''));
    });
    else if (card.filters.show === 'andamento') records = records.filter(function (record) {
      return /andamento|atendimento|producao|transito|negociacao|preparacao|cotacao/i.test(String(record.status || ''));
    });
    else if (card.filters.show === 'concluidos') records = records.filter(function (record) {
      return /conclu|resolvido|fechado|publicado|ganho|pago|recebido|entregue/i.test(String(record.status || ''));
    });
    if (card.filters.sort === 'nome') records.sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'); });
    else records.sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); });
    let items;
    let metrics = [];
    let chart = [];
    if (module.source === 'profiles') {
      const now = new Date();
      items = (data.profiles || []).filter(function (profile) {
        return profile && profile.active !== false && profile.birthday &&
          new Date(profile.birthday + 'T00:00:00').getMonth() === now.getMonth();
      }).map(function (profile) {
        return { title: profile.displayName || profile.nickname || 'Colaborador', meta: dateLabel(profile.birthday, { day: '2-digit', month: 'long' }), href: 'perfil.html' };
      });
    } else if (module.source === 'projects') {
      items = (data.projects || []).filter(function (project) { return isProjectVisible(project, data); }).map(function (project) {
        const progress = projectProgress(project, data);
        return { title: project.name || 'Projeto', meta: projectStatus(project, data) + ' · ' + progress.progress + '% concluído', href: 'projetos.html' };
      });
    } else if (module.source === 'overview') {
      const tasks = (data.tasks || []).filter(function (task) { return task && !task.isDemo; });
      const projects = (data.projects || []).filter(function (project) { return project && !project.isDemo && !project.archived; });
      const completedTasks = tasks.filter(isTaskDone).length;
      items = [
        { title: String(tasks.length), meta: 'Tarefas no workspace', href: 'tarefas.html' },
        { title: String(completedTasks), meta: 'Tarefas concluídas', href: 'tarefas.html' },
        { title: String(projects.length), meta: 'Projetos ativos', href: 'projetos.html' },
        { title: String((data.posts || []).length), meta: 'Publicações no Mural', href: 'mural.html' }
      ];
      metrics = [
        { value: tasks.length, label: 'Tarefas', icon: 'task' },
        { value: projects.length, label: 'Projetos', icon: 'project' },
        { value: tasks.length ? Math.round(completedTasks * 100 / tasks.length) + '%' : '0%', label: 'Concluído', icon: 'check' }
      ];
    } else {
      items = records.slice(0, quantity).map(function (record) {
        const recordData = record.data || {};
        const detailParts = [record.status, recordData.dueDate || recordData.publishAt || recordData.date || recordData.channel || recordData.company];
        if (module.id === 'it-infrastructure' && recordData.incidentNotes) {
          detailParts.push(recordData.incidentNotes);
        }
        const detail = detailParts
          .filter(Boolean).join(' · ');
        return { title: record.title || 'Registro', meta: detail || 'Atualizado ' + dateLabel(record.updatedAt), href: 'meu-espaco.html', recordId: record.id };
      });
      const completed = records.filter(function (record) { return /conclu|resolvido|fechado|publicado|ganho|pago|recebido|entregue/i.test(String(record.status || '')); }).length;
      const pending = Math.max(0, records.length - completed);
      metrics = [
        { value: records.length, label: 'Registros', icon: module.icon },
        { value: pending, label: 'Em aberto', icon: 'clock' },
        { value: completed, label: 'Concluídos', icon: 'check' }
      ];
      if (module.id === 'purchase-quotes') {
        const awaitingApproval = records.filter(function (record) {
          return record.data && record.data.approval && record.data.approval.status === 'pending';
        }).length;
        const approved = records.filter(function (record) {
          return record.data && record.data.approval && record.data.approval.status === 'approved';
        }).length;
        const rejected = records.filter(function (record) {
          return record.data && record.data.approval && record.data.approval.status === 'rejected';
        }).length;
        metrics = [
          { value: records.length, label: 'Solicitações', icon: module.icon },
          { value: awaitingApproval, label: 'Aguardando', icon: 'clock' },
          { value: approved, label: 'Aprovadas', icon: 'check' }
        ];
        chart = [
          { label: 'Aguardando aprovação', value: awaitingApproval },
          { label: 'Aprovadas', value: approved },
          { label: 'Rejeitadas', value: rejected }
        ];
      } else if (module.id === 'it-infrastructure') {
        const statusCounts = {
          operational: records.filter(function (record) { return normalizeSearchText(record.status || '') === 'operacional'; }).length,
          attention: records.filter(function (record) { return normalizeSearchText(record.status || '') === 'atencao'; }).length,
          unavailable: records.filter(function (record) { return normalizeSearchText(record.status || '') === 'indisponivel'; }).length,
          maintenance: records.filter(function (record) { return normalizeSearchText(record.status || '') === 'em manutencao'; }).length
        };
        metrics = [
          { value: statusCounts.operational, label: 'Operacionais', icon: 'check' },
          { value: statusCounts.attention + statusCounts.unavailable, label: 'Com alerta', icon: 'alert' },
          { value: statusCounts.maintenance, label: 'Em manutenção', icon: 'clock' }
        ];
        chart = [
          { label: 'Operacionais', value: statusCounts.operational },
          { label: 'Atenção', value: statusCounts.attention },
          { label: 'Indisponíveis', value: statusCounts.unavailable },
          { label: 'Em manutenção', value: statusCounts.maintenance }
        ];
      }
      if (module.id === 'marketing-insights') {
        const totals = {};
        records.forEach(function (record) {
          const metrics = record.data && Array.isArray(record.data.metrics) ? record.data.metrics : [];
          metrics.forEach(function (metric) {
            totals[metric.label] = (totals[metric.label] || 0) + (Number(metric.value) || 0);
          });
        });
        chart = Object.keys(totals).slice(0, 4).map(function (label) {
          return { label: label, value: totals[label] };
        });
      } else if (module.id === 'sales-pipeline') {
        const amountByStage = {};
        records.forEach(function (record) {
          const stage = String(record.status || 'Prospecção');
          amountByStage[stage] = (amountByStage[stage] || 0) + (Number(record.data && record.data.amount) || 0);
        });
        chart = Object.keys(amountByStage).slice(0, 4).map(function (stage) { return { label: stage, value: amountByStage[stage] }; });
        metrics[0] = { value: 'R$ ' + records.reduce(function (sum, record) { return sum + (Number(record.data && record.data.amount) || 0); }, 0).toLocaleString('pt-BR'), label: 'Pipeline estimado', icon: 'funnel' };
      } else if (module.id === 'finance-payables-receivables') {
        const openAmount = records.filter(function (record) { return !/pago|recebido|cancelado/i.test(String(record.status || '')); })
          .reduce(function (sum, record) { return sum + (Number(record.data && record.data.amount) || 0); }, 0);
        metrics[0] = { value: 'R$ ' + openAmount.toLocaleString('pt-BR'), label: 'Em aberto', icon: 'doc' };
        const overdue = records.filter(function (record) {
          const due = dateValue(record.data && record.data.dueDate);
          return due && due < today && !/pago|recebido|cancelado/i.test(String(record.status || ''));
        }).length;
        metrics[1] = { value: overdue, label: 'Vencidas', icon: 'alert' };
      } else if (module.id === 'finance-cashflow') {
        const inflow = records.filter(function (record) { return /entrada/i.test(String(record.data && record.data.kind || '')); })
          .reduce(function (sum, record) { return sum + (Number(record.data && record.data.amount) || 0); }, 0);
        const outflow = records.filter(function (record) { return /saida/i.test(String(record.data && record.data.kind || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')); })
          .reduce(function (sum, record) { return sum + (Number(record.data && record.data.amount) || 0); }, 0);
        metrics = [
          { value: 'R$ ' + inflow.toLocaleString('pt-BR'), label: 'Entradas', icon: 'check' },
          { value: 'R$ ' + outflow.toLocaleString('pt-BR'), label: 'Saídas', icon: 'alert' },
          { value: 'R$ ' + (inflow - outflow).toLocaleString('pt-BR'), label: 'Saldo', icon: 'chart' }
        ];
        chart = [{ label: 'Entradas', value: inflow }, { label: 'Saídas', value: outflow }];
      } else if (module.id === 'logistics-inventory') {
        const lowStock = records.filter(function (record) {
          const amount = Number(record.data && record.data.quantity);
          const minimum = Number(record.data && record.data.minimum);
          return Number.isFinite(amount) && Number.isFinite(minimum) && amount <= minimum;
        }).length;
        metrics[1] = { value: lowStock, label: 'Abaixo do mínimo', icon: 'alert' };
        chart = records.slice(0, 4).map(function (record) {
          return { label: record.title, value: Number(record.data && record.data.quantity) || 0 };
        });
      }
    }
    return {
      count: module.source === 'profiles' || module.source === 'projects' ? items.length : module.source === 'overview' ? items.length : records.length,
      summary: module.source === 'profiles' ? items.length + ' aniversário(s) neste mês' :
        module.source === 'projects' ? items.length + ' projeto(s) estratégico(s)' :
          module.source === 'overview' ? 'Indicadores consolidados' : records.length + ' registro(s)',
      items: items.slice(0, quantity),
      metrics: metrics,
      chart: chart,
      empty: module.source === 'profiles' ? 'Nenhum aniversário cadastrado neste mês.' :
        module.source === 'projects' ? 'Nenhum projeto estratégico visível.' : 'Adicione o primeiro registro a este card.'
    };
  }

  function cardData(card, data) {
    if (CARD_CATALOG[card.type] && CARD_CATALOG[card.type].moduleType) return businessCardData(card, data);
    const quantity = Math.max(1, Math.min(20, Number(card.filters.quantity) || 5));
    const show = card.filters.show || '';
    const currentUser = getCurrentProfile(data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (card.type === 'tarefas') {
      let items = taskListForDashboard(data);
      if (show === 'pendentes') items = items.filter(function (task) { return !isTaskDone(task) && readableStatus(task.status) !== 'Em andamento'; });
      else if (show === 'andamento') items = items.filter(function (task) { return readableStatus(task.status) === 'Em andamento'; });
      else if (show === 'concluidas') items = items.filter(isTaskDone);
      else if (show === 'atrasadas') items = items.filter(function (task) {
        const due = dateValue(task.dueDate);
        return due && due < today && !isTaskDone(task);
      });
      if (card.filters.sort === 'recente') items.sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); });
      else if (card.filters.sort === 'prioridade') {
        const order = { alta: 0, high: 0, media: 1, medium: 1, baixa: 2, low: 2 };
        items.sort(function (a, b) {
          const aPriority = order[String(a.priority).toLowerCase()];
          const bPriority = order[String(b.priority).toLowerCase()];
          return (aPriority == null ? 1 : aPriority) - (bPriority == null ? 1 : bPriority);
        });
      } else items.sort(function (a, b) { return new Date(a.dueDate || '2999-12-31') - new Date(b.dueDate || '2999-12-31'); });
      const total = items.length;
      return {
        count: total,
        summary: total ? total + ' ' + (show === 'atrasadas' ? 'atrasada(s)' : 'tarefa(s)') : 'Nenhuma tarefa nesta lista',
        items: items.slice(0, quantity).map(function (task) {
          return { title: task.title || 'Tarefa sem título', meta: readableStatus(task.status) + ' · Prazo: ' + dateLabel(task.dueDate), href: 'tarefas.html' };
        }),
        empty: 'Nenhuma tarefa encontrada.'
      };
    }

    if (card.type === 'projetos') {
      let projects = (data.projects || []).filter(function (project) { return isProjectVisible(project, data); });
      if (show === 'em-andamento') projects = projects.filter(function (project) { return projectStatus(project, data) === 'Em andamento'; });
      else if (show === 'planejamento') projects = projects.filter(function (project) { return projectStatus(project, data) === 'Planejamento'; });
      else if (show === 'concluidos') projects = projects.filter(function (project) { return projectStatus(project, data) === 'Concluído'; });
      if (card.filters.sort === 'progresso') projects.sort(function (a, b) { return projectProgress(b, data).progress - projectProgress(a, data).progress; });
      else if (card.filters.sort === 'prazo') projects.sort(function (a, b) { return new Date(a.endDate || '2999-12-31') - new Date(b.endDate || '2999-12-31'); });
      else projects.sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); });
      return {
        count: projects.length,
        summary: projects.length + ' projeto(s)',
        items: projects.slice(0, quantity).map(function (project) {
          const progress = projectProgress(project, data);
          return { title: project.name || 'Projeto', meta: projectStatus(project, data) + ' · ' + progress.progress + '% concluído', href: 'projetos.html' };
        }),
        empty: 'Nenhum projeto disponível.'
      };
    }

    if (card.type === 'calendario') {
      let events = (data.events || []).filter(function (event) {
        const start = dateValue(event.startsAt);
        if (!start || event.deletedAt) return false;
        if (event.visibility === 'private' && event.ownerId !== currentUser.id) return false;
        return start >= today || eventCoversDate(event, today);
      }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
      if (show === 'hoje') events = events.filter(function (event) {
        return eventCoversDate(event, today);
      });
      else if (show === 'proximos') events = events.filter(function (event) { return withinDays(event.startsAt, 7); });
      return {
        count: events.length,
        summary: events.length + ' evento(s) futuro(s)',
        items: events.slice(0, quantity).map(function (event) {
          return { title: event.title || 'Evento', meta: dateLabel(event.startsAt, { weekday: 'short', day: '2-digit', month: 'short' }) + (event.allDay ? ' · Dia todo' : ' · ' + timeLabel(event.startsAt)), href: 'calendario.html' };
        }),
        empty: 'Nenhum evento futuro.'
      };
    }

    if (card.type === 'documentos') {
      let documents = documentList(data);
      if (card.filters.sort === 'nome') documents.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); });
      else documents.sort(function (a, b) { return new Date(b.sentAt || 0) - new Date(a.sentAt || 0); });
      return {
        count: documents.length,
        summary: documents.length + ' documento(s) acessível(is)',
        items: documents.slice(0, quantity).map(function (item) {
          return { title: item.name, meta: (item.folder || 'Equipe') + ' · ' + dateLabel(item.sentAt), href: 'documentos.html' };
        }),
        empty: 'Nenhum documento acessível.'
      };
    }

    if (card.type === 'comunicacao') {
      const messages = (data.messages || []).filter(function (message) {
        return message && !message.localOnly && message.senderId === currentUser.id && String(message.text || '').trim();
      }).sort(function (a, b) { return new Date(b.sentAt || 0) - new Date(a.sentAt || 0); });
      return {
        count: messages.length,
        summary: messages.length + ' mensagem(ns)',
        items: messages.slice(0, quantity).map(function (message) {
          const conversation = (data.conversations || []).find(function (item) { return item.id === message.conversationId; });
          const sender = (data.profiles || []).find(function (profile) {
            return String(profile.id) === String(message.senderId);
          });
          return { title: sender && (sender.displayName || sender.nickname) || message.senderName || 'Colaborador', meta: (conversation && conversation.name ? conversation.name + ' · ' : '') + String(message.text).slice(0, 100) + ' · ' + dateLabel(message.sentAt), href: 'mensagens.html' };
        }),
        empty: 'Nenhuma mensagem recente.'
      };
    }

    if (card.type === 'indicadores') {
      const tasks = taskListForDashboard(data);
      const completed = tasks.filter(isTaskDone).length;
      const overdue = tasks.filter(function (task) {
        const due = dateValue(task.dueDate);
        return due && due < today && !isTaskDone(task);
      }).length;
      const upcoming = tasks.filter(function (task) { return !isTaskDone(task) && withinDays(task.dueDate, 7); }).length;
      const projects = (data.projects || []).filter(function (project) {
        return isProjectVisible(project, data);
      });
      const percent = tasks.length ? Math.round(completed * 100 / tasks.length) : 0;
      const inProgress = tasks.filter(function (task) { return readableStatus(task.status) === 'Em andamento'; }).length;
      const pending = Math.max(0, tasks.length - completed - inProgress);
      return {
        count: tasks.length,
        summary: 'Resumo pessoal',
        indicators: {
          completed: completed,
          total: tasks.length,
          percent: percent,
          overdue: overdue,
          upcoming: upcoming,
          projects: projects.length,
          inProgress: inProgress,
          pending: pending
        },
        items: [],
        empty: 'Ainda não há tarefas para calcular indicadores.'
      };
    }

    if (card.type === 'atividade') {
      const events = [];
      (data.tasks || []).forEach(function (task) {
        if (task && !task.isDemo && (task.createdBy === currentUser.id || isOwnTask(task, data))) {
          events.push({ date: task.updatedAt || task.createdAt, title: task.title || 'Tarefa', meta: 'Tarefa · ' + readableStatus(task.status), href: 'tarefas.html' });
        }
      });
      (data.projects || []).forEach(function (project) {
        if (!isProjectVisible(project, data)) return;
        (project.activityLog || []).forEach(function (entry) {
          events.push({ date: entry.createdAt, title: entry.description || 'Projeto atualizado', meta: 'Projeto · ' + project.name, href: 'projetos.html' });
        });
      });
      (data.documents || []).forEach(function (item) {
        if (item && item.ownerId === currentUser.id && documentList(data).some(function (visible) { return visible.id === item.id; })) {
          events.push({ date: item.sentAt, title: item.name, meta: 'Documento enviado', href: 'documentos.html' });
        }
      });
      events.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
      return {
        count: events.length,
        summary: events.length + ' atualização(ões)',
        items: events.slice(0, quantity).map(function (event) {
          return { title: event.title, meta: event.meta + ' · ' + dateLabel(event.date), href: event.href };
        }),
        empty: 'Nenhuma atividade recente.'
      };
    }

    if (card.type === 'comemoracoes') {
      const selectedCategory = card.filters.show || 'todas';
      const calendarItems = (data.events || []).filter(function (event) {
        return event && !event.deletedAt &&
          ['feriado', 'aniversario', 'acao_comercial'].indexOf(event.category) !== -1 &&
          (event.visibility !== 'private' || String(event.ownerId || event.createdBy || '') === String(currentUser.id || '')) &&
          (selectedCategory === 'todas' || event.category === selectedCategory);
      }).map(function (event) {
        const eventDate = dateValue(event.allDayStartDate || event.startsAt);
        if (!eventDate || eventDate < today) return null;
        return {
          name: event.title || 'Data comemorativa',
          date: eventDate,
          category: event.category
        };
      }).filter(Boolean);
      const birthdays = selectedCategory !== 'feriado' && selectedCategory !== 'acao_comercial'
        ? (data.profiles || []).filter(function (profile) {
        return profile && profile.active !== false && profile.birthday;
      }).map(function (profile) {
        const birthDate = dateValue(profile.birthday);
        if (!birthDate) return null;
        const next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        const name = profile.displayName || profile.nickname || 'Colaborador';
        const alreadySynced = calendarItems.some(function (item) {
          return item.category === 'aniversario' && item.date.getMonth() === next.getMonth() &&
            item.date.getDate() === next.getDate() && item.name.toLocaleLowerCase('pt-BR').indexOf(name.toLocaleLowerCase('pt-BR')) !== -1;
        });
        return alreadySynced ? null : { name: 'Aniversário · ' + name, date: next, category: 'aniversario' };
      }).filter(Boolean) : [];
      const dates = calendarItems.concat(birthdays).sort(function (a, b) { return a.date - b.date; });
      return {
        count: dates.length,
        summary: dates.length + ' data(s) no calendário',
        items: dates.slice(0, quantity).map(function (item) {
          const categoryLabel = item.category === 'feriado' ? 'Feriado/data comemorativa'
            : item.category === 'acao_comercial' ? 'Ação comercial' : 'Aniversário';
          return { title: item.name, meta: categoryLabel + ' · ' + dateLabel(item.date, { weekday: 'short', day: '2-digit', month: 'long' }), href: 'calendario.html' };
        }),
        empty: 'Não há feriados, aniversários ou ações comerciais próximos no Calendário.'
      };
    }

    return { count: 0, summary: '', items: [], empty: 'Conteúdo indisponível.' };
  }

  function renderQuickActions(quantity) {
    const actions = [
      '<button type="button" class="dashboard-quick-action" data-dashboard-action="new-task"><span>' + iconMarkup('task') + '</span><b>Nova tarefa</b></button>',
      '<a href="projetos.html" class="dashboard-quick-action"><span>' + iconMarkup('project') + '</span><b>Projetos</b></a>',
      '<a href="calendario.html" class="dashboard-quick-action"><span>' + iconMarkup('calendar') + '</span><b>Calendário</b></a>',
      '<a href="documentos.html" class="dashboard-quick-action"><span>' + iconMarkup('doc') + '</span><b>Documentos</b></a>',
      '<a href="mensagens.html" class="dashboard-quick-action"><span>' + iconMarkup('chat') + '</span><b>Mensagens</b></a>',
      '<a href="mural.html" class="dashboard-quick-action"><span>' + iconMarkup('quick') + '</span><b>Publicar no Mural</b></a>'
    ];
    return '<div class="dashboard-quick-actions">' +
      actions.slice(0, quantity).join('') + '</div>';
  }

  function getStoredDashboard() {
    try {
      const raw = localStorage.getItem(activeStorageKey) || localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(LEGACY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Não foi possível carregar as preferências do dashboard:', error);
      return null;
    }
  }

  function persistDashboard(data) {
    try {
      localStorage.setItem(activeStorageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Não foi possível salvar as preferências do dashboard:', error);
      if (typeof window.showToast === 'function') window.showToast('Não foi possível salvar a personalização neste navegador.');
      throw error;
    }
  }

  function normalizeDashboard(data) {
    const source = data && typeof data === 'object' ? data : {};
    const next = Object.assign(clone(DEFAULT_DASHBOARD), source);
    const sourceCards = Array.isArray(source.cards) ? source.cards : DEFAULT_DASHBOARD.cards;
    next.columns = Math.max(1, Math.min(3, Number(next.columns) || 2));
    next.density = ['compact', 'comfortable', 'spacious'].indexOf(next.density) >= 0 ? next.density : 'comfortable';
    next.cards = sourceCards.filter(function (card) {
      return card && CARD_CATALOG[card.type];
    }).map(function (card, index) {
      const catalog = CARD_CATALOG[card.type];
      const safeCard = Object.assign({
        id: 'card-' + card.type + '-' + (index + 1),
        enabled: true,
        position: index,
        filters: clone(catalog.defaults),
        title: catalog.label
      }, card);
      safeCard.filters = Object.assign(clone(catalog.defaults), safeCard.filters || {});
      safeCard.filters.quantity = Math.max(1, Math.min(20, Number(safeCard.filters.quantity) || 5));
      const legacySizes = { compact: 'ratio-square', standard: 'ratio-square', wide: 'ratio-landscape', large: 'ratio-landscape', 'ratio-double': 'ratio-double-landscape' };
      safeCard.size = ['ratio-square', 'ratio-portrait', 'ratio-landscape', 'ratio-double-landscape'].indexOf(safeCard.size) >= 0
        ? safeCard.size
        : legacySizes[safeCard.size] || (card.type === 'indicadores' ? 'ratio-landscape' : 'ratio-square');
      if (!catalog.filters[safeCard.filters.show]) safeCard.filters.show = catalog.defaults.show;
      if (!catalog.sorts[safeCard.filters.sort]) safeCard.filters.sort = catalog.defaults.sort;
      safeCard.title = String(safeCard.title || catalog.label).slice(0, 60);
      safeCard.position = Number.isFinite(Number(card.position)) ? Number(card.position) : index;
      return safeCard;
    }).sort(function (a, b) { return a.position - b.position; }).map(function (card, index) {
      card.position = index;
      return card;
    });
    return next;
  }

  function renderBusinessMetrics(items) {
    if (!items || !items.metrics || !items.metrics.length) return '';
    const metricsMarkup = items.metrics.map(function (metric) {
      return '<div class="dashboard-module-metric">' +
        '<span>' + iconMarkup(metric.icon) + '</span><b>' + escapeHtml(metric.value) + '</b><small>' + escapeHtml(metric.label) + '</small></div>';
    }).join('');
    let chartMarkup = '';
    if (items.chart && items.chart.length) {
      const max = Math.max.apply(Math, items.chart.map(function (item) { return Number(item.value) || 0; }).concat([1]));
      chartMarkup = '<div class="dashboard-module-chart">' + items.chart.map(function (item) {
        const value = Number(item.value) || 0;
        return '<div class="dashboard-module-chart-row"><span title="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) +
          '</span><div><i style="width:' + Math.max(0, Math.min(100, value / max * 100)) + '%"></i></div><b>' +
          escapeHtml(value.toLocaleString('pt-BR')) + '</b></div>';
      }).join('') + '</div>';
    }
    return '<div class="dashboard-module-visual"><div class="dashboard-module-metrics">' + metricsMarkup + '</div>' + chartMarkup + '</div>';
  }

  function buildCardMarkup(card, data, options) {
    const staticHomeCard = Boolean(options && options.staticHomeCard);
    const catalog = CARD_CATALOG[card.type];
    const module = catalog.moduleType
      ? BUSINESS_CARD_MODULES.find(function (item) { return item.id === card.type; })
      : null;
    const layoutQuantity = card.type === 'sales-time-off' ? 20 :
      card.size === 'ratio-double-landscape' ? 6 :
        card.size === 'ratio-landscape' ? 2 : 3;
    const layoutCard = Object.assign({}, card, {
      filters: Object.assign({}, card.filters, {
        quantity: Math.min(card.filters.quantity, layoutQuantity)
      })
    });
    const items = card.type === 'atalhos' ? [] : cardData(layoutCard, data);
    const listMarkup = card.type === 'indicadores'
      ? renderIndicatorCard(items.indicators, card.size)
      : card.type === 'atalhos'
      ? renderQuickActions(layoutCard.filters.quantity)
      : items.items.length
        ? '<div class="dashboard-data-list">' + items.items.map(function (item) {
          const recordAction = module && item.recordId
            ? ' data-business-module-open="' + escapeHtml(module.id) + '" data-business-record="' + escapeHtml(item.recordId) + '"'
            : '';
          const ticketAction = module && module.id === 'it-support-tickets' && item.ticketId
            ? ' data-support-ticket-open="' + escapeHtml(item.ticketId) + '"'
            : '';
          return '<a class="dashboard-data-row" draggable="false"' + recordAction + ticketAction +
            (ticketAction ? ' href="#"' : ' href="' + escapeHtml(item.href || catalog.href || '#') + '"') + '>' +
            '<span class="dashboard-data-icon" data-kind="' + escapeHtml(catalog.icon) + '">' + iconMarkup(catalog.icon) + '</span><span><b>' +
            escapeHtml(item.title) + '</b><small>' + escapeHtml(item.meta || '') + '</small></span><i aria-hidden="true">›</i></a>';
        }).join('') + '</div>'
        : '<div class="dashboard-data-empty"><span>' + iconMarkup(catalog.icon) + '</span><b>Sem itens para mostrar</b><small>' +
          escapeHtml(items.empty) + '</small></div>';
    const moduleCanOpen = module && canAccessBusinessCard(module, data);
    const pageTargets = {
      atividade: 'meu-espaco.html',
      atalhos: 'meu-espaco.html',
      comemoracoes: 'pessoas.html'
    };
    const pageHref = catalog.href || pageTargets[card.type] || 'meu-espaco.html';
    const cardSizes = ['ratio-square', 'ratio-portrait', 'ratio-landscape', 'ratio-double-landscape'];
    const sizeLabels = {
      'ratio-square': '1:1',
      'ratio-portrait': '4:5',
      'ratio-landscape': '1.91:1',
      'ratio-double-landscape': '1.91:1 (2x)'
    };
    const nextSize = cardSizes[(cardSizes.indexOf(card.size) + 1) % cardSizes.length];
    const nextSizeLabel = sizeLabels[nextSize];
    const bodyAction = module
      ? staticHomeCard
        ? '<a class="dashboard-card-body-action" href="meu-espaco.html?businessCard=' + encodeURIComponent(module.id) + '">Abrir painel</a>'
        : '<button type="button" class="dashboard-card-body-action" data-business-module-open="' + escapeHtml(module.id) + '"' +
          (!moduleCanOpen ? ' disabled title="Acesso restrito ao setor"' : '') + '>Abrir painel</button>'
      : '<a class="dashboard-card-body-action" draggable="false" href="' + escapeHtml(pageHref) + '">Abrir página</a>';
    return [
      '<article class="dashboard-card dashboard-card--' + escapeHtml(card.type) + '" data-tone="' + escapeHtml(staticHomeCard ? module && module.tone || 'general' : card.tone || module && module.tone || 'general') + '" data-size="' + escapeHtml(card.size) + '" data-card-id="' + escapeHtml(card.id) + '" draggable="' + (staticHomeCard ? 'false' : 'true') + '">',
      '  <div class="dashboard-card-header">',
      '    <div class="dashboard-card-title-wrap">',
      '      <span class="dashboard-card-icon" data-kind="' + escapeHtml(catalog.icon) + '" data-tone="' + escapeHtml(module && module.tone || '') + '">' + iconMarkup(catalog.icon) + '</span>',
      '      <div>',
      '        <h4>' + escapeHtml(card.title || catalog.label) + '</h4>',
      '      </div>',
      '    </div>',
      '    <div class="dashboard-card-tools">' +
      (staticHomeCard ? '' :
      '      <button type="button" class="dashboard-card-tool-button" data-card-resize="' + escapeHtml(card.id) + '" data-next-size="' + escapeHtml(nextSize) +
      '" aria-label="Redimensionar ' + escapeHtml(card.title) + ' para a proporção ' + nextSizeLabel + '" title="Proporção seguinte: ' + nextSizeLabel + '">' + iconMarkup('resize') + '</button>' +
      '      <button type="button" class="dashboard-card-tool-button dashboard-card-remove-button" data-card-remove="' + escapeHtml(card.id) + '" aria-label="Remover ' + escapeHtml(card.title) + ' do Meu Espaço" title="Remover card">' + iconMarkup('trash') + '</button>'),
      '    </div>',
      '  </div>',
      '  <div class="dashboard-card-body" data-density="' + escapeHtml(data.dashboardDensity || 'comfortable') + '">' +
      (items.indicators ? '' : module ? renderBusinessMetrics(items) : '') + listMarkup + bodyAction + '</div>',
      '</article>'
    ].join('');
  }

  function renderIndicatorCard(indicators, size) {
    const data = indicators || { completed: 0, total: 0, percent: 0, overdue: 0, upcoming: 0, projects: 0, inProgress: 0, pending: 0 };
    const total = Math.max(1, data.total);
    const barWidth = function (value) { return Math.max(0, Math.min(100, Math.round(value * 100 / total))); };
    const overview =
      '<div class="dashboard-kpi-overview">' +
      '<div class="dashboard-kpi-ring" style="--kpi-progress:' + data.percent + '%"><div><b>' + data.percent + '%</b><small>concluído</small></div></div>' +
      '<div class="dashboard-kpi-overview-copy"><b>' + data.completed + ' de ' + data.total + ' tarefas concluídas</b><small>Seu progresso geral em tarefas atribuídas ou criadas por você.</small>' +
      '<div class="dashboard-kpi-track" role="img" aria-label="' + data.percent + '% das tarefas concluídas"><span style="width:' + data.percent + '%"></span></div></div></div>';
    const stats = size === 'ratio-landscape' ? '' : '<div class="dashboard-kpi-stats">' +
      '<a href="tarefas.html" class="dashboard-kpi-stat kpi-warning"><span>' + iconMarkup('alert') + '</span><b>' + data.overdue + '</b><small>Atrasadas</small></a>' +
      '<a href="tarefas.html" class="dashboard-kpi-stat kpi-upcoming"><span>' + iconMarkup('clock') + '</span><b>' + data.upcoming + '</b><small>Próximos 7 dias</small></a>' +
      '<a href="projetos.html" class="dashboard-kpi-stat kpi-projects"><span>' + iconMarkup('project') + '</span><b>' + data.projects + '</b><small>Projetos ativos</small></a>' +
      '</div>';
    const breakdown = size === 'ratio-double-landscape' ? '<div class="dashboard-kpi-breakdown"><div class="dashboard-kpi-breakdown-head"><b>Status das tarefas</b><span>' + data.total + ' no total</span></div>' +
      '<div class="dashboard-kpi-bar-row"><span>Concluídas</span><div><i class="kpi-bar-complete" style="width:' + barWidth(data.completed) + '%"></i></div><b>' + data.completed + '</b></div>' +
      '<div class="dashboard-kpi-bar-row"><span>Em andamento</span><div><i class="kpi-bar-progress" style="width:' + barWidth(data.inProgress) + '%"></i></div><b>' + data.inProgress + '</b></div>' +
      '<div class="dashboard-kpi-bar-row"><span>Pendentes</span><div><i class="kpi-bar-pending" style="width:' + barWidth(data.pending) + '%"></i></div><b>' + data.pending + '</b></div>' +
      '</div>' : '';
    return '<div class="dashboard-kpi">' + overview + stats + breakdown + '</div>';
  }

  function renderDashboard(rootEl, dashboardConfig, suppliedState) {
    if (!rootEl) return;
    const config = normalizeDashboard(dashboardConfig);
    const data = suppliedState || appState();
    rootEl.dataset.columns = 'auto';
    rootEl.dataset.density = config.density;
    const enabledCards = config.cards.filter(function (card) { return card.enabled !== false; });
    rootEl.innerHTML = enabledCards.length
      ? enabledCards.map(function (card) { return buildCardMarkup(card, Object.assign({}, data, { dashboardDensity: config.density })); }).join('')
      : '<div class="dashboard-empty-state">Nenhum painel está visível. Use “Painéis” para adicionar ou ativar cards.</div>';
    layoutDashboardCards(rootEl);
  }

  function layoutDashboardCards(rootEl) {
    if (!rootEl) return;
    const cards = Array.prototype.slice.call(rootEl.querySelectorAll('.dashboard-card'));
    rootEl.style.position = 'relative';
    if (!cards.length) {
      rootEl.style.height = '';
      return;
    }
    const gap = 16;
    const minimumColumnWidth = 290;
    const containerWidth = rootEl.clientWidth;
    if (!containerWidth) return;
    const columns = Math.max(1, Math.floor((containerWidth + gap) / (minimumColumnWidth + gap)));
    const columnWidth = (containerWidth - gap * (columns - 1)) / columns;
    const columnEnds = Array(columns).fill(0);
    cards.forEach(function (card) {
      const wide = card.dataset.size === 'ratio-double-landscape' && columns > 1;
      const span = wide ? 2 : 1;
      let startColumn = 0;
      let top = Infinity;
      for (let column = 0; column <= columns - span; column += 1) {
        const candidateTop = Math.max.apply(Math, columnEnds.slice(column, column + span));
        if (candidateTop < top) {
          top = candidateTop;
          startColumn = column;
        }
      }
      const width = columnWidth * span + gap * (span - 1);
      const ratios = {
        'ratio-square': 1,
        'ratio-portrait': 4 / 5,
        'ratio-landscape': 1.91,
        'ratio-double-landscape': 1.91
      };
      const height = width / (ratios[card.dataset.size] || 1);
      card.style.position = 'absolute';
      card.style.left = (startColumn * (columnWidth + gap)) + 'px';
      card.style.top = top + 'px';
      card.style.width = width + 'px';
      card.style.height = height + 'px';
      const nextBottom = top + height + gap;
      for (let column = startColumn; column < startColumn + span; column += 1) {
        columnEnds[column] = nextBottom;
      }
    });
    rootEl.style.height = Math.max(0, Math.max.apply(Math, columnEnds) - gap) + 'px';
  }

  function getStoredHomeCards() {
    try {
      const raw = localStorage.getItem(activeHomeCardsStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('A lista de painéis da página Início não é válida.');
      return parsed.filter(function (type, index) {
        return typeof type === 'string' && CARD_CATALOG[type] && parsed.indexOf(type) === index;
      }).slice(0, HOME_CARDS_LIMIT);
    } catch (error) {
      console.error('Não foi possível carregar os painéis da página Início:', error);
      return [];
    }
  }

  function persistHomeCards(cards) {
    try {
      localStorage.setItem(activeHomeCardsStorageKey, JSON.stringify(cards.slice(0, HOME_CARDS_LIMIT)));
    } catch (error) {
      console.error('Não foi possível salvar os painéis da página Início:', error);
      if (typeof window.showToast === 'function') window.showToast('Não foi possível salvar os painéis da página Início.');
      throw error;
    }
  }

  function renderHomeDashboard(rootEl, cardTypes, data) {
    if (!rootEl) return;
    const cards = (cardTypes || []).map(function (type, index) {
      const catalog = CARD_CATALOG[type];
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === type; });
      if (!catalog || module && !canAccessBusinessCard(module, data)) return null;
      return {
        id: 'home-' + type,
        type: type,
        title: catalog.label,
        size: 'ratio-square',
        position: index,
        enabled: true,
        filters: Object.assign(clone(catalog.defaults), { quantity: Math.min(3, catalog.defaults.quantity || 3) })
      };
    }).filter(Boolean);
    rootEl.dataset.cardCount = String(cards.length);
    rootEl.innerHTML = cards.length
      ? cards.map(function (card) {
        return buildCardMarkup(card, Object.assign({}, data, { dashboardDensity: 'comfortable' }), { staticHomeCard: true });
      }).join('')
      : '';
  }

  function hydrateDashboardControls(rootEl, dashboardConfig) {
    if (!rootEl) return;

    const availableCards = Object.keys(CARD_CATALOG).map(function (type) {
      return '<option value="' + type + '">' + escapeHtml(CARD_CATALOG[type].label) + '</option>';
    }).join('');

    rootEl.innerHTML = [
      '<div class="dashboard-config-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-config-title">',
      '  <div class="dashboard-config-header">',
      '    <div>',
      '<h3 id="dashboard-config-title">Ajustar painéis</h3>',
      '      <p>Os painéis se organizam automaticamente conforme a tela. Arraste pelo cabeçalho para alterar a ordem e use os controles para redimensionar ou remover.</p>',
      '    </div>',
      '    <div class="dashboard-config-actions">',
      '      <button type="button" class="btn secondary" id="dashboard-reset-btn">Restaurar padrão</button>',
      '      <button type="button" class="btn secondary" id="dashboard-cancel-btn">Cancelar</button>',
      '      <button type="button" class="btn" id="dashboard-save-btn">Salvar</button>',
      '    </div>',
      '  </div>',
      '  <div class="dashboard-config-grid">',
      '    <p class="dashboard-layout-note">Grade responsiva: a quantidade de colunas acompanha a largura disponível.</p>',
      '    <label class="dashboard-field">',
      '      <span>Densidade</span>',
      '      <select id="dashboard-density">',
      '        <option value="compact" ' + (dashboardConfig.density === 'compact' ? 'selected' : '') + '>Compacta</option>',
      '        <option value="comfortable" ' + (dashboardConfig.density === 'comfortable' ? 'selected' : '') + '>Confortável</option>',
      '        <option value="spacious" ' + (dashboardConfig.density === 'spacious' ? 'selected' : '') + '>Espaçosa</option>',
      '      </select>',
      '    </label>',
      '  </div>',
      '  <div class="dashboard-config-list">',
      '    <div class="dashboard-config-list-heading"><div><h4>Seus painéis</h4><p>Use as setas para alterar a ordem nesta lista.</p></div>' +
      '    <div class="dashboard-add-card"><select id="dashboard-add-card" aria-label="Adicionar card">' + availableCards + '</select>' +
      '    <button type="button" class="btn secondary" id="dashboard-add-card-btn">Adicionar card</button></div></div>',
      '    <div class="dashboard-config-cards">',
      dashboardConfig.cards.map(function (card, index) {
        return configRowMarkup(card, index, dashboardConfig.cards.length);
      }).join(''),
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function readDashboardControls() {
    const current = normalizeDashboard(draft || getStoredDashboard() || DEFAULT_DASHBOARD);
    current.columns = 2;
    current.density = document.getElementById('dashboard-density').value;
    current.cards = Array.prototype.slice.call(document.querySelectorAll('.dashboard-config-card')).map(function (row, index) {
      const old = current.cards.find(function (card) { return card.id === row.dataset.configCard; });
      if (!old) return null;
      old.title = row.querySelector('[data-card-title]').value.trim() || CARD_CATALOG[old.type].label;
      old.enabled = row.querySelector('[data-card-enabled]').checked;
      old.filters.show = row.querySelector('[data-card-show]').value;
      old.filters.sort = row.querySelector('[data-card-sort]').value;
      old.filters.quantity = Number(row.querySelector('[data-card-quantity]').value);
      old.size = row.querySelector('[data-card-size]').value;
      old.position = index;
      return old;
    }).filter(Boolean);
    return normalizeDashboard(current);
  }

  function configRowMarkup(card, index, total) {
    const catalog = CARD_CATALOG[card.type];
    const showOptions = Object.keys(catalog.filters).map(function (key) {
      return '<option value="' + escapeHtml(key) + '" ' + (card.filters.show === key ? 'selected' : '') + '>' + escapeHtml(catalog.filters[key]) + '</option>';
    }).join('');
    const sortOptions = Object.keys(catalog.sorts).map(function (key) {
      return '<option value="' + escapeHtml(key) + '" ' + (card.filters.sort === key ? 'selected' : '') + '>' + escapeHtml(catalog.sorts[key]) + '</option>';
    }).join('');
    return '<article class="dashboard-config-card" data-config-card="' + escapeHtml(card.id) + '">' +
      '<div class="dashboard-config-card-order"><span class="dashboard-config-card-grip" aria-hidden="true">⠿</span><div><b>' + escapeHtml(card.title || catalog.label) +
      '</b><small>' + escapeHtml(catalog.label) + '</small></div></div><div class="dashboard-config-card-fields">' +
      '<label class="dashboard-field"><span>Título do card</span><input type="text" data-card-title maxlength="60" value="' + escapeHtml(card.title || catalog.label) + '"></label>' +
      '<label class="dashboard-field"><span>Conteúdo</span><select data-card-show>' + showOptions + '</select></label>' +
      '<label class="dashboard-field"><span>Ordenação</span><select data-card-sort>' + sortOptions + '</select></label>' +
      '<label class="dashboard-field"><span>Itens exibidos</span><input type="number" data-card-quantity min="1" max="20" value="' + card.filters.quantity + '"></label>' +
      '<label class="dashboard-field"><span>Proporção</span><select data-card-size>' +
      '<option value="ratio-square" ' + (card.size === 'ratio-square' ? 'selected' : '') + '>1:1</option>' +
      '<option value="ratio-portrait" ' + (card.size === 'ratio-portrait' ? 'selected' : '') + '>4:5</option>' +
      '<option value="ratio-landscape" ' + (card.size === 'ratio-landscape' ? 'selected' : '') + '>1.91:1</option>' +
      '<option value="ratio-double-landscape" ' + (card.size === 'ratio-double-landscape' ? 'selected' : '') + '>1.91:1 · 2x</option></select></label></div>' +
      '<div class="dashboard-config-card-actions"><label class="dashboard-enabled-toggle"><input type="checkbox" data-card-enabled ' + (card.enabled !== false ? 'checked' : '') + '> Mostrar</label>' +
      '<button type="button" class="dashboard-order-btn" data-card-move="up" aria-label="Mover card para cima" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
      '<button type="button" class="dashboard-order-btn" data-card-move="down" aria-label="Mover card para baixo" ' + (index === total - 1 ? 'disabled' : '') + '>↓</button>' +
      '<button type="button" class="dashboard-remove-btn" data-card-remove>Remover</button></div></article>';
  }

  const CORE_LIBRARY_CARDS = [
    { type: 'tarefas', description: 'Tarefas pessoais e prazos do seu quadro.', features: ['Pendentes e atrasadas', 'Filtros e prioridades', 'Abrir tarefa'] },
    { type: 'projetos', description: 'Projetos participantes, andamento e conclusões.', features: ['Progresso por tarefas', 'Datas e responsáveis', 'Abrir projetos'] },
    { type: 'indicadores', description: 'Resumo visual de produtividade e prazos.', features: ['Progresso ilustrado', 'Tarefas atrasadas', 'Próximos prazos'] },
    { type: 'calendario', description: 'Eventos e compromissos da sua agenda.', features: ['Hoje e próximos dias', 'Eventos compartilhados', 'Abrir calendário'] },
    { type: 'documentos', description: 'Documentos acessíveis e arquivos recentes.', features: ['Lista recente', 'Ordenação', 'Abrir documentos'] },
    { type: 'comunicacao', description: 'Mensagens enviadas e atividade de comunicação.', features: ['Atividade recente', 'Conversas', 'Abrir mensagens'] },
    { type: 'atividade', description: 'Atualizações recentes das suas tarefas, projetos e documentos.', features: ['Ordenação por data', 'Acesso ao item original'] },
    { type: 'atalhos', description: 'Acesso rápido às ações e áreas de trabalho.', features: ['Nova tarefa', 'Projetos', 'Calendário e documentos'] },
    { type: 'comemoracoes', description: 'Aniversários cadastrados nos perfis da equipe.', features: ['Próximas datas', 'Dados do perfil'] }
  ];

  function libraryCardMarkup(type, description, features, sector, tone, config, data, module, homeCards) {
    const catalog = CARD_CATALOG[type];
    const added = config.cards.some(function (card) { return card.type === type; });
    const addedToHome = homeCards.indexOf(type) >= 0;
    const homeLimitReached = homeCards.length >= HOME_CARDS_LIMIT;
    const permitted = !module || canAccessBusinessCard(module, data);
    const pageTargets = {
      atividade: 'meu-espaco.html',
      atalhos: 'meu-espaco.html',
      comemoracoes: 'pessoas.html'
    };
    const pageHref = catalog.href || pageTargets[type] || 'meu-espaco.html';
    const availableFeatures = module
      ? module.source
        ? ['Dados ligados às páginas existentes', 'Atualização pelo store compartilhado', 'Exportação CSV']
        : ['Cadastro, edição e arquivamento', 'Busca e filtro por campos', 'Favoritos e exportação CSV', 'Criar tarefa vinculada']
      : features || [];
    const featureList = availableFeatures.map(function (feature) { return '<li>' + escapeHtml(feature) + '</li>'; }).join('');
    return '<article class="dashboard-library-card' + (!permitted ? ' is-restricted' : '') + '" data-access="' + (permitted ? 'allowed' : 'restricted') + '" data-tone="' + escapeHtml(module ? tone || 'blue' : 'general') + '">' +
      '<div class="dashboard-library-card-header"><span class="dashboard-library-icon">' + iconMarkup(catalog.icon) + '</span>' +
      '<div class="dashboard-library-info"><h4>' + escapeHtml(catalog.label) + '</h4>' +
      '<small>' + escapeHtml(sector || 'Geral') + '</small></div></div>' +
      '<p class="dashboard-library-description">' + escapeHtml(description) + '</p>' +
      '<ul>' + featureList + '</ul>' +
      '<div class="dashboard-library-card-actions">' +
      (module
        ? '<button type="button" class="btn secondary dashboard-library-open" data-library-open="' + escapeHtml(type) + '"' +
          (!permitted ? ' disabled title="Acesso restrito ao setor"' : '') + '>Abrir painel</button>'
        : '<a class="btn secondary dashboard-library-open" href="' + escapeHtml(pageHref) + '">Abrir página</a>') +
      '<details class="dashboard-library-add-menu"><summary class="dashboard-card-action">Adicionar</summary><div class="dashboard-library-add-options">' +
      '<button type="button" class="dashboard-card-action dashboard-library-home-toggle" data-home-toggle="' + escapeHtml(type) + '"' +
      (!permitted || !addedToHome && homeLimitReached ? ' disabled title="' + (homeLimitReached ? 'A página Início aceita até 3 painéis' : 'Acesso restrito ao setor') + '"' : '') + '>' +
      (addedToHome ? 'Remover do início' : 'Adicionar ao Início') + '</button>' +
      '<button type="button" class="dashboard-card-action dashboard-library-add" data-library-add="' + escapeHtml(type) + '"' +
      (!permitted ? ' disabled title="Acesso restrito ao setor"' : '') +
      (added ? ' disabled title="Este painel já está no Meu Espaço"' : '') + '>' +
      (added ? 'No Meu Espaço' : permitted ? 'Adicionar ao Meu Espaço' : 'Acesso restrito') + '</button></div></details></div></article>';
  }

  function getLibrarySectors() {
    const grouped = new Map();
    BUSINESS_CARD_MODULES.forEach(function (module) {
      if (module.sectorKey === 'financeiro' || module.sectorKey === 'logistica') return;
      if (!grouped.has(module.sectorKey)) grouped.set(module.sectorKey, []);
      grouped.get(module.sectorKey).push(module);
    });
    return Array.from(grouped.entries()).map(function (entry) {
      return { key: entry[0], modules: entry[1] };
    });
  }

  function renderLibraryContent(root, config, data, homeCards, activeSector) {
    if (!root) return;
    const selectedSector = activeSector || 'general';
    if (selectedSector === 'general') {
      const coreCards = CORE_LIBRARY_CARDS.map(function (item) {
        return libraryCardMarkup(item.type, item.description, item.features, 'Geral', 'blue', config, data, null, homeCards);
      }).join('');
      root.innerHTML = coreCards
        ? '<section class="dashboard-library-core" data-library-panel="general"><h3>Cards gerais do Meu Espaço</h3><div class="dashboard-library-cards">' + coreCards + '</div></section>'
        : '<div class="dashboard-data-empty">Nenhum card geral disponível.</div>';
      return;
    }

    const sector = getLibrarySectors().find(function (item) { return item.key === selectedSector; });
    if (!sector) {
      root.innerHTML = '<div class="dashboard-data-empty">Nenhum card disponível.</div>';
      return;
    }
    const modules = sector.modules;
    const moduleCards = modules.map(function (module) {
      return libraryCardMarkup(module.id, module.description, module.features, module.sector, module.tone, config, data, module, homeCards);
    }).join('');
    root.innerHTML = moduleCards
      ? '<section class="dashboard-library-sector" data-library-panel="' + escapeHtml(selectedSector) + '" data-tone="' + escapeHtml(modules[0].tone) + '">' +
        '<header><span>' + iconMarkup(modules[0].icon) + '</span><div><h3>' + escapeHtml(modules[0].sector) +
        '</h3><small>' + modules.length + ' painéis · acesso conforme o setor</small></div></header>' +
        '<div class="dashboard-library-cards">' + moduleCards + '</div></section>'
      : '<div class="dashboard-data-empty">Nenhum card deste setor disponível.</div>';
  }

  function hydrateLibrary(root, dashboardConfig, data, homeCards, activeSector) {
    if (!root) return;
    const sectors = getLibrarySectors();
    const selectedSector = activeSector || 'general';
    const sectorTabs = sectors.map(function (sector) {
      const module = sector.modules[0];
      return '<button type="button" class="dashboard-library-tab' + (selectedSector === sector.key ? ' active' : '') +
        '" data-library-sector="' + escapeHtml(sector.key) + '" data-tone="' + escapeHtml(module.tone) + '" role="tab" aria-controls="dashboard-library-results" aria-selected="' + (selectedSector === sector.key) + '">' +
        iconMarkup(module.icon) + '<span>' + escapeHtml(module.sector) + '</span></button>';
    }).join('');
    root.innerHTML = '<div class="dashboard-library-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-library-title">' +
      '<div class="dashboard-library-header"><div><span class="dashboard-library-eyebrow">RildonX · Componentes reutilizáveis</span>' +
      '<h2 id="dashboard-library-title">Biblioteca de Painéis</h2><p>Explore os painéis gerais e os módulos de cada setor. Os módulos setoriais respeitam as permissões do seu perfil.</p></div>' +
      '<div class="dashboard-library-header-actions"><button type="button" class="dashboard-library-close" data-library-close aria-label="Fechar biblioteca de painéis">×</button></div></div>' +
      '<div class="dashboard-library-tabs" role="tablist" aria-label="Categorias de painéis">' +
      '<button type="button" class="dashboard-library-tab' + (selectedSector === 'general' ? ' active' : '') +
      '" data-library-sector="general" data-tone="general" role="tab" aria-controls="dashboard-library-results" aria-selected="' + (selectedSector === 'general') + '"><span class="dashboard-library-general-icon">✦</span><span>Geral</span></button>' +
      sectorTabs + '</div><div id="dashboard-library-results" class="dashboard-library-content" role="tabpanel"></div></div>';
    root.dataset.activeSector = selectedSector;
    renderLibraryContent(root.querySelector('.dashboard-library-content'), dashboardConfig, data, homeCards, selectedSector);
  }

  function businessFieldMarkup(field, value, disabledOptions) {
    const fieldValue = value == null ? '' : String(value);
    const required = field.required ? ' required' : '';
    const label = '<span>' + escapeHtml(field.label) + (field.required ? ' *' : '') + '</span>';
    if (field.type === 'employees') {
      const selectedIds = new Set(Array.isArray(value) ? value.map(String) : []);
      const employees = trainingEmployees(dashboardState);
      return '<fieldset class="dashboard-business-field hr-training-participants"><legend>' + label + '</legend>' +
        '<div class="hr-training-participant-list">' + employees.map(function (employee) {
          const id = String(employee.id);
          const name = employee.displayName || employee.nickname || employee.name || 'Colaborador';
          return '<label><input type="checkbox" name="participantIds" value="' + escapeHtml(id) + '"' +
            (selectedIds.has(id) ? ' checked' : '') + '><span><b>' + escapeHtml(name) + '</b><small>' +
            escapeHtml([employee.position || employee.jobTitle || employee.role, employee.sector].filter(Boolean).join(' · ')) +
            '</small></span></label>';
        }).join('') + (employees.length ? '' : '<p>Nenhum funcionário ativo está disponível no diretório Pessoas.</p>') +
        '</div><small>As participações usam os perfis do RildonX; cadastro e situação dos funcionários são mantidos em Pessoas.</small></fieldset>';
    }
    if (field.type === 'textarea') {
      return '<label class="dashboard-business-field">' + label + '<textarea name="' + escapeHtml(field.key) + '" rows="3"' + required + '>' + escapeHtml(fieldValue) + '</textarea></label>';
    }
    if (field.type === 'select') {
      return '<label class="dashboard-business-field">' + label + '<select name="' + escapeHtml(field.key) + '"' + required + '><option value="">Selecione...</option>' +
        (field.options || []).map(function (option) {
          return '<option value="' + escapeHtml(option) + '"' + (fieldValue === option ? ' selected' : '') +
            ((disabledOptions || []).indexOf(option) !== -1 && fieldValue !== option ? ' disabled' : '') + '>' + escapeHtml(option) + '</option>';
        }).join('') + '</select></label>';
    }
    return '<label class="dashboard-business-field">' + label + '<input type="' + escapeHtml(field.type || 'text') + '" name="' + escapeHtml(field.key) + '"' +
      (field.type === 'number' ? ' step="any"' : '') + ' value="' + escapeHtml(fieldValue) + '"' + required + '></label>';
  }

  function hrTrainingFields(recordType) {
    if (recordType === 'investment') {
      return [
        { key: 'title', label: 'Instrutor / tema', type: 'text', required: true },
        { key: 'trainingType', label: 'Tipo', type: 'select', options: ['Curso', 'Palestra', 'Workshop', 'Outro'], required: true },
        { key: 'otherTrainingType', label: 'Outro tipo', type: 'text' },
        { key: 'participantsCount', label: 'Quantidade de participantes', type: 'number', required: true },
        { key: 'trainingCost', label: 'Custo do treinamento (R$)', type: 'number', required: true },
        { key: 'coffeeBreakCost', label: 'Custo do coffee break (R$)', type: 'number', required: true }
      ];
    }
    return [
      { key: 'title', label: 'Curso / tema', type: 'text', required: true },
      { key: 'trainingType', label: 'Tipo', type: 'select', options: ['Curso', 'Palestra', 'Workshop', 'Outro'], required: true },
      { key: 'otherTrainingType', label: 'Outro tipo', type: 'text' },
      { key: 'date', label: 'Data de realização', type: 'date', required: true },
      { key: 'durationHours', label: 'Carga horária (horas)', type: 'number', required: true },
      { key: 'instructor', label: 'Instrutor', type: 'text' },
      { key: 'validityMonths', label: 'Validade (meses)', type: 'number' },
      { key: 'participants', label: 'Funcionários participantes', type: 'employees', required: true }
    ];
  }

  function businessAttachmentViewers(module, data) {
    return (data.profiles || []).filter(function (profile) {
      return profile && profile.id && profileCanAccessBusinessCard(module, profile);
    }).map(function (profile) { return profile.id; }).filter(function (id) {
      return /^[0-9a-f-]{36}$/i.test(String(id));
    });
  }

  function renderBusinessAttachments(record, data) {
    const ids = record && record.data && Array.isArray(record.data.attachmentIds) ? record.data.attachmentIds : [];
    if (!ids.length) return '';
    const documents = data.documents || [];
    return '<div class="dashboard-business-attachments"><b>Arquivos vinculados</b>' + ids.map(function (id) {
      const file = documents.find(function (item) { return String(item.id) === String(id); });
      return file
        ? '<button type="button" data-business-attachment="' + escapeHtml(file.id) + '">' + iconMarkup('doc') + escapeHtml(file.name) + '</button>'
        : '<span>' + iconMarkup('doc') + 'Arquivo ' + escapeHtml(id) + '</span>';
    }).join('') + '</div>';
  }

  function createDashboardEngine() {
    const dashboardRoot = document.getElementById('dashboard-grid');
    const homeDashboardRoot = document.getElementById('home-dashboard-grid');
    const configRoot = document.getElementById('dashboard-config-root');
    const libraryRoot = document.getElementById('dashboard-library-root');
    const businessRoot = document.getElementById('dashboard-business-root');
    const libraryBtn = document.getElementById('open-card-library-btn');
    if (!dashboardRoot && !homeDashboardRoot && !configRoot) return;
    let draft = null;
    let draggedDashboardCard = null;
    let dragCandidateDashboardCard = null;
    let businessCardsVerified = false;
    let dashboardState = Object.assign({}, appState(), {
      businessCardRecords: [],
      supportTickets: [],
      supportTicketsLoadError: '',
      infrastructureAssets: [],
      infrastructureAssetsLoadError: '',
      businessCardRecordsLoadError: window.supabaseClient
        ? 'Carregando registros compartilhados e permissões do seu setor...'
        : 'O armazenamento compartilhado não está conectado. Configure o Supabase para criar registros persistentes.'
    });
    let activeBusinessModule = '';
    let businessOpenedFromLibrary = false;
    let activeLibrarySector = 'general';
    let businessSearch = '';
    let includeArchived = false;
    let businessFilterValue = '';
    let qualityRiskMatrixFilter = null;
    let qualityIndicatorFilter = '';
    let hrTrainingView = 'dashboard';
    let hrTrainingFilters = { month: '', course: '', employee: '' };
    let marketingContentView = 'kanban';
    let marketingContentFilters = { channel: '', campaign: '', owner: '', format: '', theme: '', status: '', from: '', to: '' };
    let marketingCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let marketingInsightsFilters = { channel: '', campaign: '', metric: '', from: '', to: '' };
    let marketingComparisonMonths = { primary: '', secondary: '' };
    let marketingMaterialsView = 'materials';
    let businessFavoritesStorageKey = 'rildonx_business_favorites:local';
    let businessFavorites = {};
    let supportTicketsChannel = null;
    let infrastructureAssetsChannel = null;

    function refreshSupportTickets() {
      if (!window.supabaseClient || !window.supabaseClient.from) return Promise.resolve();
      return window.supabaseClient.from('support_tickets').select('*').order('created_at', { ascending: false })
        .then(function (result) {
          if (result.error) throw result.error;
          dashboardState = Object.assign({}, dashboardState, {
            supportTickets: result.data || [],
            supportTicketsLoadError: ''
          });
          render();
        })
        .catch(function (error) {
          console.error('Não foi possível carregar os chamados para o painel:', error);
          dashboardState = Object.assign({}, dashboardState, {
            supportTicketsLoadError: 'Não foi possível carregar os chamados. Verifique a conexão e as permissões do Supabase.'
          });
          render();
        });
    }

    function subscribeSupportTickets() {
      if (supportTicketsChannel || !window.supabaseClient || typeof window.supabaseClient.channel !== 'function') return;
      supportTicketsChannel = window.supabaseClient.channel('rildonx-support-dashboard-' + (authenticatedUserId || 'user'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, function () {
          refreshSupportTickets();
        })
        .subscribe(function (status, error) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('A atualização em tempo real do card de suporte falhou:', error || status);
          }
        });
    }

    function refreshInfrastructureAssets() {
        const infrastructureModule = BUSINESS_CARD_MODULES.find(function (module) { return module.id === 'it-infrastructure'; });
        if (!infrastructureModule || !canAccessBusinessCard(infrastructureModule, dashboardState)) {
          dashboardState = Object.assign({}, dashboardState, {
            infrastructureAssets: [],
            infrastructureAssetsLoadError: ''
          });
          render();
          return Promise.resolve();
        }
        const requestedUserId = String(dashboardState.user && dashboardState.user.id || authenticatedUserId || '');
        if (!window.supabaseClient || !window.supabaseClient.from) return Promise.resolve();
        return window.supabaseClient.from('infrastructure_assets').select('*').order('updated_at', { ascending: false })
          .then(function (result) {
            if (result.error) throw result.error;
            if (requestedUserId && requestedUserId !== String(authenticatedUserId || '')) return;
            dashboardState = Object.assign({}, dashboardState, {
              infrastructureAssets: result.data || [],
              infrastructureAssetsLoadError: ''
            });
            render();
          })
          .catch(function (error) {
            if (requestedUserId && requestedUserId !== String(authenticatedUserId || '')) return;
            console.error('Não foi possível carregar os equipamentos para o painel:', error);
            dashboardState = Object.assign({}, dashboardState, {
              infrastructureAssetsLoadError: 'Não foi possível carregar os equipamentos. Aplique a migração Supabase de Infraestrutura e verifique as permissões.'
            });
            render();
          });
    }

    function subscribeInfrastructureAssets() {
        const infrastructureModule = BUSINESS_CARD_MODULES.find(function (module) { return module.id === 'it-infrastructure'; });
        if (!infrastructureModule || !canAccessBusinessCard(infrastructureModule, dashboardState)) return;
        if (infrastructureAssetsChannel || !window.supabaseClient || typeof window.supabaseClient.channel !== 'function') return;
        infrastructureAssetsChannel = window.supabaseClient.channel('rildonx-infrastructure-dashboard-' + (authenticatedUserId || 'user'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'infrastructure_assets' }, refreshInfrastructureAssets)
          .subscribe(function (status, error) {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('A atualização em tempo real do painel de Infraestrutura falhou:', error || status);
            }
          });
    }

    function activateUserPreferences(userId) {
      if (!userId) return false;
      const nextDashboardKey = STORAGE_KEY + ':' + userId;
      const nextHomeKey = HOME_CARDS_STORAGE_KEY + ':' + userId;
      if (activeHomeCardsStorageKey === nextHomeKey) return false;
      activeStorageKey = nextDashboardKey;
      activeHomeCardsStorageKey = nextHomeKey;
      businessFavoritesStorageKey = 'rildonx_business_favorites:' + userId;
      try {
        loadBusinessFavorites();
        const savedHomeCards = localStorage.getItem(nextHomeKey);
        const localHomeKey = HOME_CARDS_STORAGE_KEY + ':local';
        if (savedHomeCards === null) {
          const homeCardsToMigrate = localStorage.getItem(localHomeKey) || localStorage.getItem(HOME_CARDS_STORAGE_KEY);
          if (homeCardsToMigrate) localStorage.setItem(nextHomeKey, homeCardsToMigrate);
        }
        localStorage.removeItem(localHomeKey);
        localStorage.removeItem(HOME_CARDS_STORAGE_KEY);
        const legacyDashboard = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
        if (!localStorage.getItem(nextDashboardKey) && legacyDashboard) {
          localStorage.setItem(nextDashboardKey, legacyDashboard);
        }
      } catch (error) {
        console.error('Não foi possível carregar as preferências da conta autenticada:', error);
        if (typeof window.showToast === 'function') window.showToast('Não foi possível carregar as preferências salvas desta conta.');
      }
      return true;
    }

    const initialUser = appState().user;
    if (initialUser && initialUser.id) {
      authenticatedUserId = initialUser.id;
      authenticatedUserName = initialUser.name || '';
      activateUserPreferences(initialUser.id);
    }

    function loadBusinessFavorites() {
      try {
        const stored = localStorage.getItem(businessFavoritesStorageKey);
        const parsed = stored ? JSON.parse(stored) : {};
        businessFavorites = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        console.error('Não foi possível carregar os favoritos dos cards setoriais:', error);
        businessFavorites = {};
      }
    }

    function isBusinessFavorite(record) {
      const favorites = businessFavorites[record.moduleKey];
      return Array.isArray(favorites) && favorites.indexOf(String(record.id)) !== -1;
    }

    function toggleBusinessFavorite(record) {
      const favorites = Array.isArray(businessFavorites[record.moduleKey])
        ? businessFavorites[record.moduleKey].slice()
        : [];
      const recordId = String(record.id);
      const index = favorites.indexOf(recordId);
      if (index === -1) favorites.push(recordId);
      else favorites.splice(index, 1);
      businessFavorites[record.moduleKey] = favorites;
      try {
        localStorage.setItem(businessFavoritesStorageKey, JSON.stringify(businessFavorites));
      } catch (error) {
        if (index === -1) favorites.pop();
        else favorites.splice(index, 0, recordId);
        businessFavorites[record.moduleKey] = favorites;
        console.error('Não foi possível salvar os favoritos dos cards setoriais:', error);
        if (typeof window.showToast === 'function') window.showToast('Não foi possível salvar este favorito neste navegador.');
        return;
      }
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
      if (module) renderBusinessRecordList(module, businessSearch);
    }

    function businessFilterField(module) {
      return module.fields.find(function (field) { return field.key === 'status' && field.type === 'select'; }) ||
        module.fields.find(function (field) { return field.type === 'select'; }) || null;
    }

    function getBusinessApproval(record) {
      return record && record.data && record.data.approval && typeof record.data.approval === 'object'
        ? record.data.approval
        : {};
    }

    function businessApprovalLabel(status) {
      return {
        pending: 'Aguardando aprovação',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        cancelled: 'Solicitação cancelada'
      }[status] || 'Sem aprovação solicitada';
    }

    function filteredBusinessRecords(module, search) {
      const query = String(search || '').trim().toLocaleLowerCase('pt-BR');
      const filterField = businessFilterField(module);
      return (dashboardState.businessCardRecords || []).filter(function (record) {
        if (!record || record.moduleKey !== module.id || (!includeArchived && record.archived)) return false;
        if (module.id === 'quality-risks' && qualityRiskMatrixFilter &&
            (record.status === 'Encerrado' ||
              Number.parseInt(String(record.data && record.data.probability || ''), 10) !== qualityRiskMatrixFilter.probability ||
              Number.parseInt(String(record.data && record.data.impact || ''), 10) !== qualityRiskMatrixFilter.impact)) return false;
        if (businessFilterValue === '__favorites' && !isBusinessFavorite(record)) return false;
        if (module.id === 'purchase-quotes' && businessFilterValue.indexOf('__approval_') === 0 &&
            getBusinessApproval(record).status !== businessFilterValue.slice('__approval_'.length)) return false;
        if (businessFilterValue && businessFilterValue !== '__favorites' && filterField &&
            businessFilterValue.indexOf('__approval_') !== 0 &&
            String(filterField.key === 'status' ? record.status || '' : record.data && record.data[filterField.key] || '') !== businessFilterValue) return false;
        const haystack = [record.title, record.status, JSON.stringify(record.data || {})].join(' ').toLocaleLowerCase('pt-BR');
        return !query || haystack.indexOf(query) !== -1;
      }).sort(function (a, b) { return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); });
    }

    function safeExternalUrl(value) {
      if (!value) return '';
      try {
        const url = new URL(String(value), window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
      } catch (error) {
        return '';
      }
    }

    function downloadBusinessCsv(module, headings, rows) {
      const csv = [headings].concat(rows).map(function (row) {
        return row.map(function (value) {
          let text = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
          if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
          return '"' + text.replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\r\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = module.id + '-registros.csv';
      link.click();
      window.setTimeout(function () { URL.revokeObjectURL(downloadUrl); }, 1000);
    }

    function exportBusinessRecords(module) {
      if (module.source) {
        const sourceRows = businessSourceExportRows(module);
        downloadBusinessCsv(module, ['Nome ou indicador', 'Detalhes'], sourceRows.map(function (row) {
          return [row.title, row.details];
        }));
        return;
      }
      if (module.id === 'hr-training') {
        exportHrTrainingRecords(module);
        return;
      }
      const records = filteredBusinessRecords(module, businessSearch);
      const fields = module.fields.filter(function (field) { return field.key !== 'title' && field.key !== 'status'; });
      const trainingExport = module.id === 'hr-training';
      const headings = ['Título', 'Status'].concat(fields.map(function (field) { return field.label; }));
      if (trainingExport) headings.push('Participantes inscritos');
      if (module.id === 'quality-risks') headings.push('Criticidade', 'Faixa de risco');
      if (module.id === 'quality-5s') headings.push('Pontuação total 5S');
      const rows = records.map(function (record) {
        const row = [record.title, record.status || 'Pendente'].concat(fields.map(function (field) {
          return record.data && record.data[field.key] != null ? record.data[field.key] : '';
        }));
        if (trainingExport) {
          const participants = Array.isArray(record.data && record.data.participants) ? record.data.participants : [];
          row.push(participants.map(function (participant) {
            return [participant.name || participant.userId, (Number(participant.progress) || 0) + '%'].join(' — ');
          }).join('; '));
        }
        if (module.id === 'quality-risks') {
          const score = qualityRiskScore(record.data);
          row.push(score || '', score ? qualityRiskBand(score) : '');
        }
        if (module.id === 'quality-5s') row.push(quality5sScore(record.data));
        return row;
      });
      downloadBusinessCsv(module, headings, rows);
    }

    function exportHrTrainingRecords(module) {
      if (hrTrainingView === 'employees') {
        const employees = (dashboardState.profiles || []).slice().sort(function (a, b) {
          return String(a.displayName || a.nickname || a.name || '').localeCompare(String(b.displayName || b.nickname || b.name || ''), 'pt-BR');
        }).filter(function (profile) {
          return !businessSearch || [profile.displayName, profile.nickname, profile.name, profile.sector, profile.position, profile.jobTitle]
            .join(' ').toLocaleLowerCase('pt-BR').includes(businessSearch.toLocaleLowerCase('pt-BR'));
        });
        downloadBusinessCsv(module, ['Funcionário', 'Cargo', 'Setor', 'Situação'], employees.map(function (profile) {
          return [profile.displayName || profile.nickname || profile.name || '', profile.position || profile.jobTitle || profile.role || '',
            profile.sector || '', isActiveTrainingEmployee(profile) ? 'Ativo' : 'Inativo'];
        }));
        return;
      }
      if (hrTrainingView === 'investments') {
        const records = trainingInvestments(dashboardState, includeArchived).filter(function (record) {
          return !businessSearch || [record.title, JSON.stringify(record.data || {})].join(' ').toLocaleLowerCase('pt-BR').includes(businessSearch.toLocaleLowerCase('pt-BR'));
        });
        downloadBusinessCsv(module, ['Tipo', 'Instrutor / tema', 'Participantes', 'Custo do treinamento (R$)', 'Coffee break (R$)', 'Total (R$)', 'Custo por pessoa (R$)'],
          records.map(function (record) {
            const data = record.data || {};
            const trainingCost = Number(data.trainingCost) || 0;
            const coffeeBreakCost = Number(data.coffeeBreakCost) || 0;
            const quantity = Number(data.participantsCount) || 0;
            const total = trainingCost + coffeeBreakCost;
            return [data.trainingType === 'Outro' ? data.otherTrainingType : data.trainingType, record.title, quantity,
              trainingCost.toFixed(2), coffeeBreakCost.toFixed(2), total.toFixed(2), quantity ? (total / quantity).toFixed(2) : ''];
          }));
        return;
      }
      const summary = trainingSummary(dashboardState);
      const query = businessSearch.toLocaleLowerCase('pt-BR');
      const records = (hrTrainingView === 'reports'
        ? summary.records.filter(isTrainingCompletionRecord)
        : trainingRecords(dashboardState, includeArchived)).filter(function (record) {
        const names = hrTrainingParticipantsText(record, summary.employees);
        const textMatches = !query || [record.title, record.data && record.data.trainingType, names]
          .join(' ').toLocaleLowerCase('pt-BR').includes(query);
        if (hrTrainingView === 'reports') {
          return textMatches && trainingRecordParticipants(record).some(function (participant) {
            const data = trainingParticipantData(record, participant);
            return (!hrTrainingFilters.month || String(data.date || '').slice(0, 7) === hrTrainingFilters.month) &&
              (!hrTrainingFilters.course || String(data.title || record.title) === hrTrainingFilters.course) &&
              (!hrTrainingFilters.employee || trainingParticipantId(participant) === hrTrainingFilters.employee);
          });
        }
        return textMatches;
      });
      const rows = [];
      records.forEach(function (record) {
        const data = record.data || {};
        const participants = trainingRecordParticipants(record);
        const selectedParticipants = hrTrainingView === 'reports'
          ? participants.filter(function (participant) {
            const participantData = trainingParticipantData(record, participant);
            return (!hrTrainingFilters.month || String(participantData.date || '').slice(0, 7) === hrTrainingFilters.month) &&
              (!hrTrainingFilters.course || String(participantData.title || record.title) === hrTrainingFilters.course) &&
              (!hrTrainingFilters.employee || trainingParticipantId(participant) === hrTrainingFilters.employee);
          })
          : participants;
        (selectedParticipants.length ? selectedParticipants : [null]).forEach(function (participant) {
          const participantData = participant ? trainingParticipantData(record, participant) : data;
          const employee = participant && summary.employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(participant);
          });
          const expiry = trainingExpiryDate(record, participant);
          rows.push([participantData.date || '', record.status || 'Realizado',
            participantData.trainingType === 'Outro' ? participantData.otherTrainingType : participantData.trainingType,
            participantData.title || record.title, participant ? employee && (employee.displayName || employee.nickname || employee.name) || participant.name : '',
            participant ? employee && employee.sector || participant.sector || '' : '', participantData.durationHours || 0, participantData.instructor || '',
            participantData.validityMonths || '', expiry ? [expiry.getFullYear(), String(expiry.getMonth() + 1).padStart(2, '0'), String(expiry.getDate()).padStart(2, '0')].join('-') : '']);
        });
      });
      downloadBusinessCsv(module, ['Data', 'Situação', 'Tipo', 'Curso / tema', 'Funcionário', 'Setor', 'Carga horária da turma (h)', 'Instrutor', 'Validade (meses)', 'Vencimento'],
        rows);
    }

    function businessSourceExportRows(module) {
      if (module.source === 'profiles') {
        const currentMonth = new Date().getMonth();
        return (dashboardState.profiles || []).filter(function (profile) {
          return profile && profile.active !== false && profile.birthday &&
            new Date(profile.birthday + 'T00:00:00').getMonth() === currentMonth;
        }).map(function (profile) {
          return {
            title: profile.displayName || profile.nickname || 'Colaborador',
            details: [profile.birthday, profile.sector].filter(Boolean).join(' · ')
          };
        });
      }
      if (module.source === 'projects') {
        return (dashboardState.projects || []).filter(function (project) {
          return isProjectVisible(project, dashboardState);
        }).map(function (project) {
          const progress = projectProgress(project, dashboardState);
          return {
            title: project.name || 'Projeto',
            details: projectStatus(project, dashboardState) + ' · ' + progress.progress + '% concluído'
          };
        });
      }
      if (module.source === 'overview') {
        const tasks = (dashboardState.tasks || []).filter(function (task) { return task && !task.isDemo; });
        const projects = (dashboardState.projects || []).filter(function (project) { return project && !project.isDemo && !project.archived; });
        return [
          { title: 'Tarefas no workspace', details: String(tasks.length) },
          { title: 'Tarefas concluídas', details: String(tasks.filter(isTaskDone).length) },
          { title: 'Projetos ativos', details: String(projects.length) },
          { title: 'Publicações no Mural', details: String((dashboardState.posts || []).length) }
        ];
      }
      return [];
    }

    function render() {
      const current = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      renderDashboard(dashboardRoot, current, dashboardState);
      const homeCards = getStoredHomeCards();
      renderHomeDashboard(homeDashboardRoot, homeCards, dashboardState);
      if (libraryRoot && libraryRoot.classList.contains('open')) {
        hydrateLibrary(libraryRoot, current, dashboardState, homeCards, activeLibrarySector);
      }
      if (businessRoot && businessRoot.classList.contains('open') && activeBusinessModule &&
          !businessRoot.querySelector('[data-business-form]')) {
        renderBusinessModule(activeBusinessModule);
      }
    }

    function openLibrary() {
      const config = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      activeLibrarySector = 'general';
      hydrateLibrary(libraryRoot, config, dashboardState, getStoredHomeCards(), activeLibrarySector);
      libraryRoot.classList.add('open');
    }

    function closeLibrary() {
      libraryRoot.classList.remove('open');
    }

    function addLibraryCard(type) {
      const catalog = CARD_CATALOG[type];
      if (!catalog) return;
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === type; });
      if (module && !canAccessBusinessCard(module, dashboardState)) {
        if (typeof window.showToast === 'function') window.showToast('Este card é restrito ao setor ' + module.sector + '.');
        return;
      }
      const config = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      if (config.cards.some(function (card) { return card.type === type; })) {
        if (typeof window.showToast === 'function') window.showToast('Este card já está no seu espaço.');
        return;
      }
      config.cards.push({
        id: 'card-' + type + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7),
        type: type,
        tone: (BUSINESS_CARD_MODULES.find(function (item) { return item.id === type; }) || {}).tone || 'general',
        title: catalog.label,
        enabled: true,
        position: config.cards.length,
        size: 'ratio-square',
        filters: clone(catalog.defaults)
      });
      persistDashboard(config);
      render();
      hydrateLibrary(libraryRoot, config, dashboardState, getStoredHomeCards(), activeLibrarySector);
      if (typeof window.showToast === 'function') window.showToast(catalog.label + ' foi adicionado ao seu espaço.');
    }

    function toggleHomeCard(type) {
      const catalog = CARD_CATALOG[type];
      if (!catalog) return;
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === type; });
      if (module && !canAccessBusinessCard(module, dashboardState)) {
        if (typeof window.showToast === 'function') window.showToast('Este painel é restrito ao setor ' + module.sector + '.');
        return;
      }
      const cards = getStoredHomeCards();
      const index = cards.indexOf(type);
      if (index >= 0) {
        cards.splice(index, 1);
      } else {
        if (cards.length >= HOME_CARDS_LIMIT) {
          if (typeof window.showToast === 'function') window.showToast('A página Início aceita até 3 painéis. Remova um antes de adicionar outro.');
          return;
        }
        cards.push(type);
      }
      persistHomeCards(cards);
      render();
      if (typeof window.showToast === 'function') {
        window.showToast(index >= 0 ? catalog.label + ' foi removido do Início.' : catalog.label + ' foi adicionado ao Início.');
      }
    }

    function internalDemandRecords() {
      return (dashboardState.businessCardRecords || []).filter(function (record) {
        return record && record.moduleKey === 'marketing-internal-demands' && !record.archived;
      });
    }

    function internalDemandDashboardMarkup() {
      const records = internalDemandRecords();
      const activeStatuses = records.filter(function (record) {
        return !/^(concluida|cancelada|finalizada)$/i.test(normalizeSearchText(record.status || ''));
      });
      const approvals = records.filter(function (record) {
        return normalizeSearchText(record.data && record.data.approvalStatus || '') === 'pendente';
      });
      const incompleteBriefings = records.filter(function (record) {
        const data = record.data || {};
        return !String(data.briefingObjective || '').trim() ||
          !String(data.briefingAudience || '').trim() ||
          !String(data.briefingDeliverables || '').trim();
      });
      const completedRecords = records.filter(function (record) {
        return /^(concluida|finalizada)$/i.test(normalizeSearchText(record.status || '')) &&
          parseCalendarDate(record.data && record.data.completedAt);
      });
      const completionDays = completedRecords.map(function (record) {
        const completedAt = parseCalendarDate(record.data.completedAt);
        const createdAt = new Date(record.createdAt);
        if (!completedAt || !Number.isFinite(createdAt.getTime())) return null;
        const createdDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
        return Math.max(0, (completedAt.getTime() - createdDate.getTime()) / 86400000);
      }).filter(function (days) { return days != null; });
      const averageDays = completionDays.length
        ? (completionDays.reduce(function (total, days) { return total + days; }, 0) / completionDays.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dias'
        : '—';
      const sectors = {};
      records.forEach(function (record) {
        const sector = String(record.data && record.data.requesterSector || '').trim() || 'Não informado';
        sectors[sector] = (sectors[sector] || 0) + 1;
      });
      const sectorRows = Object.keys(sectors).sort(function (first, second) {
        return sectors[second] - sectors[first] || first.localeCompare(second, 'pt-BR');
      }).slice(0, 4).map(function (sector) {
        return '<span><b>' + escapeHtml(sector) + '</b><small>' + sectors[sector] + (sectors[sector] === 1 ? ' demanda' : ' demandas') + '</small></span>';
      }).join('');
      const metrics = [
        { label: 'Solicitações Recebidas', value: records.length, detail: 'Demandas registradas', tone: 'blue' },
        { label: 'Demandas Pendentes', value: activeStatuses.length, detail: 'Aguardando conclusão', tone: 'orange' },
        { label: 'Aprovações Necessárias', value: approvals.length, detail: 'Aguardando aprovação', tone: 'purple' },
        { label: 'Demandas por Setor', value: '', detail: sectorRows || '<span><b>Sem demandas</b><small>Os setores aparecem após os primeiros pedidos.</small></span>', tone: 'green', isSector: true },
        { label: 'Tempo de Atendimento', value: averageDays, detail: completedRecords.length + (completedRecords.length === 1 ? ' demanda concluída' : ' demandas concluídas'), tone: 'cyan' },
        { label: 'Briefings Incompletos', value: incompleteBriefings.length, detail: 'Precisam de objetivo, público e peças', tone: 'red' }
      ];
      return '<section class="internal-demand-dashboard" aria-label="Indicadores de demandas internas">' +
        metrics.map(function (metric) {
          return '<article class="internal-demand-kpi" data-tone="' + metric.tone + '"><span>' + escapeHtml(metric.label) + '</span>' +
            (metric.isSector ? '<div class="internal-demand-sector-list">' + metric.detail + '</div>' :
              '<b>' + escapeHtml(metric.value) + '</b><small>' + escapeHtml(metric.detail) + '</small>') + '</article>';
        }).join('') + '</section>';
    }

    function businessRecordMeta(record, module) {
      const data = record.data || {};
      const fieldMeta = module.fields.filter(function (field) {
        return field.key !== 'title' && field.key !== 'status' && data[field.key] !== '' && data[field.key] != null;
      }).slice(0, 3).map(function (field) {
        return field.label + ': ' + String(data[field.key]);
      }).join(' · ');
      if (module.id === 'marketing-internal-demands') {
        return [
          data.requesterSector,
          data.requester ? 'Solicitante: ' + data.requester : '',
          data.priority ? 'Prioridade: ' + data.priority : '',
          data.owner ? 'Responsável: ' + data.owner : '',
          data.dueDate ? 'Prazo: ' + data.dueDate : '',
          data.approvalStatus === 'Pendente' ? 'Aprovação pendente' : ''
        ].filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-audits') {
        return [data.date, data.sector, data.nonconformities != null && data.nonconformities !== '' ? data.nonconformities + ' NC(s)' : '',
          data.isoClause ? 'Cláusula ' + data.isoClause : '',
          data.nextAuditDate ? 'Próxima: ' + data.nextAuditDate : ''].filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-5w2h') {
        return [data.responsible, data.dueDate ? 'Prazo: ' + data.dueDate : '',
          dateIsPast(data.dueDate) && !/^(concluido|cancelado)$/i.test(normalizeSearchText(record.status || '')) ? 'Prazo vencido' : '',
          data.efficacyVerified === 'Sim' ? 'Eficácia verificada' : '']
          .filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-risks') {
        const score = qualityRiskScore(data);
        return [data.process, score ? 'Criticidade ' + score + ' · ' + qualityRiskBand(score) : '',
          data.response, data.responsible, data.nextReview ? 'Revisão: ' + data.nextReview : '',
          dateIsPast(data.nextReview) && record.status !== 'Encerrado' ? 'Revisão vencida' : ''].filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-indicators') {
        return [data.sector, data.measurementMonth, 'Resultado: ' + data.value + (data.unit ? ' ' + data.unit : ''),
          'Meta: ' + data.target, data.direction].filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-5s') {
        const score = quality5sScore(data);
        return [data.recordType, data.sector, data.date, data.responsible,
          data.recordType === 'Avaliação' ? 'Pontuação: ' + score + '/25' : 'Próxima avaliação: ' + (data.nextEvaluation || 'não definida')]
          .filter(Boolean).join(' · ');
      }
      if (module.id === 'quality-kaizen') {
        return [data.author, data.sector, data.problem, 'Benefício: ' + data.expectedBenefit].filter(Boolean).join(' · ');
      }
      if (module.id === 'hr-training') {
        if (data.recordType === 'investment') {
          const total = (Number(data.trainingCost) || 0) + (Number(data.coffeeBreakCost) || 0);
          const quantity = Number(data.participantsCount) || 0;
          return [data.trainingType, quantity + ' participante(s)', 'Total: ' + total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            quantity > 0 ? 'Por pessoa: ' + (total / quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Custo por pessoa indisponível']
            .filter(Boolean).join(' · ');
        }
        return [data.trainingType, data.date, data.durationHours != null ? data.durationHours + ' h' : '',
          trainingRecordParticipants(record).length + ' participação(ões)',
          Number(data.validityMonths) > 0 ? 'Validade: ' + data.validityMonths + ' mês(es)' : 'Sem validade definida']
          .filter(Boolean).join(' · ');
      }
      if (module.id === 'it-infrastructure') {
        const operationalMeta = [
          data.lastCheck ? 'Verificado em: ' + data.lastCheck : '',
          data.owner ? 'Responsável: ' + data.owner : '',
          data.incidentNotes || ''
        ].filter(Boolean).slice(0, 3).join(' · ');
        return operationalMeta || fieldMeta;
      }
      return fieldMeta;
    }

    function qualityRiskScore(data) {
      const probability = Number.parseInt(String(data && data.probability || ''), 10);
      const impact = Number.parseInt(String(data && data.impact || ''), 10);
      return Number.isInteger(probability) && Number.isInteger(impact) ? probability * impact : 0;
    }

    function qualityRiskBand(score) {
      return score >= 15 ? 'Alto' : score > 5 ? 'Moderado' : score > 0 ? 'Baixo' : 'Não avaliado';
    }

    function quality5sScore(data) {
      return ['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'].reduce(function (total, key) {
        const score = Number(data && data[key]);
        return total + (Number.isFinite(score) ? score : 0);
      }, 0);
    }

    function qualityActiveRecords(moduleId) {
      return (dashboardState.businessCardRecords || []).filter(function (record) {
        return record && record.moduleKey === moduleId && !record.archived;
      });
    }

    function qualityRiskMatrixMarkup() {
      const records = qualityActiveRecords('quality-risks').filter(function (record) {
        return record.status !== 'Encerrado';
      });
      let cells = '<span></span>' + [1, 2, 3, 4, 5].map(function (impact) {
        return '<span class="quality-risk-column-label">' + impact + '</span>';
      }).join('');
      for (let probability = 5; probability >= 1; probability--) {
        cells += '<b class="quality-risk-row-label">' + probability + '</b>';
        for (let impact = 1; impact <= 5; impact++) {
          const count = records.filter(function (record) {
            return Number.parseInt(String(record.data && record.data.probability || ''), 10) === probability &&
              Number.parseInt(String(record.data && record.data.impact || ''), 10) === impact;
          }).length;
          const score = probability * impact;
          const selected = qualityRiskMatrixFilter && qualityRiskMatrixFilter.probability === probability &&
            qualityRiskMatrixFilter.impact === impact;
          cells += '<button type="button" class="quality-risk-cell" data-level="' + (score >= 15 ? 'high' : score > 5 ? 'medium' : 'low') +
            '"' + (selected ? ' aria-pressed="true"' : '') + ' data-risk-probability="' + probability + '" data-risk-impact="' + impact +
            '" title="Probabilidade ' + probability + ' × impacto ' + impact + ': ' + count + ' risco(s)">' +
            (count ? '<b>' + count + '</b>' : '<span>·</span>') + '</button>';
        }
      }
      return '<section class="quality-insight"><div class="quality-insight-heading"><div><b>Matriz de riscos ativos</b>' +
        '<small>Criticidade = probabilidade × impacto · linhas: probabilidade (5→1) · colunas: impacto (1→5)</small></div>' +
        (qualityRiskMatrixFilter ? '<button type="button" class="quality-clear-filter" data-risk-matrix-clear>Limpar filtro</button>' : '') +
        '</div><div class="quality-risk-matrix" role="group" aria-label="Matriz de riscos 5 por 5">' + cells + '</div></section>';
    }

    function quality5sSummaryMarkup() {
      const records = qualityActiveRecords('quality-5s');
      const sectors = Array.from(new Set(records.map(function (record) {
        return String(record.data && record.data.sector || '').trim();
      }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      if (!sectors.length) return '<div class="quality-insight"><b>Acompanhamento 5S por setor</b><small>Cadastre uma implantação ou avaliação para iniciar o histórico.</small></div>';
      const cards = sectors.map(function (sector) {
        const matching = records.filter(function (record) { return String(record.data && record.data.sector || '').trim() === sector; });
        const evaluations = matching.filter(function (record) { return record.data && record.data.recordType === 'Avaliação'; });
        const implementations = matching.filter(function (record) { return record.data && record.data.recordType === 'Implantação'; });
        const average = evaluations.length
          ? (evaluations.reduce(function (sum, record) { return sum + quality5sScore(record.data); }, 0) / evaluations.length).toFixed(1)
          : '—';
        const latestImplementation = implementations.slice().sort(function (a, b) {
          return String(b.data.date || '').localeCompare(String(a.data.date || ''));
        })[0];
        return '<article class="quality-5s-sector"><b>' + escapeHtml(sector) + '</b><strong>' + average + '<small>/25</small></strong>' +
          '<span>' + evaluations.length + ' avaliação(ões) · ' + (latestImplementation ? 'Implantação: ' + escapeHtml(latestImplementation.status || 'Planejada') : 'Sem implantação cadastrada') +
          '</span></article>';
      }).join('');
      return '<section class="quality-insight"><div class="quality-insight-heading"><div><b>Acompanhamento 5S por setor</b>' +
        '<small>Média das avaliações na escala de 0 a 25</small></div></div><div class="quality-5s-grid">' + cards + '</div></section>';
    }

    function qualityIndicatorChartMarkup() {
      const allRecords = qualityActiveRecords('quality-indicators');
      const indicators = Array.from(new Set(allRecords.map(function (record) {
        return String(record.data && record.data.title || record.title || '').trim();
      }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      if (!allRecords.length) return '<div class="quality-insight"><b>Histórico mensal de indicadores</b><small>Registre uma medição mensal para visualizar os resultados.</small></div>';
      const selectedIndicator = indicators.indexOf(qualityIndicatorFilter) >= 0 ? qualityIndicatorFilter : indicators[0];
      const records = allRecords.filter(function (record) {
        return String(record.data && record.data.title || record.title || '').trim() === selectedIndicator;
      }).slice().sort(function (a, b) {
        return String(a.data && a.data.measurementMonth || '').localeCompare(String(b.data && b.data.measurementMonth || ''));
      }).slice(-12);
      const maximum = Math.max.apply(null, records.map(function (record) {
        const value = Number(record.data && record.data.value);
        return Number.isFinite(value) ? Math.abs(value) : 0;
      })) || 1;
      const bars = records.map(function (record) {
        const data = record.data || {};
        const value = Number(data.value);
        const target = Number(data.target);
        const hasValidValues = Number.isFinite(value) && Number.isFinite(target);
        const met = hasValidValues && (data.direction === 'Quanto menor, melhor' ? value <= target : value >= target);
        const height = hasValidValues ? Math.max(7, Math.round(Math.abs(value) / maximum * 100)) : 7;
        return '<div class="quality-indicator-bar"><span>' + escapeHtml(data.title || record.title) + '</span><div><i data-met="' + met +
          '" style="height:' + height + '%" title="' + escapeHtml(data.measurementMonth || '') + ': ' + escapeHtml(data.value) + ' / meta ' + escapeHtml(data.target) + '"></i></div>' +
          '<small>' + escapeHtml(data.measurementMonth || '') + ' · ' + escapeHtml(data.value) + (data.unit ? ' ' + escapeHtml(data.unit) : '') + '</small></div>';
      }).join('');
      return '<section class="quality-insight"><div class="quality-insight-heading"><div><b>Histórico mensal de indicadores</b>' +
        '<small>Até 12 medições do indicador selecionado; as cores consideram o sentido definido para a meta</small></div>' +
        '<label class="quality-indicator-select"><span>Indicador</span><select data-quality-indicator-filter>' +
        indicators.map(function (indicator) {
          return '<option value="' + escapeHtml(indicator) + '"' + (indicator === selectedIndicator ? ' selected' : '') + '>' +
            escapeHtml(indicator) + '</option>';
        }).join('') + '</select></label></div><div class="quality-indicator-chart">' + bars + '</div></section>';
    }

    function qualityKaizenBoard(records) {
      const stages = ['Sugerido', 'Avaliando', 'Aprovado', 'Implementado', 'Rejeitado'];
      const userId = authenticatedUserId || getCurrentProfile(dashboardState).id;
      return '<div class="quality-kaizen-board">' + stages.map(function (stage) {
        const cards = records.filter(function (record) { return (record.status || 'Sugerido') === stage; });
        return '<section class="quality-kaizen-column"><h3>' + escapeHtml(stage) + '<span>' + cards.length + '</span></h3>' +
          (cards.length ? cards.map(function (record) {
            const data = record.data || {};
            const canArchive = record.createdBy === userId || isBusinessCardManager(dashboardState);
            return '<article class="quality-kaizen-card"><b>' + escapeHtml(record.title) + '</b><small>' +
              escapeHtml([data.author, data.sector].filter(Boolean).join(' · ')) + '</small><p>' + escapeHtml(data.problem || '') + '</p>' +
              '<div class="quality-kaizen-benefit"><b>Benefício esperado</b><span>' + escapeHtml(data.expectedBenefit || '') + '</span></div>' +
              '<label>Etapa<select data-quality-kaizen-status data-record-id="' + escapeHtml(record.id) + '">' +
              stages.map(function (option) { return '<option value="' + escapeHtml(option) + '"' + (option === stage ? ' selected' : '') + '>' + escapeHtml(option) + '</option>'; }).join('') +
              '</select></label><div><button type="button" data-business-edit="' + escapeHtml(record.id) + '">Editar</button>' +
              (canArchive ? '<button type="button" data-business-archive="' + escapeHtml(record.id) + '">Arquivar</button>' : '') + '</div></article>';
          }).join('') : '<p class="quality-kaizen-empty">Nenhuma ideia nesta etapa.</p>') + '</section>';
      }).join('') + '</div>';
    }

    function businessApprovalMarkup(record) {
      if (record.moduleKey !== 'purchase-quotes') return '';
      const approval = getBusinessApproval(record);
      const status = ['pending', 'approved', 'rejected', 'cancelled'].indexOf(approval.status) !== -1
        ? approval.status
        : 'none';
      const title = approval.reason ? ' title="' + escapeHtml(approval.reason) + '"' : '';
      const history = Array.isArray(approval.history) ? approval.history : [];
      const timeline = history.length
        ? '<details class="dashboard-business-approval-history"><summary>Histórico (' + history.length + ')</summary><ol>' +
          history.slice().reverse().map(function (entry) {
            const actor = (dashboardState.profiles || []).find(function (item) {
              return String(item.id) === String(entry.actorId);
            });
            const actorName = entry.actorName || actor && (actor.displayName || actor.nickname) || 'Colaborador';
            const eventDate = entry.at ? new Date(entry.at) : null;
            const dateLabel = eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate.toLocaleString('pt-BR') : '';
            return '<li><b>' + escapeHtml(businessApprovalLabel(entry.status)) + '</b><span>' +
              escapeHtml([actorName, dateLabel].filter(Boolean).join(' · ')) + '</span>' +
              (entry.reason ? '<small>' + escapeHtml(entry.reason) + '</small>' : '') + '</li>';
          }).join('') + '</ol></details>'
        : '';
      return '<span class="dashboard-business-approval" data-state="' + status + '"' + title + '>' +
        escapeHtml(businessApprovalLabel(status === 'none' ? '' : status)) + '</span>' + timeline;
    }

    function businessApprovalActions(record) {
      if (record.moduleKey !== 'purchase-quotes' || record.archived) return '';
      const approval = getBusinessApproval(record);
      const status = approval.status || '';
      const userId = authenticatedUserId || getCurrentProfile(dashboardState).id;
      const canRequest = record.createdBy === userId || isBusinessCardManager(dashboardState);
      const canCancel = record.createdBy === userId || isBusinessCardManager(dashboardState);
      const manager = isBusinessCardManager(dashboardState);
      if (status === 'pending') {
        return (manager
          ? '<button type="button" data-business-approval="approve" data-record-id="' + escapeHtml(record.id) + '">Aprovar</button>' +
            '<button type="button" class="is-danger" data-business-approval="reject" data-record-id="' + escapeHtml(record.id) + '">Rejeitar</button>'
          : '') +
          (canCancel ? '<button type="button" data-business-approval="cancel" data-record-id="' + escapeHtml(record.id) + '">Cancelar solicitação</button>' : '');
      }
      if ((status === '' || status === 'rejected' || status === 'cancelled') && canRequest) {
        return '<button type="button" data-business-approval="request" data-record-id="' + escapeHtml(record.id) + '">Solicitar aprovação</button>';
      }
      return '';
    }

    function businessRecordRow(record, module) {
      const creatorId = authenticatedUserId || getCurrentProfile(dashboardState).id;
      const canArchive = record.createdBy === creatorId || isBusinessCardManager(dashboardState);
      const fileUrl = safeExternalUrl(record.data && (record.data.attachmentUrl || record.data.attendanceUrl || record.data.url));
      const monitoringUrl = module.id === 'it-infrastructure' ? safeExternalUrl(record.data && record.data.monitoringUrl) : '';
      const linkedFiles = Array.isArray(record.data && record.data.attachmentIds) ? record.data.attachmentIds : [];
      const linkedTask = record.linkedTaskId
        ? '<a class="dashboard-business-task-link" href="tarefas.html">Abrir tarefa vinculada</a>'
        : '<button type="button" class="dashboard-business-link-task" data-business-link-task="' + escapeHtml(record.id) + '">Criar tarefa vinculada</button>';
      const recordStatus = normalizeSearchText(record.status || '');
      const recordTone = module.id === 'it-infrastructure' && (recordStatus === 'atencao' || recordStatus === 'indisponivel')
        ? ' data-state="' + recordStatus + '"'
        : '';
      return '<article class="dashboard-business-record' + (record.archived ? ' is-archived' : '') + '" data-record-id="' + escapeHtml(record.id) + '">' +
        '<span class="dashboard-business-record-icon">' + iconMarkup(module.icon) + '</span>' +
        '<div class="dashboard-business-record-content"><b>' + escapeHtml(record.title) + '</b><small>' +
        escapeHtml(businessRecordMeta(record, module) || record.status || 'Sem detalhes') + '</small>' +
        '<span class="dashboard-business-record-status"' + recordTone + '>' + escapeHtml(record.archived ? 'Arquivado' : record.status || 'Pendente') + '</span>' +
        businessApprovalMarkup(record) + '</div>' +
        '<div class="dashboard-business-record-actions">' +
        businessApprovalActions(record) +
        '<button type="button" class="dashboard-business-favorite' + (isBusinessFavorite(record) ? ' is-favorite' : '') + '" data-business-favorite="' + escapeHtml(record.id) +
        '" aria-pressed="' + (isBusinessFavorite(record) ? 'true' : 'false') + '" aria-label="' + (isBusinessFavorite(record) ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '" title="' +
        (isBusinessFavorite(record) ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '">' + iconMarkup('star') + '</button>' +
        (fileUrl ? '<a href="' + escapeHtml(fileUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Abrir arquivo de ' + escapeHtml(record.title) + '" title="Abrir arquivo">' + iconMarkup('doc') + '</a>' : '') +
        linkedFiles.map(function (id) {
          const file = (dashboardState.documents || []).find(function (item) { return String(item.id) === String(id); });
          return file ? '<button type="button" data-business-attachment="' + escapeHtml(file.id) + '" title="Abrir ' + escapeHtml(file.name) + '" aria-label="Abrir anexo ' +
            escapeHtml(file.name) + '">' + iconMarkup('doc') + '</button>' : '';
        }).join('') +
        (monitoringUrl ? '<a href="' + escapeHtml(monitoringUrl) + '" target="_blank" rel="noopener noreferrer">Abrir monitoramento</a>' : '') +
        linkedTask +
        '<button type="button" data-business-edit="' + escapeHtml(record.id) + '" aria-label="Editar ' + escapeHtml(record.title) + '">' + iconMarkup('doc') + '</button>' +
        (canArchive && !record.archived ? '<button type="button" data-business-archive="' + escapeHtml(record.id) + '" aria-label="Arquivar ' + escapeHtml(record.title) + '">' + iconMarkup('box') + '</button>' : '') +
        (canArchive && record.archived ? '<button type="button" data-business-restore="' + escapeHtml(record.id) + '" aria-label="Restaurar ' + escapeHtml(record.title) + '">Restaurar</button>' : '') +
        '</div></article>';
    }

    function hrTrainingNavigationMarkup() {
        const tabs = [
          ['dashboard', 'Visão geral'],
          ['trainings', 'Turmas e histórico'],
          ['reports', 'Relatórios e pendências'],
          ['investments', 'Investimentos'],
          ['employees', 'Funcionários']
        ];
        return '<nav class="hr-training-nav" aria-label="Gestão de treinamentos">' + tabs.map(function (tab) {
          return '<button type="button" data-hr-training-view="' + tab[0] + '"' +
            (hrTrainingView === tab[0] ? ' aria-current="page"' : '') + '>' + tab[1] + '</button>';
        }).join('') + '</nav>';
    }

    function hrTrainingParticipantsText(record, employees) {
        return trainingRecordParticipants(record).map(function (participant) {
          const employee = employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(participant);
          });
          return employee && (employee.displayName || employee.nickname || employee.name) || participant.name || 'Funcionário removido';
        }).join(', ');
    }

    function hrTrainingRecordMarkup(record, employees, includeParticipantActions, participantFilter) {
        const data = record.data || {};
        const participants = trainingRecordParticipants(record).filter(function (participant) {
          return !participantFilter || participantFilter(participant);
        });
        const currentUserId = authenticatedUserId || getCurrentProfile(dashboardState).id;
        const canArchive = String(record.createdBy || '') === String(currentUserId || '') || isBusinessCardManager(dashboardState);
        const participantsMarkup = participants.map(function (participant) {
          const participantData = trainingParticipantData(record, participant);
          const employee = employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(participant);
          });
          const id = trainingParticipantId(participant);
          const employeeName = employee && (employee.displayName || employee.nickname || employee.name) || participant.name || 'Funcionário removido';
          const exception = participant.overrides ? ' · ' + [participantData.date, participantData.title,
            participantData.durationHours != null ? participantData.durationHours + ' h' : ''].filter(Boolean).join(' · ') : '';
          return '<li><span>' + escapeHtml(employeeName + exception) + '</span>' + (includeParticipantActions && id
            ? '<button type="button" data-hr-edit-participant="' + escapeHtml(record.id) + '" data-hr-employee-id="' +
              escapeHtml(id) + '" aria-label="Editar participação de ' + escapeHtml(employeeName) + '">Editar</button>' +
              '<button type="button" data-hr-remove-participant="' + escapeHtml(record.id) + '" data-hr-employee-id="' +
              escapeHtml(id) + '" aria-label="Remover participação de ' + escapeHtml(employeeName) + '">Remover</button>'
            : '') + '</li>';
        }).join('');
        const expiry = trainingExpiryDate(record);
        const dateText = data.date ? dateLabel(data.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sem data';
        const details = data.recordType === 'investment'
          ? [data.trainingType, data.participantsCount + ' participante(s)', (Number(data.trainingCost) + Number(data.coffeeBreakCost)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
          : [record.status || 'Realizado', data.trainingType, dateText, data.durationHours + ' h', data.instructor,
            expiry ? 'Vence em ' + dateLabel(expiry, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sem validade'];
        return '<article class="hr-training-record' + (record.archived ? ' is-archived' : '') + '"><div class="hr-training-record-main"><header><div><b>' + escapeHtml(record.title || 'Capacitação') +
          '</b><small>' + escapeHtml(details.filter(Boolean).join(' · ')) + '</small></div><div class="hr-training-record-actions">' +
          (data.recordType !== 'investment' && !record.archived && !isTrainingCompletionRecord(record)
            ? '<button type="button" data-hr-mark-complete="' + escapeHtml(record.id) + '">Registrar como realizado</button>'
            : '') +
          '<button type="button" data-business-edit="' + escapeHtml(record.id) + '">Editar</button>' +
          (canArchive && !record.archived ? '<button type="button" data-business-archive="' + escapeHtml(record.id) + '">Arquivar</button>' : '') +
          (canArchive && record.archived ? '<button type="button" data-business-restore="' + escapeHtml(record.id) + '">Restaurar</button>' : '') + '</div></header>' +
          (data.recordType === 'investment' ? '' : '<ul>' + (participantsMarkup || '<li>Nenhum participante</li>') + '</ul>') +
          '</div></article>';
    }

    function renderHrParticipantForm(record, participant) {
      const data = trainingParticipantData(record, participant);
      const fields = [
          { key: 'title', label: 'Curso / tema', type: 'text', required: true },
          { key: 'date', label: 'Data de realização', type: 'date', required: true },
          { key: 'durationHours', label: 'Carga horária (horas)', type: 'number', required: true },
          { key: 'validityMonths', label: 'Validade (meses)', type: 'number' }
      ];
      businessRoot.innerHTML = '<div class="dashboard-business-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><button type="button" class="dashboard-business-back" data-business-back>‹ Voltar</button>' +
          '<div><span class="dashboard-library-eyebrow">RH · Correção individual</span><h2 id="dashboard-business-title">Editar participação</h2>' +
          '<p>As alterações são aplicadas somente a este funcionário; os demais participantes mantêm os dados da turma.</p></div>' +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div>' +
          '<form class="dashboard-business-form" data-hr-participant-form data-record-id="' + escapeHtml(record.id) +
          '" data-employee-id="' + escapeHtml(trainingParticipantId(participant)) + '"><div class="dashboard-business-fields">' +
          fields.map(function (field) { return businessFieldMarkup(field, data[field.key]); }).join('') +
          '</div><div class="dashboard-business-form-actions"><button type="button" class="btn secondary" data-business-back>Cancelar</button>' +
          '<button type="submit" class="btn">Salvar participação</button></div></form></div>';
    }

    function hrTrainingOverviewMarkup() {
        const summary = trainingSummary(dashboardState);
        const maxCourse = summary.courseRank.length ? summary.courseRank[0].count : 0;
        const maxSector = summary.sectorRank.length ? summary.sectorRank[0].count : 0;
        const progressList = function (entries, max) {
          return entries.length ? entries.slice(0, 8).map(function (entry) {
            const percent = max ? Math.round(entry.count * 100 / max) : 0;
            return '<div class="hr-training-bar-row"><span>' + escapeHtml(entry.name) + '</span><i><b style="width:' +
              percent + '%"></b></i><strong>' + entry.count + '</strong></div>';
          }).join('') : '<p class="hr-training-empty">Ainda não há registros para este resumo.</p>';
        };
        const recent = summary.latest.map(function (item) {
          const employee = summary.employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(item.participant);
          });
          const name = employee && (employee.displayName || employee.nickname || employee.name) || item.participant.name || 'Funcionário';
          return '<li><b>' + escapeHtml(item.record.title || 'Capacitação') + '</b><span>' + escapeHtml(name) + ' · ' +
            escapeHtml(dateLabel(item.data.date)) + ' · ' + escapeHtml(item.data.durationHours || 0) + ' h</span></li>';
        }).join('');
        const alerts = summary.alerts.slice(0, 8).map(function (alert) {
          const employee = summary.employees.find(function (profile) {
            return String(profile.id) === trainingParticipantId(alert.participant);
          });
          return '<li data-overdue="' + alert.overdue + '"><b>' + escapeHtml(alert.record.title + ' · ' +
            (employee && (employee.displayName || employee.nickname || employee.name) || alert.participant.name || 'Funcionário')) + '</b><span>' +
            escapeHtml(dateLabel(alert.date, { day: '2-digit', month: '2-digit', year: 'numeric' })) + ' · ' +
            (alert.overdue ? 'Vencido' : alert.days + ' dia(s) útil(is)') + '</span></li>';
        }).join('');
        return '<section class="hr-training-insight hr-training-totals"><b>' + summary.records.length + ' turma(s)</b><span>' +
          summary.participations.length + ' participações · ' + summary.participationHours.toLocaleString('pt-BR') +
          ' h somadas por funcionário · média de ' + summary.averageHours.toLocaleString('pt-BR') + ' h por funcionário ativo</span></section>' +
          '<div class="hr-training-overview-grid"><section class="hr-training-insight"><h3>Ranking de cursos</h3>' +
          progressList(summary.courseRank, maxCourse) + '</section><section class="hr-training-insight"><h3>Participações por setor</h3>' +
          progressList(summary.sectorRank, maxSector) + '</section><section class="hr-training-insight"><h3>Últimas participações</h3>' +
          (recent ? '<ul>' + recent + '</ul>' : '<p class="hr-training-empty">Nenhuma capacitação registrada.</p>') + '</section>' +
          '<section class="hr-training-insight"><h3>Validades vencidas ou próximas (60 dias úteis)</h3>' +
          (alerts ? '<ul>' + alerts + '</ul>' : '<p class="hr-training-empty">Nenhum vencimento encontrado.</p>') + '</section>' +
          '<section class="hr-training-insight"><h3>Funcionários sem treinamento registrado</h3><p>' +
          (summary.missing.length ? summary.missing.slice(0, 12).map(function (employee) {
            return escapeHtml(employee.displayName || employee.nickname || employee.name || 'Colaborador');
          }).join(', ') + (summary.missing.length > 12 ? ' e mais ' + (summary.missing.length - 12) : '') :
            'Todos os funcionários ativos possuem ao menos uma participação.') + '</p></section></div>';
    }

    function hrTrainingReportMarkup(search) {
        const summary = trainingSummary(dashboardState);
        const records = summary.records.filter(isTrainingCompletionRecord);
        const courses = Array.from(new Set(records.reduce(function (all, record) {
          return all.concat(trainingRecordParticipants(record).map(function (participant) {
            return trainingParticipantData(record, participant).title || record.title;
          }));
        }, []).filter(Boolean)))
          .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
        const monthValue = hrTrainingFilters.month;
        const courseValue = hrTrainingFilters.course;
        const employeeValue = hrTrainingFilters.employee;
        const employees = summary.employees;
        const options = function (items, value, label) {
          return '<option value="">' + label + '</option>' + items.map(function (item) {
            const key = String(item.id || item);
            const text = String(item.displayName || item.nickname || item.name || item);
            return '<option value="' + escapeHtml(key) + '"' + (key === value ? ' selected' : '') + '>' + escapeHtml(text) + '</option>';
          }).join('');
        };
        const participantMatches = function (record, participant) {
          const data = trainingParticipantData(record, participant);
          if (monthValue && String(data.date || '').slice(0, 7) !== monthValue) return false;
          if (courseValue && String(data.title || record.title) !== courseValue) return false;
          if (employeeValue && trainingParticipantId(participant) !== employeeValue) return false;
          const employee = employees.find(function (profile) { return String(profile.id) === trainingParticipantId(participant); });
          const name = employee && (employee.displayName || employee.nickname || employee.name) || participant.name || '';
          const haystack = [data.title || record.title, data.trainingType, name].join(' ').toLocaleLowerCase('pt-BR');
          return !search || haystack.indexOf(search.toLocaleLowerCase('pt-BR')) !== -1;
        };
        const filtered = records.filter(function (record) {
          return trainingRecordParticipants(record).some(function (participant) {
            return participantMatches(record, participant);
          });
        });
        let pending = [];
        if (courseValue && !employeeValue) {
          const trained = new Set();
          filtered.forEach(function (record) {
            trainingRecordParticipants(record).forEach(function (participant) {
              if (participantMatches(record, participant)) trained.add(trainingParticipantId(participant));
            });
          });
          pending = employees.filter(function (employee) { return !trained.has(String(employee.id)); })
            .map(function (employee) { return employee.displayName || employee.nickname || employee.name || 'Colaborador'; });
        } else if (employeeValue && !courseValue) {
          const courseNames = courses.filter(function (course) {
            return records.some(function (record) {
              return trainingRecordParticipants(record).some(function (participant) {
                const data = trainingParticipantData(record, participant);
                return String(data.title || record.title) === course && (!monthValue || String(data.date || '').slice(0, 7) === monthValue);
              });
            });
          });
          const completed = new Set();
          filtered.forEach(function (record) {
            trainingRecordParticipants(record).forEach(function (participant) {
              if (participantMatches(record, participant)) {
                const data = trainingParticipantData(record, participant);
                completed.add(String(data.title || record.title));
              }
            });
          });
          pending = courseNames.filter(function (course) { return !completed.has(course); });
        }
        return '<div class="hr-training-filters"><label>Competência<input type="month" data-hr-filter="month" value="' + escapeHtml(monthValue) + '"></label>' +
          '<label>Curso<select data-hr-filter="course">' + options(courses, courseValue, 'Todos os cursos') + '</select></label>' +
          '<label>Funcionário<select data-hr-filter="employee">' + options(employees, employeeValue, 'Todos os funcionários') + '</select></label></div>' +
          (courseValue && employeeValue ? '<p class="hr-training-empty">Com curso e funcionário selecionados, a consulta mostra apenas os registros realizados; não é exibida uma lista de pendências.</p>' :
            pending.length ? '<section class="hr-training-insight"><h3>Pendências de capacitação (' + pending.length + ')</h3><p>' +
              pending.map(escapeHtml).join(', ') + '</p></section>' : '') +
          '<div class="hr-training-record-list">' + (filtered.length ? filtered.map(function (record) {
            return hrTrainingRecordMarkup(record, employees, true, function (participant) {
              return participantMatches(record, participant);
            });
          }).join('') : '<p class="hr-training-empty">Nenhum registro corresponde aos filtros.</p>') + '</div>';
    }

    function hrTrainingEmployeesMarkup(search) {
        const allProfiles = (dashboardState.profiles || []).slice().sort(function (a, b) {
          return String(a.displayName || a.nickname || a.name || '').localeCompare(String(b.displayName || b.nickname || b.name || ''), 'pt-BR');
        });
        const profiles = allProfiles.filter(function (profile) {
          const name = [profile.displayName, profile.nickname, profile.name, profile.sector, profile.position, profile.jobTitle].join(' ').toLocaleLowerCase('pt-BR');
          return !search || name.indexOf(search.toLocaleLowerCase('pt-BR')) !== -1;
        });
        return '<p class="hr-training-directory-note">A lista de funcionários utiliza o diretório central do RildonX. Para criar, editar ou inativar pessoas, use <a href="pessoas.html">Pessoas</a>; alterações de cadastro não são duplicadas neste painel.</p>' +
          '<div class="hr-training-employee-table"><table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Setor</th><th>Situação</th></tr></thead><tbody>' +
          (profiles.length ? profiles.map(function (profile) {
            return '<tr><td>' + escapeHtml(profile.displayName || profile.nickname || profile.name || 'Colaborador') + '</td><td>' +
              escapeHtml(profile.position || profile.jobTitle || profile.role || '') + '</td><td>' + escapeHtml(profile.sector || 'Sem setor') +
              '</td><td>' + (isActiveTrainingEmployee(profile) ? 'Ativo' : 'Inativo') + '</td></tr>';
          }).join('') : '<tr><td colspan="4">Nenhum funcionário encontrado.</td></tr>') + '</tbody></table></div>';
    }

    function hrTrainingViewMarkup(search) {
        const data = dashboardState.businessCardRecords || [];
        if (hrTrainingView === 'dashboard') return hrTrainingOverviewMarkup();
        if (hrTrainingView === 'reports') return hrTrainingReportMarkup(search);
        if (hrTrainingView === 'employees') return hrTrainingEmployeesMarkup(search);
        const employees = trainingEmployees(dashboardState);
        if (hrTrainingView === 'investments') {
          const investments = trainingInvestments(dashboardState, includeArchived).filter(function (record) {
            return !search || [record.title, JSON.stringify(record.data || {})].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
          });
          return '<div class="hr-training-record-list">' + (investments.length ? investments.map(function (record) {
            return hrTrainingRecordMarkup(record, employees, false);
          }).join('') : '<p class="hr-training-empty">Nenhum investimento cadastrado.</p>') + '</div>';
        }
        const records = trainingRecords(dashboardState, includeArchived).filter(function (record) {
          return !search || [record.title, JSON.stringify(record.data || {})].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
        }).slice().sort(function (a, b) {
          return String(b.data && b.data.date || '').localeCompare(String(a.data && a.data.date || ''));
        });
        const recentRecords = records.slice(0, 15);
        return '<p class="hr-training-directory-note">Exibindo as 15 turmas mais recentes por data de realização. O histórico completo está disponível em Relatórios e pendências.</p>' +
          '<div class="hr-training-record-list">' + (recentRecords.length ? recentRecords.map(function (record) {
          return hrTrainingRecordMarkup(record, employees, true);
        }).join('') : '<p class="hr-training-empty">Nenhuma turma cadastrada.</p>') + '</div>';
    }

    const MARKETING_CONTENT_STAGES = ['Banco de ideias', 'Em produção', 'Aguardando aprovação', 'Aprovado', 'Agendado', 'Publicado', 'Arquivo'];

    function marketingDateLabel(value, options) {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return dateLabel(value, options);
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
      return date.toLocaleDateString('pt-BR', options || { day: '2-digit', month: 'short' });
    }

    function marketingMonthLabel(value) {
      const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
      if (!match) return 'Mês não informado';
      return new Date(Number(match[1]), Number(match[2]) - 1, 1, 12)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function filteredMarketingContentRecords(search) {
      return filteredBusinessRecords(
        BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }),
        search
      ).filter(function (record) {
        const data = record.data || {};
        const date = String(data.publishAt || '');
        return (!marketingContentFilters.channel || data.channel === marketingContentFilters.channel) &&
          (!marketingContentFilters.campaign || data.campaign === marketingContentFilters.campaign) &&
          (!marketingContentFilters.owner || data.owner === marketingContentFilters.owner) &&
          (!marketingContentFilters.format || data.format === marketingContentFilters.format) &&
          (!marketingContentFilters.theme || data.theme === marketingContentFilters.theme) &&
          (!marketingContentFilters.status || record.status === marketingContentFilters.status) &&
          (!marketingContentFilters.from || date && date >= marketingContentFilters.from) &&
          (!marketingContentFilters.to || date && date <= marketingContentFilters.to);
      });
    }

    function marketingContentCardMarkup(record) {
      const data = record.data || {};
      const latestHistory = Array.isArray(data.statusHistory) ? data.statusHistory.slice(-3).reverse() : [];
      const publishedUrl = safeExternalUrl(data.publishedUrl);
      const attachmentIds = Array.isArray(data.attachmentIds) ? data.attachmentIds : [];
      const now = new Date();
      const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      const isLate = data.publishAt && data.publishAt < todayKey && record.status !== 'Publicado' && record.status !== 'Arquivo';
      const hasConflict = Boolean(data.publishAt && data.channel &&
        (dashboardState.businessCardRecords || []).some(function (other) {
          return other && other.moduleKey === 'marketing-content-calendar' &&
            String(other.id) !== String(record.id) && !other.archived &&
            other.status !== 'Arquivo' && other.data && other.data.publishAt === data.publishAt &&
            other.data.channel === data.channel;
        }));
      const warning = isLate ? '<span class="marketing-content-alert is-late">Atrasado</span>' :
        hasConflict ? '<span class="marketing-content-alert">Conflito de canal/data</span>' : '';
      return '<article class="marketing-content-card" draggable="true" data-marketing-record="' + escapeHtml(record.id) + '">' +
        '<div class="marketing-content-card-top"><span class="marketing-content-priority" data-priority="' + escapeHtml(data.priority || 'Normal') + '">' +
        escapeHtml(data.priority || 'Normal') + '</span><button type="button" data-business-edit="' + escapeHtml(record.id) + '" aria-label="Editar ' +
        escapeHtml(record.title) + '">Editar</button></div><h4>' + escapeHtml(record.title) + '</h4>' +
        '<p>' + escapeHtml([data.channel, data.format, data.campaign, data.theme].filter(Boolean).join(' · ') || 'Ideia sem canal ou campanha definidos') + '</p>' +
        '<div class="marketing-content-meta">' +
        warning +
        (data.publishAt ? '<span>' + escapeHtml(marketingDateLabel(data.publishAt, { day: '2-digit', month: 'short', year: 'numeric' })) +
          (data.publishTime ? ' · ' + escapeHtml(data.publishTime) : '') + '</span>' : '<span>Sem data de publicação</span>') +
        (data.publishedAt ? '<span>Publicado em ' + escapeHtml(marketingDateLabel(data.publishedAt, { day: '2-digit', month: 'short', year: 'numeric' })) + '</span>' : '') +
        (data.owner ? '<span>Responsável: ' + escapeHtml(data.owner) + '</span>' : '') +
        (attachmentIds.length ? '<span class="marketing-content-attachments">' + attachmentIds.map(function (id) {
          const file = (dashboardState.documents || []).find(function (item) { return String(item.id) === String(id); });
          return file ? '<button type="button" data-business-attachment="' + escapeHtml(id) + '">' + escapeHtml(file.name) + '</button>' : '';
        }).join('') + '</span>' : '') +
        (publishedUrl ? '<a href="' + escapeHtml(publishedUrl) + '" target="_blank" rel="noopener noreferrer">Publicação</a>' : '') +
        '</div>' + (latestHistory.length ? '<details class="marketing-content-history"><summary>Histórico</summary><ul>' +
        latestHistory.map(function (item) {
          return '<li>' + escapeHtml(item.from ? item.from + ' → ' : '') + escapeHtml(item.to || '') + ' · ' +
            escapeHtml(dateLabel(item.at, { day: '2-digit', month: 'short', year: 'numeric' })) + '</li>';
        }).join('') + '</ul></details>' : '') + '</article>';
    }

    function marketingContentCalendarMarkup(records) {
      const firstDay = new Date(marketingCalendarMonth.getFullYear(), marketingCalendarMonth.getMonth(), 1);
      const gridStart = new Date(firstDay);
      gridStart.setDate(1 - firstDay.getDay());
      const monthLabel = marketingCalendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const days = Array.from({ length: 42 }, function (_, index) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const dateKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        const entries = records.filter(function (record) {
          return record.data && record.data.publishAt === dateKey;
        });
        return '<div class="marketing-content-calendar-day' + (date.getMonth() === marketingCalendarMonth.getMonth() ? '' : ' is-outside') + '">' +
          '<b>' + date.getDate() + '</b>' + entries.map(function (record) {
            return '<button type="button" data-business-edit="' + escapeHtml(record.id) + '" title="' + escapeHtml(record.title) + '">' +
              escapeHtml(record.title) + '</button>';
          }).join('') + '</div>';
      }).join('');
      return '<div class="marketing-content-calendar-head"><button type="button" data-marketing-month="-1" aria-label="Mês anterior">‹</button><h3>' +
        escapeHtml(monthLabel) + '</h3><button type="button" data-marketing-month="1" aria-label="Próximo mês">›</button></div>' +
        '<div class="marketing-content-calendar-grid">' + dayLabels.map(function (day) { return '<b>' + day + '</b>'; }).join('') + days + '</div>';
    }

    function marketingContentListMarkup(records) {
      return '<div class="marketing-content-list">' + (records.length ? records.map(function (record) {
        const data = record.data || {};
        return '<article class="marketing-content-list-row"><div><b>' + escapeHtml(record.title) + '</b><small>' +
          escapeHtml([data.channel, data.format, data.campaign].filter(Boolean).join(' · ') || 'Sem canal ou campanha') +
          '</small></div><span>' + escapeHtml(record.status || '') + '</span><span>' +
          escapeHtml(data.publishAt ? marketingDateLabel(data.publishAt, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sem data') +
          '</span><button type="button" data-business-edit="' + escapeHtml(record.id) + '">Abrir</button></article>';
      }).join('') : '<div class="dashboard-business-empty"><b>Nenhum conteúdo encontrado</b><small>Ajuste os filtros ou crie uma nova ideia.</small></div>') + '</div>';
    }

    function marketingInsightRecords() {
      return (dashboardState.businessCardRecords || []).filter(function (record) {
        return record && record.moduleKey === 'marketing-insights' && !record.archived;
      });
    }

    function marketingInsightRows() {
      return marketingInsightRecords().reduce(function (rows, report) {
        const metrics = report.data && Array.isArray(report.data.metrics) ? report.data.metrics : [];
        return rows.concat(metrics.map(function (metric) {
          return Object.assign({}, metric, {
            reportId: report.id,
            reportTitle: report.title,
            documentId: report.data.documentId || ''
          });
        }));
      }, []);
    }

    function filteredMarketingInsightRows() {
      const query = String(businessSearch || '').trim().toLocaleLowerCase('pt-BR');
      return marketingInsightRows().filter(function (row) {
        return (!marketingInsightsFilters.channel || row.channel === marketingInsightsFilters.channel) &&
          (!marketingInsightsFilters.campaign || row.campaign === marketingInsightsFilters.campaign) &&
          (!marketingInsightsFilters.metric || row.metric === marketingInsightsFilters.metric) &&
          (!marketingInsightsFilters.from || row.month >= marketingInsightsFilters.from) &&
          (!marketingInsightsFilters.to || row.month <= marketingInsightsFilters.to) &&
          (!query || [row.reportTitle, row.label, row.channel, row.campaign, row.month].join(' ')
            .toLocaleLowerCase('pt-BR').includes(query));
      });
    }

    function marketingInsightOptions(rows, key, selected) {
      const options = Array.from(new Set(rows.map(function (row) { return String(row[key] || '').trim(); }).filter(Boolean)))
        .sort(function (first, second) { return first.localeCompare(second, 'pt-BR'); });
      return '<option value="">Todos</option>' + options.map(function (option) {
        return '<option value="' + escapeHtml(option) + '"' + (option === selected ? ' selected' : '') + '>' +
          escapeHtml(option) + '</option>';
      }).join('');
    }

    function marketingInsightsMarkup() {
      const allRows = marketingInsightRows();
      const rows = filteredMarketingInsightRows();
      const categories = ['Visibilidade', 'Engajamento', 'Oportunidades'];
      const totals = {};
      rows.forEach(function (row) {
        const category = row.category || 'Oportunidades';
        totals[category] = totals[category] || {};
        totals[category][row.label] = (totals[category][row.label] || 0) + (Number(row.value) || 0);
      });
      const months = Array.from(new Set(allRows.map(function (row) { return row.month; }).filter(Boolean)))
        .sort().reverse();
      const comparisonMetric = marketingInsightsFilters.metric ||
        (allRows.find(function (row) { return row.metric === 'reach'; }) || allRows[0] || {}).metric || '';
      const firstMonth = marketingComparisonMonths.primary || months[0] || '';
      const secondMonth = marketingComparisonMonths.secondary || months[1] || '';
      const monthTotal = function (month) {
        return allRows.filter(function (row) {
          return row.month === month && row.metric === comparisonMetric &&
            (!marketingInsightsFilters.channel || row.channel === marketingInsightsFilters.channel) &&
            (!marketingInsightsFilters.campaign || row.campaign === marketingInsightsFilters.campaign);
        }).reduce(function (sum, row) { return sum + (Number(row.value) || 0); }, 0);
      };
      const firstTotal = monthTotal(firstMonth);
      const secondTotal = monthTotal(secondMonth);
      const change = secondTotal ? ((firstTotal - secondTotal) * 100 / secondTotal) : null;
      const reportList = marketingInsightRecords().slice().sort(function (first, second) {
        return String(second.data && second.data.importedAt || second.createdAt || '')
          .localeCompare(String(first.data && first.data.importedAt || first.createdAt || ''));
      }).slice(0, 8);
      const currentUserId = authenticatedUserId || getCurrentProfile(dashboardState).id;
      const toolbar = '<div class="dashboard-business-toolbar marketing-insights-toolbar">' +
        '<label><span>' + iconMarkup('activity') + '</span><input type="search" data-business-search value="' + escapeHtml(businessSearch) +
        '" placeholder="Buscar relatórios, campanhas ou métricas"></label>' +
        '<label class="dashboard-business-filter"><span>Canal</span><select data-marketing-insight-filter="channel">' +
        marketingInsightOptions(allRows, 'channel', marketingInsightsFilters.channel) + '</select></label>' +
        '<label class="dashboard-business-filter"><span>Campanha</span><select data-marketing-insight-filter="campaign">' +
        marketingInsightOptions(allRows, 'campaign', marketingInsightsFilters.campaign) + '</select></label>' +
        '<label class="dashboard-business-filter"><span>Métrica</span><select data-marketing-insight-filter="metric"><option value="">Todas</option>' +
        Array.from(new Map(allRows.map(function (row) { return [row.metric, row.label]; })).entries()).map(function (entry) {
          return '<option value="' + escapeHtml(entry[0]) + '"' + (marketingInsightsFilters.metric === entry[0] ? ' selected' : '') + '>' +
            escapeHtml(entry[1]) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="dashboard-business-filter"><span>De</span><input type="month" data-marketing-insight-filter="from" value="' +
        escapeHtml(marketingInsightsFilters.from) + '"></label>' +
        '<label class="dashboard-business-filter"><span>Até</span><input type="month" data-marketing-insight-filter="to" value="' +
        escapeHtml(marketingInsightsFilters.to) + '"></label>' +
        '<button type="button" class="btn secondary" data-marketing-pdf>Exportar relatório PDF</button></div>';
      const categoryPanels = categories.map(function (category) {
        const items = Object.keys(totals[category] || {}).map(function (label) {
          return { label: label, value: totals[category][label] };
        }).sort(function (first, second) { return second.value - first.value; });
        const maximum = Math.max.apply(null, items.map(function (item) { return item.value; }).concat([1]));
        return '<section class="marketing-insight-category"><h3>' + escapeHtml(category) + '</h3>' +
          (items.length ? items.map(function (item) {
            return '<div class="marketing-insight-bar"><div><b>' + escapeHtml(item.label) + '</b><strong>' +
              escapeHtml(Number(item.value).toLocaleString('pt-BR')) + '</strong></div><span><i style="width:' +
              Math.max(2, Math.round(item.value * 100 / maximum)) + '%"></i></span></div>';
          }).join('') : '<p class="marketing-insights-empty">Sem dados para os filtros atuais.</p>') + '</section>';
      }).join('');
      const breakdownMetric = rows.find(function (row) { return row.metric === comparisonMetric; }) ||
        rows[0] || null;
      function breakdownMarkup(field, heading) {
        const grouped = {};
        if (breakdownMetric) {
          rows.filter(function (row) { return row.metric === breakdownMetric.metric; }).forEach(function (row) {
            const label = String(row[field] || '').trim() || 'Sem informação';
            grouped[label] = (grouped[label] || 0) + (Number(row.value) || 0);
          });
        }
        const items = Object.keys(grouped).map(function (label) { return { label: label, value: grouped[label] }; })
          .sort(function (first, second) { return second.value - first.value; });
        const maximum = Math.max.apply(null, items.map(function (item) { return item.value; }).concat([1]));
        return '<section class="marketing-insight-breakdown"><h3>' + heading + '</h3><small>' +
          escapeHtml(breakdownMetric ? 'Métrica: ' + breakdownMetric.label : 'Selecione uma métrica com estes dados.') + '</small>' +
          (items.length ? items.slice(0, 10).map(function (item) {
            return '<div class="marketing-insight-bar"><div><b>' + escapeHtml(item.label) + '</b><strong>' +
              escapeHtml(Number(item.value).toLocaleString('pt-BR')) + '</strong></div><span><i style="width:' +
              Math.max(2, Math.round(item.value * 100 / maximum)) + '%"></i></span></div>';
          }).join('') : '<p class="marketing-insights-empty">Sem dados para os filtros atuais.</p>') + '</section>';
      }
      const breakdowns = '<div class="marketing-insight-breakdowns">' +
        breakdownMarkup('channel', 'Desempenho das redes sociais') +
        breakdownMarkup('campaign', 'Desempenho das campanhas') + '</div>';
      function comparisonOptions(selected) {
        return '<option value="">Selecione o mês</option>' + months.map(function (month) {
          const label = marketingMonthLabel(month);
          return '<option value="' + escapeHtml(month) + '"' + (month === selected ? ' selected' : '') + '>' +
            escapeHtml(label) + '</option>';
        }).join('');
      }
      const comparison = '<section class="marketing-insight-comparison"><div><h3>Comparativo entre meses</h3>' +
        '<label>Métrica<select data-marketing-compare-metric>' +
        Array.from(new Map(allRows.map(function (row) { return [row.metric, row.label]; })).entries()).map(function (entry) {
          return '<option value="' + escapeHtml(entry[0]) + '"' + (comparisonMetric === entry[0] ? ' selected' : '') + '>' +
            escapeHtml(entry[1]) + '</option>';
        }).join('') + '</select></label>' +
        '<label>Mês atual<select data-marketing-compare="primary">' + comparisonOptions(firstMonth) + '</select></label>' +
        '<label>Mês anterior<select data-marketing-compare="secondary">' + comparisonOptions(secondMonth) + '</select></label></div>' +
        '<article><span>' + escapeHtml(firstMonth ? marketingMonthLabel(firstMonth) : 'Mês atual') +
        '</span><b>' + escapeHtml(firstTotal.toLocaleString('pt-BR')) + '</b></article>' +
        '<article><span>' + escapeHtml(secondMonth ? marketingMonthLabel(secondMonth) : 'Mês anterior') +
        '</span><b>' + escapeHtml(secondTotal.toLocaleString('pt-BR')) + '</b></article>' +
        '<article><span>Variação</span><b>' + (change === null ? '—' : (change > 0 ? '+' : '') + change.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%') + '</b></article></section>';
      const recent = '<section class="marketing-insight-reports"><h3>Relatórios recentes</h3>' +
        (reportList.length ? reportList.map(function (report) {
          const data = report.data || {};
          const canArchive = String(report.createdBy || '') === String(currentUserId || '') || isBusinessCardManager(dashboardState);
          return '<article><div><b>' + escapeHtml(report.title) + '</b><small>' +
            escapeHtml((data.metrics || []).length + ' métricas · ' + (data.source || 'Relatório importado') + ' · ' +
              dateLabel(data.importedAt || report.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })) +
            '</small></div>' + (data.documentId ? '<button type="button" data-marketing-open-document="' +
              escapeHtml(data.documentId) + '">Abrir arquivo</button><button type="button" data-marketing-download-document="' +
              escapeHtml(data.documentId) + '">Baixar</button>' : '') +
            (canArchive ? '<button type="button" data-business-archive="' + escapeHtml(report.id) + '">Arquivar</button>' : '') + '</article>';
        }).join('') : '<p class="marketing-insights-empty">Envie um relatório para começar a acompanhar os resultados.</p>') + '</section>';
      return toolbar + '<form class="marketing-report-upload" data-marketing-report-upload>' +
        '<label><span>Arquivo de relatório</span><input type="file" name="reportFile" accept=".csv,.xls,.xlsx,.pdf,image/png,image/jpeg,image/webp,image/bmp,image/tiff" required></label>' +
        '<label><span>Mês do relatório, quando não estiver no arquivo</span><input type="month" name="reportMonth" value="' +
        new Date().toISOString().slice(0, 7) + '" required></label><button type="submit" class="btn"' +
        (dashboardState.businessCardRecordsLoadError || !window.RildonXMarketingReportImport
          ? ' disabled title="Aguarde o carregamento dos dados e do leitor de relatórios"' : '') + '>Importar relatório</button>' +
        '<small>CSV, Excel, PDF ou imagem. Os dados são interpretados localmente no navegador e os arquivos ficam em Documentos.</small></form>' +
        '<div class="marketing-insight-categories">' + categoryPanels + '</div>' + breakdowns + comparison + recent +
        '<section class="marketing-insight-data"><h3>Dados usados no relatório</h3>' +
        (rows.length ? '<div class="marketing-insight-table-wrap"><table><thead><tr><th>Mês</th><th>Métrica</th><th>Valor</th><th>Canal</th><th>Campanha</th><th>Arquivo</th></tr></thead><tbody>' +
          rows.map(function (row) {
            return '<tr><td>' + escapeHtml(row.month) + '</td><td>' + escapeHtml(row.label) + '</td><td>' +
              escapeHtml(Number(row.value).toLocaleString('pt-BR')) + '</td><td>' + escapeHtml(row.channel || '—') + '</td><td>' +
              escapeHtml(row.campaign || '—') + '</td><td>' + escapeHtml(row.reportTitle) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="marketing-insights-empty">Nenhum dado corresponde aos filtros atuais.</p>') +
        '</section>';
    }

    function marketingMaterialRecords() {
      return (dashboardState.businessCardRecords || []).filter(function (record) {
        return record && record.moduleKey === 'marketing-materials' && !record.archived;
      });
    }

    function marketingMaterialsMarkup() {
      const query = String(businessSearch || '').trim().toLocaleLowerCase('pt-BR');
      const metadata = marketingMaterialRecords();
      const linkedDocumentIds = new Set(metadata.map(function (record) { return String(record.data && record.data.documentId || ''); }));
      const files = documentList(dashboardState).filter(function (file) {
        const folder = String(file.folder || '').toLocaleLowerCase('pt-BR');
        return folder === 'marketing - branding' || linkedDocumentIds.has(String(file.id));
      });
      const items = files.map(function (file) {
        return { file: file, record: metadata.find(function (record) {
          return String(record.data && record.data.documentId || '') === String(file.id);
        }) || null };
      }).filter(function (item) {
        const data = item.record && item.record.data || {};
        return !query || [item.file.name, item.file.folder, data.category, data.section, data.tags, data.notes]
          .join(' ').toLocaleLowerCase('pt-BR').includes(query);
      }).filter(function (item) {
        const record = item.record;
        if (marketingMaterialsView === 'favorites') return Boolean(record && record.data && record.data.isFavorite);
        if (marketingMaterialsView === 'identity') return record && record.data
          ? record.data.section === 'Identidade visual' || record.data.category === 'Identidade visual' || record.data.category === 'Logo'
          : /logo|marca|identidade/i.test(item.file.name);
        return true;
      }).sort(function (first, second) {
        return String(second.file.sentAt || '').localeCompare(String(first.file.sentAt || ''));
      });
      const tabs = [
        ['materials', 'Banco de materiais'],
        ['identity', 'Identidade visual'],
        ['favorites', 'Arquivos favoritos']
      ];
      return '<div class="dashboard-business-toolbar marketing-materials-toolbar"><label><span>' + iconMarkup('activity') +
        '</span><input type="search" data-business-search value="' + escapeHtml(businessSearch) + '" placeholder="Buscar materiais, formatos ou nomes"></label>' +
        '<div class="marketing-content-view-switch" role="group" aria-label="Categoria dos materiais">' +
        tabs.map(function (tab) {
          return '<button type="button" data-marketing-material-view="' + tab[0] + '"' +
            (marketingMaterialsView === tab[0] ? ' class="is-active"' : '') + '>' + tab[1] + '</button>';
        }).join('') + '</div></div>' +
        '<form class="marketing-material-upload" data-marketing-material-upload>' +
        '<label><span>Adicionar arquivo à Central</span><input type="file" name="materialFile" required></label>' +
        '<label><span>Categoria</span><select name="category"><option>Logo</option><option>Identidade visual</option><option>Imagem</option><option>Vídeo</option><option>Apresentação</option><option>Documento</option><option>Outro</option></select></label>' +
        '<label><span>Seção</span><select name="section"><option>Banco de materiais</option><option>Identidade visual</option></select></label>' +
        '<label><span>Tags</span><input type="text" name="tags" placeholder="campanha, produto, marca"></label>' +
        '<label><span>Observações</span><input type="text" name="notes" placeholder="Uso recomendado, versão aprovada"></label>' +
        '<button type="submit" class="btn"' + (dashboardState.businessCardRecordsLoadError ? ' disabled title="Aguarde a conexão dos dados compartilhados"' : '') +
        '>Enviar material</button><small>O arquivo é salvo uma única vez na infraestrutura de Documentos e referenciado nesta Central.</small></form>' +
        '<div class="marketing-material-grid">' + (items.length ? items.map(function (item) {
          const record = item.record;
          const data = record && record.data || {};
          return '<article class="marketing-material-card"><div class="marketing-material-icon">' + iconMarkup('doc') + '</div>' +
            '<div><h3>' + escapeHtml(item.file.name) + '</h3><p>' + escapeHtml([data.category, data.section, data.tags].filter(Boolean).join(' · ') || item.file.folder) +
            '</p><small>' + escapeHtml(item.file.sizeLabel || '') + ' · ' +
            escapeHtml(dateLabel(item.file.sentAt, { day: '2-digit', month: 'short', year: 'numeric' })) + '</small></div>' +
            (record ? '<button type="button" class="marketing-material-favorite" data-marketing-material-favorite="' +
              escapeHtml(record.id) + '" aria-pressed="' + Boolean(data.isFavorite) + '">' + (data.isFavorite ? '★ Favorito' : '☆ Favoritar') + '</button>' : '') +
            '<button type="button" data-marketing-open-document="' + escapeHtml(item.file.id) + '">Abrir</button>' +
            '<button type="button" data-marketing-download-document="' + escapeHtml(item.file.id) + '">Baixar</button></article>';
        }).join('') : '<div class="dashboard-business-empty"><b>Nenhum arquivo nesta seção</b><small>Envie um material acima ou ajuste a busca.</small></div>') + '</div>';
    }

    function renderMarketingSpecialModule(module) {
      const content = module.id === 'marketing-insights' ? marketingInsightsMarkup() : marketingMaterialsMarkup();
      const accessWarning = dashboardState.businessCardRecordsLoadError
        ? '<div class="dashboard-business-warning">' + escapeHtml(dashboardState.businessCardRecordsLoadError) + '</div>'
        : '';
      businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--marketing" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
        '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' +
        iconMarkup(module.icon) + '</div><div><span class="dashboard-library-eyebrow">Marketing · Arquivos e dados compartilhados</span>' +
        '<h2 id="dashboard-business-title">' + escapeHtml(module.title) + '</h2><p>' + escapeHtml(module.description) +
        '</p></div><div class="dashboard-business-header-actions">' +
        (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
        '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
        accessWarning + content + '</div>';
    }

    function refreshMarketingSpecialModule(moduleId, preserveSearchFocus) {
      const currentSearch = businessRoot.querySelector('[data-business-search]');
      const selectionStart = currentSearch && typeof currentSearch.selectionStart === 'number' ? currentSearch.selectionStart : null;
      renderBusinessModule(moduleId);
      if (preserveSearchFocus) {
        const nextSearch = businessRoot.querySelector('[data-business-search]');
        if (nextSearch) {
          nextSearch.focus();
          if (selectionStart !== null) nextSearch.setSelectionRange(selectionStart, selectionStart);
        }
      }
    }

    async function saveMarketingReportUpload(form) {
      if (dashboardState.businessCardRecordsLoadError) throw new Error(dashboardState.businessCardRecordsLoadError);
      const formData = new FormData(form);
      const file = formData.get('reportFile');
      if (!(file instanceof File) || !file.size) throw new Error('Selecione um arquivo de relatório.');
      if (!window.RildonXMarketingReportImport) {
        throw new Error('O leitor de relatórios não foi carregado. Atualize a página e tente novamente.');
      }
      const parsed = await window.RildonXMarketingReportImport.read(file);
      const metrics = window.RildonXMarketingReportImport.normalize(parsed, formData.get('reportMonth'));
      const profile = getCurrentProfile(dashboardState);
      if (!window.RildonXDocumentUpload || !window.RildonXStore) {
        throw new Error('O armazenamento de arquivos não está disponível. Recarregue Meu Espaço.');
      }
      const uploaded = await window.RildonXDocumentUpload.upload(file, {
        folder: 'Marketing - Indicadores',
        senderName: profile.displayName || profile.nickname || profile.name || authenticatedUserName || 'Usuário',
        viewerIds: businessAttachmentViewers(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-insights'; }), dashboardState)
      });
      if (!uploaded || !uploaded.id) throw new Error('O serviço não confirmou o arquivo enviado.');
      const extension = String(file.name).split('.').pop().toUpperCase();
      let saved;
      try {
        saved = window.RildonXStore.addBusinessCardRecord({
          moduleKey: 'marketing-insights',
          sector: 'marketing',
          title: file.name,
          status: 'Importado',
          createdBy: authenticatedUserId || profile.id,
          data: {
            metrics: metrics,
            documentId: uploaded.id,
            fileName: file.name,
            fileType: extension,
            source: 'Relatório ' + extension,
            importedAt: new Date().toISOString()
          }
        });
        if (!saved) throw new Error('O relatório não pôde ser salvo.');
      } catch (error) {
        try {
          await window.RildonXDocumentUpload.removeDocument(uploaded);
        } catch (cleanupError) {
          console.error('Não foi possível remover o arquivo enviado sem relatório associado:', cleanupError);
        }
        throw error;
      }
      if (!saved) throw new Error('O arquivo foi enviado, mas o relatório não pôde ser salvo.');
      window.RildonXStore.addDocument(uploaded);
      businessSearch = '';
      marketingInsightsFilters = { channel: '', campaign: '', metric: '', from: '', to: '' };
      marketingComparisonMonths = { primary: '', secondary: '' };
      renderBusinessModule('marketing-insights');
      if (typeof window.showToast === 'function') window.showToast('Relatório importado. ' + metrics.length + ' valor(es) reconhecido(s).');
    }

    async function saveMarketingMaterialUpload(form) {
      if (dashboardState.businessCardRecordsLoadError) throw new Error(dashboardState.businessCardRecordsLoadError);
      const formData = new FormData(form);
      const file = formData.get('materialFile');
      if (!(file instanceof File) || !file.size) throw new Error('Selecione um arquivo para adicionar à Central.');
      if (!window.RildonXDocumentUpload || !window.RildonXStore) {
        throw new Error('O armazenamento de arquivos não está disponível. Recarregue Meu Espaço.');
      }
      const profile = getCurrentProfile(dashboardState);
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-materials'; });
      const uploaded = await window.RildonXDocumentUpload.upload(file, {
        folder: 'Marketing - Branding',
        senderName: profile.displayName || profile.nickname || profile.name || authenticatedUserName || 'Usuário',
        viewerIds: businessAttachmentViewers(module, dashboardState)
      });
      if (!uploaded || !uploaded.id) throw new Error('O serviço não confirmou o arquivo enviado.');
      let saved;
      try {
        saved = window.RildonXStore.addBusinessCardRecord({
          moduleKey: 'marketing-materials',
          sector: 'marketing',
          title: file.name,
          status: 'Disponível',
          createdBy: authenticatedUserId || profile.id,
          data: {
            documentId: uploaded.id,
            category: String(formData.get('category') || 'Outro'),
            section: String(formData.get('section') || 'Banco de materiais'),
            tags: String(formData.get('tags') || '').trim(),
            notes: String(formData.get('notes') || '').trim(),
            isFavorite: false
          }
        });
        if (!saved) throw new Error('O material não pôde ser cadastrado.');
      } catch (error) {
        try {
          await window.RildonXDocumentUpload.removeDocument(uploaded);
        } catch (cleanupError) {
          console.error('Não foi possível remover o arquivo enviado sem material associado:', cleanupError);
        }
        throw error;
      }
      if (!saved) throw new Error('O arquivo foi enviado, mas o material não pôde ser cadastrado.');
      window.RildonXStore.addDocument(uploaded);
      businessSearch = '';
      renderBusinessModule('marketing-materials');
      if (typeof window.showToast === 'function') window.showToast('Material adicionado à Central de Branding.');
    }

    function openMarketingDocument(documentId, download) {
      const file = (dashboardState.documents || []).find(function (item) { return String(item.id) === String(documentId); });
      if (!file || !window.RildonXDocumentUpload || typeof window.RildonXDocumentUpload.getViewUrl !== 'function') {
        if (typeof window.showToast === 'function') window.showToast('Este arquivo não está disponível na lista de Documentos.');
        return;
      }
      const openedWindow = window.open('about:blank', '_blank');
      if (!openedWindow) {
        if (typeof window.showToast === 'function') window.showToast('Permita pop-ups para abrir o arquivo.');
        return;
      }
      openedWindow.opener = null;
      window.RildonXDocumentUpload.getViewUrl(file, download ? { downloadName: file.name } : undefined).then(function (url) {
        if (!url) throw new Error('Não foi possível gerar um link seguro para este arquivo.');
        openedWindow.location.href = url;
      }).catch(function (error) {
        console.error('Não foi possível abrir o arquivo de Marketing:', error);
        openedWindow.close();
        if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível abrir o arquivo.');
      });
    }

    function marketingContentHealthMarkup(records) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekKey = [nextWeek.getFullYear(), String(nextWeek.getMonth() + 1).padStart(2, '0'), String(nextWeek.getDate()).padStart(2, '0')].join('-');
      const active = records.filter(function (record) { return record.status !== 'Arquivo'; });
      const late = active.filter(function (record) {
        return record.data && record.data.publishAt && record.data.publishAt < todayKey && record.status !== 'Publicado';
      }).length;
      const scheduledNextWeek = active.filter(function (record) {
        const date = String(record.data && record.data.publishAt || '');
        return date >= todayKey && date < nextWeekKey &&
          ['Agendado', 'Aprovado'].indexOf(record.status) !== -1;
      }).length;
      const plannedDays = new Set(active.filter(function (record) {
        return record.data && record.data.publishAt && record.data.publishAt >= todayKey;
      }).map(function (record) { return record.data.publishAt; }));
      const conflicts = new Set();
      active.forEach(function (record) {
        const data = record.data || {};
        if (!data.publishAt || !data.channel) return;
        if (active.some(function (other) {
          return String(other.id) !== String(record.id) && other.data &&
            other.data.publishAt === data.publishAt && other.data.channel === data.channel;
        })) conflicts.add(data.publishAt + '|' + data.channel);
      });
      const gapNotice = scheduledNextWeek ? 'Há ' + scheduledNextWeek + ' publicação(ões) planejada(s) nos próximos 7 dias.' :
        'Sem conteúdo aprovado/agendado nos próximos 7 dias.';
      return '<div class="marketing-content-health"><span><b>' + late + '</b>Atrasado(s)</span>' +
        '<span><b>' + conflicts.size + '</b>Conflito(s) de canal/data</span>' +
        '<span><b>' + plannedDays.size + '</b>Data(s) futura(s) planejada(s)</span><span class="marketing-content-gap">' +
        escapeHtml(gapNotice) + '</span></div>';
    }

    function renderMarketingContentBoard(list, search) {
      const records = filteredMarketingContentRecords(search);
      const health = marketingContentHealthMarkup(records);
      if (marketingContentView === 'calendar') {
        list.innerHTML = health + marketingContentCalendarMarkup(records);
        return;
      }
      if (marketingContentView === 'list') {
        list.innerHTML = health + marketingContentListMarkup(records);
        return;
      }
      list.innerHTML = health + '<div class="marketing-content-board">' + MARKETING_CONTENT_STAGES.map(function (stage) {
        const stagedRecords = records.filter(function (record) { return (record.status || 'Banco de ideias') === stage; });
        return '<section class="marketing-content-column" data-marketing-drop="' + escapeHtml(stage) + '"><header><h3>' +
          escapeHtml(stage) + '</h3><span>' + stagedRecords.length + '</span></header><div class="marketing-content-column-cards">' +
          (stagedRecords.length ? stagedRecords.map(marketingContentCardMarkup).join('') :
            '<p class="marketing-content-column-empty">Arraste um conteúdo para esta etapa.</p>') + '</div></section>';
      }).join('') + '</div>';
    }

    function moveMarketingContent(recordId, nextStatus) {
      const record = (dashboardState.businessCardRecords || []).find(function (item) {
        return item && item.id === recordId && item.moduleKey === 'marketing-content-calendar' && !item.archived;
      });
      if (!record || MARKETING_CONTENT_STAGES.indexOf(nextStatus) === -1 || record.status === nextStatus) return;
      if (nextStatus === 'Agendado' && !(record.data && record.data.publishAt)) {
        if (typeof window.showToast === 'function') window.showToast('Defina uma data prevista antes de agendar este conteúdo.');
        return;
      }
      const profile = getCurrentProfile(dashboardState);
      const history = Array.isArray(record.data && record.data.statusHistory)
        ? record.data.statusHistory.slice()
        : [];
      history.push({
        from: record.status || 'Banco de ideias',
        to: nextStatus,
        at: new Date().toISOString(),
        by: profile.displayName || profile.nickname || profile.name || authenticatedUserName || 'Usuário'
      });
      const updated = window.RildonXStore.updateBusinessCardRecord(record.id, {
        status: nextStatus,
        data: Object.assign({}, record.data || {}, { statusHistory: history })
      });
      if (!updated) {
        if (typeof window.showToast === 'function') window.showToast('Não foi possível registrar a mudança de etapa.');
        return;
      }
      syncBusinessCalendarEvents(
        BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }),
        updated,
        updated.data || {}
      ).catch(function (error) {
        console.error('O conteúdo foi movido, mas a sincronização com o calendário falhou:', error);
        if (typeof window.showToast === 'function') window.showToast('Etapa atualizada, mas o calendário não foi sincronizado: ' + (error.message || 'verifique suas permissões.'));
      });
      renderBusinessRecordList(
        BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }),
        businessSearch
      );
    }

    function renderBusinessRecordList(module, search) {
        const list = businessRoot.querySelector('.dashboard-business-record-list');
        if (!list) return;
        if (module.id === 'marketing-content-calendar') {
          renderMarketingContentBoard(list, search);
          return;
        }
        if (module.id === 'hr-training') {
          list.innerHTML = hrTrainingViewMarkup(search);
          return;
        }
      const records = filteredBusinessRecords(module, search);
      if (module.id === 'quality-kaizen') {
        list.innerHTML = qualityKaizenBoard(records);
        return;
      }
      list.innerHTML = records.length
        ? records.map(function (record) { return businessRecordRow(record, module); }).join('')
        : '<div class="dashboard-business-empty"><span>' + iconMarkup(module.icon) + '</span><b>Nenhum registro nesta visualização</b><small>Crie um registro ou ajuste a busca/filtro.</small></div>';
    }

    function businessIntegrationDateFields(module, formFields) {
      return (formFields || []).filter(function (field) { return field.type === 'date'; });
    }

    function businessIntegrationMarkup(module, record, formFields, recordType) {
      if (module.id === 'hr-training' && recordType === 'investment') return '';
      const dateFields = businessIntegrationDateFields(module, formFields);
      const data = record && record.data || {};
      const integrations = data.integrations || {};
      const legacyCalendarModules = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'];
      const calendarDefault = legacyCalendarModules.indexOf(module.id) !== -1;
      const calendarEnabled = typeof integrations.calendar === 'boolean' ? integrations.calendar : calendarDefault;
      const taskEnabled = Boolean(integrations.task);
      return '<fieldset class="dashboard-business-integrations"><legend>Adicionar também a...</legend>' +
        (dateFields.length ? '<label><input type="checkbox" name="integrationCalendar"' + (calendarEnabled ? ' checked' : '') +
          '> Calendário <small>Sincroniza a data do registro no seu calendário.</small></label>' : '') +
        '<label><input type="checkbox" name="integrationTask"' + (taskEnabled ? ' checked' : '') +
          '> Tarefas <small>Cria ou atualiza uma tarefa atribuída a você.</small></label></fieldset>';
    }

    function renderBusinessForm(module, record, requestedRecordType) {
      const isEdit = Boolean(record);
      const recordData = record && record.data || {};
      const recordType = module.id === 'hr-training'
        ? record && recordData.recordType === 'investment' ? 'investment' : requestedRecordType || 'training'
        : '';
      const formFields = module.id === 'hr-training' ? hrTrainingFields(recordType) : module.fields;
      const fields = formFields.map(function (field) {
        let value = field.key === 'title' ? record && record.title || '' :
          field.key === 'status' ? record && record.status || module.defaultStatus || (module.id === 'purchase-quotes' ? 'Solicitado' : '') :
            recordData[field.key] != null ? recordData[field.key] : field.defaultValue;
        if (!record && module.id === 'marketing-internal-demands') {
          const currentProfile = getCurrentProfile(dashboardState);
          if (field.key === 'requester') value = currentProfile.displayName || currentProfile.nickname || currentProfile.name || authenticatedUserName || '';
          if (field.key === 'requesterSector') value = currentProfile.sector || '';
        }
        if (module.id === 'hr-training' && field.key === 'participants') {
          value = trainingRecordParticipants(record).map(trainingParticipantId).filter(Boolean);
        }
        if (!record && module.id === 'quality-5s' && /^seiri|seiton|seiso|seiketsu|shitsuke$/.test(field.key)) value = '0';
        const blockedOptions = module.id === 'purchase-quotes'
          ? ['Aprovado']
          : [];
        return businessFieldMarkup(field, value, blockedOptions);
      }).join('');
      const integrationMarkup = businessIntegrationMarkup(module, record, formFields, recordType);
      const attachmentMarkup = '<label class="dashboard-business-field"><span>Anexar arquivo (máx. 1 por envio)</span>' +
        '<input type="file" name="attachmentFile" data-business-file></label>' + renderBusinessAttachments(record, dashboardState);
      const formTitle = module.id === 'hr-training'
        ? recordType === 'investment' ? 'Investimento em capacitação' : 'Turma de capacitação'
        : module.title;
      businessRoot.innerHTML = '<div class="dashboard-business-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
        '<div class="dashboard-business-header"><button type="button" class="dashboard-business-back" data-business-back>‹ Voltar</button>' +
        '<div><span class="dashboard-library-eyebrow">' + escapeHtml(module.sector) + '</span><h2 id="dashboard-business-title">' +
        (isEdit ? 'Editar' : 'Novo') + ' · ' + escapeHtml(formTitle) + '</h2></div>' +
        '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div>' +
        '<form class="dashboard-business-form" data-business-form data-record-type="' + escapeHtml(recordType) + '" data-record-id="' + escapeHtml(record && record.id || '') + '">' +
        '<div class="dashboard-business-fields">' + fields + attachmentMarkup + integrationMarkup + '</div>' +
        '<div class="dashboard-business-form-actions"><button type="button" class="btn secondary" data-business-back>Cancelar</button>' +
        '<button type="submit" class="btn">' + (isEdit ? 'Salvar alterações' : 'Criar registro') + '</button></div></form></div>';
    }

    function renderEmployeeControlRows(query) {
      const search = String(query || '').trim().toLocaleLowerCase('pt-BR');
      const currentProfile = getCurrentProfile(dashboardState);
      const profiles = (dashboardState.profiles || []).filter(function(profile) {
        return [profile.displayName, profile.nickname, profile.sector, profile.role]
          .some(function(value) { return String(value || '').toLocaleLowerCase('pt-BR').includes(search); });
      }).slice().sort(function(first, second) {
        return String(first.displayName || first.nickname || '').localeCompare(
          String(second.displayName || second.nickname || ''), 'pt-BR'
        );
      });
      return profiles.length ? profiles.map(function(profile) {
        const name = profile.displayName || profile.nickname || 'Usuário';
        const isActive = profile.active !== false;
        const isSelf = String(profile.id) === String(currentProfile.id);
        return '<article class="employee-control-row"><div class="employee-control-identity"><b>' +
          escapeHtml(name) + '</b><span>' + escapeHtml([profile.sector, profile.role].filter(Boolean).join(' • ') || 'Setor ou cargo não informado') +
          '</span></div><div class="employee-control-actions"><button type="button" class="employee-control-toggle' +
          (isActive ? ' is-enabled' : '') + '" data-employee-toggle="' + escapeHtml(profile.id) +
          '" aria-pressed="' + (isActive ? 'true' : 'false') + '" aria-label="' +
          (isActive ? 'Desabilitar ' : 'Habilitar ') + escapeHtml(name) + '"' + (isSelf ? ' disabled title="Não é possível desabilitar sua própria conta"' : '') +
          '><span class="employee-control-switch" aria-hidden="true"></span><span>' +
          (isActive ? 'Habilitado' : 'Desabilitado') + '</span></button><button type="button" class="employee-control-edit" data-employee-edit="' +
          escapeHtml(profile.id) + '" aria-label="Editar perfil de ' + escapeHtml(name) + '" title="Editar perfil">✎</button></div></article>';
      }).join('') : '<div class="dashboard-business-empty"><b>' +
        (search ? 'Nenhum funcionário encontrado' : 'Nenhum usuário cadastrado') + '</b></div>';
    }

    function renderBusinessModule(moduleId) {
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === moduleId; });
      if (!module) return;
      if (!canAccessBusinessCard(module, dashboardState)) {
        businessRoot.innerHTML = '<div class="dashboard-business-panel" role="dialog" aria-modal="true"><div class="dashboard-business-header"><div><span class="dashboard-library-eyebrow">Acesso protegido</span><h2>Card restrito</h2></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div><p class="dashboard-business-restricted">Seu perfil não possui acesso ao setor ' + escapeHtml(module.sector) + '.</p></div>';
        return;
      }
      if (moduleId === 'sales-time-off') {
        const timeOffRoot = document.createElement('div');
        timeOffRoot.className = 'dashboard-business-time-off-root';
        businessRoot.replaceChildren(timeOffRoot);
        if (window.RildonXSalesTimeOff && typeof window.RildonXSalesTimeOff.mount === 'function') {
          window.RildonXSalesTimeOff.mount(businessRoot, dashboardState, isBusinessCardManager(dashboardState), {
            target: timeOffRoot,
            userId: authenticatedUserId,
            fromLibrary: businessOpenedFromLibrary
          });
        } else {
          timeOffRoot.innerHTML = '<div class="dashboard-business-panel"><div class="dashboard-business-warning">' +
            'O módulo Escala de Folga não foi carregado. Atualize a página e tente novamente.</div></div>';
        }
        return;
      }
      const purchaseManagementTabs = {
        'purchase-dashboard': 'overview',
        'purchase-balances': 'budget',
        'purchase-orders': 'order',
        'purchase-evaluations': 'evaluation',
        'purchase-comparison': 'comparison'
      };
      if (moduleId === 'purchase-suppliers' || Object.prototype.hasOwnProperty.call(purchaseManagementTabs, moduleId)) {
        const standalonePurchasePanel = moduleId !== 'purchase-suppliers';
        businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--suppliers" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
          '<div><span class="dashboard-library-eyebrow">' + escapeHtml(module.sector) + (standalonePurchasePanel ? ' · Gestão de Compras' : ' · Cadastros e controle') + '</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
          '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
          '<div class="dashboard-business-supplier-root"></div></div>';
        if (window.RildonXSupplierManagement) {
          window.RildonXSupplierManagement.mount(
            businessRoot.querySelector('.dashboard-business-supplier-root'),
            dashboardState,
            isBusinessCardManager(dashboardState),
            standalonePurchasePanel
              ? { standalone: true, initialTab: purchaseManagementTabs[moduleId] }
              : { tabs: ['supplier', 'buyer', 'audit'], initialTab: 'supplier' }
          );
        } else {
          businessRoot.querySelector('.dashboard-business-supplier-root').innerHTML =
            '<div class="dashboard-business-warning">O módulo de Gestão de Compras não foi carregado. Atualize a página e tente novamente.</div>';
        }
        return;
      }
      if (moduleId === 'hr-medical-exams') {
        businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--medical-exams" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
          '<div><span class="dashboard-library-eyebrow">' + escapeHtml(module.sector) + ' · Dados restritos ao RH</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
          '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
          '<div class="dashboard-medical-exams-root"></div></div>';
        if (window.RildonXHRMedicalExams) {
          window.RildonXHRMedicalExams.mount(
            businessRoot.querySelector('.dashboard-medical-exams-root'),
            dashboardState,
            canManagePeopleProfiles(dashboardState)
          );
        } else {
          businessRoot.querySelector('.dashboard-medical-exams-root').innerHTML =
            '<div class="dashboard-business-warning">O módulo de agendamento de exames não foi carregado. Atualize a página e tente novamente.</div>';
        }
        return;
      }
      if (moduleId === 'hr-recruitment') {
        businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--hr-recruitment" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
          '<div><span class="dashboard-library-eyebrow">RH/DP · Dados confidenciais</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
          '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
          '<div class="dashboard-hr-recruitment-root"></div></div>';
        if (window.RildonXHRRecruitment) {
          const profile = getCurrentProfile(dashboardState);
          window.RildonXHRRecruitment.mount(
            businessRoot.querySelector('.dashboard-hr-recruitment-root'),
            dashboardState,
            { userName: profile.displayName || profile.nickname || profile.name || authenticatedUserName || 'Usuário' }
          );
        } else {
          businessRoot.querySelector('.dashboard-hr-recruitment-root').innerHTML =
            '<div class="dashboard-business-warning">O módulo de Recrutamento e Seleção não foi carregado. Atualize a página e tente novamente.</div>';
        }
        return;
      }
      if (moduleId === 'quality-documents') {
        businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--quality-documents" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
          '<div><span class="dashboard-library-eyebrow">' + escapeHtml(module.sector) + ' · Documentos internos</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
          '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
          '<div class="dashboard-quality-documents-root"></div></div>';
        if (window.RildonXQualityDocuments) {
          window.RildonXQualityDocuments.mount(
            businessRoot.querySelector('.dashboard-quality-documents-root'),
            dashboardState,
            canAccessBusinessCard(module, dashboardState)
          );
        } else {
          businessRoot.querySelector('.dashboard-quality-documents-root').innerHTML =
            '<div class="dashboard-business-warning">O módulo de Gestão de Documentos não foi carregado. Atualize a página e tente novamente.</div>';
        }
        return;
      }
      if (moduleId === 'purchase-parts-requests' || moduleId === 'sales-product-signals') {
        const buyerPanel = moduleId === 'purchase-parts-requests';
        businessRoot.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--purchase-parts" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
          '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
          '<div><span class="dashboard-library-eyebrow">' + (buyerPanel ? 'Compras · Sinalizações recebidas' : 'Comercial · Acompanhamento de sinalizações') + '</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
          '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
          (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
          '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
          '<div class="dashboard-purchase-parts-root"></div></div>';
        if (window.RildonXPurchasePartsRequests) {
          const profile = getCurrentProfile(dashboardState);
          window.RildonXPurchasePartsRequests.mount(
            businessRoot.querySelector('.dashboard-purchase-parts-root'),
            dashboardState,
            {
              isBuyer: buyerPanel,
              userName: profile.displayName || profile.nickname || profile.name || authenticatedUserName || 'Usuário'
            }
          );
        } else {
          businessRoot.querySelector('.dashboard-purchase-parts-root').innerHTML =
            '<div class="dashboard-business-warning">O módulo de solicitação de peças não foi carregado. Atualize a página e tente novamente.</div>';
        }
        return;
      }
      const card = { type: module.id, filters: clone(CARD_CATALOG[module.id].defaults) };
      const summary = businessCardData(card, dashboardState);
      const readOnly = Boolean(module.source);
      const sourceRows = readOnly ? summary.items.map(function (item) {
        return '<a class="dashboard-business-source-row" href="' + escapeHtml(item.href || '#') + '"><span>' + iconMarkup(module.icon) +
          '</span><div><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.meta || '') + '</small></div><i>›</i></a>';
      }).join('') : '';
      const accessError = dashboardState.businessCardRecordsLoadError
        ? '<div class="dashboard-business-warning">' + escapeHtml(dashboardState.businessCardRecordsLoadError) +
          (/migra/i.test(dashboardState.businessCardRecordsLoadError) ? ' SQL: docs/supabase-business-cards.sql.' : '') + '</div>'
        : '';
      const filterField = businessFilterField(module);
      const filterOptions = filterField
        ? '<label class="dashboard-business-filter"><span>Filtrar ' + escapeHtml(filterField.label.toLocaleLowerCase('pt-BR')) + '</span><select data-business-filter aria-label="Filtrar por ' +
          escapeHtml(filterField.label) + '"><option value="">Todos</option><option value="__favorites"' + (businessFilterValue === '__favorites' ? ' selected' : '') +
          '>Favoritos</option>' + (filterField.options || []).map(function (option) {
            return '<option value="' + escapeHtml(option) + '"' + (businessFilterValue === option ? ' selected' : '') + '>' + escapeHtml(option) + '</option>';
          }).join('') + (module.id === 'purchase-quotes'
            ? ['pending', 'approved', 'rejected', 'cancelled'].map(function (status) {
              return '<option value="__approval_' + status + '"' + (businessFilterValue === '__approval_' + status ? ' selected' : '') + '>' +
                escapeHtml(businessApprovalLabel(status)) + '</option>';
            }).join('')
            : '') + '</select></label>'
        : '<label class="dashboard-business-filter"><span>Exibição</span><select data-business-filter aria-label="Filtrar registros"><option value="">Todos</option><option value="__favorites"' +
          (businessFilterValue === '__favorites' ? ' selected' : '') + '>Favoritos</option></select></label>';
      const marketingRecords = (dashboardState.businessCardRecords || []).filter(function (record) {
        return record && record.moduleKey === 'marketing-content-calendar' && !record.archived;
      });
      function marketingFilterOptions(key, label) {
        const options = Array.from(new Set(marketingRecords.map(function (record) {
          return String(record.data && record.data[key] || '').trim();
        }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
        return '<label class="dashboard-business-filter"><span>' + label + '</span><select data-marketing-filter="' + key + '">' +
          '<option value="">Todos</option>' + options.map(function (option) {
            return '<option value="' + escapeHtml(option) + '"' +
              (marketingContentFilters[key] === option ? ' selected' : '') + '>' + escapeHtml(option) + '</option>';
          }).join('') + '</select></label>';
      }
      const marketingStatusOptions = '<label class="dashboard-business-filter"><span>Status</span><select data-marketing-filter="status"><option value="">Todas</option>' +
        MARKETING_CONTENT_STAGES.map(function (status) {
          return '<option value="' + escapeHtml(status) + '"' +
            (marketingContentFilters.status === status ? ' selected' : '') + '>' + escapeHtml(status) + '</option>';
        }).join('') + '</select></label>';
      const marketingToolbar = '<div class="dashboard-business-toolbar marketing-content-toolbar"><label><span>' + iconMarkup('activity') +
        '</span><input type="search" data-business-search value="' + escapeHtml(businessSearch) + '" placeholder="Buscar conteúdos, campanhas ou referências"></label>' +
        marketingFilterOptions('channel', 'Canal') + marketingFilterOptions('campaign', 'Campanha') +
        marketingFilterOptions('owner', 'Responsável') + marketingFilterOptions('format', 'Formato') +
        marketingFilterOptions('theme', 'Tema') + marketingStatusOptions +
        '<label class="dashboard-business-filter"><span>De</span><input type="date" data-marketing-date="from" value="' + escapeHtml(marketingContentFilters.from) + '"></label>' +
        '<label class="dashboard-business-filter"><span>Até</span><input type="date" data-marketing-date="to" value="' + escapeHtml(marketingContentFilters.to) + '"></label>' +
        '<div class="marketing-content-view-switch" role="group" aria-label="Visualização">' +
        ['kanban', 'calendar', 'list'].map(function (view) {
          const label = { kanban: 'Kanban', calendar: 'Calendário', list: 'Lista' }[view];
          return '<button type="button" data-marketing-view="' + view + '" class="' +
            (marketingContentView === view ? 'is-active' : '') + '">' + label + '</button>';
        }).join('') + '</div>' +
        '<label class="dashboard-business-archived"><input type="checkbox" data-business-archived' + (includeArchived ? ' checked' : '') + '> Mostrar arquivados</label>' +
        '<button type="button" class="btn secondary" data-business-export>Exportar CSV</button>' +
        '<button type="button" class="btn" data-business-create' + (dashboardState.businessCardRecordsLoadError ? ' disabled title="Aplique a migração Supabase para habilitar gravação compartilhada"' : '') +
        '>+ Novo conteúdo</button></div>';
      businessRoot.innerHTML = '<div class="dashboard-business-panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
        '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="' + escapeHtml(module.tone) + '">' + iconMarkup(module.icon) + '</div>' +
        '<div><span class="dashboard-library-eyebrow">' + escapeHtml(module.sector) + ' · Módulo compartilhado</span><h2 id="dashboard-business-title">' + escapeHtml(module.title) +
        '</h2><p>' + escapeHtml(module.description) + '</p></div><div class="dashboard-business-header-actions">' +
        (businessOpenedFromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
        '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
        accessError + (moduleId === 'marketing-internal-demands'
          ? internalDemandDashboardMarkup()
          : moduleId === 'hr-employee-control' ? '' : renderBusinessMetrics(summary)) +
        (moduleId === 'hr-employee-control'
          ? '<div class="dashboard-business-toolbar employee-control-toolbar"><input type="search" data-employee-search placeholder="Buscar por nome, setor ou cargo" aria-label="Buscar funcionários">' +
            '<button type="button" class="btn" data-people-create-user>Cadastrar Usuário</button></div>' +
            '<div class="employee-control-list" data-employee-list>' + renderEmployeeControlRows('') + '</div>'
          : readOnly
          ? '<div class="dashboard-business-toolbar"><button type="button" class="btn secondary" data-business-export>Exportar CSV</button></div>' +
            '<div class="dashboard-business-record-list">' + (sourceRows || '<div class="dashboard-business-empty"><b>Sem dados disponíveis</b><small>Os itens aparecem quando há dados cadastrados nas páginas conectadas.</small></div>') + '</div>'
          : module.id === 'hr-training'
            ? '<div class="dashboard-business-toolbar"><label><span>' + iconMarkup('activity') + '</span><input type="search" data-business-search value="' +
              escapeHtml(businessSearch) + '" placeholder="Buscar capacitações, funcionários ou investimentos"></label>' +
              '<label class="dashboard-business-archived"><input type="checkbox" data-business-archived' + (includeArchived ? ' checked' : '') + '> Mostrar arquivados</label>' +
              '<button type="button" class="btn secondary" data-business-export>Exportar CSV</button>' +
              '<button type="button" class="btn secondary" data-hr-training-create="investment"' +
              (dashboardState.businessCardRecordsLoadError ? ' disabled title="Aplique a migração Supabase para habilitar gravação compartilhada"' : '') +
              '>+ Investimento</button><button type="button" class="btn" data-hr-training-create="training"' +
              (dashboardState.businessCardRecordsLoadError ? ' disabled title="Aplique a migração Supabase para habilitar gravação compartilhada"' : '') +
              '>+ Nova turma</button></div>' + hrTrainingNavigationMarkup() + '<div class="dashboard-business-record-list"></div>'
          : module.id === 'marketing-content-calendar'
            ? marketingToolbar + '<div class="dashboard-business-record-list"></div>'
          : '<div class="dashboard-business-toolbar"><label><span>' + iconMarkup('activity') + '</span><input type="search" data-business-search value="' + escapeHtml(businessSearch) + '" placeholder="Buscar registros"></label>' +
            filterOptions +
            '<label class="dashboard-business-archived"><input type="checkbox" data-business-archived' + (includeArchived ? ' checked' : '') + '> Mostrar arquivados</label>' +
            '<button type="button" class="btn secondary" data-business-export>Exportar CSV</button>' +
            '<button type="button" class="btn" data-business-create' + (dashboardState.businessCardRecordsLoadError ? ' disabled title="Aplique a migração Supabase para habilitar gravação compartilhada"' : '') + '>' +
            (module.id === 'marketing-internal-demands' ? '+ Nova demanda' : '+ Novo registro') + '</button></div>' +
            (module.id === 'quality-risks' ? qualityRiskMatrixMarkup() : '') +
            (module.id === 'quality-5s' ? quality5sSummaryMarkup() : '') +
            (module.id === 'quality-indicators' ? qualityIndicatorChartMarkup() : '') +
            '<div class="dashboard-business-record-list"></div>') +
        '</div>';
      if (!readOnly) {
        renderBusinessRecordList(module, businessSearch);
      } else if (module.source === 'projects') {
        const link = '<a class="dashboard-business-source-action" href="projetos.html">Gerenciar projetos</a>';
        businessRoot.querySelector('.dashboard-business-record-list').insertAdjacentHTML('beforeend', link);
      } else if (module.source === 'overview') {
        const link = '<a class="dashboard-business-source-action" href="tarefas.html">Ver tarefas e indicadores</a>';
        businessRoot.querySelector('.dashboard-business-record-list').insertAdjacentHTML('beforeend', link);
      }
    }

    function openBusinessModule(moduleId, recordId, fromLibrary) {
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === moduleId; });
      if (!module) return;
      businessOpenedFromLibrary = Boolean(fromLibrary);
      if (moduleId === 'it-support-tickets' && window.RildonXSupport &&
          typeof window.RildonXSupport.open === 'function') {
        window.RildonXSupport.open({ fromLibrary: businessOpenedFromLibrary });
        return;
      }
      if (moduleId === 'it-infrastructure' && window.RildonXInfrastructure &&
          typeof window.RildonXInfrastructure.open === 'function') {
        if (!canAccessBusinessCard(module, dashboardState)) {
          if (typeof window.showToast === 'function') window.showToast('Este painel é restrito ao setor ' + module.sector + '.');
          return;
        }
        if (moduleId === 'marketing-insights' || moduleId === 'marketing-materials') {
          renderMarketingSpecialModule(module);
          return;
        }
        window.RildonXInfrastructure.open({ assetId: recordId || '', fromLibrary: businessOpenedFromLibrary }).catch(function (error) {
          console.error('Não foi possível abrir o painel de Infraestrutura:', error);
          if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível abrir o painel de Infraestrutura.');
        });
        return;
      }
      if (!businessRoot) return;
      activeBusinessModule = moduleId;
      businessSearch = '';
      includeArchived = false;
      businessFilterValue = '';
      qualityRiskMatrixFilter = null;
      qualityIndicatorFilter = '';
      hrTrainingView = 'dashboard';
      hrTrainingFilters = { month: '', course: '', employee: '' };
      marketingContentView = 'kanban';
      marketingContentFilters = { channel: '', campaign: '', owner: '', format: '', theme: '', status: '', from: '', to: '' };
      marketingCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      marketingInsightsFilters = { channel: '', campaign: '', metric: '', from: '', to: '' };
      marketingComparisonMonths = { primary: '', secondary: '' };
      marketingMaterialsView = 'materials';
      businessRoot.classList.add('open');
      if (recordId && !module.source) {
        if (!canAccessBusinessCard(module, dashboardState)) {
          renderBusinessModule(moduleId);
          return;
        }
        const record = (dashboardState.businessCardRecords || []).find(function (item) { return String(item.id) === String(recordId); });
        if (record) {
          renderBusinessForm(module, record);
          return;
        }
      }
      renderBusinessModule(moduleId);
      const search = businessRoot.querySelector('[data-business-search]');
      if (search) search.focus();
    }

    function openRequestedBusinessCard() {
      if (!businessRoot) return;
      const params = new URLSearchParams(window.location.search);
      const moduleId = params.get('businessCard');
      if (!moduleId) return;
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === moduleId; });
      if (!module) return;
      openBusinessModule(moduleId, params.get('record'));
      const url = new URL(window.location.href);
      url.searchParams.delete('businessCard');
      url.searchParams.delete('record');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    function closeBusinessModule() {
      businessRoot.classList.remove('open');
      activeBusinessModule = '';
      businessOpenedFromLibrary = false;
    }

    async function syncBusinessCalendarEvents(module, record, values) {
      if (!window.RildonXBusinessCalendarSync) {
        throw new Error('O serviço de sincronização do calendário não está carregado. Atualize a página.');
      }
      const sync = window.RildonXBusinessCalendarSync.sync;
      const integrations = values.integrations || {};
      const legacyCalendar = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'].indexOf(module.id) !== -1;
      const calendarEnabled = typeof integrations.calendar === 'boolean' ? integrations.calendar : legacyCalendar;
      const knownSlots = module.id === 'marketing-content-calendar' ? ['publication']
        : module.id === 'hr-training' ? ['training']
          : module.id === 'quality-audits' ? ['audit', 'follow-up']
            : module.id === 'quality-documents' ? ['review'] : ['business-record'];
      if (!calendarEnabled) {
        if (record.data && record.data.calendarEventId) {
          await window.RildonXBusinessCalendarSync.remove(record.data.calendarEventId);
        }
        await window.RildonXBusinessCalendarSync.syncMany({
          source: module.id,
          recordId: record.id
        }, knownSlots.map(function (slot) { return { slot: slot, date: '' }; }));
        return;
      }
      if (module.id === 'marketing-content-calendar') {
        if (record.data && record.data.calendarEventId) {
          await window.RildonXBusinessCalendarSync.remove(record.data.calendarEventId);
        }
        await sync({
          source: module.id,
          recordId: record.id,
          slot: 'publication',
          title: 'Conteúdo: ' + record.title,
          description: values.notes || 'Publicação planejada no Calendário de Conteúdo.',
          date: record.status === 'Arquivo' || !values.publishAt ? '' :
            values.publishTime && /^\d{2}:\d{2}$/.test(values.publishTime)
              ? values.publishAt + 'T' + values.publishTime + ':00'
              : values.publishAt,
          category: 'conteudo',
          location: values.channel || ''
        });
        return;
      }
      if (module.id === 'hr-training') {
        const isTraining = values.recordType !== 'investment' &&
          !/cancelad/i.test(String(record.status || ''));
        await sync({
          source: module.id,
          recordId: record.id,
          slot: 'training',
          title: 'Treinamento: ' + record.title,
          description: [values.trainingType, values.instructor, values.durationHours && values.durationHours + 'h']
            .filter(Boolean).join(' · '),
          date: isTraining ? values.date : '',
          category: 'treinamento'
        });
        return;
      }
      if (module.id === 'quality-audits') {
        await window.RildonXBusinessCalendarSync.syncMany({
          source: module.id,
          recordId: record.id,
          category: 'auditoria'
        }, [
          {
            slot: 'audit',
            title: 'Auditoria: ' + record.title,
            description: [values.auditType, values.sector && 'Setor: ' + values.sector, values.auditor && 'Auditor: ' + values.auditor]
              .filter(Boolean).join(' · '),
            date: values.date
          },
          {
            slot: 'follow-up',
            title: 'Próxima auditoria: ' + record.title,
            description: [values.auditType, values.sector && 'Setor: ' + values.sector]
              .filter(Boolean).join(' · '),
            date: values.nextAuditDate
          }
        ]);
        return;
      }
      if (module.id === 'quality-documents') {
        await sync({
          source: module.id,
          recordId: record.id,
          slot: 'review',
          title: 'Revisão de documento: ' + record.title,
          description: [values.documentCode, values.sector, values.version && 'Versão ' + values.version]
            .filter(Boolean).join(' · '),
          date: values.nextReviewDate,
          category: 'documento'
        });
        return;
      }
      const dateFields = businessIntegrationDateFields(module, module.id === 'hr-training' ? hrTrainingFields('training') : module.fields);
      const preferredDateKeys = ['dueDate', 'nextAuditDate', 'nextReviewDate', 'nextReview', 'nextEvaluation',
        'publishAt', 'date', 'nextMaintenance', 'nextContact', 'startDate', 'identifiedOn', 'lastCheck'];
      const dateField = preferredDateKeys.find(function (key) {
        return dateFields.some(function (field) { return field.key === key; }) && values[key];
      });
      await sync({
        source: module.id,
        recordId: record.id,
        slot: 'business-record',
        title: module.title + ': ' + record.title,
        description: values.notes || values.description || 'Registro do painel ' + module.title + '.',
        date: dateField ? values[dateField] : '',
        category: 'reuniao'
      });
    }

    function businessTaskDetails(module, record, values, currentProfile) {
      const userId = authenticatedUserId || currentProfile.id;
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(userId))) {
        throw new Error('Não foi possível identificar seu usuário para atribuir a tarefa.');
      }
      const taskId = values.integrations && values.integrations.taskId;
      const profileName = currentProfile.displayName || currentProfile.nickname || currentProfile.name || authenticatedUserName || 'Usuário';
      const preferredDueDateKeys = ['dueDate', 'nextAuditDate', 'nextReviewDate', 'nextReview', 'nextEvaluation',
        'publishAt', 'date', 'nextMaintenance', 'nextContact', 'startDate', 'identifiedOn', 'lastCheck'];
      const dateKey = preferredDueDateKeys.find(function (key) { return Boolean(values[key]); });
      const description = values.notes || values.description || values.objective || values.observation || '';
      return {
        id: taskId || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : ''),
        userId: userId,
        profileName: profileName,
        title: (module.title + ': ' + record.title).slice(0, 180),
        description: String(description || 'Criada a partir do painel ' + module.title + '.').slice(0, 4000),
        dueDate: dateKey ? values[dateKey] : null,
        sector: module.sector || currentProfile.sector || ''
      };
    }

    async function syncBusinessTask(module, record, values, currentProfile, taskIdToRemove) {
      const store = window.RildonXStore;
      const integration = values.integrations || {};
      const taskId = integration.task ? integration.taskId : taskIdToRemove || integration.taskId;
      if (!integration.task) {
        if (!taskId) return;
        const client = window.supabaseClient;
        if (!client || !client.from || !client.auth) throw new Error('A integração com Tarefas não está disponível.');
        const auth = await client.auth.getUser();
        if (auth.error) throw auth.error;
        if (!auth.data || !auth.data.user) throw new Error('Entre novamente para atualizar a tarefa vinculada.');
        const removed = await client.from('tasks').delete().eq('id', taskId).select('id').maybeSingle();
        if (removed.error) throw removed.error;
        if (!removed.data) throw new Error('A tarefa vinculada não foi removida. Verifique se você tem permissão para excluí-la.');
        store.deleteTask(taskId);
        return;
      }
      const details = businessTaskDetails(module, record, values, currentProfile);
      if (!details.id) throw new Error('Não foi possível gerar um identificador seguro para a tarefa.');
      const client = window.supabaseClient;
      if (!client || !client.from || !client.auth) throw new Error('A integração com Tarefas não está disponível.');
      const auth = await client.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data || !auth.data.user || auth.data.user.id !== details.userId) {
        throw new Error('Sua sessão mudou. Recarregue a página antes de sincronizar a tarefa.');
      }
      const previousTask = (store.getState().tasks || []).find(function (task) { return String(task.id) === String(details.id); });
      const taskPayload = {
        id: details.id,
        title: details.title,
        status: previousTask && previousTask.status || 'pendente',
        priority: previousTask && previousTask.priority || 'media',
        due_date: details.dueDate || null,
        assignees: [details.profileName],
        viewer_ids: [details.userId],
        created_by: details.userId,
        project_id: null,
        sector: details.sector,
        tags: previousTask && previousTask.tags || [],
        description: details.description,
        start_date: previousTask && previousTask.startDate || null,
        checklist: previousTask && previousTask.checklist || [],
        attachments: previousTask && previousTask.attachments || [],
        completed_at: previousTask && previousTask.completedAt || null
      };
      const result = await client.from('tasks').upsert(taskPayload, { onConflict: 'id' }).select('id').single();
      if (result.error) throw result.error;
      if (previousTask) {
        store.updateTask(details.id, {
          title: details.title,
          dueDate: details.dueDate || null,
          assignees: [details.profileName],
          createdBy: details.userId,
          viewerIds: [details.userId],
          sector: details.sector,
          description: details.description
        });
      } else {
        store.addTask({
          id: details.id,
          title: details.title,
          status: taskPayload.status,
          priority: taskPayload.priority,
          dueDate: details.dueDate || null,
          assignees: [details.profileName],
          createdBy: details.userId,
          viewerIds: [details.userId],
          sector: details.sector,
          description: details.description,
          projectId: null
        });
      }
    }

    async function syncArchivedBusinessCalendar(module, record, archived) {
      if (!module || !record) return;
      const integrations = record.data && record.data.integrations || {};
      const legacyCalendar = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'].indexOf(module.id) !== -1;
      const shouldSyncCalendar = typeof integrations.calendar === 'boolean' ? integrations.calendar : legacyCalendar;
      if (archived) {
        if (shouldSyncCalendar) {
          await syncBusinessCalendarEvents(module, record, Object.assign({}, record.data || {}, {
            integrations: Object.assign({}, integrations, { calendar: false })
          }));
        }
        if (integrations.task || integrations.taskId) {
          await syncBusinessTask(module, record, Object.assign({}, record.data || {}, {
            integrations: Object.assign({}, integrations, { task: false })
          }), getCurrentProfile(dashboardState));
        }
        return;
      }
      if (shouldSyncCalendar) await syncBusinessCalendarEvents(module, record, record.data || {});
      if (integrations.task) {
        await syncBusinessTask(module, record, record.data || {}, getCurrentProfile(dashboardState));
        const currentProfile = getCurrentProfile(dashboardState);
        const taskOwnerId = authenticatedUserId || currentProfile.id;
        if (taskOwnerId && integrations.taskOwnerId !== taskOwnerId) {
          window.RildonXStore.updateBusinessCardRecord(record.id, {
            data: Object.assign({}, record.data || {}, {
              integrations: Object.assign({}, integrations, { taskOwnerId: taskOwnerId })
            })
          });
        }
      }
    }

    async function saveBusinessRecord(form) {
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
      if (!module || module.source || !canAccessBusinessCard(module, dashboardState)) return;
      const formData = new FormData(form);
      const recordType = module.id === 'hr-training' ? form.dataset.recordType || 'training' : '';
      const fields = module.id === 'hr-training' ? hrTrainingFields(recordType) : module.fields;
      const values = {};
      fields.forEach(function (field) {
        if (field.type !== 'employees') values[field.key] = String(formData.get(field.key) || '').trim();
      });
      const existingId = form.dataset.recordId;
      const existing = existingId && (dashboardState.businessCardRecords || []).find(function (record) { return record.id === existingId; });
      const currentProfile = getCurrentProfile(dashboardState);
      const existingIntegrations = existing && existing.data && existing.data.integrations || {};
      if (!(module.id === 'hr-training' && recordType === 'investment')) {
        const taskEnabled = formData.get('integrationTask') === 'on';
        let taskId = existingIntegrations.taskId || '';
        if (taskEnabled && !taskId) {
          if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
            throw new Error('Este navegador não permite gerar um identificador seguro para a tarefa.');
          }
          taskId = window.crypto.randomUUID();
        }
        values.integrations = {
          calendar: formData.get('integrationCalendar') === 'on',
          task: taskEnabled,
          taskId: taskId || null,
          taskOwnerId: existingIntegrations.taskOwnerId || (taskEnabled ? authenticatedUserId || currentProfile.id : null)
        };
      }
      const valuesTitle = values.title || 'Registro';
      const status = module.id === 'hr-training'
        ? recordType === 'investment' ? 'Registrado' :
          existing && !isTrainingCompletionRecord(existing) ? existing.status || 'Pendente' : 'Realizado'
        : values.status || existing && existing.status || 'Pendente';
      if (module.id === 'marketing-content-calendar') {
        if (values.publishTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.publishTime)) {
          throw new Error('Informe um horário válido no formato HH:MM.');
        }
        if (status === 'Agendado' && !values.publishAt) {
          throw new Error('Defina uma data prevista antes de mover o conteúdo para Agendado.');
        }
      }
      if (module.id === 'marketing-internal-demands') {
        const isCompleted = /^(concluida|finalizada)$/i.test(normalizeSearchText(status));
        if (isCompleted) {
          const today = new Date();
          values.completedAt = existing && existing.data && existing.data.completedAt ||
            [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
        } else {
          values.completedAt = '';
        }
      }
      const attachmentFile = formData.get('attachmentFile');
      if (module.id === 'hr-training') {
        values.recordType = recordType;
        if (!values.trainingType) throw new Error('Selecione o tipo de capacitação.');
        if (values.trainingType === 'Outro' && !values.otherTrainingType) {
          throw new Error('Informe o tipo de capacitação em “Outro”.');
        }
        if (recordType === 'investment') {
          const participantsCount = Number(values.participantsCount);
          const trainingCost = Number(values.trainingCost);
          const coffeeBreakCost = Number(values.coffeeBreakCost);
          if (!Number.isInteger(participantsCount) || participantsCount <= 0) {
            throw new Error('A quantidade de participantes deve ser um inteiro maior que zero.');
          }
          if (!Number.isFinite(trainingCost) || trainingCost < 0 ||
              !Number.isFinite(coffeeBreakCost) || coffeeBreakCost < 0) {
            throw new Error('Informe custos válidos iguais ou maiores que zero.');
          }
        } else {
          const date = parseCalendarDate(values.date);
          const duration = Number(values.durationHours);
          const validity = values.validityMonths === '' ? 0 : Number(values.validityMonths);
          if (!date) throw new Error('Informe uma data de realização válida.');
          if (!Number.isFinite(duration) || duration < 0) throw new Error('A carga horária deve ser igual ou maior que zero.');
          if (!Number.isSafeInteger(validity) || validity < 0) throw new Error('A validade deve ser um número inteiro de meses igual ou maior que zero.');
          if (validity > 0 && !trainingExpiryDate({ data: { date: values.date, validityMonths: validity } })) {
            throw new Error('A data e a validade informadas ultrapassam o intervalo de datas suportado.');
          }
          values.validityMonths = validity ? String(validity) : '';
          const selectedIds = Array.from(new Set(formData.getAll('participantIds').map(String)));
          if (!selectedIds.length) throw new Error('Selecione pelo menos um funcionário participante.');
          const profiles = trainingEmployees(dashboardState);
          const existingParticipants = trainingRecordParticipants(existing);
          const existingById = new Map(existingParticipants.map(function (participant) {
            return [trainingParticipantId(participant), participant];
          }));
          const selectedParticipants = selectedIds.map(function (id) {
            const employee = profiles.find(function (profile) { return String(profile.id) === id; });
            if (!employee) throw new Error('Um funcionário selecionado não está mais ativo no diretório. Atualize a seleção e tente novamente.');
            const previous = existingById.get(id);
            const next = Object.assign({}, previous || {}, {
              employeeId: id,
              userId: id,
              name: employee.displayName || employee.nickname || employee.name || 'Colaborador',
              sector: employee.sector || '',
              position: employee.position || employee.jobTitle || employee.role || ''
            });
            if (previous && previous.overrides) next.overrides = previous.overrides;
            return next;
          });
          const profileIds = new Set(trainingEmployees(dashboardState).map(function (profile) { return String(profile.id); }));
          const retainedHistoricalParticipants = existingParticipants.filter(function (participant) {
            return !profileIds.has(trainingParticipantId(participant));
          });
          values.participants = retainedHistoricalParticipants.concat(selectedParticipants);
        }
      }
      if (module.id === 'quality-audits') {
        const nonconformities = Number(values.nonconformities);
        if (!Number.isInteger(nonconformities) || nonconformities < 0) {
          throw new Error('A quantidade de não conformidades deve ser um inteiro igual ou maior que zero.');
        }
      }
      if (module.id === 'quality-5w2h' && values.estimatedCost &&
          (!Number.isFinite(Number(values.estimatedCost)) || Number(values.estimatedCost) < 0)) {
        throw new Error('O custo estimado deve ser um valor igual ou maior que zero.');
      }
      if (module.id === 'quality-risks') {
        const score = qualityRiskScore(values);
        if (score < 1 || score > 25) throw new Error('Selecione valores válidos de probabilidade e impacto.');
        values.criticality = score;
        values.riskLevel = qualityRiskBand(score);
      }
      if (module.id === 'quality-indicators') {
        const value = Number(values.value);
        const target = Number(values.target);
        if (!/^\d{4}-\d{2}$/.test(values.measurementMonth) ||
            !Number.isFinite(value) || !Number.isFinite(target)) {
          throw new Error('Informe uma competência e resultados/metas numéricos válidos.');
        }
      }
      if (module.id === 'quality-5s' && values.recordType === 'Avaliação') {
        ['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'].forEach(function (key) {
          const score = values[key] === '' ? 0 : Number(values[key]);
          if (!Number.isInteger(score) || score < 0 || score > 5) {
            throw new Error('Cada senso da avaliação 5S deve receber uma nota inteira entre 0 e 5.');
          }
          values[key] = String(score);
        });
        values.totalScore = String(quality5sScore(values));
      }
      const attachmentIds = existing && existing.data && Array.isArray(existing.data.attachmentIds)
        ? existing.data.attachmentIds.slice()
        : [];
      if (module.id === 'purchase-quotes' && existing && existing.data && existing.data.approval) {
        values.approval = existing.data.approval;
      }
      if (attachmentFile && attachmentFile.size) {
        if (!window.RildonXDocumentUpload || typeof window.RildonXDocumentUpload.upload !== 'function') {
          throw new Error('O serviço de anexos não está disponível. Recarregue Meu Espaço e tente novamente.');
        }
        const uploaded = await window.RildonXDocumentUpload.upload(attachmentFile, {
          folder: 'Cards setoriais',
          senderName: currentProfile.displayName || currentProfile.name || authenticatedUserName || 'Usuário',
          viewerIds: businessAttachmentViewers(module, dashboardState)
        });
        if (!uploaded || !uploaded.id) throw new Error('O serviço não retornou o arquivo enviado.');
        window.RildonXStore.addDocument(uploaded);
        attachmentIds.push(uploaded.id);
      }
      if (attachmentIds.length) values.attachmentIds = attachmentIds;
      const payload = {
        title: valuesTitle,
        status: status,
        data: Object.assign({}, existing && existing.data || {}, values)
      };
      if (module.id === 'marketing-content-calendar' &&
          (!existing || existing.status !== status)) {
        const statusHistory = existing && existing.data && Array.isArray(existing.data.statusHistory)
          ? existing.data.statusHistory.slice()
          : [];
        statusHistory.push({
          from: existing && existing.status || '',
          to: status,
          at: new Date().toISOString(),
          by: currentProfile.displayName || currentProfile.nickname || currentProfile.name || authenticatedUserName || 'Usuário'
        });
        payload.data.statusHistory = statusHistory;
      }
      let saved;
      if (existing) {
        saved = window.RildonXStore.updateBusinessCardRecord(existing.id, payload);
      } else {
        saved = window.RildonXStore.addBusinessCardRecord(Object.assign({
          moduleKey: module.id,
          sector: module.sectorKey,
          createdBy: authenticatedUserId || currentProfile.id
        }, payload));
      }
      if (!saved) throw new Error('Não foi possível salvar o registro do card.');
      businessSearch = '';
      const integrationErrors = [];
      if (!(module.id === 'hr-training' && recordType === 'investment')) {
        const legacyCalendarModule = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'].indexOf(module.id) !== -1;
        const shouldSyncCalendar = values.integrations.calendar || existingIntegrations.calendar === true ||
          (typeof existingIntegrations.calendar !== 'boolean' && legacyCalendarModule) ||
          Boolean(existing && existing.data && existing.data.calendarEventId);
        if (shouldSyncCalendar) {
          try {
            await syncBusinessCalendarEvents(module, saved, saved.data || values);
          } catch (error) {
            integrationErrors.push('Calendário: ' + (error.message || 'não foi possível sincronizar.'));
            console.error('O registro foi salvo, mas a sincronização com o calendário falhou:', error);
          }
        }
        try {
          await syncBusinessTask(module, saved, saved.data || values, currentProfile,
            !values.integrations.task ? existingIntegrations.taskId : null);
          const latestIntegrations = saved.data && saved.data.integrations || {};
          const updatedIntegrations = Object.assign({}, latestIntegrations, {
            taskId: latestIntegrations.task ? latestIntegrations.taskId : null,
            taskOwnerId: latestIntegrations.task ? authenticatedUserId || currentProfile.id : null
          });
          if (latestIntegrations.taskId !== updatedIntegrations.taskId ||
              latestIntegrations.taskOwnerId !== updatedIntegrations.taskOwnerId) {
            saved = window.RildonXStore.updateBusinessCardRecord(saved.id, {
              data: Object.assign({}, saved.data || {}, { integrations: updatedIntegrations })
            }) || saved;
          }
        } catch (error) {
          integrationErrors.push('Tarefas: ' + (error.message || 'não foi possível sincronizar.'));
          console.error('O registro foi salvo, mas a sincronização com Tarefas falhou:', error);
        }
      }
      renderBusinessModule(module.id);
      if (typeof window.showToast === 'function') {
        window.showToast(integrationErrors.length
          ? 'Registro salvo. ' + integrationErrors.join(' ')
          : 'Registro salvo.');
      }
    }

    function saveHrParticipantForm(form) {
      const record = (dashboardState.businessCardRecords || []).find(function (item) {
        return String(item.id) === form.dataset.recordId && item.moduleKey === 'hr-training' && !item.archived;
      });
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; });
      if (!record || !canAccessBusinessCard(module, dashboardState)) throw new Error('Turma indisponível ou sem permissão.');
      const formData = new FormData(form);
      const title = String(formData.get('title') || '').trim();
      const date = String(formData.get('date') || '').trim();
      const duration = Number(formData.get('durationHours'));
      const validity = String(formData.get('validityMonths') || '').trim();
      const months = validity ? Number(validity) : 0;
      if (!title || !parseCalendarDate(date)) throw new Error('Informe curso e data válidos.');
      if (!Number.isFinite(duration) || duration < 0) throw new Error('A carga horária deve ser igual ou maior que zero.');
      if (!Number.isSafeInteger(months) || months < 0) throw new Error('A validade deve ser um inteiro de meses igual ou maior que zero.');
      if (months > 0 && !trainingExpiryDate({ data: { date: date, validityMonths: months } })) {
        throw new Error('A data e a validade informadas ultrapassam o intervalo de datas suportado.');
      }
      const employeeId = form.dataset.employeeId;
      let found = false;
      const participants = trainingRecordParticipants(record).map(function (participant) {
        if (trainingParticipantId(participant) !== employeeId) return participant;
        found = true;
        return Object.assign({}, participant, {
          overrides: Object.assign({}, participant.overrides || {}, {
            title: title,
            date: date,
            durationHours: String(duration),
            validityMonths: months ? String(months) : ''
          })
        });
      });
      if (!found) throw new Error('Participação não encontrada. Atualize a lista e tente novamente.');
      const saved = window.RildonXStore.updateBusinessCardRecord(record.id, {
        data: Object.assign({}, record.data || {}, { participants: participants })
      });
      if (!saved) throw new Error('Não foi possível salvar a correção individual.');
      renderBusinessModule('hr-training');
      if (typeof window.showToast === 'function') window.showToast('Participação atualizada.');
    }

    async function processBusinessApprovalAction(recordId, action) {
      const record = (dashboardState.businessCardRecords || []).find(function (item) {
        return String(item.id) === String(recordId);
      });
      if (!record || record.moduleKey !== 'purchase-quotes' || record.archived) return;
      const profile = getCurrentProfile(dashboardState);
      const userId = authenticatedUserId || profile.id;
      const manager = isBusinessCardManager(dashboardState);
      const isCreator = String(record.createdBy) === String(userId);
      const approval = Object.assign({}, getBusinessApproval(record));
      const history = Array.isArray(approval.history) ? approval.history.slice() : [];
      const now = new Date().toISOString();
      const actorName = profile.displayName || profile.nickname || authenticatedUserName || 'Usuário';
      let nextRecordStatus = record.status || 'Solicitado';
      let reason = '';

      if (action === 'request') {
        if (!isCreator && !manager) throw new Error('Somente quem criou o registro ou um gestor pode solicitar aprovação.');
        if (['pending', 'approved'].indexOf(approval.status) !== -1) return;
        approval.status = 'pending';
        approval.requestedAt = now;
        approval.requestedBy = userId;
        approval.decidedAt = null;
        approval.decidedBy = null;
        approval.reason = '';
        history.push({ status: 'pending', actorId: userId, actorName: actorName, at: now });
        if (nextRecordStatus === 'Aprovado') nextRecordStatus = 'Solicitado';
      } else if (action === 'cancel') {
        if (!isCreator && !manager) throw new Error('Somente quem criou o registro ou um gestor pode cancelar a solicitação.');
        if (approval.status !== 'pending') return;
        approval.status = 'cancelled';
        approval.decidedAt = now;
        approval.decidedBy = userId;
        approval.reason = 'Solicitação cancelada.';
        history.push({ status: 'cancelled', actorId: userId, actorName: actorName, at: now });
      } else if (action === 'approve' || action === 'reject') {
        if (!manager) throw new Error('Apenas um gestor pode decidir esta solicitação.');
        if (approval.status !== 'pending') return;
        if (action === 'reject') {
          reason = String(window.prompt('Informe o motivo da rejeição:') || '').trim();
          if (!reason) return;
          if (reason.length > 1000) throw new Error('O motivo deve ter no máximo 1.000 caracteres.');
        }
        approval.status = action === 'approve' ? 'approved' : 'rejected';
        approval.decidedAt = now;
        approval.decidedBy = userId;
        approval.reason = reason;
        history.push({ status: approval.status, actorId: userId, actorName: actorName, at: now, reason: reason });
        nextRecordStatus = action === 'approve' ? 'Aprovado' : 'Solicitado';
      } else {
        throw new Error('Ação de aprovação inválida.');
      }

      approval.history = history.slice(-50);
      const data = Object.assign({}, record.data || {}, { approval: approval });
      if (nextRecordStatus !== record.status) data.status = nextRecordStatus;
      const client = window.supabaseClient;
      if (!client || typeof client.from !== 'function') {
        throw new Error('A aprovação compartilhada exige conexão com o Supabase.');
      }
      const result = await client.from('business_card_records')
        .update({ status: nextRecordStatus, data: data })
        .eq('id', record.id)
        .select('*')
        .single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('O Supabase não confirmou a alteração da aprovação.');

      const updated = window.RildonXStore.updateBusinessCardRecord(record.id, {
        status: result.data.status,
        data: result.data.data,
        updatedAt: result.data.updated_at || now
      });
      if (!updated) throw new Error('A aprovação foi salva, mas não foi possível atualizar a visualização local.');
      if (typeof window.showToast === 'function') {
        const messages = {
          request: 'Solicitação de aprovação enviada.',
          cancel: 'Solicitação cancelada.',
          approve: 'Compra aprovada.',
          reject: 'Solicitação rejeitada.'
        };
        window.showToast(messages[action]);
      }
    }

    function linkRecordToTask(recordId) {
      const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
      const record = (dashboardState.businessCardRecords || []).find(function (item) { return item.id === recordId; });
      if (!module || !record || record.linkedTaskId || !canAccessBusinessCard(module, dashboardState)) return;
      const profile = getCurrentProfile(dashboardState);
      const task = window.RildonXStore.addTask({
        title: record.title,
        description: (record.data && (record.data.description || record.data.notes || record.data.body) || 'Tarefa criada a partir do card ' + module.title + '.') +
          '\n\nOrigem: ' + module.title + '.',
        status: 'pendente',
        priority: /urgente/i.test(String(record.data && record.data.priority || '')) ? 'alta' : /alta/i.test(String(record.data && record.data.priority || '')) ? 'alta' : 'media',
        dueDate: record.data && (record.data.dueDate || record.data.publishAt || record.data.nextContact || record.data.dueDate) || null,
        sector: module.sectorKey,
        createdBy: authenticatedUserId || profile.id,
        assignees: [profile.displayName || profile.name || authenticatedUserName || 'Usuário']
      });
      if (!task) throw new Error('A tarefa vinculada não foi criada.');
      window.RildonXStore.updateBusinessCardRecord(record.id, { linkedTaskId: task.id });
      if (typeof window.showToast === 'function') window.showToast('Tarefa criada e vinculada. Ela também está disponível na página Tarefas.');
    }

    function openCustomizerModal() {
      draft = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      hydrateDashboardControls(configRoot, draft);
      configRoot.classList.add('open');
      const title = configRoot.querySelector('#dashboard-config-title');
      if (title) title.focus();
    }

    function closeCustomizerModal() {
      configRoot.classList.remove('open');
      draft = null;
    }

    function captureDraft() {
      if (!draft) return normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      draft = readDashboardControls();
      return draft;
    }

    function renderDraft() {
      draft = normalizeDashboard(draft || DEFAULT_DASHBOARD);
      hydrateDashboardControls(configRoot, draft);
      const list = configRoot.querySelector('.dashboard-config-cards');
      if (list) {
        list.innerHTML = draft.cards.map(function (card, index) {
          return configRowMarkup(card, index, draft.cards.length);
        }).join('');
      }
    }

    function addCard() {
      const current = captureDraft();
      const selector = configRoot.querySelector('#dashboard-add-card');
      const type = selector && selector.value;
      if (!CARD_CATALOG[type]) return;
      const catalog = CARD_CATALOG[type];
      current.cards.push({
        id: 'card-' + type + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7),
        type: type,
        tone: (BUSINESS_CARD_MODULES.find(function (item) { return item.id === type; }) || {}).tone || 'general',
        title: catalog.label,
        enabled: true,
        position: current.cards.length,
        filters: clone(catalog.defaults)
      });
      draft = current;
      renderDraft();
    }

    function moveCard(row, direction) {
      const current = captureDraft();
      const index = current.cards.findIndex(function (card) { return card.id === row.dataset.configCard; });
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.cards.length) return;
      const moved = current.cards.splice(index, 1)[0];
      current.cards.splice(target, 0, moved);
      current.cards.forEach(function (card, position) { card.position = position; });
      draft = current;
      renderDraft();
    }

    function saveDashboard() {
      const current = captureDraft();
      persistDashboard(current);
      render();
      closeCustomizerModal();
      if (typeof window.showToast === 'function') window.showToast('Seu espaço foi atualizado.');
    }

    function saveRenderedCardOrder() {
      const current = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
      const renderedIds = Array.prototype.map.call(
        dashboardRoot.querySelectorAll('.dashboard-card'),
        function (card) { return card.dataset.cardId; }
      );
      const enabledCards = current.cards.filter(function (card) { return card.enabled !== false; });
      const reorderedEnabled = renderedIds.map(function (id) {
        return enabledCards.find(function (card) { return card.id === id; });
      }).filter(Boolean);
      let enabledIndex = 0;
      current.cards = current.cards.slice().sort(function (a, b) { return a.position - b.position; }).map(function (card, index) {
        const nextCard = card.enabled !== false ? reorderedEnabled[enabledIndex++] || card : card;
        nextCard.position = index;
        return nextCard;
      });
      persistDashboard(current);
      render();
    }

    if (libraryBtn) libraryBtn.addEventListener('click', openLibrary);

    if (libraryRoot) {
      libraryRoot.addEventListener('click', function (event) {
        if (event.target === libraryRoot || event.target.closest('[data-library-close]')) {
          closeLibrary();
          return;
        }
        const sectorTab = event.target.closest('[data-library-sector]');
        if (sectorTab) {
          activeLibrarySector = sectorTab.dataset.librarySector;
          libraryRoot.dataset.activeSector = activeLibrarySector;
          Array.prototype.forEach.call(libraryRoot.querySelectorAll('[data-library-sector]'), function (tab) {
            const selected = tab === sectorTab;
            tab.classList.toggle('active', selected);
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
          });
          const current = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
          renderLibraryContent(
            libraryRoot.querySelector('.dashboard-library-content'),
            current,
            dashboardState,
            getStoredHomeCards(),
            activeLibrarySector
          );
          return;
        }
        const moduleOpenButton = event.target.closest('[data-library-open]');
        if (moduleOpenButton && !moduleOpenButton.disabled) {
          openBusinessModule(moduleOpenButton.dataset.libraryOpen, '', true);
          return;
        }
        const addButton = event.target.closest('[data-library-add]');
        if (addButton && !addButton.disabled) addLibraryCard(addButton.dataset.libraryAdd);
        const homeToggleButton = event.target.closest('[data-home-toggle]');
        if (homeToggleButton && !homeToggleButton.disabled) toggleHomeCard(homeToggleButton.dataset.homeToggle);
      });
      libraryRoot.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && libraryRoot.classList.contains('open')) closeLibrary();
      });
    }

    if (configRoot) {
      configRoot.addEventListener('click', function (event) {
        if (event.target === configRoot) closeCustomizerModal();
        const saveBtn = event.target.closest('#dashboard-save-btn');
        if (saveBtn) {
          saveDashboard();
          return;
        }

        const resetBtn = event.target.closest('#dashboard-reset-btn');
        if (resetBtn) {
          draft = clone(DEFAULT_DASHBOARD);
          renderDraft();
          return;
        }

        if (event.target.closest('#dashboard-cancel-btn')) {
          closeCustomizerModal();
          return;
        }

        if (event.target.closest('#dashboard-add-card-btn')) {
          addCard();
          return;
        }

        const row = event.target.closest('.dashboard-config-card');
        if (!row) return;
        if (event.target.closest('[data-card-remove]')) {
          const current = captureDraft();
          current.cards = current.cards.filter(function (card) { return card.id !== row.dataset.configCard; });
          draft = current;
          renderDraft();
        } else if (event.target.closest('[data-card-move="up"]')) {
          moveCard(row, -1);
        } else if (event.target.closest('[data-card-move="down"]')) {
          moveCard(row, 1);
        }
      });

      configRoot.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && configRoot.classList.contains('open')) closeCustomizerModal();
      });
    }

    if (businessRoot) {
      window.addEventListener('rildonx-marketing-import-ready', function () {
        if (activeBusinessModule === 'marketing-insights') renderBusinessModule('marketing-insights');
      });
      businessRoot.addEventListener('click', function (event) {
        if (event.target.closest('[data-business-close]') ||
            event.target.closest('[data-business-library-back]')) {
          closeBusinessModule();
          return;
        }
        if (event.target.closest('[data-business-back]')) {
          renderBusinessModule(activeBusinessModule);
          return;
        }
        const contentViewButton = event.target.closest('[data-marketing-view]');
        if (contentViewButton) {
          marketingContentView = contentViewButton.dataset.marketingView;
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }), businessSearch);
          return;
        }
        const calendarMonthButton = event.target.closest('[data-marketing-month]');
        if (calendarMonthButton) {
          marketingCalendarMonth.setMonth(marketingCalendarMonth.getMonth() + Number(calendarMonthButton.dataset.marketingMonth));
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }), businessSearch);
          return;
        }
        const materialViewButton = event.target.closest('[data-marketing-material-view]');
        if (materialViewButton) {
          marketingMaterialsView = materialViewButton.dataset.marketingMaterialView;
          renderBusinessModule('marketing-materials');
          return;
        }
        const documentButton = event.target.closest('[data-marketing-open-document]');
        if (documentButton) {
          openMarketingDocument(documentButton.dataset.marketingOpenDocument);
          return;
        }
        const documentDownloadButton = event.target.closest('[data-marketing-download-document]');
        if (documentDownloadButton) {
          openMarketingDocument(documentDownloadButton.dataset.marketingDownloadDocument, true);
          return;
        }
        const materialFavoriteButton = event.target.closest('[data-marketing-material-favorite]');
        if (materialFavoriteButton) {
          const record = marketingMaterialRecords().find(function (item) {
            return String(item.id) === materialFavoriteButton.dataset.marketingMaterialFavorite;
          });
          if (!record) return;
          const updated = window.RildonXStore.updateBusinessCardRecord(record.id, {
            data: Object.assign({}, record.data || {}, { isFavorite: !(record.data && record.data.isFavorite) })
          });
          if (!updated) {
            if (typeof window.showToast === 'function') window.showToast('Não foi possível atualizar o favorito.');
            return;
          }
          renderBusinessModule('marketing-materials');
          return;
        }
        if (event.target.closest('[data-marketing-pdf]')) {
          window.print();
          return;
        }
        const hrViewButton = event.target.closest('[data-hr-training-view]');
        if (hrViewButton) {
          hrTrainingView = hrViewButton.dataset.hrTrainingView;
          businessSearch = '';
          renderBusinessModule(activeBusinessModule);
          return;
        }
        const hrCreateButton = event.target.closest('[data-hr-training-create]');
        if (hrCreateButton) {
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module && !dashboardState.businessCardRecordsLoadError) {
            renderBusinessForm(module, null, hrCreateButton.dataset.hrTrainingCreate);
          }
          return;
        }
        const employeeEditButton = event.target.closest('[data-employee-edit]');
        if (employeeEditButton) {
          const profileId = employeeEditButton.dataset.employeeEdit;
          window.location.href = 'mensagens.html?personProfile=' + encodeURIComponent(profileId) + '&editProfile=true';
          return;
        }
        const employeeToggleButton = event.target.closest('[data-employee-toggle]');
        if (employeeToggleButton) {
          const profile = (dashboardState.profiles || []).find(function(item) {
            return String(item.id) === String(employeeToggleButton.dataset.employeeToggle);
          });
          const currentProfile = getCurrentProfile(dashboardState);
          if (!profile || !window.supabaseClient || !canManagePeopleProfiles(dashboardState) ||
              String(profile.id) === String(currentProfile.id)) return;
          employeeToggleButton.disabled = true;
          window.supabaseClient.rpc('set_rildonx_profile_active', {
            p_profile_id: profile.id,
            p_active: profile.active === false
          }).then(function(result) {
            if (result.error) throw result.error;
            if (!window.RildonXSync || !window.RildonXSync.refreshProfilesFromSupabase) {
              throw new Error('A atualização dos perfis não está disponível.');
            }
            return window.RildonXSync.refreshProfilesFromSupabase();
          }).then(function() {
            renderBusinessModule(activeBusinessModule);
            if (typeof window.showToast === 'function') {
              window.showToast(profile.active === false ? 'Usuário habilitado.' : 'Usuário desabilitado.');
            }
          }).catch(function(error) {
            console.error('Não foi possível alterar o status do usuário:', error);
            if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível alterar o status do usuário.');
          }).finally(function() {
            if (employeeToggleButton.isConnected) employeeToggleButton.disabled = false;
          });
          return;
        }
        const editParticipantButton = event.target.closest('[data-hr-edit-participant]');
        if (editParticipantButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) {
            return String(item.id) === editParticipantButton.dataset.hrEditParticipant && item.moduleKey === 'hr-training';
          });
          const participant = record && trainingRecordParticipants(record).find(function (item) {
            return trainingParticipantId(item) === editParticipantButton.dataset.hrEmployeeId;
          });
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; });
          if (record && participant && canAccessBusinessCard(module, dashboardState)) renderHrParticipantForm(record, participant);
          return;
        }
        const completeTrainingButton = event.target.closest('[data-hr-mark-complete]');
        if (completeTrainingButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) {
            return String(item.id) === completeTrainingButton.dataset.hrMarkComplete && item.moduleKey === 'hr-training' && !item.archived;
          });
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; });
          if (!record || (record.data && record.data.recordType === 'investment') || !canAccessBusinessCard(module, dashboardState)) return;
          if (!window.confirm('Marcar "' + record.title + '" como realizado? Isso incluirá as participações nos indicadores e nos relatórios.')) return;
          const updated = window.RildonXStore.updateBusinessCardRecord(record.id, { status: 'Realizado' });
          if (!updated) {
            if (typeof window.showToast === 'function') window.showToast('Não foi possível concluir a capacitação.');
            return;
          }
          renderBusinessModule(activeBusinessModule);
          if (typeof window.showToast === 'function') window.showToast('Capacitação registrada como realizada.');
          return;
        }
        const removeParticipantButton = event.target.closest('[data-hr-remove-participant]');
        if (removeParticipantButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) {
            return String(item.id) === removeParticipantButton.dataset.hrRemoveParticipant && item.moduleKey === 'hr-training';
          });
          if (!record || !canAccessBusinessCard(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; }), dashboardState)) return;
          if (!window.confirm('Remover esta participação da turma?')) return;
          const participants = trainingRecordParticipants(record).filter(function (participant) {
            return trainingParticipantId(participant) !== removeParticipantButton.dataset.hrEmployeeId;
          });
          const saved = window.RildonXStore.updateBusinessCardRecord(record.id, {
            data: Object.assign({}, record.data || {}, { participants: participants })
          });
          if (!saved) {
            if (typeof window.showToast === 'function') window.showToast('Não foi possível remover a participação.');
            return;
          }
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; }), businessSearch);
          if (typeof window.showToast === 'function') window.showToast('Participação removida.');
          return;
        }
        const riskCell = event.target.closest('[data-risk-probability][data-risk-impact]');
        if (riskCell) {
          qualityRiskMatrixFilter = {
            probability: Number(riskCell.dataset.riskProbability),
            impact: Number(riskCell.dataset.riskImpact)
          };
          businessFilterValue = '';
          renderBusinessModule(activeBusinessModule);
          return;
        }
        if (event.target.closest('[data-risk-matrix-clear]')) {
          qualityRiskMatrixFilter = null;
          renderBusinessModule(activeBusinessModule);
          return;
        }
        const createButton = event.target.closest('[data-business-create]');
        if (createButton) {
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module && !module.source) renderBusinessForm(module, null);
          return;
        }
        const editButton = event.target.closest('[data-business-edit]');
        if (editButton) {
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          const record = (dashboardState.businessCardRecords || []).find(function (item) { return item.id === editButton.dataset.businessEdit; });
          if (module && record && canAccessBusinessCard(module, dashboardState)) renderBusinessForm(module, record);
          return;
        }
        const archiveButton = event.target.closest('[data-business-archive]');
        if (archiveButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) { return item.id === archiveButton.dataset.businessArchive; });
          const userId = authenticatedUserId || getCurrentProfile(dashboardState).id;
          if (!record || (record.createdBy !== userId && !isBusinessCardManager(dashboardState))) return;
          if (window.confirm('Arquivar "' + record.title + '"? Você poderá exibi-lo novamente na lista de arquivados.')) {
            const updated = window.RildonXStore.updateBusinessCardRecord(record.id, { archived: true });
            const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === record.moduleKey; });
            const integrations = record.data && record.data.integrations || {};
            const legacyCalendarRecord = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'].indexOf(record.moduleKey) !== -1;
            if (updated && module && (integrations.calendar || integrations.task || integrations.taskId || legacyCalendarRecord)) {
              syncArchivedBusinessCalendar(module, record, true).catch(function (error) {
                console.error('Registro arquivado, mas uma integração não foi sincronizada:', error);
                if (typeof window.showToast === 'function') window.showToast('Registro arquivado, mas uma integração não foi sincronizada: ' + (error.message || 'verifique suas permissões.'));
              });
            }
            if (updated && ['hr-training', 'marketing-insights', 'marketing-materials'].indexOf(activeBusinessModule) !== -1) {
              renderBusinessModule(activeBusinessModule);
            }
          }
          return;
        }
        const restoreButton = event.target.closest('[data-business-restore]');
        if (restoreButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) { return item.id === restoreButton.dataset.businessRestore; });
          const userId = authenticatedUserId || getCurrentProfile(dashboardState).id;
          if (record && (record.createdBy === userId || isBusinessCardManager(dashboardState))) {
            const updated = window.RildonXStore.updateBusinessCardRecord(record.id, { archived: false });
            const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === record.moduleKey; });
            const integrations = record.data && record.data.integrations || {};
            const legacyCalendarRecord = ['marketing-content-calendar', 'hr-training', 'quality-audits', 'quality-documents'].indexOf(record.moduleKey) !== -1;
            if (updated && module && (integrations.calendar || integrations.task || integrations.taskId || legacyCalendarRecord)) {
              syncArchivedBusinessCalendar(module, updated, false).catch(function (error) {
                console.error('Registro restaurado, mas uma integração não foi sincronizada:', error);
                if (typeof window.showToast === 'function') window.showToast('Registro restaurado, mas uma integração não foi sincronizada: ' + (error.message || 'verifique suas permissões.'));
              });
            }
            if (updated && ['hr-training', 'marketing-insights', 'marketing-materials'].indexOf(activeBusinessModule) !== -1) {
              renderBusinessModule(activeBusinessModule);
            }
          }
          return;
        }
        const approvalButton = event.target.closest('[data-business-approval]');
        if (approvalButton) {
          processBusinessApprovalAction(approvalButton.dataset.recordId, approvalButton.dataset.businessApproval)
            .catch(function (error) {
              console.error('Falha no fluxo de aprovação da compra:', error);
              if (typeof window.showToast === 'function') {
                window.showToast(error.message || 'Não foi possível atualizar a aprovação. Verifique sua conexão e permissões.');
              }
            });
          return;
        }
        const attachmentButton = event.target.closest('[data-business-attachment]');
        if (attachmentButton) {
          const file = (dashboardState.documents || []).find(function (item) {
            return String(item.id) === attachmentButton.dataset.businessAttachment;
          });
          const openedWindow = window.open('about:blank', '_blank');
          if (!openedWindow) {
            if (typeof window.showToast === 'function') window.showToast('Permita pop-ups para abrir o arquivo.');
            return;
          }
          openedWindow.opener = null;
          if (!file || !window.RildonXDocumentUpload || typeof window.RildonXDocumentUpload.getViewUrl !== 'function') {
            openedWindow.close();
            if (typeof window.showToast === 'function') window.showToast('O serviço de arquivos não está disponível.');
            return;
          }
          window.RildonXDocumentUpload.getViewUrl(file).then(function (url) {
            if (!url) throw new Error('Não foi possível gerar um link seguro para este arquivo.');
            openedWindow.location.href = url;
          }).catch(function (error) {
            console.error('Não foi possível abrir o anexo do card:', error);
            openedWindow.close();
            if (typeof window.showToast === 'function') window.showToast('Não foi possível abrir o anexo. Verifique seu acesso ao documento.');
          });
          return;
        }
        const favoriteButton = event.target.closest('[data-business-favorite]');
        if (favoriteButton) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) { return String(item.id) === favoriteButton.dataset.businessFavorite; });
          if (record) toggleBusinessFavorite(record);
          return;
        }
        if (event.target.closest('[data-business-export]')) {
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module) {
            try {
              exportBusinessRecords(module);
            } catch (error) {
              console.error('Não foi possível exportar os registros deste card:', error);
              if (typeof window.showToast === 'function') window.showToast('Não foi possível exportar os registros.');
            }
          }
          return;
        }
        const linkTaskButton = event.target.closest('[data-business-link-task]');
        if (linkTaskButton) {
          try {
            linkRecordToTask(linkTaskButton.dataset.businessLinkTask);
          } catch (error) {
            console.error('Falha ao criar a tarefa vinculada ao card:', error);
            if (typeof window.showToast === 'function') window.showToast('Não foi possível criar a tarefa vinculada.');
          }
        }
      });
      businessRoot.addEventListener('dragstart', function (event) {
        const contentCard = event.target.closest('[data-marketing-record]');
        if (!contentCard || activeBusinessModule !== 'marketing-content-calendar' || marketingContentView !== 'kanban') return;
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', contentCard.dataset.marketingRecord);
        }
        contentCard.classList.add('is-dragging');
      });
      businessRoot.addEventListener('dragover', function (event) {
        const dropColumn = event.target.closest('[data-marketing-drop]');
        if (!dropColumn || activeBusinessModule !== 'marketing-content-calendar') return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        dropColumn.classList.add('is-drop-target');
      });
      businessRoot.addEventListener('dragleave', function (event) {
        const dropColumn = event.target.closest('[data-marketing-drop]');
        if (dropColumn && !dropColumn.contains(event.relatedTarget)) dropColumn.classList.remove('is-drop-target');
      });
      businessRoot.addEventListener('drop', function (event) {
        const dropColumn = event.target.closest('[data-marketing-drop]');
        if (!dropColumn || activeBusinessModule !== 'marketing-content-calendar') return;
        event.preventDefault();
        dropColumn.classList.remove('is-drop-target');
        const recordId = event.dataTransfer && event.dataTransfer.getData('text/plain');
        if (recordId) moveMarketingContent(recordId, dropColumn.dataset.marketingDrop);
      });
      businessRoot.addEventListener('dragend', function (event) {
        const contentCard = event.target.closest('[data-marketing-record]');
        if (contentCard) contentCard.classList.remove('is-dragging');
        businessRoot.querySelectorAll('.marketing-content-column.is-drop-target').forEach(function (column) {
          column.classList.remove('is-drop-target');
        });
      });
      businessRoot.addEventListener('input', function (event) {
        const employeeSearch = event.target.closest('[data-employee-search]');
        if (employeeSearch) {
          const query = employeeSearch.value.trim().toLocaleLowerCase('pt-BR');
          const list = businessRoot.querySelector('[data-employee-list]');
          if (!list) return;
          list.innerHTML = renderEmployeeControlRows(query);
          return;
        }
        const search = event.target.closest('[data-business-search]');
        if (search) {
          businessSearch = search.value;
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module && (module.id === 'marketing-insights' || module.id === 'marketing-materials')) {
            refreshMarketingSpecialModule(module.id, true);
          } else if (module) {
            renderBusinessRecordList(module, businessSearch);
          }
        }
      });
      businessRoot.addEventListener('change', function (event) {
        const contentFilter = event.target.closest('[data-marketing-filter]');
        if (contentFilter) {
          marketingContentFilters[contentFilter.dataset.marketingFilter] = contentFilter.value;
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }), businessSearch);
          return;
        }
        const contentDate = event.target.closest('[data-marketing-date]');
        if (contentDate) {
          marketingContentFilters[contentDate.dataset.marketingDate] = contentDate.value;
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'marketing-content-calendar'; }), businessSearch);
          return;
        }
        const insightsFilter = event.target.closest('[data-marketing-insight-filter]');
        if (insightsFilter) {
          marketingInsightsFilters[insightsFilter.dataset.marketingInsightFilter] = insightsFilter.value;
          renderBusinessModule('marketing-insights');
          return;
        }
        const comparisonMonth = event.target.closest('[data-marketing-compare]');
        if (comparisonMonth) {
          marketingComparisonMonths[comparisonMonth.dataset.marketingCompare] = comparisonMonth.value;
          renderBusinessModule('marketing-insights');
          return;
        }
        if (event.target.matches('[data-marketing-compare-metric]')) {
          marketingInsightsFilters.metric = event.target.value;
          renderBusinessModule('marketing-insights');
          return;
        }
        const hrFilter = event.target.closest('[data-hr-filter]');
        if (hrFilter) {
          hrTrainingFilters[hrFilter.dataset.hrFilter] = hrFilter.value;
          renderBusinessRecordList(BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'hr-training'; }), businessSearch);
          return;
        }
        if (event.target.matches('[data-quality-indicator-filter]')) {
          qualityIndicatorFilter = event.target.value;
          renderBusinessModule(activeBusinessModule);
          return;
        }
        const kaizenStatus = event.target.closest('[data-quality-kaizen-status]');
        if (kaizenStatus) {
          const record = (dashboardState.businessCardRecords || []).find(function (item) {
            return String(item.id) === String(kaizenStatus.dataset.recordId) && item.moduleKey === 'quality-kaizen' && !item.archived;
          });
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === 'quality-kaizen'; });
          if (!record || !module || !canAccessBusinessCard(module, dashboardState)) return;
          const result = window.RildonXStore.updateBusinessCardRecord(record.id, { status: kaizenStatus.value });
          if (!result) {
            if (typeof window.showToast === 'function') window.showToast('Não foi possível atualizar a etapa da sugestão.');
            return;
          }
          renderBusinessRecordList(module, businessSearch);
          return;
        }
        if (event.target.matches('[data-business-archived]')) {
          includeArchived = event.target.checked;
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module) renderBusinessRecordList(module, businessSearch);
        }
        if (event.target.matches('[data-business-filter]')) {
          businessFilterValue = event.target.value;
          const module = BUSINESS_CARD_MODULES.find(function (item) { return item.id === activeBusinessModule; });
          if (module) renderBusinessRecordList(module, businessSearch);
        }
      });
      businessRoot.addEventListener('submit', function (event) {
        const reportForm = event.target.closest('[data-marketing-report-upload]');
        if (reportForm) {
          event.preventDefault();
          const submitButton = reportForm.querySelector('[type="submit"]');
          if (submitButton) submitButton.disabled = true;
          saveMarketingReportUpload(reportForm).catch(function (error) {
            console.error('Falha ao importar o relatório de Marketing:', error);
            if (submitButton) submitButton.disabled = false;
            if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível importar o relatório.');
          });
          return;
        }
        const materialForm = event.target.closest('[data-marketing-material-upload]');
        if (materialForm) {
          event.preventDefault();
          const submitButton = materialForm.querySelector('[type="submit"]');
          if (submitButton) submitButton.disabled = true;
          saveMarketingMaterialUpload(materialForm).catch(function (error) {
            console.error('Falha ao salvar o material de Branding:', error);
            if (submitButton) submitButton.disabled = false;
            if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível salvar o material.');
          });
          return;
        }
        const participantForm = event.target.closest('[data-hr-participant-form]');
        if (participantForm) {
          event.preventDefault();
          const submitButton = participantForm.querySelector('[type="submit"]');
          if (submitButton) submitButton.disabled = true;
          try {
            saveHrParticipantForm(participantForm);
          } catch (error) {
            console.error('Falha ao atualizar a participação individual:', error);
            if (submitButton) submitButton.disabled = false;
            if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível atualizar a participação.');
          }
          return;
        }
        const form = event.target.closest('[data-business-form]');
        if (!form) return;
        event.preventDefault();
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        saveBusinessRecord(form).catch(function (error) {
          console.error('Falha ao salvar o registro do card:', error);
          if (submitButton) submitButton.disabled = false;
          if (typeof window.showToast === 'function') {
            window.showToast(error && error.message ? error.message : 'Não foi possível salvar o registro. Tente novamente.');
          }
        });
      });
    }

    if (dashboardRoot) {
      dashboardRoot.addEventListener('pointerdown', function (event) {
        const card = event.target.closest('.dashboard-card');
        const header = event.target.closest('.dashboard-card-header');
        dragCandidateDashboardCard = event.button === 0 && card && header && !event.target.closest('button, a')
          ? card
          : null;
      });
      dashboardRoot.addEventListener('click', function (event) {
        const ticketLink = event.target.closest('[data-support-ticket-open]');
        if (ticketLink) {
          event.preventDefault();
          if (window.RildonXSupport && typeof window.RildonXSupport.open === 'function') {
              window.RildonXSupport.open({ ticketId: ticketLink.dataset.supportTicketOpen });
          }
          return;
        }
        const removeButton = event.target.closest('[data-card-remove]');
        if (removeButton) {
          const config = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
          const card = config.cards.find(function (item) { return item.id === removeButton.dataset.cardRemove; });
          if (!card) return;
          config.cards = config.cards.filter(function (item) { return item.id !== card.id; });
          persistDashboard(config);
          render();
          if (typeof window.showToast === 'function') window.showToast((card.title || CARD_CATALOG[card.type].label) + ' foi removido do Meu Espaço.');
          return;
        }
        const resizeButton = event.target.closest('[data-card-resize]');
        if (resizeButton) {
          const config = normalizeDashboard(getStoredDashboard() || DEFAULT_DASHBOARD);
          const card = config.cards.find(function (item) { return item.id === resizeButton.dataset.cardResize; });
          if (!card) return;
          card.size = resizeButton.dataset.nextSize;
          persistDashboard(config);
          render();
          return;
        }
        const moduleButton = event.target.closest('[data-business-module-open]');
        if (moduleButton) {
          event.preventDefault();
          openBusinessModule(moduleButton.dataset.businessModuleOpen, moduleButton.dataset.businessRecord);
          return;
        }
      });
      dashboardRoot.addEventListener('dragstart', function (event) {
        const card = event.target.closest('.dashboard-card');
        if (!card || dragCandidateDashboardCard !== card) {
          event.preventDefault();
          return;
        }
        draggedDashboardCard = card;
        card.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', card.dataset.cardId);
        }
      });
      dashboardRoot.addEventListener('dragover', function (event) {
        if (!draggedDashboardCard) return;
        const targetCard = event.target.closest('.dashboard-card');
        if (!targetCard || targetCard === draggedDashboardCard) return;
        event.preventDefault();
        dashboardRoot.querySelectorAll('.dashboard-card.is-dragging-over').forEach(function (card) {
          card.classList.remove('is-dragging-over');
        });
        targetCard.classList.add('is-dragging-over');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      dashboardRoot.addEventListener('drop', function (event) {
        if (!draggedDashboardCard) return;
        const targetCard = event.target.closest('.dashboard-card');
        if (!targetCard || targetCard === draggedDashboardCard) return;
        event.preventDefault();
        dashboardRoot.querySelectorAll('.dashboard-card.is-dragging-over').forEach(function (card) {
          card.classList.remove('is-dragging-over');
        });
        const bounds = targetCard.getBoundingClientRect();
        const sameRow = event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        const after = sameRow
          ? event.clientX > bounds.left + bounds.width / 2
          : event.clientY > bounds.top + bounds.height / 2;
        dashboardRoot.insertBefore(draggedDashboardCard, after ? targetCard.nextSibling : targetCard);
        draggedDashboardCard = null;
        saveRenderedCardOrder();
        if (typeof window.showToast === 'function') window.showToast('Ordem dos painéis atualizada.');
      });
      dashboardRoot.addEventListener('dragend', function () {
        if (draggedDashboardCard) draggedDashboardCard.classList.remove('is-dragging', 'is-dragging-over');
        dashboardRoot.querySelectorAll('.dashboard-card.is-dragging-over').forEach(function (card) {
          card.classList.remove('is-dragging-over');
        });
        draggedDashboardCard = null;
        dragCandidateDashboardCard = null;
      });
    }

    if (homeDashboardRoot) {
      homeDashboardRoot.addEventListener('click', function (event) {
        const ticketLink = event.target.closest('[data-support-ticket-open]');
        if (ticketLink) {
          event.preventDefault();
          if (window.RildonXSupport && typeof window.RildonXSupport.open === 'function') {
          window.RildonXSupport.open({ ticketId: ticketLink.dataset.supportTicketOpen });
          }
          return;
        }
        const businessLink = event.target.closest('[data-business-module-open]');
        if (!businessLink) return;
        event.preventDefault();
        openBusinessModule(businessLink.dataset.businessModuleOpen, businessLink.dataset.businessRecord || '');
      });
    }

    document.addEventListener('click', function (event) {
      const quickAction = event.target.closest('[data-dashboard-action="new-task"]');
      if (!quickAction) return;
      event.preventDefault();
      if (typeof window.openModal === 'function' && document.getElementById('modal-nova-tarefa')) {
        window.openModal('modal-nova-tarefa');
      } else {
        window.location.href = 'tarefas.html';
      }
    });

    if (window.RildonXStore && typeof window.RildonXStore.subscribe === 'function') {
      window.RildonXStore.subscribe(function (nextState) {
        const user = nextState && nextState.user;
        if (user && user.id) {
          authenticatedUserId = user.id;
          if (user.name && !authenticatedUserName) authenticatedUserName = user.name;
          activateUserPreferences(user.id);
        } else {
          authenticatedUserId = '';
        }
        const nextDashboardState = Object.assign({}, businessCardsVerified
          ? nextState
          : Object.assign({}, nextState, { businessCardRecords: [] }), {
          supportTickets: dashboardState.supportTickets || [],
          supportTicketsLoadError: dashboardState.supportTicketsLoadError || '',
          infrastructureAssets: dashboardState.infrastructureAssets || [],
          infrastructureAssetsLoadError: dashboardState.infrastructureAssetsLoadError || ''
        });
        const infrastructureModule = BUSINESS_CARD_MODULES.find(function (module) { return module.id === 'it-infrastructure'; });
        if (!user || !user.id || !infrastructureModule || !canAccessBusinessCard(infrastructureModule, nextDashboardState)) {
          nextDashboardState.infrastructureAssets = [];
          nextDashboardState.infrastructureAssetsLoadError = '';
        }
        dashboardState = nextDashboardState;
        render();
      });
    }

    window.addEventListener('storage', function (event) {
      if (event.key === activeStorageKey || event.key === activeHomeCardsStorageKey) render();
    });
    window.addEventListener('resize', function () {
      window.requestAnimationFrame(function () {
        layoutDashboardCards(dashboardRoot);
      });
    });

    if (window.supabaseClient && window.supabaseClient.auth) {
      window.supabaseClient.auth.getUser().then(function (result) {
        if (result.error) throw result.error;
        const user = result.data && result.data.user;
        if (!user) return;
        authenticatedUserId = user.id;
        const metadata = user.user_metadata || {};
        authenticatedUserLogin = user.email ? user.email.split('@')[0] : metadata.nickname || metadata.username || '';
        authenticatedUserName = metadata.display_name || metadata.full_name || metadata.name || user.email || '';
        activateUserPreferences(user.id);
        render();
      }).catch(function (error) {
        console.error('Não foi possível carregar as preferências personalizadas:', error);
      });
    }

    render();
    if (window.RildonXSync && typeof window.RildonXSync.ready === 'function') {
      window.RildonXSync.ready().then(function () {
        businessCardsVerified = true;
        const syncedState = appState();
        if (syncedState.user && syncedState.user.id) {
          authenticatedUserId = syncedState.user.id;
          activateUserPreferences(syncedState.user.id);
        }
        dashboardState = Object.assign({}, syncedState, {
          businessCardRecords: syncedState.businessCardRecords || [],
          supportTickets: dashboardState.supportTickets || [],
          supportTicketsLoadError: dashboardState.supportTicketsLoadError || '',
          infrastructureAssets: dashboardState.infrastructureAssets || [],
          infrastructureAssetsLoadError: dashboardState.infrastructureAssetsLoadError || '',
          businessCardRecordsLoadError: syncedState.businessCardRecordsLoadError ||
            (!window.supabaseClient ? 'O armazenamento compartilhado não está conectado. Configure o Supabase para criar registros persistentes.' : '')
        });
        render();
        refreshSupportTickets();
        subscribeSupportTickets();
        refreshInfrastructureAssets();
        subscribeInfrastructureAssets();
        openRequestedBusinessCard();
      }).catch(function (error) {
        console.error('Não foi possível confirmar as permissões dos cards por setor:', error);
        dashboardState = Object.assign({}, dashboardState, {
          businessCardRecordsLoadError: 'Não foi possível validar a conexão e as permissões do Supabase. Recarregue a página antes de continuar.'
        });
        render();
      });
    } else {
      businessCardsVerified = true;
      refreshSupportTickets();
      subscribeSupportTickets();
      refreshInfrastructureAssets();
      subscribeInfrastructureAssets();
      openRequestedBusinessCard();
    }

    window.addEventListener('rildonx:support-tickets-updated', refreshSupportTickets);
    window.addEventListener('rildonx:infrastructure-changed', refreshInfrastructureAssets);
  }

  window.rildonDashboard = {
    CARD_CATALOG: CARD_CATALOG,
    DEFAULT_DASHBOARD: clone(DEFAULT_DASHBOARD),
    normalizeDashboard: normalizeDashboard,
    persistDashboard: persistDashboard,
    getStoredDashboard: getStoredDashboard,
    createDashboardEngine: createDashboardEngine,
    renderDashboard: renderDashboard,
    hydrateDashboardControls: hydrateDashboardControls
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.getAttribute('data-page') === 'meuespaco' || document.getElementById('home-dashboard-grid')) {
      createDashboardEngine();
    }
  });
})();
