(function () {
  'use strict';

  var BUCKET = 'hr-medical-exam-files';
  var TYPES = [
    ['admission', 'Admissional'],
    ['periodic', 'Periódico'],
    ['return', 'Retorno ao trabalho'],
    ['risk-change', 'Mudança de risco ocupacional'],
    ['termination', 'Demissional'],
    ['complementary', 'Complementar'],
    ['other', 'Outro']
  ];
  var STATUSES = [
    ['scheduled', 'Agendado'],
    ['completed', 'Realizado'],
    ['cancelled', 'Cancelado']
  ];
  var root = null;
  var state = {};
  var canManage = false;
  var exams = [];
  var documents = [];
  var profiles = [];
  var filterType = '';
  var filterStatus = '';
  var search = '';
  var editingId = '';
  var loading = false;
  var loadError = '';
  var channel = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  function profileName(id) {
    var profile = profiles.find(function (item) { return String(item.id) === String(id); });
    return profile ? profile.displayName || profile.nickname || 'Usuário' : 'Usuário removido';
  }

  function normalized(value) {
    return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function canViewMedicalDocuments(profile) {
    if (!profile || !profile.id || profile.active === false) return false;
    var sector = normalized(profile.sector).replace(/[^a-z0-9]/g, '');
    var role = normalized(profile.role);
    var nickname = normalized(profile.nickname);
    return nickname === 'adson.ri' ||
      ['rh', 'rhdp', 'recursoshumanos'].indexOf(sector) !== -1 ||
      /^ger|^gest|^diretoria/.test(normalized(profile.sector)) ||
      role.indexOf('gest') !== -1 || /(admin|gerente|gestor|diretor)/.test(role.replace(/[^a-z0-9]/g, ''));
  }

  function medicalDocumentViewers(ownerId) {
    return profiles.filter(canViewMedicalDocuments).map(function (profile) {
      return String(profile.id);
    }).filter(function (id) { return id !== String(ownerId); });
  }

  function mapSharedDocument(row) {
    return {
      id: row.id,
      name: row.name,
      fileType: row.file_type || 'file',
      size: row.size || 0,
      sizeLabel: row.size_label || String(row.size || 0) + ' Bytes',
      senderName: row.sender_name || 'Usuário',
      senderInitials: row.sender_initials || 'U',
      ownerId: row.owner_id || null,
      viewerIds: Array.isArray(row.viewer_ids) ? row.viewer_ids : [],
      sentAt: row.sent_at || new Date().toISOString(),
      folder: row.folder || 'Exames Ocupacionais',
      messageId: row.message_id || null,
      url: row.url || '#',
      mimeType: row.mime_type || 'application/octet-stream',
      relatedTaskId: row.related_task_id || null,
      relatedProjectId: row.related_project_id || null
    };
  }

  function typeLabel(value) {
    var type = TYPES.find(function (item) { return item[0] === value; });
    return type ? type[1] : 'Outro';
  }

  function statusLabel(value) {
    var status = STATUSES.find(function (item) { return item[0] === value; });
    return status ? status[1] : value;
  }

  function localDateTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function todayKey() {
    var date = new Date();
    return dateKey(date);
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function dueDate(exam) {
    if (exam.status === 'cancelled') return '';
    if (exam.status === 'scheduled') {
      var scheduled = new Date(exam.scheduled_at || '');
      return Number.isNaN(scheduled.getTime()) ? '' : dateKey(scheduled);
    }
    return exam.next_due_date || '';
  }

  function alertState(exam) {
    var due = dueDate(exam);
    if (!due) return '';
    var today = todayKey();
    if (due < today) return 'overdue';
    var days = Math.max(0, Math.min(365, Number(exam.alert_days) || 30));
    var limit = new Date();
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() + days);
    var limitKey = limit.getFullYear() + '-' + String(limit.getMonth() + 1).padStart(2, '0') + '-' +
      String(limit.getDate()).padStart(2, '0');
    return due <= limitKey ? 'upcoming' : '';
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(value.length === 10 ? value + 'T00:00:00' : value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', value.length === 10
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function documentList(examId) {
    return documents.filter(function (item) { return String(item.exam_id) === String(examId); });
  }

  function filteredExams() {
    var query = search.trim().toLocaleLowerCase('pt-BR');
    return exams.filter(function (exam) {
      if (filterType && exam.exam_type !== filterType) return false;
      if (filterStatus && exam.status !== filterStatus) return false;
      if (!query) return true;
      return [profileName(exam.employee_id), typeLabel(exam.exam_type), exam.provider, exam.notes]
        .join(' ').toLocaleLowerCase('pt-BR').includes(query);
    }).sort(function (a, b) {
      return String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || ''));
    });
  }

  function selectOptions(items, selected, placeholder) {
    return '<option value="">' + escapeHtml(placeholder) + '</option>' + items.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '"' + (String(item.value) === String(selected || '') ? ' selected' : '') + '>' +
        escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function formMarkup(exam) {
    var editing = Boolean(exam);
    var employeeOptions = profiles.filter(function (profile) { return profile.active !== false; }).map(function (profile) {
      return { value: profile.id, label: (profile.displayName || profile.nickname || 'Usuário') +
        (profile.sector ? ' · ' + profile.sector : '') };
    });
    var dateValue = exam ? localDateTime(exam.scheduled_at) : '';
    var typeValue = exam && exam.exam_type || 'periodic';
    var statusValue = exam && exam.status || 'scheduled';
    return '<details class="hme-form" ' + (editing ? 'open' : '') + '><summary>' +
      (editing ? 'Editar agendamento' : '+ Agendar exame') + '</summary><form data-hme-form data-exam-id="' + escapeHtml(exam && exam.id || '') + '">' +
      '<div class="hme-form-grid"><label class="hme-field"><span>Funcionário *</span><select name="employee_id" required>' +
      selectOptions(employeeOptions, exam && exam.employee_id, 'Selecione um funcionário') + '</select></label>' +
      '<label class="hme-field"><span>Tipo de exame *</span><select name="exam_type" required>' +
      selectOptions(TYPES.map(function (item) { return { value: item[0], label: item[1] }; }), typeValue, 'Selecione o tipo') + '</select></label>' +
      '<label class="hme-field"><span>Data e hora do agendamento *</span><input type="datetime-local" name="scheduled_at" required value="' + escapeHtml(dateValue) + '"></label>' +
      '<label class="hme-field"><span>Próximo vencimento / exame periódico</span><input type="date" name="next_due_date" value="' +
      escapeHtml(exam && exam.next_due_date || '') + '"></label>' +
      '<label class="hme-field"><span>Clínica / prestador</span><input type="text" name="provider" maxlength="180" value="' +
      escapeHtml(exam && exam.provider || '') + '"></label>' +
      '<label class="hme-field"><span>Alertar com antecedência (dias)</span><input type="number" name="alert_days" min="0" max="365" step="1" value="' +
      escapeHtml(exam ? exam.alert_days : 30) + '" required></label>' +
      '<label class="hme-field"><span>Situação *</span><select name="status" required>' +
      selectOptions(STATUSES.map(function (item) { return { value: item[0], label: item[1] }; }), statusValue, 'Selecione a situação') + '</select></label>' +
      '<label class="hme-field hme-field-wide"><span>Observação administrativa (não inclua diagnóstico ou resultado clínico)</span>' +
      '<textarea name="notes" rows="2" maxlength="1000">' + escapeHtml(exam && exam.notes || '') + '</textarea></label></div>' +
      '<div class="hme-form-actions"><button type="button" class="btn secondary" data-hme-cancel>Cancelar</button>' +
      '<button type="submit" class="btn">Salvar agendamento</button></div></form></details>';
  }

  function renderDocument(document) {
    return '<li><button type="button" class="hme-file-link" data-hme-open-file="' + escapeHtml(document.id) + '">' +
      escapeHtml(document.file_name) + '</button><small>' + escapeHtml(formatDate(document.created_at)) + '</small>' +
      (canManage ? '<button type="button" class="hme-file-remove" data-hme-remove-file="' + escapeHtml(document.id) + '" aria-label="Remover documento">×</button>' : '') +
      '</li>';
  }

  function renderRows() {
    var rows = filteredExams();
    if (!rows.length) return '<div class="hme-empty">Nenhum exame corresponde aos filtros selecionados.</div>';
    return '<div class="hme-table-wrap"><table class="hme-table"><thead><tr><th>Funcionário</th><th>Tipo</th><th>Agendamento</th>' +
      '<th>Próximo vencimento</th><th>Situação</th><th>Alerta</th><th>Documentos</th><th>Ações</th></tr></thead><tbody>' +
      rows.map(function (exam) {
        var alert = alertState(exam);
        var files = documentList(exam.id);
        var alertText = alert === 'overdue' ? 'Atrasado' : alert === 'upcoming' ? 'Próximo' : '—';
        return '<tr><td><b>' + escapeHtml(profileName(exam.employee_id)) + '</b>' +
          (exam.provider ? '<small>' + escapeHtml(exam.provider) + '</small>' : '') + '</td><td>' +
          escapeHtml(typeLabel(exam.exam_type)) + '</td><td>' + escapeHtml(formatDate(exam.scheduled_at)) + '</td><td>' +
          escapeHtml(formatDate(exam.next_due_date)) + '</td><td><span class="hme-status is-' + escapeHtml(exam.status) + '">' +
          escapeHtml(statusLabel(exam.status)) + '</span></td><td>' +
          (alert ? '<span class="hme-alert is-' + alert + '">' + alertText + '</span>' : '—') + '</td><td><details class="hme-files">' +
          '<summary>' + files.length + (files.length === 1 ? ' arquivo' : ' arquivos') + '</summary><ul>' +
          (files.map(renderDocument).join('') || '<li class="hme-no-files">Nenhum documento anexado.</li>') + '</ul>' +
          (canManage ? '<label class="hme-upload">Adicionar arquivo<input type="file" data-hme-upload="' + escapeHtml(exam.id) +
            '" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"></label>' : '') +
          '</details></td><td>' + (canManage ? '<button type="button" class="hme-action" data-hme-edit="' +
            escapeHtml(exam.id) + '">Editar</button>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function render() {
    if (!root || !root.isConnected) return;
    if (!canManage) {
      root.innerHTML = '<div class="hme-notice is-error">Este painel contém dados ocupacionais restritos. Solicite acesso autorizado ao RH.</div>';
      return;
    }
    var upcoming = exams.filter(function (exam) { return alertState(exam) === 'upcoming'; }).length;
    var overdue = exams.filter(function (exam) { return alertState(exam) === 'overdue'; }).length;
    root.innerHTML = '<section class="hme-panel"><div class="hme-privacy-note"><b>Acesso restrito ao RH e à Gestão.</b> Anexos também aparecem em Documentos, ' +
      'mas somente para quem enviou e perfis autorizados de RH/Gestão. A agenda exibe apenas “Compromisso de RH”, sem nome, tipo ou documentos.</div>' +
      '<div class="hme-summary"><article><small>Agendamentos e exames</small><strong>' + exams.length + '</strong></article>' +
      '<article class="is-upcoming"><small>Próximos</small><strong>' + upcoming + '</strong></article>' +
      '<article class="is-overdue"><small>Atrasados</small><strong>' + overdue + '</strong></article></div>' +
      (loadError ? '<div class="hme-notice is-error">' + escapeHtml(loadError) + '</div>' : '') +
      formMarkup(editingId ? exams.find(function (exam) { return exam.id === editingId; }) : null) +
      '<div class="hme-toolbar"><label><span>Tipo de exame</span><select data-hme-filter-type>' +
      selectOptions(TYPES.map(function (item) { return { value: item[0], label: item[1] }; }), filterType, 'Todos os tipos') + '</select></label>' +
      '<label><span>Situação</span><select data-hme-filter-status>' +
      selectOptions(STATUSES.map(function (item) { return { value: item[0], label: item[1] }; }), filterStatus, 'Todas') + '</select></label>' +
      '<label class="hme-search"><span>Buscar funcionário / clínica</span><input type="search" data-hme-search value="' + escapeHtml(search) + '"></label>' +
      '<button type="button" class="btn secondary" data-hme-refresh>Atualizar</button></div>' +
      '<p class="hme-help">Alertas de agendamentos usam a data marcada; exames realizados usam o próximo vencimento informado.</p>' +
      (loading ? '<div class="hme-notice">Carregando agendamentos e documentos…</div>' : '') + renderRows() + '</section>';
  }

  function userCanManage(profilesList, currentUser) {
    if (!currentUser) return false;
    var profile = profilesList.find(function (item) { return String(item.id) === String(currentUser.id); }) || {};
    var sector = String(profile.sector || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var role = String(profile.role || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var login = String(currentUser.email || '').split('@')[0].toLowerCase();
    return sector === 'rh' || sector.indexOf('rh/') === 0 || sector.indexOf('rhdp') === 0 ||
      sector.indexOf('recursos humanos') === 0 ||
      sector.indexOf('gerencia') === 0 || sector.indexOf('gestao') === 0 || sector.indexOf('diretoria') === 0 ||
      /admin|gerente|gestor|diretor/.test(role) || login === 'adson.ri' ||
      String(profile.nickname || '').toLowerCase() === 'adson.ri';
  }

  async function loadData() {
    if (loading || !root || !root.isConnected) return;
    if (!window.supabaseClient) {
      loadError = 'Não foi possível conectar ao Supabase. Verifique a sessão e tente novamente.';
      render();
      return;
    }
    loading = true;
    loadError = '';
    render();
    try {
      var results = await Promise.all([
        window.supabaseClient.from('hr_medical_exams').select('*').order('scheduled_at', { ascending: true }),
        window.supabaseClient.from('hr_medical_exam_documents')
          .select('id,exam_id,file_name,mime_type,file_size,storage_path,created_at').order('created_at', { ascending: false }),
        window.supabaseClient.rpc('get_rildonx_profiles')
      ]);
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;
      if (results[2].error) throw results[2].error;
      exams = results[0].data || [];
      documents = results[1].data || [];
      profiles = (results[2].data || []).map(function (profile) {
        return {
          id: profile.id,
          nickname: profile.nickname || '',
          displayName: profile.display_name || profile.nickname || 'Usuário',
          sector: profile.sector || '',
          role: profile.role || '',
          active: profile.active !== false
        };
      });
    } catch (error) {
      loadError = /does not exist|schema cache|relation .* not found/i.test(String(error.message || error))
        ? 'O painel ainda não foi ativado. Aplique docs/supabase-hr-medical-exams.sql no Supabase.'
        : 'Não foi possível carregar os dados. Confirme as permissões e a migração do Supabase.';
      console.error('Falha ao carregar agendamentos de exames ocupacionais:', error);
    } finally {
      loading = false;
      render();
    }
  }

  function mount(target, dashboardState, mayManage) {
    root = target;
    state = dashboardState || {};
    profiles = state.profiles || [];
    canManage = Boolean(mayManage) && userCanManage(profiles, state.user);
    if (!root.dataset.hmeBound) {
      root.dataset.hmeBound = 'true';
      root.addEventListener('click', handleClick);
      root.addEventListener('change', handleChange);
      root.addEventListener('input', handleInput);
      root.addEventListener('submit', handleSubmit);
    }
    render();
    loadData();
    if (!channel && canManage && window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
      channel = window.supabaseClient.channel('hr-medical-exams-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_medical_exams' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_medical_exam_documents' }, loadData)
        .subscribe();
    }
  }

  function formPayload(form) {
    var values = new FormData(form);
    var scheduled = values.get('scheduled_at');
    var alertDays = Number(values.get('alert_days'));
    var status = String(values.get('status') || '');
    var employeeId = String(values.get('employee_id') || '');
    if (!profiles.some(function (profile) { return String(profile.id) === employeeId; })) {
      throw new Error('Selecione um funcionário ativo cadastrado no portal.');
    }
    if (!TYPES.some(function (item) { return item[0] === values.get('exam_type'); })) throw new Error('Selecione um tipo de exame válido.');
    if (!STATUSES.some(function (item) { return item[0] === status; })) throw new Error('Selecione uma situação válida.');
    if (!scheduled || Number.isNaN(new Date(scheduled).getTime())) throw new Error('Informe a data e hora do agendamento.');
    if (!Number.isInteger(alertDays) || alertDays < 0 || alertDays > 365) throw new Error('O alerta deve ser configurado entre zero e 365 dias.');
    return {
      employee_id: employeeId,
      exam_type: String(values.get('exam_type')),
      scheduled_at: new Date(scheduled).toISOString(),
      next_due_date: String(values.get('next_due_date') || '') || null,
      provider: String(values.get('provider') || '').trim(),
      alert_days: alertDays,
      status: status,
      notes: String(values.get('notes') || '').trim()
    };
  }

  async function saveExam(form) {
    var payload = formPayload(form);
    var id = form.dataset.examId;
    var result = id
      ? await window.supabaseClient.from('hr_medical_exams').update(payload).eq('id', id).select('*').single()
      : await window.supabaseClient.from('hr_medical_exams').insert(payload).select('*').single();
    if (result.error) throw result.error;
    editingId = '';
    var calendarSyncFailed = false;
    try {
      if (!window.RildonXBusinessCalendarSync) throw new Error('O serviço de calendário não está carregado.');
      await window.RildonXBusinessCalendarSync.syncMany({
        source: 'hr-medical-exams',
        recordId: result.data.id,
        category: 'exame',
        title: 'Compromisso de RH',
        description: 'Compromisso ocupacional reservado pelo RH.'
      }, [
        {
          slot: 'appointment',
          date: result.data.status === 'scheduled' ? result.data.scheduled_at : ''
        },
        {
          slot: 'next-due',
          date: result.data.status === 'completed' ? result.data.next_due_date : '',
          title: 'Prazo de exame ocupacional',
          description: 'Lembrete de prazo de saúde ocupacional.'
        }
      ]);
    } catch (error) {
      calendarSyncFailed = true;
      console.error('Agendamento salvo, mas não sincronizado com o calendário:', error);
    }
    await loadData();
    toast(calendarSyncFailed
      ? 'Agendamento salvo, mas a sincronização com o calendário falhou. Verifique as permissões e a migração do calendário.'
      : 'Agendamento salvo e sincronizado ao seu calendário.');
  }

  async function uploadDocument(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var examId = input.dataset.hmeUpload;
    if (!exams.some(function (exam) { return String(exam.id) === String(examId); })) throw new Error('Agendamento não encontrado.');
    var extensions = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
    var extension = extensions[file.type];
    if (!extension) throw new Error('Envie somente arquivos PDF, PNG ou JPEG.');
    if (file.size > 15 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 15 MB.');
    var auth = await window.supabaseClient.auth.getUser();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
    var user = auth.data.user;
    var senderName = state.user && (state.user.displayName || state.user.name) || user.email || 'Usuário';
    var objectPath = 'exam-files/' + examId + '/' + crypto.randomUUID() + '.' + extension;
    var storage = window.supabaseClient.storage.from(BUCKET);
    var uploadResult = await storage.upload(objectPath, file, {
      contentType: file.type,
      upsert: false
    });
    if (uploadResult.error) throw uploadResult.error;
    var publicUrlResult = storage.getPublicUrl(objectPath);
    var publicUrl = publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl;
    if (!publicUrl) {
      var missingUrlCleanup = await storage.remove([objectPath]);
      if (missingUrlCleanup.error) console.error('Não foi possível remover o arquivo sem URL:', missingUrlCleanup.error);
      throw new Error('O Storage não retornou um endereço para o documento.');
    }
    var medicalDocument = null;
    var sharedDocument = null;
    try {
      var insertResult = await window.supabaseClient.from('hr_medical_exam_documents').insert({
        exam_id: examId,
        file_name: file.name.slice(0, 240),
        mime_type: file.type,
        file_size: file.size,
        storage_path: objectPath
      }).select('*').single();
      if (insertResult.error) throw insertResult.error;
      medicalDocument = insertResult.data;

      var senderInitials = senderName.split(/\s+/).map(function (part) { return part.charAt(0); })
        .join('').slice(0, 2).toUpperCase() || 'U';
      var formatBytes = window.RildonXDocumentUpload && window.RildonXDocumentUpload.formatBytes;
      var documentResult = await window.supabaseClient.from('documents').insert({
        name: file.name,
        file_type: extension,
        size: file.size,
        size_label: formatBytes ? formatBytes(file.size) : file.size + ' Bytes',
        sender_name: senderName,
        sender_initials: senderInitials,
        owner_id: user.id,
        viewer_ids: medicalDocumentViewers(user.id),
        sent_at: new Date().toISOString(),
        folder: 'Exames Ocupacionais',
        url: publicUrl,
        mime_type: file.type
      }).select('*').single();
      if (documentResult.error) throw documentResult.error;
      sharedDocument = documentResult.data;
    } catch (error) {
      if (sharedDocument) {
        var sharedCleanup = await window.supabaseClient.from('documents').delete().eq('id', sharedDocument.id);
        if (sharedCleanup.error) console.error('Não foi possível remover o registro de Documentos não concluído:', sharedCleanup.error);
      }
      if (medicalDocument) {
        var medicalCleanup = await window.supabaseClient.from('hr_medical_exam_documents').delete().eq('id', medicalDocument.id);
        if (medicalCleanup.error) console.error('Não foi possível remover o registro médico não concluído:', medicalCleanup.error);
      }
      var storageCleanup = await storage.remove([objectPath]);
      if (storageCleanup.error) console.error('Não foi possível remover arquivo após falha ao salvar metadados:', storageCleanup.error);
      throw error;
    }
    if (window.RildonXStore) window.RildonXStore.addDocument(mapSharedDocument(sharedDocument));
    window.dispatchEvent(new CustomEvent('rildonx:storage-changed'));
    await loadData();
    toast('Documento protegido anexado ao exame.');
  }

  async function openDocument(id) {
    var document = documents.find(function (item) { return String(item.id) === String(id); });
    if (!document) throw new Error('Documento não encontrado.');
    var openedWindow = window.open('about:blank', '_blank');
    if (!openedWindow) throw new Error('Permita a abertura de novas abas para visualizar o documento.');
    var result = await window.supabaseClient.storage.from(BUCKET).createSignedUrl(document.storage_path, 60);
    if (result.error) {
      openedWindow.close();
      throw result.error;
    }
    openedWindow.location = result.data.signedUrl;
  }

  async function removeDocument(id) {
    var document = documents.find(function (item) { return String(item.id) === String(id); });
    if (!document || !window.confirm('Remover este documento do registro do exame?')) return;
    var removeResult = await window.supabaseClient.storage.from(BUCKET).remove([document.storage_path]);
    if (removeResult.error) throw removeResult.error;
    var publicUrlResult = window.supabaseClient.storage.from(BUCKET).getPublicUrl(document.storage_path);
    var publicUrl = publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl;
    if (!publicUrl) throw new Error('Não foi possível localizar o documento na página Documentos.');
    var sharedDelete = await window.supabaseClient.from('documents').delete()
      .eq('folder', 'Exames Ocupacionais').eq('url', publicUrl).select('id');
    if (sharedDelete.error) throw sharedDelete.error;
    var deleteResult = await window.supabaseClient.from('hr_medical_exam_documents').delete().eq('id', id);
    if (deleteResult.error) throw deleteResult.error;
    var removedIds = (sharedDelete.data || []).map(function (row) { return String(row.id); });
    if (removedIds.length && window.RildonXStore) {
      var currentState = window.RildonXStore.getState();
      window.RildonXStore.setState({
        documents: (currentState.documents || []).filter(function (item) {
          return removedIds.indexOf(String(item.id)) === -1;
        })
      });
    }
    window.dispatchEvent(new CustomEvent('rildonx:storage-changed'));
    await loadData();
    toast('Documento removido.');
  }

  function handleClick(event) {
    var edit = event.target.closest('[data-hme-edit]');
    if (edit) {
      editingId = edit.dataset.hmeEdit;
      render();
      var form = root.querySelector('[data-hme-form]');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (event.target.closest('[data-hme-cancel]')) {
      editingId = '';
      render();
      return;
    }
    if (event.target.closest('[data-hme-refresh]')) {
      loadData();
      return;
    }
    var open = event.target.closest('[data-hme-open-file]');
    if (open) {
      openDocument(open.dataset.hmeOpenFile).catch(showError);
      return;
    }
    var remove = event.target.closest('[data-hme-remove-file]');
    if (remove) removeDocument(remove.dataset.hmeRemoveFile).catch(showError);
  }

  function handleChange(event) {
    if (event.target.matches('[data-hme-filter-type]')) filterType = event.target.value;
    else if (event.target.matches('[data-hme-filter-status]')) filterStatus = event.target.value;
    else if (event.target.matches('[data-hme-upload]')) {
      uploadDocument(event.target).catch(showError).finally(function () {
        if (event.target.isConnected) event.target.value = '';
      });
      return;
    } else return;
    render();
  }

  function handleInput(event) {
    if (!event.target.matches('[data-hme-search]')) return;
    search = event.target.value;
    var position = event.target.selectionStart;
    render();
    var input = root.querySelector('[data-hme-search]');
    if (input) {
      input.focus();
      input.setSelectionRange(position, position);
    }
  }

  function handleSubmit(event) {
    var form = event.target.closest('[data-hme-form]');
    if (!form) return;
    event.preventDefault();
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    saveExam(form).catch(showError).finally(function () {
      if (button && button.isConnected) button.disabled = false;
    });
  }

  function showError(error) {
    console.error('Falha no painel de agendamento de exames:', error);
    toast(error && error.message ? error.message : 'Não foi possível concluir a operação.');
  }

  window.RildonXHRMedicalExams = { mount: mount };
})();
