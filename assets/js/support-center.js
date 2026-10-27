(function () {
  'use strict';

  var STATUS_OPTIONS = ['Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Encerrado'];
  var PRIORITY_OPTIONS = ['Baixa', 'Normal', 'Alta', 'Urgente'];
  var CATEGORIES = ['Computador', 'Impressora', 'Internet / Rede', 'Sistema', 'E-mail', 'Telefone', 'Celular', 'Equipamento', 'Acesso / Senha', 'Outro'];
  var root;
  var user;
  var profile;
  var canManage = false;
  var tickets = [];
  var history = [];
  var selectedTicketId = '';
  var searchValue = '';
  var statusFilter = '';
  var priorityFilter = '';
  var monthFilter = '';
  var showForm = false;
  var isLoading = false;
  var isOpen = false;
  var openRequestId = 0;
  var realtimeChannel;
  var knownTicketIds = {};
  var notificationPermission = false;
  var openedFromLibrary = false;

  var stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('assets/css/support-center.css?v=20261022f', document.baseURI).href;
  document.head.appendChild(stylesheet);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function showError(message) {
    var target = root && root.querySelector('[data-support-error]');
    if (target) {
      target.textContent = message;
      target.hidden = false;
      return;
    }
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function displayName(userRecord, userProfile) {
    var metadata = userRecord && userRecord.user_metadata || {};
    return userProfile && (userProfile.displayName || userProfile.nickname || userProfile.name) ||
      metadata.display_name || metadata.full_name || metadata.name ||
      String(userRecord && userRecord.email || 'Usuário').split('@')[0];
  }

  function currentUserProfile(state, authUser) {
    var profiles = state && state.profiles || [];
    return profiles.find(function (item) { return item && item.id === authUser.id; }) || {
      id: authUser.id,
      displayName: displayName(authUser, null),
      sector: authUser.user_metadata && authUser.user_metadata.sector || '',
      nickname: authUser.user_metadata && authUser.user_metadata.nickname || '',
      role: authUser.user_metadata && authUser.user_metadata.role || ''
    };
  }

  function getClient() {
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      throw new Error('O serviço compartilhado de suporte não está disponível.');
    }
    return window.supabaseClient;
  }

  async function ensureIdentity() {
    var client = getClient();
    var results = await Promise.all([client.auth.getUser(), client.rpc('support_can_manage_tickets')]);
    var identityResult = results[0];
    var permissionResult = results[1];
    if (identityResult.error) throw identityResult.error;
    if (permissionResult.error) throw permissionResult.error;
    if (!identityResult.data || !identityResult.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
    user = identityResult.data.user;
    profile = currentUserProfile(window.RildonXStore && window.RildonXStore.getState(), user);
    canManage = permissionResult.data === true;
  }

  function formatDate(value, includeTime) {
    if (!value) return '—';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', includeTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' }).format(date);
  }

  function statusClass(status) {
    return normalize(status).replace(/\s+/g, '-');
  }

  function categoryOptions() {
    return CATEGORIES.map(function (item) {
      return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + '</option>';
    }).join('');
  }

  function selectOptions(values, selected) {
    return values.map(function (value) {
      return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' +
        escapeHtml(value) + '</option>';
    }).join('');
  }

  function ticketNumber(ticket) {
    return ticket.ticket_number || 'Chamado';
  }

  function filteredTickets() {
    var query = normalize(searchValue);
    return tickets.filter(function (ticket) {
      var matchesQuery = !query || normalize([
        ticket.ticket_number, ticket.requester_name, ticket.requester_sector, ticket.unit,
        ticket.equipment, ticket.category, ticket.description, ticket.status, ticket.priority
      ].join(' ')).indexOf(query) !== -1;
      var matchesStatus = !statusFilter || ticket.status === statusFilter;
      var matchesPriority = !priorityFilter || ticket.priority === priorityFilter;
      var matchesMonth = !monthFilter || String(ticket.created_at || '').slice(0, 7) === monthFilter;
      var matchesOwner = canManage || ticket.created_by === user.id;
      return matchesQuery && matchesStatus && matchesPriority && matchesMonth && matchesOwner;
    });
  }

  function metricsMarkup() {
    var visibleTickets = tickets.filter(function (ticket) {
      return !monthFilter || String(ticket.created_at || '').slice(0, 7) === monthFilter;
    });
    var openCount = visibleTickets.filter(function (ticket) { return ticket.status === 'Aberto'; }).length;
    var workingCount = visibleTickets.filter(function (ticket) { return ticket.status === 'Em atendimento'; }).length;
    var resolvedCount = visibleTickets.filter(function (ticket) {
      return ticket.status === 'Resolvido' || ticket.status === 'Encerrado';
    }).length;
    return '<div class="support-kpis">' +
      '<div><span>' + (monthFilter ? 'Chamados no mês' : 'Chamados visíveis') + '</span><b>' + visibleTickets.length + '</b></div>' +
      '<div data-tone="red"><span>Abertos</span><b>' + openCount + '</b></div>' +
      '<div data-tone="orange"><span>Em atendimento</span><b>' + workingCount + '</b></div>' +
      '<div data-tone="green"><span>Resolvidos / encerrados</span><b>' + resolvedCount + '</b></div>' +
      '</div>';
  }

  function ticketListMarkup() {
    var rows = filteredTickets();
    if (!rows.length) {
      return '<div class="support-empty"><b>Nenhum chamado encontrado</b><span>' +
        (tickets.length ? 'Ajuste a busca ou os filtros.' : 'Os chamados que você abrir aparecerão aqui.') + '</span></div>';
    }
    return '<div class="support-ticket-list">' + rows.map(function (ticket) {
      return '<button type="button" class="support-ticket-row" data-support-action="open-ticket" data-ticket-id="' + escapeHtml(ticket.id) + '">' +
        '<span class="support-ticket-number">' + escapeHtml(ticketNumber(ticket)) + '</span>' +
        '<span class="support-ticket-main"><b>' + escapeHtml(ticket.requester_name) + '</b><small>' +
        escapeHtml([ticket.category, ticket.unit, ticket.requester_sector].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="support-ticket-badges"><i class="support-status" data-status="' + escapeHtml(statusClass(ticket.status)) + '">' +
        escapeHtml(ticket.status) + '</i><i class="support-priority" data-priority="' + escapeHtml(normalize(ticket.priority)) + '">' +
        escapeHtml(ticket.priority) + '</i></span><span class="support-ticket-date">' + escapeHtml(formatDate(ticket.created_at)) + '</span><span class="support-ticket-arrow">›</span></button>';
    }).join('') + '</div>';
  }

  function requestFormMarkup() {
    var currentSector = profile && profile.sector || '';
    return '<form class="support-form" data-support-form>' +
      '<div class="support-form-grid">' +
      '<label><span>Solicitante</span><input name="requester_name" value="' + escapeHtml(displayName(user, profile)) + '" readonly></label>' +
      '<label><span>Unidade / loja</span><select name="unit"><option value="">Não informada</option><option>Matriz</option><option>Filial</option></select></label>' +
      '<label><span>Setor</span><input name="requester_sector" value="' + escapeHtml(currentSector) + '" placeholder="Seu setor" readonly></label>' +
      '<label><span>Equipamento</span><input name="equipment" maxlength="120" placeholder="Ex.: computador, impressora"></label>' +
      '<label><span>ID RustDesk *</span><input name="rustdesk_id" inputmode="numeric" pattern="[0-9]{6,20}" maxlength="20" required placeholder="Informe o ID deste computador (6 a 20 dígitos)"></label>' +
      '<label><span>Categoria</span><select name="category" required><option value="">Selecione</option>' + categoryOptions() + '</select></label>' +
      '<label><span>Prioridade</span><select name="priority" required>' + selectOptions(PRIORITY_OPTIONS, 'Normal') + '</select></label>' +
      '</div><label class="support-description"><span>Descreva o problema</span><textarea name="description" rows="5" maxlength="4000" required placeholder="O que aconteceu? Desde quando? Qual o impacto no seu trabalho?"></textarea></label>' +
      '<div class="support-form-footer"><a href="https://rustdesk.com/" target="_blank" rel="noopener noreferrer">Acessar site oficial do RustDesk</a>' +
      '<button type="submit" class="btn">Abrir chamado</button></div></form>';
  }

  function renderQueue() {
    var managerActions = canManage
      ? '<label class="support-filter"><span>Status</span><select data-support-filter="status"><option value="">Todos</option>' + selectOptions(STATUS_OPTIONS, statusFilter) + '</select></label>' +
        '<label class="support-filter"><span>Prioridade</span><select data-support-filter="priority"><option value="">Todas</option>' + selectOptions(PRIORITY_OPTIONS, priorityFilter) + '</select></label>' +
        '<label class="support-filter support-month-filter"><span>Mês</span><input type="month" data-support-filter="month" value="' + escapeHtml(monthFilter) + '"></label>' +
        '<button type="button" class="btn secondary" data-support-action="export-csv">Exportar CSV</button>' +
        '<button type="button" class="btn secondary" data-support-action="print-report">Imprimir / PDF</button>'
      : '';
    return (canManage ? metricsMarkup() : '') +
      '<div class="support-toolbar"><label class="support-search"><span aria-hidden="true">⌕</span><input type="search" data-support-search value="' +
      escapeHtml(searchValue) + '" placeholder="' + (canManage ? 'Buscar chamado, solicitante ou equipamento' : 'Buscar nos seus chamados') + '"></label>' +
      managerActions + '</div>' + (isLoading
        ? '<div class="support-loading" role="status"><span class="support-loading-spinner" aria-hidden="true"></span>' +
          '<b>Carregando chamados</b><span>A fila será atualizada assim que a sincronização terminar.</span></div>'
        : ticketListMarkup());
  }

  function historyMarkup() {
    if (!history.length) return '<div class="support-empty support-history-empty">Nenhum registro no histórico.</div>';
    return '<ol class="support-history">' + history.map(function (entry) {
      return '<li><span class="support-history-dot"></span><div><div class="support-history-meta"><b>' +
        escapeHtml(entry.actor_name || 'Sistema') + '</b><time>' + escapeHtml(formatDate(entry.created_at, true)) +
        '</time></div><small>' + escapeHtml(entry.event_type || 'Atualização') + '</small><p>' +
        escapeHtml(entry.description) + '</p></div></li>';
    }).join('') + '</ol>';
  }

  function ticketDetailMarkup(ticket) {
    var managerProfiles = (window.RildonXStore && window.RildonXStore.getState().profiles || [])
      .filter(function (item) {
        if (!item || item.active === false || !item.id) return false;
        var sector = normalize(item.sector);
        var role = normalize(item.role);
        var nickname = normalize(item.nickname);
        return sector === 'ti' || sector.indexOf('tecnologia') === 0 || sector.indexOf('infra') === 0 ||
          sector.indexOf('ger') === 0 || sector.indexOf('gest') === 0 || sector.indexOf('dir') === 0 ||
          /adm|gerente|gestor|diretor/.test(role) || nickname === 'adson.ri';
      })
      .map(function (item) {
        var label = item.displayName || item.nickname || item.name || 'Usuário';
        return '<option value="' + escapeHtml(item.id) + '"' + (item.id === ticket.assigned_to ? ' selected' : '') + '>' +
          escapeHtml(label) + '</option>';
      }).join('');
    var managerFields = canManage
      ? '<div class="support-detail-controls"><label><span>Status</span><select name="status" data-support-status>' +
        selectOptions(STATUS_OPTIONS, ticket.status) + '</select></label><label><span>Prioridade</span><select name="priority" data-support-priority>' +
        selectOptions(PRIORITY_OPTIONS, ticket.priority) + '</select></label><label><span>Responsável</span><select data-support-assigned-to><option value="">Sem atribuição</option>' +
        managerProfiles + '</select></label><label class="support-manager-comment"><span>Observação (opcional)</span><textarea data-support-manager-comment rows="2" maxlength="2000" placeholder="Registrar atualização no histórico"></textarea></label>' +
        '<button type="button" class="btn secondary" data-support-action="assign-self">Atribuir a mim</button>' +
        '<button type="button" class="btn" data-support-action="save-ticket">Salvar atendimento</button></div>'
      : '';
    var remoteActions = canManage && ticket.rustdesk_id
      ? '<div class="support-remote-actions"><button type="button" class="btn secondary" data-support-action="remote-access" data-rustdesk-id="' +
        escapeHtml(ticket.rustdesk_id) + '">Acessar via RustDesk</button><a href="https://rustdesk.com/" target="_blank" rel="noopener noreferrer">Site do RustDesk</a></div>'
      : ticket.rustdesk_id ? '<p class="support-detail-line"><b>ID RustDesk:</b> ' + escapeHtml(ticket.rustdesk_id) + '</p>' : '';
    return '<button type="button" class="support-back" data-support-action="back">‹ Voltar para ' +
      (canManage ? 'a fila' : 'meus chamados') + '</button><div class="support-detail-heading"><div><span class="support-eyebrow">' +
      escapeHtml(ticketNumber(ticket)) + '</span><h3>' + escapeHtml(ticket.category) + '</h3></div><span class="support-status" data-status="' +
      escapeHtml(statusClass(ticket.status)) + '">' + escapeHtml(ticket.status) + '</span></div>' +
      '<div class="support-ticket-details"><p><b>Solicitante:</b> ' + escapeHtml(ticket.requester_name) + '</p>' +
      '<p><b>Unidade:</b> ' + escapeHtml(ticket.unit || 'Não informada') + ' · <b>Setor:</b> ' + escapeHtml(ticket.requester_sector || 'Não informado') + '</p>' +
      '<p><b>Equipamento:</b> ' + escapeHtml(ticket.equipment || 'Não informado') + ' · <b>Prioridade:</b> ' + escapeHtml(ticket.priority) + '</p>' +
      '<p><b>Aberto em:</b> ' + escapeHtml(formatDate(ticket.created_at, true)) + '</p>' +
      '<div class="support-ticket-description"><b>Descrição do problema</b><p>' + escapeHtml(ticket.description) + '</p></div>' +
      remoteActions + '</div>' + managerFields +
      '<section class="support-history-section"><div class="support-section-heading"><div><h3>Histórico do atendimento</h3><p>Atualizações e interações deste chamado</p></div></div>' +
      historyMarkup() + '<form class="support-comment-form" data-support-comment-form><label><span>' +
      (canManage ? 'Registrar observação ou resposta' : 'Enviar informação ao suporte') +
      '</span><textarea name="comment" rows="3" maxlength="2000" required placeholder="Escreva uma atualização para o histórico"></textarea></label>' +
      '<button type="submit" class="btn secondary">Adicionar ao histórico</button></form></section>';
  }

  function shellMarkup() {
    return '<div class="support-center-backdrop" data-support-backdrop>' +
      '<section class="support-center-panel" role="dialog" aria-modal="true" aria-labelledby="support-center-title">' +
      '<header class="support-center-header"><div class="support-center-brand"><span class="support-center-icon">IT</span><div><span class="support-eyebrow">RildonX · Central de atendimento</span>' +
      '<h2 id="support-center-title">Suporte de TI</h2><p>' + (canManage ? 'Gerencie a fila e acompanhe as solicitações.' : 'Abra e acompanhe seus chamados.') +
      '</p></div></div><div class="support-header-actions">' +
      (canManage ? '<button type="button" class="btn secondary" data-support-action="notifications">Ativar alertas</button>' : '') +
      (openedFromLibrary ? '<button type="button" class="support-back-library" data-support-action="back-library">‹ Voltar</button>' : '') +
      '<button type="button" class="support-close" data-support-action="close" aria-label="Fechar">×</button></div></header>' +
      '<div class="support-center-content"><div class="support-error" data-support-error hidden></div>' +
      (canManage ? '<div class="support-mode-switch"><button type="button" data-support-action="show-queue" class="' + (!showForm && !selectedTicketId ? 'active' : '') + '">Fila de chamados</button>' +
        '<button type="button" data-support-action="show-form" class="' + (showForm ? 'active' : '') + '">+ Nova solicitação</button></div>' : '') +
      (selectedTicketId ? '<div data-support-view="detail"></div>' :
        showForm ? '<div class="support-request-view"><div class="support-section-heading"><div><h3>Abrir novo chamado</h3><p>Informe os detalhes para ajudar a equipe a diagnosticar o problema.</p></div></div>' +
          requestFormMarkup() + '</div>' :
          '<div class="support-queue-view"><div class="support-section-heading"><div><h3>' + (canManage ? 'Fila de atendimento' : 'Meus chamados') +
            '</h3><p>' + (canManage ? 'Os chamados de todos os usuários ficam sincronizados nesta fila.' : 'Acompanhe o status e as respostas da equipe de TI.') + '</p></div>' +
            (!canManage ? '<button type="button" class="btn" data-support-action="show-form">+ Abrir chamado</button>' : '') + '</div>' +
            '<div data-support-queue>' + renderQueue() + '</div></div>') + '</div></section></div>';
  }

  function loadingMarkup() {
    return '<div class="support-center-backdrop" data-support-backdrop>' +
      '<section class="support-center-panel" role="dialog" aria-modal="true" aria-labelledby="support-center-title">' +
      '<header class="support-center-header"><div class="support-center-brand"><span class="support-center-icon">IT</span><div>' +
      '<span class="support-eyebrow">RildonX · Central de atendimento</span><h2 id="support-center-title">Suporte de TI</h2>' +
      '<p>Conectando à central de atendimento...</p></div></div><div class="support-header-actions">' +
      (openedFromLibrary ? '<button type="button" class="support-back-library" data-support-action="back-library">‹ Voltar</button>' : '') +
      '<button type="button" class="support-close" data-support-action="close" aria-label="Fechar">×</button></div></header>' +
      '<div class="support-center-content"><div class="support-loading" role="status"><span class="support-loading-spinner" aria-hidden="true"></span>' +
      '<b>Carregando chamados</b><span>Estamos sincronizando suas informações com o servidor.</span></div></div></section></div>';
  }

  function render() {
    if (!root || !isOpen) return;
    var previousSearch = root.querySelector('[data-support-search]');
    if (previousSearch) searchValue = previousSearch.value;
    root.innerHTML = shellMarkup();
    if (selectedTicketId) {
      var ticket = tickets.find(function (item) { return String(item.id) === String(selectedTicketId); });
      var detailRoot = root.querySelector('[data-support-view="detail"]');
      if (!ticket) {
        selectedTicketId = '';
        render();
        return;
      }
      detailRoot.innerHTML = ticketDetailMarkup(ticket);
    }
  }

  async function loadTickets() {
    var result = await getClient().from('support_tickets').select('*').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    tickets = result.data || [];
    tickets.forEach(function (ticket) { knownTicketIds[ticket.id] = true; });
  }

  async function loadHistory(ticketId) {
    var result = await getClient().from('support_ticket_history').select('*')
      .eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (result.error) throw result.error;
    history = result.data || [];
  }

  async function openTicket(ticketId) {
    selectedTicketId = ticketId;
    history = [];
    render();
    try {
      await loadHistory(ticketId);
      render();
    } catch (error) {
      console.error('Não foi possível carregar o histórico do chamado:', error);
      showError(error.message || 'Não foi possível carregar o histórico deste chamado.');
    }
  }

  function subscribeRealtime() {
    if (realtimeChannel || !window.supabaseClient || typeof window.supabaseClient.channel !== 'function') return;
    realtimeChannel = window.supabaseClient.channel('rildonx-support-tickets-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, function (payload) {
        var newRow = payload && payload.new;
        if (payload && payload.eventType === 'INSERT' && newRow && !knownTicketIds[newRow.id] && canManage) {
          if (notificationPermission && 'Notification' in window) {
            new Notification('Novo chamado de TI', {
              body: ticketNumber(newRow) + ' · ' + (newRow.requester_name || 'Usuário') + ' · ' + (newRow.priority || 'Normal')
            });
          }
          if (typeof window.showToast === 'function') window.showToast('Novo chamado recebido: ' + ticketNumber(newRow));
        }
        refresh().catch(function (error) {
          console.error('Não foi possível atualizar os chamados em tempo real:', error);
          if (isOpen) showError(error.message || 'Não foi possível sincronizar os chamados.');
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_history' }, function () {
        if (!selectedTicketId) return;
        loadHistory(selectedTicketId).then(render).catch(function (error) {
          console.error('Não foi possível atualizar o histórico em tempo real:', error);
          if (isOpen) showError(error.message || 'Não foi possível sincronizar o histórico.');
        });
      })
      .subscribe(function (status, error) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('A atualização em tempo real do suporte falhou:', error || status);
        }
      });
  }

  async function refresh() {
    await loadTickets();
    if (selectedTicketId) await loadHistory(selectedTicketId);
    render();
  }

  async function open(options) {
    var requestId = ++openRequestId;
    openedFromLibrary = Boolean(options && options.fromLibrary);
    if (!root) {
      root = document.createElement('div');
      root.id = 'support-center-root';
      root.className = 'support-center-root';
      document.body.appendChild(root);
    }
    selectedTicketId = '';
    history = [];
    searchValue = '';
    statusFilter = '';
    priorityFilter = '';
    monthFilter = '';
    isLoading = true;
    isOpen = true;
    root.classList.add('open');
    root.innerHTML = loadingMarkup();
    try {
      if (window.RildonXSync && typeof window.RildonXSync.ready === 'function') {
        await window.RildonXSync.ready();
      }
      if (!isOpen || requestId !== openRequestId) return;
      await ensureIdentity();
      if (!isOpen || requestId !== openRequestId) return;
      showForm = Boolean(options && options.newTicket) || !canManage;
      render();
      subscribeRealtime();
      await refresh();
      if (!isOpen || requestId !== openRequestId) return;
      isLoading = false;
      render();
      if (options && options.ticketId) {
        await openTicket(options.ticketId);
        return;
      }
      var firstFocusable = root.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
      if (firstFocusable) firstFocusable.focus();
    } catch (error) {
      if (!isOpen || requestId !== openRequestId) return;
      isLoading = false;
      console.error('Não foi possível abrir a central de suporte:', error);
      if (typeof window.showToast === 'function') {
        window.showToast(error.message || 'Não foi possível abrir a central de suporte. Verifique a migração do Supabase.');
      }
      if (root) {
        root.classList.add('open');
        isOpen = true;
        root.innerHTML = '<div class="support-center-backdrop"><section class="support-center-panel support-center-error-panel" role="alertdialog" aria-modal="true">' +
          '<div class="support-error-actions">' + (openedFromLibrary ? '<button type="button" class="support-back-library" data-support-action="back-library">‹ Voltar</button>' : '') +
          '<button type="button" class="support-close" data-support-action="close" aria-label="Fechar">×</button></div>' +
          '<h2>Suporte de TI indisponível</h2><p>' + escapeHtml(error.message || 'Verifique se a migração docs/supabase-support-tickets.sql foi aplicada.') + '</p>' +
          '<p>Confirme a configuração do Supabase e a migração <code>docs/supabase-support-tickets.sql</code>.</p></section></div>';
      }
    }
  }

  function close() {
    openRequestId += 1;
    isOpen = false;
    isLoading = false;
    selectedTicketId = '';
    if (root) {
      root.classList.remove('open');
      root.innerHTML = '';
    }
  }

  function downloadCsv() {
    var rows = filteredTickets();
    var columns = [
      ['Chamado', 'ticket_number'], ['Solicitante', 'requester_name'], ['Unidade', 'unit'],
      ['Setor', 'requester_sector'], ['Equipamento', 'equipment'], ['RustDesk', 'rustdesk_id'],
      ['Categoria', 'category'], ['Prioridade', 'priority'], ['Status', 'status'],
      ['Descrição', 'description'], ['Aberto em', 'created_at']
    ];
    var content = '\ufeff' + [columns.map(function (column) { return column[0]; })]
      .concat(rows.map(function (ticket) {
        return columns.map(function (column) {
          return String(column[1] === 'created_at' ? formatDate(ticket[column[1]], true) : ticket[column[1]] || '')
            .replace(/"/g, '""');
        });
      })).map(function (row) {
        return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
      }).join('\r\n');
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chamados-ti-' + (monthFilter || new Date().toISOString().slice(0, 7)) + '.csv';
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  async function createTicket(form) {
    var data = new FormData(form);
    var payload = {
      p_unit: String(data.get('unit') || ''),
      p_equipment: String(data.get('equipment') || ''),
      p_rustdesk_id: String(data.get('rustdesk_id') || ''),
      p_category: String(data.get('category') || ''),
      p_priority: String(data.get('priority') || 'Normal'),
      p_description: String(data.get('description') || '')
    };
    var submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      var result = await getClient().rpc('create_support_ticket', payload);
      if (result.error) throw result.error;
      var created = result.data;
      if (Array.isArray(created)) created = created[0];
      if (!created || !created.id) throw new Error('O Supabase não confirmou a criação do chamado.');
      showForm = false;
      await refresh();
      window.dispatchEvent(new CustomEvent('rildonx:support-tickets-updated'));
      if (typeof window.showToast === 'function') window.showToast('Chamado ' + ticketNumber(created) + ' aberto com sucesso.');
      await openTicket(created.id);
    } catch (error) {
      console.error('Não foi possível abrir o chamado:', error);
      showError(error.message || 'Não foi possível abrir o chamado.');
      submit.disabled = false;
    }
  }

  async function saveTicket() {
    var ticket = tickets.find(function (item) { return String(item.id) === String(selectedTicketId); });
    if (!ticket) return;
    var statusSelect = root.querySelector('[data-support-status]');
    var prioritySelect = root.querySelector('[data-support-priority]');
    var assignedTo = root.querySelector('[data-support-assigned-to]');
    var commentField = root.querySelector('[data-support-manager-comment]');
    var result = await getClient().rpc('update_support_ticket', {
      p_ticket_id: ticket.id,
      p_status: statusSelect ? statusSelect.value : null,
      p_priority: prioritySelect ? prioritySelect.value : null,
      p_assigned_to: assignedTo ? assignedTo.value || null : null,
      p_comment: commentField ? commentField.value.trim() || null : null
    });
    if (result.error) throw result.error;
    await refresh();
    window.dispatchEvent(new CustomEvent('rildonx:support-tickets-updated'));
    if (typeof window.showToast === 'function') window.showToast('Atendimento atualizado e registrado no histórico.');
  }

  async function addComment(form) {
    var ticket = tickets.find(function (item) { return String(item.id) === String(selectedTicketId); });
    if (!ticket || !user) return;
    var text = new FormData(form).get('comment');
    if (!String(text || '').trim()) return;
    var submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      var result = await getClient().from('support_ticket_history').insert({
        ticket_id: ticket.id,
        actor_id: user.id,
        actor_name: displayName(user, profile),
        event_type: canManage ? 'observação' : 'resposta do solicitante',
        description: String(text).trim()
      });
      if (result.error) throw result.error;
      await loadHistory(ticket.id);
      render();
    } catch (error) {
      console.error('Não foi possível adicionar a atualização ao chamado:', error);
      showError(error.message || 'Não foi possível registrar a atualização.');
      submit.disabled = false;
    }
  }

  async function remoteAccess(button) {
    var id = String(button.dataset.rustdeskId || '').trim();
    var ticket = tickets.find(function (item) { return String(item.id) === String(selectedTicketId); });
    if (!/^\d{6,20}$/.test(id)) {
      showError('O ID RustDesk deste chamado é inválido.');
      return;
    }
    if (!ticket || !window.confirm('Confirmar acesso remoto?\n\nChamado: ' + ticketNumber(ticket) +
        '\nEquipamento: ' + (ticket.equipment || 'Não informado') + '\nID RustDesk: ' + id +
        '\n\nO RustDesk será aberto neste computador.')) return;
    var result = await getClient().from('support_ticket_history').insert({
      ticket_id: ticket.id,
      actor_id: user.id,
      actor_name: displayName(user, profile),
      event_type: 'acesso remoto',
      description: 'Tentativa de abertura do RustDesk para o ID ' + id + '.'
    });
    if (result.error) throw result.error;
    await loadHistory(ticket.id);
    render();
    window.location.href = 'rustdesk://connection/new/' + encodeURIComponent(id);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      showError('Este navegador não oferece suporte a notificações.');
      return;
    }
    notificationPermission = (await Notification.requestPermission()) === 'granted';
    if (!notificationPermission) showError('A permissão para notificações não foi concedida.');
    else if (typeof window.showToast === 'function') window.showToast('Alertas de novos chamados ativados enquanto esta página estiver aberta.');
  }

  function handleClick(event) {
    var action = event.target.closest('[data-support-action]');
    if (!action || !root.contains(action)) {
      if (event.target.matches('[data-support-backdrop]')) close();
      return;
    }
    var type = action.dataset.supportAction;
    if (type === 'close' || type === 'back-library') close();
    else if (type === 'show-form') {
      selectedTicketId = '';
      showForm = true;
      render();
    } else if (type === 'show-queue' || type === 'back') {
      selectedTicketId = '';
      showForm = false;
      render();
    } else if (type === 'open-ticket') {
      openTicket(action.dataset.ticketId);
    } else if (type === 'export-csv') downloadCsv();
    else if (type === 'print-report') window.print();
    else if (type === 'notifications') enableNotifications().catch(function (error) {
      console.error('Não foi possível ativar as notificações:', error);
      showError(error.message || 'Não foi possível ativar as notificações.');
    });
    else if (type === 'save-ticket') {
      action.disabled = true;
      saveTicket().catch(function (error) {
        console.error('Não foi possível atualizar o chamado:', error);
        showError(error.message || 'Não foi possível atualizar o chamado.');
        action.disabled = false;
      });
    } else if (type === 'assign-self') {
      var assignment = root.querySelector('[data-support-assigned-to]');
      if (assignment) assignment.value = user.id;
    } else if (type === 'remote-access') {
      action.disabled = true;
      remoteAccess(action).catch(function (error) {
        console.error('Não foi possível iniciar o acesso remoto:', error);
        showError(error.message || 'Não foi possível registrar o acesso remoto.');
        action.disabled = false;
      });
    }
  }

  function handleInput(event) {
    if (event.target.matches('[data-support-search]')) {
      searchValue = event.target.value;
      var queue = root.querySelector('[data-support-queue]');
      if (queue) queue.innerHTML = renderQueue();
    }
    if (event.target.matches('[data-support-filter="status"]')) statusFilter = event.target.value;
    if (event.target.matches('[data-support-filter="priority"]')) priorityFilter = event.target.value;
    if (event.target.matches('[data-support-filter="month"]')) monthFilter = event.target.value;
    if (event.target.matches('[data-support-filter]')) {
      var filterQueue = root.querySelector('[data-support-queue]');
      if (filterQueue) filterQueue.innerHTML = renderQueue();
    }
  }

  function handleSubmit(event) {
    var form = event.target;
    if (form.matches('[data-support-form]')) {
      event.preventDefault();
      createTicket(form);
    } else if (form.matches('[data-support-comment-form]')) {
      event.preventDefault();
      addComment(form);
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && isOpen) close();
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleInput);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', handleKeydown);

  window.RildonXSupport = {
    open: open,
    close: close,
    openRequest: function () { return open({ newTicket: true }); },
    refresh: refresh
  };
})();
