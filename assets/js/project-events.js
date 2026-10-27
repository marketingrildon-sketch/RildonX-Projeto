(function () {
  'use strict';

  var overlay;
  var trigger;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }

  function notify(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  function projectOptions() {
    var projects = window.RildonXStore ? window.RildonXStore.getState().projects || [] : [];
    return projects.filter(function (project) { return project && project.isDemo !== true; });
  }

  function renderProjectOptions() {
    if (!overlay) return;
    var select = overlay.querySelector('[name="projectId"]');
    var projects = projectOptions();
    select.innerHTML = '<option value="">Selecione um projeto</option>' + projects.map(function (project) {
      return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</option>';
    }).join('');
    var submit = overlay.querySelector('[type="submit"]');
    submit.disabled = !projects.length;
    overlay.querySelector('.project-event-empty').hidden = projects.length > 0;
  }

  function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function openDialog() {
    if (!overlay) createDialog();
    renderProjectOptions();
    overlay.hidden = false;
    var start = overlay.querySelector('[name="startDate"]');
    if (start && !start.value) start.value = localDateKey(new Date());
    var title = overlay.querySelector('[name="title"]');
    if (title) title.focus();
  }

  function closeDialog() {
    if (overlay) overlay.hidden = true;
  }

  function createDialog() {
    overlay = document.createElement('div');
    overlay.className = 'project-event-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '<section class="project-event-panel" role="dialog" aria-modal="true" aria-labelledby="project-event-title">' +
      '<header><div><span>Calendário RildonX</span><h2 id="project-event-title">Novo evento de projeto</h2></div>' +
      '<button type="button" data-close-project-event aria-label="Fechar">×</button></header>' +
      '<p class="project-event-empty" hidden>Cadastre ou sincronize um projeto antes de criar eventos vinculados.</p>' +
      '<form><label>Projeto<select name="projectId" required></select></label>' +
      '<label>Título<input name="title" required maxlength="150" placeholder="Ex.: Revisão da campanha"></label>' +
      '<div class="project-event-date-row"><label>Data<input name="startDate" type="date" required></label>' +
      '<label>Início<input name="startTime" type="time" value="09:00" required></label>' +
      '<label>Fim<input name="endTime" type="time" value="10:00" required></label></div>' +
      '<label>Local<input name="location" maxlength="180" placeholder="Opcional"></label>' +
      '<label>Descrição<textarea name="description" rows="3" maxlength="2000" placeholder="Detalhes do evento"></textarea></label>' +
      '<footer><button type="button" class="btn secondary" data-close-project-event>Cancelar</button>' +
      '<button type="submit" class="btn">Criar evento</button></footer></form></section>';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.closest('[data-close-project-event]')) closeDialog();
    });
    overlay.querySelector('form').addEventListener('submit', saveProjectEvent);
    document.body.appendChild(overlay);
  }

  async function saveProjectEvent(event) {
    event.preventDefault();
    var form = event.target;
    var submit = form.querySelector('[type="submit"]');
    var client = window.supabaseClient;
    if (!client || !client.from || !window.RildonXStore) {
      notify('O Calendário RildonX precisa estar conectado para salvar eventos de projeto.');
      return;
    }
    var start = new Date(form.elements.startDate.value + 'T' + form.elements.startTime.value);
    var end = new Date(form.elements.startDate.value + 'T' + form.elements.endTime.value);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      notify('O horário de término precisa ser posterior ao início.');
      return;
    }
    submit.disabled = true;
    try {
      var auth = await client.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data || !auth.data.user) throw new Error('Entre novamente para criar eventos.');
      var payload = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        category: 'projeto',
        location: form.elements.location.value.trim(),
        visibility: 'team',
        owner_id: null,
        all_day: false,
        all_day_start_date: null,
        all_day_end_date: null,
        project_id: form.elements.projectId.value,
        created_by: auth.data.user.id
      };
      var result = await client.from('events').insert(payload).select('*').single();
      if (result.error) throw result.error;
      var row = result.data;
      var state = window.RildonXStore.getState();
      var saved = {
        id: row.id,
        title: row.title,
        description: row.description || '',
        category: row.category || 'projeto',
        startsAt: row.starts_at,
        endsAt: row.ends_at || null,
        location: row.location || '',
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        visibility: row.visibility || 'team',
        ownerId: row.owner_id || null,
        allDay: Boolean(row.all_day),
        allDayStartDate: row.all_day_start_date || null,
        allDayEndDate: row.all_day_end_date || null,
        deletedAt: row.deleted_at || null,
        projectId: row.project_id || null
      };
      window.RildonXStore.setState({
        events: [saved].concat((state.events || []).filter(function (item) { return String(item.id) !== String(saved.id); }))
      });
      form.reset();
      closeDialog();
      notify('Evento de projeto criado e adicionado ao Calendário RildonX.');
    } catch (error) {
      console.error('Não foi possível criar o evento do projeto:', error);
      notify(error.message || 'Não foi possível criar o evento. Verifique a conexão e tente novamente.');
    } finally {
      submit.disabled = false;
    }
  }

  function init() {
    if (document.body.dataset.page !== 'projetos') return;
    trigger = document.getElementById('project-new-event');
    if (!trigger) return;
    trigger.addEventListener('click', openDialog);
    if (window.RildonXStore && window.RildonXStore.subscribe) {
      window.RildonXStore.subscribe(renderProjectOptions);
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
