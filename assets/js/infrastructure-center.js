(function () {
  'use strict';

  var root;
  var assets = [];
  var events = [];
  var activeAssetId = '';
  var search = '';
  var statusFilter = '';
  var categoryFilter = '';
  var dueFilter = '';
  var includeArchived = false;
  var loading = false;
  var errorMessage = '';
  var openedFromLibrary = false;
  var channel;
  var categories = ['Computador', 'Impressora', 'Rede', 'Servidor', 'Sistema', 'Telefonia', 'Veículo', 'Máquina', 'Mobiliário', 'Outro'];
  var statuses = ['Operacional', 'Atenção', 'Indisponível', 'Em manutenção', 'Baixado'];
  var priorities = ['Baixa', 'Normal', 'Alta', 'Crítica'];
  var maintenanceTypes = ['Preventiva', 'Corretiva', 'Inspeção'];
  var style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('assets/css/infrastructure-center.css?v=20261022c', document.baseURI).href;
  document.head.appendChild(style);

  function escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function client() {
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      throw new Error('A conexão compartilhada não está disponível. Verifique o Supabase e recarregue a página.');
    }
    return window.supabaseClient;
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function dateLabel(value) {
    if (!value) return 'Sem data';
    var date = new Date(String(value).slice(0, 10) + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleDateString('pt-BR');
  }

  function localDateValue(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function daysUntil(value) {
    if (!value) return null;
    var date = new Date(String(value).slice(0, 10) + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function assetDueState(asset) {
    var date = daysUntil(asset.next_maintenance_on);
    var threshold = Number(asset.meter_threshold);
    var reading = Number(asset.meter_reading);
    if (date !== null && date < 0) return { key: 'overdue', label: 'Manutenção vencida' };
    if (date !== null && date <= 30) return { key: 'soon', label: date === 0 ? 'Vence hoje' : 'Vence em ' + date + ' dia(s)' };
    if (asset.meter_threshold != null && reading >= threshold) return { key: 'overdue', label: 'Limite de uso atingido' };
    if (asset.meter_threshold != null && threshold > 0 && reading >= threshold * 0.85) return { key: 'soon', label: 'Próximo do limite de uso' };
    if (asset.warranty_until && daysUntil(asset.warranty_until) < 0) return { key: 'warranty', label: 'Garantia vencida' };
    return { key: 'ok', label: 'Em dia' };
  }

  function errorBox(message) {
    return '<div class="infrastructure-error" role="alert">' + escape(message) + '</div>';
  }

  function selectOptions(values, selected) {
    return values.map(function (value) {
      return '<option value="' + escape(value) + '"' + (value === selected ? ' selected' : '') + '>' + escape(value) + '</option>';
    }).join('');
  }

  function field(label, name, value, type, required, options) {
    var control;
    if (type === 'select') {
      control = '<select name="' + name + '"' + (required ? ' required' : '') + '><option value="">Selecione</option>' +
        selectOptions(options || [], value || '') + '</select>';
    } else if (type === 'textarea') {
      control = '<textarea name="' + name + '" rows="3"' + (required ? ' required' : '') + '>' + escape(value || '') + '</textarea>';
    } else {
      control = '<input type="' + (type || 'text') + '" name="' + name + '" value="' + escape(value || '') + '"' +
        (required ? ' required' : '') + (type === 'number' ? ' min="0" step="any"' : '') + '>';
    }
    return '<label class="infrastructure-field"><span>' + escape(label) + (required ? ' *' : '') + '</span>' + control + '</label>';
  }

  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'infrastructure-center-root';
    root.className = 'infrastructure-center-root';
    root.hidden = true;
    document.body.appendChild(root);
    root.addEventListener('click', handleClick);
    root.addEventListener('input', function (event) {
      if (event.target.matches('[data-infrastructure-search]')) {
        search = event.target.value;
        renderList();
      }
    });
    root.addEventListener('change', function (event) {
      if (event.target.matches('[data-infrastructure-status-filter]')) statusFilter = event.target.value;
      if (event.target.matches('[data-infrastructure-category-filter]')) categoryFilter = event.target.value;
      if (event.target.matches('[data-infrastructure-due-filter]')) dueFilter = event.target.value;
      if (event.target.matches('[data-infrastructure-archived-filter]')) includeArchived = event.target.checked;
      if (event.target.matches('[data-infrastructure-status-filter], [data-infrastructure-category-filter], [data-infrastructure-due-filter], [data-infrastructure-archived-filter]')) {
        renderList();
      }
    });
    root.addEventListener('submit', handleSubmit);
    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !root.hidden) close();
    });
  }

  function filteredAssets() {
    return assets.filter(function (asset) {
      if (asset.archived && !includeArchived) return false;
      var query = normalize(search);
      var haystack = normalize([asset.asset_tag, asset.name, asset.category, asset.sector, asset.location,
        asset.manufacturer, asset.model, asset.serial_number, asset.ip_address, asset.responsible].join(' '));
      if (query && haystack.indexOf(query) === -1) return false;
      if (statusFilter && asset.status !== statusFilter) return false;
      if (categoryFilter && asset.category !== categoryFilter) return false;
      var due = assetDueState(asset);
      if (dueFilter === 'overdue' && due.key !== 'overdue') return false;
      if (dueFilter === 'soon' && due.key !== 'soon') return false;
      return true;
    }).sort(function (first, second) {
      var firstDue = daysUntil(first.next_maintenance_on);
      var secondDue = daysUntil(second.next_maintenance_on);
      return (firstDue === null ? 99999 : firstDue) - (secondDue === null ? 99999 : secondDue) ||
        String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR');
    });
  }

  function metricsMarkup() {
    var active = assets.filter(function (asset) { return !asset.archived; });
    var operational = active.filter(function (asset) { return asset.status === 'Operacional'; }).length;
    var inMaintenance = active.filter(function (asset) { return asset.status === 'Em manutenção'; }).length;
    var attention = active.filter(function (asset) {
      var due = assetDueState(asset);
      return due.key === 'overdue' || due.key === 'soon' || asset.status === 'Atenção' || asset.status === 'Indisponível';
    }).length;
    return '<div class="infrastructure-metrics">' +
      '<div><b>' + active.length + '</b><span>Equipamentos ativos</span></div>' +
      '<div><b>' + operational + '</b><span>Operacionais</span></div>' +
      '<div><b>' + attention + '</b><span>Com alerta</span></div>' +
      '<div><b>' + inMaintenance + '</b><span>Em manutenção</span></div></div>';
  }

  function assetCard(asset) {
    var due = assetDueState(asset);
    var location = [asset.sector, asset.location].filter(Boolean).join(' · ');
    var device = [asset.manufacturer, asset.model].filter(Boolean).join(' ');
    return '<article class="infrastructure-asset-card' + (asset.archived ? ' is-archived' : '') + '" data-asset-card="' + escape(asset.id) + '">' +
      '<div class="infrastructure-asset-top"><span class="infrastructure-asset-tag">' + escape(asset.asset_tag || 'Sem patrimônio') +
      '</span><span class="infrastructure-status" data-status="' + escape(normalize(asset.status).replace(/\s+/g, '-')) + '">' + escape(asset.status) + '</span></div>' +
      '<h3>' + escape(asset.name) + '</h3><p class="infrastructure-asset-subtitle">' + escape([asset.category, device].filter(Boolean).join(' · ') || 'Equipamento') + '</p>' +
      '<div class="infrastructure-asset-details"><span>' + escape(location || 'Localização não informada') + '</span>' +
      '<span>Próxima preventiva: ' + escape(dateLabel(asset.next_maintenance_on)) + '</span>' +
      (asset.meter_reading != null ? '<span>Medidor: ' + Number(asset.meter_reading).toLocaleString('pt-BR') +
        (asset.meter_threshold ? ' / ' + Number(asset.meter_threshold).toLocaleString('pt-BR') : '') + '</span>' : '') +
      '<span>Responsável: ' + escape(asset.responsible || 'Não definido') + '</span></div>' +
      (asset.archived ? '<span class="infrastructure-status" data-status="baixado">Arquivado</span>' :
        '<div class="infrastructure-asset-bottom"><span class="infrastructure-due" data-due="' + due.key + '">' + escape(due.label) + '</span>' +
        '<div><button type="button" data-asset-detail="' + escape(asset.id) + '">Histórico</button>' +
        '<button type="button" data-asset-edit="' + escape(asset.id) + '">Editar</button></div></div>') +
      (asset.archived ? '<div class="infrastructure-asset-bottom"><span></span><button type="button" data-asset-restore="' + escape(asset.id) + '">Restaurar</button></div>' : '') +
      '</article>';
  }

  function renderList() {
    if (!root || root.hidden) return;
    var records = filteredAssets();
    var list = root.querySelector('[data-infrastructure-list]');
    if (list) list.innerHTML = records.length
      ? records.map(assetCard).join('')
      : '<div class="infrastructure-empty"><b>Nenhum equipamento nesta visualização</b><span>Cadastre um equipamento ou ajuste os filtros.</span></div>';
    var count = root.querySelector('[data-infrastructure-result-count]');
    if (count) count.textContent = records.length + ' equipamento(s)';
  }

  function render() {
    ensureRoot();
    root.hidden = false;
    var active = assets.filter(function (asset) { return !asset.archived; });
    var flagged = active.filter(function (asset) {
      return ['overdue', 'soon'].indexOf(assetDueState(asset).key) !== -1;
    });
    root.innerHTML = '<div class="infrastructure-backdrop" data-infrastructure-backdrop><section class="infrastructure-panel" role="dialog" aria-modal="true" aria-labelledby="infrastructure-title">' +
      '<header class="infrastructure-header"><div><span class="infrastructure-eyebrow">RildonX · Tecnologia da Informação</span>' +
      '<h2 id="infrastructure-title">Manutenção</h2><p>Inventário, manutenção preventiva e corretiva de equipamentos e serviços.</p></div>' +
      '<div class="infrastructure-header-actions">' + (openedFromLibrary ? '<button type="button" class="infrastructure-back-library" data-infrastructure-library-back>‹ Voltar</button>' : '') +
      '<button type="button" class="infrastructure-close" data-infrastructure-close aria-label="Fechar">×</button></div></header>' +
      (errorMessage ? errorBox(errorMessage) : '') + metricsMarkup() +
      (flagged.length ? '<div class="infrastructure-alert" role="status"><b>' + flagged.length + ' manutenção(ões) exigem atenção</b><span>' +
        escape(flagged.slice(0, 4).map(function (asset) { return asset.name + ' — ' + assetDueState(asset).label; }).join(' · ')) +
        (flagged.length > 4 ? ' · +' + (flagged.length - 4) + ' outro(s)' : '') + '</span></div>' : '') +
      '<div class="infrastructure-toolbar"><label class="infrastructure-search"><span>⌕</span><input type="search" data-infrastructure-search value="' +
      escape(search) + '" placeholder="Buscar patrimônio, equipamento, setor, IP..."></label>' +
      '<select data-infrastructure-status-filter aria-label="Filtrar por status"><option value="">Todos os status</option>' +
      selectOptions(statuses, statusFilter) + '</select><select data-infrastructure-category-filter aria-label="Filtrar por tipo">' +
      '<option value="">Todos os tipos</option>' + selectOptions(categories, categoryFilter) + '</select>' +
      '<select data-infrastructure-due-filter aria-label="Filtrar manutenção"><option value="">Todos os prazos</option>' +
      '<option value="overdue"' + (dueFilter === 'overdue' ? ' selected' : '') + '>Vencidos / limite atingido</option>' +
      '<option value="soon"' + (dueFilter === 'soon' ? ' selected' : '') + '>Próximos 30 dias</option></select>' +
      '<label class="infrastructure-archived-filter"><input type="checkbox" data-infrastructure-archived-filter' + (includeArchived ? ' checked' : '') + '> Incluir arquivados</label>' +
      '<button type="button" class="infrastructure-button infrastructure-button-secondary" data-infrastructure-export>Exportar CSV</button>' +
      '<button type="button" class="infrastructure-button infrastructure-button-primary" data-infrastructure-create>+ Cadastrar equipamento</button></div>' +
      '<div class="infrastructure-list-heading"><b>Equipamentos</b><span data-infrastructure-result-count></span></div>' +
      '<div class="infrastructure-asset-list" data-infrastructure-list>' +
      (loading ? '<div class="infrastructure-empty"><b>Carregando equipamentos...</b></div>' : '') + '</div></section></div>';
    renderList();
    if (loading) {
      var list = root.querySelector('[data-infrastructure-list]');
      if (list) list.innerHTML = '<div class="infrastructure-empty"><b>Carregando equipamentos...</b></div>';
    }
  }

  function renderAssetForm(asset) {
    var current = asset || {};
    var inputs = [
      field('Nome do equipamento ou serviço', 'name', current.name, 'text', true),
      field('Código patrimonial / identificador', 'asset_tag', current.asset_tag, 'text', true),
      field('Categoria', 'category', current.category, 'select', true, categories),
      field('Status operacional', 'status', current.status || 'Operacional', 'select', true, statuses),
      field('Setor', 'sector', current.sector, 'text'),
      field('Local / unidade', 'location', current.location, 'text'),
      field('Fabricante', 'manufacturer', current.manufacturer, 'text'),
      field('Modelo', 'model', current.model, 'text'),
      field('Número de série', 'serial_number', current.serial_number, 'text'),
      field('Endereço IP / hostname', 'ip_address', current.ip_address, 'text'),
      field('Criticidade', 'criticality', current.criticality || 'Normal', 'select', false, priorities),
      field('Responsável', 'responsible', current.responsible, 'text'),
      field('Data de aquisição', 'acquired_on', current.acquired_on, 'date'),
      field('Garantia até', 'warranty_until', current.warranty_until, 'date'),
      field('Última manutenção', 'last_maintenance_on', current.last_maintenance_on, 'date'),
      field('Próxima manutenção', 'next_maintenance_on', current.next_maintenance_on, 'date'),
      field('Repetir preventiva a cada (dias)', 'preventive_interval_days', current.preventive_interval_days, 'number'),
      field('Leitura atual do medidor (páginas/horas/km)', 'meter_reading', current.meter_reading, 'number'),
      field('Próximo limite do medidor', 'meter_threshold', current.meter_threshold, 'number'),
      field('Repetir preventiva a cada (páginas/horas/km)', 'meter_interval', current.meter_interval, 'number'),
      '<label class="infrastructure-field infrastructure-field-wide"><span>Observações e instruções</span><textarea name="notes" rows="3">' + escape(current.notes || '') + '</textarea></label>'
    ].join('');
    root.innerHTML = '<div class="infrastructure-backdrop"><section class="infrastructure-panel infrastructure-form-panel" role="dialog" aria-modal="true" aria-labelledby="infrastructure-form-title">' +
      '<header class="infrastructure-header"><div><button type="button" class="infrastructure-back" data-infrastructure-back>‹ Voltar ao inventário</button>' +
      '<h2 id="infrastructure-form-title">' + (asset ? 'Editar equipamento' : 'Cadastrar equipamento') + '</h2>' +
      '<p>Campos de patrimônio e manutenção ficam compartilhados com a equipe de TI.</p></div>' +
      '<button type="button" class="infrastructure-close" data-infrastructure-close aria-label="Fechar">×</button></header>' +
      '<form data-infrastructure-asset-form data-asset-id="' + escape(current.id || '') + '"><div class="infrastructure-fields">' + inputs +
      '</div><div class="infrastructure-form-actions"><button type="button" class="infrastructure-button infrastructure-button-secondary" data-infrastructure-back>Cancelar</button>' +
      '<button type="submit" class="infrastructure-button infrastructure-button-primary">Salvar equipamento</button></div></form></section></div>';
  }

  function renderHistory(asset) {
    var historyRows = events.map(function (item) {
      return '<article class="infrastructure-history-item"><div class="infrastructure-history-heading"><b>' + escape(item.title) +
        '</b><span data-maintenance-type="' + escape(normalize(item.maintenance_type)) + '">' + escape(item.maintenance_type) + '</span></div>' +
        '<small>' + escape(dateLabel(item.performed_on)) + ' · Responsável: ' + escape(item.technician || item.actor_name || 'Não informado') +
        (item.downtime_minutes ? ' · Indisponível por ' + Number(item.downtime_minutes) + ' min' : '') +
        (item.cost != null ? ' · Custo: R$ ' + Number(item.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '') + '</small>' +
        '<p>' + escape(item.description || 'Sem descrição adicional.') + '</p>' +
        (item.ticket_reference ? '<small>Chamado vinculado: ' + escape(item.ticket_reference) + '</small>' : '') +
        (item.meter_reading != null ? '<small>Medidor: ' + Number(item.meter_reading).toLocaleString('pt-BR') + '</small>' : '') +
        (item.next_maintenance_on ? '<small>Próxima preventiva: ' + escape(dateLabel(item.next_maintenance_on)) + '</small>' : '') +
        '</article>';
    }).join('');
    root.innerHTML = '<div class="infrastructure-backdrop"><section class="infrastructure-panel infrastructure-history-panel" role="dialog" aria-modal="true" aria-labelledby="infrastructure-history-title">' +
      '<header class="infrastructure-header"><div><button type="button" class="infrastructure-back" data-infrastructure-back>‹ Voltar ao inventário</button>' +
      '<span class="infrastructure-eyebrow">' + escape(asset.asset_tag) + ' · ' + escape(asset.category) + '</span>' +
      '<h2 id="infrastructure-history-title">' + escape(asset.name) + '</h2><p>' + escape([asset.sector, asset.location].filter(Boolean).join(' · ')) + '</p></div>' +
      '<button type="button" class="infrastructure-close" data-infrastructure-close aria-label="Fechar">×</button></header>' +
      '<div class="infrastructure-history-actions"><b>Histórico de serviços</b><button type="button" class="infrastructure-button infrastructure-button-primary" data-infrastructure-log="' +
      escape(asset.id) + '">+ Registrar manutenção</button></div>' +
      (loading ? '<div class="infrastructure-empty">Carregando histórico...</div>' :
        '<div class="infrastructure-history-list">' + (historyRows || '<div class="infrastructure-empty">Nenhum serviço registrado para este equipamento.</div>') + '</div>') +
      '<button type="button" class="infrastructure-button infrastructure-button-danger" data-infrastructure-archive="' + escape(asset.id) + '">Arquivar equipamento</button>' +
      '</section></div>';
  }

  function renderMaintenanceForm(asset) {
    var today = localDateValue(new Date());
    root.innerHTML = '<div class="infrastructure-backdrop"><section class="infrastructure-panel infrastructure-form-panel" role="dialog" aria-modal="true" aria-labelledby="maintenance-form-title">' +
      '<header class="infrastructure-header"><div><button type="button" class="infrastructure-back" data-infrastructure-detail="' + escape(asset.id) + '">‹ Voltar ao histórico</button>' +
      '<span class="infrastructure-eyebrow">' + escape(asset.asset_tag) + '</span><h2 id="maintenance-form-title">Registrar manutenção</h2>' +
      '<p>' + escape(asset.name) + '</p></div><button type="button" class="infrastructure-close" data-infrastructure-close aria-label="Fechar">×</button></header>' +
      '<form data-infrastructure-maintenance-form data-asset-id="' + escape(asset.id) + '"><div class="infrastructure-fields">' +
      field('Tipo de serviço', 'maintenance_type', 'Preventiva', 'select', true, maintenanceTypes) +
      field('Data do serviço', 'performed_on', today, 'date', true) +
      field('Resumo do serviço', 'title', '', 'text', true) +
      field('Técnico responsável', 'technician', '', 'text', true) +
      field('Leitura do medidor após o serviço', 'meter_reading', asset.meter_reading, 'number') +
      field('Tempo parado (minutos)', 'downtime_minutes', '', 'number') +
      field('Custo (R$)', 'cost', '', 'number') +
      field('Próxima manutenção preventiva', 'next_maintenance_on', '', 'date') +
      field('Chamado relacionado', 'ticket_reference', '', 'text') +
      '<label class="infrastructure-field infrastructure-field-wide"><span>Descrição / peças / recomendações</span><textarea name="description" rows="4" required></textarea></label>' +
      '</div><div class="infrastructure-form-actions"><button type="button" class="infrastructure-button infrastructure-button-secondary" data-infrastructure-detail="' +
      escape(asset.id) + '">Cancelar</button><button type="submit" class="infrastructure-button infrastructure-button-primary">Salvar serviço</button></div></form></section></div>';
  }

  async function verifyAccess() {
    var result = await client().rpc('infrastructure_can_manage_assets');
    if (result.error) throw result.error;
    if (result.data !== true) throw new Error('Acesso restrito ao setor de Tecnologia da Informação e administradores.');
  }

  async function loadAssets() {
    loading = true;
    errorMessage = '';
    render();
    try {
      await verifyAccess();
      var result = await client().from('infrastructure_assets').select('*').order('updated_at', { ascending: false });
      if (result.error) throw result.error;
      assets = result.data || [];
    } catch (error) {
      errorMessage = error.message || 'Não foi possível carregar os equipamentos. Verifique a conexão e as permissões no Supabase.';
      console.error('Falha ao carregar inventário de infraestrutura:', error);
    } finally {
      loading = false;
      render();
    }
  }

  async function loadEvents(assetId) {
    loading = true;
    events = [];
    renderHistory(findAsset(assetId));
    try {
      var result = await client().from('infrastructure_maintenance_events').select('*')
        .eq('asset_id', assetId).order('performed_on', { ascending: false }).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      events = result.data || [];
    } catch (error) {
      console.error('Falha ao carregar histórico de manutenção:', error);
      toast('Não foi possível carregar o histórico. Confira a migração e a conexão do Supabase.');
    } finally {
      loading = false;
      renderHistory(findAsset(assetId));
    }
  }

  function findAsset(id) {
    return assets.find(function (asset) { return String(asset.id) === String(id); });
  }

  function subscribe() {
    if (channel || !window.supabaseClient || typeof window.supabaseClient.channel !== 'function') return;
    channel = window.supabaseClient.channel('rildonx-infrastructure-assets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infrastructure_assets' }, function () {
        if (!root || root.hidden) {
          window.dispatchEvent(new CustomEvent('rildonx:infrastructure-changed'));
        } else if (!activeAssetId) {
          loadAssets();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infrastructure_maintenance_events' }, function () {
        if (root && !root.hidden && activeAssetId) loadEvents(activeAssetId);
      })
      .subscribe(function (status, error) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Atualização em tempo real do inventário falhou:', error || status);
        }
      });
  }

  function close() {
    if (root) root.hidden = true;
    activeAssetId = '';
    events = [];
  }

  async function open(options) {
    ensureRoot();
    openedFromLibrary = Boolean(options && options.fromLibrary);
    root.hidden = false;
    activeAssetId = '';
    search = '';
    statusFilter = '';
    categoryFilter = '';
    dueFilter = '';
    includeArchived = false;
    loading = true;
    errorMessage = '';
    assets = [];
    render();
    subscribe();
    await loadAssets();
    if (options && options.assetId) {
      var requested = findAsset(options.assetId);
      if (requested) await showDetail(requested.id);
    }
  }

  async function showDetail(assetId) {
    var asset = findAsset(assetId);
    if (!asset) return;
    activeAssetId = asset.id;
    events = [];
    loading = true;
    renderHistory(asset);
    await loadEvents(asset.id);
  }

  async function saveAsset(form) {
    var formData = new FormData(form);
    var values = {};
    ['name', 'asset_tag', 'category', 'status', 'sector', 'location', 'manufacturer', 'model',
      'serial_number', 'ip_address', 'criticality', 'responsible', 'acquired_on', 'warranty_until',
      'last_maintenance_on', 'next_maintenance_on', 'notes'].forEach(function (key) {
      values[key] = String(formData.get(key) || '').trim() || null;
    });
    ['meter_reading', 'meter_threshold', 'meter_interval', 'preventive_interval_days'].forEach(function (key) {
      var value = String(formData.get(key) || '').trim();
      values[key] = value ? Number(value) : null;
      if (value && (!Number.isFinite(values[key]) || values[key] < 0 ||
          (key.indexOf('interval') !== -1 && (!Number.isInteger(values[key]) || values[key] === 0)))) {
        throw new Error('Informe valores válidos para os medidores e intervalos preventivos.');
      }
    });
    if (values.warranty_until && values.acquired_on && values.warranty_until < values.acquired_on) {
      throw new Error('A validade da garantia não pode ser anterior à aquisição.');
    }
    values.asset_tag = values.asset_tag.toLocaleUpperCase('pt-BR');
    var id = form.dataset.assetId;
    var result = id
      ? await client().from('infrastructure_assets').update(values).eq('id', id).select('*').single()
      : await client().from('infrastructure_assets').insert(values).select('*').single();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('O Supabase não confirmou o salvamento do equipamento.');
    toast(id ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
    await loadAssets();
  }

  async function saveMaintenance(form) {
    var data = new FormData(form);
    var payload = {
      p_asset_id: form.dataset.assetId,
      p_maintenance_type: String(data.get('maintenance_type') || ''),
      p_title: String(data.get('title') || '').trim(),
      p_description: String(data.get('description') || '').trim(),
      p_performed_on: String(data.get('performed_on') || ''),
      p_technician: String(data.get('technician') || '').trim(),
      p_meter_reading: String(data.get('meter_reading') || '').trim() ? Number(data.get('meter_reading')) : null,
      p_downtime_minutes: String(data.get('downtime_minutes') || '').trim() ? Number(data.get('downtime_minutes')) : null,
      p_cost: String(data.get('cost') || '').trim() ? Number(String(data.get('cost')).replace(',', '.')) : null,
      p_next_maintenance_on: String(data.get('next_maintenance_on') || '') || null,
      p_ticket_reference: String(data.get('ticket_reference') || '').trim() || null
    };
    if (!payload.p_title || !payload.p_description || !payload.p_technician || !payload.p_performed_on) {
      throw new Error('Preencha tipo, resumo, descrição, técnico e data do serviço.');
    }
    if (payload.p_meter_reading != null && (!Number.isFinite(payload.p_meter_reading) || payload.p_meter_reading < 0) ||
        payload.p_downtime_minutes != null && (!Number.isFinite(payload.p_downtime_minutes) || payload.p_downtime_minutes < 0) ||
        payload.p_cost != null && (!Number.isFinite(payload.p_cost) || payload.p_cost < 0)) {
      throw new Error('Medidor, tempo parado e custo devem ser valores válidos e não negativos.');
    }
    var result = await client().rpc('register_infrastructure_maintenance', payload);
    if (result.error) throw result.error;
    if (!result.data) throw new Error('O Supabase não confirmou o registro do serviço.');
    await loadAssets();
    toast('Serviço registrado no histórico do equipamento.');
    await showDetail(payload.p_asset_id);
  }

  function exportAssets() {
    var rows = filteredAssets();
    var columns = [
      ['Patrimônio', 'asset_tag'], ['Equipamento', 'name'], ['Categoria', 'category'], ['Status', 'status'],
      ['Setor', 'sector'], ['Local', 'location'], ['Fabricante', 'manufacturer'], ['Modelo', 'model'],
      ['Número de série', 'serial_number'], ['IP / hostname', 'ip_address'], ['Criticidade', 'criticality'],
      ['Responsável', 'responsible'], ['Última manutenção', 'last_maintenance_on'],
      ['Próxima manutenção', 'next_maintenance_on'], ['Leitura atual', 'meter_reading'],
      ['Próximo limite do medidor', 'meter_threshold'], ['Intervalo do medidor', 'meter_interval'],
      ['Intervalo preventivo (dias)', 'preventive_interval_days'], ['Garantia até', 'warranty_until'], ['Observações', 'notes']
    ];
    var csv = [columns.map(function (column) { return column[0]; })].concat(rows.map(function (asset) {
      return columns.map(function (column) {
        var value = String(asset[column[1]] == null ? '' : asset[column[1]]).replace(/\r?\n/g, ' ');
        if (/^[\t ]*[=+\-@]/.test(value)) value = "'" + value;
        return '"' + value.replace(/"/g, '""') + '"';
      });
    })).map(function (row) { return row.join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'inventario-infraestrutura-' + localDateValue(new Date()) + '.csv';
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function handleClick(event) {
    if (event.target === root || event.target.classList.contains('infrastructure-backdrop') ||
        event.target.closest('[data-infrastructure-library-back]') ||
        event.target.closest('[data-infrastructure-close]')) {
      close();
      return;
    }
    if (event.target.closest('[data-infrastructure-back]')) {
      activeAssetId = '';
      render();
      return;
    }
    var detailButton = event.target.closest('[data-asset-detail], [data-infrastructure-detail]');
    if (detailButton) {
      showDetail(detailButton.dataset.assetDetail || detailButton.dataset.infrastructureDetail);
      return;
    }
    var edit = event.target.closest('[data-asset-edit]');
    if (edit) {
      var editAsset = findAsset(edit.dataset.assetEdit);
      if (editAsset) renderAssetForm(editAsset);
      return;
    }
    if (event.target.closest('[data-infrastructure-create]')) {
      renderAssetForm(null);
      return;
    }
    if (event.target.closest('[data-infrastructure-export]')) {
      exportAssets();
      return;
    }
    var log = event.target.closest('[data-infrastructure-log]');
    if (log) {
      var logAsset = findAsset(log.dataset.infrastructureLog);
      if (logAsset) renderMaintenanceForm(logAsset);
      return;
    }
    var archive = event.target.closest('[data-infrastructure-archive]');
    if (archive) {
      var archiveAsset = findAsset(archive.dataset.infrastructureArchive);
      if (!archiveAsset || !window.confirm('Arquivar "' + archiveAsset.name + '"? O histórico será preservado.')) return;
      client().from('infrastructure_assets').update({ archived: true }).eq('id', archiveAsset.id)
        .then(function (result) {
          if (result.error) throw result.error;
          activeAssetId = '';
          toast('Equipamento arquivado. O histórico foi preservado.');
          return loadAssets();
        }).catch(function (error) {
          console.error('Falha ao arquivar equipamento:', error);
          toast(error.message || 'Não foi possível arquivar o equipamento.');
        });
    }
    var restore = event.target.closest('[data-asset-restore]');
    if (restore) {
      client().from('infrastructure_assets').update({ archived: false }).eq('id', restore.dataset.assetRestore)
        .then(function (result) {
          if (result.error) throw result.error;
          toast('Equipamento restaurado.');
          return loadAssets();
        }).catch(function (error) {
          console.error('Falha ao restaurar equipamento:', error);
          toast(error.message || 'Não foi possível restaurar o equipamento.');
        });
    }
  }

  function handleSubmit(event) {
    var assetForm = event.target.closest('[data-infrastructure-asset-form]');
    var maintenanceForm = event.target.closest('[data-infrastructure-maintenance-form]');
    if (!assetForm && !maintenanceForm) return;
    event.preventDefault();
    var form = assetForm || maintenanceForm;
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    var operation = assetForm ? saveAsset(assetForm) : saveMaintenance(maintenanceForm);
    operation.catch(function (error) {
      console.error('Falha ao salvar dados de infraestrutura:', error);
      toast(error.message || 'Não foi possível salvar. Confira os dados e a conexão.');
      if (button) button.disabled = false;
    });
  }

  window.RildonXInfrastructure = { open: open, refresh: loadAssets };
}());
