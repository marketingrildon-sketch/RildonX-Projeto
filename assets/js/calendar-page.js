(function () {
  'use strict';

  var state = {
    view: 'month',
    selectedDate: startOfDay(new Date()),
    miniMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    hiddenCategories: new Set(),
    events: [],
    connections: [],
    syncing: false
  };

  var categoryOptions = [
    { id: 'reuniao', label: 'Reunião', color: 'var(--blue-600)' },
    { id: 'projeto', label: 'Projeto', color: 'var(--purple)' },
    { id: 'acao_comercial', label: 'Ação comercial', color: 'var(--green)' },
    { id: 'feriado', label: 'Feriado/data comemorativa', color: 'var(--orange)' },
    { id: 'conteudo', label: 'Conteúdo', color: 'var(--blue-600)' },
    { id: 'aniversario', label: 'Aniversário', color: 'var(--orange)' },
    { id: 'treinamento', label: 'Treinamento', color: 'var(--purple)' },
    { id: 'exame', label: 'Compromisso de RH', color: 'var(--purple)' },
    { id: 'auditoria', label: 'Auditoria', color: 'var(--pink)' },
    { id: 'documento', label: 'Revisão de documento', color: 'var(--green)' }
  ];
  var monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  var fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function dateFromKey(value) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function parseEventDate(value) {
    var date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventStartDate(event) {
    return event.allDay && event.allDayStartDate
      ? dateFromKey(event.allDayStartDate)
      : parseEventDate(event.startsAt);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }

  function capitalize(value) {
    return value ? value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1) : '';
  }

  function getVisibleEvents() {
    return state.events.filter(function (event) {
      return !event.deletedAt && !state.hiddenCategories.has(event.category || 'reuniao') &&
        parseEventDate(event.startsAt);
    }).slice().sort(function (first, second) {
      return new Date(first.startsAt) - new Date(second.startsAt);
    });
  }

  function getEventsOn(date) {
    var dayStart = startOfDay(date);
    var nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    return getVisibleEvents().filter(function (event) {
      if (event.allDay && event.allDayStartDate) {
        var key = dateKey(date);
        return key >= event.allDayStartDate && key < (event.allDayEndDate || event.allDayStartDate);
      }
      var start = parseEventDate(event.startsAt);
      var end = parseEventDate(event.endsAt);
      if (!start) return false;
      if (!end) return start >= dayStart && start < nextDay;
      return start < nextDay && end > dayStart;
    });
  }

  function eventTime(event) {
    if (event.allDay) return 'Dia inteiro';
    var start = parseEventDate(event.startsAt);
    var end = parseEventDate(event.endsAt);
    if (!start) return '';
    var time = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (end) time += ' – ' + end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return time;
  }

  function getCategoryClass(event) {
    return 'c-' + String(event.category || 'reuniao').replace(/[^a-z0-9_-]/gi, '-');
  }

  function getCategoryLabel(category) {
    var option = categoryOptions.find(function (item) { return item.id === category; });
    return option ? option.label : 'Evento';
  }

  function renderEventChip(event) {
    return '<button type="button" class="cal-chip ' + getCategoryClass(event) +
      '" data-calendar-event="' + escapeHtml(event.id) + '" aria-label="' +
      escapeHtml(event.title || 'Evento') + ', ' + escapeHtml(eventTime(event)) + '">' +
      '<span class="calendar-event-mark" aria-hidden="true"></span><span class="cal-chip-text"><b>' +
      escapeHtml(event.title || 'Evento') + '</b><span>' +
      escapeHtml(eventTime(event) || 'Dia inteiro') + '</span></span></button>';
  }

  function renderCalendarMonth() {
    var root = document.getElementById('calendar-main-view');
    var weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    var monthStart = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
    var gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    var daysInMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth() + 1, 0).getDate();
    var cellCount = Math.ceil((monthStart.getDay() + daysInMonth) / 7) * 7;
    var todayKey = dateKey(new Date());
    var selectedKey = dateKey(state.selectedDate);
    var cells = [];

    for (var offset = 0; offset < cellCount; offset += 1) {
      var date = new Date(gridStart);
      date.setDate(gridStart.getDate() + offset);
      var events = getEventsOn(date);
      var classes = ['cal-day'];
      if (date.getMonth() !== state.selectedDate.getMonth()) classes.push('muted');
      if (dateKey(date) === todayKey) classes.push('today');
      if (dateKey(date) === selectedKey) classes.push('selected');
      cells.push('<div class="' + classes.join(' ') + '" data-calendar-date="' + dateKey(date) +
        '" aria-label="' + escapeHtml(fullDateFormatter.format(date)) + ', ' + events.length + ' eventos">' +
        '<button type="button" class="daynum" data-calendar-date="' + dateKey(date) + '">' +
        date.getDate() + '</button>' +
        events.slice(0, 2).map(renderEventChip).join('') +
        (events.length > 2 ? '<span class="cal-more">+' + (events.length - 2) + ' mais</span>' : '') +
        '</div>');
    }

    root.innerHTML = '<div class="cal-dow-row">' + weekdays.map(function (day) {
      return '<span>' + day + '</span>';
    }).join('') + '</div><div class="cal-weeks">' + cells.join('') + '</div>';
  }

  function renderWeekView() {
    var root = document.getElementById('calendar-main-view');
    var weekStart = startOfDay(state.selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var days = [];
    var weeklyEvents = [];
    for (var index = 0; index < 7; index += 1) {
      var date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      var events = getEventsOn(date);
      weeklyEvents = weeklyEvents.concat(events);
      days.push('<section class="calendar-week-day' +
        (dateKey(date) === dateKey(state.selectedDate) ? ' selected' : '') + '" data-calendar-date="' +
        dateKey(date) + '"><button type="button" class="calendar-week-day-head" data-calendar-date="' +
        dateKey(date) + '"><span>' + ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][index] +
        '</span><b>' + date.getDate() + '</b></button><div class="calendar-week-day-events">' +
        (events.map(renderEventChip).join('') || '<span class="calendar-no-events">Sem eventos</span>') +
        '</div></section>');
    }
    root.innerHTML = '<div class="calendar-week-grid">' + days.join('') + '</div>' +
      '<section class="calendar-week-summary"><h3>Resumo da semana</h3><p>' +
      weeklyEvents.length + (weeklyEvents.length === 1 ? ' evento' : ' eventos') +
      ' entre ' + escapeHtml(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(weekStart)) +
      ' e ' + escapeHtml(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))) +
      '</p>' + renderDetailedEventList(Array.from(new Map(weeklyEvents.map(function (event) {
        return [String(event.id), event];
      })).values())) + '</section>';
  }

  function renderDetailedEventList(events) {
    if (!events.length) return '<p class="calendar-empty">Nenhum evento neste período.</p>';
    return '<div class="calendar-event-list">' + events.map(function (event) {
      var date = eventStartDate(event);
      return '<article class="calendar-event-card ' + getCategoryClass(event) + '">' +
        '<span class="calendar-event-mark" aria-hidden="true"></span><div class="calendar-event-card-content">' +
        '<small>' + escapeHtml(capitalize(fullDateFormatter.format(date))) + ' · ' +
        escapeHtml(eventTime(event) || 'Dia inteiro') + '</small><h4>' +
        escapeHtml(event.title || 'Evento') + '</h4><p>' +
        escapeHtml(event.description || 'Sem descrição.') + '</p>' +
        '<div class="calendar-event-meta"><span>' + escapeHtml(getCategoryLabel(event.category)) + '</span>' +
        (event.visibility === 'private' ? '<span>Pessoal</span>' : '') +
        (event.location ? '<span>' + escapeHtml(event.location) + '</span>' : '') +
        '</div></div><div class="calendar-event-card-actions"><button type="button" data-calendar-event="' +
        escapeHtml(event.id) + '">Detalhes</button></div></article>';
    }).join('') + '</div>';
  }

  function renderDayView() {
    var root = document.getElementById('calendar-main-view');
    var events = getEventsOn(state.selectedDate);
    root.innerHTML = '<section class="calendar-day-view"><header><div><span>Agenda do dia</span><h3>' +
      escapeHtml(capitalize(fullDateFormatter.format(state.selectedDate))) +
      '</h3></div><button type="button" class="btn calendar-primary-action" data-calendar-create>+ Novo evento</button></header>' +
      renderDetailedEventList(events) + '</section>';
  }

  function renderAgendaView() {
    var root = document.getElementById('calendar-main-view');
    var year = state.selectedDate.getFullYear();
    var month = state.selectedDate.getMonth();
    var dayGroups = new Map();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var day = 1; day <= daysInMonth; day += 1) {
      var date = new Date(year, month, day);
      var events = getEventsOn(date);
      if (events.length) dayGroups.set(dateKey(date), { date: date, events: events });
    }
    var groups = Array.from(dayGroups.values()).sort(function (first, second) {
      return first.date - second.date;
    });
    root.innerHTML = '<section class="calendar-agenda-view"><header><div><span>Eventos do mês</span><h3>' +
      escapeHtml(capitalize(monthFormatter.format(state.selectedDate))) + '</h3></div>' +
      '<button type="button" class="btn calendar-primary-action" data-calendar-create>+ Criar novo evento</button></header>' +
      (groups.length ? groups.map(function (group) {
        return '<section class="calendar-agenda-day"><h4>' +
          escapeHtml(capitalize(fullDateFormatter.format(group.date))) + '</h4>' +
          renderDetailedEventList(group.events) + '</section>';
      }).join('') : '<p class="calendar-empty">Nenhum evento neste mês. Crie um evento para começar.</p>') +
      '</section>';
  }

  function renderMiniCalendar() {
    var grid = document.getElementById('calendar-mini-grid');
    var title = document.getElementById('calendar-mini-title');
    if (!grid || !title) return;
    title.textContent = capitalize(monthFormatter.format(state.miniMonth));
    var first = new Date(state.miniMonth.getFullYear(), state.miniMonth.getMonth(), 1);
    var start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    var todayKey = dateKey(new Date());
    var selectedKey = dateKey(state.selectedDate);
    var entries = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (day) {
      return '<span class="dow">' + day + '</span>';
    });
    for (var index = 0; index < 42; index += 1) {
      var date = new Date(start);
      date.setDate(start.getDate() + index);
      var dayEvents = getEventsOn(date);
      var classes = ['day'];
      if (date.getMonth() !== state.miniMonth.getMonth()) classes.push('muted');
      if (dateKey(date) === todayKey) classes.push('today');
      if (dateKey(date) === selectedKey) classes.push('selected');
      entries.push('<button type="button" class="' + classes.join(' ') + '" data-calendar-date="' +
        dateKey(date) + '" aria-label="' + escapeHtml(fullDateFormatter.format(date)) +
        (dayEvents.length ? ', ' + dayEvents.length + ' eventos' : '') + '">' +
        date.getDate() + (dayEvents.length ? '<i aria-hidden="true"></i>' : '') + '</button>');
    }
    grid.innerHTML = entries.join('');
  }

  function renderCategoryToggles() {
    var root = document.getElementById('calendar-category-list');
    if (!root) return;
    root.innerHTML = categoryOptions.map(function (category) {
      var checked = !state.hiddenCategories.has(category.id);
      return '<label class="cal-toggle-row"><input type="checkbox" style="accent-color:' + category.color +
        ';" data-calendar-category="' +
        category.id + '"' + (checked ? ' checked' : '') + '><span class="dot" style="background:' +
        category.color + ';"></span><span class="name">' + escapeHtml(category.label) + '</span></label>';
    }).join('');
  }

  function render() {
    var periodTitle = document.getElementById('calendar-period-title');
    var mainView = document.getElementById('calendar-main-view');
    if (mainView) mainView.dataset.calendarView = state.view;
    if (periodTitle) {
      if (state.view === 'day') periodTitle.textContent = capitalize(fullDateFormatter.format(state.selectedDate));
      else if (state.view === 'week') {
        var weekStart = startOfDay(state.selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        var weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        periodTitle.textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(weekStart) +
          ' – ' + new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(weekEnd);
      } else periodTitle.textContent = capitalize(monthFormatter.format(state.selectedDate));
    }
    document.querySelectorAll('[data-calendar-view]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.calendarView === state.view);
      button.setAttribute('aria-pressed', String(button.dataset.calendarView === state.view));
    });
    if (state.view === 'month') renderCalendarMonth();
    else if (state.view === 'week') renderWeekView();
    else if (state.view === 'day') renderDayView();
    else renderAgendaView();
    renderMiniCalendar();
    renderCategoryToggles();
  }

  function shiftMonth(date, amount) {
    var day = date.getDate();
    var shifted = new Date(date.getFullYear(), date.getMonth() + amount, 1);
    shifted.setDate(Math.min(day, new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()));
    return shifted;
  }

  function formatDateTimeInput(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0') + 'T' + String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function nextDateKey(value) {
    var date = dateFromKey(value);
    if (!date) return '';
    date.setDate(date.getDate() + 1);
    return dateKey(date);
  }

  function configureAllDayInputs(enabled) {
    var form = document.getElementById('calendar-event-form');
    var startInput = form.elements.startsAt;
    var endInput = form.elements.endsAt;
    var startValue = startInput.value;
    var endValue = endInput.value;
    var startDate = startValue.slice(0, 10);
    var endDate = endValue.slice(0, 10);
    startInput.type = enabled ? 'date' : 'datetime-local';
    endInput.type = enabled ? 'date' : 'datetime-local';
    if (enabled) {
      startInput.value = startDate;
      endInput.value = endDate && endDate > startDate ? endDate : nextDateKey(startDate);
    } else {
      startInput.value = startDate ? startDate + 'T09:00' : '';
      endInput.value = endDate ? endDate + 'T10:00' : '';
    }
    form.querySelector('label[for="calendar-event-start"]').textContent =
      enabled ? 'Data de início' : 'Data e hora de início';
    form.querySelector('label[for="calendar-event-end"]').textContent =
      enabled ? 'Data final (exclusiva)' : 'Data e hora de término';
  }

  function setDialogMode(mode, event) {
    var dialog = document.getElementById('calendar-event-dialog');
    var form = document.getElementById('calendar-event-form');
    var details = document.getElementById('calendar-event-details');
    var title = document.getElementById('calendar-event-dialog-title');
    var submit = document.getElementById('calendar-event-submit');
    if (!dialog || !form || !details || !title || !submit) return;
    if (mode === 'view' && event) {
      form.hidden = true;
      details.hidden = false;
      title.textContent = event.title || 'Evento';
      var date = eventStartDate(event);
      details.innerHTML = '<p><b>Data:</b> ' + escapeHtml(capitalize(fullDateFormatter.format(date))) +
        '</p><p><b>Horário:</b> ' + escapeHtml(eventTime(event) || 'Dia inteiro') +
        '</p><p><b>Categoria:</b> ' + escapeHtml(getCategoryLabel(event.category)) +
        '</p><p><b>Visibilidade:</b> ' + (event.visibility === 'private' ? 'Pessoal' : 'Equipe') +
        '</p><p><b>Local:</b> ' + escapeHtml(event.location || 'Não informado') +
        '</p><p><b>Descrição:</b><br>' + escapeHtml(event.description || 'Sem descrição.') +
        '</p><div class="modal-foot"><button type="button" class="btn secondary" data-calendar-dialog-close>Fechar</button>' +
        '<button type="button" class="btn secondary" data-calendar-event-edit="' + escapeHtml(event.id) + '">Editar</button>' +
        '<button type="button" class="btn calendar-event-delete" data-calendar-event-delete="' +
        escapeHtml(event.id) + '">Excluir</button></div>';
    } else {
      form.hidden = false;
      details.hidden = true;
      form.reset();
      configureAllDayInputs(false);
      var selected = state.selectedDate;
      var start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 9, 0);
      var end = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 10, 0);
      form.elements.startsAt.value = formatDateTimeInput(start);
      form.elements.endsAt.value = formatDateTimeInput(end);
      form.elements.id.value = event ? event.id : '';
      if (event) {
        form.elements.title.value = event.title || '';
        form.elements.allDay.checked = Boolean(event.allDay);
        if (event.allDay) {
          configureAllDayInputs(true);
          form.elements.startsAt.value = event.allDayStartDate || '';
          form.elements.endsAt.value = event.allDayEndDate || '';
        } else {
          var eventStart = parseEventDate(event.startsAt);
          var eventEnd = parseEventDate(event.endsAt);
          form.elements.startsAt.value = eventStart ? formatDateTimeInput(eventStart) : '';
          form.elements.endsAt.value = eventEnd ? formatDateTimeInput(eventEnd) : '';
        }
        form.elements.category.value = event.category || 'reuniao';
        form.elements.location.value = event.location || '';
        form.elements.description.value = event.description || '';
        form.elements.visibility.value = event.visibility || 'team';
      }
      title.textContent = event ? 'Editar evento' : 'Novo evento';
      submit.textContent = event ? 'Salvar alterações' : 'Criar evento';
    }
    if (!dialog.open) dialog.showModal();
  }

  function openEventDialog(eventId) {
    var event = state.events.find(function (item) { return String(item.id) === String(eventId); });
    if (event) setDialogMode('view', event);
  }

  function createCalendarExport() {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RildonX//Calendario//PT-BR', 'CALSCALE:GREGORIAN'];
    getVisibleEvents().forEach(function (event) {
      var start = eventStartDate(event);
      if (!start) return;
      var end = parseEventDate(event.endsAt) || new Date(start.getTime() + 60 * 60 * 1000);
      function formatUtc(date) {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      }
      function escapeIcs(value) {
        return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
          .replace(/,/g, '\\,').replace(/;/g, '\\;');
      }
      var startValue = event.allDay
        ? 'DTSTART;VALUE=DATE:' + event.allDayStartDate.replace(/-/g, '')
        : 'DTSTART:' + formatUtc(start);
      var endValue = event.allDay
        ? 'DTEND;VALUE=DATE:' + event.allDayEndDate.replace(/-/g, '')
        : 'DTEND:' + formatUtc(end);
      lines.push('BEGIN:VEVENT', 'UID:' + escapeIcs(event.id) + '@rildonx',
        'DTSTAMP:' + formatUtc(new Date()), startValue, endValue,
        'SUMMARY:' + escapeIcs(event.title), 'DESCRIPTION:' + escapeIcs(event.description),
        'LOCATION:' + escapeIcs(event.location), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'rildonx-calendario.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function showMessage(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  async function invokeCalendarFunction(name, body) {
    if (!window.supabaseClient || !window.supabaseClient.functions) {
      throw new Error('O serviço de calendário externo não está disponível. Verifique a configuração do Supabase.');
    }
    var result = await window.supabaseClient.functions.invoke(name, { body: body });
    if (result.error) {
      var error = result.error;
      var response = error.context instanceof Response ? error.context : null;
      if (response && response.status === 404) {
        throw new Error('A função ' + name + ' não foi encontrada no Supabase. Publique as Edge Functions do calendário.');
      }
      if (response && response.status === 401) {
        throw new Error('Sua sessão do Supabase expirou. Entre novamente e tente conectar o Google Calendar.');
      }
      if (error.name === 'FunctionsFetchError') {
        throw new Error('Não foi possível alcançar a função ' + name + '. Confirme que ela foi publicada e que CALENDAR_APP_URL no Supabase corresponde exatamente à origem desta página (CORS).');
      }
      if (response && response.status >= 500) {
        throw new Error('A função ' + name + ' falhou no servidor. Confira os segredos do Supabase e os logs da Edge Function.');
      }
      throw error;
    }
    if (result.data && result.data.error) throw new Error(result.data.error);
    return result.data || {};
  }

  function setConnectionStatus(connections) {
    state.connections = connections || [];
    var connected = state.connections.some(function (item) { return item.provider === 'google'; });
    document.querySelectorAll('[data-calendar-provider]').forEach(function (button) {
      button.dataset.connected = String(connected);
      button.textContent = connected ? 'Desconectar' : 'Conectar';
      button.setAttribute('aria-label', (connected ? 'Desconectar de ' : 'Conectar ao ') + 'Google Calendar');
    });
    var status = document.getElementById('calendar-connection-status');
    if (status) {
      status.textContent = connected ? 'Google Calendar conectado.' : 'Google Calendar não conectado.';
    }
  }

  async function refreshCalendarConnections() {
    var result = await invokeCalendarFunction('calendar-sync', { action: 'status' });
    setConnectionStatus(result.connections || []);
    return result.connections || [];
  }

  function mapCalendarEventRow(row) {
    return {
      id: row.id,
      title: row.title || 'Evento',
      description: row.description || '',
      startsAt: row.starts_at,
      endsAt: row.ends_at || null,
      category: row.category || 'reuniao',
      location: row.location || '',
      visibility: row.visibility || 'team',
      ownerId: row.owner_id || null,
      allDay: Boolean(row.all_day),
      allDayStartDate: row.all_day_start_date || null,
      allDayEndDate: row.all_day_end_date || null,
      deletedAt: row.deleted_at || null,
      createdBy: row.created_by || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectId: row.project_id || null
    };
  }

  async function reloadCalendarEvents() {
    var result = await window.supabaseClient.from('events').select('*')
      .order('starts_at', { ascending: true }).limit(1000);
    if (result.error) throw result.error;
    var events = (result.data || []).map(mapCalendarEventRow);
    state.events = events;
    window.RildonXStore.setState({ events: events });
  }

  async function syncExternalCalendars(button, quiet) {
    if (state.syncing) return;
    state.syncing = true;
    if (button) button.disabled = true;
    try {
      var result = await invokeCalendarFunction('calendar-sync', { action: 'sync' });
      await reloadCalendarEvents();
      var outcomes = result.results || [];
      var errors = outcomes.filter(function (item) { return item.error; });
      var totals = outcomes.filter(function (item) { return !item.error; }).reduce(function (summary, item) {
        summary.created += item.created || 0;
        summary.updated += item.updated || 0;
        summary.deleted += item.deleted || 0;
        return summary;
      }, { created: 0, updated: 0, deleted: 0 });
      await refreshCalendarConnections();
      if (errors.length) {
        var errorMessage = 'Sincronização parcial. ' + errors.map(function (item) {
          return 'Google Calendar: ' + item.error;
        }).join(' ');
        if (quiet) {
          console.error(errorMessage);
          var status = document.getElementById('calendar-connection-status');
          if (status) status.textContent += ' Última sincronização com erro.';
        } else showMessage(errorMessage);
      } else if (!outcomes.length) {
        if (!quiet) showMessage('Conecte o Google Calendar antes de sincronizar.');
      } else if (!quiet) {
        showMessage('Calendários sincronizados: ' + totals.created + ' criados, ' +
          totals.updated + ' atualizados e ' + totals.deleted + ' removidos.');
      }
    } catch (error) {
      console.error('Não foi possível sincronizar os calendários externos:', error);
      if (quiet) {
        var status = document.getElementById('calendar-connection-status');
        if (status) status.textContent += ' Não foi possível concluir a última sincronização.';
      } else showMessage(error.message || 'Não foi possível sincronizar os calendários externos.');
    } finally {
      state.syncing = false;
      if (button) button.disabled = false;
    }
  }

  async function handleProviderButton(button) {
    var provider = button.dataset.calendarProvider;
    var providerName = 'Google Calendar';
    button.disabled = true;
    try {
      if (button.dataset.connected === 'true') {
        if (!window.confirm('Desconectar ' + providerName + '? Os eventos já sincronizados permanecerão no RildonX.')) return;
        await invokeCalendarFunction('calendar-sync', { action: 'disconnect', provider: provider });
        await refreshCalendarConnections();
        showMessage(providerName + ' desconectado.');
        return;
      }
      var result = await invokeCalendarFunction('calendar-connect', { provider: provider });
      if (!result.authorizationUrl) throw new Error('O serviço não retornou o endereço de autorização.');
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      console.error('Não foi possível conectar o calendário externo:', error);
      showMessage(error.message || 'Não foi possível iniciar a conexão do calendário.');
    } finally {
      button.disabled = false;
    }
  }

  async function handleCalendarReturn() {
    var params = new URLSearchParams(window.location.search);
    var result = params.get('calendar_sync');
    if (!result) return;
    var provider = params.get('provider');
    var reason = params.get('reason');
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    if (result === 'connected') {
      showMessage('Google Calendar conectado. Sincronizando eventos...');
      await syncExternalCalendars(null);
      return;
    }
    var messages = {
      authorization_denied: 'A autorização do calendário foi cancelada.',
      expired_state: 'A solicitação de autorização expirou. Tente conectar novamente.',
      invalid_callback: 'A resposta do provedor de calendário é inválida.',
      unsupported_provider: 'Este provedor de calendário não é mais compatível.',
      refresh_token_missing: 'O provedor não retornou acesso duradouro. Revogue a permissão antiga e conecte novamente.',
      token_exchange: 'Não foi possível validar a autorização do calendário.',
      server_error: 'O servidor não conseguiu concluir a conexão do calendário.'
    };
    showMessage(messages[reason] || 'Não foi possível conectar o calendário externo.');
  }

  function bindControls() {
    document.querySelectorAll('[data-calendar-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.view = button.dataset.calendarView;
        render();
      });
    });
    document.getElementById('calendar-today-btn').addEventListener('click', function () {
      state.selectedDate = startOfDay(new Date());
      state.miniMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
      render();
    });
    document.getElementById('calendar-prev-btn').addEventListener('click', function () {
      if (state.view === 'week') state.selectedDate.setDate(state.selectedDate.getDate() - 7);
      else if (state.view === 'day') state.selectedDate.setDate(state.selectedDate.getDate() - 1);
      else state.selectedDate = shiftMonth(state.selectedDate, -1);
      state.miniMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
      render();
    });
    document.getElementById('calendar-next-btn').addEventListener('click', function () {
      if (state.view === 'week') state.selectedDate.setDate(state.selectedDate.getDate() + 7);
      else if (state.view === 'day') state.selectedDate.setDate(state.selectedDate.getDate() + 1);
      else state.selectedDate = shiftMonth(state.selectedDate, 1);
      state.miniMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
      render();
    });
    document.getElementById('calendar-mini-prev').addEventListener('click', function () {
      state.miniMonth = shiftMonth(state.miniMonth, -1);
      renderMiniCalendar();
    });
    document.getElementById('calendar-mini-next').addEventListener('click', function () {
      state.miniMonth = shiftMonth(state.miniMonth, 1);
      renderMiniCalendar();
    });
    document.getElementById('calendar-new-event-btn').addEventListener('click', function () {
      setDialogMode('edit');
      document.getElementById('calendar-event-title').focus();
    });
    document.getElementById('calendar-add-event-btn').addEventListener('click', function () {
      setDialogMode('edit');
    });
    document.getElementById('calendar-export-btn').addEventListener('click', createCalendarExport);
    document.getElementById('calendar-sync-btn').addEventListener('click', function (event) {
      syncExternalCalendars(event.currentTarget);
    });

    document.getElementById('calendar-mini-grid').addEventListener('click', selectCalendarDate);
    document.getElementById('calendar-main-view').addEventListener('click', function (event) {
      var createButton = event.target.closest('[data-calendar-create]');
      if (createButton) {
        setDialogMode('edit');
        return;
      }
      var eventButton = event.target.closest('[data-calendar-event]');
      if (eventButton) {
        openEventDialog(eventButton.dataset.calendarEvent);
        return;
      }
      selectCalendarDate(event);
    });
    document.getElementById('calendar-category-list').addEventListener('change', function (event) {
      var checkbox = event.target.closest('[data-calendar-category]');
      if (!checkbox) return;
      if (checkbox.checked) state.hiddenCategories.delete(checkbox.dataset.calendarCategory);
      else state.hiddenCategories.add(checkbox.dataset.calendarCategory);
      render();
    });

    var dialog = document.getElementById('calendar-event-dialog');
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
      var closeButton = event.target.closest('[data-calendar-dialog-close]');
      if (closeButton) dialog.close();
      var editButton = event.target.closest('[data-calendar-event-edit]');
      if (editButton) {
        var item = state.events.find(function (entry) { return String(entry.id) === editButton.dataset.calendarEventEdit; });
        if (item) setDialogMode('edit', item);
      }
      var deleteButton = event.target.closest('[data-calendar-event-delete]');
      if (deleteButton) deleteEvent(deleteButton.dataset.calendarEventDelete);
    });
    document.getElementById('calendar-event-form').addEventListener('submit', saveEvent);
    document.getElementById('calendar-event-all-day').addEventListener('change', function (event) {
      configureAllDayInputs(event.currentTarget.checked);
    });

    document.querySelectorAll('[data-calendar-provider]').forEach(function (button) {
      button.addEventListener('click', function () {
        handleProviderButton(button);
      });
    });
  }

  function selectCalendarDate(event) {
    var dayButton = event.target.closest('[data-calendar-date]');
    if (!dayButton) return;
    var parts = dayButton.dataset.calendarDate.split('-').map(Number);
    state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    state.miniMonth = new Date(parts[0], parts[1] - 1, 1);
    render();
  }

  async function saveEvent(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var submit = document.getElementById('calendar-event-submit');
    var allDay = form.elements.allDay.checked;
    var allDayStartDate = allDay ? form.elements.startsAt.value : null;
    var allDayEndDate = allDay ? (form.elements.endsAt.value || nextDateKey(allDayStartDate)) : null;
    var start = allDay
      ? dateFromKey(allDayStartDate)
      : new Date(form.elements.startsAt.value);
    var end = allDay
      ? dateFromKey(allDayEndDate)
      : (form.elements.endsAt.value ? new Date(form.elements.endsAt.value) : null);
    if (allDay && start && end) {
      start.setHours(12, 0, 0, 0);
      end.setHours(12, 0, 0, 0);
    }
    if (!form.elements.title.value.trim() || !start || Number.isNaN(start.getTime()) ||
        (end && Number.isNaN(end.getTime()))) {
      showMessage('Preencha o nome, a data e o horário do evento.');
      return;
    }
    if ((allDay && allDayEndDate <= allDayStartDate) || (end && end <= start)) {
      showMessage('O término do evento deve ocorrer depois do início.');
      return;
    }
    if (!window.supabaseClient || !window.RildonXStore) {
      showMessage('O serviço de calendário não está disponível. Recarregue a página e tente novamente.');
      return;
    }
    submit.disabled = true;
    try {
      var auth = await window.supabaseClient.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data || !auth.data.user) throw new Error('Entre novamente para salvar eventos.');
      var id = form.elements.id.value;
      var payload = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        category: form.elements.category.value,
        location: form.elements.location.value.trim(),
        visibility: form.elements.visibility.value,
        owner_id: form.elements.visibility.value === 'private' ? auth.data.user.id : null,
        all_day: allDay,
        all_day_start_date: allDayStartDate,
        all_day_end_date: allDayEndDate
      };
      if (form.elements.project_id) payload.project_id = form.elements.project_id.value || null;
      var result;
      if (id) {
        result = await window.supabaseClient.from('events').update(payload).eq('id', id).select('*').single();
      } else {
        payload.created_by = auth.data.user.id;
        result = await window.supabaseClient.from('events').insert(payload).select('*').single();
      }
      if (result.error) throw result.error;
      var row = result.data;
      var saved = {
        id: row.id,
        title: row.title,
        description: row.description || '',
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        allDayStartDate: row.all_day_start_date || null,
        allDayEndDate: row.all_day_end_date || null,
        category: row.category || 'reuniao',
        location: row.location || '',
        visibility: row.visibility || 'team',
        ownerId: row.owner_id || null,
        allDay: Boolean(row.all_day),
        deletedAt: row.deleted_at || null,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        projectId: row.project_id || null
      };
      var events = window.RildonXStore.getState().events || [];
      window.RildonXStore.setState({
        events: [saved].concat(events.filter(function (item) { return String(item.id) !== String(saved.id); }))
      });
      state.selectedDate = startOfDay(allDay ? dateFromKey(allDayStartDate) : start);
      state.miniMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
      document.getElementById('calendar-event-dialog').close();
      render();
      showMessage(id ? 'Evento atualizado.' : 'Evento criado.');
      if (state.connections.length) syncExternalCalendars(null, true);
    } catch (error) {
      console.error('Não foi possível salvar o evento do calendário:', error);
      showMessage(error.message || 'Não foi possível salvar o evento. Tente novamente.');
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteEvent(eventId) {
    var event = state.events.find(function (item) { return String(item.id) === String(eventId); });
    if (!event || !window.confirm('Excluir o evento "' + (event.title || 'Evento') + '"?')) return;
    try {
      var result = await window.supabaseClient.from('events').update({
        deleted_at: new Date().toISOString()
      }).eq('id', eventId).select('*').single();
      if (result.error) throw result.error;
      var events = (window.RildonXStore.getState().events || []).map(function (item) {
        return String(item.id) === String(eventId)
          ? Object.assign({}, item, { deletedAt: result.data.deleted_at, updatedAt: result.data.updated_at })
          : item;
      });
      window.RildonXStore.setState({ events: events });
      document.getElementById('calendar-event-dialog').close();
      render();
      showMessage('Evento excluído.');
      if (state.connections.length) syncExternalCalendars(null, true);
    } catch (error) {
      console.error('Não foi possível excluir o evento do calendário:', error);
      showMessage(error.message || 'Não foi possível excluir o evento.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.page !== 'calendario') return;
    bindControls();
    if (window.RildonXStore) {
      state.events = window.RildonXStore.getState().events || [];
      window.RildonXStore.subscribe(function (nextState) {
        state.events = nextState.events || [];
        render();
      });
    }
    render();
    var oauthReturn = new URLSearchParams(window.location.search).has('calendar_sync');
    refreshCalendarConnections().then(function (connections) {
      if (connections.length && !oauthReturn) syncExternalCalendars(null, true);
      if (connections.length) {
        window.setInterval(function () {
          syncExternalCalendars(null, true);
        }, 5 * 60 * 1000);
      }
    }).catch(function (error) {
      console.error('Não foi possível consultar as conexões de calendário:', error);
      var status = document.getElementById('calendar-connection-status');
      if (status) status.textContent = error.message || 'Não foi possível consultar conexões. Publique as Edge Functions do calendário e confira CALENDAR_APP_URL no Supabase.';
    });
    handleCalendarReturn().catch(function (error) {
      console.error('Não foi possível finalizar o retorno OAuth do calendário:', error);
      showMessage(error.message || 'Não foi possível concluir a sincronização.');
    });
  });
})();
