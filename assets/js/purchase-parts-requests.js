(function () {
  'use strict';

  var MODULE_KEY = 'purchase-parts-requests';
  var mountedRoot = null;
  var records = [];
  var isBuyer = false;
  var userName = '';
  var search = '';
  var statusFilter = '';
  var supplierFilter = '';
  var requesterFilter = '';
  var attendantFilter = '';
  var dateFrom = '';
  var dateTo = '';
  var activeTab = 'pendentes';
  var selectedId = '';
  var editingResponse = false;
  var requestDraft = null;
  var responseDraft = null;
  var loadError = '';
  var supplierError = '';
  var supplierOptions = [];
  var supplierRecords = [];
  var supplierModalOpen = false;
  var supplierEditingId = '';
  var supplierDraft = '';
  var notice = '';
  var pendingRequestId = '';
  var channel = null;
  var refreshTimer = null;
  var pollTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getRequest(record) {
    return record && record.data && typeof record.data === 'object' ? record.data : {};
  }

  function getResponse(record) {
    var response = getRequest(record).response;
    return response && typeof response === 'object' ? response : {};
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
  }

  function setNotice(message, isError) {
    notice = message ? '<div class="ppr-notice' + (isError ? ' is-error' : '') + '" role="status">' + escapeHtml(message) + '</div>' : '';
  }

  function createRequestId() {
    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
      throw new Error('Este navegador não permite gerar um identificador seguro. Atualize o navegador e tente novamente.');
    }
    return window.crypto.randomUUID();
  }

  function todayLocal() {
    var now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function emptyRequestDraft() {
    return { requestDate: todayLocal(), reference: '', partName: '', quantity: '', supplierChoice: '', supplierOther: '', salesNotes: '' };
  }

  function rememberForm(form, target) {
    Array.prototype.forEach.call(form.elements, function (field) {
      if (field.name && Object.prototype.hasOwnProperty.call(target, field.name)) target[field.name] = field.value;
    });
  }

  function cleanup() {
    if (channel && window.supabaseClient && typeof window.supabaseClient.removeChannel === 'function') {
      window.supabaseClient.removeChannel(channel);
    }
    if (refreshTimer) window.clearTimeout(refreshTimer);
    if (pollTimer) window.clearInterval(pollTimer);
    channel = null;
    refreshTimer = null;
    pollTimer = null;
  }

  function sortedRecords() {
    var needle = normalize(search);
    return records.filter(function (record) {
      var request = getRequest(record);
      var response = getResponse(record);
      var status = normalize(record.status || 'Pendente');
      var requestDate = String(request.requestDate || '');
      var matchesText = !needle || [
        record.title, request.reference, request.partName, request.supplier,
        request.requesterName, request.salesNotes
      ].some(function (value) { return normalize(value).indexOf(needle) !== -1; });
      return matchesText &&
        (!statusFilter || status === normalize(statusFilter)) &&
        (!supplierFilter || normalize(request.supplier) === normalize(supplierFilter)) &&
        (!requesterFilter || normalize(request.requesterName) === normalize(requesterFilter)) &&
        (!attendantFilter || normalize(response.attendant) === normalize(attendantFilter)) &&
        (!dateFrom || requestDate >= dateFrom) &&
        (!dateTo || requestDate <= dateTo) &&
        (activeTab === 'pendentes' ? status === 'pendente' : status !== 'pendente');
    }).slice().sort(function (first, second) {
      var firstPending = normalize(first.status || 'Pendente') === 'pendente';
      var secondPending = normalize(second.status || 'Pendente') === 'pendente';
      if (isBuyer && firstPending !== secondPending) return firstPending ? -1 : 1;
      return new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime();
    });
  }

  function filterOptions(values, selected, allLabel) {
    var unique = Array.from(new Set(values.map(function (value) { return String(value || '').trim(); }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    return '<option value="">' + escapeHtml(allLabel) + '</option>' + unique.map(function (value) {
      return '<option value="' + escapeHtml(value) + '"' + (normalize(selected) === normalize(value) ? ' selected' : '') + '>' +
        escapeHtml(value) + '</option>';
    }).join('');
  }

  function statusClass(status) {
    var key = normalize(status || 'Pendente');
    if (key === 'atendido') return 'is-complete';
    if (key === 'nao atendido' || key === 'negado') return 'is-rejected';
    return 'is-pending';
  }

  function renderList() {
    var rows = sortedRecords();
    if (!rows.length) {
      return '<div class="ppr-empty"><b>Nenhuma sinalização encontrada</b><span>' +
        (records.length ? 'Ajuste os filtros para consultar outros registros.' : 'As novas sinalizações aparecerão nesta fila compartilhada.') +
        '</span></div>';
    }
    return '<div class="ppr-table-wrap"><table class="ppr-table"><thead><tr><th>Data</th><th>Solicitante</th><th>Fornecedor</th>' +
      '<th>Produto</th>' + (isBuyer ? '<th>Atendente de Compras</th>' : '') + '<th>Situação</th><th></th></tr></thead><tbody>' + rows.map(function (record) {
        var request = getRequest(record);
        var status = record.status || 'Pendente';
        var action = isBuyer && normalize(status) === 'pendente' ? 'Responder' : 'Ver';
        var response = getResponse(record);
        return '<tr><td>' + escapeHtml(formatDate(request.requestDate)) + '</td><td>' + escapeHtml(request.requesterName || 'Usuário') +
          '</td><td>' + escapeHtml(request.supplier || '—') + '</td><td><strong>' + escapeHtml(request.partName || record.title) +
          '</strong><small>' + escapeHtml(request.reference || 'Sem referência') + ' · Qtd. ' + escapeHtml(request.quantity || '—') +
          '</small></td>' + (isBuyer ? '<td>' + escapeHtml(response.attendant || '—') + '</td>' : '') +
          '<td><span class="ppr-status ' + statusClass(status) + '">' + escapeHtml(status) +
          '</span></td><td><button class="btn secondary ppr-row-action" type="button" data-request-open="' + escapeHtml(record.id) + '">' +
          action + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderDetail(record) {
    if (!record) return '';
    var request = getRequest(record);
    var response = getResponse(record);
    var history = Array.isArray(response.history) ? response.history.slice().reverse() : [];
    var canEdit = isBuyer && editingResponse;
    var responseMarkup = canEdit
      ? '<form class="ppr-reply-form" data-reply-form><h4>Resposta de Compras</h4><div class="ppr-form-grid">' +
        '<label class="ppr-field">Atendente<input value="' + escapeHtml(userName) + '" readonly></label>' +
        '<label class="ppr-field">Situação<select name="status" required><option value="Pendente"' + (normalize(responseDraft.status) === 'pendente' ? ' selected' : '') +
        '>Pendente</option><option value="Atendido"' + (normalize(responseDraft.status) === 'atendido' ? ' selected' : '') +
        '>Atendido</option><option value="Não Atendido"' + (normalize(responseDraft.status) === 'nao atendido' ? ' selected' : '') +
        '>Não Atendido</option></select></label><label class="ppr-field">Previsão de chegada<input type="date" name="expectedDate" value="' +
        escapeHtml(responseDraft.expectedDate || '') + '"></label><label class="ppr-field ppr-field-wide">Observação de Compras<textarea name="notes" rows="3" maxlength="2000">' +
        escapeHtml(responseDraft.notes || '') + '</textarea></label></div><div class="ppr-actions"><button class="btn secondary" type="button" data-request-back>Voltar</button>' +
        '<button class="btn" type="submit">Salvar resposta</button></div></form>'
      : '<section class="ppr-response"><h4>Resposta de Compras</h4><dl class="ppr-detail-grid"><div><dt>Situação</dt><dd><span class="ppr-status ' +
        statusClass(record.status) + '">' + escapeHtml(record.status || 'Pendente') + '</span></dd></div><div><dt>Atendente</dt><dd>' +
        escapeHtml(response.attendant || '—') + '</dd></div><div><dt>Data da resposta</dt><dd>' + escapeHtml(formatDate(response.respondedAt)) +
        '</dd></div><div><dt>Previsão de chegada</dt><dd>' + escapeHtml(formatDate(response.expectedDate)) + '</dd></div><div class="ppr-detail-wide"><dt>Observação</dt><dd>' +
        escapeHtml(response.notes || '—') + '</dd></div></dl>' + (!response.respondedAt ? '<p class="ppr-waiting">Aguardando resposta de Compras.</p>' : '') +
          (history.length ? '<details class="ppr-history"><summary>Histórico de respostas (' + history.length + ')</summary><ol>' +
            history.map(function (entry) {
              return '<li><strong>' + escapeHtml(entry.status || 'Atualização') + '</strong><span>' +
                escapeHtml(entry.attendant || entry.actorId || 'Compras') + ' · ' + escapeHtml(formatDate(entry.at)) +
                (entry.expectedDate ? ' · Previsão: ' + escapeHtml(formatDate(entry.expectedDate)) : '') +
                (entry.notes ? '<br>' + escapeHtml(entry.notes) : '') + '</span></li>';
            }).join('') + '</ol></details>' : '') +
          (isBuyer ? '<div class="ppr-actions"><button class="btn secondary" type="button" data-request-back>Voltar à fila</button>' +
          '<button class="btn" type="button" data-request-edit>Editar resposta</button></div>' :
          '<div class="ppr-actions"><button class="btn secondary" type="button" data-request-back>Voltar à fila</button></div>') + '</section>';
    return '<section class="ppr-detail"><div class="ppr-detail-heading"><div><span class="ppr-eyebrow">Sinalização · ' +
      escapeHtml(formatDate(request.requestDate)) + '</span><h3>' + escapeHtml(request.partName || record.title) + '</h3></div>' +
      '<span class="ppr-status ' + statusClass(record.status) + '">' + escapeHtml(record.status || 'Pendente') + '</span></div>' +
      '<h4>Dados de Vendas</h4><dl class="ppr-detail-grid"><div><dt>Solicitante</dt><dd>' + escapeHtml(request.requesterName || 'Usuário') +
      '</dd></div><div><dt>Referência</dt><dd>' + escapeHtml(request.reference || '—') + '</dd></div><div><dt>Quantidade</dt><dd>' +
      escapeHtml(request.quantity || '—') + '</dd></div><div><dt>Fornecedor / fabricante</dt><dd>' + escapeHtml(request.supplier || '—') +
      '</dd></div><div class="ppr-detail-wide"><dt>Observação de Vendas</dt><dd>' + escapeHtml(request.salesNotes || '—') +
      '</dd></div></dl>' + responseMarkup + '</section>';
  }

  function render() {
    if (!mountedRoot || !mountedRoot.isConnected) return;
    var selected = records.find(function (record) { return String(record.id) === String(selectedId); });
    var pendingCount = records.filter(function (record) { return normalize(record.status || 'Pendente') === 'pendente'; }).length;
    var answeredCount = records.length - pendingCount;
    var supplierSelectOptions = '<option value="">Selecione um fornecedor</option>' + supplierOptions.map(function (supplier) {
      return '<option value="' + escapeHtml(supplier) + '"' + (requestDraft.supplierChoice === supplier ? ' selected' : '') + '>' +
        escapeHtml(supplier) + '</option>';
    }).join('') + '<option value="__other__"' + (requestDraft.supplierChoice === '__other__' ? ' selected' : '') + '>Outro</option>';
    if (requestDraft.supplierChoice && requestDraft.supplierChoice !== '__other__' &&
        supplierOptions.indexOf(requestDraft.supplierChoice) === -1) {
      supplierSelectOptions = '<option value="' + escapeHtml(requestDraft.supplierChoice) + '" selected>' +
        escapeHtml(requestDraft.supplierChoice) + '</option>' + supplierSelectOptions;
    }
    var requesterNames = records.map(function (record) { return getRequest(record).requesterName; });
    var attendants = records.map(function (record) { return getResponse(record).attendant; });
    var suppliers = records.map(function (record) { return getRequest(record).supplier; });
    var supplierSelectOptions = '<option value="">Selecione um fornecedor</option>' + supplierOptions.map(function (supplier) {
      return '<option value="' + escapeHtml(supplier) + '"' + (requestDraft.supplierChoice === supplier ? ' selected' : '') + '>' +
        escapeHtml(supplier) + '</option>';
    }).join('') + '<option value="__other__"' + (requestDraft.supplierChoice === '__other__' ? ' selected' : '') + '>Outro</option>';
    if (requestDraft.supplierChoice && requestDraft.supplierChoice !== '__other__' &&
        supplierOptions.indexOf(requestDraft.supplierChoice) === -1) {
      supplierSelectOptions = '<option value="' + escapeHtml(requestDraft.supplierChoice) + '" selected>' +
        escapeHtml(requestDraft.supplierChoice) + '</option>' + supplierSelectOptions;
    }
    mountedRoot.innerHTML = '<div class="ppr-panel">' + notice + (loadError ? '<div class="ppr-notice is-error" role="alert">' + escapeHtml(loadError) + '</div>' : '') +
      '<div class="ppr-summary"><article><small>Total de sinalizações</small><strong>' + records.length + '</strong></article>' +
      '<article class="is-pending"><small>Pendentes</small><strong>' + pendingCount + '</strong></article><article class="is-complete"><small>Respondidas</small><strong>' +
      answeredCount + '</strong></article></div>' +
      (!isBuyer ? '<div class="ppr-create-action"><button class="btn" type="button" data-toggle-request>' +
        (requestDraft.open ? 'Cancelar sinalização' : 'Sinalizar produto') + '</button></div>' +
        (requestDraft.open ? '<section class="ppr-create"><form data-request-form><div class="ppr-form-grid">' +
        '<label class="ppr-field">Data da sinalização<input type="date" name="requestDate" required value="' + escapeHtml(requestDraft.requestDate) + '"></label>' +
        '<label class="ppr-field">Solicitante<input value="' + escapeHtml(userName) + '" readonly></label>' +
        '<label class="ppr-field">Referência do produto<input name="reference" required maxlength="120" value="' + escapeHtml(requestDraft.reference) + '"></label>' +
        '<label class="ppr-field">Produto<input name="partName" required maxlength="160" value="' + escapeHtml(requestDraft.partName) + '"></label>' +
        '<label class="ppr-field">Quantidade<input type="number" name="quantity" min="1" step="1" required value="' + escapeHtml(requestDraft.quantity) + '"></label>' +
        '<label class="ppr-field">Fornecedor ou fabricante<select name="supplierChoice" required>' + supplierSelectOptions + '</select></label>' +
        (requestDraft.supplierChoice === '__other__' ? '<label class="ppr-field">Informe o fornecedor<input name="supplierOther" required maxlength="160" value="' +
          escapeHtml(requestDraft.supplierOther) + '"></label>' : '') +
        '<label class="ppr-field ppr-field-wide">Observação de Vendas<textarea name="salesNotes" rows="2" maxlength="2000">' +
        escapeHtml(requestDraft.salesNotes) + '</textarea></label></div>' +
        (supplierError ? '<div class="ppr-notice is-error" role="alert">' + escapeHtml(supplierError) +
          ' Ainda é possível escolher “Outro” e informar o nome manualmente.</div>' : '') +
        '<div class="ppr-actions"><button class="btn" type="submit">Enviar sinalização</button></div></form></section>' : '') : '') +
      (selected ? renderDetail(selected) : '<div class="ppr-list-card"><div class="ppr-list-heading"><div><h3>' + (isBuyer ? 'Sinalizações recebidas' : 'Produtos sinalizados') +
        '</h3><p>' + (isBuyer ? 'Fila compartilhada de Vendas e Compras' : 'Acompanhe as respostas de Compras') + '</p></div>' +
        (isBuyer ? '<button class="btn secondary" type="button" data-supplier-manager>Gerenciar fornecedores</button>' : '') + '</div>' +
        '<div class="ppr-tabs" role="tablist" aria-label="Situação das sinalizações">' +
        '<button type="button" role="tab" aria-selected="' + (activeTab === 'pendentes' ? 'true' : 'false') + '" data-tab="pendentes">Pendentes (' + pendingCount + ')</button>' +
        '<button type="button" role="tab" aria-selected="' + (activeTab === 'respondidas' ? 'true' : 'false') + '" data-tab="respondidas">Respondidas (' + answeredCount + ')</button></div>' +
        '<div class="ppr-filters">' +
        '<label>Pesquisar produto ou referência<input type="search" data-search value="' + escapeHtml(search) + '" placeholder="Produto ou referência"></label>' +
        '<label>Status<select data-status-filter>' + filterOptions(['Pendente', 'Atendido', 'Não Atendido'], statusFilter, 'Todos') + '</select></label>' +
        '<label>Fornecedor<select data-supplier-filter>' + filterOptions(suppliers, supplierFilter, 'Todos') + '</select></label>' +
        '<label>Solicitante<select data-requester-filter>' + filterOptions(requesterNames, requesterFilter, 'Todos') + '</select></label>' +
        '<label>Atendente de Compras<select data-attendant-filter>' + filterOptions(attendants, attendantFilter, 'Todos') + '</select></label>' +
        '<label class="ppr-date-filter">Data inicial<input type="date" data-date-from value="' + escapeHtml(dateFrom) + '"></label>' +
        '<label class="ppr-date-filter">Data final<input type="date" data-date-to value="' + escapeHtml(dateTo) + '"></label>' +
        '</div>' + renderList() + '</div>') +
      (supplierModalOpen ? renderSupplierManager() : '') + '</div>';
  }

  function renderSupplierManager() {
    var rows = supplierRecords.map(function (supplier) {
      return '<tr><td>' + escapeHtml(supplier.title) + '</td><td><span class="ppr-status ' +
        (supplier.status === 'Inativo' ? 'is-rejected' : 'is-complete') + '">' + escapeHtml(supplier.status || 'Ativo') +
        '</span></td><td><button class="btn secondary" type="button" data-supplier-edit="' + escapeHtml(supplier.id) + '">Editar</button> ' +
        '<button class="btn secondary" type="button" data-supplier-toggle="' + escapeHtml(supplier.id) + '">' +
        (supplier.status === 'Inativo' ? 'Ativar' : 'Inativar') + '</button> ' +
        '<button class="btn secondary" type="button" data-supplier-delete="' + escapeHtml(supplier.id) + '">Excluir</button></td></tr>';
    }).join('');
    return '<div class="ppr-modal-backdrop"><section class="ppr-supplier-modal" role="dialog" aria-modal="true" aria-labelledby="ppr-supplier-title">' +
      (supplierError ? '<div class="ppr-notice is-error" role="alert">' + escapeHtml(supplierError) + '</div>' : '') +
      '<div class="ppr-detail-heading"><h3 id="ppr-supplier-title">Gerenciar fornecedores</h3><button type="button" class="btn secondary" data-supplier-close aria-label="Fechar">Fechar</button></div>' +
      '<form data-supplier-form><label class="ppr-field">Nome do fornecedor<input name="supplierName" maxlength="160" required value="' +
      escapeHtml(supplierDraft) + '"></label><div class="ppr-actions"><button class="btn" type="submit">' +
      (supplierEditingId ? 'Salvar alterações' : 'Adicionar fornecedor') + '</button></div></form>' +
      '<div class="ppr-table-wrap"><table class="ppr-table"><thead><tr><th>Fornecedor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3">Nenhum fornecedor cadastrado.</td></tr>') + '</tbody></table></div></section></div>';
  }

  async function refreshRecords() {
    if (!window.supabaseClient) throw new Error('A conexão compartilhada com o Supabase não está configurada.');
    var result = await window.supabaseClient.from('business_card_records').select('*')
      .eq('module_key', MODULE_KEY).eq('archived', false).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    records = result.data || [];
    loadError = '';
    render();
  }

  async function loadSupplierOptions() {
    if (!window.supabaseClient || typeof window.supabaseClient.rpc !== 'function') {
      throw new Error('A conexão com o catálogo de fornecedores não está disponível.');
    }
    var result = await window.supabaseClient.rpc('get_purchase_parts_supplier_names');
    if (result.error) throw result.error;
    supplierOptions = (result.data || []).map(function (item) { return String(item.name || '').trim(); })
      .filter(Boolean);
    if (isBuyer) {
      var supplierResult = await window.supabaseClient.from('purchase_management_records')
        .select('id,record_type,title,status,data')
        .eq('record_type', 'supplier').order('title');
      if (supplierResult.error) throw supplierResult.error;
      supplierRecords = supplierResult.data || [];
    }
    supplierError = '';
    render();
  }

  async function saveSupplier(form) {
    var name = String(new FormData(form).get('supplierName') || '').trim();
    if (!name) throw new Error('Informe o nome do fornecedor.');
    if (name.length > 160) throw new Error('O nome do fornecedor deve ter no máximo 160 caracteres.');
    var existing = supplierRecords.find(function (item) { return item.id === supplierEditingId; });
    if (supplierRecords.some(function (item) {
      return item.id !== supplierEditingId && normalize(item.title) === normalize(name) && item.status !== 'Inativo';
    })) throw new Error('Já existe um fornecedor ativo com esse nome.');
    var payload = {
      record_type: 'supplier',
      title: name,
      status: existing ? existing.status : 'Ativo',
      data: existing && existing.data || {}
    };
    if (existing) payload.id = existing.id;
    else {
      var authResult = await window.supabaseClient.auth.getUser();
      if (authResult.error) throw authResult.error;
      if (!authResult.data || !authResult.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
      payload.created_by = authResult.data.user.id;
    }
    var result = existing
      ? await window.supabaseClient.from('purchase_management_records').update({
        title: payload.title,
        status: payload.status,
        data: payload.data
      }).eq('id', existing.id).select('*').single()
      : await window.supabaseClient.from('purchase_management_records').insert(payload).select('*').single();
    if (result.error) throw result.error;
    supplierEditingId = '';
    supplierDraft = '';
    setNotice('Fornecedor salvo.', false);
    await loadSupplierOptions();
  }

  async function updateSupplierStatus(id) {
    var supplier = supplierRecords.find(function (item) { return item.id === id; });
    if (!supplier) throw new Error('Fornecedor não encontrado. Atualize a lista e tente novamente.');
    var nextStatus = supplier.status === 'Inativo' ? 'Ativo' : 'Inativo';
    var result = await window.supabaseClient.from('purchase_management_records')
      .update({ status: nextStatus }).eq('id', id).select('*').single();
    if (result.error) throw result.error;
    setNotice('Situação do fornecedor atualizada.', false);
    await loadSupplierOptions();
  }

  async function deleteSupplier(id) {
    var supplier = supplierRecords.find(function (item) { return item.id === id; });
    if (!supplier) throw new Error('Fornecedor não encontrado. Atualize a lista e tente novamente.');
    if (!window.confirm('Excluir o fornecedor "' + supplier.title + '"?')) return;
    var result = await window.supabaseClient.rpc('delete_purchase_parts_supplier', { p_supplier_id: id });
    if (result.error) throw result.error;
    supplierEditingId = '';
    supplierDraft = '';
    setNotice('Fornecedor excluído.', false);
    await loadSupplierOptions();
  }

  function showSupplierError(error) {
    console.error('Não foi possível atualizar o cadastro de fornecedores:', error);
    setNotice(error && error.message || 'Não foi possível atualizar os fornecedores. Tente novamente.', true);
    render();
  }

  async function refreshNotificationSource() {
    if (!window.RildonXSync || typeof window.RildonXSync.refreshBusinessCardRecordsFromSupabase !== 'function') return;
    try {
      await window.RildonXSync.refreshBusinessCardRecordsFromSupabase();
    } catch (error) {
      console.error('A sinalização foi salva, mas a lista global de notificações não pôde ser atualizada:', error);
      setNotice('Salvo, mas não foi possível atualizar as notificações globais. A fila será sincronizada automaticamente.', true);
      render();
    }
  }

  function bindEvents() {
    mountedRoot.addEventListener('input', function (event) {
      if (event.target.matches('[data-search]')) {
        search = event.target.value;
        var cursor = event.target.selectionStart;
        render();
        var searchInput = mountedRoot.querySelector('[data-search]');
        searchInput.focus();
        searchInput.setSelectionRange(cursor, cursor);
      }
      var requestForm = event.target.closest('[data-request-form]');
      if (requestForm) {
        rememberForm(requestForm, requestDraft);
        requestDraft.open = true;
        pendingRequestId = '';
        if (event.target.name === 'supplierChoice') render();
      }
      var responseForm = event.target.closest('[data-reply-form]');
      if (responseForm) rememberForm(responseForm, responseDraft);
    });
    mountedRoot.addEventListener('change', function (event) {
      if (event.target.matches('[data-status-filter]')) {
        statusFilter = event.target.value;
        render();
      }
      if (event.target.matches('[data-supplier-filter]')) { supplierFilter = event.target.value; render(); }
      if (event.target.matches('[data-requester-filter]')) { requesterFilter = event.target.value; render(); }
      if (event.target.matches('[data-attendant-filter]')) { attendantFilter = event.target.value; render(); }
      if (event.target.matches('[data-date-from]')) { dateFrom = event.target.value; render(); }
      if (event.target.matches('[data-date-to]')) { dateTo = event.target.value; render(); }
      var requestForm = event.target.closest('[data-request-form]');
      if (requestForm) {
        rememberForm(requestForm, requestDraft);
        requestDraft.open = true;
        pendingRequestId = '';
        if (event.target.name === 'supplierChoice') render();
      }
      var responseForm = event.target.closest('[data-reply-form]');
      if (responseForm) rememberForm(responseForm, responseDraft);
    });
    mountedRoot.addEventListener('click', function (event) {
      if (event.target.closest('[data-toggle-request]')) {
        requestDraft.open = !requestDraft.open;
        render();
        return;
      }
      var tabButton = event.target.closest('[data-tab]');
      if (tabButton) { activeTab = tabButton.getAttribute('data-tab'); render(); return; }
      if (event.target.closest('[data-supplier-manager]')) {
        supplierModalOpen = true;
        supplierEditingId = '';
        supplierDraft = '';
        render();
        return;
      }
      if (event.target.closest('[data-supplier-close]')) {
        supplierModalOpen = false;
        supplierEditingId = '';
        supplierDraft = '';
        render();
        return;
      }
      var supplierEditButton = event.target.closest('[data-supplier-edit]');
      if (supplierEditButton) {
        supplierEditingId = supplierEditButton.getAttribute('data-supplier-edit');
        var supplierToEdit = supplierRecords.find(function (item) { return item.id === supplierEditingId; });
        supplierDraft = supplierToEdit ? supplierToEdit.title : '';
        render();
        return;
      }
      var supplierToggleButton = event.target.closest('[data-supplier-toggle]');
      if (supplierToggleButton) {
        updateSupplierStatus(supplierToggleButton.getAttribute('data-supplier-toggle')).catch(showSupplierError);
        return;
      }
      var supplierDeleteButton = event.target.closest('[data-supplier-delete]');
      if (supplierDeleteButton) {
        deleteSupplier(supplierDeleteButton.getAttribute('data-supplier-delete')).catch(showSupplierError);
        return;
      }
      var openButton = event.target.closest('[data-request-open]');
      if (openButton) {
        selectedId = openButton.getAttribute('data-request-open');
        var record = records.find(function (item) { return String(item.id) === String(selectedId); });
        editingResponse = Boolean(isBuyer && record && normalize(record.status || 'Pendente') === 'pendente');
        if (record) {
          var response = getResponse(record);
          responseDraft = {
            status: record.status || 'Pendente',
            expectedDate: response.expectedDate || '',
            notes: response.notes || ''
          };
        }
        setNotice('', false);
        render();
        return;
      }
      if (event.target.closest('[data-request-back]')) {
        selectedId = '';
        editingResponse = false;
        setNotice('', false);
        render();
        return;
      }
      if (event.target.closest('[data-request-edit]')) {
        editingResponse = true;
        var selected = records.find(function (record) { return String(record.id) === String(selectedId); });
        var response = getResponse(selected);
        responseDraft = {
          status: selected && selected.status || 'Pendente',
          expectedDate: response.expectedDate || '',
          notes: response.notes || ''
        };
        setNotice('', false);
        render();
      }
    });
    mountedRoot.addEventListener('submit', function (event) {
      if (event.target.matches('[data-request-form]')) {
        event.preventDefault();
        submitRequest(event.target);
      } else if (event.target.matches('[data-reply-form]')) {
        event.preventDefault();
        submitResponse(event.target);
      } else if (event.target.matches('[data-supplier-form]')) {
        event.preventDefault();
        saveSupplier(event.target).catch(showSupplierError);
      }
    });
    mountedRoot.addEventListener('input', function (event) {
      if (event.target.matches('[name="supplierName"]')) supplierDraft = event.target.value;
    });
  }

  async function submitRequest(form) {
    var submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    setNotice('', false);
    var formData = new FormData(form);
    var quantity = Number(formData.get('quantity'));
    if (!Number.isInteger(quantity) || quantity < 1) {
      setNotice('Informe uma quantidade inteira maior que zero.', true);
      render();
      return;
    }
    try {
      if (window.RildonXSync && typeof window.RildonXSync.ready === 'function') await window.RildonXSync.ready();
      var authResult = await window.supabaseClient.auth.getUser();
      if (authResult.error) throw authResult.error;
      var user = authResult.data && authResult.data.user;
      if (!user) throw new Error('Sua sessão expirou. Entre novamente para enviar a sinalização.');
      var supplierChoice = String(formData.get('supplierChoice') || '');
      var supplierName = supplierChoice === '__other__'
        ? String(formData.get('supplierOther') || '').trim()
        : supplierChoice.trim();
      var payload = {
        id: pendingRequestId || createRequestId(),
        module_key: MODULE_KEY,
        sector: 'compras',
        title: String(formData.get('partName') || '').trim(),
        status: 'Pendente',
        data: {
          requestDate: String(formData.get('requestDate') || ''),
          requesterId: user.id,
          requesterName: userName,
          reference: String(formData.get('reference') || '').trim(),
          partName: String(formData.get('partName') || '').trim(),
          quantity: quantity,
          supplier: supplierName,
          salesNotes: String(formData.get('salesNotes') || '').trim(),
          response: { status: 'Pendente', attendant: '', expectedDate: '', notes: '', respondedAt: null, history: [] }
        },
        created_by: user.id
      };
      pendingRequestId = payload.id;
      var result = await window.supabaseClient.from('business_card_records').insert(payload).select('*').single();
      if (result.error && result.error.code === '23505') {
        var duplicate = await window.supabaseClient.from('business_card_records').select('*')
          .eq('id', pendingRequestId).maybeSingle();
        if (duplicate.error) throw duplicate.error;
        if (duplicate.data && duplicate.data.created_by === user.id) result = { data: duplicate.data, error: null };
      }
      if (result.error) throw result.error;
      records = [result.data].concat(records.filter(function (record) { return record.id !== result.data.id; }));
      pendingRequestId = '';
      requestDraft = emptyRequestDraft();
      setNotice('Sinalização enviada para Compras.', false);
      selectedId = '';
      render();
      await refreshNotificationSource();
    } catch (error) {
      console.error('Não foi possível enviar a sinalização de produto:', error);
      setNotice(error.message || 'Não foi possível enviar a sinalização. Tente novamente.', true);
      render();
    }
  }

  async function submitResponse(form) {
    var record = records.find(function (item) { return String(item.id) === String(selectedId); });
    if (!record) {
      setNotice('Esta sinalização não está mais disponível. Atualize a fila.', true);
      render();
      return;
    }
    var submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando…';
    setNotice('', false);
    var formData = new FormData(form);
    rememberForm(form, responseDraft);
    var response = getResponse(record);
    var updatedData = Object.assign({}, getRequest(record), {
      response: Object.assign({}, response, {
        status: String(formData.get('status') || ''),
        attendant: userName,
        expectedDate: String(formData.get('expectedDate') || ''),
        notes: String(formData.get('notes') || '').trim()
      })
    });
    try {
      if (window.RildonXSync && typeof window.RildonXSync.ready === 'function') await window.RildonXSync.ready();
      var authResult = await window.supabaseClient.auth.getUser();
      if (authResult.error) throw authResult.error;
      if (!authResult.data || !authResult.data.user) throw new Error('Sua sessão expirou. Entre novamente para responder.');
      var result = await window.supabaseClient.from('business_card_records').update({
        status: updatedData.response.status,
        data: updatedData
      }).eq('id', record.id).eq('updated_at', record.updated_at).select('*').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        await refreshRecords();
        selectedId = '';
        editingResponse = false;
        setNotice('Outra pessoa atualizou esta solicitação. Revise os dados atualizados antes de responder novamente.', true);
        render();
        return;
      }
      records = records.map(function (item) { return item.id === result.data.id ? result.data : item; });
      editingResponse = false;
      responseDraft = null;
      setNotice('Resposta salva com sucesso.', false);
      render();
      await refreshNotificationSource();
    } catch (error) {
      console.error('Não foi possível salvar a resposta da solicitação:', error);
      setNotice(error.message || 'Não foi possível salvar a resposta. Tente novamente.', true);
      render();
    }
  }

  function mount(root, state, options) {
    cleanup();
    mountedRoot = root;
    options = options || {};
    isBuyer = Boolean(options.isBuyer);
    userName = String(options.userName || 'Usuário').trim();
    if (!requestDraft) requestDraft = emptyRequestDraft();
    loadError = '';
    supplierError = '';
    notice = '';
    render();
    bindEvents();
    Promise.resolve(window.RildonXSync && typeof window.RildonXSync.ready === 'function'
      ? window.RildonXSync.ready()
      : undefined).then(refreshRecords).catch(function (error) {
      console.error('Não foi possível carregar as solicitações de peças:', error);
      loadError = error.message || 'Não foi possível carregar as solicitações.';
      render();
    });
    Promise.resolve(window.RildonXSync && typeof window.RildonXSync.ready === 'function'
      ? window.RildonXSync.ready()
      : undefined).then(loadSupplierOptions).catch(function (error) {
      console.error('Não foi possível carregar os fornecedores da sinalização de produtos:', error);
      supplierError = 'Não foi possível carregar o catálogo de fornecedores.';
      render();
    });
    if (window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
      channel = window.supabaseClient.channel('rildonx-purchase-parts-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_card_records', filter: 'module_key=eq.' + MODULE_KEY }, function () {
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(function () {
            refreshRecords().catch(function (error) {
              console.error('Não foi possível atualizar a fila de solicitações em tempo real:', error);
              loadError = 'A atualização em tempo real falhou. Tente recarregar a página.';
              render();
            });
            refreshNotificationSource();
          }, 150);
        })
        .subscribe(function (status, error) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('A atualização em tempo real das solicitações de peças falhou:', error || status);
          }
        });
    }
    pollTimer = window.setInterval(function () {
      refreshRecords().catch(function (error) {
        console.error('Não foi possível sincronizar a fila de solicitações de peças:', error);
      });
    }, 60000);
  }

  window.RildonXPurchasePartsRequests = { mount: mount };
})();
