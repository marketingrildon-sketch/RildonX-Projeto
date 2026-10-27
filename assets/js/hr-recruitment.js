(function () {
  'use strict';

  var MODULE_KEY = 'hr-recruitment';
  var STAGES = ['Triagem', 'Entrevista', 'Avaliação', 'Proposta', 'Contratado', 'Reprovado'];
  var root = null;
  var records = [];
  var userName = 'RH';
  var tab = 'talentos';
  var view = 'kanban';
  var query = '';
  var stageFilter = '';
  var vacancyFilter = '';
  var selectedId = '';
  var formMode = '';
  var loadError = '';
  var notice = '';
  var commentDraft = '';
  var channel = null;
  var refreshTimer = null;
  var pollTimer = null;
  var saving = false;
  var CV_BUCKET = 'hr-recruitment-cvs';
  var CV_MAX_SIZE = 15 * 1024 * 1024;
  var CV_TYPES = {
    pdf: { mime: 'application/pdf', allowed: ['application/pdf'] },
    doc: { mime: 'application/msword', allowed: ['application/msword', 'application/x-msword'] },
    docx: {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      allowed: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream'
      ]
    }
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function dataOf(record) {
    return record && record.data && typeof record.data === 'object' ? record.data : {};
  }

  function candidates() {
    return records.filter(function (record) { return dataOf(record).entity === 'candidate' && !record.archived; });
  }

  function vacancies() {
    return records.filter(function (record) { return dataOf(record).entity === 'vacancy' && !record.archived; });
  }

  function optionList(items, selected, emptyLabel) {
    return '<option value="">' + escapeHtml(emptyLabel || 'Selecione') + '</option>' + items.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (String(selected || '') === String(item.id) ? ' selected' : '') + '>' +
        escapeHtml(item.title) + '</option>';
    }).join('');
  }

  function setNotice(message, error) {
    notice = message ? '<div class="hr-rec-notice' + (error ? ' is-error' : '') + '" role="' + (error ? 'alert' : 'status') + '">' +
      escapeHtml(message) + '</div>' : '';
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

  async function loadRecords() {
    if (!window.supabaseClient) throw new Error('A conexão compartilhada com o Supabase não está configurada.');
    var result = await window.supabaseClient.from('business_card_records').select('*')
      .eq('module_key', MODULE_KEY).eq('archived', false).order('updated_at', { ascending: false });
    if (result.error) throw result.error;
    records = result.data || [];
    loadError = '';
    if (!formMode && !selectedId) render();
  }

  function filteredCandidates() {
    var needle = normalize(query);
    return candidates().filter(function (record) {
      var data = dataOf(record);
      var text = [record.title, data.email, data.phone, data.city, data.education, data.experience,
        data.source, data.vacancyTitle, data.tags, data.notes]
        .concat(Array.isArray(data.tags) ? data.tags : []);
      var matchesQuery = !needle || text.some(function (value) { return normalize(value).indexOf(needle) !== -1; });
      var matchesStage = !stageFilter || record.status === stageFilter;
      var matchesVacancy = !vacancyFilter || data.vacancyId === vacancyFilter;
      return matchesQuery && matchesStage && matchesVacancy;
    }).sort(function (first, second) {
      return new Date(second.updated_at || 0).getTime() - new Date(first.updated_at || 0).getTime();
    });
  }

  function renderTags(tags) {
    return (Array.isArray(tags) ? tags : []).slice(0, 5).map(function (tag) {
      return '<span class="hr-rec-tag">' + escapeHtml(tag) + '</span>';
    }).join('');
  }

  function renderCandidateCard(record) {
    var data = dataOf(record);
    var age = Math.max(0, Math.floor((Date.now() - new Date(record.created_at || Date.now()).getTime()) / 86400000));
    return '<article class="hr-rec-candidate" data-candidate="' + escapeHtml(record.id) + '">' +
      '<button class="hr-rec-candidate-open" type="button" data-open-candidate="' + escapeHtml(record.id) + '">' +
      '<span class="hr-rec-avatar">' + escapeHtml(String(record.title || '?').trim().split(/\s+/).slice(0, 2).map(function (word) { return word[0]; }).join('').toUpperCase()) +
      '</span><span class="hr-rec-candidate-info"><strong>' + escapeHtml(record.title) + '</strong><small>' +
      escapeHtml(data.vacancyTitle || 'Sem vaga vinculada') + ' · ' + (age === 0 ? 'Hoje' : age + (age === 1 ? ' dia' : ' dias')) +
      '</small></span></button><div class="hr-rec-tags">' + renderTags(data.tags) + '</div>' +
      '<label class="hr-rec-move">Etapa<select data-move-candidate="' + escapeHtml(record.id) + '">' +
      STAGES.map(function (stage) { return '<option' + (record.status === stage ? ' selected' : '') + '>' + stage + '</option>'; }).join('') +
      '</select></label></article>';
  }

  function renderPipeline() {
    var list = filteredCandidates();
    if (view === 'lista') {
      return '<div class="hr-rec-table-wrap"><table class="hr-rec-table"><thead><tr><th>Talento</th><th>Vaga</th><th>Etapa</th><th>Origem</th><th>Atualizado</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (record) {
          var data = dataOf(record);
          return '<tr><td><strong>' + escapeHtml(record.title) + '</strong><small>' + escapeHtml(data.email || 'E-mail não informado') + '</small></td><td>' +
            escapeHtml(data.vacancyTitle || '—') + '</td><td><span class="hr-rec-stage">' + escapeHtml(record.status) + '</span></td><td>' +
            escapeHtml(data.source || '—') + '</td><td>' + escapeHtml(new Date(record.updated_at).toLocaleDateString('pt-BR')) +
            '</td><td><button class="btn secondary" type="button" data-open-candidate="' + escapeHtml(record.id) + '">Abrir</button></td></tr>';
        }).join('') : '<tr><td colspan="6" class="hr-rec-empty">Nenhum talento encontrado para esses filtros.</td></tr>') + '</tbody></table></div>';
    }
    return '<div class="hr-rec-kanban">' + STAGES.map(function (stage) {
      var stageCandidates = list.filter(function (record) { return record.status === stage; });
      return '<section class="hr-rec-column"><header><strong>' + escapeHtml(stage) + '</strong><span>' + stageCandidates.length +
        '</span></header><div class="hr-rec-column-body">' + (stageCandidates.length
          ? stageCandidates.map(renderCandidateCard).join('')
          : '<div class="hr-rec-column-empty">Nenhum talento nesta etapa</div>') + '</div></section>';
    }).join('') + '</div>';
  }

  function renderVacancies() {
    var rows = vacancies().slice().sort(function (a, b) {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return '<div class="hr-rec-vacancy-grid">' + (rows.length ? rows.map(function (record) {
      var data = dataOf(record);
      var count = candidates().filter(function (candidate) { return dataOf(candidate).vacancyId === record.id; }).length;
      return '<article class="hr-rec-vacancy"><div><span class="hr-rec-vacancy-status ' + (record.status === 'Aberta' ? 'is-open' : '') +
        '">' + escapeHtml(record.status) + '</span><h3>' + escapeHtml(record.title) + '</h3><p>' +
        escapeHtml([data.department, data.location, data.contractType].filter(Boolean).join(' · ') || 'Detalhes não informados') +
        '</p></div><div class="hr-rec-vacancy-meta"><span><b>' + count + '</b> talentos</span><span>Responsável: ' +
        escapeHtml(data.manager || 'RH') + '</span></div><p class="hr-rec-vacancy-description">' + escapeHtml(data.description || 'Sem descrição cadastrada.') +
        '</p><div class="hr-rec-actions"><button class="btn secondary" type="button" data-filter-vacancy="' + escapeHtml(record.id) + '">Ver talentos</button>' +
        '<button class="btn secondary" type="button" data-toggle-vacancy="' + escapeHtml(record.id) + '">' +
        (record.status === 'Aberta' ? 'Pausar vaga' : 'Reabrir vaga') +
        '</button>' + (record.status !== 'Encerrada' ? '<button class="btn secondary" type="button" data-close-vacancy="' +
          escapeHtml(record.id) + '">Encerrar vaga</button>' : '') + '</div></article>';
    }).join('') : '<div class="hr-rec-empty-card">Nenhuma vaga cadastrada. Crie uma vaga para iniciar o processo seletivo.</div>') + '</div>';
  }

  function renderAnalytics() {
    var people = candidates();
    var open = vacancies().filter(function (record) { return record.status === 'Aberta'; }).length;
    var active = people.filter(function (record) { return ['Contratado', 'Reprovado'].indexOf(record.status) === -1; }).length;
    var hired = people.filter(function (record) { return record.status === 'Contratado'; }).length;
    var rejected = people.filter(function (record) { return record.status === 'Reprovado'; }).length;
    return '<div class="hr-rec-analytics-grid"><article><small>Vagas abertas</small><strong>' + open + '</strong></article>' +
      '<article><small>Talentos ativos</small><strong>' + active + '</strong></article><article><small>Contratações</small><strong>' + hired +
      '</strong></article><article><small>Encerrados sem contratação</small><strong>' + rejected + '</strong></article></div>' +
      '<section class="hr-rec-stage-report"><h3>Talentos por etapa</h3>' + STAGES.map(function (stage) {
        var count = people.filter(function (record) { return record.status === stage; }).length;
        var percent = people.length ? Math.round(count * 100 / people.length) : 0;
        return '<div class="hr-rec-stage-row"><span>' + escapeHtml(stage) + '</span><div><i style="width:' + percent + '%"></i></div><b>' + count + '</b></div>';
      }).join('') + '</section><p class="hr-rec-muted">Indicadores calculados a partir dos registros ativos deste painel.</p>';
  }

  function renderCandidateDetail(record) {
    var data = dataOf(record);
    var comments = Array.isArray(data.comments) ? data.comments : [];
    var history = Array.isArray(data.history) ? data.history.slice().reverse() : [];
    return '<section class="hr-rec-detail"><div class="hr-rec-detail-heading"><div><span class="hr-rec-eyebrow">Perfil do talento</span><h3>' +
      escapeHtml(record.title) + '</h3><p>' + escapeHtml(data.vacancyTitle || 'Sem vaga vinculada') + '</p></div>' +
      '<button class="btn secondary" type="button" data-close-detail>Voltar ao painel</button></div>' +
      '<div class="hr-rec-detail-grid"><article><h4>Contato</h4><p><b>E-mail</b><br>' + escapeHtml(data.email || '—') +
      '</p><p><b>Telefone</b><br>' + escapeHtml(data.phone || '—') + '</p><p><b>Cidade</b><br>' + escapeHtml(data.city || '—') +
      '</p><p><b>LinkedIn / portfólio</b><br>' + (data.linkedin ? '<a href="' + escapeHtml(data.linkedin) +
        '" target="_blank" rel="noopener noreferrer">Abrir perfil</a>' : '—') + '</p><p><b>Origem</b><br>' + escapeHtml(data.source || '—') +
      '</p></article><article><h4>Perfil profissional</h4><p><b>Formação</b><br>' + escapeHtml(data.education || '—') +
      '</p><p><b>Experiência</b><br>' + escapeHtml(data.experience || '—') + '</p><p><b>Pretensão salarial</b><br>' +
      escapeHtml(data.salaryExpectation || '—') + '</p><p><b>Disponibilidade</b><br>' + escapeHtml(data.availability || '—') +
      '</p><p><b>CV</b><br>' + (data.cv && data.cv.path ? '<button class="btn secondary" type="button" data-open-cv="' +
        escapeHtml(record.id) + '">Abrir / baixar ' + escapeHtml(data.cv.name || 'currículo') + '</button>' : 'Não anexado') +
      '</p></article><article><h4>Processo seletivo</h4><label class="hr-rec-field">Etapa<select data-detail-stage="' + escapeHtml(record.id) + '">' +
      STAGES.map(function (stage) { return '<option' + (stage === record.status ? ' selected' : '') + '>' + stage + '</option>'; }).join('') +
      '</select></label><p><b>Etiquetas</b></p><div class="hr-rec-tags">' + renderTags(data.tags) + '</div><p><b>Observações</b><br>' +
      escapeHtml(data.notes || '—') + '</p></article><article class="hr-rec-comments"><h4>Comentários internos</h4><form data-comment-form="' +
      escapeHtml(record.id) + '"><textarea name="comment" rows="3" maxlength="2000" required placeholder="Registre uma observação para a equipe de RH">' +
      escapeHtml(commentDraft) + '</textarea>' +
      '<button class="btn" type="submit">Adicionar comentário</button></form>' + (comments.length ? '<ol>' + comments.slice().reverse().map(function (comment) {
        return '<li><strong>' + escapeHtml(comment.author || 'RH') + '</strong><small>' +
          escapeHtml(new Date(comment.at).toLocaleString('pt-BR')) + '</small><p>' + escapeHtml(comment.text) + '</p></li>';
      }).join('') + '</ol>' : '<p class="hr-rec-muted">Nenhum comentário registrado.</p>') + '</article></div>' +
      '<details class="hr-rec-history"><summary>Histórico do processo (' + history.length + ')</summary><ol>' +
      history.map(function (entry) {
        return '<li><strong>' + escapeHtml(entry.stage || 'Cadastro') + '</strong><span>' + escapeHtml(entry.by || 'RH') +
          ' · ' + escapeHtml(new Date(entry.at).toLocaleString('pt-BR')) + '</span></li>';
      }).join('') + '</ol></details></section>';
  }

  function renderForm() {
    if (formMode === 'candidate') {
      var openVacancies = vacancies().filter(function (record) { return record.status === 'Aberta'; });
      return '<section class="hr-rec-form-card"><div class="hr-rec-detail-heading"><div><span class="hr-rec-eyebrow">Novo talento</span><h3>Cadastrar candidato</h3></div>' +
        '<button class="btn secondary" type="button" data-cancel-form>Cancelar</button></div>' +
        '<form data-candidate-form><div class="hr-rec-form-grid"><label class="hr-rec-field">Nome completo *<input name="name" required maxlength="160"></label>' +
        '<label class="hr-rec-field">Vaga<select name="vacancyId">' + optionList(openVacancies, '', 'Banco de talentos (sem vaga)') + '</select></label>' +
        '<label class="hr-rec-field">E-mail<input name="email" type="email" maxlength="254" autocomplete="email"></label>' +
        '<label class="hr-rec-field">Telefone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>' +
        '<label class="hr-rec-field">Cidade / região<input name="city" maxlength="120" autocomplete="address-level2"></label>' +
        '<label class="hr-rec-field">LinkedIn / portfólio<input name="linkedin" type="url" maxlength="500" placeholder="https://"></label>' +
        '<label class="hr-rec-field">Formação acadêmica<input name="education" maxlength="240" placeholder="Curso, instituição e nível"></label>' +
        '<label class="hr-rec-field">Experiência profissional<textarea name="experience" rows="3" maxlength="1000" placeholder="Resumo da experiência e áreas de atuação"></textarea></label>' +
        '<label class="hr-rec-field">Pretensão salarial<input name="salaryExpectation" maxlength="80"></label>' +
        '<label class="hr-rec-field">Disponibilidade<select name="availability"><option value="">Selecione</option><option>Imediata</option><option>Até 15 dias</option><option>Até 30 dias</option><option>A combinar</option></select></label>' +
        '<label class="hr-rec-field">Origem<select name="source"><option>Indicação</option><option>LinkedIn</option><option>Site da empresa</option><option>Banco de talentos</option><option>Outro</option></select></label>' +
        '<label class="hr-rec-field">Habilidades / etiquetas<input name="tags" placeholder="Ex.: liderança, Excel (separadas por vírgula)" maxlength="500"></label>' +
        '<label class="hr-rec-field hr-rec-field-wide">Importar CV (PDF, DOC ou DOCX)<input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><small>Opcional · máximo de 15 MB</small></label>' +
        '<label class="hr-rec-field hr-rec-field-wide">Observações internas<textarea name="notes" rows="3" maxlength="2000" placeholder="Informações relevantes para a triagem"></textarea></label></div>' +
        '<div class="hr-rec-actions"><button class="btn" type="submit">Salvar talento</button></div></form></section>';
    }
    if (formMode === 'vacancy') {
      return '<section class="hr-rec-form-card"><div class="hr-rec-detail-heading"><div><span class="hr-rec-eyebrow">Nova posição</span><h3>Cadastrar vaga</h3></div>' +
        '<button class="btn secondary" type="button" data-cancel-form>Cancelar</button></div><form data-vacancy-form><div class="hr-rec-form-grid">' +
        '<label class="hr-rec-field">Nome da vaga<input name="title" required maxlength="160"></label><label class="hr-rec-field">Área<input name="department" maxlength="100"></label>' +
        '<label class="hr-rec-field">Localização<input name="location" maxlength="120"></label><label class="hr-rec-field">Tipo de contrato<select name="contractType">' +
        '<option>CLT</option><option>PJ</option><option>Estágio</option><option>Temporário</option><option>Outro</option></select></label>' +
        '<label class="hr-rec-field">Gestor responsável<input name="manager" maxlength="160"></label>' +
        '<label class="hr-rec-field hr-rec-field-wide">Descrição e requisitos<textarea name="description" rows="4" maxlength="4000"></textarea></label></div>' +
        '<div class="hr-rec-actions"><button class="btn" type="submit">Publicar vaga internamente</button></div></form></section>';
    }
    return '';
  }

  function render() {
    if (!root || !root.isConnected) return;
    var people = candidates();
    var vacanciesTotal = vacancies().filter(function (record) { return record.status === 'Aberta'; }).length;
    var content = '';
    if (selectedId) {
      var selected = people.find(function (record) { return String(record.id) === String(selectedId); });
      content = selected ? renderCandidateDetail(selected) : '<div class="hr-rec-empty-card">Este talento não está mais disponível.</div>';
    } else if (formMode) {
      content = renderForm();
    } else if (tab === 'vagas') {
      content = renderVacancies();
    } else if (tab === 'indicadores') {
      content = renderAnalytics();
    } else {
      var vacancyOptions = '<option value="">Todas as vagas</option>' + vacancies().map(function (record) {
        return '<option value="' + escapeHtml(record.id) + '"' + (vacancyFilter === record.id ? ' selected' : '') + '>' + escapeHtml(record.title) + '</option>';
      }).join('');
      content = '<div class="hr-rec-toolbar"><div class="hr-rec-view-toggle"><button type="button" data-view="kanban" class="' +
        (view === 'kanban' ? 'is-active' : '') + '">Kanban</button><button type="button" data-view="lista" class="' +
        (view === 'lista' ? 'is-active' : '') + '">Lista</button></div><label class="hr-rec-search"><span class="sr-only">Buscar talentos</span>' +
        '<input type="search" data-search value="' + escapeHtml(query) + '" placeholder="Buscar por nome, vaga, habilidade ou etiqueta"></label>' +
        '<label class="hr-rec-filter"><span class="sr-only">Filtrar etapa</span><select data-stage-filter><option value="">Todas as etapas</option>' +
        STAGES.map(function (stage) { return '<option' + (stageFilter === stage ? ' selected' : '') + '>' + stage + '</option>'; }).join('') +
        '</select></label><label class="hr-rec-filter"><span class="sr-only">Filtrar vaga</span><select data-vacancy-filter>' + vacancyOptions +
        '</select></label><button class="btn" type="button" data-new-candidate>+ Novo talento</button></div>' + renderPipeline();
    }
    root.innerHTML = '<div class="hr-rec-app">' + notice + (loadError ? '<div class="hr-rec-notice is-error" role="alert">' + escapeHtml(loadError) + '</div>' : '') +
      '<div class="hr-rec-metrics"><article><small>Vagas ativas</small><strong>' + vacanciesTotal + '</strong></article>' +
      '<article><small>Talentos no processo</small><strong>' + people.filter(function (record) { return ['Contratado', 'Reprovado'].indexOf(record.status) === -1; }).length +
      '</strong></article><article><small>Entrevistas</small><strong>' + people.filter(function (record) { return record.status === 'Entrevista'; }).length +
      '</strong></article><article><small>Contratados</small><strong>' + people.filter(function (record) { return record.status === 'Contratado'; }).length + '</strong></article></div>' +
      '<nav class="hr-rec-tabs" aria-label="Seções de recrutamento"><button type="button" data-tab="talentos" class="' + (tab === 'talentos' ? 'is-active' : '') +
      '">Talentos <span>' + people.length + '</span></button><button type="button" data-tab="vagas" class="' + (tab === 'vagas' ? 'is-active' : '') +
      '">Vagas <span>' + vacanciesTotal + '</span></button><button type="button" data-tab="indicadores" class="' + (tab === 'indicadores' ? 'is-active' : '') +
      '">Indicadores</button>' + (tab === 'vagas' ? '<button type="button" class="btn hr-rec-tab-action" data-new-vacancy>+ Nova vaga</button>' : '') +
      '</nav><div class="hr-rec-content">' + content + '</div></div>';
  }

  function uuid() {
    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') throw new Error('Atualize o navegador para gerar um identificador seguro.');
    return window.crypto.randomUUID();
  }

  async function insertRecord(title, status, data, recordId) {
    var auth = await window.supabaseClient.auth.getUser();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
    var result = await window.supabaseClient.from('business_card_records').insert({
      id: recordId || uuid(),
      module_key: MODULE_KEY,
      sector: 'rh',
      title: title,
      status: status,
      data: data,
      created_by: auth.data.user.id
    }).select('*').single();
    if (result.error) throw result.error;
    records.unshift(result.data);
    return result.data;
  }

  async function uploadCandidateCv(file, candidateId) {
    if (!file) return null;
    var extensionMatch = String(file.name || '').toLowerCase().match(/\.([^.]+)$/);
    var extension = extensionMatch && extensionMatch[1];
    var fileType = extension && Object.prototype.hasOwnProperty.call(CV_TYPES, extension)
      ? CV_TYPES[extension]
      : null;
    var mimeType = String(file.type || '').toLowerCase();
    if (!fileType || (mimeType && fileType.allowed.indexOf(mimeType) === -1)) {
      throw new Error('Envie o currículo em formato PDF, DOC ou DOCX.');
    }
    if (!file.size || file.size > CV_MAX_SIZE) {
      throw new Error('O currículo deve ter no máximo 15 MB.');
    }
    var auth = await window.supabaseClient.auth.getUser();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
    var path = auth.data.user.id + '/' + candidateId + '/' + uuid() + '.' + extension;
    var bucket = window.supabaseClient.storage.from(CV_BUCKET);
    var result = await bucket.upload(path, file, {
      contentType: fileType.mime,
      upsert: false
    });
    if (result.error) throw result.error;
    return {
      path: path,
      name: String(file.name || 'curriculo.' + extension).slice(0, 240),
      mimeType: fileType.mime,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };
  }

  async function openCandidateCv(record) {
    var cv = dataOf(record).cv;
    if (!cv || !cv.path) throw new Error('Este talento não possui currículo anexado.');
    var openedWindow = window.open('about:blank', '_blank');
    if (!openedWindow) throw new Error('Permita a abertura de novas abas para visualizar o currículo.');
    var result = await window.supabaseClient.storage.from(CV_BUCKET).createSignedUrl(cv.path, 60, {
      download: cv.name || true
    });
    if (result.error) {
      openedWindow.close();
      throw result.error;
    }
    openedWindow.location = result.data.signedUrl;
  }

  async function updateRecord(record, changes) {
    if (saving) return;
    saving = true;
    try {
      if (changes.data && dataOf(record).entity === 'candidate') {
        changes.data = Object.assign({}, changes.data, { updatedByName: userName });
      }
      if (dataOf(record).entity === 'candidate' && changes.status) {
        changes.data = Object.assign({}, dataOf(record), changes.data || {}, { updatedByName: userName });
      }
      var result = await window.supabaseClient.from('business_card_records').update(changes)
        .eq('id', record.id).eq('updated_at', record.updated_at).select('*').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        await loadRecords();
        throw new Error('Este registro foi atualizado por outra pessoa. Confira os dados e tente novamente.');
      }
      records = records.map(function (item) { return item.id === record.id ? result.data : item; });
    } finally {
      saving = false;
    }
  }

  function showError(error, context) {
    console.error(context, error);
    setNotice(error.message || 'Não foi possível salvar. Tente novamente.', true);
    render();
  }

  function bindEvents() {
    root.addEventListener('input', function (event) {
      if (event.target.matches('[data-search]')) {
        query = event.target.value;
        var cursor = event.target.selectionStart;
        render();
        var input = root.querySelector('[data-search]');
        input.focus();
        input.setSelectionRange(cursor, cursor);
      }
      if (event.target.matches('[data-comment-form] textarea')) commentDraft = event.target.value;
    });
    root.addEventListener('change', function (event) {
      if (event.target.matches('[data-stage-filter]')) { stageFilter = event.target.value; render(); }
      if (event.target.matches('[data-vacancy-filter]')) { vacancyFilter = event.target.value; render(); }
      var stageSelect = event.target.closest('[data-move-candidate], [data-detail-stage]');
      if (stageSelect) {
        var record = candidates().find(function (item) { return String(item.id) === String(stageSelect.dataset.moveCandidate || stageSelect.dataset.detailStage); });
        if (!record || record.status === stageSelect.value) return;
        updateRecord(record, { status: stageSelect.value }).then(function () { setNotice('Etapa atualizada.', false); render(); })
          .catch(function (error) { showError(error, 'Não foi possível atualizar a etapa do processo seletivo:'); });
      }
    });
    root.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.tab) { tab = button.dataset.tab; selectedId = ''; formMode = ''; setNotice('', false); render(); }
      if (button.dataset.view) { view = button.dataset.view; render(); }
      if (button.matches('[data-new-candidate]')) { tab = 'talentos'; selectedId = ''; formMode = 'candidate'; render(); }
      if (button.matches('[data-new-vacancy]')) { tab = 'vagas'; selectedId = ''; formMode = 'vacancy'; render(); }
      if (button.dataset.openCandidate) { selectedId = button.dataset.openCandidate; formMode = ''; commentDraft = ''; setNotice('', false); render(); }
      if (button.matches('[data-close-detail]')) { selectedId = ''; commentDraft = ''; render(); }
      if (button.matches('[data-cancel-form]')) { formMode = ''; render(); }
      if (button.dataset.openCv) {
        var candidate = candidates().find(function (item) { return item.id === button.dataset.openCv; });
        if (!candidate) return;
        openCandidateCv(candidate).catch(function (error) { showError(error, 'Não foi possível abrir o currículo:'); });
      }
      if (button.dataset.filterVacancy) { tab = 'talentos'; vacancyFilter = button.dataset.filterVacancy; render(); }
      if (button.dataset.toggleVacancy) {
        var vacancy = vacancies().find(function (item) { return item.id === button.dataset.toggleVacancy; });
        if (!vacancy) return;
        var nextStatus = vacancy.status === 'Aberta' ? 'Em pausa' : 'Aberta';
        updateRecord(vacancy, { status: nextStatus }).then(function () { setNotice('Status da vaga atualizado.', false); render(); })
          .catch(function (error) { showError(error, 'Não foi possível atualizar a vaga:'); });
      }
      if (button.dataset.closeVacancy) {
        var vacancyToClose = vacancies().find(function (item) { return item.id === button.dataset.closeVacancy; });
        if (!vacancyToClose || !window.confirm('Encerrar a vaga "' + vacancyToClose.title + '"? Os talentos e o histórico serão preservados.')) return;
        updateRecord(vacancyToClose, { status: 'Encerrada' }).then(function () {
          setNotice('Vaga encerrada. O histórico dos talentos foi preservado.', false);
          render();
        }).catch(function (error) { showError(error, 'Não foi possível encerrar a vaga:'); });
      }
    });
    root.addEventListener('submit', function (event) {
      var form = event.target;
      if (form.matches('[data-vacancy-form]')) {
        event.preventDefault();
        var values = new FormData(form);
        var title = String(values.get('title') || '').trim();
        insertRecord(title, 'Aberta', {
          entity: 'vacancy', department: String(values.get('department') || '').trim(),
          location: String(values.get('location') || '').trim(), contractType: String(values.get('contractType') || ''),
          manager: String(values.get('manager') || '').trim(), description: String(values.get('description') || '').trim()
        }).then(function () {
          formMode = ''; setNotice('Vaga criada com sucesso.', false); render();
        }).catch(function (error) { showError(error, 'Não foi possível cadastrar a vaga:'); });
      } else if (form.matches('[data-candidate-form]')) {
        event.preventDefault();
        var values = new FormData(form);
        var selectedVacancyId = String(values.get('vacancyId') || '');
        var vacancy = selectedVacancyId
          ? vacancies().find(function (item) { return item.id === selectedVacancyId && item.status === 'Aberta'; })
          : null;
        if (selectedVacancyId && !vacancy) { setNotice('A vaga selecionada não está mais ativa. Atualize o formulário e tente novamente.', true); render(); return; }
        var tags = String(values.get('tags') || '').split(',').map(function (tag) { return tag.trim(); }).filter(Boolean).slice(0, 12);
        var title = String(values.get('name') || '').trim();
        var candidateId = uuid();
        var cvFile = form.elements.cv.files && form.elements.cv.files[0];
        var uploadedCvPath = '';
        var candidateData = {
          entity: 'candidate',
          email: String(values.get('email') || '').trim(),
          phone: String(values.get('phone') || '').trim(),
          city: String(values.get('city') || '').trim(),
          linkedin: String(values.get('linkedin') || '').trim(),
          education: String(values.get('education') || '').trim(),
          experience: String(values.get('experience') || '').trim(),
          salaryExpectation: String(values.get('salaryExpectation') || '').trim(),
          availability: String(values.get('availability') || ''),
          source: String(values.get('source') || ''),
          vacancyId: vacancy ? vacancy.id : null,
          vacancyTitle: vacancy ? vacancy.title : 'Banco de talentos',
          tags: tags,
          createdByName: userName,
          notes: String(values.get('notes') || '').trim(),
          comments: [],
          history: [{ stage: 'Triagem', by: userName, at: new Date().toISOString() }]
        };
        uploadCandidateCv(cvFile, candidateId).then(function (cv) {
          if (cv) {
            candidateData.cv = cv;
            uploadedCvPath = cv.path;
          }
          return insertRecord(title, 'Triagem', candidateData, candidateId);
        }).then(function () {
          formMode = ''; setNotice('Talento cadastrado na etapa Triagem.', false); render();
        }).catch(async function (error) {
          if (uploadedCvPath) {
            try {
              var cleanupResult = await window.supabaseClient.storage.from(CV_BUCKET).remove([uploadedCvPath]);
              if (cleanupResult.error) console.error('Não foi possível remover o currículo após falha no cadastro:', cleanupResult.error);
            } catch (cleanupError) {
              console.error('Não foi possível remover o currículo após falha no cadastro:', cleanupError);
            }
          }
          showError(error, 'Não foi possível cadastrar o talento:');
        });
      } else if (form.matches('[data-comment-form]')) {
        event.preventDefault();
        var record = candidates().find(function (item) { return item.id === form.dataset.commentForm; });
        var comment = String(new FormData(form).get('comment') || '').trim();
        if (!record || !comment) return;
        var data = dataOf(record);
        var comments = Array.isArray(data.comments) ? data.comments : [];
        updateRecord(record, { data: Object.assign({}, data, {
          comments: comments.concat([{ author: userName, text: comment, at: new Date().toISOString() }])
        }) }).then(function () {
          commentDraft = ''; setNotice('Comentário adicionado.', false); render();
        }).catch(function (error) { showError(error, 'Não foi possível adicionar o comentário:'); });
      }
    });
  }

  function mount(container, state, options) {
    cleanup();
    root = container;
    options = options || {};
    userName = String(options.userName || 'RH');
    records = [];
    tab = 'talentos';
    view = 'kanban';
    query = '';
    stageFilter = '';
    vacancyFilter = '';
    selectedId = '';
    formMode = '';
    commentDraft = '';
    loadError = '';
    notice = '';
    render();
    bindEvents();
    Promise.resolve(window.RildonXSync && typeof window.RildonXSync.ready === 'function' ? window.RildonXSync.ready() : undefined)
      .then(loadRecords).catch(function (error) {
        loadError = error.message || 'Não foi possível carregar o processo seletivo.';
        console.error('Não foi possível carregar Recrutamento e Seleção:', error);
        render();
      });
    if (window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
      channel = window.supabaseClient.channel('rildonx-hr-recruitment')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_card_records', filter: 'module_key=eq.' + MODULE_KEY }, function () {
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(function () {
            loadRecords().catch(function (error) {
              console.error('Não foi possível atualizar o recrutamento em tempo real:', error);
              loadError = 'Falha ao atualizar os dados. Recarregue a página para tentar novamente.';
              render();
            });
          }, 180);
        }).subscribe(function (status, error) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('A atualização em tempo real do recrutamento falhou:', error || status);
          }
        });
    }
    pollTimer = window.setInterval(function () {
      loadRecords().catch(function (error) { console.error('Não foi possível sincronizar o recrutamento:', error); });
    }, 60000);
  }

  window.RildonXHRRecruitment = { mount: mount };
})();
