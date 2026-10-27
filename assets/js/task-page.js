(function () {
  'use strict';

  var statuses = [
    { id: 'pendente', label: 'Pendentes' },
    { id: 'em-andamento', label: 'Em andamento' },
    { id: 'concluida', label: 'Concluídas' }
  ];
  var monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  var selectedCalendarDate = new Date();
  var currentUserId = '';
  var currentUserName = 'Usuário';
  var taskRoot;
  var detailOverlay;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }

  function bindCollaboratorPicker() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-toggle-collaborator-picker]');
      if (trigger) {
        var picker = trigger.closest('[data-collaborator-picker]');
        if (!picker) return;
        var popover = picker.querySelector('[data-collaborator-options]');
        var shouldOpen = popover && popover.hidden;
        document.querySelectorAll('[data-collaborator-options]').forEach(function (item) { item.hidden = true; });
        if (popover) popover.hidden = !shouldOpen;
        event.stopPropagation();
        return;
      }
      if (!event.target.closest('[data-collaborator-picker]')) {
        document.querySelectorAll('[data-collaborator-options]').forEach(function (item) { item.hidden = true; });
      }
    });
    document.addEventListener('change', async function (event) {
      if (!event.target.matches('[data-collaborator-name]')) return;
      var picker = event.target.closest('[data-collaborator-picker]');
      if (!picker) return;
      var selectedNames = Array.from(picker.querySelectorAll('[data-collaborator-name]:checked'))
        .map(function (checkbox) { return checkbox.dataset.collaboratorName; });
      var summary = picker.querySelector('[data-collaborator-summary]');
      if (summary) summary.textContent = selectedNames.length ? selectedNames.join(', ') : 'Nenhum colaborador selecionado';
      if (picker.dataset.collaboratorPicker === 'new-task') {
        var select = document.getElementById('nt-colaboradores');
        if (select) Array.from(select.options).forEach(function (option) {
          option.selected = selectedNames.indexOf(option.value) !== -1;
        });
        return;
      }
      var taskId = picker.dataset.collaboratorPicker.replace(/^task-/, '');
      var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === String(taskId); });
      if (!task || !isTaskCreator(task)) return;
      try {
        await syncTaskDocumentViewers(task, selectedNames);
      } catch (error) {
        console.error('Não foi possível compartilhar os arquivos com os colaboradores:', error);
        Array.from(picker.querySelectorAll('[data-collaborator-name]')).forEach(function (checkbox) {
          checkbox.checked = (task.assignees || []).indexOf(checkbox.dataset.collaboratorName) !== -1;
        });
        if (summary) summary.textContent = task.assignees && task.assignees.length
          ? task.assignees.join(', ')
          : 'Nenhum colaborador selecionado';
        notify(error.message || 'Não foi possível compartilhar os arquivos com os colaboradores.');
        return;
      }
      window.RildonXStore.updateTask(task.id, { assignees: selectedNames });
      renderBoard(getStoreState());
    });
  }

  function getStoreState() {
    return window.RildonXStore ? window.RildonXStore.getState() : {};
  }

  function getRealTasks(state) {
    return (state.tasks || []).filter(function (task) { return task && task.isDemo !== true; });
  }

  function getTaskAssigneeNames(task, state) {
    var profiles = state.profiles || [];
    var storedAssignees = Array.isArray(task.assignees) ? task.assignees : [];
    var resolvedAssignees = storedAssignees.map(function (assignee) {
      var value = assignee && typeof assignee === 'object'
        ? assignee.id || assignee.userId || assignee.name || assignee.displayName
        : assignee;
      var profile = profiles.find(function (item) {
        return String(item.id) === String(value) ||
          String(item.displayName || '').toLocaleLowerCase('pt-BR') === String(value || '').toLocaleLowerCase('pt-BR') ||
          String(item.nickname || '').toLocaleLowerCase('pt-BR') === String(value || '').toLocaleLowerCase('pt-BR');
      });
      return profile ? profile.displayName || profile.nickname || String(value) : null;
    });
    if (resolvedAssignees.length && resolvedAssignees.every(Boolean)) {
      return Array.from(new Set(resolvedAssignees));
    }
    var viewerNames = (Array.isArray(task.viewerIds) ? task.viewerIds : [])
      .filter(function (id) { return String(id) !== String(task.createdBy); })
      .map(function (id) {
        var profile = profiles.find(function (item) { return String(item.id) === String(id); });
        return profile && (profile.displayName || profile.nickname);
      })
      .filter(Boolean);
    if (viewerNames.length) return Array.from(new Set(viewerNames));
    return storedAssignees.map(function (assignee) {
      return assignee && typeof assignee === 'object'
        ? assignee.name || assignee.displayName || assignee.nickname || ''
        : String(assignee || '');
    }).filter(Boolean);
  }

  function getPersonalTasks(state) {
    if (window.RildonXIsAdmin) return getRealTasks(state);
    var profile = (state.profiles || []).find(function (item) {
      return currentUserId && String(item.id) === String(currentUserId);
    }) || state.user || {};
    var names = [currentUserName, profile.displayName, profile.nickname, profile.name]
      .filter(Boolean).map(function (name) { return String(name).trim().toLocaleLowerCase('pt-BR'); });
    return getRealTasks(state).filter(function (task) {
      if (task.createdBy && currentUserId && String(task.createdBy) === String(currentUserId)) return true;
      if ((task.viewerIds || []).some(function (viewerId) {
        return String(viewerId) === String(currentUserId);
      })) return true;
      var project = (state.projects || []).find(function (item) {
        return String(item.id) === String(task.projectId || '');
      });
      if (project && canViewProject(project, state)) return true;
      return (task.assignees || []).some(function (assignee) {
        var value = assignee && typeof assignee === 'object'
          ? assignee.id || assignee.userId || assignee.name || assignee.displayName
          : assignee;
        return value && (String(value) === String(currentUserId) ||
          names.indexOf(String(value).trim().toLocaleLowerCase('pt-BR')) !== -1);
      });
    });
  }

  function projectProgress(project, state) {
    var tasks = getRealTasks(state).filter(function (task) {
      return String(task.projectId || '') === String(project.id);
    });
    var completed = tasks.filter(function (task) { return taskStatus(task) === 'concluida'; }).length;
    return {
      progress: tasks.length ? Math.round(completed * 100 / tasks.length) : 0,
      status: tasks.length && completed === tasks.length ? 'Concluído' : completed ? 'Em andamento' : 'Planejamento'
    };
  }

  function canViewProject(project, state) {
    if (!project || project.isDemo || project.archived) return false;
    if (window.RildonXIsAdmin || project.allUsers || String(project.createdBy) === String(currentUserId)) return true;
    var profile = (state.profiles || []).find(function (item) {
      return currentUserId && String(item.id) === String(currentUserId);
    }) || state.user || {};
    var currentNames = [currentUserName, profile.displayName, profile.nickname, profile.name]
      .filter(Boolean).map(function (name) { return String(name).trim().toLocaleLowerCase('pt-BR'); });
    return (project.members || []).some(function (member) {
      var value = member && typeof member === 'object'
        ? member.id || member.userId || member.name || member.displayName
        : member;
      return value && (String(value) === String(currentUserId) ||
        currentNames.indexOf(String(value).trim().toLocaleLowerCase('pt-BR')) !== -1);
    });
  }

  function taskStatus(task) {
    var status = String(task.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (status === 'backlog') return 'pendente';
    if (status === 'concluido' || status === 'concluida' || status === 'complete' || status === 'completed') return 'concluida';
    if (status === 'em andamento' || status === 'em_andamento' || status === 'em-andamento' || status === 'in progress') return 'em-andamento';
    return 'pendente';
  }

  function isTaskCreator(task) {
    return Boolean(window.RildonXIsAdmin ||
      currentUserId && task.createdBy && String(task.createdBy) === String(currentUserId));
  }

  function formatDate(value) {
    if (!value) return 'Sem prazo';
    var date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return 'Sem prazo';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function dateColor(task) {
    var checklist = Array.isArray(task.checklist) ? task.checklist : [];
    if (checklist.length && checklist.every(function (item) { return item && item.completed === true; })) return 'green';
    if (taskStatus(task) === 'concluida') return 'green';
    if (!task.dueDate) return 'neutral';
    var due = new Date(String(task.dueDate).slice(0, 10) + 'T00:00:00');
    if (Number.isNaN(due.getTime())) return 'neutral';
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= 3) return 'red';
    if (daysLeft <= 7) return 'yellow';
    return 'neutral';
  }

  function checklistSummary(task) {
    var checklist = Array.isArray(task.checklist) ? task.checklist : [];
    if (!checklist.length) return '';
    var complete = checklist.filter(function (item) { return item && item.completed === true; }).length;
    return complete + '/' + checklist.length + ' checklist';
  }

  function renderTaskCard(task) {
    var project = (getStoreState().projects || []).find(function (item) { return String(item.id) === String(task.projectId); });
    var assignees = getTaskAssigneeNames(task, getStoreState());
    var title = escapeHtml(task.title || 'Tarefa sem título');
    var canMove = isTaskCreator(task);
    var priority = String(task.priority || 'média');
    var priorityClass = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var status = taskStatus(task);
    return '<article class="task-card task-card--' + dateColor(task) + '" data-task-id="' + escapeHtml(task.id) + '" tabindex="0"' +
      (canMove ? ' draggable="true" aria-label="' + title + ', arrastável"' : ' aria-label="' + title + '"') +
      '><div class="task-card-top"><span class="task-priority task-priority--' + escapeHtml(priorityClass) + '">' + escapeHtml(priority) + '</span>' +
      '<span class="task-due">' + escapeHtml(formatDate(task.dueDate)) + '</span></div>' +
      '<h3>' + title + '</h3>' +
      (task.description ? '<p class="task-card-description">' + escapeHtml(task.description) + '</p>' : '') +
      '<div class="task-card-meta">' +
      (project ? '<span class="task-project-chip">' + escapeHtml(project.name) + '</span>' : '') +
      (checklistSummary(task) ? '<span>' + escapeHtml(checklistSummary(task)) + '</span>' : '') +
      '</div><div class="task-card-footer"><span>' + (assignees.length ? escapeHtml(assignees.join(', ')) : 'Sem colaboradores') + '</span>' +
      (status === 'em-andamento' ? '<span class="task-status-chip">Em andamento</span>' : '') +
      (Array.isArray(task.attachments) && task.attachments.length ? '<span>' + task.attachments.length + ' arquivo(s)</span>' : '') +
      (canMove ? renderCollaboratorPicker(
        (getStoreState().profiles || []).filter(function (profile) {
          return profile.active !== false && String(profile.id) !== String(task.createdBy);
        }),
        assignees,
        'task-' + task.id
      ) : '') +
      '</div></article>';
  }

  function renderBoard(state) {
    var tasks = getRealTasks(state);
    var search = document.getElementById('global-search');
    var searchTerm = search ? search.value.trim().toLocaleLowerCase() : '';
    var projectFilter = document.getElementById('task-project-filter');
    var projectId = projectFilter ? projectFilter.value : '';
    var filtered = tasks.filter(function (task) {
      var matchesSearch = !searchTerm || [task.title, task.description, getTaskAssigneeNames(task, state).join(' ')]
        .join(' ').toLocaleLowerCase().indexOf(searchTerm) !== -1;
      return matchesSearch && (!projectId || String(task.projectId || '') === projectId);
    });
    var board = document.getElementById('task-kanban-board');
    if (!board) return;
    if (projectId) {
      var selectedProject = (state.projects || []).find(function (item) {
        return String(item.id) === String(projectId);
      });
      board.innerHTML = '<div class="task-project-task-group">' +
        '<div class="task-project-task-heading"><h2>' + escapeHtml(selectedProject && selectedProject.name || 'Projeto') + '</h2></div>' +
        '<div class="task-kanban-board">' + renderKanbanColumns(filtered, selectedProject) + '</div></div>';
      return;
    }
    var projects = (state.projects || []).filter(function (project) { return project && project.isDemo !== true; })
      .slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'); });
    var groups = projects.map(function (project) {
      return {
        id: String(project.id),
        name: project.name || 'Projeto',
        tasks: filtered.filter(function (task) { return String(task.projectId || '') === String(project.id); })
      };
    }).filter(function (group) { return group.tasks.length; });
    var unassigned = filtered.filter(function (task) { return !task.projectId; });
    if (unassigned.length) groups.push({ id: '', name: 'Sem projeto', tasks: unassigned });
    var knownProjectIds = projects.map(function (project) { return String(project.id); });
    var unlistedProjectIds = Array.from(new Set(filtered.map(function (task) {
      return String(task.projectId || '');
    }).filter(function (id) { return id && knownProjectIds.indexOf(id) === -1; })));
    unlistedProjectIds.forEach(function (id) {
      groups.push({
        id: id,
        name: 'Projeto indisponível',
        tasks: filtered.filter(function (task) { return String(task.projectId || '') === id; })
      });
    });
    board.innerHTML = groups.length ? groups.map(function (group) {
      return '<section class="task-project-task-group"><div class="task-project-task-heading"><h2>' +
        escapeHtml(group.name) + '</h2><span>' + group.tasks.length + ' tarefas</span></div>' +
        '<div class="task-kanban-board task-kanban-board--all-projects">' + renderKanbanColumns(group.tasks, null) + '</div></section>';
    }).join('') : '<p class="task-empty-column task-all-projects-empty">Nenhuma tarefa encontrada nos projetos.</p>';
  }

  function renderKanbanColumns(tasks, project) {
    var backlog = project ? renderProjectBacklog(project) : '';
    return backlog + statuses.map(function (column) {
      var cards = tasks.filter(function (task) { return taskStatus(task) === column.id; })
        .sort(function (a, b) {
          var positionDiff = Number(a.position || 0) - Number(b.position || 0);
          return positionDiff || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      return '<section class="task-kanban-column" data-task-status="' + column.id + '">' +
        '<header><h2>' + column.label + '</h2><span>' + cards.length + '</span></header>' +
        '<div class="task-kanban-dropzone" data-task-dropzone="' + column.id + '">' +
        (cards.length ? cards.map(renderTaskCard).join('') : '<p class="task-empty-column">Nenhuma tarefa</p>') +
        '</div></section>';
    }).join('');
  }

  function renderProjectBacklog(project) {
    var items = Array.isArray(project.backlogItems) ? project.backlogItems : [];
    var itemMarkup = items.map(function (item, index) {
      return '<li class="task-backlog-item' + (item.completed ? ' is-complete' : '') + '">' +
        '<label><input type="checkbox" data-backlog-toggle="' + index + '"' + (item.completed ? ' checked' : '') +
        '><span>' + escapeHtml(item.title || '') + '</span></label>' +
        '<button type="button" data-backlog-remove="' + index + '" aria-label="Remover objetivo" title="Remover objetivo">×</button></li>';
    }).join('');
    return '<section class="task-kanban-column task-backlog-column" data-task-status="backlog">' +
      '<header><h2>Backlog</h2><div class="task-kanban-column-actions"><span>' + items.length + '</span>' +
      '<button type="button" class="task-add-backlog" data-add-backlog aria-label="Adicionar objetivo ao Backlog" title="Adicionar objetivo">+</button>' +
      '</div></header>' +
      '<form class="task-backlog-add-form" data-backlog-form hidden><input type="text" data-backlog-title maxlength="240" placeholder="Objetivo geral do projeto" aria-label="Novo objetivo do projeto"><button type="submit" aria-label="Salvar objetivo" title="Salvar objetivo">✓</button></form>' +
      (items.length ? '<ul class="task-backlog-list">' + itemMarkup + '</ul>' : '<p class="task-empty-column">Adicione os objetivos gerais deste projeto.</p>') +
      '</section>';
  }

  function renderProductivity(state) {
    var tasks = getPersonalTasks(state);
    var done = tasks.filter(function (task) { return taskStatus(task) === 'concluida'; }).length;
    var total = tasks.length;
    var percentage = total ? Math.round((done / total) * 100) : 0;
    var donut = document.getElementById('task-productivity-donut');
    var percentLabel = document.getElementById('task-productivity-percent');
    var summary = document.getElementById('task-productivity-summary');
    if (donut) donut.style.background = 'conic-gradient(var(--green) 0 ' + percentage + '%, var(--border-soft) ' + percentage + '% 100%)';
    if (percentLabel) percentLabel.textContent = percentage + '%';
    if (summary) summary.textContent = total ? done + ' de ' + total + ' tarefas concluídas' : 'Nenhuma tarefa atribuída ou criada por você';
  }

  function eventStartDate(event) {
    if (event.allDay && event.allDayStartDate) return String(event.allDayStartDate).slice(0, 10);
    return event.startsAt ? String(event.startsAt).slice(0, 10) : '';
  }

  function eventCoversDate(event, key) {
    var start = eventStartDate(event);
    if (!start) return false;
    if (event.allDay && event.allDayEndDate) {
      return key >= start && key < String(event.allDayEndDate).slice(0, 10);
    }
    var parts = key.split('-').map(Number);
    var dayStart = new Date(parts[0], parts[1] - 1, parts[2]);
    var nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    var startTime = event.startsAt ? new Date(event.startsAt) : null;
    var endTime = event.endsAt ? new Date(event.endsAt) : startTime;
    if (!startTime || Number.isNaN(startTime.getTime())) return false;
    if (!endTime || Number.isNaN(endTime.getTime())) return startTime >= dayStart && startTime < nextDay;
    return startTime < nextDay && endTime > dayStart;
  }

  function getVisibleEvents(state) {
    return (state.events || []).filter(function (event) {
      return !event.deletedAt && (event.visibility !== 'private' || event.ownerId === currentUserId);
    });
  }

  function renderCalendar(state) {
    var calendar = document.getElementById('task-calendar');
    if (!calendar) return;
    monthCursor = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
    var monthName = monthCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    var firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    var start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    var events = getVisibleEvents(state);
    var dateCells = [];
    for (var i = 0; i < 42; i += 1) {
      var date = new Date(start);
      date.setDate(start.getDate() + i);
      var iso = dateKey(date);
      var isCurrentMonth = date.getMonth() === monthCursor.getMonth();
      var isToday = iso === dateKey(new Date());
      var hasEvent = events.some(function (event) { return eventCoversDate(event, iso); });
      dateCells.push('<button type="button" class="task-calendar-day' + (isCurrentMonth ? '' : ' is-muted') +
        (isToday ? ' is-today' : '') + (hasEvent ? ' has-event' : '') +
        (iso === dateKey(selectedCalendarDate) ? ' is-selected' : '') +
        '" data-calendar-date="' + iso + '" aria-label="' + date.toLocaleDateString('pt-BR') + '">' + date.getDate() + '</button>');
    }
    var selectedIso = dateKey(selectedCalendarDate);
    var selectedEvents = events.filter(function (event) { return eventCoversDate(event, selectedIso); })
      .sort(function (a, b) { return String(a.startsAt || '').localeCompare(String(b.startsAt || '')); });
    calendar.innerHTML = '<div class="task-calendar-heading"><button type="button" data-calendar-step="-1" aria-label="Mês anterior">‹</button>' +
      '<h3>' + escapeHtml(monthName) + '</h3><button type="button" data-calendar-step="1" aria-label="Próximo mês">›</button></div>' +
      '<div class="task-calendar-grid"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>' +
      dateCells.join('') + '</div><div class="task-calendar-events">' +
      (selectedEvents.length ? selectedEvents.map(function (event) {
        var time = event.allDay ? 'Dia inteiro' : event.startsAt ? new Date(event.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        return '<a href="calendario.html" class="task-calendar-event"><b>' + escapeHtml(event.title) + '</b><span>' +
          escapeHtml([time, event.location].filter(Boolean).join(' · ') || 'Evento RildonX') + '</span></a>';
      }).join('') : '<p class="task-calendar-empty">Nenhum evento neste dia.</p>') +
      '</div><a href="calendario.html" class="task-widget-link">Abrir Calendário</a>';
  }

  function renderProjectAgenda(state) {
    var root = document.getElementById('task-project-agenda');
    if (!root) return;
    var projects = (state.projects || []).filter(function (project) { return canViewProject(project, state); })
      .sort(function (a, b) { return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); }).slice(0, 5);
    var events = getVisibleEvents(state).filter(function (event) { return event.projectId; })
      .sort(function (a, b) { return String(a.startsAt || '').localeCompare(String(b.startsAt || '')); });
    if (!projects.length) {
      root.innerHTML = '<p class="task-widget-empty">Nenhum projeto compartilhado disponível.</p>';
      return;
    }
    root.innerHTML = projects.map(function (project) {
      var projectEvent = events.find(function (event) { return String(event.projectId) === String(project.id); });
      var progress = projectProgress(project, state);
      return '<a class="task-project-agenda-item" href="projetos.html"><span class="task-project-dot"></span><span class="task-project-agenda-copy"><b>' +
        escapeHtml(project.name) + '</b><small>' +
        (projectEvent ? escapeHtml(formatDate(eventStartDate(projectEvent)) + ' · ' + projectEvent.title) :
          escapeHtml(progress.status + ' · atualizado ' + formatDate(project.updatedAt))) +
        '</small><span class="task-project-progress" role="img" aria-label="Progresso ' + progress.progress + '%"><i style="width:' +
        Math.max(0, Math.min(100, progress.progress)) + '%"></i></span></span></a>';
    }).join('') + '<a href="projetos.html" class="task-widget-link">Ver projetos</a>';
  }

  function renderProjectFilters(state) {
    var filter = document.getElementById('task-project-filter');
    var createSelect = document.getElementById('nt-projeto');
    var projects = (state.projects || []).filter(function (project) { return project && project.isDemo !== true; });
    if (filter) {
      var selected = filter.value;
      filter.innerHTML = '<option value="">Todos os projetos</option>' + projects.map(function (project) {
        return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</option>';
      }).join('');
      filter.value = selected;
    }
    if (createSelect) {
      var createSelected = createSelect.value;
      createSelect.innerHTML = '<option value="">Sem projeto</option>' + projects.map(function (project) {
        return '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</option>';
      }).join('');
      createSelect.value = createSelected;
    }
    var collaborators = document.getElementById('nt-colaboradores');
    if (collaborators) {
      var currentValues = Array.from(collaborators.selectedOptions).map(function (option) { return option.value; });
      var profiles = (state.profiles || []).filter(function (profile) {
        return profile.active !== false && String(profile.id) !== String(currentUserId);
      });
      collaborators.innerHTML = profiles.map(function (profile) {
        var name = profile.displayName || profile.nickname || profile.id;
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
      }).join('');
      Array.from(collaborators.options).forEach(function (option) { option.selected = currentValues.indexOf(option.value) !== -1; });
      var picker = document.getElementById('nt-colaboradores-picker');
      if (picker) {
        picker.innerHTML = renderCollaboratorPicker(profiles, currentValues, 'new-task');
      }
    }
  }

  function renderCollaboratorPicker(profiles, selectedNames, key) {
    var selected = Array.isArray(selectedNames) ? selectedNames : [];
    return '<div class="task-collaborator-picker" data-collaborator-picker="' + escapeHtml(key) + '">' +
      '<button type="button" class="task-collaborator-trigger" data-toggle-collaborator-picker aria-label="Adicionar colaboradores" title="Adicionar colaboradores">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6m-3-3h6"/></svg></button>' +
      '<div class="task-collaborator-popover" data-collaborator-options hidden>' +
      (profiles.length ? profiles.map(function (profile) {
        var name = profile.displayName || profile.nickname || profile.id;
        return '<label class="task-collaborator-option"><input type="checkbox" data-collaborator-name="' + escapeHtml(name) + '"' +
          (selected.indexOf(name) !== -1 ? ' checked' : '') + '><span>' + escapeHtml(name) + '</span></label>';
      }).join('') : '<p class="task-collaborator-empty">Nenhum colaborador disponível.</p>') +
      '</div><div class="task-collaborator-selected" data-collaborator-summary>' +
      escapeHtml(selected.length ? selected.join(', ') : 'Nenhum colaborador selecionado') + '</div></div>';
  }

  function render(state) {
    if (!taskRoot) return;
    renderProjectFilters(state);
    renderBoard(state);
    renderProductivity(state);
    renderCalendar(state);
    renderProjectAgenda(state);
  }

  function renderTaskDetails(taskId) {
    if (!detailOverlay) return;
    var state = getStoreState();
    var task = (state.tasks || []).find(function (item) { return String(item.id) === String(taskId); });
    if (!task) {
      detailOverlay.remove();
      detailOverlay = null;
      return;
    }
    detailOverlay.dataset.taskId = taskId;
    var checklist = Array.isArray(task.checklist) ? task.checklist : [];
    var attachments = Array.isArray(task.attachments) ? task.attachments : [];
    var profiles = state.profiles || [];
    var creator = profiles.find(function (profile) { return String(profile.id) === String(task.createdBy); });
    var creatorName = creator && (creator.displayName || creator.nickname) || (String(task.createdBy) === currentUserId ? currentUserName : 'Colaborador');
    var assignees = getTaskAssigneeNames(task, state);
    var comments = (state.taskComments || []).filter(function (comment) { return String(comment.taskId) === String(task.id); })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    var availableCollaborators = profiles.filter(function (profile) {
      return profile.active !== false && String(profile.id) !== String(task.createdBy);
    });
    detailOverlay.innerHTML = '<div class="task-detail-panel" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">' +
      '<header class="task-detail-header"><div><span class="task-detail-eyebrow">Detalhes da tarefa</span><h2 id="task-detail-title">' +
      escapeHtml(task.title || 'Tarefa') + '</h2></div><button type="button" data-close-task aria-label="Fechar">×</button></header>' +
      '<div class="task-detail-people"><span><small>Criador</small><b>' + escapeHtml(creatorName) + '</b></span>' +
      '<span><small>Colaboradores</small>' +
      (isTaskCreator(task)
        ? renderCollaboratorPicker(availableCollaborators, assignees, 'task-' + task.id)
        : '<b>' + escapeHtml(assignees.length ? assignees.join(', ') : 'Nenhum') + '</b>') +
      '</span></div>' +
      '<form class="task-detail-form"><div class="task-detail-fields"><label>Título<input name="title" value="' + escapeHtml(task.title) + '" required></label>' +
      '<label>Início<input name="startDate" type="date" value="' + escapeHtml(task.startDate || '') + '"></label>' +
      '<label>Prazo<input name="dueDate" type="date" value="' + escapeHtml(task.dueDate || '') + '"></label></div>' +
      '<label class="task-detail-description">Descrição<textarea name="description" rows="3">' + escapeHtml(task.description || '') + '</textarea></label>' +
      '<div class="task-detail-section"><h3>Checklist</h3><div class="task-detail-checklist">' +
      (checklist.length ? checklist.map(function (item, index) {
        return '<label><input type="checkbox" data-checklist-index="' + index + '"' + (item.completed ? ' checked' : '') +
          '><span>' + escapeHtml(item.text || '') + '</span></label>';
      }).join('') : '<p class="task-detail-muted">Nenhum item de checklist.</p>') +
      '</div></div><div class="task-detail-section"><div class="task-detail-section-head"><h3>Arquivos e mídia</h3>' +
      '<label class="task-file-add">Adicionar arquivo<input type="file" data-task-file multiple></label></div>' +
      (attachments.length ? '<ul class="task-attachment-list">' + attachments.map(function (file, index) {
        var fileComments = file.id ? comments.filter(function (comment) {
          return String(comment.attachmentId) === String(file.id);
        }) : [];
        return '<li><div class="task-attachment-head"><button type="button" data-open-attachment="' + index + '">' +
          escapeHtml(file.name || 'Arquivo') + '</button><span>' + escapeHtml(file.sizeLabel || '') + '</span></div>' +
          '<section class="task-media-comments" aria-label="Comentários em ' + escapeHtml(file.name || 'arquivo') + '">' +
          '<h4>Comentários neste arquivo</h4><div class="task-comment-list">' +
          (fileComments.length ? fileComments.map(renderTaskComment).join('') : '<p class="task-detail-muted">Ainda não há comentários neste arquivo.</p>') +
          '</div>' +
          (file.id ? '<div class="task-comment-form"><textarea data-comment-body rows="2" maxlength="2000" placeholder="Comente este arquivo..."></textarea>' +
            '<button type="button" class="btn" data-submit-comment="' + escapeHtml(file.id) + '">Comentar</button></div>' :
            '<p class="task-detail-muted">Reenvie este arquivo para habilitar comentários.</p>') +
          '</section></li>';
      }).join('') + '</ul>' : '<p class="task-detail-muted">Nenhum arquivo anexado.</p>') +
      '</div>' +
      '<footer class="task-detail-footer">' +
      (isTaskCreator(task) ? '<button type="button" class="btn outline-red" data-delete-task>Excluir tarefa</button>' : '') +
      '<button type="button" class="btn secondary" data-close-task>Fechar</button>' +
      '<button type="submit" class="btn">Salvar alterações</button></footer></form></div>';
  }

  function renderTaskComment(comment) {
    var createdAt = new Date(comment.createdAt);
    var dateLabel = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleString('pt-BR');
    return '<article class="task-comment"><b>' + escapeHtml(comment.authorName || 'Colaborador') + '</b><time>' +
      escapeHtml(dateLabel) + '</time><p>' + escapeHtml(comment.body) + '</p></article>';
  }

  async function syncTaskDocumentViewers(task, assigneeNames) {
    if (!task || !/^[0-9a-f-]{36}$/i.test(String(task.id)) || !window.supabaseClient) return;
    if (typeof window.supabaseClient.rpc !== 'function') {
      throw new Error('A função de compartilhamento de arquivos não está disponível.');
    }
    var selectedNames = Array.isArray(assigneeNames) ? assigneeNames : [];
    var profiles = getStoreState().profiles || [];
    if (selectedNames.length && !profiles.length) return;
    var viewerProfiles = profiles.filter(function (profile) {
      var name = profile.displayName || profile.nickname || profile.id;
      return selectedNames.indexOf(name) !== -1;
    });
    if (selectedNames.some(function (name) {
      return !viewerProfiles.some(function (profile) {
        return String(profile.displayName || profile.nickname || profile.id) === String(name);
      });
    })) return;
    var viewerIds = viewerProfiles.filter(function (profile) {
      return String(profile.id) !== String(currentUserId);
    }).map(function (profile) { return profile.id; });
    var result = await window.supabaseClient.rpc('rildonx_sync_task_document_viewers', {
      p_task_id: task.id,
      p_viewer_ids: viewerIds
    });
    if (result.error) throw result.error;
  }

  function openTaskDetails(taskId) {
    if (!detailOverlay) {
      detailOverlay = document.createElement('div');
      detailOverlay.className = 'task-detail-overlay';
      detailOverlay.addEventListener('click', function (event) {
        if (event.target === detailOverlay || event.target.closest('[data-close-task]')) {
          detailOverlay.remove();
          detailOverlay = null;
        }
      });
      detailOverlay.addEventListener('change', handleDetailChange);
      detailOverlay.addEventListener('click', handleDetailClick);
      detailOverlay.addEventListener('submit', handleDetailSubmit);
      detailOverlay.addEventListener('change', handleAttachmentUpload);
      document.body.appendChild(detailOverlay);
    }
    renderTaskDetails(taskId);
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === String(taskId); });
    if (task && isTaskCreator(task)) {
      syncTaskDocumentViewers(task, task.assignees).catch(function (error) {
        console.error('Não foi possível atualizar o acesso aos arquivos da tarefa:', error);
        notify(error.message || 'Não foi possível atualizar o acesso aos arquivos.');
      });
    }
    refreshTaskComments(taskId);
    var title = detailOverlay.querySelector('[name="title"]');
    if (title) title.focus();
  }

  async function refreshTaskComments(taskId) {
    if (!window.supabaseClient || !window.supabaseClient.from || !/^[0-9a-f-]{36}$/i.test(String(taskId))) return;
    var result;
    try {
      result = await window.supabaseClient.from('task_comments').select('*')
        .eq('task_id', taskId).order('created_at', { ascending: true });
    } catch (error) {
      console.error('Não foi possível atualizar comentários da tarefa:', error);
      notify(error.message || 'Não foi possível carregar os comentários.');
      return;
    }
    if (result.error) {
      console.error('Não foi possível atualizar comentários da tarefa:', result.error);
      notify(result.error.message || 'Não foi possível carregar os comentários.');
      return;
    }
    var state = getStoreState();
    var profiles = state.profiles || [];
    var remoteComments = (result.data || []).map(function (row) {
      var profile = profiles.find(function (item) { return String(item.id) === String(row.author_id); });
      return {
        id: row.id,
        taskId: row.task_id,
        attachmentId: row.attachment_id || null,
        authorId: row.author_id,
        authorName: profile && (profile.displayName || profile.nickname) || 'Colaborador',
        body: row.body || '',
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        createdAt: row.created_at
      };
    });
    window.RildonXStore.setState({
      taskComments: (state.taskComments || []).filter(function (comment) { return String(comment.taskId) !== String(taskId); })
        .concat(remoteComments)
    });
    if (detailOverlay && String(detailOverlay.dataset.taskId) === String(taskId)) renderTaskDetails(taskId);
  }

  async function handleDetailChange(event) {
    var index = event.target.dataset.checklistIndex;
    if (index === undefined) return;
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === detailOverlay.dataset.taskId; });
    if (!task) return;
    var checklist = (task.checklist || []).map(function (item, itemIndex) {
      return itemIndex === Number(index) ? Object.assign({}, item, { completed: event.target.checked }) : item;
    });
    window.RildonXStore.updateTask(task.id, { checklist: checklist });
  }

  async function handleDetailClick(event) {
    if (event.target.closest('[data-delete-task]')) {
      await deleteTaskFromDetails();
      return;
    }
    var commentButton = event.target.closest('[data-submit-comment]');
    if (commentButton) {
      var commentForm = commentButton.closest('.task-comment-form');
      var commentInput = commentForm && commentForm.querySelector('[data-comment-body]');
      if (commentInput && commentInput.value.trim()) {
        await submitComment(commentButton.dataset.submitComment, commentInput.value.trim());
      }
      return;
    }
    var button = event.target.closest('[data-open-attachment]');
    if (!button) return;
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === detailOverlay.dataset.taskId; });
    var file = task && (task.attachments || [])[Number(button.dataset.openAttachment)];
    if (!file) return;
    try {
      var url = window.RildonXDocumentUpload ? await window.RildonXDocumentUpload.getViewUrl(file) : file.url;
      if (!url) throw new Error('O arquivo não possui um endereço disponível.');
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      notify(error.message || 'Não foi possível abrir o arquivo.');
    }
  }

  async function deleteTaskFromDetails() {
    var taskId = detailOverlay && detailOverlay.dataset.taskId;
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === String(taskId); });
    if (!task || !isTaskCreator(task)) {
      notify('Somente o criador pode excluir esta tarefa.');
      return;
    }
    if (!window.confirm('Deseja excluir esta tarefa? Essa ação não pode ser desfeita.')) return;
    var deleteButton = detailOverlay.querySelector('[data-delete-task]');
    if (deleteButton) deleteButton.disabled = true;
    try {
      if (/^[0-9a-f-]{36}$/i.test(String(task.id))) {
        if (!window.supabaseClient || !window.supabaseClient.from) {
          throw new Error('O serviço de tarefas não está disponível. Tente novamente.');
        }
        var deleteQuery = window.supabaseClient.from('tasks').delete().eq('id', task.id);
        if (!window.RildonXIsAdmin) deleteQuery = deleteQuery.eq('created_by', currentUserId);
        var result = await deleteQuery.select('id').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error('A tarefa não foi excluída. Verifique suas permissões e tente novamente.');
      }
      if (!window.RildonXStore || typeof window.RildonXStore.deleteTask !== 'function' ||
          !window.RildonXStore.deleteTask(task.id)) {
        throw new Error('Não foi possível remover a tarefa da lista local.');
      }
      if (detailOverlay) {
        detailOverlay.remove();
        detailOverlay = null;
      }
      notify('Tarefa excluída.');
    } catch (error) {
      console.error('Não foi possível excluir a tarefa:', error);
      notify(error.message || 'Não foi possível excluir a tarefa.');
    } finally {
      if (detailOverlay) {
        var activeDeleteButton = detailOverlay.querySelector('[data-delete-task]');
        if (activeDeleteButton) activeDeleteButton.disabled = false;
      }
    }
  }

  async function handleAttachmentUpload(event) {
    if (!event.target.matches('[data-task-file]') || !event.target.files || !event.target.files.length) return;
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === detailOverlay.dataset.taskId; });
    if (!task) return;
    var uploadService = window.RildonXDocumentUpload;
    if (!uploadService) {
      notify('O serviço de arquivos não foi carregado.');
      return;
    }
    event.target.disabled = true;
    try {
      var state = getStoreState();
      var viewerIds = (state.profiles || []).filter(function (profile) {
        return (task.assignees || []).indexOf(profile.displayName || profile.nickname || profile.id) !== -1 &&
          String(profile.id) !== String(currentUserId);
      }).map(function (profile) { return profile.id; });
      if (task.createdBy && String(task.createdBy) !== String(currentUserId) &&
          viewerIds.indexOf(task.createdBy) === -1) viewerIds.push(task.createdBy);
      var files = Array.from(event.target.files);
      var uploaded = [];
      for (var i = 0; i < files.length; i += 1) {
        uploaded.push(await uploadService.upload(files[i], {
          folder: 'Tarefas',
          senderName: currentUserName,
          viewerIds: viewerIds,
          relatedTaskId: task.id
        }));
      }
      window.RildonXStore.updateTask(task.id, {
        attachments: (task.attachments || []).concat(uploaded)
      });
      renderTaskDetails(task.id);
      notify('Arquivo(s) anexado(s) à tarefa.');
    } catch (error) {
      console.error('Não foi possível anexar arquivo à tarefa:', error);
      notify(error.message || 'Não foi possível anexar os arquivos.');
    } finally {
      if (detailOverlay) {
        var fileInput = detailOverlay.querySelector('[data-task-file]');
        if (fileInput) {
          fileInput.disabled = false;
          fileInput.value = '';
        }
      }
    }
  }

  async function handleDetailSubmit(event) {
    if (!event.target.matches('.task-detail-form')) return;
    event.preventDefault();
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === detailOverlay.dataset.taskId; });
    if (!task) return;
    var formData = new FormData(event.target);
    window.RildonXStore.updateTask(task.id, {
      title: String(formData.get('title') || '').trim(),
      startDate: formData.get('startDate') || null,
      dueDate: formData.get('dueDate') || null,
      description: String(formData.get('description') || '').trim()
    });
    renderTaskDetails(task.id);
    notify('Tarefa atualizada.');
  }

  async function submitComment(attachmentId, body) {
    var task = (getStoreState().tasks || []).find(function (item) { return String(item.id) === detailOverlay.dataset.taskId; });
    body = String(body || '').trim();
    var attachment = task && (task.attachments || []).find(function (file) {
      return String(file.id) === String(attachmentId);
    });
    if (!task || !attachment || !body) return;
    var userId = currentUserId;
    if (window.supabaseClient && window.supabaseClient.auth) {
      var userResult;
      try {
        userResult = await window.supabaseClient.auth.getUser();
      } catch (error) {
        console.error('Não foi possível verificar a sessão para comentar:', error);
        notify(error.message || 'Não foi possível verificar sua sessão.');
        return;
      }
      if (userResult.error) {
        notify(userResult.error.message || 'Não foi possível validar sua sessão.');
        return;
      }
      if (!userResult.data.user) {
        notify('Sua sessão expirou. Entre novamente para comentar.');
        return;
      }
      userId = userResult.data.user.id;
    }
    var comment = {
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'comment-' + Date.now(),
      taskId: task.id,
      attachmentId: attachment.id,
      authorId: userId,
      authorName: currentUserName,
      body: body,
      attachments: [],
      createdAt: new Date().toISOString()
    };
    if (window.supabaseClient && window.supabaseClient.from && /^[0-9a-f-]{36}$/i.test(String(task.id))) {
      var result;
      try {
        result = await window.supabaseClient.from('task_comments').insert({
          task_id: task.id,
          attachment_id: attachment.id,
          author_id: userId,
          body: body,
          attachments: []
        }).select('*').single();
      } catch (error) {
        console.error('Não foi possível salvar o comentário da tarefa:', error);
        notify(error.message || 'Não foi possível salvar o comentário.');
        return;
      }
      if (result.error) {
        console.error('Não foi possível salvar o comentário da tarefa:', result.error);
        notify(result.error.message || 'Não foi possível salvar o comentário.');
        return;
      }
      comment.id = result.data.id;
      comment.createdAt = result.data.created_at;
    }
    var state = getStoreState();
    window.RildonXStore.setState({ taskComments: (state.taskComments || []).concat(comment) });
    renderTaskDetails(task.id);
    notify('Comentário publicado.');
  }

  function computePosition(list, insertionIndex) {
    var previous = insertionIndex > 0 ? Number(list[insertionIndex - 1].position || 0) : null;
    var next = insertionIndex < list.length ? Number(list[insertionIndex].position || 0) : null;
    if (previous === null && next === null) return 0;
    if (previous === null) return next - 1000;
    if (next === null) return previous + 1000;
    if (next - previous > 0.000001) return previous + ((next - previous) / 2);
    return previous + 0.000001;
  }

  async function moveTask(taskId, status, targetCardId) {
    var state = getStoreState();
    var task = (state.tasks || []).find(function (item) { return String(item.id) === String(taskId); });
    if (!task || !isTaskCreator(task)) return;
    var target = (state.tasks || []).filter(function (item) {
      return item.id !== task.id && item.isDemo !== true && taskStatus(item) === status;
    }).sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    var insertionIndex = targetCardId ? target.findIndex(function (item) { return String(item.id) === String(targetCardId); }) : -1;
    if (insertionIndex < 0) insertionIndex = target.length;
    var position = computePosition(target, insertionIndex);

    try {
      if (window.supabaseClient && window.supabaseClient.rpc && /^[0-9a-f-]{36}$/i.test(String(task.id))) {
        var result = await window.supabaseClient.rpc('rildonx_reorder_task', {
          p_task_id: task.id,
          p_status: status,
          p_position: position
        });
        if (result.error) throw result.error;
      }
      window.RildonXStore.updateTask(task.id, { status: status, position: position });
    } catch (error) {
      console.error('Não foi possível mover a tarefa:', error);
      notify(error.message || 'Não foi possível mover a tarefa.');
    }
  }

  function bindBoard() {
    if (!taskRoot || taskRoot.dataset.bound === 'true') return;
    taskRoot.dataset.bound = 'true';
    taskRoot.addEventListener('input', function (event) {
      if (event.target.id === 'global-search') renderBoard(getStoreState());
    });
    taskRoot.addEventListener('change', function (event) {
      if (event.target.id === 'task-project-filter') renderBoard(getStoreState());
      if (event.target.matches('[data-backlog-toggle]')) {
        updateBacklogItem(Number(event.target.dataset.backlogToggle), { completed: event.target.checked });
      }
      if (event.target.matches('[data-calendar-date]')) {
        selectedCalendarDate = new Date(event.target.dataset.calendarDate + 'T12:00:00');
        monthCursor = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
        renderCalendar(getStoreState());
      }
    });
    taskRoot.addEventListener('click', function (event) {
      if (event.target.closest('[data-collaborator-picker]')) return;
      var addBacklogButton = event.target.closest('[data-add-backlog]');
      if (addBacklogButton) {
        var form = addBacklogButton.closest('.task-backlog-column').querySelector('[data-backlog-form]');
        var input = form && form.querySelector('[data-backlog-title]');
        if (form) form.hidden = false;
        if (input) input.focus();
        return;
      }
      var removeBacklogButton = event.target.closest('[data-backlog-remove]');
      if (removeBacklogButton) {
        removeBacklogItem(Number(removeBacklogButton.dataset.backlogRemove));
        return;
      }
      var monthStep = event.target.closest('[data-calendar-step]');
      if (monthStep) {
        var nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + Number(monthStep.dataset.calendarStep), 1);
        var targetDay = Math.min(selectedCalendarDate.getDate(), new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
        selectedCalendarDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay);
        renderCalendar(getStoreState());
        return;
      }
      var calendarDay = event.target.closest('[data-calendar-date]');
      if (calendarDay) {
        selectedCalendarDate = new Date(calendarDay.dataset.calendarDate + 'T12:00:00');
        monthCursor = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
        renderCalendar(getStoreState());
        return;
      }
      var card = event.target.closest('.task-card');
      if (card) openTaskDetails(card.dataset.taskId);
    });
    taskRoot.addEventListener('keydown', function (event) {
      if (event.target.closest('[data-collaborator-picker]')) return;
      if (event.target.matches('[data-backlog-title]')) {
        if (event.key === 'Enter') {
          event.preventDefault();
          var form = event.target.closest('[data-backlog-form]');
          if (form && form.requestSubmit) form.requestSubmit();
        } else if (event.key === 'Escape') {
          event.target.value = '';
          event.target.closest('[data-backlog-form]').hidden = true;
        }
        return;
      }
      var card = event.target.closest('.task-card');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openTaskDetails(card.dataset.taskId);
      }
    });
    taskRoot.addEventListener('dragstart', function (event) {
      var card = event.target.closest('.task-card[draggable="true"]');
      if (!card) return;
      event.dataTransfer.setData('text/plain', card.dataset.taskId);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });
    taskRoot.addEventListener('dragend', function (event) {
      var card = event.target.closest('.task-card');
      if (card) card.classList.remove('is-dragging');
    });
    taskRoot.addEventListener('dragover', function (event) {
      if (event.target.closest('[data-task-dropzone]')) event.preventDefault();
    });
    taskRoot.addEventListener('drop', function (event) {
      var dropzone = event.target.closest('[data-task-dropzone]');
      if (!dropzone) return;
      event.preventDefault();
      var taskId = event.dataTransfer.getData('text/plain');
      var targetCard = event.target.closest('.task-card');
      moveTask(taskId, dropzone.dataset.taskDropzone, targetCard && targetCard.dataset.taskId !== taskId ? targetCard.dataset.taskId : null);
    });
    taskRoot.addEventListener('submit', function (event) {
      if (!event.target.matches('[data-backlog-form]')) return;
      event.preventDefault();
      var input = event.target.querySelector('[data-backlog-title]');
      var title = input ? input.value.trim() : '';
      if (!title) {
        if (input) input.focus();
        return;
      }
      addBacklogItem(title);
    });
  }

  function updateProjectBacklog(update) {
    var state = getStoreState();
    var filter = document.getElementById('task-project-filter');
    var projectId = filter && filter.value;
    if (!projectId) {
      notify('Selecione um projeto para editar o Backlog.');
      return false;
    }
    var found = false;
    var projects = (state.projects || []).map(function (project) {
      if (String(project.id) !== String(projectId)) return project;
      found = true;
      return Object.assign({}, project, { backlogItems: update(project.backlogItems || []) });
    });
    if (!found) {
      notify('O projeto selecionado não está disponível.');
      return false;
    }
    window.RildonXStore.setState({ projects: projects });
    return true;
  }

  function createBacklogItemId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : 'backlog-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function addBacklogItem(title) {
    var added = updateProjectBacklog(function (items) {
      return items.concat({ id: createBacklogItemId(), title: title, completed: false, createdAt: new Date().toISOString() });
    });
    if (!added) return;
    notify('Objetivo adicionado ao Backlog do projeto.');
  }

  function updateBacklogItem(index, changes) {
    updateProjectBacklog(function (items) {
      return items.map(function (item, itemIndex) {
        return itemIndex === index ? Object.assign({}, item, changes) : item;
      });
    });
  }

  function removeBacklogItem(index) {
    updateProjectBacklog(function (items) {
      return items.filter(function (item, itemIndex) { return itemIndex !== index; });
    });
  }

  function notify(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    var region = document.getElementById('toast-wrap');
    if (region) region.textContent = message;
  }

  function initIdentity() {
    var state = getStoreState();
    currentUserId = state.user && state.user.id || '';
    currentUserName = state.user && state.user.name || 'Usuário';
    if (!window.supabaseClient || !window.supabaseClient.auth) return Promise.resolve();
    return window.supabaseClient.auth.getUser().then(function (result) {
      if (result.error) throw result.error;
      var user = result.data && result.data.user;
      if (!user) return;
      currentUserId = user.id;
      var appMetadata = user.app_metadata || {};
      var adminRole = String(appMetadata.role || '').trim().toLowerCase();
      var loginName = String(user.email || '').split('@')[0].trim().toLowerCase();
      window.RildonXIsAdmin = appMetadata.is_admin === true ||
        adminRole === 'admin' || adminRole === 'administrator' || loginName === 'adson.ri';
      currentUserName = user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name || user.user_metadata.name) ||
        user.email && user.email.split('@')[0] || currentUserName;
    }).catch(function (error) {
      console.error('Não foi possível carregar o usuário atual das tarefas:', error);
    });
  }

  function init() {
    if (document.body.dataset.page !== 'tarefas' || !window.RildonXStore) return;
    var layout = document.querySelector('#page-tarefas .layout-2col');
    if (!layout) return;
    layout.innerHTML = '<div class="task-workspace"><div class="task-main"><div class="task-board-toolbar">' +
      '<div><h2>Quadro de tarefas</h2><p>Arraste cartões entre etapas para atualizar o andamento.</p></div>' +
      '<div class="task-board-filters"><select id="task-project-filter" aria-label="Filtrar por projeto"><option value="">Todos os projetos</option></select>' +
      '<button type="button" class="btn task-new-task-button" onclick="openModal(\'modal-nova-tarefa\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nova tarefa</button></div></div>' +
      '<div class="task-board-viewport" aria-label="Quadro de tarefas">' +
      '<div id="task-kanban-board" class="task-board-content"></div></div></div>' +
      '<aside class="task-side-widgets"><section class="card card-pad task-productivity-card"><h2>Minha produtividade</h2>' +
      '<div class="task-productivity-donut" id="task-productivity-donut"><div><b id="task-productivity-percent">0%</b></div></div>' +
      '<p id="task-productivity-summary"></p><small>Meta fixa: 70%</small></section>' +
      '<section class="mini-cal task-calendar-widget"><h2>Calendário RildonX</h2><div id="task-calendar"></div></section>' +
      '<section class="card task-project-widget"><div class="card-head"><h2>Projetos · agenda</h2></div><div class="task-project-agenda" id="task-project-agenda"></div></section></aside></div>';
    taskRoot = layout;
    bindBoard();
    bindCollaboratorPicker();
    render(getStoreState());
    initIdentity().then(function () { render(getStoreState()); });
    window.RildonXStore.subscribe(function (state) { render(state); });
    var search = document.getElementById('global-search');
    if (search) search.addEventListener('input', function () {
      renderBoard(getStoreState());
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
