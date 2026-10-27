(function () {
  'use strict';

  var MODULE_KEY = 'quality-documents';
  var ROLES = [
    ['createdBy', 'Criado por', '📝'],
    ['validatedBy', 'Validado por', '✔'],
    ['approvedBy', 'Aprovado por', '✅'],
    ['reviewedBy', 'Revisado por', '🔎'],
    ['reviewApprovedBy', 'Revisão aprovada por', '🏅']
  ];
  var DOCUMENT_TYPES = ['POP', 'Manual', 'Instrução de Trabalho', 'Formulário', 'Política', 'Procedimento', 'Outro'];
  var STATUSES = ['Vigente', 'Em Revisão'];
  var SECTORS = ['Administrativo', 'Caixa', 'Comercial', 'Compras', 'Financeiro', 'Logística', 'Marketing', 'Qualidade', 'RH/DP', 'TI'];
  var root = null;
  var dashboardState = {};
  var hasAccess = false;
  var activeView = 'list';
  var activeRecordId = '';
  var sectorFilter = '';
  var search = '';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  function records() {
    return (dashboardState.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === MODULE_KEY && !record.archived;
    });
  }

  function getRecord(id) {
    return records().find(function (record) { return String(record.id) === String(id); });
  }

  function allSectors() {
    var values = SECTORS.slice();
    (dashboardState.profiles || []).forEach(function (profile) {
      if (profile.sector && values.indexOf(profile.sector) === -1) values.push(profile.sector);
    });
    records().forEach(function (record) {
      var sector = record.data && record.data.sector;
      if (sector && values.indexOf(sector) === -1) values.push(sector);
    });
    return values.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  function selectOptions(values, selected, emptyLabel) {
    return '<option value="">' + escapeHtml(emptyLabel || 'Selecione') + '</option>' + values.map(function (value) {
      return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
    }).join('');
  }

  function peopleListMarkup(role, people) {
    var rows = Array.isArray(people) && people.length ? people : [{ name: '', sector: '' }];
    var sectorOptions = allSectors();
    rows.forEach(function (person) {
      if (person.sector && sectorOptions.indexOf(person.sector) === -1) sectorOptions.push(person.sector);
    });
    return '<section class="qdm-role" data-qdm-role="' + role[0] + '"><h3><span>' + role[2] + '</span> ' + escapeHtml(role[1]) + '</h3>' +
      '<div class="qdm-people">' + rows.map(function (person) {
        return '<div class="qdm-person-row"><input type="text" name="role_' + role[0] + '_name" maxlength="120" value="' +
          escapeHtml(person.name || '') + '" placeholder="Nome do colaborador" aria-label="' + escapeHtml(role[1]) + ' · nome">' +
          '<select name="role_' + role[0] + '_sector" aria-label="' + escapeHtml(role[1]) + ' · setor">' +
          selectOptions(sectorOptions, person.sector || '', '-- Escolha --') + '</select>' +
          '<button type="button" class="qdm-add-person" data-qdm-add-person="' + role[0] + '">+ Adicionar</button>' +
          (rows.length > 1 ? '<button type="button" class="qdm-remove-person" data-qdm-remove-person aria-label="Remover pessoa">×</button>' : '') +
          '</div>';
      }).join('') + '</div><div class="qdm-person-output" aria-live="polite">' +
      (rows.some(function (person) { return person.name || person.sector; })
        ? rows.filter(function (person) { return person.name || person.sector; }).map(function (person) {
          return '<span>' + escapeHtml(person.name || 'Nome não informado') + ' (' + escapeHtml(person.sector || 'Setor não informado') + ')</span>';
        }).join('')
        : '') + '</div></section>';
  }

  function syncRoleOutput(section) {
    var output = section.querySelector('.qdm-person-output');
    if (!output) return;
    var rows = Array.from(section.querySelectorAll('.qdm-person-row')).map(function (row) {
        return {
          name: row.querySelector('input').value.trim(),
          sector: row.querySelector('select').value
        };
    }).filter(function (person) { return person.name || person.sector; });
    output.innerHTML = rows.map(function (person) {
        return '<span>' + escapeHtml(person.name || 'Nome não informado') + ' (' + escapeHtml(person.sector || 'Setor não informado') + ')</span>';
    }).join('');
  }

  function field(label, key, type, value, options) {
    var control = type === 'select'
      ? '<select name="' + key + '">' + selectOptions(options, value || '', '-- Escolha --') + '</select>'
      : '<input type="' + type + '" name="' + key + '" value="' + escapeHtml(value || '') + '">';
    return '<label class="qdm-field"><span>' + escapeHtml(label) + '</span>' + control + '</label>';
  }

  function formMarkup(record) {
    var data = record && record.data || {};
    var statusOptions = STATUSES.slice();
    var typeOptions = DOCUMENT_TYPES.slice();
    if (record && record.status && statusOptions.indexOf(record.status) === -1) statusOptions.push(record.status);
    if (data.documentType && typeOptions.indexOf(data.documentType) === -1) typeOptions.push(data.documentType);
    return '<section class="qdm-form-card"><button type="button" class="qdm-back" data-qdm-back>← Voltar</button>' +
      '<form data-qdm-form data-record-id="' + escapeHtml(record && record.id || '') + '">' +
      '<div class="qdm-form-grid">' +
      field('Código', 'documentCode', 'text', data.documentCode) +
      field('Título', 'title', 'text', record && record.title || '') +
      field('Tipo Doc.', 'documentType', 'select', data.documentType, typeOptions) +
      field('Setor', 'sector', 'select', data.sector, allSectors()) +
      field('Versão', 'version', 'text', data.version) +
      field('Data de criação', 'creationDate', 'date', data.creationDate || (!record ? new Date().toISOString().slice(0, 10) : '')) +
      field('Última atualização', 'updatedDate', 'date', data.updatedDate) +
      field('Próxima revisão', 'nextReviewDate', 'date', data.nextReviewDate) +
      field('Status', 'status', 'select', record && record.status || 'Vigente', statusOptions) +
      '</div><div class="qdm-roles">' + ROLES.map(function (role) {
        return peopleListMarkup(role, data[role[0]]);
      }).join('') + '</div>' +
      '<label class="qdm-field qdm-drive-field"><span>Anexo (Drive) · link externo</span><input type="url" name="driveLink" value="' +
      escapeHtml(data.driveLink || '') + '" placeholder="https://drive.google.com/..."></label>' +
      '<label class="qdm-field qdm-upload-field"><span>Enviar arquivo para Documentos</span><input type="file" name="attachmentFile" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"></label>' +
      renderAttachments(data.attachmentIds) +
      '<p class="qdm-disclaimer">Os responsáveis são informações descritivas digitadas no cadastro. Este painel não envia solicitações, não registra aceite individual, não verifica a identidade de aprovadores e não mantém histórico de versões do arquivo. Editar substitui os dados do mesmo registro.</p>' +
      '<div class="qdm-form-actions"><button type="button" class="btn secondary" data-qdm-back>Cancelar</button>' +
      '<button type="submit" class="btn">Salvar</button></div></form></section>';
  }

  function filteredRecords() {
    var query = search.trim().toLocaleLowerCase('pt-BR');
    return records().filter(function (record) {
      var data = record.data || {};
      if (sectorFilter && data.sector !== sectorFilter) return false;
      return !query || [record.title, data.documentCode, data.documentType, data.sector, data.nextReviewDate, record.status]
        .join(' ').toLocaleLowerCase('pt-BR').includes(query);
    }).sort(function (a, b) {
      return String(b.data && b.data.updatedDate || b.updatedAt || '').localeCompare(
        String(a.data && a.data.updatedDate || a.updatedAt || '')
      );
    });
  }

  function renderList() {
    var items = filteredRecords();
    return '<div class="qdm-list-card"><div class="qdm-list-heading"><h3>Documentos Internos</h3>' +
      '<div class="qdm-list-actions"><button type="button" class="btn" data-qdm-create>+ Novo Documento</button>' +
      '<button type="button" class="btn secondary" data-qdm-export-csv>Exportar CSV</button>' +
      '<button type="button" class="btn secondary" data-qdm-export-pdf>Exportar PDF</button></div></div>' +
      '<div class="qdm-filters"><label><span>Setor</span><select data-qdm-filter>' +
      selectOptions(allSectors(), sectorFilter, 'Todos os Setores') + '</select></label>' +
      '<label><span>Buscar</span><input type="search" data-qdm-search value="' + escapeHtml(search) + '" placeholder="Código, título ou tipo"></label></div>' +
      '<div class="qdm-table-wrap"><table class="qdm-table"><thead><tr><th>Código</th><th>Título</th><th>Setor</th><th>Status</th><th>Ações</th></tr></thead><tbody>' +
      (items.length ? items.map(function (record) {
        var data = record.data || {};
        return '<tr><td><b>' + escapeHtml(data.documentCode || '—') + '</b></td><td>' + escapeHtml(record.title) +
          '</td><td>' + escapeHtml(data.sector || '—') + '</td><td><span class="qdm-status ' +
          (record.status === 'Vigente' ? 'is-current' : 'is-review') + '">' + escapeHtml(record.status || '—') +
          '</span></td><td><button type="button" class="qdm-view" data-qdm-view="' + escapeHtml(record.id) + '">◉ Ver</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="qdm-empty">Nenhum documento cadastrado para este filtro.</td></tr>') +
      '</tbody></table></div></div>';
  }

  function roleDetails(role, list) {
    var people = Array.isArray(list) ? list.filter(function (person) { return person.name || person.sector; }) : [];
    return '<div class="qdm-detail-row"><b>' + escapeHtml(role[1]) + ':</b><div>' +
      (people.length ? '<ul>' + people.map(function (person) {
        return '<li>' + escapeHtml(person.name || 'Nome não informado') + ' (' + escapeHtml(person.sector || 'Setor não informado') + ')</li>';
      }).join('') + '</ul>' : '<span>—</span>') + '</div></div>';
  }

  function renderDetail(record) {
    var data = record.data || {};
    var url = safeUrl(data.driveLink);
    return '<section class="qdm-detail-card"><div class="qdm-detail-heading"><h3>Detalhes</h3><button type="button" class="qdm-back" data-qdm-back aria-label="Voltar à lista">‹ Voltar</button></div>' +
      '<div class="qdm-detail-row"><b>Título:</b><span>' + escapeHtml(record.title) + '</span></div>' +
      '<div class="qdm-detail-row"><b>Código:</b><span>' + escapeHtml(data.documentCode || '—') + '</span></div>' +
      '<div class="qdm-detail-row"><b>Setor:</b><span>' + escapeHtml(data.sector || '—') + '</span></div>' +
      '<div class="qdm-detail-row"><b>Tipo de Documento:</b><span>' + escapeHtml(data.documentType || '—') + '</span></div>' +
      '<div class="qdm-detail-row"><b>Versão:</b><span>' + escapeHtml(data.version || '—') + '</span></div>' +
      '<div class="qdm-detail-row"><b>Data de Criação:</b><span>' + escapeHtml(formatDate(data.creationDate)) + '</span></div>' +
      '<div class="qdm-detail-row"><b>Status:</b><span class="qdm-status ' + (record.status === 'Vigente' ? 'is-current' : 'is-review') +
      '">' + escapeHtml(record.status || '—') + '</span></div>' +
      ROLES.slice(0, 3).map(function (role) { return roleDetails(role, data[role[0]]); }).join('') +
      (url ? '<div class="qdm-detail-row"><b>Link Drive:</b><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Abrir Anexo ↗</a></div>' : '') +
      (data.nextReviewDate ? '<div class="qdm-detail-row"><b>Próxima revisão:</b><span>' + escapeHtml(formatDate(data.nextReviewDate)) + '</span></div>' : '') +
      renderAttachments(data.attachmentIds) +
      '<div class="qdm-updates"><h4>ATUALIZAÇÕES</h4><div class="qdm-detail-row"><b>Última Atualização:</b><span>' +
      escapeHtml(formatDate(data.updatedDate)) + '</span></div>' +
      ROLES.slice(3).map(function (role) { return roleDetails(role, data[role[0]]); }).join('') + '</div>' +
      '<p class="qdm-disclaimer">Os papéis acima são descritivos e não representam uma aprovação autenticada nem um histórico de versões do conteúdo.</p>' +
      '<div class="qdm-detail-actions"><button type="button" class="btn secondary" data-qdm-edit="' + escapeHtml(record.id) + '">✎ Editar</button>' +
      (canDelete(record) ? '<button type="button" class="btn qdm-delete" data-qdm-delete="' + escapeHtml(record.id) + '">Excluir</button>' : '') +
      '</div></section>';
  }

  function renderAttachments(ids) {
    var documents = dashboardState.documents || [];
    var files = (Array.isArray(ids) ? ids : []).map(function (id) {
      return documents.find(function (item) { return String(item.id) === String(id); });
    }).filter(Boolean);
    if (!files.length) return '';
    return '<div class="qdm-attachments"><b>Arquivos enviados</b>' + files.map(function (file) {
      return '<button type="button" data-business-attachment="' + escapeHtml(file.id) + '">📎 ' +
        escapeHtml(file.name || 'Documento') + '</button>';
    }).join('') + '</div>';
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(String(value));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function canDelete(record) {
    var user = dashboardState.user || {};
    var profile = (dashboardState.profiles || []).find(function (item) { return String(item.id) === String(user.id); }) || {};
    var role = String(profile.role || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return String(record.createdBy || '') === String(user.id || '') || /admin|gerente|gestor|diretor/.test(role);
  }

  function formatDate(value) {
    if (!value) return '—';
    var parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  }

  function render() {
    if (!root || !root.isConnected) return;
    if (!hasAccess) {
      root.innerHTML = '<div class="dashboard-business-restricted">Seu perfil não possui acesso ao setor Qualidade.</div>';
      return;
    }
    if (activeView === 'form') {
      root.innerHTML = formMarkup(activeRecordId ? getRecord(activeRecordId) : null);
      return;
    }
    if (activeView === 'detail') {
      var current = getRecord(activeRecordId);
      if (current) {
        root.innerHTML = renderDetail(current);
        return;
      }
      activeView = 'list';
    }
    root.innerHTML = renderList();
  }

  function mount(target, data, access) {
    root = target;
    dashboardState = data || {};
    hasAccess = Boolean(access);
    if (!root.dataset.qdmBound) {
      root.dataset.qdmBound = 'true';
      root.addEventListener('click', handleClick);
      root.addEventListener('change', handleChange);
      root.addEventListener('input', handleInput);
      root.addEventListener('submit', handleSubmit);
    }
    render();
  }

  function readPeople(form, roleKey) {
    var names = Array.from(form.querySelectorAll('[name="role_' + roleKey + '_name"]'));
    var sectors = Array.from(form.querySelectorAll('[name="role_' + roleKey + '_sector"]'));
    return names.map(function (input, index) {
      return { name: input.value.trim(), sector: sectors[index] ? sectors[index].value : '' };
    }).filter(function (person) { return person.name || person.sector; });
  }

  function collectForm(form) {
    var values = new FormData(form);
    var title = String(values.get('title') || '').trim();
    var code = String(values.get('documentCode') || '').trim();
    var rawLink = String(values.get('driveLink') || '').trim();
    var driveLink = rawLink ? safeUrl(rawLink) : '';
    if (rawLink && !driveLink) throw new Error('Informe um link de anexo HTTP ou HTTPS válido.');
    var status = String(values.get('status') || '');
    var existing = form.dataset.recordId ? getRecord(form.dataset.recordId) : null;
    if (status && STATUSES.indexOf(status) === -1 && (!existing || existing.status !== status)) {
      throw new Error('Selecione uma situação válida.');
    }
    var data = {
      documentCode: code,
      documentType: String(values.get('documentType') || ''),
      sector: String(values.get('sector') || ''),
      version: String(values.get('version') || '').trim(),
      creationDate: String(values.get('creationDate') || ''),
      updatedDate: String(values.get('updatedDate') || ''),
      nextReviewDate: String(values.get('nextReviewDate') || ''),
      driveLink: driveLink,
      status: status || 'Vigente'
    };
    ROLES.forEach(function (role) { data[role[0]] = readPeople(form, role[0]); });
    return {
      title: title || code || 'Documento sem título',
      status: status || 'Vigente',
      data: data
    };
  }

  function mapRow(row) {
    return {
      id: row.id,
      moduleKey: row.module_key,
      sector: row.sector,
      title: row.title,
      status: row.status,
      data: row.data || {},
      archived: Boolean(row.archived),
      linkedTaskId: row.linked_task_id || null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async function saveForm(form) {
    if (!window.RildonXStore) throw new Error('O armazenamento do RildonX não está disponível.');
    var payload = collectForm(form);
    var id = form.dataset.recordId;
    var existing = id ? getRecord(id) : null;
    var savedRecordId = existing && existing.id;
    var fileInput = form.querySelector('[name="attachmentFile"]');
    var file = fileInput && fileInput.files && fileInput.files[0];
    var uploaded = null;
    var attachmentIds = existing && existing.data && Array.isArray(existing.data.attachmentIds)
      ? existing.data.attachmentIds.slice()
      : [];
    if (file) {
      if (!window.RildonXDocumentUpload || typeof window.RildonXDocumentUpload.upload !== 'function') {
        throw new Error('O envio de documentos não está disponível. Atualize a página e tente novamente.');
      }
      uploaded = await window.RildonXDocumentUpload.upload(file, {
        folder: 'Gestão de Documentos',
        senderName: (dashboardState.user && dashboardState.user.name) || 'Usuário',
        viewerIds: documentViewers()
      });
      attachmentIds.push(uploaded.id);
    }
    if (attachmentIds.length) payload.data.attachmentIds = attachmentIds;
    try {
      if (window.supabaseClient) {
        var result;
        if (existing) {
          result = await window.supabaseClient.from('business_card_records')
            .update({ title: payload.title, status: payload.status, data: payload.data })
            .eq('id', existing.id).select('*').single();
        } else {
          var auth = await window.supabaseClient.auth.getUser();
          if (auth.error) throw auth.error;
          if (!auth.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
          result = await window.supabaseClient.from('business_card_records').insert({
            module_key: MODULE_KEY,
            sector: 'quality',
            title: payload.title,
            status: payload.status,
            data: payload.data,
            created_by: auth.data.user.id
          }).select('*').single();
        }
        if (result.error) throw result.error;
        var record = mapRow(result.data);
        savedRecordId = record.id;
        if (existing) {
          window.RildonXStore.updateBusinessCardRecord(existing.id, record);
        } else {
          window.RildonXStore.setState({
            businessCardRecords: [record].concat(window.RildonXStore.getState().businessCardRecords || [])
          });
        }
      } else if (existing) {
        window.RildonXStore.updateBusinessCardRecord(existing.id, payload);
      } else {
        var currentUser = dashboardState.user || {};
        var created = window.RildonXStore.addBusinessCardRecord(Object.assign({
          moduleKey: MODULE_KEY,
          sector: 'quality',
          createdBy: currentUser.id || null
        }, payload));
        savedRecordId = created.id;
      }
    } catch (error) {
      if (uploaded && window.RildonXDocumentUpload) {
        try { await window.RildonXDocumentUpload.removeDocument(uploaded); }
        catch (cleanupError) { console.error('Não foi possível remover o arquivo não vinculado:', cleanupError); }
      }
      throw error;
    }
    if (uploaded) window.RildonXStore.addDocument(uploaded);
    activeView = 'list';
    activeRecordId = '';
    var calendarSyncFailed = false;
    try {
      if (!window.RildonXBusinessCalendarSync) throw new Error('O serviço de calendário não está carregado.');
      await window.RildonXBusinessCalendarSync.sync({
        source: MODULE_KEY,
        recordId: savedRecordId,
        slot: 'review',
        title: 'Revisão de documento: ' + payload.title,
        description: [payload.data.documentCode, payload.data.sector, payload.data.version && 'Versão ' + payload.data.version]
          .filter(Boolean).join(' · '),
        date: payload.data.nextReviewDate,
        category: 'documento'
      });
    } catch (error) {
      calendarSyncFailed = true;
      console.error('Documento salvo, mas não foi sincronizado com o calendário:', error);
    }
    toast(calendarSyncFailed
      ? 'Documento salvo, mas a sincronização com o calendário falhou. ' +
        'Verifique a migração do calendário e suas permissões.'
      : 'Documento salvo.');
    render();
  }

  function documentViewers() {
    return (dashboardState.profiles || []).filter(function (profile) {
      if (!profile || !profile.id || profile.active === false) return false;
      var role = String(profile.role || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var nickname = String(profile.nickname || '').toLocaleLowerCase('pt-BR');
      var manager = nickname === 'adson.ri' || /admin|gerente|gestor|diretor/.test(role) ||
        /gerencia|gestao|diretoria/i.test(profile.sector || '');
      if (manager) return true;
      return Array.isArray(profile.enabledPanels) && profile.enabledPanels.indexOf(MODULE_KEY) !== -1;
    }).map(function (profile) { return profile.id; });
  }

  async function deleteRecord(record) {
    if (!canDelete(record)) throw new Error('Somente quem cadastrou o documento ou a Gestão pode excluí-lo.');
    if (!window.confirm('Excluir permanentemente o documento "' + record.title + '"?')) return;
    if (window.supabaseClient) {
      var result = await window.supabaseClient.from('business_card_records')
        .delete().eq('id', record.id).select('id').single();
      if (result.error) throw result.error;
    }
    var current = window.RildonXStore.getState().businessCardRecords || [];
    window.RildonXStore.setState({
      businessCardRecords: current.filter(function (item) { return String(item.id) !== String(record.id); })
    });
    activeView = 'list';
    activeRecordId = '';
    var calendarSyncFailed = false;
    try {
      if (!window.RildonXBusinessCalendarSync) throw new Error('O serviço de calendário não está carregado.');
      await window.RildonXBusinessCalendarSync.sync({
        source: MODULE_KEY,
        recordId: record.id,
        slot: 'review',
        date: ''
      });
    } catch (error) {
      calendarSyncFailed = true;
      console.error('Documento excluído, mas o evento de revisão não foi removido:', error);
    }
    toast(calendarSyncFailed
      ? 'Documento excluído, mas não foi possível remover a revisão do calendário.'
      : 'Documento excluído.');
    render();
  }

  function exportCsv() {
    var headings = ['Código', 'Título', 'Tipo de Documento', 'Setor', 'Versão', 'Data de Criação', 'Última Atualização', 'Próxima Revisão', 'Status', 'Criado por', 'Validado por', 'Aprovado por', 'Revisado por', 'Revisão aprovada por', 'Link Drive'];
    var rows = filteredRecords().map(function (record) {
      var data = record.data || {};
      return [data.documentCode, record.title, data.documentType, data.sector, data.version, data.creationDate, data.updatedDate, data.nextReviewDate, record.status]
        .concat(ROLES.map(function (role) {
          return (data[role[0]] || []).map(function (person) {
              return person.name && person.sector ? person.name + ' (' + person.sector + ')' : person.name || person.sector;
          }).join('; ' );
        })).concat(data.driveLink || '');
    });
    var csv = [headings].concat(rows).map(function (row) {
      return row.map(function (value) {
        var text = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
        if (/^[\t ]*[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'gestao-de-documentos.csv';
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function handleClick(event) {
    if (event.target.closest('[data-qdm-create]')) {
      activeRecordId = '';
      activeView = 'form';
      render();
      return;
    }
    if (event.target.closest('[data-qdm-back]')) {
      activeView = 'list';
      activeRecordId = '';
      render();
      return;
    }
    if (event.target.closest('[data-qdm-export-csv]')) {
      exportCsv();
      return;
    }
    if (event.target.closest('[data-qdm-export-pdf]')) {
      window.print();
      return;
    }
    var addPerson = event.target.closest('[data-qdm-add-person]');
    if (addPerson) {
      var role = addPerson.dataset.qdmAddPerson;
      var section = addPerson.closest('[data-qdm-role]');
      if (!section) return;
      var currentRow = addPerson.closest('.qdm-person-row');
      if (!currentRow.querySelector('input').value.trim() || !currentRow.querySelector('select').value) {
        toast('Preencha o nome e o setor antes de adicionar outra pessoa.');
        return;
      }
      var row = document.createElement('div');
      row.className = 'qdm-person-row';
      row.innerHTML = '<input type="text" name="role_' + escapeHtml(role) + '_name" maxlength="120" placeholder="Nome do colaborador" aria-label="Nome do colaborador">' +
        '<select name="role_' + escapeHtml(role) + '_sector" aria-label="Setor">' + selectOptions(allSectors(), '', '-- Escolha --') + '</select>' +
        '<button type="button" class="qdm-add-person" data-qdm-add-person="' + escapeHtml(role) + '">+ Adicionar</button>' +
        '<button type="button" class="qdm-remove-person" data-qdm-remove-person aria-label="Remover pessoa">×</button>';
      section.querySelector('.qdm-people').appendChild(row);
      syncRoleOutput(section);
      row.querySelector('input').focus();
      return;
    }
    var removePerson = event.target.closest('[data-qdm-remove-person]');
    if (removePerson) {
      var people = removePerson.closest('.qdm-people');
      if (people && people.querySelectorAll('.qdm-person-row').length > 1) {
        var roleSection = removePerson.closest('[data-qdm-role]');
        removePerson.closest('.qdm-person-row').remove();
        syncRoleOutput(roleSection);
      }
      return;
    }
    var view = event.target.closest('[data-qdm-view]');
    if (view) {
      activeRecordId = view.dataset.qdmView;
      activeView = 'detail';
      render();
      return;
    }
    var edit = event.target.closest('[data-qdm-edit]');
    if (edit) {
      activeRecordId = edit.dataset.qdmEdit;
      activeView = 'form';
      render();
      return;
    }
    var deleteButton = event.target.closest('[data-qdm-delete]');
    if (deleteButton) {
      var record = getRecord(deleteButton.dataset.qdmDelete);
      if (record) deleteRecord(record).catch(showError);
    }
  }

  function handleChange(event) {
    var roleSection = event.target.closest('[data-qdm-role]');
    if (roleSection) syncRoleOutput(roleSection);
    if (event.target.matches('[data-qdm-filter]')) {
      sectorFilter = event.target.value;
      render();
    }
  }

  function handleInput(event) {
    var roleSection = event.target.closest('[data-qdm-role]');
    if (roleSection) syncRoleOutput(roleSection);
    if (!event.target.matches('[data-qdm-search]')) return;
    search = event.target.value;
    var position = event.target.selectionStart;
    render();
    var input = root.querySelector('[data-qdm-search]');
    if (input) {
      input.focus();
      input.setSelectionRange(position, position);
    }
  }

  function handleSubmit(event) {
    var form = event.target.closest('[data-qdm-form]');
    if (!form) return;
    event.preventDefault();
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    saveForm(form).catch(showError).finally(function () {
      if (button && button.isConnected) button.disabled = false;
    });
  }

  function showError(error) {
    console.error('Falha na Gestão de Documentos:', error);
    toast(error && error.message ? error.message : 'Não foi possível concluir a operação.');
  }

  window.RildonXQualityDocuments = { mount: mount };
})();
