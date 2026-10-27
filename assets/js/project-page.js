(function () {
  'use strict';

  var root = document.getElementById('project-page-root');
  var store = window.RildonXStore;
  if (!root || !store) return;

  var currentUserId = null;
  var activeFilter = 'all';
  var searchText = '';
  var detailProjectId = null;
  var detailTab = 'overview';
  var composing = false;
  var composingProjectId = null;
  var composingBusy = false;

  root.innerHTML = '<div class="project-loading">Carregando seus projetos...</div>';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function state() {
    return store.getState();
  }

  function makeId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'project-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else console.info(message);
  }

  function currentUser(s) {
    var profiles = s.profiles || [];
    return profiles.find(function (profile) { return profile.id === currentUserId; }) ||
      s.user || { id: currentUserId, name: 'Usuário' };
  }

  function memberIds(project) {
    return Array.isArray(project.members) ? project.members.map(function (member) {
      return typeof member === 'string' ? member : member && (member.id || member.userId);
    }).filter(Boolean) : [];
  }

  function profileName(id, s) {
    if (id === currentUserId) return currentUser(s).displayName || currentUser(s).name || 'Você';
    var profile = (s.profiles || []).find(function (item) { return item.id === id; });
    if (profile) return profile.displayName || profile.nickname || 'Colaborador';
    var names = (s.profiles || []).filter(Boolean).map(function (item) {
      return item.displayName || item.nickname;
    });
    return names.indexOf(id) >= 0 ? id : 'Colaborador';
  }

  function isVisible(project, s) {
    if (!project || project.isDemo) return false;
    if (window.RildonXIsAdmin || project.allUsers) return true;
    if (currentUserId && project.createdBy === currentUserId) return true;
    var members = memberIds(project);
    if (currentUserId && members.indexOf(currentUserId) >= 0) return true;
    var displayName = currentUser(s).displayName || currentUser(s).name;
    return members.indexOf(displayName) >= 0;
  }

  function isCreator(project) {
    return Boolean(window.RildonXIsAdmin || currentUserId && project && project.createdBy === currentUserId);
  }

  function projectTasks(projectId, s) {
    return (s.tasks || []).filter(function (task) {
      return task && !task.isDemo && String(task.projectId || '') === String(projectId);
    });
  }

  function isCompleted(task) {
    var status = String(task.status || '').toLocaleLowerCase('pt-BR');
    return status === 'concluída' || status === 'concluida' || status === 'concluído' ||
      status === 'concluido' || status === 'completed' || status === 'done';
  }

  function completion(project, s) {
    var tasks = projectTasks(project.id, s);
    var completed = tasks.filter(isCompleted).length;
    return { tasks: tasks, completed: completed, progress: tasks.length ? Math.round(completed * 100 / tasks.length) : 0 };
  }

  function displayStatus(project, s) {
    if (project.archived) return 'Arquivado';
    var result = completion(project, s);
    if (result.tasks.length && result.completed === result.tasks.length) return 'Concluído';
    if (result.completed > 0) return 'Em andamento';
    return 'Planejamento';
  }

  function statusClass(status) {
    if (status === 'Em andamento') return 'in-progress';
    if (status === 'Concluído') return 'completed';
    if (status === 'Arquivado') return 'archived';
    return '';
  }

  function formatDate(value) {
    if (!value) return 'Não definida';
    var date = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    return Number.isNaN(date.getTime()) ? 'Não definida' : date.toLocaleDateString('pt-BR');
  }

  function relativeDate(value) {
    if (!value) return 'Sem atualizações';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem atualizações';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function allProjects(s) {
    return (s.projects || []).filter(function (project) { return isVisible(project, s); });
  }

  function visibleProjects(s) {
    var needle = searchText.trim().toLocaleLowerCase('pt-BR');
    return allProjects(s).filter(function (project) {
      var status = displayStatus(project, s);
      var matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'planning' && status === 'Planejamento') ||
        (activeFilter === 'in-progress' && status === 'Em andamento') ||
        (activeFilter === 'completed' && status === 'Concluído') ||
        (activeFilter === 'archived' && status === 'Arquivado');
      var matchesSearch = !needle || (project.name + ' ' + (project.description || '') + ' ' + (project.sector || ''))
        .toLocaleLowerCase('pt-BR').indexOf(needle) !== -1;
      return matchesFilter && matchesSearch;
    }).sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  }

  function getOwner(project, s) {
    return profileName(project.createdBy, s);
  }

  function avatar(profile) {
    var name = profile.displayName || profile.nickname || 'U';
    var initials = name.split(/\s+/).map(function (part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    return '<span class="project-avatar">' + (profile.avatarUrl
      ? '<img src="' + escapeHtml(profile.avatarUrl) + '" alt="">'
      : escapeHtml(initials || 'U')) + '</span>';
  }

  function icon(name) {
    var paths = {
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
      restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
      open: '<path d="M14 3h7v7m-1-6-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  function activities(s) {
    return allProjects(s).reduce(function (items, project) {
      return items.concat((project.activityLog || []).map(function (item) {
        return Object.assign({ projectName: project.name }, item);
      }));
    }, []).sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }).slice(0, 10);
  }

  function overallProgress(projects, s) {
    var projectsWithTasks = projects.filter(function (project) { return !project.archived; });
    var tasks = projectsWithTasks.reduce(function (all, project) {
      return all.concat(projectTasks(project.id, s));
    }, []);
    var completed = tasks.filter(isCompleted).length;
    return {
      totalProjects: projectsWithTasks.length,
      completedProjects: projectsWithTasks.filter(function (project) {
        var result = completion(project, s);
        return result.tasks.length > 0 && result.completed === result.tasks.length;
      }).length,
      totalTasks: tasks.length,
      completedTasks: completed,
      percent: tasks.length ? Math.round(completed * 100 / tasks.length) : 0
    };
  }

  function renderCard(project, s) {
    var calculated = completion(project, s);
    var status = displayStatus(project, s);
    var profiles = (s.profiles || []).filter(function (profile) {
      return memberIds(project).indexOf(profile.id) >= 0;
    });
    var profileMarkup = profiles.slice(0, 5).map(avatar).join('');
    var remaining = Math.max(0, profiles.length - 5);
    if (remaining) profileMarkup += '<span class="project-avatar">+' + remaining + '</span>';
    var image = project.imageUrl
      ? '<img class="project-image" src="' + escapeHtml(project.imageUrl) + '" alt="">'
      : '<span class="project-image project-image-fallback">' + escapeHtml((project.name || 'P').trim().charAt(0).toUpperCase()) + '</span>';
    var actions = '';
    if (isCreator(project)) {
      actions = '<div class="project-card-actions">' +
        '<button type="button" class="project-icon-btn" data-action="edit" data-id="' + escapeHtml(project.id) + '" title="Editar projeto" aria-label="Editar projeto">' + icon('edit') + '</button>' +
        '<button type="button" class="project-icon-btn" data-action="' + (project.archived ? 'restore' : 'archive') + '" data-id="' + escapeHtml(project.id) + '" title="' + (project.archived ? 'Desarquivar projeto' : 'Arquivar projeto') + '" aria-label="' + (project.archived ? 'Desarquivar projeto' : 'Arquivar projeto') + '">' + icon(project.archived ? 'restore' : 'archive') + '</button>' +
        '<button type="button" class="project-icon-btn" data-action="delete" data-id="' + escapeHtml(project.id) + '" title="Excluir projeto" aria-label="Excluir projeto">' + icon('trash') + '</button>' +
        '</div>';
    }
    return '<article class="project-card" data-action="details" data-id="' + escapeHtml(project.id) + '"><div class="project-card-head">' + image +
      '<div class="project-title-wrap"><h3>' + escapeHtml(project.name) + '</h3><p class="project-description">' + escapeHtml(project.description || 'Sem descrição.') + '</p></div>' +
      '<span class="project-status ' + statusClass(status) + '">' + status + '</span></div>' +
      '<div class="project-progress-row"><div class="project-progress"><span style="width:' + calculated.progress + '%"></span></div><span class="project-progress-label">' + calculated.progress + '%</span></div>' +
      '<div class="project-card-meta"><span>' + calculated.tasks.length + ' tarefas · ' + calculated.completed + ' concluídas</span><span>Atualizado ' + formatDate(project.updatedAt) + '</span></div>' +
      '<div class="project-card-footer"><div class="project-card-owner">' + avatar({ displayName: getOwner(project, s) }) + '<span>' + escapeHtml(getOwner(project, s)) + '</span><span aria-hidden="true">·</span><span>Conclusão ' + formatDate(project.completedAt || project.endDate) + '</span></div>' +
      '<div class="project-member-stack" aria-label="Participantes">' + (project.allUsers ? '<span class="project-task-meta">Todos os usuários</span>' : profileMarkup) + '</div>' + actions + '</div></article>';
  }

  function renderPage() {
    var s = state();
    var projects = visibleProjects(s);
    var all = allProjects(s);
    var statuses = all.map(function (project) { return displayStatus(project, s); });
    var counts = {
      all: all.length,
      'in-progress': statuses.filter(function (value) { return value === 'Em andamento'; }).length,
      planning: statuses.filter(function (value) { return value === 'Planejamento'; }).length,
      completed: statuses.filter(function (value) { return value === 'Concluído'; }).length,
      archived: statuses.filter(function (value) { return value === 'Arquivado'; }).length
    };
    var activityItems = activities(s);
    var content = projects.length
      ? projects.map(function (project) { return renderCard(project, s); }).join('')
      : '<div class="project-empty">Nenhum projeto encontrado para este filtro.</div>';
    var activityMarkup = activityItems.length
      ? activityItems.map(function (item) {
        return '<div class="project-activity-item"><span class="project-activity-dot"></span><div class="project-activity-copy">' +
          escapeHtml(item.description || 'Projeto atualizado') + ' <span>· ' + escapeHtml(item.projectName || '') + '</span></div><time class="project-activity-time">' +
          escapeHtml(relativeDate(item.createdAt)) + '</time></div>';
      }).join('')
      : '<div class="project-empty">As atualizações dos projetos e das tarefas associadas aparecerão aqui.</div>';

    var total = overallProgress(all, s);
    root.innerHTML = '<div class="project-layout"><main class="project-workspace">' +
      '<div class="project-toolbar-top"><button type="button" class="btn" data-action="new-project">+ Novo projeto</button></div>' +
      '<div class="project-stats">' +
      statCard('all', 'Projetos visíveis', counts.all) + statCard('in-progress', 'Em andamento', counts['in-progress']) +
      statCard('planning', 'Em planejamento', counts.planning) + statCard('completed', 'Concluídos', counts.completed) + '</div>' +
      '<div class="project-section"><div class="project-toolbar"><div class="project-tabs">' +
      tab('all', 'Todos', counts.all) + tab('in-progress', 'Em andamento', counts['in-progress']) +
      tab('planning', 'Planejamento', counts.planning) + tab('completed', 'Concluídos', counts.completed) +
      tab('archived', 'Arquivados', counts.archived) + '</div>' +
      '<input class="project-search" type="search" aria-label="Buscar projetos" placeholder="Buscar projetos..." value="' + escapeHtml(searchText) + '"></div>' +
      '<div class="project-list" style="margin-top:16px">' + content + '</div></div></main>' +
      '<aside class="project-side-widgets">' +
      '<section class="project-section project-overall-card"><div class="project-section-head"><h2>Conclusão geral</h2></div>' +
      '<div class="project-overall-donut" style="background:conic-gradient(var(--green) 0 ' + total.percent + '%,var(--border-soft) ' + total.percent + '% 100%)"><div><b>' +
      total.percent + '%</b><span>concluído</span></div></div><p class="project-overall-caption"><strong>' + total.completedTasks + ' de ' + total.totalTasks +
      ' tarefas</strong><span>concluídas nos projetos ativos</span></p><div class="project-overall-footer">' + total.completedProjects + ' de ' + total.totalProjects +
      ' projetos concluídos</div></section>' +
      '<section class="project-section project-activity-card"><div class="project-section-head"><h2>Atividades recentes</h2></div>' +
      '<div class="project-activity-list">' + activityMarkup + '</div></section></aside></div>';
  }

  function statCard(filter, label, value) {
    return '<button type="button" class="project-stat" data-action="filter" data-filter="' + filter + '"><span class="project-stat-label">' +
      label + '</span><strong class="project-stat-value">' + value + '</strong></button>';
  }

  function tab(filter, label, count) {
    return '<button type="button" class="project-tab ' + (activeFilter === filter ? 'active' : '') + '" data-action="filter" data-filter="' +
      filter + '">' + label + ' <span>(' + count + ')</span></button>';
  }

  function projectById(id) {
    return (state().projects || []).find(function (project) { return String(project.id) === String(id); });
  }

  function detailMarkup(project, s) {
    var calculated = completion(project, s);
    var taskList = calculated.tasks.length
      ? calculated.tasks.map(function (task) {
        var assignedProfiles = (Array.isArray(task.viewerIds) ? task.viewerIds : [])
          .filter(function (userId) { return String(userId) !== String(task.createdBy); })
          .map(function (userId) {
            return (s.profiles || []).find(function (person) { return String(person.id) === String(userId); });
          })
          .filter(Boolean);
        var assigned = assignedProfiles.length
          ? assignedProfiles.map(function (profile) { return profile.displayName || profile.nickname || 'Colaborador'; }).join(', ')
          : (task.assignees || []).map(function (assignee) {
            if (typeof assignee === 'string' && currentUserId && assignee === currentUserId) return profileName(assignee, s);
            var value = assignee && typeof assignee === 'object'
              ? assignee.id || assignee.userId || assignee.name || assignee.displayName
              : assignee;
            var profile = (s.profiles || []).find(function (person) {
              return String(person.id) === String(value) ||
                String(person.displayName || '').toLocaleLowerCase('pt-BR') === String(value || '').toLocaleLowerCase('pt-BR') ||
                String(person.nickname || '').toLocaleLowerCase('pt-BR') === String(value || '').toLocaleLowerCase('pt-BR');
            });
            return profile ? profile.displayName || profile.nickname : value;
          }).filter(Boolean).join(', ') || 'Sem responsável';
        return '<div class="project-task-row"><div><div class="project-task-name">' + escapeHtml(task.title || 'Tarefa') + '</div><div class="project-task-meta">Responsável: ' +
          escapeHtml(assigned) + ' · Prazo: ' + escapeHtml(formatDate(task.dueDate)) + '</div></div><span class="project-status ' +
          (isCompleted(task) ? 'completed' : '') + '">' + escapeHtml(task.status || 'Pendente') + '</span></div>';
      }).join('')
      : '<div class="project-empty">Ainda não há tarefas vinculadas. Associe uma tarefa a este projeto na página Tarefas.</div>';
    var files = (s.documents || []).filter(function (doc) { return String(doc.relatedProjectId || '') === String(project.id); });
    var fileList = files.length ? files.map(function (file) {
      var owner = (s.profiles || []).find(function (profile) {
        return String(profile.id) === String(file.ownerId || file.senderId || '');
      });
      var senderName = owner && (owner.displayName || owner.nickname) || file.senderName || 'Usuário';
      return '<div class="project-file-row"><div><strong>' + escapeHtml(file.name) + '</strong><div class="project-task-meta">' +
        escapeHtml(file.sizeLabel || '') + ' · enviado por ' + escapeHtml(senderName) + '</div></div><div>' +
        '<button type="button" class="project-link-btn" data-action="open-file" data-file="' + escapeHtml(file.id) + '">Abrir</button> ' +
        '<button type="button" class="project-link-btn" data-action="download-file" data-file="' + escapeHtml(file.id) + '">Baixar</button></div></div>';
    }).join('') : '<div class="project-empty">Nenhum arquivo anexado ao projeto.</div>';
    var activityList = (project.activityLog || []).slice().sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }).map(function (item) {
      return '<div class="project-activity-item"><span class="project-activity-dot"></span><div class="project-activity-copy">' +
        escapeHtml(item.description || 'Projeto atualizado') + ' <span>· ' + escapeHtml(item.actorName || 'Usuário') + '</span></div><time class="project-activity-time">' +
        escapeHtml(relativeDate(item.createdAt)) + '</time></div>';
    }).join('') || '<div class="project-empty">Nenhuma atividade registrada.</div>';
    var body = detailTab === 'tasks' ? taskList : detailTab === 'files' ? fileList : detailTab === 'activity' ? activityList :
      '<div class="project-detail-summary"><div class="project-detail-cell"><small>Responsável</small><strong>' + escapeHtml(getOwner(project, s)) +
      '</strong></div><div class="project-detail-cell"><small>Status</small><strong>' + escapeHtml(displayStatus(project, s)) +
      '</strong></div><div class="project-detail-cell"><small>Início</small><strong>' + escapeHtml(formatDate(project.startDate)) +
      '</strong></div><div class="project-detail-cell"><small>Conclusão prevista</small><strong>' + escapeHtml(formatDate(project.endDate)) +
      '</strong></div><div class="project-detail-cell"><small>Concluído em</small><strong>' + escapeHtml(project.completedAt ? formatDate(project.completedAt) : 'Ainda não concluído') +
      '</strong></div><div class="project-detail-cell"><small>Progresso · ' + calculated.completed + ' de ' + calculated.tasks.length + ' tarefas concluídas</small>' +
      '<div class="project-progress" style="margin-top:9px"><span style="width:' + calculated.progress + '%"></span></div></div><div class="project-detail-cell"><small>Última atualização</small><strong>' +
      escapeHtml(relativeDate(project.updatedAt)) + '</strong></div></div><p class="project-detail-description">' + escapeHtml(project.description || 'Sem descrição.') + '</p>';
    return '<div class="project-overlay" data-overlay="detail"><section class="project-dialog" role="dialog" aria-modal="true" aria-label="' + escapeHtml(project.name) + '">' +
      '<header class="project-dialog-head"><h2>' + escapeHtml(project.name) + '</h2><button type="button" class="project-icon-btn" data-action="close-overlay" aria-label="Fechar">' + icon('close') + '</button></header>' +
      '<div class="project-dialog-body"><div class="project-detail-tabs">' +
      detailTabButton('overview', 'Visão geral') + detailTabButton('tasks', 'Tarefas (' + calculated.tasks.length + ')') +
      detailTabButton('files', 'Arquivos (' + files.length + ')') + detailTabButton('activity', 'Atividade') + '</div>' + body + '</div>' +
      '<footer class="project-dialog-foot">' + (isCreator(project) ? '<button type="button" class="btn secondary" data-action="edit" data-id="' + escapeHtml(project.id) + '">Editar projeto</button>' : '') +
      '<button type="button" class="btn" data-action="close-overlay">Fechar</button></footer></section></div>';
  }

  function detailTabButton(tabName, label) {
    return '<button type="button" class="project-detail-tab ' + (detailTab === tabName ? 'active' : '') + '" data-action="detail-tab" data-tab="' + tabName + '">' + label + '</button>';
  }

  function renderDetail() {
    var old = document.querySelector('.project-overlay[data-overlay="detail"]');
    if (old) old.remove();
    if (!detailProjectId) return;
    var project = projectById(detailProjectId);
    if (!project || !isVisible(project, state())) {
      detailProjectId = null;
      return;
    }
    document.body.insertAdjacentHTML('beforeend', detailMarkup(project, state()));
  }

  function renderUsersPicker(s, selectedIds, everyone) {
    var profiles = (s.profiles || []).filter(function (profile) {
      return profile.active !== false && profile.id;
    }).sort(function (a, b) {
      return (a.displayName || '').localeCompare(b.displayName || '', 'pt-BR');
    });
    if (!profiles.length) return '<p class="project-file-note">Não foi possível carregar a lista de usuários. Atualize a página após verificar a conexão.</p>';
    return '<div class="project-users">' + profiles.map(function (profile) {
      var selected = selectedIds.indexOf(profile.id) >= 0;
      var required = profile.id === currentUserId;
      return '<label class="project-user-option"><input type="checkbox" name="project-member" value="' + escapeHtml(profile.id) + '" ' +
        (selected || required ? 'checked ' : '') + (required ? 'disabled ' : '') + (everyone ? 'disabled ' : '') +
        '><span>' + escapeHtml(profile.displayName || profile.nickname || 'Usuário') + (required ? ' (criador)' : '') + '</span></label>';
    }).join('') + '</div>';
  }

  function composeMarkup(project, s) {
    var creating = !project;
    var selected = project ? memberIds(project) : [];
    var everyone = Boolean(project && project.allUsers);
    var header = creating ? 'Novo projeto' : 'Editar projeto';
    return '<div class="project-overlay" data-overlay="compose"><form class="project-dialog" data-form="project"><header class="project-dialog-head"><h2>' + header +
      '</h2><button type="button" class="project-icon-btn" data-action="close-compose" aria-label="Fechar">' + icon('close') + '</button></header>' +
      '<div class="project-dialog-body"><div class="project-form-grid"><div class="project-field full"><label for="project-name">Nome do projeto *</label><input id="project-name" name="name" required maxlength="140" value="' +
      escapeHtml(project && project.name || '') + '" placeholder="Ex.: Lançamento de produto"></div>' +
      '<div class="project-field full"><label for="project-description">Descrição *</label><textarea id="project-description" name="description" required maxlength="4000" placeholder="Objetivos, escopo e informações importantes">' +
      escapeHtml(project && project.description || '') + '</textarea></div>' +
      '<div class="project-field"><label for="project-start">Data de início</label><input type="date" id="project-start" name="startDate" value="' + escapeHtml(project && project.startDate || '') + '"></div>' +
      '<div class="project-field"><label for="project-end">Data de conclusão prevista</label><input type="date" id="project-end" name="endDate" value="' + escapeHtml(project && project.endDate || '') + '"></div>' +
      '<div class="project-field full"><label for="project-image">Imagem de perfil do projeto</label><input id="project-image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif">' +
      '<span class="project-file-note">' + (project && project.imageUrl ? 'A imagem atual será mantida se nenhum arquivo novo for escolhido.' : 'PNG, JPG, WebP ou GIF.') + '</span></div>' +
      '<div class="project-field full"><label for="project-files">Anexos</label><input id="project-files" name="files" type="file" multiple>' +
      '<span class="project-file-note">' + (project ? 'Os novos arquivos serão acrescentados aos anexos existentes.' : 'Os arquivos ficarão vinculados ao projeto e acessíveis aos participantes.') + '</span></div>' +
      '<div class="project-field full"><label>Participantes</label><label class="project-user-option"><input type="checkbox" name="everyone" ' + (everyone ? 'checked' : '') + '>Incluir todos os usuários (incluindo novos usuários futuros)</label>' +
      renderUsersPicker(s, selected, everyone) + '</div></div></div><footer class="project-dialog-foot"><button type="button" class="btn secondary" data-action="close-compose">Cancelar</button>' +
      '<button type="submit" class="btn" ' + (composingBusy ? 'disabled' : '') + '>' + (composingBusy ? 'Salvando...' : creating ? 'Criar projeto' : 'Salvar alterações') + '</button></footer></form></div>';
  }

  function renderCompose() {
    var old = document.querySelector('.project-overlay[data-overlay="compose"]');
    if (old) old.remove();
    if (!composing) return;
    document.body.insertAdjacentHTML('beforeend', composeMarkup(composingProjectId ? projectById(composingProjectId) : null, state()));
  }

  function openCompose(projectId) {
    composingProjectId = projectId || null;
    composing = true;
    composingBusy = false;
    renderCompose();
  }

  function closeCompose() {
    if (composingBusy) return;
    composing = false;
    composingProjectId = null;
    renderCompose();
  }

  function resolveMembers(form, s) {
    var everyone = form.elements.everyone.checked;
    var ids = Array.prototype.slice.call(form.querySelectorAll('input[name="project-member"]:checked')).map(function (input) {
      return input.value;
    });
    if (currentUserId && ids.indexOf(currentUserId) < 0) ids.push(currentUserId);
    if (everyone) ids = (s.profiles || []).filter(function (profile) { return profile.active !== false; }).map(function (profile) { return profile.id; });
    return { ids: ids, everyone: everyone };
  }

  async function uploadProjectFiles(project, form, members) {
    var uploader = window.RildonXDocumentUpload;
    var filesInput = form.elements.files;
    var fileList = filesInput && filesInput.files ? Array.prototype.slice.call(filesInput.files) : [];
    var image = form.elements.image.files && form.elements.image.files[0];
    var imageUrl = project.imageUrl || null;
    var documents = [];
    if ((fileList.length || image) && !uploader) throw new Error('O serviço de arquivos não está disponível. Recarregue a página e tente novamente.');
    if (image) {
      var imageResult = await uploader.uploadProfileImage(image);
      imageUrl = imageResult.url;
    }
    for (var i = 0; i < fileList.length; i += 1) {
      var uploaded = await uploader.upload(fileList[i], {
        folder: 'Projetos',
        relatedProjectId: project.id,
        viewerIds: members,
        senderName: currentUser(state()).displayName || currentUser(state()).name || 'Usuário'
      });
      documents.push(uploaded);
    }
    return { imageUrl: imageUrl, documents: documents };
  }

  async function submitProject(form) {
    if (composingBusy) return;
    var formData = new FormData(form);
    var name = String(formData.get('name') || '').trim();
    var description = String(formData.get('description') || '').trim();
    if (!name || !description) {
      toast('Informe o nome e a descrição do projeto.');
      return;
    }
    var startDate = String(formData.get('startDate') || '');
    var endDate = String(formData.get('endDate') || '');
    if (startDate && endDate && endDate < startDate) {
      toast('A data de conclusão não pode ser anterior à data de início.');
      return;
    }
    if (!currentUserId) {
      toast('Não foi possível identificar sua conta. Saia e entre novamente antes de criar projetos.');
      return;
    }
    var s = state();
    var existing = composingProjectId ? projectById(composingProjectId) : null;
    if (existing && !isCreator(existing)) {
      toast('Somente o criador do projeto pode editar suas informações.');
      closeCompose();
      return;
    }
    var members = resolveMembers(form, s);
    var now = new Date().toISOString();
    var project = Object.assign({}, existing || {}, {
      id: existing ? existing.id : makeId(),
      name: name,
      description: description,
      startDate: startDate || null,
      endDate: endDate || null,
      members: members.ids,
      allUsers: members.everyone,
      createdBy: existing ? existing.createdBy : currentUserId,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      archived: existing ? Boolean(existing.archived) : false,
      status: existing ? existing.status : 'Planejamento'
    });
    composingBusy = true;
    renderCompose();
    try {
      var uploaded = await uploadProjectFiles(project, form, members.ids);
      project.imageUrl = uploaded.imageUrl;
      project.attachments = (project.attachments || []).concat(uploaded.documents.map(function (doc) {
        return { id: doc.id, name: doc.name, url: doc.url, mimeType: doc.mimeType, size: doc.size, sentAt: doc.sentAt };
      }));
      var current = state();
      var projects = (current.projects || []).filter(function (item) { return String(item.id) !== String(project.id); });
      projects.push(project);
      var docs = (current.documents || []).concat(uploaded.documents);
      store.setState({ projects: projects, documents: docs });
      composingBusy = false;
      composing = false;
      composingProjectId = null;
      toast(existing ? 'Projeto atualizado.' : 'Projeto criado.');
    } catch (error) {
      console.error('Não foi possível salvar o projeto:', error);
      composingBusy = false;
      renderCompose();
      toast('Não foi possível salvar o projeto: ' + (error.message || 'erro inesperado.'));
    }
  }

  async function performProjectAction(action, id) {
    var project = projectById(id);
    if (!project) return;
    if (action === 'details') {
      detailProjectId = project.id;
      detailTab = 'overview';
      renderDetail();
      return;
    }
    if (!isCreator(project)) {
      toast('Somente o criador do projeto pode realizar essa ação.');
      return;
    }
    if (action === 'edit') {
      openCompose(project.id);
      return;
    }
    if (action === 'archive' || action === 'restore') {
      var archived = action === 'archive';
      var updated = Object.assign({}, project, {
        archived: archived,
        status: project.status,
        updatedAt: new Date().toISOString()
      });
      store.setState({ projects: (state().projects || []).map(function (item) { return item.id === project.id ? updated : item; }) });
      toast(archived ? 'Projeto arquivado.' : 'Projeto desarquivado.');
      return;
    }
    if (action === 'delete') {
      if (!window.confirm('Excluir "' + project.name + '"? Esta ação não pode ser desfeita. As tarefas e arquivos existentes não serão removidos.')) return;
      if (window.supabaseClient && /^[0-9a-f-]{36}$/i.test(String(project.id))) {
        var result = await window.supabaseClient.from('projects').delete().eq('id', project.id).eq('created_by', currentUserId).select('id').single();
        if (result.error) {
          console.error('Não foi possível excluir o projeto no Supabase:', result.error);
          toast('Não foi possível excluir o projeto: ' + result.error.message);
          return;
        }
      }
      store.setState({ projects: (state().projects || []).filter(function (item) { return item.id !== project.id; }) });
      if (String(detailProjectId) === String(project.id)) {
        detailProjectId = null;
        renderDetail();
      }
      toast('Projeto excluído. As tarefas e os arquivos foram preservados.');
    }
  }

  async function openDocument(fileId, download) {
    var file = (state().documents || []).find(function (item) { return String(item.id) === String(fileId); });
    if (!file || !file.url || file.url === '#') {
      toast('O endereço deste arquivo não está disponível.');
      return;
    }
    try {
      var url = window.RildonXDocumentUpload && window.RildonXDocumentUpload.getViewUrl
        ? await window.RildonXDocumentUpload.getViewUrl(file)
        : file.url;
      if (!url) throw new Error('Não foi possível obter acesso ao arquivo.');
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (download) link.download = file.name || 'arquivo';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Não foi possível abrir o arquivo do projeto:', error);
      toast(error.message || 'Não foi possível abrir o arquivo.');
    }
  }

  root.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    if (action === 'filter') {
      activeFilter = target.getAttribute('data-filter') || 'all';
      renderPage();
    } else if (action === 'new-project') {
      openCompose(null);
    } else if (action === 'details' || action === 'edit' || action === 'archive' || action === 'restore' || action === 'delete') {
      event.stopPropagation();
      performProjectAction(action, target.getAttribute('data-id')).catch(function (error) {
        console.error('Falha na ação do projeto:', error);
        toast('Não foi possível concluir a ação do projeto.');
      });
    }
  });

  root.addEventListener('input', function (event) {
    if (!event.target.classList.contains('project-search')) return;
    searchText = event.target.value;
    var position = event.target.selectionStart;
    renderPage();
    var search = root.querySelector('.project-search');
    if (search) {
      search.focus();
      search.setSelectionRange(position, position);
    }
  });

  document.body.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action]');
    var overlay = event.target.closest('.project-overlay');
    if (overlay && event.target === overlay) {
      if (overlay.dataset.overlay === 'compose') closeCompose();
      else {
        detailProjectId = null;
        renderDetail();
      }
      return;
    }
    if (!target || !overlay || !overlay.contains(target)) return;
    var action = target.getAttribute('data-action');
    if (action === 'close-overlay') {
      detailProjectId = null;
      renderDetail();
    } else if (action === 'detail-tab') {
      detailTab = target.getAttribute('data-tab') || 'overview';
      renderDetail();
    } else if (action === 'close-compose') {
      closeCompose();
    } else if (action === 'open-file' || action === 'download-file') {
      openDocument(target.getAttribute('data-file'), action === 'download-file');
    } else if (action === 'edit') {
      closeCompose();
      openCompose(target.getAttribute('data-id') || detailProjectId);
    }
  });

  document.body.addEventListener('change', function (event) {
    if (event.target.name !== 'everyone') return;
    var form = event.target.closest('form');
    if (!form) return;
    Array.prototype.forEach.call(form.querySelectorAll('input[name="project-member"]'), function (checkbox) {
      if (checkbox.value === currentUserId) return;
      checkbox.disabled = event.target.checked;
    });
  });

  document.body.addEventListener('submit', function (event) {
    if (!event.target.matches('form[data-form="project"]')) return;
    event.preventDefault();
    submitProject(event.target);
  });

  function initialize() {
    var syncReady = window.RildonXSync && typeof window.RildonXSync.ready === 'function'
      ? window.RildonXSync.ready()
      : Promise.resolve();
    store.subscribe(function () {
      renderPage();
      renderDetail();
    });
    renderPage();

    Promise.resolve(syncReady).catch(function (error) {
      console.error('A sincronização inicial dos projetos falhou:', error);
    });

    if (window.supabaseClient && window.supabaseClient.auth) {
      window.supabaseClient.auth.getUser().then(function (auth) {
        if (auth.error) throw auth.error;
        var user = auth.data && auth.data.user;
        currentUserId = user ? user.id : null;
        if (user) {
          var appMetadata = user.app_metadata || {};
          var adminRole = String(appMetadata.role || '').trim().toLowerCase();
          var loginName = String(user.email || '').split('@')[0].trim().toLowerCase();
          window.RildonXIsAdmin = appMetadata.is_admin === true ||
            adminRole === 'admin' || adminRole === 'administrator' || loginName === 'adson.ri';
        }
        renderPage();
        renderDetail();
      }).catch(function (error) {
        console.error('Não foi possível identificar o usuário atual:', error);
        toast('Não foi possível confirmar sua conta. Atualize a página ou entre novamente para gerenciar projetos.');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
