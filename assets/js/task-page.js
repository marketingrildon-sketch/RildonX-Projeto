(function () {
  'use strict';

  var statuses = [
    { id: 'pendente', label: 'Pendentes' },
    { id: 'em-andamento', label: 'Em andamento' },
    { id: 'aguardando-terceiros', label: 'Aguardando terceiros' },
    { id: 'concluida', label: 'Concluídas' }
  ];
  var currentUserId = '';
  var currentUserName = 'Usuário';
  var taskRoot;
  var detailOverlay;
  var activeTaskView = 'kanban';
  var activeTaskViewFilter = 'all';
  var activeTaskFilterKeys = [];
  var taskFilterValues = {};
  var taskFilterTypes = [
    { id: 'project', label: 'Projeto', icon: '▰' },
    { id: 'status', label: 'Status', icon: '◉' },
    { id: 'tags', label: 'Etiquetas', icon: '◇' },
    { id: 'dueDate', label: 'Data de vencimento', icon: '▣' },
    { id: 'priority', label: 'Prioridade', icon: '⚑' },
    { id: 'assignee', label: 'Responsável', icon: '♙' },
    { id: 'archived', label: 'Arquivado', icon: '▱' },
    { id: 'commentAssigned', label: 'Comentário atribuído', icon: '▢' },
    { id: 'createdBy', label: 'Criado por', icon: '♧' },
    { id: 'endDate', label: 'Data de encerramento', icon: '▣' },
    { id: 'createdDate', label: 'Data criada', icon: '▣' }
  ];
  var taskPreferences = { savedFilters: [], requestTemplates: [] };
  var taskPreferencesLoaded = false;
  var recurrenceCheckRunning = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
    try {
      localStorage.setItem(getSavedTemplatesKey(), JSON.stringify(taskPreferences.requestTemplates));
    } catch (error) {
      console.error('Não foi possível salvar o modelo neste navegador:', error);
      notify('Não foi possível salvar este modelo neste navegador.');
      return;
    }
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

  function isTaskAssignedToCurrentUser(task, state) {
    if (task.createdBy && currentUserId && String(task.createdBy) === String(currentUserId)) return true;
    if ((task.viewerIds || []).some(function (viewerId) { return String(viewerId) === String(currentUserId); })) return true;
    var profile = (state.profiles || []).find(function (item) {
      return currentUserId && String(item.id) === String(currentUserId);
    }) || state.user || {};
    var names = [currentUserName, profile.displayName, profile.nickname, profile.name]
      .filter(Boolean).map(function (name) { return String(name).trim().toLocaleLowerCase('pt-BR'); });
    return getTaskAssigneeNames(task, state).some(function (name) {
      return names.indexOf(String(name).trim().toLocaleLowerCase('pt-BR')) !== -1;
    });
  }

  function taskStatus(task) {
    var status = String(task.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (status === 'backlog') return 'pendente';
    if (status === 'aguardando terceiros' || status === 'aguardando-terceiros' || status === 'waiting') return 'aguardando-terceiros';
    if (status === 'concluido' || status === 'concluida' || status === 'complete' || status === 'completed') return 'concluida';
    if (status === 'em andamento' || status === 'em_andamento' || status === 'em-andamento' || status === 'in progress') return 'em-andamento';
    return 'pendente';
  }

  function taskMetadata(task) {
    return task && task.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata)
      ? task.metadata
      : {};
  }

  function taskParentId(task) {
    return String(taskMetadata(task).parentTaskId || '');
  }

  function isTaskArchived(task) {
    return taskMetadata(task).archived === true;
  }

  function getTaskCreatorName(task, state) {
    var profiles = state.profiles || [];
    var creator = profiles.find(function (profile) { return String(profile.id) === String(task.createdBy); });
    if (creator) return creator.displayName || creator.nickname || 'Colaborador';
    if (String(task.createdBy || '') === String(currentUserId)) return currentUserName;
    return task.createdBy ? 'Colaborador' : '—';
  }

  function formatTaskDateRange(task) {
    var start = task.startDate ? formatDate(task.startDate) : '—';
    var end = task.dueDate ? formatDate(task.dueDate) : '—';
    return start + ' – ' + end;
  }

  function getCollapsedTaskColumns() {
    try {
      var value = JSON.parse(localStorage.getItem('rildonx.task.collapsed-columns') || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error('Não foi possível carregar as colunas recolhidas:', error);
      return [];
    }
  }

  function saveCollapsedTaskColumns(columns) {
    try {
      localStorage.setItem('rildonx.task.collapsed-columns', JSON.stringify(columns));
    } catch (error) {
      console.error('Não foi possível salvar as colunas recolhidas:', error);
      notify('Não foi possível salvar a preferência de colunas neste navegador.');
    }
  }

  function taskDependencies(task) {
    var dependencies = taskMetadata(task).dependsOn;
    return Array.isArray(dependencies) ? dependencies.map(String) : [];
  }

  function incompleteDependencies(task, tasks) {
    return taskDependencies(task).map(function (id) {
      return (tasks || []).find(function (candidate) { return String(candidate.id) === id; });
    }).filter(function (dependency) {
      return dependency && taskStatus(dependency) !== 'concluida';
    });
  }

  function dependencyCycle(taskId, dependencyIds, tasks) {
    var visited = new Set();
    function reachesCurrent(id) {
      if (id === String(taskId)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      var dependency = (tasks || []).find(function (candidate) { return String(candidate.id) === id; });
      return dependency ? taskDependencies(dependency).some(reachesCurrent) : false;
    }
    return dependencyIds.some(reachesCurrent);
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

  function nextRecurrenceDate(dueDate, frequency) {
    if (!dueDate || !frequency) return null;
    var parts = String(dueDate).slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (part) { return !Number.isFinite(part); })) return null;
    var date = new Date(parts[0], parts[1] - 1, parts[2], 12);
    if (frequency === 'daily') date.setDate(date.getDate() + 1);
    else if (frequency === 'weekly') date.setDate(date.getDate() + 7);
    else if (frequency === 'monthly') {
      var day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + 1);
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    } else return null;
    return dateKey(date);
  }

  function createTaskId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : 'task-' + Date.now() + '-' + Math.random().toString(16).slice(2);
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

  function renderTaskAvatars(names, state) {
    var visible = names.slice(0, 3).map(function (name) {
      var profile = (state.profiles || []).find(function (item) {
        return [item.displayName, item.nickname].some(function (value) {
          return String(value || '').toLocaleLowerCase('pt-BR') === String(name).toLocaleLowerCase('pt-BR');
        });
      });
      var initials = String(name).split(/\s+/).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
      return '<span class="task-card-avatar" title="' + escapeHtml(name) + '">' +
        (profile && profile.avatarUrl ? '<img src="' + escapeHtml(profile.avatarUrl) + '" alt="">' : escapeHtml(initials || 'U')) +
        '</span>';
    }).join('');
    var extra = Math.max(0, names.length - 3);
    if (extra) visible += '<span class="task-card-avatar task-card-avatar--extra">+' + extra + '</span>';
    return visible || '<span class="task-card-no-assignees">Sem responsáveis</span>';
  }

  function renderTaskCard(task) {
    var state = getStoreState();
    var project = (state.projects || []).find(function (item) { return String(item.id) === String(task.projectId); });
    var title = escapeHtml(task.title || 'Tarefa sem título');
    var canMove = isTaskCreator(task);
    var checklist = Array.isArray(task.checklist) ? task.checklist : [];
    var completedChecklist = checklist.filter(function (item) { return item && item.completed === true; }).length;
    var status = taskStatus(task);
    var comments = (state.taskComments || []).filter(function (comment) {
      return String(comment.taskId) === String(task.id);
    }).length;
    var priority = String(task.priority || 'media').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var priorityLabel = priority === 'alta' ? 'Alta' : priority === 'baixa' ? 'Baixa' : 'Média';
    var metadata = taskMetadata(task);
    var subtasks = getRealTasks(state).filter(function (candidate) {
      return taskParentId(candidate) === String(task.id);
    }).sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    return '<article class="task-card task-card--' + status + (task.dueDate && task.dueDate < dateKey(new Date()) && status !== 'concluida' ? ' is-overdue' : '') + '" data-task-id="' + escapeHtml(task.id) + '" tabindex="0"' +
      (canMove ? ' draggable="true" aria-label="' + title + ', arrastável"' : ' aria-label="' + title + '"') +
      '><div class="task-card-heading"><div class="task-card-heading-copy"><h3>' + title + '</h3>' +
      (project ? '<p class="task-card-project">' + escapeHtml(project.name) + '</p>' : '') + '</div>' +
      '<button type="button" class="task-card-more" aria-label="Abrir detalhes da tarefa" title="Abrir detalhes">···</button></div>' +
      '<div class="task-card-details">' +
      '<span class="task-card-creator"><span class="task-card-meta-icon" aria-hidden="true">◉</span><span>' +
      escapeHtml(getTaskCreatorName(task, state)) + '</span></span>' +
      '<span class="task-card-date-range"><span class="task-card-meta-icon" aria-hidden="true">▢</span><span>' +
      escapeHtml(formatTaskDateRange(task)) + '</span></span>' +
      '<span class="task-card-priority task-card-priority--' + priority + '"><span aria-hidden="true">⚑</span> ' +
      priorityLabel + '</span></div>' +
      (isTaskArchived(task) ? '<span class="task-card-archived">Arquivada</span>' : '') +
      (metadata.isMilestone ? '<span class="task-card-milestone">◆ Marco</span>' : '') +
      (completedChecklist || comments || task.attachments && task.attachments.length
        ? '<div class="task-card-secondary"><span>Detalhes adicionais</span>' +
          (checklist.length ? '<span>' + completedChecklist + '/' + checklist.length + ' itens</span>' : '') +
          (comments ? '<span>' + comments + ' comentários</span>' : '') +
          (task.attachments && task.attachments.length ? '<span>' + task.attachments.length + ' anexos</span>' : '') + '</div>'
        : '') +
      renderTaskSubtaskPreview(subtasks) + '</article>';
  }

  function renderTaskSubtaskPreview(subtasks) {
    if (!subtasks.length) return '';
    return '<div class="task-card-subtasks" aria-label="' + subtasks.length + ' subtarefas">' +
      subtasks.slice(0, 3).map(function (subtask) {
        var state = taskStatus(subtask);
        return '<button type="button" class="task-subtask-preview" data-open-subtask="' + escapeHtml(subtask.id) + '">' +
          '<span class="task-subtask-dot task-subtask-dot--' + state + '" aria-hidden="true"></span>' +
          '<span>' + escapeHtml(subtask.title || 'Subtarefa sem título') + '</span></button>';
      }).join('') +
      (subtasks.length > 3 ? '<span class="task-subtask-overflow">+' + (subtasks.length - 3) + '</span>' : '') +
      '</div>';
  }

  function filterOptions(values, selected) {
    return values.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '"' +
        (String(item.value) === String(selected || '') ? ' selected' : '') + '>' +
        escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function taskFilterValuesForOptions(key, state) {
    var tasks = getRealTasks(state);
    if (key === 'project') {
      return [{ value: '__all_projects__', label: 'Todos os projetos' },
        { value: '__no_project__', label: 'Sem projeto' }].concat((state.projects || [])
        .filter(function (project) { return project && project.isDemo !== true; })
        .map(function (project) { return { value: project.id, label: project.name || 'Projeto' }; }));
    }
    if (key === 'status') return [{ value: '', label: 'Todos os status' }].concat(statuses.map(function (item) {
      return { value: item.id, label: item.label };
    }));
    if (key === 'priority') return [
      { value: '', label: 'Todas as prioridades' },
      { value: 'alta', label: 'Alta' },
      { value: 'media', label: 'Média' },
      { value: 'baixa', label: 'Baixa' }
    ];
    if (key === 'assignee') {
      var names = Array.from(new Set(tasks.reduce(function (all, task) {
        return all.concat(getTaskAssigneeNames(task, state));
      }, []))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      return [{ value: '', label: 'Todos os responsáveis' }].concat(names.map(function (name) {
        return { value: name, label: name };
      }));
    }
    if (key === 'tags') {
      var tags = Array.from(new Set(tasks.reduce(function (all, task) {
        return all.concat((Array.isArray(task.tags) ? task.tags : []).map(function (tag) {
          return typeof tag === 'string' ? tag : tag && (tag.name || tag.label) || '';
        }).filter(Boolean));
      }, []))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      return [{ value: '', label: 'Todas as etiquetas' }].concat(tags.map(function (tag) {
        return { value: tag, label: tag };
      }));
    }
    if (key === 'archived') return [
      { value: 'active', label: 'Não arquivadas' },
      { value: 'archived', label: 'Arquivadas' },
      { value: 'all', label: 'Todas' }
    ];
    if (key === 'commentAssigned') return [
      { value: '', label: 'Todos' },
      { value: 'yes', label: 'Com comentário atribuído' },
      { value: 'no', label: 'Sem comentário atribuído' }
    ];
    if (key === 'createdBy') {
      var creators = Array.from(new Set(tasks.map(function (task) { return String(task.createdBy || ''); }).filter(Boolean)));
      return [{ value: '', label: 'Todas as pessoas' }].concat(creators.map(function (id) {
        var task = tasks.find(function (item) { return String(item.createdBy) === id; });
        return { value: id, label: task ? getTaskCreatorName(task, state) : 'Colaborador' };
      }));
    }
    return [];
  }

  function taskFilterControl(key, state) {
    var type = taskFilterTypes.find(function (item) { return item.id === key; });
    if (!type) return '';
    var value = taskFilterValues[key] || {};
    var control = '';
    if (key === 'dueDate' || key === 'createdDate' || key === 'endDate') {
      var prefix = key === 'dueDate' ? 'due' : key === 'createdDate' ? 'created' : 'end';
      control = '<div class="task-filter-date-range"><label>De<input id="task-' + prefix +
        '-from" type="date" value="' + escapeHtml(value.from || '') + '"></label><label>Até<input id="task-' + prefix +
        '-to" type="date" value="' + escapeHtml(value.to || '') + '"></label></div>';
    } else {
      var id = key === 'project' ? 'task-project-filter' : key === 'status' ? 'task-status-filter' :
        key === 'priority' ? 'task-priority-filter' : key === 'assignee' ? 'task-assignee-filter' :
          key === 'tags' ? 'task-tags-filter' : key === 'archived' ? 'task-archived-filter' :
            key === 'commentAssigned' ? 'task-comment-assigned-filter' : 'task-created-by-filter';
      var selectValue = typeof value === 'string' ? value : '';
      var options = taskFilterValuesForOptions(key, state);
      if (key === 'project') options.unshift({ value: '', label: 'Somente tarefas com projeto' });
      control = '<select id="' + id + '" aria-label="' + escapeHtml(type.label) + '">' +
        filterOptions(options, selectValue) + '</select>';
    }
    return '<div class="task-selected-filter" data-selected-task-filter="' + key + '"><span class="task-selected-filter-label">' +
      '<span aria-hidden="true">' + type.icon + '</span>' + escapeHtml(type.label) + '</span>' + control +
      '<button type="button" class="task-remove-filter" data-remove-task-filter="' + key +
      '" aria-label="Remover filtro ' + escapeHtml(type.label) + '" title="Remover filtro">×</button></div>';
  }

  function renderActiveTaskFilters(state) {
    var root = document.getElementById('task-selected-filters');
    if (root) root.innerHTML = activeTaskFilterKeys.map(function (key) {
      return taskFilterControl(key, state);
    }).join('');
    var optionsRoot = document.getElementById('task-filter-options');
    if (optionsRoot) {
      var search = document.getElementById('task-filter-search');
      var query = search ? search.value.trim().toLocaleLowerCase('pt-BR') : '';
      optionsRoot.innerHTML = taskFilterTypes.filter(function (type) {
        return activeTaskFilterKeys.indexOf(type.id) === -1 &&
          type.label.toLocaleLowerCase('pt-BR').indexOf(query) !== -1;
      }).map(function (type) {
        return '<button type="button" class="task-filter-option" data-add-task-filter="' + type.id + '">' +
          '<span aria-hidden="true">' + type.icon + '</span><span>' + escapeHtml(type.label) + '</span></button>';
      }).join('') || '<p class="task-filter-no-options">Nenhum filtro encontrado.</p>';
    }
  }

  function filterControlValue(id) {
    var control = document.getElementById(id);
    return control ? control.value : '';
  }

  function readTaskFilterValues() {
    activeTaskFilterKeys.forEach(function (key) {
      if (key === 'dueDate' || key === 'createdDate' || key === 'endDate') {
        var prefix = key === 'dueDate' ? 'due' : key === 'createdDate' ? 'created' : 'end';
        taskFilterValues[key] = {
          from: filterControlValue('task-' + prefix + '-from'),
          to: filterControlValue('task-' + prefix + '-to')
        };
        return;
      }
      var id = key === 'project' ? 'task-project-filter' : key === 'status' ? 'task-status-filter' :
        key === 'priority' ? 'task-priority-filter' : key === 'assignee' ? 'task-assignee-filter' :
          key === 'tags' ? 'task-tags-filter' : key === 'archived' ? 'task-archived-filter' :
            key === 'commentAssigned' ? 'task-comment-assigned-filter' : 'task-created-by-filter';
      taskFilterValues[key] = filterControlValue(id);
    });
  }

  function renderBoard(state) {
    renderActiveTaskFilters(state);
    var tasks = getRealTasks(state).filter(function (task) { return !taskParentId(task); });
    var search = document.getElementById('task-search');
    var searchTerm = search ? search.value.trim().toLocaleLowerCase() : '';
    var projectId = activeTaskFilterKeys.indexOf('project') !== -1 ? filterControlValue('task-project-filter') : '';
    var statusFilter = document.getElementById('task-status-filter');
    var priorityFilter = document.getElementById('task-priority-filter');
    var assigneeFilter = document.getElementById('task-assignee-filter');
    var dueFromFilter = document.getElementById('task-due-from');
    var dueToFilter = document.getElementById('task-due-to');
    var createdFromFilter = document.getElementById('task-created-from');
    var createdToFilter = document.getElementById('task-created-to');
    var endFromFilter = document.getElementById('task-end-from');
    var endToFilter = document.getElementById('task-end-to');
    var archivedFilter = document.getElementById('task-archived-filter');
    var tagsFilter = document.getElementById('task-tags-filter');
    var commentAssignedFilter = document.getElementById('task-comment-assigned-filter');
    var createdByFilter = document.getElementById('task-created-by-filter');
    var today = dateKey(new Date());
    var filtered = tasks.filter(function (task) {
      var names = getTaskAssigneeNames(task, state);
      var matchesSearch = !searchTerm || [task.title, task.description, names.join(' ')]
        .join(' ').toLocaleLowerCase().indexOf(searchTerm) !== -1;
        var matchesProject = projectId === '__all_projects__' || projectId === '__no_project__'
        ? projectId === '__all_projects__' || !task.projectId
        : projectId ? String(task.projectId || '') === projectId : Boolean(task.projectId);
      var matchesStatus = !statusFilter || !statusFilter.value || taskStatus(task) === statusFilter.value;
      var matchesPriority = !priorityFilter || !priorityFilter.value ||
        String(task.priority || 'media').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === priorityFilter.value;
      var matchesAssignee = !assigneeFilter || !assigneeFilter.value || names.some(function (name) {
        return name.toLocaleLowerCase('pt-BR') === assigneeFilter.value.toLocaleLowerCase('pt-BR');
      });
      var dueDate = task.dueDate ? String(task.dueDate).slice(0, 10) : '';
      var createdDate = task.createdAt ? String(task.createdAt).slice(0, 10) : '';
      var endDate = task.completedAt ? String(task.completedAt).slice(0, 10) : '';
      var matchesDue = (!dueFromFilter || !dueFromFilter.value || dueDate && dueDate >= dueFromFilter.value) &&
        (!dueToFilter || !dueToFilter.value || dueDate && dueDate <= dueToFilter.value);
      var matchesCreated = (!createdFromFilter || !createdFromFilter.value || createdDate && createdDate >= createdFromFilter.value) &&
        (!createdToFilter || !createdToFilter.value || createdDate && createdDate <= createdToFilter.value);
      var matchesEnd = (!endFromFilter || !endFromFilter.value || endDate && endDate >= endFromFilter.value) &&
        (!endToFilter || !endToFilter.value || endDate && endDate <= endToFilter.value);
      var archivedValue = archivedFilter ? archivedFilter.value : 'active';
      var matchesArchived = archivedValue === 'all' ||
        (archivedValue === 'archived' ? isTaskArchived(task) : !isTaskArchived(task));
      var taskTags = (Array.isArray(task.tags) ? task.tags : []).map(function (tag) {
        return String(typeof tag === 'string' ? tag : tag && (tag.name || tag.label) || '');
      });
      var matchesTags = !tagsFilter || !tagsFilter.value || taskTags.indexOf(tagsFilter.value) !== -1;
      var hasAssignedComment = (state.taskComments || []).some(function (comment) {
        return String(comment.taskId) === String(task.id) &&
          Boolean(comment.assignedTo || comment.assigned_to || comment.assignedUserId || comment.assigned_user_id);
      });
      var matchesCommentAssigned = !commentAssignedFilter || !commentAssignedFilter.value ||
        (commentAssignedFilter.value === 'yes' ? hasAssignedComment : !hasAssignedComment);
      var matchesCreator = !createdByFilter || !createdByFilter.value ||
        String(task.createdBy || '') === createdByFilter.value;
      var matchesView = activeTaskViewFilter === 'all' ||
        (activeTaskViewFilter === 'mine' && isTaskAssignedToCurrentUser(task, state)) ||
        (activeTaskViewFilter === 'today' && task.dueDate === today) ||
        (activeTaskViewFilter === 'overdue' && task.dueDate && task.dueDate < today && taskStatus(task) !== 'concluida') ||
        (activeTaskViewFilter === 'waiting' && taskStatus(task) === 'aguardando-terceiros');
      return matchesSearch && matchesProject && matchesStatus && matchesPriority && matchesAssignee &&
        matchesDue && matchesCreated && matchesEnd && matchesArchived && matchesTags &&
        matchesCommentAssigned && matchesCreator && matchesView;
    });
    updateTaskFilterCount();
    updateAssigneeFilter(tasks, state);
    var board = document.getElementById('task-kanban-board');
    if (!board) return;
    board.classList.toggle('is-list-view', activeTaskView === 'list');
    board.classList.toggle('is-table-view', activeTaskView === 'table');
    var viewToggle = document.getElementById('task-view-toggle');
    if (viewToggle) viewToggle.querySelectorAll('[data-task-view]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.taskView === activeTaskView));
    });
    if (activeTaskView === 'list') {
      board.innerHTML = filtered.length ? '<div class="task-compact-list" role="list"><div class="task-compact-header" aria-hidden="true"><span>Tarefa</span><span>Criador</span><span>Período</span><span>Prioridade</span><span>Estado</span></div>' + filtered
        .slice().sort(function (a, b) { return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31')); })
        .map(function (task) { return renderTaskListGroup(task, state); }).join('') + '</div>' :
        '<p class="task-empty-column task-all-projects-empty">Nenhuma tarefa corresponde aos filtros.</p>';
      return;
    }
    if (activeTaskView === 'table') {
      board.innerHTML = filtered.length ? renderTaskTable(filtered, state) :
        '<p class="task-empty-column task-all-projects-empty">Nenhuma tarefa corresponde aos filtros.</p>';
      return;
    }
    if (projectId && projectId !== '__no_project__' && projectId !== '__all_projects__') {
      var selectedProject = (state.projects || []).find(function (item) {
        return String(item.id) === String(projectId);
      });
      board.innerHTML = '<div class="task-project-task-group">' +
        '<div class="task-project-task-heading"><h2>' + escapeHtml(selectedProject && selectedProject.name || 'Projeto') + '</h2></div>' +
        '<div class="task-kanban-board">' + renderKanbanColumns(filtered, selectedProject, true) + '</div></div>';
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
      var groupProject = projects.find(function (project) { return String(project.id) === String(group.id); }) || { id: group.id };
      var isCollapsed = getCollapsedTaskGroups().indexOf(String(group.id || 'no-project')) !== -1;
      return '<section class="task-project-task-group' + (isCollapsed ? ' is-collapsed' : '') + '" data-project-group="' + escapeHtml(group.id || 'no-project') + '">' +
        '<button type="button" class="task-project-task-heading" data-toggle-project-group aria-expanded="' + String(!isCollapsed) + '">' +
        '<span class="task-project-group-chevron" aria-hidden="true">⌄</span><h2>' +
        escapeHtml(group.name) + '</h2><span>' + group.tasks.length + ' tarefas</span></button>' +
        '<div class="task-kanban-board task-kanban-board--all-projects"' + (isCollapsed ? ' hidden' : '') + '>' +
        renderKanbanColumns(group.tasks, groupProject, false) + '</div></section>';
    }).join('') : '<p class="task-empty-column task-all-projects-empty">Nenhuma tarefa corresponde aos filtros.</p>';
  }

  function renderTaskListItem(task, state, isSubtask) {
    var status = taskStatus(task);
    var statusLabel = statuses.find(function (item) { return item.id === status; });
    var priority = String(task.priority || 'media').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var priorityLabel = priority === 'alta' ? 'Alta' : priority === 'baixa' ? 'Baixa' : 'Média';
    return '<button type="button" class="task-compact-row' + (isSubtask ? ' is-subtask' : '') + '" data-open-task="' + escapeHtml(task.id) + '" role="listitem">' +
      '<strong>' + escapeHtml(task.title || 'Tarefa sem título') + '</strong><span>' + escapeHtml(getTaskCreatorName(task, state)) +
      '</span><time>' + escapeHtml(formatTaskDateRange(task)) + '</time><span class="task-card-priority task-card-priority--' +
      priority + '">◆ ' + priorityLabel + '</span><span class="task-card-state">● ' + escapeHtml(statusLabel && statusLabel.label || 'Pendente') +
      '</span></button>';
  }

  function renderTaskTableRow(task, state, isSubtask) {
    var project = (state.projects || []).find(function (item) { return String(item.id) === String(task.projectId); });
    var status = taskStatus(task);
    var statusLabel = statuses.find(function (item) { return item.id === status; });
    var priority = String(task.priority || 'media').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var priorityLabel = priority === 'alta' ? 'Alta' : priority === 'baixa' ? 'Baixa' : 'Média';
    return '<button type="button" class="task-table-row' + (isSubtask ? ' is-subtask' : '') +
      '" data-open-task="' + escapeHtml(task.id) + '" role="row">' +
      '<span class="task-table-name" role="cell"><span class="task-table-status-dot task-table-status-dot--' + status +
      '" aria-hidden="true"></span><strong>' + escapeHtml(task.title || 'Tarefa sem título') + '</strong></span>' +
      '<span role="cell">' + escapeHtml(project && project.name || '—') + '</span>' +
      '<span role="cell">' + escapeHtml(getTaskCreatorName(task, state)) + '</span>' +
      '<span role="cell">' + escapeHtml(getTaskAssigneeNames(task, state).join(', ') || '—') + '</span>' +
      '<span role="cell">' + escapeHtml(formatDate(task.dueDate)) + '</span>' +
      '<span role="cell"><span class="task-card-priority task-card-priority--' + priority + '">⚑ ' + priorityLabel + '</span></span>' +
      '<span role="cell"><span class="task-card-state task-card-state--' + status + '">' +
      escapeHtml(statusLabel && statusLabel.label || 'Pendente') + '</span></span></button>';
  }

  function renderTaskTableGroup(task, state) {
    var subtasks = getRealTasks(state).filter(function (candidate) {
      return taskParentId(candidate) === String(task.id);
    }).sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    return '<div class="task-table-group">' + renderTaskTableRow(task, state, false) +
      (subtasks.length ? '<div class="task-table-subtasks">' + subtasks.map(function (subtask) {
        return renderTaskTableRow(subtask, state, true);
      }).join('') + '</div>' : '') + '</div>';
  }

  function renderTaskTable(tasks, state) {
    var sorted = tasks.slice().sort(function (a, b) {
      return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
    });
    return '<div class="task-table" role="table" aria-label="Tabela de tarefas"><div class="task-table-header" role="row">' +
      ['Tarefa', 'Projeto', 'Criador', 'Responsável', 'Vencimento', 'Prioridade', 'Status'].map(function (label) {
        return '<span role="columnheader">' + label + '</span>';
      }).join('') + '</div><div class="task-table-body" role="rowgroup">' +
      sorted.map(function (task) { return renderTaskTableGroup(task, state); }).join('') + '</div></div>';
  }

  function updateTaskFilterCount() {
    var count = document.querySelector('[data-task-filter-count]');
    if (count) count.textContent = activeTaskFilterKeys.length ? String(activeTaskFilterKeys.length) : '';
  }

  function renderTaskListGroup(task, state) {
    var subtasks = getRealTasks(state).filter(function (candidate) {
      return taskParentId(candidate) === String(task.id);
    }).sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    return '<div class="task-list-group">' + renderTaskListItem(task, state, false) +
      (subtasks.length ? '<div class="task-list-subtasks">' + subtasks.map(function (subtask) {
        return renderTaskListItem(subtask, state, true);
      }).join('') + '</div>' : '') + '</div>';
  }

  function updateAssigneeFilter(tasks, state) {
    var select = document.getElementById('task-assignee-filter');
    if (!select) return;
    var selected = select.value;
    var names = Array.from(new Set(tasks.reduce(function (all, task) {
      return all.concat(getTaskAssigneeNames(task, state));
    }, []))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    select.innerHTML = '<option value="">Todas as pessoas</option>' + names.map(function (name) {
      return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    }).join('');
    select.value = selected;
  }

  function getCollapsedTaskGroups() {
    try {
      return JSON.parse(localStorage.getItem('rildonx.task.collapsed-projects') || '[]');
    } catch (error) {
      console.error('Não foi possível ler os grupos recolhidos de tarefas:', error);
      return [];
    }
  }

  function saveCollapsedTaskGroups(groups) {
    try {
      localStorage.setItem('rildonx.task.collapsed-projects', JSON.stringify(groups));
    } catch (error) {
      console.error('Não foi possível salvar os grupos recolhidos de tarefas:', error);
      notify('Não foi possível salvar essa preferência neste navegador.');
    }
  }

  function getSavedFiltersKey() {
    return 'rildonx.task.saved-filters.' + String(currentUserId || 'guest');
  }

  function getSavedTemplatesKey() {
    return 'rildonx.task.request-templates.' + String(currentUserId || 'guest');
  }

  function getSavedFilters() {
    if (currentUserId && taskPreferencesLoaded) return taskPreferences.savedFilters;
    try {
      return JSON.parse(localStorage.getItem(getSavedFiltersKey()) || '[]');
    } catch (error) {
      console.error('Não foi possível ler os filtros salvos:', error);
      return [];
    }
  }

  function saveSavedFilters(filters) {
    taskPreferences.savedFilters = filters;
    try {
      localStorage.setItem(getSavedFiltersKey(), JSON.stringify(filters));
      renderSavedFilters();
    } catch (error) {
      console.error('Não foi possível salvar o filtro:', error);
      notify('Não foi possível salvar o filtro neste navegador.');
      return;
    }
    persistTaskPreferences();
  }

  function renderSavedFilters() {
    var select = document.getElementById('task-saved-filter');
    if (!select) return;
    var selected = select.value;
    select.innerHTML = '<option value="">Filtros salvos</option>' + getSavedFilters().map(function (filter, index) {
      return '<option value="' + index + '">' + escapeHtml(filter.name) + '</option>';
    }).join('');
    if (selected) select.value = selected;
  }

  function getRequestTemplates() {
    if (taskPreferencesLoaded || !currentUserId) {
      return Array.isArray(taskPreferences.requestTemplates) ? taskPreferences.requestTemplates : [];
    }
    try {
      return JSON.parse(localStorage.getItem(getSavedTemplatesKey()) || '[]');
    } catch (error) {
      console.error('Não foi possível ler os modelos salvos:', error);
      return [];
    }
  }

  function renderRequestTemplates() {
    var select = document.getElementById('nt-template');
    if (!select) return;
    var selected = select.value;
    var customTemplates = getRequestTemplates().map(function (template, index) {
      return '<option value="custom:' + index + '">' + escapeHtml(template.name) + '</option>';
    }).join('');
    select.innerHTML = '<option value="">Tarefa em branco</option><option value="request">Solicitação geral</option>' +
      '<option value="content">Conteúdo e criação</option><option value="support">Suporte interno</option>' + customTemplates;
    select.value = selected;
    renderTemplateFields(selected);
  }

  function templateDefinition(templateId) {
    var builtins = {
      request: { fields: ['Solicitante', 'Contexto', 'Resultado esperado'], criteria: ['Resultado validado por quem solicitou'] },
      content: { fields: ['Canal', 'Público-alvo', 'Formato', 'Prazo de publicação'], criteria: ['Conteúdo revisado e aprovado', 'Arquivos finais anexados'] },
      support: { fields: ['Sistema ou equipamento', 'Impacto', 'Passos para reproduzir'], criteria: ['Solicitante confirma a resolução'] }
    };
    if (builtins[templateId]) return builtins[templateId];
    if (templateId.indexOf('custom:') === 0) return getRequestTemplates()[Number(templateId.slice(7))] || null;
    return null;
  }

  function renderTemplateFields(templateId) {
    var root = document.getElementById('nt-template-fields');
    if (!root) return;
    var template = templateDefinition(templateId);
    if (!template) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;
    root.innerHTML = '<div class="task-request-template-fields">' + (template.fields || []).map(function (field, index) {
      return '<label>' + escapeHtml(field) + '<input type="text" data-request-field="' + index + '" data-request-field-name="' +
        escapeHtml(field) + '"></label>';
    }).join('') + '<label>Critérios de aceite (um por linha)<textarea id="nt-acceptance" rows="2">' +
      escapeHtml((template.criteria || []).join('\n')) + '</textarea></label></div>';
  }

  function persistTaskPreferences() {
    if (!currentUserId || !window.supabaseClient || !window.supabaseClient.from) return Promise.resolve();
    return window.supabaseClient.from('task_user_preferences').upsert({
      user_id: currentUserId,
      saved_filters: taskPreferences.savedFilters || [],
      request_templates: taskPreferences.requestTemplates || []
    }, { onConflict: 'user_id' }).then(function (result) {
      if (result.error) throw result.error;
    }).catch(function (error) {
      console.error('Não foi possível sincronizar as preferências de tarefas:', error);
      notify('As preferências ficaram salvas neste navegador, mas não foram sincronizadas com sua conta.');
    });
  }

  async function loadTaskPreferences() {
    if (!currentUserId || !window.supabaseClient || !window.supabaseClient.from) return;
    try {
      var result = await window.supabaseClient.from('task_user_preferences')
        .select('saved_filters,request_templates').eq('user_id', currentUserId).maybeSingle();
      if (result.error) throw result.error;
      taskPreferences = {
        savedFilters: result.data && Array.isArray(result.data.saved_filters) ? result.data.saved_filters : [],
        requestTemplates: result.data && Array.isArray(result.data.request_templates) ? result.data.request_templates : []
      };
      if (!result.data) {
        taskPreferences.savedFilters = JSON.parse(localStorage.getItem(getSavedFiltersKey()) || '[]');
        taskPreferences.requestTemplates = JSON.parse(localStorage.getItem(getSavedTemplatesKey()) || '[]');
      }
      taskPreferencesLoaded = true;
      localStorage.setItem(getSavedFiltersKey(), JSON.stringify(taskPreferences.savedFilters));
      localStorage.setItem(getSavedTemplatesKey(), JSON.stringify(taskPreferences.requestTemplates));
      renderSavedFilters();
      renderRequestTemplates();
      if (!result.data && (taskPreferences.savedFilters.length || taskPreferences.requestTemplates.length)) {
        persistTaskPreferences();
      }
    } catch (error) {
      console.error('Não foi possível carregar as preferências de tarefas:', error);
      notify('Não foi possível sincronizar suas preferências. As cópias locais continuam disponíveis.');
    }
  }

  function saveCurrentTemplate() {
    var select = document.getElementById('nt-template');
    var current = select && templateDefinition(select.value);
    var fields = current ? current.fields.slice() : [];
    var acceptance = document.getElementById('nt-acceptance');
    var criteria = acceptance ? acceptance.value.split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean) : [];
    if (!fields.length) {
      notify('Escolha um modelo de solicitação antes de salvá-lo como modelo.');
      return;
    }
    var name = window.prompt('Nome para este modelo:');
    if (!name || !name.trim()) return;
    taskPreferences.requestTemplates = getRequestTemplates().concat({
      name: name.trim(),
      fields: fields,
      criteria: criteria
    });
    renderRequestTemplates();
    persistTaskPreferences();
    notify('Modelo de solicitação salvo.');
  }

  function mapRecurringTaskRow(row) {
    var metadata = row.task_metadata || row.metadata || {};
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        console.error('Os metadados da ocorrência recorrente são inválidos:', error);
        metadata = {};
      }
    }
    return {
      id: row.id,
      title: row.title || 'Tarefa sem título',
      status: row.status || 'pendente',
      priority: row.priority || 'media',
      dueDate: row.due_date || null,
      assignees: Array.isArray(row.assignees) ? row.assignees : [],
      viewerIds: Array.isArray(row.viewer_ids) ? row.viewer_ids : [],
      createdBy: row.created_by || null,
      completedAt: row.completed_at || null,
      projectId: row.project_id || null,
      description: row.description || '',
      startDate: row.start_date || null,
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      position: Number(row.position) || 0,
      sector: row.sector || 'marketing',
      tags: Array.isArray(row.tags) ? row.tags : [],
      metadata: metadata,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || row.created_at || null,
      isDemo: false
    };
  }

  async function materializeDueRecurringTasks() {
    if (recurrenceCheckRunning || !window.RildonXStore) return;
    recurrenceCheckRunning = true;
    var createdCount = 0;
    try {
      var candidates = getRealTasks(getStoreState()).filter(function (task) {
        var recurrence = taskMetadata(task).recurrence;
        return isTaskCreator(task) && recurrence && recurrence.frequency &&
          recurrence.nextOccurrenceDate && recurrence.nextOccurrenceDate <= dateKey(new Date());
      });
      for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        var current = candidates[candidateIndex];
        var iterations = 0;
        while (iterations < 100) {
          var metadata = taskMetadata(current);
          var recurrence = metadata.recurrence;
          var occurrenceDate = recurrence && recurrence.nextOccurrenceDate;
          if (!occurrenceDate || occurrenceDate > dateKey(new Date())) break;
          var nextDate = nextRecurrenceDate(occurrenceDate, recurrence.frequency);
          if (!nextDate) throw new Error('A frequência desta tarefa recorrente não é válida.');
          if (window.supabaseClient && window.supabaseClient.rpc &&
              /^[0-9a-f-]{36}$/i.test(String(current.id))) {
            var result = await window.supabaseClient.rpc('rildonx_generate_recurring_task', {
              p_task_id: current.id
            });
            if (result.error) throw result.error;
            var row = Array.isArray(result.data) ? result.data[0] : result.data;
            if (!row) break;
            current = mapRecurringTaskRow(row);
            var currentTasks = getStoreState().tasks || [];
            if (!currentTasks.some(function (item) { return String(item.id) === String(current.id); })) {
              window.RildonXStore.setState({ tasks: currentTasks.concat(current) });
            } else {
              window.RildonXStore.updateTask(current.id, current);
            }
          } else {
            var nextMetadata = Object.assign({}, metadata, {
              recurrence: Object.assign({}, recurrence, {
                occurrenceDate: occurrenceDate,
                occurrenceKey: String(recurrence.seriesId || current.id) + ':' + occurrenceDate,
                nextOccurrenceDate: nextDate
              })
            });
            var occurrenceKey = nextMetadata.recurrence.occurrenceKey;
            var existing = getRealTasks(getStoreState()).find(function (item) {
              return taskMetadata(item).recurrence && taskMetadata(item).recurrence.occurrenceKey === occurrenceKey;
            });
            if (existing) {
              current = existing;
              break;
            }
            window.RildonXStore.updateTask(current.id, {
              metadata: Object.assign({}, metadata, {
                recurrence: Object.assign({}, recurrence, { nextOccurrenceDate: nextDate })
              })
            });
            current = window.RildonXStore.addTask(Object.assign({}, current, {
              id: createTaskId(),
              status: 'pendente',
              dueDate: occurrenceDate,
              completedAt: null,
              position: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: nextMetadata
            }));
          }
          createdCount += 1;
          iterations += 1;
        }
        if (iterations === 100 && taskMetadata(current).recurrence.nextOccurrenceDate <= dateKey(new Date())) {
          notify('Há mais de 100 ocorrências atrasadas nesta série. O restante será gerado na próxima abertura.');
        }
      }
      if (createdCount) notify(createdCount + ' ocorrência' + (createdCount === 1 ? '' : 's') + ' recorrente' +
        (createdCount === 1 ? ' criada.' : 's criadas.'));
    } catch (error) {
      console.error('Não foi possível gerar uma ocorrência recorrente:', error);
      notify(error.message || 'Não foi possível gerar as ocorrências recorrentes.');
    } finally {
      recurrenceCheckRunning = false;
    }
  }

  function captureTaskFilters() {
    readTaskFilterValues();
    return {
      activeTypes: activeTaskFilterKeys.slice(),
      values: Object.assign({}, taskFilterValues),
      project: taskFilterValues.project || '',
      status: taskFilterValues.status || '',
      priority: taskFilterValues.priority || '',
      assignee: taskFilterValues.assignee || '',
      dueFrom: taskFilterValues.dueDate && taskFilterValues.dueDate.from || '',
      dueTo: taskFilterValues.dueDate && taskFilterValues.dueDate.to || '',
      createdFrom: taskFilterValues.createdDate && taskFilterValues.createdDate.from || '',
      createdTo: taskFilterValues.createdDate && taskFilterValues.createdDate.to || '',
      archived: taskFilterValues.archived || 'active',
      search: document.getElementById('task-search').value,
      view: activeTaskViewFilter
    };
  }

  function applyTaskFilters(filters) {
    taskFilterValues = filters.values && typeof filters.values === 'object'
      ? Object.assign({}, filters.values)
      : {
        project: filters.project || '',
        status: filters.status || '',
        priority: filters.priority || '',
        assignee: filters.assignee || '',
        dueDate: { from: filters.dueFrom || '', to: filters.dueTo || '' },
        createdDate: { from: filters.createdFrom || '', to: filters.createdTo || '' },
        archived: filters.archived || 'active'
      };
    activeTaskFilterKeys = Array.isArray(filters.activeTypes) ? filters.activeTypes.slice() : [];
    if (!Array.isArray(filters.activeTypes)) {
      if (filters.project || filters.project === '__no_project__') activeTaskFilterKeys.push('project');
      if (filters.status) activeTaskFilterKeys.push('status');
      if (filters.priority) activeTaskFilterKeys.push('priority');
      if (filters.assignee) activeTaskFilterKeys.push('assignee');
      if (filters.dueFrom || filters.dueTo || filters.due) {
        activeTaskFilterKeys.push('dueDate');
        taskFilterValues.dueDate = { from: filters.dueFrom || '', to: filters.dueTo || filters.due || '' };
      }
      if (filters.createdFrom || filters.createdTo) activeTaskFilterKeys.push('createdDate');
      if (filters.archived && filters.archived !== 'active') activeTaskFilterKeys.push('archived');
    }
    document.getElementById('task-search').value = filters.search || '';
    activeTaskViewFilter = filters.view || 'all';
    renderActiveTaskFilters(getStoreState());
    updateTaskViewButtons();
    renderBoard(getStoreState());
  }

  function updateTaskViewButtons() {
    var group = document.getElementById('task-quick-views');
    if (group) group.querySelectorAll('[data-task-quick-view]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.taskQuickView === activeTaskViewFilter));
    });
  }

  function bindRequestTemplateControls() {
    document.addEventListener('change', function (event) {
      if (event.target.id === 'nt-template') renderTemplateFields(event.target.value);
    });
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-save-task-template]')) saveCurrentTemplate();
    });
  }

  function renderKanbanColumns(tasks, project, includeBacklog) {
    var backlog = includeBacklog && project ? renderProjectBacklog(project) : '';
    var collapsedColumns = getCollapsedTaskColumns();
    return backlog + statuses.map(function (column) {
      var cards = tasks.filter(function (task) { return taskStatus(task) === column.id; })
        .sort(function (a, b) {
          var positionDiff = Number(a.position || 0) - Number(b.position || 0);
          return positionDiff || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      var columnKey = String(project && project.id || 'no-project') + ':' + column.id;
      var isCollapsed = collapsedColumns.indexOf(columnKey) !== -1;
      return '<section class="task-kanban-column task-kanban-column--' + column.id + (isCollapsed ? ' is-collapsed' : '') +
        '" data-task-status="' + column.id + '" data-task-column-key="' + escapeHtml(columnKey) + '">' +
        '<header><div class="task-kanban-column-title"><span class="task-column-status-dot" aria-hidden="true"></span><h2>' + column.label + '</h2><span>' + cards.length + '</span></div>' +
        '<div class="task-kanban-column-actions"><button type="button" class="task-add-card-button" data-add-task-stage="' + column.id + '"' +
        (project && project.id ? ' data-project-id="' + escapeHtml(project.id) + '"' : '') +
        ' aria-label="Adicionar tarefa em ' + column.label + '" title="Adicionar tarefa"><span aria-hidden="true">+</span></button>' +
        '<button type="button" class="task-column-collapse" data-toggle-task-column aria-expanded="' + String(!isCollapsed) +
        '" aria-label="' + (isCollapsed ? 'Expandir coluna ' : 'Recolher coluna ') + column.label + '" title="' +
        (isCollapsed ? 'Expandir coluna' : 'Recolher coluna') + '"><span aria-hidden="true">⌄</span></button></div></header>' +
        '<div class="task-kanban-dropzone" data-task-dropzone="' + column.id + '"' + (isCollapsed ? ' hidden' : '') + '>' +
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

  function renderProjectFilters(state) {
    var filter = document.getElementById('task-project-filter');
    var createSelect = document.getElementById('nt-projeto');
    var projects = (state.projects || []).filter(function (project) { return project && project.isDemo !== true; });
    if (filter) {
      var selected = filter.value;
      filter.innerHTML = '<option value="">Todos os projetos</option><option value="__no_project__">Sem projeto</option>' + projects.map(function (project) {
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
    var metadata = taskMetadata(task);
    var acceptedCriteria = Array.isArray(metadata.acceptanceCriteria) ? metadata.acceptanceCriteria.join('\n') : '';
    var dependencyIds = taskDependencies(task);
    var subtasks = getRealTasks(state).filter(function (candidate) {
      return taskParentId(candidate) === String(task.id);
    }).sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    var dependencies = (state.tasks || []).filter(function (candidate) {
      return String(candidate.id) !== String(task.id) && candidate.isDemo !== true;
    });
    var recurrence = metadata.recurrence && typeof metadata.recurrence === 'object' ? metadata.recurrence : {};
    var source = metadata.source && typeof metadata.source === 'object' ? metadata.source : null;
    var sourceAttachments = source && Array.isArray(source.attachments) ? source.attachments : [];
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
      '<form class="task-detail-form"><div class="task-detail-fields task-detail-primary-fields"><label>Título<input name="title" value="' + escapeHtml(task.title) + '" required></label>' +
      '<label>Início<input name="startDate" type="date" value="' + escapeHtml(task.startDate || '') + '"></label>' +
      '<label>Prazo<input name="dueDate" type="date" value="' + escapeHtml(task.dueDate || '') + '"></label>' +
      '<label>Prioridade<select name="priority"><option value="baixa"' + (String(task.priority).toLowerCase() === 'baixa' ? ' selected' : '') + '>Baixa</option>' +
      '<option value="media"' + (!task.priority || ['media', 'média'].indexOf(String(task.priority).toLowerCase()) !== -1 ? ' selected' : '') + '>Média</option>' +
      '<option value="alta"' + (String(task.priority).toLowerCase() === 'alta' ? ' selected' : '') + '>Alta</option></select></label>' +
      '<label>Estado<select name="status">' + statuses.map(function (status) {
        return '<option value="' + status.id + '"' + (taskStatus(task) === status.id ? ' selected' : '') + '>' + status.label + '</option>';
      }).join('') + '</select></label></div>' +
      '<label class="task-detail-description">Descrição<textarea name="description" rows="3">' + escapeHtml(task.description || '') + '</textarea></label>' +
      '<div class="task-detail-section task-subtasks-section"><div class="task-detail-section-head"><h3>Subtarefas <span class="task-subtask-count">' +
      subtasks.length + '</span></h3>' +
      (isTaskCreator(task) && !taskParentId(task) ? '<div class="task-subtask-create"><input type="text" data-subtask-title maxlength="160" placeholder="Nome da subtarefa" aria-label="Nome da subtarefa">' +
        '<button type="button" class="task-subtask-add" data-create-subtask aria-label="Adicionar subtarefa" title="Adicionar subtarefa">+</button></div>' : '') +
      '</div>' +
      (subtasks.length ? '<div class="task-detail-subtask-list">' + subtasks.map(function (subtask) {
        var subtaskStatus = taskStatus(subtask);
        var subtaskStatusLabel = statuses.find(function (item) { return item.id === subtaskStatus; });
        return '<button type="button" class="task-detail-subtask" data-open-subtask="' + escapeHtml(subtask.id) + '">' +
          '<span class="task-subtask-dot task-subtask-dot--' + subtaskStatus + '" aria-hidden="true"></span>' +
          '<span class="task-detail-subtask-title">' + escapeHtml(subtask.title || 'Subtarefa sem título') + '</span>' +
          '<span class="task-detail-subtask-state">' + escapeHtml(subtaskStatusLabel && subtaskStatusLabel.label || 'Pendente') + '</span></button>';
      }).join('') + '</div>' : '<p class="task-detail-muted">Divida esta tarefa em etapas menores.</p>') + '</div>' +
      (source ? '<div class="task-detail-section task-origin-section"><h3>Origem</h3>' +
        (source.href ? '<a href="' + escapeHtml(source.href) + '" target="_blank" rel="noopener noreferrer">' : '<span>') +
        escapeHtml(source.label || source.title || 'Conteúdo convertido em tarefa') +
        (source.href ? '</a>' : '</span>') +
        (sourceAttachments.length ? '<ul>' + sourceAttachments.map(function (file) {
          var fileId = file && typeof file === 'object' ? file.id || file.documentId : file;
          var fileName = file && typeof file === 'object' ? file.name || file.fileName : 'Anexo da origem';
          return '<li>' + (fileId
            ? '<button type="button" data-open-origin-attachment="' + escapeHtml(fileId) + '">' + escapeHtml(fileName) + '</button>'
            : escapeHtml(fileName)) + '</li>';
        }).join('') + '</ul>' : '') + '</div>' : '') +
      '<div class="task-detail-section"><h3>Planejamento</h3><div class="task-detail-fields task-workflow-detail-fields">' +
      '<label>Dependências<select name="dependsOn" multiple aria-describedby="task-dependency-help">' +
      dependencies.map(function (candidate) {
        return '<option value="' + escapeHtml(candidate.id) + '"' + (dependencyIds.indexOf(String(candidate.id)) !== -1 ? ' selected' : '') + '>' +
          escapeHtml(candidate.title || 'Tarefa sem título') + '</option>';
      }).join('') + '</select></label><label>Recorrência<select name="recurrence"><option value="">Não se repete</option>' +
      '<option value="daily"' + (recurrence.frequency === 'daily' ? ' selected' : '') + '>Diária</option>' +
      '<option value="weekly"' + (recurrence.frequency === 'weekly' ? ' selected' : '') + '>Semanal</option>' +
      '<option value="monthly"' + (recurrence.frequency === 'monthly' ? ' selected' : '') + '>Mensal</option></select></label>' +
      '<label>Quem está aguardando<input name="waitingOn" value="' + escapeHtml(metadata.waitingOn || '') + '" placeholder="Pessoa ou equipe externa"></label>' +
      '<label>Motivo do bloqueio<input name="blockedReason" value="' + escapeHtml(metadata.blockedReason || '') + '" placeholder="O que impede o avanço?"></label>' +
      (task.projectId ? '<label>Peso no progresso do projeto<input name="progressWeight" type="number" min="0.1" step="0.1" value="' + escapeHtml(metadata.progressWeight || '') +
        '" placeholder="1"><small>Maior peso representa maior contribuição. Vazio usa peso 1.</small></label>' : '') + '</div>' +
      '<p id="task-dependency-help" class="task-detail-muted">Uma tarefa só pode ser concluída depois das dependências.</p>' +
      '<label class="task-milestone-option"><input name="isMilestone" type="checkbox"' + (metadata.isMilestone ? ' checked' : '') + '> Marco do projeto</label>' +
      '</div>' +
      '<div class="task-detail-section"><h3>Critérios de aceite</h3><textarea name="acceptanceCriteria" rows="3" placeholder="Um critério por linha">' +
      escapeHtml(acceptedCriteria) + '</textarea></div>' +
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
          (fileComments.length ? fileComments.map(function (comment) {
            return renderTaskComment(comment, state, task);
          }).join('') : '<p class="task-detail-muted">Ainda não há comentários neste arquivo.</p>') +
          '</div>' +
          (file.id ? '<div class="task-comment-form"><textarea data-comment-body rows="2" maxlength="2000" placeholder="Comente este arquivo..."></textarea>' +
            '<button type="button" class="btn" data-submit-comment="' + escapeHtml(file.id) + '">Comentar</button></div>' :
            '<p class="task-detail-muted">Reenvie este arquivo para habilitar comentários.</p>') +
          '</section></li>';
      }).join('') + '</ul>' : '<p class="task-detail-muted">Nenhum arquivo anexado.</p>') +
      '</div>' +
      '<footer class="task-detail-footer">' +
      (isTaskCreator(task) ? '<button type="button" class="btn outline-red" data-delete-task>Excluir tarefa</button>' : '') +
      (isTaskCreator(task) ? '<button type="button" class="btn secondary" data-toggle-task-archive>' +
        (isTaskArchived(task) ? 'Restaurar tarefa' : 'Arquivar tarefa') + '</button>' : '') +
      '<button type="button" class="btn secondary" data-close-task>Fechar</button>' +
      '<button type="submit" class="btn">Salvar alterações</button></footer></form></div>';
  }

  function renderTaskComment(comment, state, task) {
    var createdAt = new Date(comment.createdAt);
    var dateLabel = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleString('pt-BR');
    var profiles = state.profiles || [];
    var canAssign = String(task.createdBy) === String(currentUserId) ||
      String(comment.authorId) === String(currentUserId);
    var assignedTo = comment.assignedTo || comment.assigned_to || comment.assignedUserId || comment.assigned_user_id || '';
    var assignedProfile = profiles.find(function (profile) {
      return profile.active !== false && String(profile.id) === String(assignedTo);
    });
    var options = '<option value="">Sem responsável</option>' + profiles.filter(function (profile) {
      return profile.active !== false;
    }).map(function (profile) {
      var name = profile.displayName || profile.nickname || profile.id;
      return '<option value="' + escapeHtml(profile.id) + '"' +
        (String(profile.id) === String(assignedTo) ? ' selected' : '') + '>' + escapeHtml(name) + '</option>';
    }).join('');
    if (assignedTo && !assignedProfile) {
      options += '<option value="' + escapeHtml(assignedTo) + '" selected>Usuário atribuído</option>';
    }
    return '<article class="task-comment"><div class="task-comment-heading"><b>' +
      escapeHtml(comment.authorName || 'Colaborador') + '</b><time>' + escapeHtml(dateLabel) + '</time></div>' +
      '<p>' + escapeHtml(comment.body) + '</p><label class="task-comment-assignee">Atribuir comentário' +
      '<select data-comment-assignee data-comment-id="' + escapeHtml(comment.id) + '"' +
      (canAssign ? '' : ' disabled') + '>' + options + '</select></label></article>';
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
        assignedTo: row.assigned_to || null,
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
    var assigneeSelect = event.target.closest('[data-comment-assignee]');
    if (assigneeSelect) {
      var state = getStoreState();
      var comment = (state.taskComments || []).find(function (item) {
        return String(item.id) === String(assigneeSelect.dataset.commentId);
      });
      var task = (state.tasks || []).find(function (item) {
        return String(item.id) === String(detailOverlay.dataset.taskId);
      });
      if (!comment || !task ||
          (String(task.createdBy) !== String(currentUserId) && String(comment.authorId) !== String(currentUserId))) return;
      var assignedTo = assigneeSelect.value || null;
      try {
        if (/^[0-9a-f-]{36}$/i.test(String(comment.id))) {
          if (!window.supabaseClient || typeof window.supabaseClient.rpc !== 'function') {
            throw new Error('O serviço de atribuição de comentários não está disponível.');
          }
          var assignmentResult = await window.supabaseClient.rpc('rildonx_assign_task_comment', {
            p_comment_id: comment.id,
            p_assigned_to: assignedTo
          });
          if (assignmentResult.error) throw assignmentResult.error;
        }
        window.RildonXStore.setState({
          taskComments: (state.taskComments || []).map(function (item) {
            return String(item.id) === String(comment.id)
              ? Object.assign({}, item, { assignedTo: assignedTo })
              : item;
          })
        });
        renderTaskDetails(task.id);
        notify(assignedTo ? 'Comentário atribuído.' : 'Atribuição removida.');
      } catch (error) {
        console.error('Não foi possível atribuir o comentário:', error);
        notify(error.message || 'Não foi possível atribuir o comentário. Aplique a migração SQL de tarefas.');
        renderTaskDetails(task.id);
      }
      return;
    }
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
    if (event.target.closest('[data-toggle-task-archive]')) {
      var archiveTask = (getStoreState().tasks || []).find(function (item) {
        return String(item.id) === String(detailOverlay.dataset.taskId);
      });
      if (!archiveTask || !isTaskCreator(archiveTask)) {
        notify('Somente o criador pode arquivar ou restaurar esta tarefa.');
        return;
      }
      var nextArchived = !isTaskArchived(archiveTask);
      window.RildonXStore.updateTask(archiveTask.id, {
        metadata: Object.assign({}, taskMetadata(archiveTask), { archived: nextArchived })
      });
      if (detailOverlay) {
        detailOverlay.remove();
        detailOverlay = null;
      }
      notify(nextArchived ? 'Tarefa arquivada.' : 'Tarefa restaurada.');
      return;
    }
    if (event.target.closest('[data-delete-task]')) {
      await deleteTaskFromDetails();
      return;
    }
    var createSubtaskButton = event.target.closest('[data-create-subtask]');
    if (createSubtaskButton) {
      var parentTask = (getStoreState().tasks || []).find(function (item) {
        return String(item.id) === String(detailOverlay.dataset.taskId);
      });
      var subtaskInput = detailOverlay.querySelector('[data-subtask-title]');
      var subtaskTitle = subtaskInput ? subtaskInput.value.trim() : '';
      if (!parentTask || !subtaskTitle || !isTaskCreator(parentTask)) {
        if (subtaskInput && !subtaskTitle) subtaskInput.focus();
        return;
      }
      var state = getStoreState();
      try {
        window.RildonXStore.addTask({
          id: createTaskId(),
          title: subtaskTitle,
          status: 'pendente',
          priority: parentTask.priority || 'media',
          dueDate: null,
          startDate: null,
          description: '',
          assignees: Array.isArray(parentTask.assignees) ? parentTask.assignees.slice() : [],
          viewerIds: Array.isArray(parentTask.viewerIds) ? parentTask.viewerIds.slice() : [],
          createdBy: currentUserId || state.user && state.user.id || parentTask.createdBy || null,
          projectId: parentTask.projectId || null,
          sector: parentTask.sector || state.user && state.user.sector,
          checklist: [],
          attachments: [],
          metadata: { parentTaskId: String(parentTask.id) }
        });
        renderTaskDetails(parentTask.id);
        notify('Subtarefa adicionada.');
      } catch (error) {
        console.error('Não foi possível adicionar a subtarefa:', error);
        notify(error.message || 'Não foi possível adicionar a subtarefa.');
      }
      return;
    }
    var subtaskButton = event.target.closest('[data-open-subtask]');
    if (subtaskButton) {
      openTaskDetails(subtaskButton.dataset.openSubtask);
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
    var originAttachmentButton = event.target.closest('[data-open-origin-attachment]');
    if (originAttachmentButton) {
      var sourceDocument = (getStoreState().documents || []).find(function (documentItem) {
        return String(documentItem.id) === String(originAttachmentButton.dataset.openOriginAttachment);
      });
      if (!sourceDocument) {
        notify('O anexo original não está disponível.');
        return;
      }
      try {
        var sourceUrl = window.RildonXDocumentUpload
          ? await window.RildonXDocumentUpload.getViewUrl(sourceDocument)
          : sourceDocument.url;
        if (!sourceUrl) throw new Error('O anexo original não possui um endereço disponível.');
        window.open(sourceUrl, '_blank', 'noopener');
      } catch (error) {
        console.error('Não foi possível abrir o anexo original:', error);
        notify(error.message || 'Não foi possível abrir o anexo original.');
      }
      return;
    }
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
    if (getRealTasks(getStoreState()).some(function (candidate) {
      return taskParentId(candidate) === String(task.id);
    })) {
      notify('Remova as subtarefas antes de excluir esta tarefa.');
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
      if (files.length > 10) throw new Error('Você pode anexar no máximo 10 arquivos por vez.');
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
    var dependencies = formData.getAll('dependsOn').map(String);
    var state = getStoreState();
    if (dependencyCycle(task.id, dependencies, state.tasks || [])) {
      notify('Essa dependência criaria um ciclo entre tarefas.');
      return;
    }
    var status = String(formData.get('status') || taskStatus(task));
    var hasProgressWeight = formData.has('progressWeight');
    var rawProgressWeight = String(formData.get('progressWeight') || '').trim();
    var progressWeight = rawProgressWeight ? Number(rawProgressWeight) : null;
    if (rawProgressWeight && (!Number.isFinite(progressWeight) || progressWeight <= 0)) {
      notify('O peso no progresso deve ser um número maior que zero.');
      return;
    }
    var proposedTask = Object.assign({}, task, { metadata: Object.assign({}, taskMetadata(task), { dependsOn: dependencies }) });
    if (status === 'concluida') {
      var blockers = incompleteDependencies(proposedTask, state.tasks || []);
      if (blockers.length) {
        notify('Conclua primeiro: ' + blockers.map(function (item) { return item.title || 'Tarefa sem título'; }).join(', ') + '.');
        return;
      }
    }
    var previousMetadata = taskMetadata(task);
    var nextFrequency = String(formData.get('recurrence') || '');
    var dueDate = formData.get('dueDate') || null;
    if (nextFrequency && !dueDate) {
      notify('Defina um prazo para configurar a recorrência da tarefa.');
      return;
    }
    var recurrence = nextFrequency ? {
      frequency: nextFrequency,
      interval: 1,
      seriesId: previousMetadata.recurrence && previousMetadata.recurrence.seriesId || String(task.id),
      occurrenceDate: previousMetadata.recurrence && previousMetadata.recurrence.occurrenceDate || dueDate,
      occurrenceKey: previousMetadata.recurrence && previousMetadata.recurrence.occurrenceKey || String(task.id) + ':' + dueDate,
      nextOccurrenceDate: previousMetadata.recurrence && previousMetadata.recurrence.frequency === nextFrequency &&
        task.dueDate === dueDate ? previousMetadata.recurrence.nextOccurrenceDate : nextRecurrenceDate(dueDate, nextFrequency)
    } : null;
    var acceptanceCriteria = String(formData.get('acceptanceCriteria') || '').split(/\r?\n/)
      .map(function (criterion) { return criterion.trim(); }).filter(Boolean);
    var metadata = Object.assign({}, previousMetadata, {
      dependsOn: dependencies,
      acceptanceCriteria: acceptanceCriteria,
      waitingOn: String(formData.get('waitingOn') || '').trim(),
      blockedReason: String(formData.get('blockedReason') || '').trim(),
      isMilestone: formData.has('isMilestone'),
      recurrence: recurrence
    });
    if (hasProgressWeight) {
      if (progressWeight !== null) metadata.progressWeight = progressWeight;
      else delete metadata.progressWeight;
    }
    window.RildonXStore.updateTask(task.id, {
      title: String(formData.get('title') || '').trim(),
      startDate: formData.get('startDate') || null,
      dueDate: dueDate,
      description: String(formData.get('description') || '').trim(),
      priority: String(formData.get('priority') || 'media'),
      status: status,
      metadata: metadata
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
    if (status === 'concluida') {
      var blockers = incompleteDependencies(task, state.tasks || []);
      if (blockers.length) {
        notify('Conclua primeiro: ' + blockers.map(function (item) { return item.title || 'Tarefa sem título'; }).join(', ') + '.');
        return;
      }
    }
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
      if (event.target.id === 'task-search') renderBoard(getStoreState());
      if (event.target.id === 'task-filter-search') renderActiveTaskFilters(getStoreState());
    });
    taskRoot.addEventListener('change', function (event) {
      if (event.target.matches('#task-project-filter,#task-status-filter,#task-priority-filter,#task-assignee-filter,#task-due-from,#task-due-to,#task-created-from,#task-created-to,#task-end-from,#task-end-to,#task-archived-filter,#task-tags-filter,#task-comment-assigned-filter,#task-created-by-filter')) {
        readTaskFilterValues();
        renderBoard(getStoreState());
      }
      if (event.target.id === 'task-saved-filter' && event.target.value !== '') {
        var savedFilters = getSavedFilters();
        var savedFilter = savedFilters[Number(event.target.value)];
        if (savedFilter) applyTaskFilters(savedFilter.filters);
        event.target.value = '';
      }
      if (event.target.matches('[data-backlog-toggle]')) {
        updateBacklogItem(Number(event.target.dataset.backlogToggle), { completed: event.target.checked });
      }
    });
    taskRoot.addEventListener('click', function (event) {
      if (event.target.closest('[data-collaborator-picker]')) return;
      var filterMenu = document.getElementById('task-filter-menu');
      if (filterMenu && !event.target.closest('#task-filter-menu')) filterMenu.open = false;
      var addFilter = event.target.closest('[data-add-task-filter]');
      if (addFilter) {
        var filterKey = addFilter.dataset.addTaskFilter;
        if (activeTaskFilterKeys.indexOf(filterKey) === -1) {
          activeTaskFilterKeys.push(filterKey);
          taskFilterValues[filterKey] = filterKey === 'dueDate' || filterKey === 'createdDate' || filterKey === 'endDate'
            ? { from: '', to: '' }
            : filterKey === 'archived' ? 'active' : '';
        }
        if (filterMenu) filterMenu.open = false;
        var filterSearch = document.getElementById('task-filter-search');
        if (filterSearch) filterSearch.value = '';
        renderActiveTaskFilters(getStoreState());
        updateTaskFilterCount();
        renderBoard(getStoreState());
        return;
      }
      var removeFilter = event.target.closest('[data-remove-task-filter]');
      if (removeFilter) {
        var removedFilterKey = removeFilter.dataset.removeTaskFilter;
        activeTaskFilterKeys = activeTaskFilterKeys.filter(function (key) { return key !== removedFilterKey; });
        delete taskFilterValues[removedFilterKey];
        renderActiveTaskFilters(getStoreState());
        updateTaskFilterCount();
        renderBoard(getStoreState());
        return;
      }
      var addBacklogButton = event.target.closest('[data-add-backlog]');
      if (addBacklogButton) {
        var form = addBacklogButton.closest('.task-backlog-column').querySelector('[data-backlog-form]');
        var input = form && form.querySelector('[data-backlog-title]');
        if (form) form.hidden = false;
        if (input) input.focus();
        return;
      }
      var addTaskButton = event.target.closest('[data-add-task-stage]');
      if (addTaskButton) {
        if (typeof window.openModal !== 'function') return;
        window.openModal('modal-nova-tarefa');
        var stage = addTaskButton.dataset.addTaskStage;
        var stageLabels = { 'em-andamento': 'Em andamento', 'aguardando-terceiros': 'Aguardando terceiros', concluida: 'Concluída' };
        var stageLabel = stageLabels[stage] || 'Pendente';
        document.querySelectorAll('#nt-etapa-group .choice-btn').forEach(function (button) {
          button.classList.toggle('selected', button.dataset.etapa === stageLabel);
        });
        var projectSelect = document.getElementById('nt-projeto');
        if (projectSelect && addTaskButton.dataset.projectId) projectSelect.value = addTaskButton.dataset.projectId;
        var titleInput = document.getElementById('nt-nome');
        if (titleInput) titleInput.focus();
        return;
      }
      var groupToggle = event.target.closest('[data-toggle-project-group]');
      if (groupToggle) {
        var group = groupToggle.closest('[data-project-group]');
        var groupBoard = group && group.querySelector('.task-kanban-board');
        if (group && groupBoard) {
          var collapsed = !groupBoard.hidden;
          groupBoard.hidden = collapsed;
          group.classList.toggle('is-collapsed', collapsed);
          groupToggle.setAttribute('aria-expanded', String(!collapsed));
          var groups = getCollapsedTaskGroups().filter(function (id) { return id !== group.dataset.projectGroup; });
          if (collapsed) groups.push(group.dataset.projectGroup);
          saveCollapsedTaskGroups(groups);
        }
        return;
      }
      var columnToggle = event.target.closest('[data-toggle-task-column]');
      if (columnToggle) {
        var column = columnToggle.closest('.task-kanban-column');
        var dropzone = column && column.querySelector('[data-task-dropzone]');
        if (column && dropzone) {
          var isCollapsed = !dropzone.hidden;
          dropzone.hidden = isCollapsed;
          column.classList.toggle('is-collapsed', isCollapsed);
          columnToggle.setAttribute('aria-expanded', String(!isCollapsed));
          columnToggle.setAttribute('aria-label', (isCollapsed ? 'Expandir coluna ' : 'Recolher coluna ') +
            (statuses.find(function (item) { return item.id === column.dataset.taskStatus; }) || {}).label);
          columnToggle.title = isCollapsed ? 'Expandir coluna' : 'Recolher coluna';
          var collapsedColumns = getCollapsedTaskColumns().filter(function (id) {
            return id !== column.dataset.taskColumnKey;
          });
          if (isCollapsed) collapsedColumns.push(column.dataset.taskColumnKey);
          saveCollapsedTaskColumns(collapsedColumns);
        }
        return;
      }
      var quickView = event.target.closest('[data-task-quick-view]');
      if (quickView) {
        activeTaskViewFilter = quickView.dataset.taskQuickView;
        updateTaskViewButtons();
        renderBoard(getStoreState());
        return;
      }
      var boardView = event.target.closest('[data-task-view]');
      if (boardView) {
        activeTaskView = boardView.dataset.taskView;
        renderBoard(getStoreState());
        return;
      }
      if (event.target.closest('[data-save-task-filter]')) {
        var filterName = window.prompt('Nome para este filtro:');
        if (!filterName || !filterName.trim()) return;
        var saved = getSavedFilters();
        saved.push({ name: filterName.trim(), filters: captureTaskFilters() });
        saveSavedFilters(saved);
        notify('Filtro salvo para sua conta neste navegador.');
        return;
      }
      if (event.target.closest('[data-delete-task-filter]')) {
        var currentSaved = document.getElementById('task-saved-filter');
        if (!currentSaved || currentSaved.value === '') {
          notify('Selecione um filtro salvo para removê-lo.');
          return;
        }
        var filters = getSavedFilters();
        filters.splice(Number(currentSaved.value), 1);
        saveSavedFilters(filters);
        notify('Filtro salvo removido.');
        return;
      }
      if (event.target.closest('[data-clear-task-filters]')) {
        applyTaskFilters({});
        return;
      }
      var removeBacklogButton = event.target.closest('[data-backlog-remove]');
      if (removeBacklogButton) {
        removeBacklogItem(Number(removeBacklogButton.dataset.backlogRemove));
        return;
      }
      var taskButton = event.target.closest('[data-open-task]');
      if (taskButton) {
        openTaskDetails(taskButton.dataset.openTask);
        return;
      }
      var boardSubtask = event.target.closest('[data-open-subtask]');
      if (boardSubtask) {
        openTaskDetails(boardSubtask.dataset.openSubtask);
        return;
      }
      var card = event.target.closest('.task-card,.task-compact-row');
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
      var card = event.target.closest('.task-card,.task-compact-row,.task-table-row');
      if (card && (card === event.target || card.classList.contains('task-card') &&
          !event.target.closest('button,a,input,select,textarea')) &&
          (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openTaskDetails(card.dataset.taskId || card.dataset.openTask);
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
    layout.innerHTML = '<div class="task-workspace"><div class="task-main">' +
      '<div class="task-view-row"><nav class="task-view-toggle" id="task-view-toggle" aria-label="Visualização das tarefas">' +
      '<button type="button" data-task-view="list" aria-pressed="false"><span aria-hidden="true">☷</span> Lista</button>' +
      '<button type="button" data-task-view="kanban" aria-pressed="true"><span aria-hidden="true">▦</span> Quadro</button>' +
      '<button type="button" data-task-view="table" aria-pressed="false"><span aria-hidden="true">▤</span> Tabela</button></nav>' +
      '<div class="task-view-actions-right"><details class="task-filter-picker" id="task-filter-menu"><summary><span>Selecionar filtro</span><span class="task-filter-count" data-task-filter-count></span><span class="task-filter-picker-chevron" aria-hidden="true">⌃</span></summary>' +
      '<div class="task-filter-dropdown"><label class="task-filter-search"><span aria-hidden="true">⌕</span><input id="task-filter-search" type="search" placeholder="Pesquisar..." aria-label="Pesquisar filtros"></label>' +
      '<div class="task-filter-options" id="task-filter-options" role="listbox" aria-label="Filtros disponíveis"></div>' +
      '<div class="task-saved-filter-controls"><select id="task-saved-filter" aria-label="Filtros salvos"><option value="">Filtros salvos</option></select>' +
      '<button type="button" data-save-task-filter>Salvar filtro</button><button type="button" data-delete-task-filter aria-label="Excluir filtro selecionado">Excluir</button></div>' +
      '<button type="button" class="task-clear-filters" data-clear-task-filters>Limpar filtros</button></div></details>' +
      '<button type="button" class="btn task-new-task-button" onclick="openModal(\'modal-nova-tarefa\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nova tarefa</button></div></div>' +
      '<div class="task-selected-filters" id="task-selected-filters" aria-live="polite"></div>' +
      '<div class="task-filter-toolbar"><label class="task-local-search"><span aria-hidden="true">⌕</span><input id="task-search" type="search" placeholder="Buscar tarefas" aria-label="Buscar tarefas"></label>' +
      '</div>' +
      '<nav class="task-quick-views" id="task-quick-views" aria-label="Visões rápidas">' +
      '<button type="button" data-task-quick-view="mine" aria-pressed="false">Minhas tarefas</button>' +
      '<button type="button" data-task-quick-view="today" aria-pressed="false">Hoje</button>' +
      '<button type="button" data-task-quick-view="overdue" aria-pressed="false">Atrasadas</button>' +
      '<button type="button" data-task-quick-view="waiting" aria-pressed="false">Aguardando terceiros</button>' +
      '<button type="button" data-task-quick-view="all" aria-pressed="true">Todas</button></nav>' +
      '<div class="task-board-viewport" aria-label="Quadro de tarefas">' +
      '<div id="task-kanban-board" class="task-board-content"></div></div></div></div>';
    taskRoot = layout;
    bindBoard();
    bindCollaboratorPicker();
    bindRequestTemplateControls();
    renderSavedFilters();
    renderRequestTemplates();
    render(getStoreState());
    initIdentity().then(async function () {
      render(getStoreState());
      await loadTaskPreferences();
      await materializeDueRecurringTasks();
      var sourceId = new URLSearchParams(window.location.search).get('calendarSource');
      if (sourceId) {
        var sourceTask = (getStoreState().tasks || []).find(function (task) {
          return String(task.id) === sourceId;
        });
        if (sourceTask) openTaskDetails(sourceId);
        else notify('A tarefa de origem não está disponível para sua conta.');
      }
    });
    window.RildonXStore.subscribe(function (state) { render(state); });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
