(function () {
  'use strict';

  var BUCKET = 'rildonx-internal-policies';
  var TABLE = 'internal_policy_documents';
  var MAX_FILE_SIZE = 25 * 1024 * 1024;
  var ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ];
  var recordsById = new Map();
  var quickLinksRequest = null;
  var quickLinksRequestId = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function client() {
    if (!window.supabaseClient) throw new Error('O serviço de documentos não está disponível.');
    return window.supabaseClient;
  }

  function fileTypeLabel(fileName) {
    var extension = String(fileName || '').split('.').pop().toUpperCase();
    return /^[A-Z0-9]{2,5}$/.test(extension) ? extension : 'DOC';
  }

  function formatDate(value) {
    if (!value) return 'Sem data de vigência';
    var date = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    return Number.isNaN(date.getTime()) ? 'Sem data de vigência' :
      date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatSize(size) {
    var bytes = Number(size) || 0;
    return bytes >= 1024 * 1024
      ? (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
      : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function fileSegment(fileName) {
    var name = String(fileName || 'documento').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(-120) || 'documento';
  }

  function statusLabel(status) {
    return status === 'published' ? 'Publicado' : status === 'archived' ? 'Arquivado' : 'Rascunho';
  }

  function currentUserId(data) {
    return data && data.user && data.user.id || '';
  }

  async function signedFileUrl(record) {
    var result = await client().storage.from(BUCKET).createSignedUrl(record.file_path, 60, {
      download: record.file_name
    });
    if (result.error) throw result.error;
    if (!result.data || !result.data.signedUrl) throw new Error('Não foi possível gerar um link seguro para o documento.');
    return result.data.signedUrl;
  }

  async function openFile(record) {
    try {
      var url = await signedFileUrl(record);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      console.error('Não foi possível abrir a política interna:', error);
      if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível abrir o documento.');
    }
  }

  function policyRows(items, canManage) {
    if (!items.length) return '<div class="dashboard-business-empty"><b>Nenhum documento cadastrado</b><small>Envie uma política para começar.</small></div>';
    return '<div class="internal-policy-records">' + items.map(function (record) {
      var statusOptions = ['draft', 'published', 'archived'].map(function (status) {
        return '<option value="' + status + '"' + (record.status === status ? ' selected' : '') + '>' +
          statusLabel(status) + '</option>';
      }).join('');
      return '<article class="internal-policy-record"><div class="doc-icon ' +
        escapeHtml(fileTypeLabel(record.file_name).toLowerCase()) + '">' + escapeHtml(fileTypeLabel(record.file_name)) +
        '</div><div class="internal-policy-record-info"><b>' + escapeHtml(record.title) + '</b><span>Versão ' +
        escapeHtml(record.version) + ' · Vigência: ' + escapeHtml(formatDate(record.effective_date)) + ' · ' +
        escapeHtml(formatSize(record.file_size)) + '</span><small>' + escapeHtml(record.file_name) + '</small></div>' +
        '<button type="button" class="btn secondary" data-policy-file-id="' + escapeHtml(record.id) + '">Abrir</button>' +
        (canManage ? '<label class="internal-policy-status"><span>Status</span><select data-policy-status="' +
          escapeHtml(record.id) + '">' + statusOptions + '</select></label>' : '<span class="internal-policy-status-label">' +
          escapeHtml(statusLabel(record.status)) + '</span>') + '</article>';
    }).join('') + '</div>';
  }

  async function loadRecords() {
    var result = await client().from(TABLE).select('*').order('updated_at', { ascending: false });
    if (result.error) throw result.error;
    recordsById = new Map((result.data || []).map(function (record) {
      return [String(record.id), record];
    }));
    return result.data || [];
  }

  function panelMarkup(fromLibrary, canManage) {
    return '<section class="dashboard-business-panel dashboard-business-panel--internal-policies" role="dialog" aria-modal="true" aria-labelledby="internal-policies-title">' +
      '<header class="dashboard-business-header"><div><span class="dashboard-library-eyebrow">Gerência / Gestão</span>' +
      '<h2 id="internal-policies-title">Políticas Internas</h2><p>Documentos publicados ficam disponíveis aos colaboradores no link rápido.</p></div>' +
      '<div class="dashboard-business-header-actions">' + (fromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
      '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></header>' +
      (canManage ? '<form class="internal-policy-upload" data-policy-upload><h3>Adicionar uma versão</h3>' +
        '<label>Título<input name="title" maxlength="160" required></label>' +
        '<div class="internal-policy-upload-row"><label>Versão<input name="version" maxlength="40" required placeholder="Ex.: 1.0"></label>' +
        '<label>Vigência<input name="effectiveDate" type="date"></label></div>' +
        '<label>Documento ou imagem (JPEG, PNG, PDF, Word, Excel ou OpenDocument)<input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods" required></label>' +
        '<label>Ao enviar<select name="status"><option value="draft">Salvar como rascunho</option><option value="published">Publicar para todos</option></select></label>' +
        '<button class="btn" type="submit">Enviar documento</button><p class="internal-policy-upload-note">Até 25 MB. Publicar uma nova versão arquiva a versão anterior.</p></form>' : '') +
      '<div class="internal-policy-list-heading"><h3>Documentos e versões</h3><button type="button" class="btn secondary" data-policy-refresh>Atualizar</button></div>' +
      '<div data-policy-records><p class="internal-policy-loading">Carregando documentos…</p></div></section>';
  }

  async function renderModule(root, canManage) {
    var target = root.querySelector('[data-policy-records]');
    if (!target) return;
    target.innerHTML = '<p class="internal-policy-loading">Carregando documentos…</p>';
    var refreshButton = root.querySelector('[data-policy-refresh]');
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Carregando…';
    }
    var timeoutId;
    try {
      var records = await Promise.race([
        loadRecords(),
        new Promise(function (_, reject) {
          timeoutId = window.setTimeout(function () {
            reject(new Error('A consulta ao Supabase excedeu 15 segundos.'));
          }, 15000);
        })
      ]);
      if (!target.isConnected) return;
      target.innerHTML = policyRows(records, canManage);
    } catch (error) {
      console.error('Não foi possível carregar as políticas internas:', error);
      target.innerHTML = '<div class="internal-policy-load-error"><span>Não foi possível carregar os documentos: ' +
        escapeHtml(error && error.message || 'erro desconhecido') + '</span></div>';
    } finally {
      window.clearTimeout(timeoutId);
      if (refreshButton && refreshButton.isConnected) {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Atualizar';
      }
    }
  }

  async function uploadPolicy(form, data, canManage) {
    var submit = form.querySelector('[type="submit"]');
    var formData = new FormData(form);
    var title = String(formData.get('title') || '').trim();
    var version = String(formData.get('version') || '').trim();
    var file = formData.get('file');
    var status = formData.get('status') === 'published' ? 'published' : 'draft';
    var userId = currentUserId(data);
    if (!canManage) throw new Error('Seu perfil não pode gerenciar políticas internas.');
    if (!userId) throw new Error('Não foi possível identificar o usuário conectado.');
    if (!title || !version || !file || !file.size) throw new Error('Preencha o título, a versão e selecione um documento.');
    if (file.size > MAX_FILE_SIZE) throw new Error('O documento ultrapassa o limite de 25 MB.');
    if (ALLOWED_TYPES.indexOf(file.type) === -1) throw new Error('Formato não permitido. Envie JPEG, PNG, PDF, Word, Excel ou OpenDocument.');

    submit.disabled = true;
    submit.textContent = 'Enviando…';
    try {
      if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
        throw new Error('Este navegador não oferece geração segura de identificadores. Atualize-o e tente novamente.');
      }
      var path = userId + '/' + window.crypto.randomUUID() + '/' + fileSegment(file.name);
      var uploadResult = await client().storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });
      if (uploadResult.error) throw uploadResult.error;
      var insertResult = await client().from(TABLE).insert({
        title: title,
        version: version,
        effective_date: formData.get('effectiveDate') || null,
        status: status,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size
      });
      if (insertResult.error) {
        var cleanupResult = await client().storage.from(BUCKET).remove([path]);
        if (cleanupResult.error) {
          console.error('O envio do documento falhou e o arquivo temporário não pôde ser removido:', cleanupResult.error);
        }
        throw insertResult.error;
      }
      form.reset();
      if (typeof window.showToast === 'function') {
        window.showToast((status === 'published' ? 'Política publicada para todos os usuários.' : 'Documento salvo como rascunho.') +
          ' Clique em Atualizar para recarregar a listagem.');
      }
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enviar documento';
    }
  }

  async function updateStatus(recordId, status) {
    if (['draft', 'published', 'archived'].indexOf(status) === -1) return;
    var result = await client().from(TABLE).update({ status: status }).eq('id', recordId);
    if (result.error) throw result.error;
    if (typeof window.showToast === 'function') window.showToast('Status atualizado. Clique em Atualizar para recarregar a listagem.');
  }

  function mount(root, data, options) {
    var canManage = Boolean(options && options.canManage);
    root.innerHTML = panelMarkup(Boolean(options && options.fromLibrary), canManage);
    var panel = root.querySelector('.dashboard-business-panel--internal-policies');
    var moduleList = panel && panel.querySelector('[data-policy-records]');
    if (moduleList) {
      moduleList.innerHTML = '<div class="internal-policy-load-error"><span>Clique em Atualizar para carregar os documentos.</span>' +
        '<button type="button" class="btn secondary" data-policy-refresh>Atualizar</button></div>';
    }
    if (!panel) return;
    panel.addEventListener('submit', function (event) {
      if (!event.target.matches('[data-policy-upload]')) return;
      event.preventDefault();
      uploadPolicy(event.target, data, canManage).catch(function (error) {
        console.error('Não foi possível enviar a política interna:', error);
        if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível enviar o documento.');
      });
    });
    panel.addEventListener('click', function (event) {
      if (event.target.closest('[data-policy-refresh]')) renderModule(panel, canManage);
    });
    panel.addEventListener('change', function (event) {
      var statusSelect = event.target.closest('[data-policy-status]');
      if (!statusSelect) return;
      statusSelect.disabled = true;
      updateStatus(statusSelect.dataset.policyStatus, statusSelect.value).catch(function (error) {
        console.error('Não foi possível atualizar o status da política:', error);
        if (typeof window.showToast === 'function') window.showToast(error.message || 'Não foi possível atualizar o status.');
        statusSelect.disabled = false;
      });
    });
  }

  async function renderQuickLinks() {
    var root = document.querySelector('#modal-politicas .policy-list');
    if (!root) return;
    if (quickLinksRequest) return quickLinksRequest;
    var requestId = ++quickLinksRequestId;
    root.innerHTML = '<div class="internal-policy-load-error"><span>Carregando políticas publicadas…</span>' +
      '<button type="button" class="btn secondary" data-policy-quick-refresh disabled>Atualizar</button></div>';
    var timeoutId;
    quickLinksRequest = Promise.race([
      Promise.resolve().then(function () {
        return client().from(TABLE).select('*').eq('status', 'published').order('updated_at', { ascending: false });
      }),
      new Promise(function (_, reject) {
        timeoutId = window.setTimeout(function () {
          reject(new Error('A consulta ao Supabase excedeu 15 segundos.'));
        }, 15000);
      })
    ]).then(function (result) {
      if (result.error) throw result.error;
      if (requestId !== quickLinksRequestId || !root.isConnected) return;
      var records = result.data || [];
      records.forEach(function (record) { recordsById.set(String(record.id), record); });
      root.innerHTML = '<div class="internal-policy-load-error"><span>Políticas publicadas</span>' +
        '<button type="button" class="btn secondary" data-policy-quick-refresh>Atualizar</button></div>' +
        (records.length ? records.map(function (record) {
        return '<div class="policy-row internal-policy-published-row"><div class="doc-icon ' + escapeHtml(fileTypeLabel(record.file_name).toLowerCase()) + '">' +
          escapeHtml(fileTypeLabel(record.file_name)) + '</div><div><b>' + escapeHtml(record.title) + '</b><span>Versão ' +
          escapeHtml(record.version) + ' · Vigência: ' + escapeHtml(formatDate(record.effective_date)) +
          ' · ' + escapeHtml(formatSize(record.file_size)) + '</span></div><button type="button" class="dl-btn" data-policy-file-id="' +
          escapeHtml(record.id) + '" aria-label="Abrir ' + escapeHtml(record.title) + '">↗</button></div>';
      }).join('') : '<p class="internal-policy-loading">Nenhuma política foi publicada.</p>');
      root.dataset.loaded = 'true';
    }).catch(function (error) {
      console.error('Não foi possível carregar as políticas publicadas:', error);
      if (requestId === quickLinksRequestId && root.isConnected) {
        root.innerHTML = '<div class="internal-policy-load-error"><span>Não foi possível carregar as políticas: ' +
          escapeHtml(error && error.message || 'erro desconhecido') + '</span><button type="button" class="btn secondary" data-policy-quick-refresh>Atualizar</button></div>';
      }
    }).finally(function () {
      window.clearTimeout(timeoutId);
      if (requestId === quickLinksRequestId) quickLinksRequest = null;
    });
    return quickLinksRequest;
  }

  document.addEventListener('click', function (event) {
    var refreshButton = event.target.closest('[data-policy-quick-refresh]');
    if (refreshButton) {
      renderQuickLinks();
      return;
    }
    var fileButton = event.target.closest('[data-policy-file-id]');
    if (!fileButton) return;
    var record = recordsById.get(String(fileButton.dataset.policyFileId));
    if (record) openFile(record);
  });

  document.querySelectorAll('#modal-politicas .policy-list').forEach(function (root) {
    root.innerHTML = '<div class="internal-policy-load-error"><span>Clique em Atualizar para buscar as políticas publicadas.</span>' +
      '<button type="button" class="btn secondary" data-policy-quick-refresh>Atualizar</button></div>';
  });

  window.RildonXInternalPolicies = {
    mount: mount,
    renderQuickLinks: renderQuickLinks
  };
})();
