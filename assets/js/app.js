/* ===================== MULTIPAGE NAV ===================== */
(function () {
  var page = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
    el.classList.toggle('active', el.getAttribute('data-page') === page);
  });
})();

function normalizeSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var nav = sidebar && sidebar.querySelector('.nav');
  if (!sidebar || !nav) return;
  nav.querySelectorAll('.nav-item[data-page="ajuda"]').forEach(function(item) {
    item.remove();
  });

  var icons = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>',
    messenger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    tarefas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
    projetos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    documentos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    meuespaco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  sidebar.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
    var icon = icons[item.getAttribute('data-page')];
    if (icon && !item.querySelector('svg')) item.insertAdjacentHTML('afterbegin', icon);
  });

  var logout = sidebar.querySelector('.logout-item');
  if (logout && !logout.querySelector('svg')) logout.insertAdjacentHTML('afterbegin', icons.sair);
}

normalizeSidebar();


function toggleSidebar(force) {
  var app = document.getElementById('app-root');
  if (typeof force === 'boolean') {
    app.classList.toggle('sidebar-open', force);
  } else {
    app.classList.toggle('sidebar-open');
  }
}

function initCollapsibleSidebar() {
  var app = document.getElementById('app-root');
  var sidebar = app && app.querySelector('.sidebar');
  var logo = sidebar && sidebar.querySelector('.logo');
  if (!app || !sidebar || !logo || sidebar.dataset.collapseReady === 'true') return;
  sidebar.dataset.collapseReady = 'true';

  var storageKey = 'rildonx_sidebar_collapsed';
  var collapseTimer = null;
  var expandTimer = null;
  var collapsed = false;
  try {
    collapsed = localStorage.getItem(storageKey) === 'true';
  } catch (error) {
    console.warn('Não foi possível restaurar a preferência da barra lateral:', error);
  }

  sidebar.querySelectorAll('.nav-item').forEach(function (item) {
    var labelText = Array.from(item.childNodes).filter(function (node) {
      return node.nodeType === Node.TEXT_NODE && node.textContent.trim();
    }).map(function (node) {
      var text = node.textContent.trim();
      node.remove();
      return text;
    }).join(' ').trim();
    if (!labelText || item.querySelector('.sidebar-label')) return;
    var label = document.createElement('span');
    label.className = 'sidebar-label';
    label.textContent = labelText;
    item.appendChild(label);
    item.classList.toggle('has-icon', Boolean(item.querySelector('svg')));
    item.setAttribute('aria-label', labelText);
    item.title = labelText;
    if (!item.querySelector('svg')) {
      var shortLabel = document.createElement('span');
      shortLabel.className = 'sidebar-item-short';
      shortLabel.setAttribute('aria-hidden', 'true');
      shortLabel.textContent = labelText.charAt(0).toLocaleUpperCase();
      item.insertBefore(shortLabel, label);
    }
  });

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'sidebar-collapse-btn';
  button.innerHTML = '<span class="sidebar-collapse-icon" aria-hidden="true">«</span><span class="sidebar-collapse-label">recolher</span>';
  var sidebarLogo = sidebar.querySelector('.sidebar-project-logo');
  var expandedLogoSource = sidebarLogo ? sidebarLogo.src : '';
  var faviconLink = document.querySelector('link[rel="icon"]');
  var collapsedLogoSource = faviconLink ? faviconLink.href : '';
  var sidebarBottom = sidebar.querySelector('.sidebar-bottom');
  var logoutItem = sidebarBottom && sidebarBottom.querySelector('.logout-item');
  if (logoutItem) sidebarBottom.insertBefore(button, logoutItem);
  else sidebar.appendChild(button);

  function clearTimers() {
    window.clearTimeout(collapseTimer);
    window.clearTimeout(expandTimer);
    collapseTimer = null;
    expandTimer = null;
  }

  function syncButtonState() {
    var isExpanded = !collapsed || app.classList.contains('sidebar-hover-expanded');
    button.setAttribute('aria-expanded', String(isExpanded));
    button.setAttribute('aria-label', isExpanded ? 'Recolher menu' : 'Expandir menu');
    button.title = isExpanded ? 'Recolher menu' : 'Expandir menu';
    button.classList.toggle('is-collapsed', !isExpanded);
    var icon = button.querySelector('.sidebar-collapse-icon');
    if (icon) icon.textContent = isExpanded ? '«' : '»';
    var label = button.querySelector('.sidebar-collapse-label');
    if (label) label.hidden = !isExpanded;
    var logoSource = isExpanded ? expandedLogoSource : collapsedLogoSource;
    if (sidebarLogo && logoSource && sidebarLogo.src !== logoSource) sidebarLogo.src = logoSource;
  }

  function setCollapsed(nextCollapsed, persist) {
    collapsed = nextCollapsed;
    app.classList.toggle('sidebar-collapsed', collapsed);
    if (!collapsed) app.classList.remove('sidebar-hover-expanded');
    syncButtonState();
    if (persist) {
      try {
        localStorage.setItem(storageKey, String(collapsed));
      } catch (error) {
        console.warn('Não foi possível salvar a preferência da barra lateral:', error);
      }
    }
  }

  function scheduleHoverExpansion() {
    if (!collapsed || window.innerWidth <= 820 || expandTimer) return;
    expandTimer = window.setTimeout(function () {
      expandTimer = null;
      if (!collapsed || !sidebar.matches(':hover')) return;
      app.classList.remove('sidebar-collapsed');
      app.classList.add('sidebar-hover-expanded');
      syncButtonState();
    }, 1500);
  }

  function scheduleHoverCollapse() {
    if (!collapsed || !app.classList.contains('sidebar-hover-expanded') || collapseTimer) return;
    collapseTimer = window.setTimeout(function () {
      collapseTimer = null;
      if (!collapsed || sidebar.matches(':hover')) return;
      app.classList.remove('sidebar-hover-expanded');
      app.classList.add('sidebar-collapsed');
      syncButtonState();
    }, 1500);
  }

  button.addEventListener('click', function () {
    clearTimers();
    var isExpanded = !collapsed || app.classList.contains('sidebar-hover-expanded');
    if (isExpanded) {
      app.classList.remove('sidebar-hover-expanded');
      setCollapsed(true, true);
    } else {
      setCollapsed(false, true);
    }
  });
  sidebar.addEventListener('mouseenter', function () {
    window.clearTimeout(collapseTimer);
    collapseTimer = null;
    scheduleHoverExpansion();
  });
  sidebar.addEventListener('mouseleave', function () {
    window.clearTimeout(expandTimer);
    expandTimer = null;
    scheduleHoverCollapse();
  });
  window.addEventListener('resize', function () {
    clearTimers();
    if (window.innerWidth <= 820 && app.classList.contains('sidebar-hover-expanded')) {
      app.classList.remove('sidebar-hover-expanded');
      app.classList.add('sidebar-collapsed');
    }
    syncButtonState();
  });
  setCollapsed(collapsed, false);
}

document.addEventListener('DOMContentLoaded', initCollapsibleSidebar);

function toggleNotifications(e) {
  e.stopPropagation();
  var dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('open');
  if (dropdown.classList.contains('open')) {
    initializeGlobalNotificationState().then(function() {
      markGlobalNotificationsRead();
      renderGlobalNotifications();
    });
  }
}
document.addEventListener('click', function(e) {
  var dropdown = document.getElementById('notif-dropdown');
  var btn = document.getElementById('notif-btn');
  if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
    dropdown.classList.remove('open');
  }
});

/* ===================== MODAL SYSTEM ===================== */
function openModal(id) {
  if (id === 'modal-suporte-ti') {
    if (window.RildonXSupport && typeof window.RildonXSupport.openRequest === 'function') {
      window.RildonXSupport.openRequest();
    } else {
      showToast('A central de suporte não está disponível. Recarregue a página e tente novamente.');
    }
    return;
  }
  document.querySelectorAll('.modal-panel').forEach(function(el){ el.classList.remove('open'); });
  var panel = document.getElementById(id);
  if (panel) panel.classList.add('open');
  document.getElementById('modal-backdrop').classList.add('open');
  if (id === 'modal-nova-tarefa') resetNovaTarefaForm();
  if (id === 'modal-reserva-sala') resetReservaSalaForm();
  if (id === 'modal-nova-publicacao') {
    var postForm = document.getElementById('quick-post-form');
    if (postForm) {
      postForm.reset();
      var postSubmit = postForm.querySelector('[type="submit"]');
      if (postSubmit) postSubmit.disabled = true;
      syncSocialComposerFields(postForm);
      updateSocialComposerFiles(postForm);
    }
  }
  if (id === 'modal-novo-evento') document.getElementById('quick-event-form').reset();
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.querySelectorAll('.modal-panel').forEach(function(el){ el.classList.remove('open'); });
}

/* ===================== TOASTS ===================== */
function escapeHtml(value) {
  var str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function showToast(message) {
  var wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  var toast = document.createElement('div');
  toast.className = 'toast';
  var safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  toast.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>' + safeMessage + '</span>';
  wrap.appendChild(toast);
  setTimeout(function(){
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(function(){ toast.remove(); }, 300);
  }, 4200);
}
function nowStamp() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var hh = String(d.getHours()).padStart(2,'0');
  var mi = String(d.getMinutes()).padStart(2,'0');
  return dd + '/' + mm + '/2026 às ' + hh + ':' + mi;
}

function formatTaskDate(dateValue) {
  if (!dateValue) return 'Sem prazo';
  var date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('pt-BR');
}

function getPriorityClass(priority) {
  var normalized = String(priority || 'media').toLowerCase();
  if (normalized.indexOf('alta') >= 0) return 'alta';
  if (normalized.indexOf('baixa') >= 0) return 'baixa';
  return 'media';
}

function getTaskStatusKey(status) {
  var normalized = String(status || '').toLowerCase().trim();
  if (normalized.indexOf('andamento') >= 0 || normalized.indexOf('progress') >= 0) return 'andamento';
  if (normalized.indexOf('conclu') >= 0) return 'concluida';
  return 'pendente';
}

function findProfileByName(name, profiles) {
  var normalizedName = normalizeSearchText(name).trim();
  if (!normalizedName) return null;
  return (profiles || []).find(function(profile) {
    return [profile.displayName, profile.nickname].some(function(candidate) {
      return candidate && normalizeSearchText(candidate).trim() === normalizedName;
    });
  }) || null;
}

function findProfileById(profileId, profiles) {
  if (!profileId) return null;
  return (profiles || []).find(function(profile) {
    return String(profile.id) === String(profileId);
  }) || null;
}

function getProfileDisplayName(profile, fallback) {
  return profile && (profile.displayName || profile.nickname) || fallback || 'Colaborador';
}

function getMessageSenderProfile(message, profiles) {
  return findProfileById(message && message.senderId, profiles) ||
    findProfileByName(message && message.senderName, profiles);
}

function getConversationOtherProfile(conversation, state) {
  if (!conversation || conversation.kind !== 'direct') return null;
  var currentUserId = muralCurrentUserId || state.user && state.user.id;
  var memberships = (state.conversationMemberships || []).filter(function(member) {
    return member.conversationId === conversation.id && member.userId !== currentUserId;
  });
  var profile = memberships.map(function(member) {
    return findProfileById(member.userId, state.profiles);
  }).find(Boolean);
  if (profile) return profile;

  var conversationUserIds = String(conversation.id || '').match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
  ) || [];
  profile = conversationUserIds.map(function(userId) {
    return findProfileById(userId, state.profiles);
  }).find(function(candidate) {
    return candidate && candidate.id !== currentUserId;
  });
  if (profile) return profile;

  profile = findProfileByName(conversation.name, state.profiles);
  return profile && profile.id !== currentUserId ? profile : null;
}

function profileAvatarImageMarkup(profile) {
  return profile && profile.avatarUrl
    ? '<img data-profile-avatar-url="' + escapeHtml(profile.avatarUrl) + '" alt="" loading="lazy" decoding="async">'
    : '';
}

function getCurrentUserNameAliases(profiles) {
  var currentProfile = (profiles || []).find(function(profile) {
    return profile.id === muralCurrentUserId;
  });
  return [
    currentProfile && currentProfile.displayName,
    currentProfile && currentProfile.nickname
  ].concat(muralCurrentUserNameAliases).filter(Boolean).map(function(name) {
    return normalizeSearchText(name).trim();
  });
}

function matchesCurrentUser(value, nameAliases) {
  if (!muralCurrentUserId || value === null || value === undefined) return false;
  if (typeof value === 'object') {
    return matchesCurrentUser(value.id || value.userId || value.user_id, nameAliases) ||
      matchesCurrentUser(value.name || value.displayName || value.nickname, nameAliases);
  }
  var candidate = String(value).trim();
  return candidate === muralCurrentUserId ||
    nameAliases.indexOf(normalizeSearchText(candidate)) !== -1;
}

function isCurrentUserProject(project, nameAliases) {
  return matchesCurrentUser(project.createdBy, nameAliases) ||
    (Array.isArray(project.members) && project.members.some(function(member) {
      return matchesCurrentUser(member, nameAliases);
    }));
}

function isCurrentUserTask(task, nameAliases) {
  return matchesCurrentUser(task.createdBy, nameAliases) ||
    (Array.isArray(task.viewerIds) && task.viewerIds.some(function(viewerId) {
      return matchesCurrentUser(viewerId, nameAliases);
    })) ||
    (Array.isArray(task.assignees) && task.assignees.some(function(assignee) {
      return matchesCurrentUser(assignee, nameAliases);
    }));
}

function renderTaskRow(task) {
  var status = getTaskStatusKey(task.status);
  var priorityClass = getPriorityClass(task.priority);
  var title = escapeHtml(task.title || 'Tarefa sem título');
  var meta = (task.tags && task.tags.length) ? task.tags.slice(0, 2).map(function(tag){ return '<span class="tag tag-blue">' + escapeHtml(tag) + '</span>'; }).join(' ') : '<span class="tag tag-blue">Equipe</span>';
  var state = window.RildonXStore ? window.RildonXStore.getState() : {};
  var profiles = state.profiles || [];
  var assignedProfiles = (Array.isArray(task.viewerIds) ? task.viewerIds : [])
    .filter(function(userId) { return String(userId) !== String(task.createdBy); })
    .map(function(userId) { return findProfileById(userId, profiles); })
    .filter(Boolean);
  var storedAssignees = Array.isArray(task.assignees) ? task.assignees : [];
  var assignees = assignedProfiles.length
    ? assignedProfiles.map(function(profile) { return getProfileDisplayName(profile); }).join(', ')
    : storedAssignees.map(function(assignee) {
      var value = assignee && typeof assignee === 'object'
        ? assignee.id || assignee.userId || assignee.name || assignee.displayName
        : assignee;
      var profile = findProfileById(value, profiles) || findProfileByName(value, profiles);
      return getProfileDisplayName(profile, value || 'Usuário');
    }).join(', ') || 'Usuário';
  var initials = String(assignees).split(' ').map(function(part){ return part.charAt(0); }).join('').slice(0, 2).toUpperCase() || 'U';
  var firstAssignee = assignedProfiles[0] || storedAssignees[0] || String(assignees).split(',')[0];
  initials = getPostInitials(firstAssignee || assignees);
  var firstAssigneeProfile = firstAssignee && typeof firstAssignee === 'object'
    ? firstAssignee
    : findProfileById(firstAssignee, profiles) || findProfileByName(firstAssignee, profiles);
  var avatarImage = profileAvatarImageMarkup(firstAssigneeProfile);
  var statusLabel = status === 'andamento' ? 'Em andamento' : (status === 'concluida' ? 'Concluída' : 'Pendente');

  if (status === 'andamento') {
    return [
      '<div class="task-row">',
      '  <div class="stripe" style="background:var(--blue-600);"></div>',
      '  <span class="checkbox" style="background:var(--blue-600);border-color:var(--blue-600);"></span>',
      '  <div class="task-body"><h4>' + title + '</h4><p>' + escapeHtml(task.description || assignees) + '</p>' + meta + '</div>',
      '  <div class="task-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' + formatTaskDate(task.dueDate) + '</div>',
      '  <span class="tag" style="background:var(--blue-100);color:var(--blue-600);">' + statusLabel + '</span>',
      '  <div class="task-avatar">' + escapeHtml(initials) + avatarImage + '</div>',
      '</div>'
    ].join('');
  }

  return [
    '<div class="task-row">',
    '  <div class="stripe" style="background:' + (priorityClass === 'alta' ? 'var(--red)' : (priorityClass === 'baixa' ? 'var(--green)' : 'var(--orange)')) + ';"></div>',
    '  <span class="checkbox"></span>',
    '  <div class="task-body"><h4>' + title + '</h4><p>' + escapeHtml(task.description || assignees) + '</p>' + meta + '</div>',
    '  <div class="task-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' + formatTaskDate(task.dueDate) + '</div>',
    '  <span class="priority ' + priorityClass + '">' + (priorityClass === 'alta' ? 'Alta' : (priorityClass === 'baixa' ? 'Baixa' : 'Média')) + '</span>',
    '  <div class="task-avatar">' + escapeHtml(initials) + avatarImage + '</div>',
    '</div>'
  ].join('');
}

function renderTaskListsFromStore() {
  if (!window.RildonXStore) return;

  var pendingRoot = document.getElementById('tarefas-pendentes-list');
  var ongoingRoot = document.getElementById('tarefas-andamento-list');
  if (!pendingRoot && !ongoingRoot) return;

  var tasks = (window.RildonXStore.getState().tasks || []).slice();
  var pending = tasks.filter(function(task) { return getTaskStatusKey(task.status) === 'pendente'; });
  var ongoing = tasks.filter(function(task) { return getTaskStatusKey(task.status) === 'andamento'; });
  var countPending = document.getElementById('count-chip-pendentes');
  var countOngoing = document.getElementById('count-chip-andamento');
  var countTab = document.getElementById('tab-minhas-count');
  if (countPending) countPending.textContent = String(pending.length);
  if (countOngoing) countOngoing.textContent = String(ongoing.length);
  if (countTab) countTab.textContent = String(tasks.length);

  if (pendingRoot) {
    pendingRoot.innerHTML = pending.length ? pending.map(renderTaskRow).join('') : '<div class="task-row"><div class="task-body"><h4>Sem tarefas pendentes</h4><p>Seu backlog está limpo no momento.</p></div></div>';
  }

  if (ongoingRoot) {
    ongoingRoot.innerHTML = ongoing.length ? ongoing.map(renderTaskRow).join('') : '<div class="task-row"><div class="task-body"><h4>Nenhuma tarefa em andamento</h4><p>Crie uma nova tarefa para começar.</p></div></div>';
  }
}

function renderProjectCard(project) {
  var name = escapeHtml(project.name || 'Projeto');
  var status = String(project.status || 'em-andamento').toLowerCase();
  var progress = Number(project.progress || 0);
  var members = Array.isArray(project.members) && project.members.length ? project.members : ['Usuário'];
  var ownerStored = members[0] || 'Usuário';
  var profiles = window.RildonXStore ? window.RildonXStore.getState().profiles : [];
  var ownerProfile = findProfileById(project.createdBy, profiles) || findProfileByName(ownerStored, profiles);
  var owner = getProfileDisplayName(ownerProfile, ownerStored);
  var initials = String(owner).split(' ').map(function(part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase() || 'U';
  var statusText = status.indexOf('planej') >= 0 ? 'Planejamento' : (status.indexOf('concl') >= 0 ? 'Concluído' : 'Em andamento');
  var statusClass = status.indexOf('planej') >= 0 ? 'st-planejamento' : (status.indexOf('concl') >= 0 ? 'st-concluido' : 'st-andamento');
  var progressClass = status.indexOf('planej') >= 0 ? 'orange' : (status.indexOf('concl') >= 0 ? 'purple' : '');
  var badge = status.indexOf('planej') >= 0 ? 'Planejamento' : (status.indexOf('concl') >= 0 ? 'Concluído' : 'Em andamento');

  return [
    '<div class="proj-row">',
    '  <div class="proj-thumb" style="background:linear-gradient(135deg,#0d1c40,#f5a623);display:flex;align-items:center;justify-content:center;color:#fff;font-family:\'Manrope\',sans-serif;font-weight:800;font-size:11px;text-align:center;">' + escapeHtml((project.name || 'R').slice(0, 2).toUpperCase()) + '</div>',
    '  <div class="proj-info">',
    '    <h4>' + name + '</h4>',
    '    <p>Projeto do setor ' + escapeHtml(project.sector || 'marketing') + ' com progresso atual.</p>',
    '    <span class="tag tag-blue">' + escapeHtml(project.sector || 'Equipe') + '</span><span class="tag tag-purple">' + escapeHtml(statusText) + '</span>',
    '  </div>',
    '  <div class="proj-owner"><div class="mini-avatar">' + escapeHtml(initials) + profileAvatarImageMarkup(ownerProfile) + '</div><div class="who"><b>' + escapeHtml(owner) + '</b><span>Responsável</span></div></div>',
    '  <div class="proj-progress">',
    '    <div class="status-dot ' + statusClass + '">' + badge + '</div>',
    '    <div class="progress-track"><div class="progress-fill ' + progressClass + '" style="width:' + Math.max(0, Math.min(100, progress)) + '%"></div></div>',
    '  </div>',
    '  <div class="proj-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Atualizado: ' + formatTaskDate(project.updatedAt) + '</div>',
    '  <div class="proj-more">⋮</div>',
    '</div>'
  ].join('');
}

function renderProjectsFromStore() {
  if (!window.RildonXStore) return;

  var projectCandidates = Array.prototype.slice.call(document.querySelectorAll('.card.card-pad'));
  var list = projectCandidates.find(function(item) {
    return !!item.querySelector('.proj-row');
  }) || null;

  if (!list) return;

  var projects = (window.RildonXStore.getState().projects || []).slice();
  list.innerHTML = projects.length ? projects.map(renderProjectCard).join('') : '<div class="proj-row"><div class="proj-info"><h4>Nenhum projeto disponível</h4><p>Os projetos aparecerão aqui quando forem criados.</p></div></div>';
}

var activeConversationId = 'local-test';
var activeMessageActionId = null;
var activePersonProfileId = null;
var pendingForwardMessageId = null;
var replyToMessageId = null;
var lastImagePreviewFailureToastAt = 0;

function getConversationCatalog(state) {
  var localConversation = (Array.isArray(state.conversations) ? state.conversations : []).find(function(conversation) {
    return conversation.id === 'local-test';
  });
  var local = localConversation || {
    id: 'local-test',
    name: 'Teste local',
    kind: 'local',
    description: 'Conversa local para testes.'
  };
  var visibleIds = new Set(state.visibleConversationIds || []);
  return [local].concat((Array.isArray(state.conversations) ? state.conversations : []).filter(function(conversation) {
    return conversation.id !== 'local-test' && visibleIds.has(conversation.id);
  }));
}

function getHiddenConversationIds(state) {
  if (window.RildonXIsAdmin) return new Set();
  return new Set((state.conversationReads || []).filter(function(item) {
    return item.hiddenAt;
  }).map(function(item) {
    return item.conversationId;
  }));
}

function renderConversationListFromStore() {
  if (!window.RildonXStore) return;
  var root = document.getElementById('conversations-live-root');
  if (!root) return;

  var state = window.RildonXStore.getState();
  var catalog = getConversationCatalog(state);
  var requestedConversationId = new URLSearchParams(window.location.search).get('conversation');
  if (requestedConversationId && catalog.some(function(conversation) {
    return conversation.id === requestedConversationId;
  })) {
    activeConversationId = requestedConversationId;
    window.history.replaceState(null, '', window.location.pathname);
  }
  var visibleIds = new Set(state.visibleConversationIds || []);
  var messages = (state.messages || []).filter(function(message) {
    return message.conversationId === 'local-test' && message.localOnly === true ||
      visibleIds.has(message.conversationId);
  });
  var groups = {};
  messages.forEach(function(message) {
    var key = message.conversationId || 'local-test';
    if (!groups[key]) groups[key] = [];
    groups[key].push(message);
  });

  var conversations = catalog.map(function(conversation) {
    var items = (groups[conversation.id] || []).slice().sort(function(first, second) {
      return new Date(second.sentAt || 0) - new Date(first.sentAt || 0);
    });
    return { conversation: conversation, latest: items[0] || null, count: items.length };
  }).sort(function(first, second) {
    return new Date((second.latest && second.latest.sentAt) || second.conversation.updatedAt || 0) - new Date((first.latest && first.latest.sentAt) || first.conversation.updatedAt || 0);
  });

  root.innerHTML = conversations.length ? conversations.map(function(conversation, index) {
    var latest = conversation.latest;
    var otherProfile = getConversationOtherProfile(conversation.conversation, state);
    var label = getProfileDisplayName(otherProfile, conversation.conversation.name || conversation.conversation.id);
    var isActive = activeConversationId === conversation.conversation.id || (!activeConversationId && index === 0);
    var avatar = conversation.conversation.kind === 'direct'
      ? profileAvatarImageMarkup(otherProfile)
      : profileAvatarImageMarkup({ avatarUrl: conversation.conversation.avatarUrl });
    return '<div class="conv-item' + (isActive ? ' active' : '') + '" data-conversation-id="' + escapeHtml(conversation.conversation.id) + '">' +
      '<div class="conv-avatar group">' + escapeHtml(getPostInitials(label)) + avatar + '</div>' +
      '<div class="conv-body"><div class="top-line"><b>' + escapeHtml(label) + '</b><span class="time">' + formatTaskDate(latest ? latest.sentAt : conversation.conversation.updatedAt) + '</span></div>' +
      '<div class="preview"><p>' + escapeHtml(latest ? (latest.text || 'Arquivo compartilhado') : 'Nova conversa') + '</p>' + (conversation.count ? '<span class="unread">' + conversation.count + '</span>' : '') + '</div></div></div>';
  }).join('') : '<div class="conv-item"><div class="conv-body"><div class="top-line"><b>Teste local</b></div><div class="preview"><p>Envie a primeira mensagem.</p></div></div></div>';
  hydrateProfileAvatarImages(root);

  root.querySelectorAll('[data-conversation-id]').forEach(function(item) {
    item.addEventListener('click', function() {
      activeConversationId = item.dataset.conversationId;
      renderConversationListFromStore();
      renderMessagesFromStore();
    });
  });
}

function markConversationAsRead(conversationId) {
  if (!window.RildonXSync || typeof window.RildonXSync.markConversationRead !== 'function') return;
  window.RildonXSync.markConversationRead(conversationId).catch(function(error) {
    console.error('Não foi possível atualizar a leitura da conversa:', error);
  });
}

async function openDirectConversation(profile) {
  if (!profile || !window.RildonXStore || !window.supabaseClient || !window.supabaseClient.auth) {
    throw new Error('O serviço de mensagens não está disponível.');
  }
  var userResult = await window.supabaseClient.auth.getUser();
  if (userResult.error) throw userResult.error;
  var currentUser = userResult.data && userResult.data.user;
  if (!currentUser) throw new Error('Entre novamente para iniciar uma conversa.');
  if (currentUser.id === profile.id) throw new Error('Não é possível iniciar uma conversa com seu próprio perfil.');
  if (typeof window.supabaseClient.rpc !== 'function') {
    throw new Error('A criação segura de conversas não está disponível.');
  }

  var result = await window.supabaseClient.rpc('ensure_rildonx_direct_conversation', {
    p_other_user_id: profile.id
  });
  if (result.error) throw result.error;
  var conversationId = result.data;
  if (!conversationId) throw new Error('Não foi possível identificar a conversa criada.');

  var state = window.RildonXStore.getState();
  var existing = (state.conversations || []).find(function(item) {
    return item.id === conversationId;
  });
  var conversation = window.RildonXStore.addConversation(Object.assign({}, existing || {}, {
    id: conversationId,
    name: profile.displayName || profile.nickname || 'Conversa direta',
    kind: 'direct',
    description: 'Conversa direta com ' + (profile.displayName || profile.nickname || 'colaborador'),
    createdBy: existing && existing.createdBy || currentUser.id,
    createdAt: existing && existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  var currentState = window.RildonXStore.getState();
  var visibleIds = (currentState.visibleConversationIds || []).slice();
  if (visibleIds.indexOf(conversationId) === -1) visibleIds.push(conversationId);
  var priorMemberships = currentState.conversationMemberships || [];
  var priorTargetMembership = priorMemberships.find(function(item) {
    return item.conversationId === conversationId && item.userId === profile.id;
  });
  var memberships = (currentState.conversationMemberships || []).filter(function(item) {
    return !(item.conversationId === conversationId &&
      (item.userId === currentUser.id || item.userId === profile.id));
  }).concat([
    { conversationId: conversationId, userId: currentUser.id, role: 'owner', hiddenAt: null },
    priorTargetMembership || { conversationId: conversationId, userId: profile.id, role: 'member', hiddenAt: null }
  ]);
  window.RildonXStore.setState({
    visibleConversationIds: visibleIds,
    conversationMemberships: memberships
  });
  activeConversationId = conversation.id;
  renderConversationListFromStore();
  renderMessagesFromStore();
  markConversationAsRead(conversation.id);
  var messageInput = document.getElementById('chat-message-input');
  if (messageInput) messageInput.focus();
  return conversation;
}

function renderNewConversationUsers() {
  if (!window.RildonXStore) return;
  var root = document.getElementById('new-conversation-users');
  if (!root) return;

  var state = window.RildonXStore.getState();
  var sentUserIds = new Set((state.messages || []).map(function(message) { return message.senderId; }).filter(Boolean));
  var currentUserId = state.user && state.user.id;
  var profiles = (state.profiles || []).filter(function(profile) {
    return profile.active !== false && profile.id !== currentUserId && !sentUserIds.has(profile.id);
  });

  root.innerHTML = profiles.length ? profiles.map(function(profile) {
    var initials = String(profile.displayName || profile.nickname || 'U').split(' ').map(function(part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    return '<button class="new-conversation-user" type="button" data-user-id="' + escapeHtml(profile.id) + '"><span class="conv-avatar">' + escapeHtml(initials) + profileAvatarImageMarkup(profile) + '</span><span><b>' + escapeHtml(profile.displayName || profile.nickname) + '</b><span>' + escapeHtml(profile.nickname || profile.role || 'Usuário') + '</span></span></button>';
  }).join('') : '<p class="new-conversation-empty">Nenhum usuário novo disponível.</p>';
  hydrateProfileAvatarImages(root);
}

function bindConversationDetails() {
  var chatPanel = document.querySelector('.chat-panel');
  var panel = document.getElementById('conversation-details-panel');
  var openButton = document.getElementById('details-toggle-btn');
  var closeButton = document.getElementById('details-close-btn');
  var titleButton = document.getElementById('active-conversation-name');
  if (!chatPanel || !panel || !openButton || !closeButton || chatPanel.dataset.detailsBound === 'true') return;

  function setDetailsVisible(visible) {
    panel.hidden = !visible;
    openButton.setAttribute('aria-expanded', String(visible));
  }

  openButton.addEventListener('click', function() { setDetailsVisible(true); });
  closeButton.addEventListener('click', function() { setDetailsVisible(false); });
  if (titleButton) titleButton.addEventListener('click', function() { setDetailsVisible(true); });
  chatPanel.addEventListener('click', function(event) {
    if (event.target === chatPanel) setDetailsVisible(false);
  });
  chatPanel.dataset.detailsBound = 'true';
}

function bindNewConversationMenu() {
  var menu = document.getElementById('new-conversation-menu');
  var openButtons = document.querySelectorAll('#new-conversation-btn, #new-conversation-header-btn');
  var closeButton = document.getElementById('new-conversation-close');
  if (!menu || !openButtons.length || !closeButton || menu.dataset.bound === 'true') return;

  function toggleMenu(visible) {
    menu.hidden = !visible;
    if (visible) renderNewConversationUsers();
  }

  async function startConversation(profileId) {
    var state = window.RildonXStore.getState();
    var profile = (state.profiles || []).find(function(item) { return item.id === profileId; });
    if (!profile) return;
    await openDirectConversation(profile);
    toggleMenu(false);
  }

  openButtons.forEach(function(button) { button.addEventListener('click', function() { toggleMenu(true); }); });
  closeButton.addEventListener('click', function() { toggleMenu(false); });
  menu.addEventListener('click', function(event) {
    var userButton = event.target.closest('[data-user-id]');
    if (userButton) startConversation(userButton.dataset.userId).catch(function(error) {
      console.error('Não foi possível iniciar a conversa:', error);
      if (typeof window.showToast === 'function') {
        window.showToast('Não foi possível iniciar a conversa. ' + (error && error.message ? error.message : 'Tente novamente.'));
      }
    });
  });
  menu.dataset.bound = 'true';
}

function renderMessageAttachments(message, documents) {
  if (!Array.isArray(message.attachments) || !message.attachments.length) return '';

  return message.attachments.map(function(attachment) {
    var documentId = typeof attachment === 'string' ? attachment : attachment && attachment.id;
    var documentItem = (documents || []).find(function(item) {
      return documentId && String(item.id) === String(documentId);
    }) || (attachment && typeof attachment === 'object' ? attachment : null);
    if (!documentItem) {
      return '<div class="file-bubble"><div class="doc-icon file">ARQ</div><div><b>Documento indisponível</b><span>O anexo não foi encontrado.</span></div></div>';
    }

    var fileType = String(documentItem.fileType || documentItem.mimeType || '').split('/').pop();
    var extension = String(documentItem.name || '').split('.').pop().toLowerCase();
    var labels = { doc: 'DOC', docx: 'DOC', pdf: 'PDF', ppt: 'PPT', pptx: 'PPT', xls: 'XLS', xlsx: 'XLS', png: 'IMG', jpg: 'IMG', jpeg: 'IMG' };
    var iconClass = /^[a-z0-9]+$/.test(extension) ? extension : 'file';
    var iconLabel = labels[extension] || (fileType ? fileType.slice(0, 4).toUpperCase() : 'ARQ');
    var safeId = escapeHtml(documentItem.id || documentId || '');
    var safeName = escapeHtml(documentItem.name || 'Documento compartilhado');
    if (String(documentItem.mimeType || '').indexOf('image/') === 0 ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].indexOf(extension) !== -1) {
      return [
        '<div class="image-attachment">',
        '<button class="image-preview-button" type="button" data-chat-image-preview="' + safeId + '" aria-label="Visualizar ' + safeName + ' em tamanho ampliado">',
        '<img data-document-image-id="' + safeId + '" alt="' + safeName + '" loading="lazy">',
        '</button>',
        '<div class="file-details"><b>' + safeName + '</b><span>' + escapeHtml(documentItem.sizeLabel || 'Imagem') + '</span></div>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="file-bubble">',
      '<div class="doc-icon ' + iconClass + '">' + iconLabel + '</div>',
      '<div class="file-details"><b>' + safeName + '</b><span>' + escapeHtml(fileType || 'Arquivo') + ' · ' + escapeHtml(documentItem.sizeLabel || 'Tamanho indisponível') + '</span></div>',
      '</div>'
    ].join('');
  }).join('');
}

function renderMessagesFromStore() {
  if (!window.RildonXStore) return;
  var chatRoot = document.getElementById('chat-body-live');
  if (!chatRoot) return;

  var state = window.RildonXStore.getState();
  var catalog = getConversationCatalog(state);
  if (!catalog.some(function(conversation) { return conversation.id === activeConversationId; })) {
    activeConversationId = 'local-test';
  }
  var messages = (state.messages || []).filter(function(message) {
    return message.conversationId === activeConversationId &&
      (activeConversationId !== 'local-test' || message.localOnly === true);
  }).slice().sort(function(first, second) {
    return new Date(first.sentAt || 0) - new Date(second.sentAt || 0);
  });
  var pins = state.conversationPins || {};
  var pinnedMessage = messages.find(function(message) { return message.id === pins[activeConversationId]; });
  var starredIds = new Set(state.starredMessageIds || []);
  chatRoot.innerHTML = activeConversationId ? [
    pinnedMessage ? '<div class="pinned-message" data-pinned-message-id="' + escapeHtml(pinnedMessage.id) + '"><b>Mensagem fixada</b><span>' + escapeHtml(pinnedMessage.text || 'Arquivo compartilhado') + '</span></div>' : '',
    '<div class="chat-daylabel">Hoje</div>'
  ].concat(messages.map(function(message) {
    var senderProfile = getMessageSenderProfile(message, state.profiles);
    var senderName = getProfileDisplayName(senderProfile, message.senderName || 'Equipe');
    var isSelf = state.user && message.senderId
      ? String(message.senderId) === String(state.user.id)
      : ['usuário', 'usuário silva'].indexOf(String(message.senderName || '').toLowerCase()) !== -1;
    var initials = getPostInitials(senderName);
    var reply = message.replyToId && messages.find(function(candidate) { return candidate.id === message.replyToId; });
    var replyProfile = reply && getMessageSenderProfile(reply, state.profiles);
    var bubbleText = message.text ? '<div class="bubble">' +
      (reply ? '<div class="message-reply-quote"><b>' + escapeHtml(getProfileDisplayName(replyProfile, reply.senderName || 'Usuário')) + '</b><span>' + escapeHtml(reply.text || 'Arquivo compartilhado') + '</span></div>' : '') +
      escapeHtml(message.text) + '</div>' : '';
    var attachments = renderMessageAttachments(message, state.documents);
    return [
      '  <div class="msg' + (isSelf ? ' self' : '') + (starredIds.has(message.id) ? ' starred' : '') + '" data-chat-message-id="' + escapeHtml(message.id) + '">',
      '  <div class="conv-avatar">' + escapeHtml(initials) + profileAvatarImageMarkup(senderProfile) + '</div>',
      '  <div class="msg-content">',
      '    ' + (isSelf ? '<span class="msg-time">' + formatTaskDate(message.sentAt) + ' ✓✓</span><b>' + escapeHtml(senderName) + '</b>' : '<b>' + escapeHtml(senderName) + '</b><span class="msg-time">' + formatTaskDate(message.sentAt) + '</span>'),
      '    ' + bubbleText,
      attachments,
      '  </div>',
      '  <button class="message-more-btn" type="button" data-message-menu="' + escapeHtml(message.id) + '" title="Ações da mensagem" aria-label="Ações da mensagem">⋮</button>',
      '</div>'
    ].join('');
  })).join('') : '<div class="conversation-details-empty">Nenhuma conversa selecionada.</div>';
  hydrateProfileAvatarImages(chatRoot);
  hydrateMessageImagePreviews(state.documents || []);

  var activeConversation = catalog.find(function(conversation) { return conversation.id === activeConversationId; });
  var titleRoot = document.getElementById('active-conversation-name');
  var subtitleRoot = document.getElementById('active-conversation-subtitle');
  var otherProfile = activeConversation && getConversationOtherProfile(activeConversation, state);
  var activeConversationName = activeConversation && activeConversation.kind === 'direct'
    ? getProfileDisplayName(otherProfile, activeConversation.name)
    : activeConversation && activeConversation.name;
  if (titleRoot) titleRoot.textContent = activeConversationName || 'Nenhuma conversa';
  if (subtitleRoot) subtitleRoot.textContent = activeConversation
    ? activeConversation.id === 'local-test' ? 'Conversa local para testes' :
      activeConversation.kind === 'direct' ? 'Conversa direta' : activeConversation.description || 'Conversa em grupo'
    : '';
  renderPeopleCard(state);
  renderConversationDetails(state, activeConversation, messages);
  var searchPanel = document.getElementById('chat-search-panel');
  if (searchPanel && !searchPanel.hidden) {
    renderChatSearchResults(document.getElementById('chat-search-input').value);
  }
}

function renderConversationDetails(state, conversation, messages) {
  var root = document.getElementById('conversation-details-content');
  if (!root) return;
  if (!conversation) {
    root.innerHTML = '<p class="conversation-details-empty">Selecione uma conversa para ver os detalhes.</p>';
    return;
  }
  var members = (state.conversationMemberships || []).filter(function(item) {
    return item.conversationId === conversation.id;
  });
  if (!members.length && state.user && state.user.id) members.push({ userId: state.user.id, role: 'member' });
  var memberMarkup = members.map(function(member) {
    var profile = findProfileById(member.userId, state.profiles);
    var isCurrentUser = state.user && String(member.userId) === String(state.user.id);
    var name = isCurrentUser
      ? getProfileDisplayName(profile, state.user.name || 'Você') + ' (você)'
      : getProfileDisplayName(profile, 'Participante');
    var initials = String(name).split(/\s+/).map(function(part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    return '<div class="member-row"><div class="conv-avatar" style="width:32px;height:32px;">' +
      escapeHtml(initials) + (profile ? profileAvatarImageMarkup(profile) : '') +
      '</div><div><b>' + escapeHtml(name) + '</b><span>Membro da conversa</span></div></div>';
  }).join('');
  var files = [];
  (messages || []).forEach(function(message) {
    (Array.isArray(message.attachments) ? message.attachments : []).forEach(function(attachment) {
      var id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
      var file = (state.documents || []).find(function(item) { return id && String(item.id) === String(id); }) ||
        (attachment && typeof attachment === 'object' ? attachment : null);
      if (file && !files.some(function(item) { return String(item.id) === String(file.id); })) files.push(file);
    });
  });
  var fileMarkup = files.map(function(file) {
    var extension = String(file.name || '').split('.').pop().toLowerCase();
    var label = { doc: 'DOC', docx: 'DOC', pdf: 'PDF', ppt: 'PPT', pptx: 'PPT', xls: 'XLS', xlsx: 'XLS', jpg: 'IMG', jpeg: 'IMG', png: 'IMG' }[extension] ||
      (extension ? extension.slice(0, 4).toUpperCase() : 'ARQ');
    var iconClass = /^[a-z0-9]+$/.test(extension) ? extension : 'file';
    var isImage = /^image\//.test(String(file.mimeType || '')) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].indexOf(extension) !== -1;
    return '<button class="conversation-file-preview" type="button" data-document-action="open" data-document-id="' +
      escapeHtml(file.id) + '">' +
      (isImage ? '<img data-document-image-id="' + escapeHtml(file.id) + '" alt="" loading="lazy">' : '<span class="doc-icon ' + iconClass + '">' + escapeHtml(label) + '</span>') +
      '<span><b title="' + escapeHtml(file.name || 'Arquivo compartilhado') + '">' +
      escapeHtml(file.name || 'Arquivo compartilhado') + '</b><small>' +
      escapeHtml(file.sizeLabel || 'Arquivo compartilhado') + '</small></span></button>';
  }).join('');
  var starredIds = new Set(state.starredMessageIds || []);
  var starredMessages = (messages || []).filter(function(message) { return starredIds.has(message.id); });
  var starredMarkup = starredMessages.map(function(message) {
    var senderProfile = getMessageSenderProfile(message, state.profiles);
    return '<div class="starred-message-preview"><b>' + escapeHtml(getProfileDisplayName(senderProfile, message.senderName || 'Usuário')) + '</b><span>' +
      escapeHtml(message.text || 'Arquivo compartilhado') + '</span></div>';
  }).join('');

  var otherProfile = getConversationOtherProfile(conversation, state);
  var conversationName = conversation.kind === 'direct'
    ? getProfileDisplayName(otherProfile, conversation.name)
    : conversation.name || 'Conversa';
  root.innerHTML = '<h4>' + escapeHtml(conversationName) + '</h4>' +
    '<h5>Membros (' + members.length + ')</h5>' +
    (memberMarkup || '<p class="conversation-details-empty">Os membros ainda não estão disponíveis.</p>') +
    '<h5>Arquivos enviados</h5>' +
    (fileMarkup || '<p class="conversation-details-empty">Ainda não há arquivos nesta conversa.</p>') +
    '<h5>Mensagens marcadas</h5>' +
    (starredMarkup || '<p class="conversation-details-empty">Nenhuma mensagem marcada.</p>');
  hydrateProfileAvatarImages(root);
  hydrateMessageImagePreviews(state.documents || []);
}

function renderPeopleCard(state) {
  var root = document.getElementById('conversation-people-list');
  if (!root) return;
  var currentUserId = muralCurrentUserId || state.user && state.user.id;
  var profiles = (state.profiles || []).filter(function(profile) {
    return profile.active !== false && profile.id !== currentUserId;
  });
  var visibleProfiles = profiles.slice(0, 5);
  root.innerHTML = visibleProfiles.length ? visibleProfiles.map(function(profile) {
    var name = profile.displayName || profile.nickname || 'Usuário';
    var initials = name.split(/\s+/).map(function(part) { return part.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var title = [profile.sector, profile.role].filter(Boolean).join(' · ') || 'Pessoa';
    var canSeePrivate = profile.id === currentUserId || muralCurrentUserIsAdmin;
    var contactDetails = [profile.extension && 'Ramal ' + profile.extension,
      profile.workPhone && 'Telefone corporativo ' + profile.workPhone,
      profile.workEmail && 'E-mail corporativo ' + profile.workEmail];
    if (canSeePrivate) {
      var birthday = formatBirthdayDayMonth(profile.birthday);
      contactDetails = contactDetails.concat([
        profile.personalPhone && 'Telefone pessoal ' + profile.personalPhone,
        profile.personalEmail && 'E-mail pessoal ' + profile.personalEmail,
        profile.address && 'Endereço ' + profile.address,
        birthday && 'Aniversário ' + birthday
      ]);
    }
    contactDetails = contactDetails.filter(Boolean);
    return '<div class="member-row people-card-row"><button class="people-profile-trigger" type="button" data-person-profile-id="' +
      escapeHtml(profile.id) + '" aria-label="Ver perfil de ' + escapeHtml(name) + '"><span class="conv-avatar" style="width:32px;height:32px;">' +
      escapeHtml(initials) + profileAvatarImageMarkup(profile) + '</span><span class="people-card-person-info"><b>' +
      escapeHtml(name) + '</b><span>' + escapeHtml(title) + '</span><small>' +
      escapeHtml(contactDetails.join(' · ') || 'Informações pessoais privadas') + '</small></span></button>' +
      (profile.id && profile.id !== currentUserId ? '<button type="button" class="people-send-message" data-person-message-id="' +
        escapeHtml(profile.id) + '" title="Enviar mensagem" aria-label="Enviar mensagem para ' + escapeHtml(name) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button>' : '') + '</div>';
  }).join('') : '<p class="conversation-details-empty">Nenhuma outra pessoa disponível.</p>';
  hydrateProfileAvatarImages(root);
}

function renderPeopleDirectory() {
  var root = document.getElementById('people-directory-list');
  if (!root || !window.RildonXStore) return;
  var state = window.RildonXStore.getState();
  var currentUserId = muralCurrentUserId || state.user && state.user.id;
  var profiles = state.profiles || [];
  var searchInput = document.getElementById('people-directory-search');
  var query = searchInput ? searchInput.value.trim().toLocaleLowerCase('pt-BR') : '';
  if (query) {
    profiles = profiles.filter(function(profile) {
      return [profile.displayName, profile.nickname, profile.role, profile.sector, profile.workEmail]
        .some(function(value) { return String(value || '').toLocaleLowerCase('pt-BR').includes(query); });
    });
  }
  root.innerHTML = profiles.length ? profiles.map(function(profile) {
    var name = profile.displayName || profile.nickname || 'Usuário';
    var details = [profile.sector, profile.role, profile.active === false ? 'Inativo' : ''].filter(Boolean).join(' · ') || 'Informações profissionais não informadas';
    var contacts = [profile.workEmail, profile.workPhone].filter(Boolean).join(' · ');
    return '<article class="people-directory-card"><div class="people-directory-identity">' +
      '<span class="conv-avatar">' + escapeHtml(getPostInitials(name)) + profileAvatarImageMarkup(profile) + '</span>' +
      '<div><h2>' + escapeHtml(name) + '</h2><p>' + escapeHtml(details) + '</p>' +
      (contacts ? '<small>' + escapeHtml(contacts) + '</small>' : '') + '</div></div>' +
      (profile.id !== currentUserId ? '<button type="button" class="people-send-message" data-person-message-id="' +
        escapeHtml(profile.id) + '" title="Enviar mensagem" aria-label="Enviar mensagem para ' + escapeHtml(name) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button>' :
        '<span class="people-directory-self">Você</span>') +
      '</article>';
  }).join('') : '<p class="conversation-details-empty">Nenhum usuário encontrado.</p>';
  hydrateProfileAvatarImages(root);
}

function currentUserCanManagePeople(state) {
  var currentState = state || (window.RildonXStore && window.RildonXStore.getState()) || {};
  var user = currentState.user || {};
  var profile = (currentState.profiles || []).find(function(item) {
    return String(item.id) === String(muralCurrentUserId || user.id || '');
  });
  if (!profile) return muralCurrentUserIsAdmin;
  if (profile.active === false) return false;
  var sector = normalizeSearchText(profile.sector || '');
  var role = normalizeSearchText(profile.role || '');
  var login = String(profile.nickname || user.email || '').trim().toLowerCase();
  return muralCurrentUserIsAdmin || login === 'adson.ri' ||
    sector === 'rh' || sector.indexOf('recursos humanos') === 0 ||
    /gerencia|gestao|diretoria/.test(sector) ||
    /adm|gerente|gestor|diretor/.test(role);
}

function peoplePanelPermissionMarkup(enabledPanels) {
  var catalog = (window.RildonXPanelCatalog || []).filter(function(panel) {
    return panel.sector !== 'Financeiro / Fiscal' && panel.sector !== 'Logística';
  });
  var enabled = new Set(Array.isArray(enabledPanels) ? enabledPanels : []);
  var groups = {};
  catalog.forEach(function(panel) {
    if (!groups[panel.sector]) groups[panel.sector] = [];
    groups[panel.sector].push(panel);
  });
  return Object.keys(groups).map(function(sector) {
    return '<fieldset class="people-panel-permission-group"><legend>' + escapeHtml(sector) + '</legend><div>' +
      groups[sector].map(function(panel) {
        return '<button type="button" class="people-panel-permission' + (enabled.has(panel.id) ? ' is-enabled' : '') +
          '" data-panel-permission="' + escapeHtml(panel.id) + '" data-tone="' + escapeHtml(panel.tone) +
          '" aria-pressed="' + (enabled.has(panel.id) ? 'true' : 'false') + '">' + escapeHtml(panel.title) + '</button>';
      }).join('') + '</div></fieldset>';
  }).join('');
}

async function syncPeoplePanelCatalog() {
  var client = window.supabaseClient;
  if (!client || !client.rpc) {
    throw new Error('O serviço de permissões de painéis não está disponível.');
  }
  var panelKeys = (window.RildonXPanelCatalog || []).filter(function(panel) {
    return panel.sector !== 'Financeiro / Fiscal' && panel.sector !== 'Logística';
  }).map(function(panel) { return panel.id; });
  var result = await client.rpc('sync_business_card_panel_catalog', { p_panel_keys: panelKeys });
  if (result.error) throw result.error;
}

function getPeoplePurchasePanelIds() {
  return (window.RildonXPanelCatalog || []).filter(function(panel) {
    return normalizeSearchText(panel.sector) === 'compras';
  }).map(function(panel) {
    return panel.id;
  });
}

function isStalePeoplePanelError(error) {
  return /enabled panel list contains an invalid panel identifier|lista de pain[eé]is.*(?:mudou|desatualizad|op[cç][aã]o)|panel list changed/i
    .test(error && error.message || '');
}

function profileInitialPanelPermissions(profile) {
  var catalog = (window.RildonXPanelCatalog || []).filter(function(panel) {
    return panel.sector !== 'Financeiro / Fiscal' && panel.sector !== 'Logística';
  });
  if (Array.isArray(profile.enabledPanels)) {
    var availablePanelIds = new Set(catalog.map(function(panel) { return panel.id; }));
    return profile.enabledPanels.filter(function(panelId) { return availablePanelIds.has(panelId); });
  }
  var sector = normalizeSearchText(profile.sector || '');
  var role = normalizeSearchText(profile.role || '');
  var login = String(profile.nickname || '').trim().toLowerCase();
  if (login === 'adson.ri' || /gerente|gestor|diretor|administrador/.test(role) ||
      /gerencia|gestao|diretoria/.test(sector)) {
    return catalog.map(function(panel) { return panel.id; });
  }
  if (sector.indexOf('comercial') === 0 && sector.indexOf('compras') !== -1) {
    return catalog.filter(function(panel) {
      return panel.sector === 'Comercial' || panel.sector === 'Compras';
    }).map(function(panel) { return panel.id; });
  }
  var sectorKey = sector === 'rh' || sector === 'rh/dp' || sector.indexOf('recursos humanos') === 0 ? 'RH/DP' :
    sector === 'ti' || sector.indexOf('tecnologia') === 0 || sector.indexOf('infra') === 0 ? 'TI' :
    sector.indexOf('qualidade') === 0 || sector === 'quality' || sector.indexOf('sgq') === 0 ? 'Qualidade' :
    sector.indexOf('marketing') === 0 || sector.indexOf('comunicacao') === 0 ? 'Marketing' :
    sector.indexOf('comercial') === 0 || sector.indexOf('vendas') === 0 ? 'Comercial' :
    sector.indexOf('compras') === 0 ? 'Compras' : '';
  return catalog.filter(function(panel) {
    return (panel.sector === sectorKey || panel.id === 'it-support-tickets') &&
      panel.id !== 'hr-recruitment';
  }).map(function(panel) { return panel.id; });
}

function openPeopleUserForm() {
  var state = window.RildonXStore && window.RildonXStore.getState();
  if (!currentUserCanManagePeople(state)) {
    showToast('Somente RH, Gestão e o administrador autorizado podem cadastrar usuários.');
    return;
  }
  var modal = document.getElementById('people-user-form-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'person-profile-backdrop';
    modal.id = 'people-user-form-modal';
    modal.innerHTML = '<section class="person-profile-panel people-user-form-panel" role="dialog" aria-modal="true" aria-labelledby="people-user-form-title">' +
      '<div class="document-share-head"><div><h3 id="people-user-form-title">Cadastrar Usuário</h3><p>Nenhum e-mail será enviado. Defina uma senha temporária para o primeiro acesso.</p></div><button type="button" data-close-people-user-form aria-label="Fechar cadastro">×</button></div>' +
      '<form id="people-user-form"><h4>Informações pessoais</h4><div class="people-user-form-fields">' +
      '<label class="person-profile-field"><span>Nome completo *</span><input name="displayName" required maxlength="120"></label>' +
      '<label class="person-profile-field"><span>Data de nascimento</span><input name="birthday" type="date"></label>' +
      '<label class="person-profile-field"><span>E-mail pessoal</span><input name="personalEmail" type="email"></label>' +
      '<label class="person-profile-field"><span>Telefone pessoal</span><input name="personalPhone" type="tel"></label>' +
      '<label class="person-profile-field"><span>Endereço</span><input name="address" maxlength="300"></label></div>' +
      '<h4>Informações profissionais</h4><div class="people-user-form-fields">' +
      '<label class="person-profile-field"><span>Área / departamento *</span><input name="sector" required maxlength="100"></label>' +
      '<label class="person-profile-field"><span>Cargo *</span><input name="role" required maxlength="100"></label>' +
      '<label class="person-profile-field"><span>E-mail corporativo / login *</span><input name="workEmail" type="email" required maxlength="254"></label>' +
      '<label class="person-profile-field"><span>Senha temporária * (mín. 6 caracteres)</span><input name="initialPassword" type="password" required minlength="6" autocomplete="new-password"></label>' +
      '<label class="person-profile-field"><span>Telefone corporativo</span><input name="workPhone" type="tel" maxlength="40"></label>' +
      '<label class="person-profile-field"><span>Número de ramal</span><input name="extension" type="tel" maxlength="20"></label></div>' +
      '<p class="people-user-password-note">Entregue a senha temporária por um canal seguro. No primeiro acesso, a pessoa deverá cadastrar uma senha própria.</p>' +
      '<section class="people-panel-permissions"><h4>Painéis habilitados</h4><p>Selecione os painéis que ficarão disponíveis na biblioteca da pessoa.</p><div id="people-new-user-panel-permissions"></div></section>' +
      '<div class="people-user-form-actions"><button class="btn" type="submit">Cadastrar usuário</button></div></form></section>';
    document.body.appendChild(modal);
  }
  var form = document.getElementById('people-user-form');
  var permissions = document.getElementById('people-new-user-panel-permissions');
  if (!modal || !form || !permissions) return;
  form.reset();
  permissions.innerHTML = peoplePanelPermissionMarkup([]);
  if (!form.dataset.purchasePanelDefaultsBound) {
    ['input', 'change'].forEach(function(eventName) {
      form.elements.sector.addEventListener(eventName, function() {
        var sector = normalizeSearchText(form.elements.sector.value);
        if (sector.indexOf('compras') !== -1) {
          permissions.innerHTML = peoplePanelPermissionMarkup(profileInitialPanelPermissions({
            sector: form.elements.sector.value,
            role: form.elements.role.value
          }));
        }
      });
    });
    form.dataset.purchasePanelDefaultsBound = 'true';
  }
  modal.hidden = false;
}

async function createPeopleUser(form) {
  var state = window.RildonXStore && window.RildonXStore.getState();
  if (!currentUserCanManagePeople(state) ||
      ['inicio', 'meuespaco', 'pessoas'].indexOf(document.body.dataset.page) === -1) {
    throw new Error('Somente RH, Gestão e o administrador autorizado podem cadastrar usuários.');
  }
  if (!window.supabaseClient || !window.supabaseClient.functions) {
    throw new Error('O serviço de cadastro de usuários não está disponível.');
  }
  var email = form.elements.workEmail.value.trim().toLowerCase();
  var initialPassword = form.elements.initialPassword.value;
  if (initialPassword.length < 6) {
    throw new Error('A senha temporária deve ter pelo menos 6 caracteres.');
  }
  var body = {
    displayName: form.elements.displayName.value.trim(),
    email: email,
    initialPassword: initialPassword,
    sector: form.elements.sector.value.trim(),
    role: form.elements.role.value.trim(),
    workPhone: form.elements.workPhone.value.trim(),
    extension: form.elements.extension.value.trim(),
    birthday: form.elements.birthday.value || null,
    personalEmail: form.elements.personalEmail.value.trim(),
    personalPhone: form.elements.personalPhone.value.trim(),
    address: form.elements.address.value.trim(),
    enabledPanels: Array.from(form.querySelectorAll('[data-panel-permission][aria-pressed="true"]'))
      .map(function(button) { return button.dataset.panelPermission; })
  };
  if (normalizeSearchText(body.sector).indexOf('compras') !== -1) {
    body.enabledPanels = Array.from(new Set(body.enabledPanels.concat(getPeoplePurchasePanelIds())));
  }
  await syncPeoplePanelCatalog();
  var result = await window.supabaseClient.functions.invoke('invite-rildonx-user', { body: body });
  async function responseErrorMessage(error) {
    var context = error && error.context;
    var responseError = context && typeof context.json === 'function'
      ? await context.clone().json().catch(function() { return null; })
      : context && context.body;
    return responseError && typeof responseError === 'object' && responseError.error
      ? responseError.error
      : error && error.message || '';
  }
  if (result.error && /lista de pain[eé]is.*(?:mudou|desatualizad|op[cç][aã]o)|panel list changed/i.test(await responseErrorMessage(result.error))) {
    console.warn('O catálogo de painéis divergiu durante o cadastro; sincronizando e tentando novamente.');
    await syncPeoplePanelCatalog();
    result = await window.supabaseClient.functions.invoke('invite-rildonx-user', { body: body });
    if (result.error && /lista de pain[eé]is.*(?:mudou|desatualizad|op[cç][aã]o)|panel list changed/i.test(await responseErrorMessage(result.error))) {
      throw new Error('O catálogo de painéis do Supabase continua desatualizado. Aplique docs/supabase-panel-catalog-sync.sql no Supabase e tente novamente.');
    }
  }
  if (result.error) {
    if (/failed to send a request to the edge function/i.test(result.error.message || '')) {
      console.error('Falha de rede/CORS ao cadastrar usuário:', result.error);
      throw new Error('Não foi possível conectar ao serviço de cadastro. Confirme se a Edge Function invite-rildonx-user está publicada e se EMPLOYEE_CONTROL_APP_URL corresponde exatamente ao domínio aberto no navegador (incluindo protocolo e porta). Verifique também bloqueios de rede/extensões.');
    }
    throw new Error(await responseErrorMessage(result.error) || 'Não foi possível cadastrar o usuário.');
  }
  if (!result.data || !result.data.userId) {
    throw new Error('O serviço de cadastro retornou uma resposta inválida.');
  }
  var modal = document.getElementById('people-user-form-modal');
  if (form.elements.initialPassword) form.elements.initialPassword.value = '';
  if (modal) modal.hidden = true;
  try {
    if (!window.RildonXSync || !window.RildonXSync.refreshProfilesFromSupabase) {
      throw new Error('A atualização de perfis não está disponível.');
    }
    await window.RildonXSync.refreshProfilesFromSupabase();
    showToast('Usuário cadastrado. Compartilhe a senha temporária por um canal seguro.');
  } catch (error) {
    console.error('O usuário foi cadastrado, mas a lista Pessoas não pôde ser atualizada:', error);
    showToast('Usuário cadastrado. Atualize a página para carregar o perfil.');
  }
}

function formatBirthdayDayMonth(value) {
  var dateValue = String(value || '').slice(0, 10);
  var match = dateValue.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? match[2] + '/' + match[1] : '';
}

function startConversationWithPerson(profileId) {
  var profiles = window.RildonXStore ? window.RildonXStore.getState().profiles || [] : [];
  var profile = profiles.find(function(item) { return String(item.id) === String(profileId); });
  if (!profile) throw new Error('O perfil selecionado não está mais disponível.');
  return openDirectConversation(profile).then(function(conversation) {
    if (document.body.dataset.page !== 'messenger') {
      window.location.href = 'mensagens.html?conversation=' + encodeURIComponent(conversation.id);
    }
    return conversation;
  });
}

function renderPersonProfileEditForm(profile) {
  function field(label, name, value, type) {
    return '<label class="person-profile-field"><span>' + label + '</span><input name="' + name +
      '" type="' + (type || 'text') + '" value="' + escapeHtml(value || '') + '"></label>';
  }
  return '<form id="admin-person-profile-form" class="person-profile-edit-form" data-profile-id="' +
    escapeHtml(profile.id) + '">' +
    field('Nome completo', 'displayName', profile.displayName) +
    field('Data de nascimento', 'birthday', profile.birthday, 'date') +
    field('E-mail pessoal', 'personalEmail', profile.personalEmail, 'email') +
    field('Telefone pessoal', 'personalPhone', profile.personalPhone, 'tel') +
    field('Endereço', 'address', profile.address) +
    field('Área / departamento', 'sector', profile.sector) +
    field('Cargo', 'role', profile.role) +
    field('Número de ramal', 'extension', profile.extension, 'tel') +
    field('Telefone corporativo', 'workPhone', profile.workPhone, 'tel') +
    field('E-mail corporativo', 'workEmail', profile.workEmail, 'email') +
    '<label class="person-profile-field"><span>Foto do perfil</span><input name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>' +
    '<label class="person-profile-remove-avatar"><input name="removeAvatar" type="checkbox"> Remover foto atual</label>' +
    '<section class="people-panel-permissions"><h4>Painéis habilitados</h4><p>Os painéis selecionados ficam disponíveis para esta pessoa na biblioteca.</p>' +
    peoplePanelPermissionMarkup(profileInitialPanelPermissions(profile)) + '</section>' +
    '<button class="btn" type="submit">Salvar alterações</button></form>';
}

function showPersonProfile(profileId, editMode) {
  var state = window.RildonXStore ? window.RildonXStore.getState() : { profiles: [] };
  var profile = (state.profiles || []).find(function(item) { return String(item.id) === String(profileId); });
  var modal = document.getElementById('person-profile-modal');
  var content = document.getElementById('person-profile-content');
  if (!profile || !modal || !content) return;
  var currentUserId = muralCurrentUserId || state.user && state.user.id;
  var canManageProfiles = currentUserCanManagePeople(state) &&
    (document.body.dataset.page === 'pessoas' || document.body.dataset.page === 'messenger');
  var canSeePrivate = profile.id === currentUserId || canManageProfiles;
  activePersonProfileId = profile.id;

  function detail(label, value) {
    return '<div class="person-profile-field"><span>' + label + '</span><b>' +
      escapeHtml(value || 'Não informado') + '</b></div>';
  }
  var birthday = profile.birthday ? String(profile.birthday).slice(0, 10).split('-').reverse().join('/') : '';
  var avatar = profile.avatarUrl
    ? '<img data-profile-avatar-url="' + escapeHtml(profile.avatarUrl) + '" data-profile-avatar-name="' + escapeHtml(profile.displayName || '') + '" alt="">'
    : '';
  content.innerHTML = '<div class="person-profile-heading"><span class="conv-avatar">' +
    escapeHtml(getPostInitials(profile.displayName || profile.nickname || 'Usuário')) + avatar +
    '</span><div><h3>' + escapeHtml(profile.displayName || profile.nickname || 'Pessoa') + '</h3><p>' +
    escapeHtml([profile.sector, profile.role].filter(Boolean).join(' · ') || 'Pessoa') + '</p></div></div>' +
    (canSeePrivate ? '<h4>Informações pessoais</h4>' +
      detail('Data de nascimento', birthday) +
      detail('E-mail pessoal', profile.personalEmail) +
      detail('Telefone pessoal', profile.personalPhone) +
      detail('Endereço', profile.address) : '<p>Informações pessoais visíveis somente para a própria pessoa e administradores.</p>') +
    '<h4>Informações profissionais</h4>' +
    detail('Área / departamento', profile.sector) +
    detail('Cargo', profile.role) +
    detail('Número de ramal', profile.extension) +
    detail('Telefone corporativo', profile.workPhone) +
    detail('E-mail corporativo', profile.workEmail) +
    (canManageProfiles && editMode ? renderPersonProfileEditForm(profile) : '');
  hydrateProfileAvatarImages(content);
  var messageButton = document.getElementById('person-profile-message');
  if (messageButton) messageButton.hidden = profile.id === currentUserId;
  modal.hidden = false;
}

function updateStoredProfilesWithoutResync(profiles) {
  if (window.RildonXSync && window.RildonXSync.setProfilesFromServer) {
    window.RildonXSync.setProfilesFromServer(profiles);
  } else if (window.RildonXStore) {
    window.RildonXStore.setState({ profiles: profiles });
  }
}

async function syncBirthdayCalendar(profile) {
  if (!window.RildonXBusinessCalendarSync || !profile || !profile.id) return false;
  var birthDate = String(profile.birthday || '').slice(0, 10);
  var parts = birthDate.split('-');
  var yearNow = new Date().getFullYear();
  var entries = [];
  for (var offset = 0; offset < 5; offset += 1) {
    var year = yearNow + offset;
    var date = '';
    if (parts.length === 3 && /^\d{4}$/.test(parts[0]) && /^\d{2}$/.test(parts[1]) && /^\d{2}$/.test(parts[2])) {
      var month = Number(parts[1]);
      var day = Number(parts[2]);
      var candidate = new Date(year, month - 1, day);
      if (candidate.getMonth() === month - 1 && candidate.getDate() === day &&
          (offset > 0 || candidate >= new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))) {
        date = [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
      }
    }
    entries.push({
      slot: 'birthday-' + year,
      title: 'Aniversário · ' + (profile.displayName || profile.nickname || 'Colaborador'),
      description: 'Data comemorativa cadastrada no painel Aniversariantes.',
      date: date,
      category: 'aniversario'
    });
  }
  try {
    await window.RildonXBusinessCalendarSync.syncMany({
      source: 'hr-birthdays',
      recordId: profile.id
    }, entries);
    return false;
  } catch (error) {
    console.error('Perfil salvo, mas o aniversário não foi sincronizado com o calendário:', error);
    return true;
  }
}

async function saveAdminPersonProfile(form) {
  var profileId = form.dataset.profileId;
  var state = window.RildonXStore && window.RildonXStore.getState();
  var existingProfile = state && (state.profiles || []).find(function(profile) {
    return String(profile.id) === String(profileId);
  });
  if (!existingProfile || !window.supabaseClient || !currentUserCanManagePeople(state) ||
      (document.body.dataset.page !== 'pessoas' && document.body.dataset.page !== 'messenger')) {
    throw new Error('Somente RH, Gestão e o administrador autorizado podem editar perfis em Pessoas.');
  }
  var userResult = await window.supabaseClient.auth.getUser();
  if (userResult.error) throw userResult.error;
  var user = userResult.data && userResult.data.user;
  if (!user) throw new Error('Entre novamente para editar perfis.');

  var fileInput = form.elements.avatarFile;
  var file = fileInput.files && fileInput.files[0];
  var uploadedAvatar = null;
  var avatarUrl = existingProfile.avatarUrl || null;
  if (file) {
    if (!window.RildonXDocumentUpload || !window.RildonXDocumentUpload.uploadProfileImage) {
      throw new Error('O envio de fotos não está disponível. Recarregue a página.');
    }
    uploadedAvatar = await window.RildonXDocumentUpload.uploadProfileImage(file, profileId);
    avatarUrl = uploadedAvatar.url;
  } else if (form.elements.removeAvatar.checked) {
    avatarUrl = null;
  }

  var values = {
    display_name: form.elements.displayName.value.trim(),
    birthday: form.elements.birthday.value || null,
    personal_email: form.elements.personalEmail.value.trim(),
    personal_phone: form.elements.personalPhone.value.trim(),
    address: form.elements.address.value.trim(),
    sector: form.elements.sector.value.trim(),
    role: form.elements.role.value.trim(),
    extension: form.elements.extension.value.trim(),
    work_phone: form.elements.workPhone.value.trim(),
    work_email: form.elements.workEmail.value.trim(),
    avatar_url: avatarUrl,
    enabled_panels: Array.from(form.querySelectorAll('[data-panel-permission][aria-pressed="true"]'))
      .map(function(button) { return button.dataset.panelPermission; })
  };
  if (normalizeSearchText(values.sector).indexOf('compras') !== -1) {
    values.enabled_panels = Array.from(new Set(values.enabled_panels.concat(getPeoplePurchasePanelIds())));
  }

  try {
    await syncPeoplePanelCatalog();
    var result = await window.supabaseClient.rpc('admin_update_rildonx_profile', {
      p_profile_id: profileId,
      p_profile: values
    });
    if (result.error && isStalePeoplePanelError(result.error)) {
      await syncPeoplePanelCatalog();
      result = await window.supabaseClient.rpc('admin_update_rildonx_profile', {
        p_profile_id: profileId,
        p_profile: values
      });
      if (result.error && isStalePeoplePanelError(result.error)) {
        throw new Error('O catálogo de painéis do Supabase continua desatualizado. Aplique docs/supabase-panel-catalog-sync.sql e tente novamente.');
      }
    }
    if (result.error) throw result.error;
  } catch (error) {
    if (uploadedAvatar && window.RildonXDocumentUpload && window.RildonXDocumentUpload.removeProfileImage) {
      try {
        await window.RildonXDocumentUpload.removeProfileImage(uploadedAvatar.url, profileId);
      } catch (cleanupError) {
        console.error('Não foi possível remover a foto de perfil não salva:', cleanupError);
      }
    }
    throw error;
  }

  var updatedProfile = Object.assign({}, existingProfile, {
    displayName: values.display_name,
    birthday: values.birthday,
    personalEmail: values.personal_email,
    personalPhone: values.personal_phone,
    address: values.address,
    sector: values.sector,
    role: values.role,
    extension: values.extension,
    workPhone: values.work_phone,
    workEmail: values.work_email,
    avatarUrl: avatarUrl,
    enabledPanels: values.enabled_panels
  });
  var latestProfiles = window.RildonXStore.getState().profiles || [];
  updateStoredProfilesWithoutResync(latestProfiles.map(function(profile) {
    return profile.id === profileId ? updatedProfile : profile;
  }));
  var birthdaySyncFailed = await syncBirthdayCalendar(updatedProfile);
  if (existingProfile.avatarUrl && existingProfile.avatarUrl !== avatarUrl &&
      window.RildonXDocumentUpload && window.RildonXDocumentUpload.removeProfileImage) {
    try {
      await window.RildonXDocumentUpload.removeProfileImage(existingProfile.avatarUrl, profileId);
    } catch (cleanupError) {
      console.error('Não foi possível remover a foto de perfil anterior:', cleanupError);
    }
  }
  showPersonProfile(profileId, false);
  showToast(birthdaySyncFailed
    ? 'Perfil atualizado, mas o aniversário não sincronizou com seu calendário. Verifique as permissões do calendário.'
    : 'Perfil atualizado.');
}

function hydrateMessageImagePreviews(documents) {
  var roots = [document.getElementById('chat-body-live'), document.getElementById('conversation-details-content')].filter(Boolean);
  if (!roots.length || !window.RildonXDocumentUpload) return;

  roots.forEach(function(root) { root.querySelectorAll('img[data-document-image-id]').forEach(function(image) {
    if (image.dataset.loading === 'true' || image.dataset.loaded === 'true' || image.dataset.failed === 'true') return;
    image.dataset.loading = 'true';
    var documentItem = (documents || []).find(function(item) {
      return String(item.id) === image.dataset.documentImageId;
    });
    if (!documentItem) {
      image.dataset.loading = 'false';
      return;
    }

    window.RildonXDocumentUpload.getViewUrl(documentItem).then(function(url) {
      if (!url || !image.isConnected) return;
      image.src = url;
      image.dataset.loaded = 'true';
    }).catch(function(error) {
      console.error('Não foi possível carregar a prévia da imagem:', error);
      image.dataset.failed = 'true';
      var now = Date.now();
      if (now - lastImagePreviewFailureToastAt > 10000 && typeof window.showToast === 'function') {
        lastImagePreviewFailureToastAt = now;
        window.showToast('Não foi possível carregar a prévia da imagem. Confira o acesso ao Storage.');
      }
    }).finally(function() {
      image.dataset.loading = 'false';
    });
  }); });
}

function renderInicioTasksFromStore() {
  if (!window.RildonXStore) return;
  var listRoot = document.getElementById('inicio-recent-tasks');
  if (!listRoot) return;

  var state = window.RildonXStore.getState();
  var profiles = state.profiles || [];
  var currentNames = getCurrentUserNameAliases(profiles);
  var recent = (state.tasks || []).filter(function(task) {
    return window.RildonXIsAdmin || isCurrentUserTask(task, currentNames);
  }).slice().sort(function(first, second) {
    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  }).slice(0, 3);

  listRoot.innerHTML = recent.length ? recent.map(function(task) {
    var priorityClass = getPriorityClass(task.priority);
    var priorityLabel = priorityClass === 'alta' ? 'Alta' : (priorityClass === 'baixa' ? 'Baixa' : 'Média');
    var creator = profiles.find(function(profile) { return profile.id === task.createdBy; });
    var creatorName = creator
      ? (creator.displayName || creator.nickname)
      : (task.createdBy === muralCurrentUserId && muralCurrentUserNameAliases.length
        ? muralCurrentUserNameAliases[0]
        : 'Autor não identificado');
    var initials = getPostInitials(creatorName);
    var avatar = profileAvatarImageMarkup(creator);
    var status = getTaskStatusKey(task.status);
    var statusLabel = status === 'andamento' ? 'Em andamento' : (status === 'concluida' ? 'Concluída' : 'Pendente');
    var statusClass = status === 'andamento' ? 'andamento' : (status === 'concluida' ? 'concluida' : 'pendente');
    return '<article class="recent-task-item">' +
      '<div class="recent-task-main"><div class="recent-task-creator" aria-label="Criada por ' + escapeHtml(creatorName) + '">' +
      '<span>' + escapeHtml(initials) + '</span>' + avatar + '</div>' +
      '<div class="recent-task-title"><b>' + escapeHtml(task.title || 'Tarefa sem título') + '</b><span>' + escapeHtml(creatorName) + '</span></div>' +
      '<span class="priority ' + priorityClass + '">' + priorityLabel + '</span></div>' +
      '<div class="recent-task-meta"><span>Criada: ' + escapeHtml(formatTaskDate(task.createdAt)) + '</span>' +
      '<span>Finalizada: ' + escapeHtml(task.completedAt ? formatTaskDate(task.completedAt) : '—') + '</span>' +
      '<span class="recent-task-status ' + statusClass + '">' + escapeHtml(statusLabel) + '</span></div></article>';
  }).join('') : '<div class="recent-task-empty">Nenhuma tarefa recente criada por você ou atribuída a você.</div>';
  hydrateProfileAvatarImages(listRoot);
}

var muralCurrentUserId = '';
var muralCurrentUserIsAdmin = false;
var muralCurrentUserNameAliases = [];

function renderHomeRecentConversations() {
  if (!window.RildonXStore) return;
  var root = document.getElementById('inicio-recent-conversations');
  if (!root) return;

  var state = window.RildonXStore.getState();
  var messagesByConversation = new Map();
  (state.messages || []).forEach(function(message) {
    var id = message.conversationId || 'local-test';
    var current = messagesByConversation.get(id) || [];
    current.push(message);
    messagesByConversation.set(id, current);
  });
  var readByConversation = new Map((state.conversationReads || []).map(function(read) {
    return [read.conversationId, read.lastReadAt ? new Date(read.lastReadAt).getTime() : null];
  }));
  var conversations = getConversationCatalog(state).map(function(conversation) {
    var messages = (messagesByConversation.get(conversation.id) || []).slice().sort(function(first, second) {
      return new Date(second.sentAt || 0) - new Date(first.sentAt || 0);
    });
    var lastReadAt = readByConversation.get(conversation.id);
    var unreadCount = muralCurrentUserId ? messages.filter(function(message) {
      return Boolean(message.senderId && message.senderId !== muralCurrentUserId) &&
        (lastReadAt === undefined || lastReadAt === null || new Date(message.sentAt || 0).getTime() > lastReadAt);
    }).length : 0;
    return { conversation: conversation, latest: messages[0] || null, unreadCount: unreadCount };
  }).sort(function(first, second) {
    var firstTime = first.latest ? first.latest.sentAt : first.conversation.updatedAt;
    var secondTime = second.latest ? second.latest.sentAt : second.conversation.updatedAt;
    return new Date(secondTime || 0) - new Date(firstTime || 0);
  }).slice(0, 3);

  root.innerHTML = conversations.length ? conversations.map(function(item) {
    var message = item.latest;
    var senderProfile = getMessageSenderProfile(message, state.profiles);
    var senderName = message
      ? getProfileDisplayName(senderProfile, message.senderName || item.conversation.name)
      : item.conversation.name || 'Conversa';
    var conversation = item.conversation;
    var isDirect = conversation.kind === 'direct';
    var conversationProfile = getConversationOtherProfile(conversation, state);
    var inboundParticipant = (state.messages || []).filter(function(candidate) {
      return candidate.conversationId === conversation.id && candidate.senderId !== muralCurrentUserId;
    }).map(function(candidate) {
      var profile = findProfileById(candidate.senderId, state.profiles);
      return profile && profile.id !== muralCurrentUserId ? profile : null;
    }).find(Boolean);
    if (isDirect && !conversationProfile) conversationProfile = inboundParticipant;
    var conversationAvatar = isDirect
      ? profileAvatarImageMarkup(conversationProfile)
      : profileAvatarImageMarkup({ avatarUrl: conversation.avatarUrl });
    var avatarName = isDirect
      ? getProfileDisplayName(conversationProfile, conversation.name)
      : conversation.name || 'Grupo';
    var conversationName = isDirect ? avatarName : conversation.name || 'Conversa';
    var preview = message ? message.text || 'Arquivo compartilhado' : 'Nenhuma mensagem ainda';
    var sentAt = message ? message.sentAt : item.conversation.updatedAt;
    return '<div class="mini-row home-conversation-row">' +
      '<div class="left"><div class="task-avatar home-conversation-avatar">' + escapeHtml(getPostInitials(avatarName)) + conversationAvatar + '</div>' +
      '<div class="home-conversation-copy"><b>' + escapeHtml(conversationName) + '</b>' +
      '<span>' + escapeHtml(senderName + ': ' + preview) + '</span></div></div>' +
      '<div class="home-conversation-end">' +
      (item.unreadCount ? '<span class="home-conversation-unread" aria-label="' + item.unreadCount + ' mensagens não lidas">' + (item.unreadCount > 99 ? '99+' : item.unreadCount) + '</span>' : '') +
      '<span class="home-conversation-time">' + escapeHtml(formatPostTime(sentAt)) + '</span></div></div>';
  }).join('') : '<div class="home-widget-empty">Nenhuma conversa recente.</div>';
  hydrateProfileAvatarImages(root);
}

function getHomeEventCategory(category) {
  var normalized = String(category || 'reuniao').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  var categories = {
    reuniao: { label: 'Reunião', className: 'reuniao' },
    projeto: { label: 'Projeto', className: 'projeto' },
    acao_comercial: { label: 'Ação comercial', className: 'acao-comercial' },
    acao_de_vendas: { label: 'Ação comercial', className: 'acao-comercial' },
    feriado: { label: 'Feriado/data comemorativa', className: 'feriado' },
    feriado_data_comemorativa: { label: 'Feriado/data comemorativa', className: 'feriado' },
    data_comemorativa: { label: 'Feriado/data comemorativa', className: 'feriado' }
  };
  return categories[normalized] || categories.reuniao;
}

function formatHomeEventDate(value) {
  var date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
}

function formatHomeEventTime(value) {
  var date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function renderHomeUpcomingEvents() {
  if (!window.RildonXStore) return;
  var root = document.getElementById('inicio-upcoming-events');
  if (!root) return;

  var now = Date.now();
  var state = window.RildonXStore.getState();
  var profiles = state.profiles || [];
  var events = (state.events || []).filter(function(event) {
    var startsAt = new Date(event.startsAt || 0).getTime();
    return !event.deletedAt && Number.isFinite(startsAt) && startsAt >= now;
  }).sort(function(first, second) {
    return new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime();
  }).slice(0, 3);

  root.innerHTML = events.length ? events.map(function(event) {
    var creator = profiles.find(function(profile) { return profile.id === event.createdBy; });
    var creatorName = creator ? creator.displayName || creator.nickname : 'Organizador';
    var initials = getPostInitials(creatorName);
    var avatar = profileAvatarImageMarkup(creator);
    var category = getHomeEventCategory(event.category);
    var eventDate = event.startsAt;
    if (event.allDay && event.allDayStartDate) {
      var allDayParts = event.allDayStartDate.split('-').map(Number);
      eventDate = new Date(allDayParts[0], allDayParts[1] - 1, allDayParts[2]);
    }
    var startTime = event.allDay ? 'Dia inteiro' : formatHomeEventTime(event.startsAt);
    var endTime = event.endsAt ? formatHomeEventTime(event.endsAt) : '';
    var time = event.allDay ? 'Dia inteiro' : (endTime ? startTime + '–' + endTime : startTime);
    return '<article class="home-event-row"><div class="home-event-main">' +
      '<div class="home-event-creator" aria-label="Criado por ' + escapeHtml(creatorName) + '"><span>' +
      escapeHtml(initials) + '</span>' + avatar + '</div><div class="home-event-title"><b>' +
      escapeHtml(event.title || 'Evento') + '</b><span>' + escapeHtml(creatorName) + '</span></div>' +
      '<span class="home-event-category ' + category.className + '">' + escapeHtml(category.label) + '</span></div>' +
      '<div class="home-event-meta"><span>' + escapeHtml(formatHomeEventDate(eventDate)) + '</span>' +
      '<span>' + escapeHtml(time) + '</span><span>' + escapeHtml(event.location || 'Local não informado') + '</span></div></article>';
  }).join('') : '<div class="home-widget-empty">Nenhum evento próximo.</div>';
  hydrateProfileAvatarImages(root);
}

function renderHomeRecentDocuments() {
  if (!window.RildonXStore) return;
  var root = document.getElementById('inicio-recent-documents');
  if (!root) return;

  var state = window.RildonXStore.getState();
  var messageDocumentIds = new Set();
  (state.messages || []).forEach(function(message) {
    (Array.isArray(message.attachments) ? message.attachments : []).forEach(function(attachment) {
      var id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
      if (id) messageDocumentIds.add(String(id));
    });
  });
  var documents = (state.documents || []).filter(function(item) {
    if (!item.name || normalizeSearchText(item.folder) === 'mural') return false;
    var folder = normalizeSearchText(item.folder).trim();
    var isMessageDocument = Boolean(item.messageId) || messageDocumentIds.has(String(item.id)) ||
      folder.indexOf('mensagens nao salvas') === 0;
    if (isMessageDocument) return folder === 'mensagens';
    return !item.relatedTaskId && !item.relatedProjectId;
  }).slice().sort(function(first, second) {
    return new Date(second.sentAt || 0) - new Date(first.sentAt || 0);
  }).slice(0, 3);
  root.innerHTML = documents.length ? documents.map(function(item) {
    var extension = String(item.name || '').split('.').pop().toLowerCase();
    if (!item.name || item.name.indexOf('.') === -1) {
      extension = String(item.fileType || 'file').split('/').pop().split('.').pop().toLowerCase();
    }
    var labels = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', ppt: 'PPT', pptx: 'PPT', png: 'IMG', jpg: 'IMG', jpeg: 'IMG' };
    var fileClass = /^[a-z0-9]+$/.test(extension) ? extension : 'file';
    return '<div class="doc-row home-document-row"><div class="doc-icon ' + escapeHtml(fileClass) + '">' +
      escapeHtml(labels[extension] || extension.slice(0, 4).toUpperCase()) + '</div><div class="doc-info">' +
      '<b>' + escapeHtml(item.name || 'Arquivo sem nome') + '</b><span>' +
      escapeHtml(item.folder || 'Equipe') + ' · ' + escapeHtml(formatPostTime(item.sentAt)) + '</span></div></div>';
  }).join('') : '<div class="home-widget-empty">Nenhum documento recente.</div>';
}

function setCurrentAuthenticatedUser(user) {
  if (!user) return;
  muralCurrentUserId = user.id || '';
  var appMetadata = user.app_metadata || {};
  var adminRole = String(appMetadata.role || '').trim().toLowerCase();
  var loginName = String(user.email || '').split('@')[0].trim().toLowerCase();
  var ownProfile = window.RildonXStore && (window.RildonXStore.getState().profiles || []).find(function(profile) {
    return profile.id === user.id;
  });
  muralCurrentUserIsAdmin = appMetadata.is_admin === true ||
    adminRole === 'admin' || adminRole === 'administrator' || loginName === 'adson.ri' ||
    Boolean(ownProfile && String(ownProfile.nickname || '').trim().toLowerCase() === 'adson.ri');
  window.RildonXIsAdmin = muralCurrentUserIsAdmin;
  var metadata = user.user_metadata || {};
  var aliases = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
    user.email && user.email.split('@')[0]
  ];
  muralCurrentUserNameAliases = aliases.filter(Boolean).map(function(name) {
    return String(name).trim();
  });
  renderGlobalNotifications();
}

var globalSearchBound = false;
var notificationReadStorageKey = 'rildonx_notifications_seen_v2:';
var notificationStateReady = false;
var notificationInitializationPromise = null;

function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getGlobalSearchEntries(state) {
  var profiles = state.profiles || [];
  return []
    .concat(profiles.map(function(profile) {
      return { kind: 'Pessoa', title: profile.displayName || profile.nickname || 'Pessoa', detail: [profile.role, profile.sector].filter(Boolean).join(' · '), href: 'mensagens.html' };
    }))
    .concat((state.messages || []).map(function(message) {
      var senderProfile = findProfileById(message.senderId, profiles);
      return { kind: 'Mensagem', title: message.text || 'Arquivo compartilhado', detail: getProfileDisplayName(senderProfile, message.senderName || 'Colaborador') + ' · ' + (message.conversationId || 'Conversa'), href: 'mensagens.html', time: message.sentAt };
    }))
    .concat((state.documents || []).map(function(item) {
      return { kind: 'Documento', title: item.name || 'Arquivo sem nome', detail: item.folder || 'Equipe', href: 'documentos.html', time: item.sentAt };
    }))
    .concat((state.projects || []).map(function(project) {
      return { kind: 'Projeto', title: project.name || 'Projeto', detail: project.sector || 'Equipe', href: 'projetos.html', time: project.updatedAt };
    }))
    .concat((state.tasks || []).map(function(task) {
      return { kind: 'Tarefa', title: task.title || 'Tarefa sem título', detail: getTaskStatusLabel(task.status) + ' · ' + (task.priority || 'Média'), href: 'tarefas.html', time: task.createdAt };
    }));
}

function getTaskStatusLabel(status) {
  var key = getTaskStatusKey(status);
  return key === 'andamento' ? 'Em andamento' : key === 'concluida' ? 'Concluída' : 'Pendente';
}

function renderGlobalSearchResults(input, root) {
  var query = normalizeSearchText(input.value.trim());
  if (!query || !window.RildonXStore) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  var results = getGlobalSearchEntries(window.RildonXStore.getState()).filter(function(item) {
    return normalizeSearchText(item.title + ' ' + item.detail + ' ' + item.kind).indexOf(query) !== -1;
  }).sort(function(first, second) {
    return new Date(second.time || 0).getTime() - new Date(first.time || 0).getTime();
  }).slice(0, 12);
  root.innerHTML = results.length ? results.map(function(item) {
    return '<a class="global-search-result" href="' + item.href + '"><span class="global-search-type">' + escapeHtml(item.kind) +
      '</span><span class="global-search-result-copy"><b>' + escapeHtml(item.title) + '</b><small>' +
      escapeHtml(item.detail) + '</small></span></a>';
  }).join('') : '<div class="global-search-empty">Nenhum resultado encontrado.</div>';
  root.hidden = false;
}

function bindGlobalSearch() {
  if (globalSearchBound) return;
  globalSearchBound = true;
  document.querySelectorAll('.topbar > .search-box').forEach(function(box) {
    var input = box.querySelector('input');
    if (!input) return;
    var results = document.createElement('div');
    results.className = 'global-search-results';
    results.hidden = true;
    box.appendChild(results);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Pesquisar pessoas, mensagens, documentos, projetos e tarefas');
    input.addEventListener('input', function() { renderGlobalSearchResults(input, results); });
    input.addEventListener('focus', function() { renderGlobalSearchResults(input, results); });
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        results.hidden = true;
        input.blur();
      }
    });
  });
  document.addEventListener('click', function(event) {
    if (!event.target.closest('.topbar > .search-box')) {
      document.querySelectorAll('.global-search-results').forEach(function(result) { result.hidden = true; });
    }
  });
}

function buildGlobalNotifications(state) {
  var profiles = state.profiles || [];
  var nameAliases = getCurrentUserNameAliases(profiles);
  var readByConversation = new Map((state.conversationReads || []).map(function(read) {
    return [read.conversationId, read.lastReadAt ? new Date(read.lastReadAt).getTime() : null];
  }));
  var items = [];
  function add(item) {
    var timestamp = new Date(item.timestamp || 0).getTime();
    if (Number.isFinite(timestamp) && timestamp > 0) {
      item.timestampMs = timestamp;
      item.notificationId = String(item.notificationId || [item.category, item.href, timestamp].join(':'));
      items.push(item);
    }
  }
  function parseDeadline(value) {
    if (!value) return null;
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    var date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var deadlineItems = [];
  function addDeadline(title, source, dueValue, createdAt, href, category, futureOnly, sourceId) {
    var dueDate = parseDeadline(dueValue);
    if (!dueDate) return;
    var daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (futureOnly && daysUntil < 0) return;
    if (daysUntil > 7 || daysUntil < -30) return;
    var threshold = dueDate.getTime() - (daysUntil >= 0 ? 7 * 86400000 : 0);
    var createdAtMs = new Date(createdAt || 0).getTime();
    var timestamp = Math.max(threshold, Number.isFinite(createdAtMs) ? createdAtMs : 0);
    var timing = daysUntil < 0 ? 'Atrasado há ' + Math.abs(daysUntil) + ' dia(s)' :
      daysUntil === 0 ? 'Vence hoje' : 'Vence em ' + daysUntil + ' dia(s)';
    deadlineItems.push({
      category: category || 'Prazo',
      title: timing + ': ' + (title || 'Item com prazo'),
      detail: source + ' · ' + dueDate.toLocaleDateString('pt-BR'),
      timestamp: new Date(timestamp).toISOString(),
      notificationId: 'deadline:' + sourceId + ':' + dueDate.toISOString(),
      featured: daysUntil <= 2,
      highlightAt: dueDate.toISOString(),
      href: href,
      daysUntil: daysUntil
    });
  }
  (state.posts || []).forEach(function(post) {
    var author = getProfileDisplayName(findProfileById(post.authorId, profiles), post.authorName || 'Colaborador');
    var postType = post.type || 'atualizacao';
    add({
      category: 'Mural',
      title: author + ' publicou ' + getPostTypeLabel(postType).toLocaleLowerCase(),
      detail: post.title || post.body || 'Nova publicação no Mural',
      timestamp: post.createdAt,
      notificationId: 'post:' + post.id + ':' + (post.updatedAt || post.createdAt),
      featured: ['aviso', 'comunicado'].indexOf(postType) !== -1,
      href: 'mural.html'
    });
  });
  (state.tasks || []).forEach(function(task) {
    if (!isCurrentUserTask(task, nameAliases)) return;
    add({ category: 'Tarefa', title: task.title || 'Tarefa atualizada', detail: getTaskStatusLabel(task.status), timestamp: task.updatedAt || task.createdAt, notificationId: 'task:' + task.id + ':' + (task.updatedAt || task.createdAt), href: 'tarefas.html' });
    if (!task.isDemo && getTaskStatusKey(task.status) !== 'concluida') {
      addDeadline(task.title || 'Tarefa', 'Tarefa', task.dueDate, task.createdAt, 'tarefas.html', 'Prazo', false, task.id);
    }
  });
  (state.projects || []).forEach(function(project) {
    if (!isCurrentUserProject(project, nameAliases)) return;
    add({ category: 'Projeto', title: project.name || 'Projeto atualizado', detail: 'Projeto · ' + (project.status || 'Atualizado'), timestamp: project.updatedAt, notificationId: 'project:' + project.id + ':' + project.updatedAt, href: 'projetos.html' });
    if (!project.archived && !/conclu|complete|cancel/i.test(normalizeSearchText(project.status || ''))) {
      addDeadline(project.name || 'Projeto', 'Projeto', project.endDate, project.createdAt, 'projetos.html', 'Prazo', false, project.id);
    }
  });
  (state.messages || []).forEach(function(message) {
    if (muralCurrentUserId && message.senderId === muralCurrentUserId) return;
    var lastReadAt = readByConversation.get(message.conversationId || 'local-test');
    if (lastReadAt && new Date(message.sentAt || 0).getTime() <= lastReadAt) return;
    var senderProfile = findProfileById(message.senderId, state.profiles);
    add({ category: 'Mensagem', title: getProfileDisplayName(senderProfile, message.senderName || 'Nova mensagem'), detail: message.text || 'Compartilhou um arquivo', timestamp: message.sentAt, notificationId: 'message:' + message.id, href: 'mensagens.html' });
  });
  (state.documents || []).forEach(function(item) {
    add({ category: 'Documento', title: 'Novo arquivo: ' + (item.name || 'Documento'), detail: item.folder || 'Equipe', timestamp: item.sentAt, notificationId: 'document:' + item.id, href: 'documentos.html' });
  });
  (state.events || []).forEach(function(event) {
    if (event.deletedAt || new Date(event.startsAt || 0).getTime() < Date.now()) return;
    var category = getHomeEventCategory(event.category);
    var eventDate = event.startsAt;
    if (event.allDay && event.allDayStartDate) {
      var allDayParts = event.allDayStartDate.split('-').map(Number);
      eventDate = new Date(allDayParts[0], allDayParts[1] - 1, allDayParts[2]);
    }
    add({
      category: category.label,
      title: event.title || 'Evento próximo',
      detail: (event.location || 'Local não informado') + ' · ' + formatHomeEventDate(eventDate),
      timestamp: event.createdAt,
      notificationId: 'event:' + event.id + ':' + (event.updatedAt || event.createdAt),
      featured: true,
      highlightAt: event.allDay && event.allDayStartDate ? event.allDayStartDate : event.startsAt,
      href: 'calendario.html'
    });
  });
  var businessDeadlines = {
    'marketing-content-calendar': { field: 'publishAt', label: 'Calendário de Conteúdo', closed: ['publicado', 'cancelado'] },
    'it-infrastructure': { field: 'nextMaintenance', label: 'Manutenção', closed: ['concluido', 'cancelado'] },
    'hr-leave-attendance': { field: 'startDate', label: 'Férias e Ponto', requiredStatus: 'aprovado', closed: ['recusado', 'concluido', 'cancelado'], futureOnly: true },
    'hr-training': { field: 'date', label: 'Treinamentos e Desenvolvimento', closed: ['concluido', 'cancelado'] },
    'sales-pipeline': { field: 'nextContact', label: 'Pipeline de Vendas', closed: ['ganho', 'perdido'] },
    'finance-payables-receivables': { field: 'dueDate', label: 'Contas a Pagar e Receber', closed: ['pago', 'recebido', 'cancelado'] },
    'finance-tax-obligations': { field: 'dueDate', label: 'Obrigações Fiscais', closed: ['enviada', 'concluido', 'cancelado'] },
    'logistics-deliveries': { field: 'dueDate', label: 'Entregas e Transportes', closed: ['entregue', 'cancelado'] }
  };
  var currentProfile = (state.profiles || []).find(function(profile) {
    return profile.id === muralCurrentUserId;
  });
  var currentSector = normalizeSearchText(currentProfile && currentProfile.sector || '');
  var purchasesNotificationRecipient = Boolean(currentProfile && currentSector.indexOf('compras') !== -1);
  (state.businessCardRecords || []).forEach(function(record) {
    if (record.moduleKey === 'purchase-parts-requests') {
      if (purchasesNotificationRecipient &&
          record.createdBy !== muralCurrentUserId && !record.archived) {
        var request = record.data || {};
        add({
          category: 'Solicitação de peças',
          title: 'Nova solicitação: ' + (request.partName || record.title || 'Peça'),
          detail: (request.requesterName || 'Vendas') + ' · ' + (request.reference || 'Sem referência'),
          timestamp: record.createdAt,
          notificationId: 'purchase-parts-request:' + record.id,
          featured: true,
          href: 'meu-espaco.html?businessCard=' + encodeURIComponent(record.moduleKey)
        });
      }
      return;
    }
    var deadline = businessDeadlines[record.moduleKey];
    if (!deadline || record.archived) return;
    var data = record.data || {};
    var status = normalizeSearchText(record.status || data.status || '');
    if (record.moduleKey === 'it-infrastructure' && (status === 'atencao' || status === 'indisponivel')) {
      var href = 'meu-espaco.html?businessCard=' + encodeURIComponent(record.moduleKey) +
        '&record=' + encodeURIComponent(record.id);
      add({
        category: 'Infraestrutura',
        title: (status === 'indisponivel' ? 'Indisponível: ' : 'Atenção: ') + (record.title || 'Sistema ou equipamento'),
        detail: data.incidentNotes || 'Verifique o status e as ações registradas pela equipe de TI.',
        timestamp: record.updatedAt || record.createdAt,
        notificationId: 'business:' + record.id + ':' + (record.updatedAt || record.createdAt),
        featured: status === 'indisponivel',
        highlightAt: record.updatedAt || record.createdAt,
        href: href
      });
    }
    var approvalStatus = data.approval && data.approval.status;
    if ((deadline.requiredStatus && status !== deadline.requiredStatus) ||
        (deadline.closed || []).some(function(value) { return status.indexOf(value) !== -1; }) ||
        (deadline.closedApproval || []).indexOf(approvalStatus) !== -1) return;
    var href = 'meu-espaco.html?businessCard=' + encodeURIComponent(record.moduleKey) +
      '&record=' + encodeURIComponent(record.id);
    addDeadline(record.title || deadline.label, deadline.label, data[deadline.field], record.createdAt, href, 'Prazo', deadline.futureOnly, record.id);
  });
  deadlineItems.sort(function(first, second) {
    return first.daysUntil - second.daysUntil ||
      new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime();
  }).slice(0, 30).forEach(add);
  return items.sort(function(first, second) { return second.timestampMs - first.timestampMs; });
}

function getGlobalNotificationReadKey() {
  return notificationReadStorageKey + (muralCurrentUserId || 'guest');
}

function getGlobalNotificationInitializedKey() {
  return getGlobalNotificationReadKey() + ':initialized';
}

function getGlobalNotificationId(item) {
  return String(item.notificationId || [item.category, item.href, item.timestampMs].join(':'));
}

function getReadGlobalNotificationIds() {
  try {
    var stored = localStorage.getItem(getGlobalNotificationReadKey());
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (error) {
    console.error('Não foi possível ler as notificações visualizadas:', error);
    return new Set();
  }
}

function saveReadGlobalNotificationIds(ids) {
  try {
    localStorage.setItem(getGlobalNotificationReadKey(), JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error('Não foi possível salvar as notificações visualizadas:', error);
  }
}

function initializeGlobalNotificationState() {
  if (notificationStateReady) return Promise.resolve();
  if (notificationInitializationPromise) return notificationInitializationPromise;
  notificationInitializationPromise = Promise.resolve()
    .then(function() {
      return window.RildonXSync && typeof window.RildonXSync.ready === 'function'
        ? window.RildonXSync.ready()
        : undefined;
    })
    .then(function() {
      if (window.supabaseClient && window.supabaseClient.auth) {
        return window.supabaseClient.auth.getUser().then(function(result) {
          if (result.error) throw result.error;
          if (result.data && result.data.user) setCurrentAuthenticatedUser(result.data.user);
        });
      }
      return undefined;
    })
    .then(function() {
      var initialized = false;
      try {
        initialized = localStorage.getItem(getGlobalNotificationInitializedKey()) === 'true';
      } catch (error) {
        console.error('Não foi possível verificar o estado inicial das notificações:', error);
      }
      if (!initialized) {
        var notifications = window.RildonXStore
          ? buildGlobalNotifications(window.RildonXStore.getState())
          : [];
        saveReadGlobalNotificationIds(new Set(notifications.map(getGlobalNotificationId)));
        try {
          localStorage.setItem(getGlobalNotificationInitializedKey(), 'true');
        } catch (error) {
          console.error('Não foi possível salvar o estado inicial das notificações:', error);
        }
      }
      notificationStateReady = true;
    })
    .catch(function(error) {
      notificationInitializationPromise = null;
      console.error('Não foi possível inicializar as notificações:', error);
    });
  return notificationInitializationPromise;
}

function markGlobalNotificationsRead(items) {
  var notifications = items || (window.RildonXStore
    ? buildGlobalNotifications(window.RildonXStore.getState())
    : []);
  var readIds = getReadGlobalNotificationIds();
  notifications.forEach(function(item) { readIds.add(getGlobalNotificationId(item)); });
  saveReadGlobalNotificationIds(readIds);
  try {
    localStorage.setItem(getGlobalNotificationInitializedKey(), 'true');
  } catch (error) {
    console.error('Não foi possível salvar o estado das notificações:', error);
  }
  notificationStateReady = true;
  updateGlobalNotificationBadge(notifications);
}

function updateGlobalNotificationBadge(items) {
  var badge = document.querySelector('#notif-btn .badge');
  if (!badge || !window.RildonXStore) return;
  var notifications = items || buildGlobalNotifications(window.RildonXStore.getState());
  if (!notificationStateReady) {
    badge.hidden = true;
    initializeGlobalNotificationState().then(renderGlobalNotifications);
    return;
  }
  var readIds = getReadGlobalNotificationIds();
  var unread = notifications.filter(function(item) {
    return !readIds.has(getGlobalNotificationId(item));
  }).length;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.hidden = unread === 0;
  var button = badge.closest('#notif-btn');
  if (button) button.setAttribute('aria-label', unread ? 'Notificações, ' + unread + ' não lidas' : 'Notificações');
}

function renderGlobalNotifications() {
  if (!window.RildonXStore) return;
  var items = buildGlobalNotifications(window.RildonXStore.getState());
  if (!notificationStateReady) {
    initializeGlobalNotificationState().then(renderGlobalNotifications);
    return;
  }
  updateGlobalNotificationBadge(items);
  var root = document.getElementById('notif-dropdown');
  if (!root) return;
  var muralHighlights = items.filter(function(item) { return item.featured && item.category === 'Mural'; }).slice(0, 3);
  var eventHighlights = items.filter(function(item) { return item.featured && item.category !== 'Mural'; })
    .sort(function(first, second) { return new Date(first.highlightAt || 0) - new Date(second.highlightAt || 0); }).slice(0, 3);
  var highlights = muralHighlights.concat(eventHighlights);
  var readIds = getReadGlobalNotificationIds();
  var highlightHtml = highlights.length
    ? '<section class="notification-highlights"><h4>Destaques</h4>' + highlights.map(function(item) {
      return '<a class="notification-highlight" href="' + escapeHtml(item.href) + '"><b>' + escapeHtml(item.title) + '</b><span>' + escapeHtml(item.detail) + '</span></a>';
    }).join('') + '</section>'
    : '';
  var activityHtml = items.slice(0, 10).map(function(item) {
    var unread = !readIds.has(getGlobalNotificationId(item));
    return '<a class="activity-row' + (unread ? ' notification-unread' : '') + '" href="' + escapeHtml(item.href) + '">' +
      '<span class="notification-dot"></span><span class="activity-text"><b>' + escapeHtml(item.title) +
      '</b><span class="activity-sub">' + escapeHtml(item.category + ' · ' + item.detail) +
      '</span></span><time class="activity-time">' + escapeHtml(formatPostTime(item.timestamp)) +
      '</time></a>';
  }).join('');
  root.innerHTML = '<div class="notif-dropdown-head"><h3>Notificações</h3><span class="see-all">' +
    items.length + ' atividade' + (items.length === 1 ? '' : 's') + '</span></div>' + highlightHtml +
    '<section><h4 class="notification-section-title">Atividade recente</h4><div class="activity-list">' +
    (activityHtml || '<div class="home-widget-empty">Nenhuma atualização para exibir.</div>') + '</div></section>';
}

window.addEventListener('storage', function(event) {
  if (event.key && event.key.indexOf(notificationReadStorageKey) === 0) {
    renderGlobalNotifications();
  }
});

function bindGlobalHeaderActions() {
  document.querySelectorAll('.topbar-right .icon-btn[title="Ajuda"]').forEach(function(button) {
    button.addEventListener('click', function() { window.location.href = 'ajuda.html'; });
  });
  document.querySelectorAll('.topbar-right .user-chip').forEach(function(chip) {
    var wrapper = chip.parentElement;
    if (!wrapper || !wrapper.classList.contains('user-menu-wrap')) {
      wrapper = document.createElement('div');
      wrapper.className = 'user-menu-wrap';
      chip.parentNode.insertBefore(wrapper, chip);
      wrapper.appendChild(chip);
      var menu = document.createElement('div');
      menu.className = 'user-menu-dropdown';
      menu.innerHTML = '<a href="perfil.html"><span>Perfil</span><small>Dados e contato</small></a>' +
        '<a href="configuracoes.html"><span>Configurações</span><small>Tema, segurança e privacidade</small></a>' +
        '<button type="button" data-user-menu-action="switch-account"><span>Trocar de conta</span><small>Encerrar esta sessão</small></button>';
      wrapper.appendChild(menu);
    }
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', 'Abrir menu do usuário');
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    if (chip.dataset.menuBound === 'true') return;
    chip.dataset.menuBound = 'true';
    chip.addEventListener('click', function(event) {
      event.stopPropagation();
      var shouldOpen = !wrapper.classList.contains('open');
      document.querySelectorAll('.user-menu-wrap.open').forEach(function(openMenu) {
        openMenu.classList.remove('open');
        var openChip = openMenu.querySelector('.user-chip');
        if (openChip) openChip.setAttribute('aria-expanded', 'false');
      });
      wrapper.classList.toggle('open', shouldOpen);
      chip.setAttribute('aria-expanded', String(shouldOpen));
    });
    chip.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        chip.click();
      }
    });
  });
  document.querySelectorAll('[data-user-menu-action="switch-account"]').forEach(function(button) {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', function() {
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        window.location.href = 'login.html';
        return;
      }
      window.supabaseClient.auth.signOut().then(function(result) {
        if (result.error) throw result.error;
        window.location.href = 'login.html';
      }).catch(function(error) {
        console.error('Não foi possível trocar de conta:', error);
        showToast('Não foi possível trocar de conta. Tente novamente.');
      });
    });
  });
  document.addEventListener('click', function(event) {
    if (event.target.closest('.user-menu-wrap')) return;
    document.querySelectorAll('.user-menu-wrap.open').forEach(function(wrapper) {
      wrapper.classList.remove('open');
      var chip = wrapper.querySelector('.user-chip');
      if (chip) chip.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.user-menu-wrap.open').forEach(function(wrapper) {
      wrapper.classList.remove('open');
      var chip = wrapper.querySelector('.user-chip');
      if (chip) {
        chip.setAttribute('aria-expanded', 'false');
        chip.focus();
      }
    });
    var quickCreate = document.getElementById('quick-create-menu');
    if (quickCreate) {
      quickCreate.classList.remove('open');
      var trigger = document.getElementById('quick-create-button');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderGlobalUserSummary() {
  if (!window.supabaseClient || !window.supabaseClient.auth) return;
  window.supabaseClient.auth.getUser().then(function(result) {
    if (result.error) throw result.error;
    if (!result.data.user) return;
    var user = result.data.user;
    setCurrentAuthenticatedUser(user);
    window.rildonxRemoteAppearance = user.user_metadata && user.user_metadata.appearance || {};
    var state = window.RildonXStore ? window.RildonXStore.getState() : { profiles: [] };
    var profile = (state.profiles || []).find(function(item) { return item.id === user.id; });
    var metadata = user.user_metadata || {};
    var name = profile && profile.displayName && profile.displayName !== 'Usuário'
      ? profile.displayName
      : muralCurrentUserNameAliases[0] || user.email || 'Usuário';
    var role = profile && profile.role || metadata.role || '';
    var avatarUrl = profile && profile.avatarUrl || metadata.avatar_url || '';
    document.querySelectorAll('.topbar-right .user-chip').forEach(function(chip) {
      var nameNode = chip.querySelector('.user-name');
      var roleNode = chip.querySelector('.user-role');
      var avatarNode = chip.querySelector('.avatar');
      if (nameNode) nameNode.textContent = name;
      if (roleNode) roleNode.textContent = role;
      if (avatarNode) setProfileAvatarContent(avatarNode, name, avatarUrl);
    });
    var profileForm = document.getElementById('profile-settings-form');
    if (profileForm) {
      profileForm.elements.fullName.value = name;
      profileForm.elements.role.value = role === 'Conta' ? '' : role;
      profileForm.elements.sector.value = profile && profile.sector || metadata.sector || '';
      profileForm.elements.birthday.value = profile && profile.birthday || metadata.birthday || '';
      profileForm.elements.personalEmail.value = profile && profile.personalEmail || metadata.personal_email || '';
      profileForm.elements.personalPhone.value = profile && profile.personalPhone || metadata.personal_phone || metadata.phone || '';
      profileForm.elements.address.value = profile && profile.address || metadata.address || metadata.location || '';
      profileForm.elements.extension.value = profile && profile.extension || metadata.extension || '';
      profileForm.elements.workPhone.value = profile && profile.workPhone || '';
      profileForm.elements.workEmail.value = profile && profile.workEmail || '';
      setProfileAvatarPreview(profileForm, avatarUrl, name);
    }
    var appearance = getAppearancePreferences();
    var appearanceForm = document.getElementById('appearance-settings-form');
    if (appearanceForm) {
      appearanceForm.elements.theme.value = appearance.theme;
      appearanceForm.elements.background.value = appearance.background;
    }
    applySavedTheme(appearance.theme);
    updateSignedInUserPresentation(name, role, avatarUrl);
    renderHomeRecentConversations();
    renderInicioTasksFromStore();
    renderGlobalNotifications();
    renderGlobalNotificationBadge();
  }).catch(function(error) {
    console.error('Não foi possível carregar o perfil do usuário:', error);
  });
}

function updateSignedInUserPresentation(name, role, avatarUrl) {
  var initials = getPostInitials(name);
  document.querySelectorAll('.topbar-right .user-chip, .social-composer-identity').forEach(function(container) {
    var nameNode = container.querySelector('.user-name, .social-composer-author-name');
    var roleNode = container.querySelector('.user-role, .social-composer-role');
    var avatarNode = container.querySelector('.avatar, .social-composer-avatar');
    if (nameNode) nameNode.textContent = name;
    if (roleNode) roleNode.textContent = role || 'Cargo não informado';
    if (avatarNode) setProfileAvatarContent(avatarNode, name, avatarUrl);
  });
  var greeting = document.querySelector('.greet-banner h1');
  if (greeting) greeting.textContent = 'Bom dia, ' + name + '! 👋';
}

function renderGlobalProfileFromStore() {
  if (!muralCurrentUserId || !window.RildonXStore) return;
  var profile = (window.RildonXStore.getState().profiles || []).find(function(item) {
    return item.id === muralCurrentUserId;
  });
  if (!profile) return;
  document.querySelectorAll('.topbar-right .user-chip').forEach(function(chip) {
    var nameNode = chip.querySelector('.user-name');
    var roleNode = chip.querySelector('.user-role');
    var avatarNode = chip.querySelector('.avatar');
    if (nameNode) nameNode.textContent = profile.displayName || profile.nickname || nameNode.textContent;
    if (roleNode && profile.role) roleNode.textContent = profile.role;
    if (avatarNode) avatarNode.textContent = getPostInitials(profile.displayName || profile.nickname || nameNode.textContent);
  });
  updateSignedInUserPresentation(
    profile.displayName || profile.nickname || 'Usuário',
    profile.role || '',
    profile.avatarUrl || ''
  );
  var profileForm = document.getElementById('profile-settings-form');
  if (profileForm && !profileForm._pendingAvatarFile) {
    setProfileAvatarPreview(profileForm, profile.avatarUrl || '', profile.displayName || profile.nickname || 'Usuário');
  }
}

var profileAvatarSignedUrls = new Map();
var profileAvatarSignedUrlStoragePrefix = 'rildonx_avatar_signed_url_v1:';

function getProfileAvatarViewUrl(avatarUrl) {
  if (!avatarUrl) return Promise.resolve('');
  var client = window.supabaseClient;
  var fileUrl;
  var supabaseUrl;
  try {
    fileUrl = new URL(avatarUrl, window.location.href);
    supabaseUrl = new URL(window.SUPABASE_URL);
  } catch (error) {
    return Promise.reject(new Error('O endereço da imagem de perfil é inválido.'));
  }
  if (fileUrl.origin !== supabaseUrl.origin) return Promise.resolve('');
  var match = fileUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!match) return Promise.resolve('');
  var bucket;
  var path;
  try {
    bucket = decodeURIComponent(match[1]);
    path = decodeURIComponent(match[2]);
  } catch (error) {
    return Promise.reject(new Error('O caminho da imagem de perfil é inválido.'));
  }
  if (bucket !== 'rildonx-files' || !client || !client.storage) {
    return Promise.reject(new Error('O armazenamento da imagem de perfil não está disponível.'));
  }
  var cacheKey = bucket + '/' + path;
  var cached = profileAvatarSignedUrls.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  try {
    var persisted = JSON.parse(localStorage.getItem(profileAvatarSignedUrlStoragePrefix + cacheKey) || 'null');
    if (persisted && persisted.url && persisted.expiresAt > Date.now()) {
      var persistedEntry = { expiresAt: persisted.expiresAt, promise: Promise.resolve(persisted.url) };
      profileAvatarSignedUrls.set(cacheKey, persistedEntry);
      return persistedEntry.promise;
    }
  } catch (error) {
    console.warn('Não foi possível ler o cache local das imagens de perfil:', error);
  }
  var entry = {
    expiresAt: Date.now() + 50 * 60 * 1000,
    promise: client.storage.from(bucket).createSignedUrl(path, 3600).then(function(result) {
      if (result.error) throw result.error;
      if (!result.data || !result.data.signedUrl) throw new Error('O Storage não retornou um endereço para a imagem.');
      try {
        localStorage.setItem(profileAvatarSignedUrlStoragePrefix + cacheKey, JSON.stringify({
          url: result.data.signedUrl,
          expiresAt: Date.now() + 50 * 60 * 1000
        }));
      } catch (error) {
        console.warn('Não foi possível guardar o cache local das imagens de perfil:', error);
      }
      return result.data.signedUrl;
    }).catch(function(error) {
      profileAvatarSignedUrls.delete(cacheKey);
      try {
        localStorage.removeItem(profileAvatarSignedUrlStoragePrefix + cacheKey);
      } catch (storageError) {
        console.warn('Não foi possível limpar o cache local da imagem de perfil:', storageError);
      }
      throw error;
    })
  };
  profileAvatarSignedUrls.set(cacheKey, entry);
  return entry.promise;
}

function setProfileAvatarContent(node, name, avatarUrl) {
  var initials = getPostInitials(name);
  node.dataset.avatarSource = avatarUrl || '';
  node.textContent = initials;
  if (!avatarUrl) return;
  getProfileAvatarViewUrl(avatarUrl).then(function(viewUrl) {
    if (!viewUrl || !node.isConnected || node.dataset.avatarSource !== avatarUrl) return;
    var image = document.createElement('img');
    image.src = viewUrl;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', function() {
      if (node.dataset.avatarSource === avatarUrl && image.parentNode === node) {
        node.removeChild(image);
        node.textContent = initials;
      }
    }, { once: true });
    node.replaceChildren(image);
  }).catch(function(error) {
    console.error('Não foi possível carregar a imagem do perfil:', error);
  });
}

function setProfileAvatarPreview(form, avatarUrl, name) {
  var preview = form && form.querySelector('#profile-avatar-preview');
  var removeButton = form && form.querySelector('#remove-profile-avatar');
  if (!preview) return;
  setProfileAvatarContent(preview, name, avatarUrl);
  if (removeButton) removeButton.hidden = !avatarUrl;
}

function hydrateProfileAvatarImages(root) {
  if (!root) return;
  var nodes = [];
  if (root.matches && root.matches('[data-profile-avatar-url]')) nodes.push(root);
  nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll('[data-profile-avatar-url]')));
  nodes.forEach(function(node) {
    var avatarUrl = node.dataset.profileAvatarUrl;
    if (!avatarUrl) return;
    if (node.dataset.hydratedAvatarUrl === avatarUrl) return;
    getProfileAvatarViewUrl(avatarUrl).then(function(viewUrl) {
      if (!viewUrl || !node.isConnected || node.dataset.profileAvatarUrl !== avatarUrl) return;
      node.src = viewUrl;
      node.dataset.hydratedAvatarUrl = avatarUrl;
      node.loading = 'lazy';
      node.decoding = 'async';
      node.addEventListener('error', function() {
        if (node.dataset.profileAvatarUrl === avatarUrl) node.remove();
      }, { once: true });
    }).catch(function(error) {
      console.error('Não foi possível carregar a imagem de perfil:', error);
    });
  });
}

window.RildonXAvatar = {
  set: setProfileAvatarContent,
  hydrate: hydrateProfileAvatarImages,
  getViewUrl: getProfileAvatarViewUrl,
  imageMarkup: profileAvatarImageMarkup
};

function observeProfileAvatarImages() {
  hydrateProfileAvatarImages(document);
  if (!window.MutationObserver || !document.body) return;
  var observer = new MutationObserver(function(records) {
    records.forEach(function(record) {
      if (record.type === 'attributes') {
        hydrateProfileAvatarImages(record.target);
        return;
      }
      record.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) hydrateProfileAvatarImages(node);
      });
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-profile-avatar-url']
  });
}

function applySavedTheme(theme, preferenceOverrides) {
  var preferences = Object.assign(getAppearancePreferences(), preferenceOverrides || {});
  var selectedTheme = theme || preferences.theme || 'light';
  var resolvedTheme = selectedTheme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : selectedTheme;
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  document.documentElement.removeAttribute('data-palette');
  document.body.setAttribute('data-background', preferences.background || 'none');
  if (preferences.background === 'image' && preferences.backgroundImage) {
    document.body.style.setProperty('--app-background-image', 'url("' + preferences.backgroundImage + '")');
  } else {
    document.body.style.removeProperty('--app-background-image');
  }
  var selector = document.querySelector('#appearance-settings-form [name="theme"]');
  if (selector) selector.value = selectedTheme;
  var background = document.querySelector('#appearance-settings-form [name="background"]');
  if (background) background.value = preferences.background;
  renderAppearanceImagePreview(preferences.backgroundImage);
}

function getAppearancePreferences() {
  var defaults = { theme: 'light', background: 'none', backgroundImage: '' };
  try {
    defaults.theme = localStorage.getItem('rildonx_theme') || defaults.theme;
    var saved = JSON.parse(localStorage.getItem('rildonx_appearance') || '{}');
    return Object.assign(defaults, window.rildonxRemoteAppearance || {}, saved);
  } catch (error) {
    console.error('Não foi possível ler as preferências de aparência:', error);
    return defaults;
  }
}

function applyAppearanceFormPreview(form, pendingImage) {
  var previous = getAppearancePreferences();
  var background = form.elements.background.value;
  applySavedTheme(form.elements.theme.value, {
    theme: form.elements.theme.value,
    background: background,
    backgroundImage: pendingImage || previous.backgroundImage
  });
}

function renderAppearanceImagePreview(imageData) {
  var preview = document.getElementById('background-image-preview');
  if (!preview) return;
  var image = preview.querySelector('img');
  if (!imageData) {
    preview.hidden = true;
    image.removeAttribute('src');
    return;
  }
  image.src = imageData;
  preview.hidden = false;
}

function readAppearanceImage(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || '')); };
    reader.onerror = function() { reject(new Error('Não foi possível ler a imagem selecionada.')); };
    reader.readAsDataURL(file);
  });
}

function bindProfileAvatarSettings(form) {
  var input = form.querySelector('#profile-avatar-file');
  var preview = form.querySelector('#profile-avatar-preview');
  var chooseButton = form.querySelector('#choose-profile-avatar');
  var removeButton = form.querySelector('#remove-profile-avatar');
  var removedInput = form.querySelector('#profile-avatar-removed');
  if (!input || !preview || !chooseButton || !removeButton || !removedInput || form.dataset.avatarBound) return;
  form.dataset.avatarBound = 'true';
  form._pendingAvatarFile = null;
  form._previewObjectUrl = '';

  chooseButton.addEventListener('click', function(event) {
    event.preventDefault();
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch (error) {
      console.warn('O seletor de arquivos nativo não pôde ser aberto; tentando alternativa:', error);
    }
    input.click();
  });
  input.addEventListener('change', function() {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      input.value = '';
      showToast('Escolha uma imagem PNG, JPG, WebP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      input.value = '';
      showToast('A imagem do perfil deve ter no máximo 5 MB.');
      return;
    }
    form._pendingAvatarFile = file;
    removedInput.value = 'false';
    if (form._previewObjectUrl) URL.revokeObjectURL(form._previewObjectUrl);
    form._previewObjectUrl = URL.createObjectURL(file);
    var image = document.createElement('img');
    image.src = form._previewObjectUrl;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    preview.replaceChildren(image);
    removeButton.hidden = false;
    showToast('Imagem selecionada. Salve as configurações para confirmar.');
  });
  removeButton.addEventListener('click', function() {
    form._pendingAvatarFile = null;
    input.value = '';
    removedInput.value = 'true';
    if (form._previewObjectUrl) {
      URL.revokeObjectURL(form._previewObjectUrl);
      form._previewObjectUrl = '';
    }
    preview.textContent = getPostInitials(form.elements.fullName.value || 'Usuário');
    removeButton.hidden = true;
    showToast('Imagem marcada para remoção. Salve as configurações para confirmar.');
  });
}

function bindProfileSettings() {
  var switchAccountButton = document.getElementById('switch-account-btn');
  if (switchAccountButton && !switchAccountButton.dataset.bound) {
    switchAccountButton.dataset.bound = 'true';
    switchAccountButton.addEventListener('click', async function() {
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        window.location.href = 'login.html';
        return;
      }
      switchAccountButton.disabled = true;
      try {
        var result = await window.supabaseClient.auth.signOut();
        if (result.error) throw result.error;
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Não foi possível trocar de conta:', error);
        showToast('Não foi possível trocar de conta. Tente novamente.');
        switchAccountButton.disabled = false;
      }
    });
  }
  var form = document.getElementById('profile-settings-form');
  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    bindProfileAvatarSettings(form);
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      var saveButton = form.querySelector('[type="submit"]');
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        showToast('O serviço de perfil não está disponível. Tente novamente mais tarde.');
        return;
      }
      saveButton.disabled = true;
      try {
        var userResult = await window.supabaseClient.auth.getUser();
        if (userResult.error) throw userResult.error;
        if (!userResult.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
        var user = userResult.data.user;
        var currentState = window.RildonXStore ? window.RildonXStore.getState() : { profiles: [] };
        var existingProfile = (currentState.profiles || []).find(function(profile) {
          return profile.id === user.id;
        }) || {};
        var displayName = form.elements.fullName.value.trim();
        if (!displayName) throw new Error('Informe seu nome completo.');
        var oldAvatarUrl = existingProfile.avatarUrl || null;
        var avatarUrl = oldAvatarUrl;
        var uploadedAvatar = null;
        var avatarCleanupWarning = false;
        if (form._pendingAvatarFile) {
          if (!window.RildonXDocumentUpload || !window.RildonXDocumentUpload.uploadProfileImage) {
            throw new Error('O envio de fotos não está disponível. Recarregue a página.');
          }
          uploadedAvatar = await window.RildonXDocumentUpload.uploadProfileImage(form._pendingAvatarFile, user.id);
          avatarUrl = uploadedAvatar.url;
        } else if (form.elements.profileAvatarRemoved.value === 'true') {
          avatarUrl = null;
        }
        var profileValues = {
          display_name: displayName,
          avatar_url: avatarUrl,
          birthday: form.elements.birthday.value || null,
          personal_email: form.elements.personalEmail.value.trim() || null,
          personal_phone: form.elements.personalPhone.value.trim() || null,
          address: form.elements.address.value.trim() || null
        };
        var result = await window.supabaseClient.rpc('update_own_rildonx_profile', {
          p_profile: profileValues
        });
        if (result.error) {
          if (uploadedAvatar && window.RildonXDocumentUpload) {
            try {
              await window.RildonXDocumentUpload.removeProfileImage(uploadedAvatar.url, user.id);
            } catch (cleanupError) {
              console.error('Não foi possível remover a foto enviada após falha ao salvar o perfil:', cleanupError);
            }
          }
          throw result.error;
        }
        if (oldAvatarUrl && oldAvatarUrl !== avatarUrl && window.RildonXDocumentUpload) {
          try {
            await window.RildonXDocumentUpload.removeProfileImage(oldAvatarUrl, user.id);
          } catch (cleanupError) {
            console.error('O perfil foi salvo, mas a foto anterior não pôde ser removida:', cleanupError);
            avatarCleanupWarning = true;
          }
        }
        var updatedProfile = Object.assign({}, existingProfile, {
          id: user.id,
          displayName: displayName,
          avatarUrl: avatarUrl,
          birthday: profileValues.birthday || '',
          personalEmail: profileValues.personal_email || '',
          personalPhone: profileValues.personal_phone || '',
          address: profileValues.address || ''
        });
        var latestProfiles = window.RildonXStore ? window.RildonXStore.getState().profiles || [] : currentState.profiles || [];
        updateStoredProfilesWithoutResync(latestProfiles.filter(function(profile) {
          return profile.id !== user.id;
        }).concat([updatedProfile]));
        var birthdaySyncFailed = await syncBirthdayCalendar(updatedProfile);
        form._pendingAvatarFile = null;
        form.elements.profileAvatarFile.value = '';
        form.elements.profileAvatarRemoved.value = 'false';
        if (form._previewObjectUrl) {
          URL.revokeObjectURL(form._previewObjectUrl);
          form._previewObjectUrl = '';
        }
        showToast(birthdaySyncFailed
          ? 'Perfil atualizado, mas o aniversário não sincronizou com seu calendário. Verifique as permissões do calendário.'
          : avatarCleanupWarning
          ? 'Perfil atualizado, mas não foi possível remover a foto anterior do armazenamento.'
          : 'Perfil atualizado.');
        renderGlobalUserSummary();
      } catch (error) {
        console.error('Não foi possível salvar os dados pessoais do perfil:', error);
        showToast(error.message || 'Não foi possível salvar as informações pessoais. Tente novamente.');
      } finally {
        saveButton.disabled = false;
      }
    });
  }
  var appearanceForm = document.getElementById('appearance-settings-form');
  if (appearanceForm && !appearanceForm.dataset.bound) {
    appearanceForm.dataset.bound = 'true';
    var preferences = getAppearancePreferences();
    appearanceForm.elements.theme.value = preferences.theme;
    appearanceForm.elements.background.value = preferences.background;
    var imageInput = appearanceForm.elements.backgroundImage;
    var pendingImage = '';
    var removeImage = false;
    appearanceForm.addEventListener('change', function(event) {
      if (event.target === imageInput) {
        var file = imageInput.files && imageInput.files[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
          showToast('Escolha uma imagem PNG, JPG, WebP ou GIF.');
          imageInput.value = '';
          return;
        }
        if (file.size > 1024 * 1024) {
          showToast('A imagem deve ter no máximo 1 MB.');
          imageInput.value = '';
          return;
        }
        readAppearanceImage(file).then(function(imageData) {
          if (!imageInput.files || imageInput.files[0] !== file) return;
          pendingImage = imageData;
          removeImage = false;
          appearanceForm.elements.background.value = 'image';
          renderAppearanceImagePreview(imageData);
          applyAppearanceFormPreview(appearanceForm, pendingImage);
        }).catch(function(error) {
          console.error('Não foi possível carregar a imagem de fundo:', error);
          showToast(error.message);
        });
        return;
      }
      if (event.target === appearanceForm.elements.theme ||
          event.target === appearanceForm.elements.background) {
        applyAppearanceFormPreview(appearanceForm, pendingImage);
      }
    });
    var removeImageButton = document.getElementById('remove-background-image');
    if (removeImageButton) {
      removeImageButton.addEventListener('click', function() {
        pendingImage = '';
        removeImage = true;
        imageInput.value = '';
        appearanceForm.elements.background.value = 'none';
        renderAppearanceImagePreview('');
        applyAppearanceFormPreview(appearanceForm, '');
      });
    }
    appearanceForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      var button = appearanceForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        var result = await window.supabaseClient.auth.getUser();
        if (result.error) throw result.error;
        if (!result.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
        var previous = getAppearancePreferences();
        var theme = appearanceForm.elements.theme.value;
        var nextPreferences = {
          theme: theme,
          background: appearanceForm.elements.background.value,
          backgroundImage: removeImage ? '' : (pendingImage || previous.backgroundImage)
        };
        if (nextPreferences.background === 'image' && !nextPreferences.backgroundImage) {
          throw new Error('Selecione uma imagem ou escolha outro fundo.');
        }
        var update = await window.supabaseClient.auth.updateUser({
          data: Object.assign({}, result.data.user.user_metadata || {}, {
            theme: theme,
            appearance: {
              theme: theme,
              background: nextPreferences.background
            }
          })
        });
        if (update.error) throw update.error;
        try {
          localStorage.setItem('rildonx_appearance', JSON.stringify(nextPreferences));
          localStorage.setItem('rildonx_theme', theme);
        } catch (storageError) {
          throw new Error('Não foi possível salvar as preferências neste navegador. Libere espaço e tente novamente.');
        }
        applySavedTheme(theme);
        pendingImage = '';
        removeImage = false;
        imageInput.value = '';
        showToast('Preferência de aparência salva.');
      } catch (error) {
        console.error('Não foi possível salvar a aparência:', error);
        showToast(error.message || 'Não foi possível salvar a aparência.');
      } finally {
        button.disabled = false;
      }
    });
  }
  var passwordForm = document.getElementById('profile-password-form');
  if (passwordForm && !passwordForm.dataset.bound) {
    passwordForm.dataset.bound = 'true';
    passwordForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      var password = passwordForm.elements.newPassword.value;
      var confirmation = passwordForm.elements.confirmPassword.value;
      if (password.length < 6 || password !== confirmation) {
        showToast('Use pelo menos 6 caracteres e confirme a mesma senha.');
        return;
      }
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        showToast('O serviço de autenticação não está disponível.');
        return;
      }
      var button = passwordForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        var result = await window.supabaseClient.auth.updateUser({ password: password });
        if (result.error) throw result.error;
        passwordForm.reset();
        showToast('Senha atualizada com sucesso.');
      } catch (error) {
        console.error('Não foi possível atualizar a senha:', error);
        showToast(error.message || 'Não foi possível atualizar a senha.');
      } finally {
        button.disabled = false;
      }
    });
  }
}

function syncSocialComposerFields(form) {
  if (!form) return;
  var type = form.querySelector('[data-composer-type]');
  var selectedType = type ? type.value : 'atualizacao';
  var body = form.querySelector('[name="body"]');
  if (body) body.required = selectedType !== 'enquete' && selectedType !== 'evento';
  form.querySelectorAll('[data-composer-fields]').forEach(function(section) {
    var active = section.dataset.composerFields === selectedType;
    section.hidden = !active;
    section.querySelectorAll('input').forEach(function(input) {
      input.required = active && input.type !== 'checkbox';
    });
  });
  updateSocialComposerSubmit(form);
}

function updateSocialComposerSubmit(form) {
  if (!form) return;
  var type = form.querySelector('[data-composer-type]');
  var submit = form.querySelector('[type="submit"]');
  var body = form.querySelector('[name="body"]');
  if (!submit || !body) return;
  var selectedType = type ? type.value : 'atualizacao';
  var validStructuredContent = selectedType === 'enquete'
    ? Boolean(form.elements.pollQuestion && form.elements.pollQuestion.value.trim() &&
      Array.prototype.filter.call(form.querySelectorAll('[name="pollOption"]'), function(input) { return input.value.trim(); }).length >= 2 &&
      form.elements.pollEndsAt && form.elements.pollEndsAt.value)
    : selectedType === 'evento'
      ? Boolean(form.elements.eventTitle && form.elements.eventTitle.value.trim() &&
        form.elements.eventStartsAt && form.elements.eventStartsAt.value &&
        form.elements.eventEndsAt && form.elements.eventEndsAt.value)
      : false;
  submit.disabled = !body.value.trim() && !validStructuredContent;
}

function updateSocialComposerFiles(form) {
  if (!form) return;
  var names = [];
  ['photo', 'document'].forEach(function(name) {
    var input = form.querySelector('[name="' + name + '"]');
    var file = input && input.files && input.files[0];
    if (file) names.push((name === 'photo' ? 'Foto: ' : 'Documento: ') + file.name);
  });
  var display = form.querySelector('.composer-file-names');
  if (display) display.textContent = names.join(' · ');
}

function bindSocialComposerControls() {
  document.querySelectorAll('.social-post-composer').forEach(function(form) {
    if (form.dataset.controlsBound) return;
    form.dataset.controlsBound = 'true';
    var type = form.querySelector('[data-composer-type]');
    if (type) type.addEventListener('change', function() { syncSocialComposerFields(form); });
    form.addEventListener('input', function() { updateSocialComposerSubmit(form); });
    form.addEventListener('change', function() { updateSocialComposerSubmit(form); });
    form.querySelectorAll('[data-composer-file]').forEach(function(button) {
      button.addEventListener('click', function() {
        var input = form.querySelector('[name="' + button.dataset.composerFile + '"]');
        if (input) input.click();
      });
    });
    form.querySelectorAll('.composer-file-input').forEach(function(input) {
      input.addEventListener('change', function() {
        if (input.name === 'photo' && input.files[0] && !input.files[0].type.startsWith('image/')) {
          input.value = '';
          showToast('Selecione um arquivo de imagem para anexar como foto.');
        }
        updateSocialComposerFiles(form);
      });
    });
    syncSocialComposerFields(form);
    updateSocialComposerFiles(form);
  });
}

async function prepareSocialPost(form, user, profile, authorName) {
  var type = form.querySelector('[data-composer-type]').value;
  var metadata = {};
  if (type === 'enquete') {
    var question = form.elements.pollQuestion.value.trim();
    var options = Array.prototype.map.call(form.querySelectorAll('[name="pollOption"]'), function(input) {
      return input.value.trim();
    }).filter(Boolean);
    var endsAt = new Date(form.elements.pollEndsAt.value);
    if (!question || options.length < 2 || !form.elements.pollEndsAt.value || Number.isNaN(endsAt.getTime())) {
      throw new Error('Informe a pergunta, pelo menos duas opções e o término da enquete.');
    }
    if (endsAt <= new Date()) throw new Error('O término da enquete deve estar no futuro.');
    metadata.poll = {
      question: question,
      options: options,
      endsAt: endsAt.toISOString(),
      hideNames: form.elements.pollHideNames.checked
    };
  }
  if (type === 'evento') {
    var startsAt = new Date(form.elements.eventStartsAt.value);
    var endsAt = new Date(form.elements.eventEndsAt.value);
    if (!form.elements.eventTitle.value.trim() || !form.elements.eventStartsAt.value || !form.elements.eventEndsAt.value ||
        Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error('Informe o nome, a data e a hora de início e término do evento.');
    }
    if (endsAt <= startsAt) throw new Error('O término do evento deve ocorrer depois do início.');
    metadata.event = {
      title: form.elements.eventTitle.value.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    };
  }

  var attachments = [];
  var photo = form.querySelector('[name="photo"]').files[0];
  var documentFile = form.querySelector('[name="document"]').files[0];
  if ((photo || documentFile) && !window.RildonXDocumentUpload) {
    throw new Error('O serviço de anexos não está disponível. Recarregue a página e tente novamente.');
  }
  if (photo) {
    if (!photo.type.startsWith('image/')) throw new Error('O anexo de foto deve ser uma imagem.');
    attachments.push(await window.RildonXDocumentUpload.upload(photo, { senderName: authorName, folder: 'Mural' }));
  }
  if (documentFile) {
    attachments.push(await window.RildonXDocumentUpload.upload(documentFile, { senderName: authorName, folder: 'Mural' }));
  }
  return {
    type: type,
    authorRole: profile && profile.role || user.user_metadata && user.user_metadata.role || '',
    attachments: attachments.map(function(file) {
      return {
        id: file.id,
        name: file.name,
        fileType: file.fileType,
        size: file.size,
        mimeType: file.mimeType,
        url: file.url
      };
    }),
    metadata: metadata
  };
}

function addCreatedSocialPost(row, payload, authorName) {
  window.RildonXStore.addPost({
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || authorName,
    authorRole: row.author_role || payload.authorRole,
    type: row.post_type || payload.type,
    title: row.title || '',
    body: row.body,
    attachments: row.attachments || payload.attachments,
    metadata: row.post_metadata || payload.metadata,
    createdAt: row.created_at,
    comments: [],
    reactions: [],
    pollVotes: [],
    pollResults: []
  });
}

function bindQuickCreateActions() {
  bindSocialComposerControls();
  var trigger = document.getElementById('quick-create-button');
  var menu = document.getElementById('quick-create-menu');
  if (trigger && menu && !trigger.dataset.bound) {
    trigger.dataset.bound = 'true';
    trigger.addEventListener('click', function() {
      var expanded = !menu.classList.contains('open');
      menu.classList.toggle('open', expanded);
      trigger.setAttribute('aria-expanded', String(expanded));
    });
    document.addEventListener('click', function(event) {
      if (event.target.closest('.quick-create-wrap')) return;
      menu.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    });
    menu.querySelectorAll('button').forEach(function(button) {
      button.addEventListener('click', function() {
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var postForm = document.getElementById('quick-post-form');
  if (postForm && !postForm.dataset.bound) {
    postForm.dataset.bound = 'true';
    updateSocialComposerSubmit(postForm);
    postForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      var body = postForm.elements.body.value.trim();
      if (!body && postForm.elements.type.value === 'enquete') body = postForm.elements.pollQuestion.value.trim();
      if (!body && postForm.elements.type.value === 'evento') body = postForm.elements.eventTitle.value.trim();
      if (!body) {
        postForm.elements.body.focus();
        return;
      }
      var submit = postForm.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        var user = await getMuralUser();
        var state = window.RildonXStore.getState();
        var profile = (state.profiles || []).find(function(item) { return item.id === user.id; });
        var authorName = profile && profile.displayName ||
          user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name) ||
          String(user.email || 'Colaborador').split('@')[0];
        var composer = await prepareSocialPost(postForm, user, profile, authorName);
        var result = await window.supabaseClient.from('posts').insert({
          author_id: user.id,
          author_name: authorName,
          author_role: composer.authorRole || null,
          post_type: composer.type,
          post_metadata: composer.metadata,
          attachments: composer.attachments,
          body: body
        }).select('*').single();
        if (result.error) throw result.error;
        addCreatedSocialPost(result.data, composer, authorName);
        postForm.reset();
        submit.disabled = true;
        syncSocialComposerFields(postForm);
        updateSocialComposerFiles(postForm);
        closeModal();
        showToast('Publicação adicionada ao Mural.');
      } catch (error) {
        console.error('Não foi possível publicar no Mural:', error);
        showToast(error.message || 'Não foi possível publicar. Tente novamente.');
      } finally {
        updateSocialComposerSubmit(postForm);
      }
    });
  }

  var eventForm = document.getElementById('quick-event-form');
  if (eventForm && !eventForm.dataset.bound) {
    eventForm.dataset.bound = 'true';
    eventForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      var submit = eventForm.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        var user = await getMuralUser();
        var startsAt = new Date(eventForm.elements.startsAt.value);
        var endsAt = eventForm.elements.endsAt.value ? new Date(eventForm.elements.endsAt.value) : null;
        if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
          throw new Error('Informe uma data e um horário válidos.');
        }
        if (endsAt && endsAt < startsAt) throw new Error('O término deve ocorrer depois do início.');
        var payload = {
          title: eventForm.elements.title.value.trim(),
          description: eventForm.elements.description.value.trim(),
          category: eventForm.elements.category.value,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt ? endsAt.toISOString() : null,
          location: eventForm.elements.location.value.trim(),
          created_by: user.id
        };
        var result = await window.supabaseClient.from('events').insert(payload).select('*').single();
        if (result.error) throw result.error;
        var row = result.data;
        var currentEvents = (window.RildonXStore.getState().events || []).filter(function(item) {
          return item.id !== row.id;
        });
        window.RildonXStore.setState({
          events: [{
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || payload.category,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            location: row.location || '',
            visibility: row.visibility || 'team',
            ownerId: row.owner_id || null,
            allDay: Boolean(row.all_day),
            allDayStartDate: row.all_day_start_date || null,
            allDayEndDate: row.all_day_end_date || null,
            deletedAt: row.deleted_at || null,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }].concat(currentEvents)
        });
        eventForm.reset();
        closeModal();
        showToast('Evento criado e adicionado ao calendário.');
      } catch (error) {
        console.error('Não foi possível criar o evento:', error);
        showToast(error.message || 'Não foi possível criar o evento. Tente novamente.');
      } finally {
        submit.disabled = false;
      }
    });
  }
}

function formatPostTime(value) {
  var date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  var elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'agora';
  if (elapsedMinutes < 60) return 'há ' + elapsedMinutes + ' min';
  var elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return 'há ' + elapsedHours + 'h';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getPostInitials(name) {
  return String(name || 'Colaborador').trim().split(/\s+/).map(function (part) {
    return part.charAt(0);
  }).join('').slice(0, 2).toUpperCase() || 'C';
}

function getPostTypeLabel(type) {
  var labels = {
    aviso: 'Aviso',
    comunicado: 'Comunicado',
    reconhecimento: 'Reconhecimento',
    enquete: 'Enquete',
    evento: 'Evento',
    atualizacao: 'Atualização'
  };
  return labels[type] || labels.atualizacao;
}

function renderPostAttachments(post) {
  var attachments = Array.isArray(post.attachments) ? post.attachments : [];
  if (!attachments.length) return '';
  return '<div class="feed-attachments">' + attachments.map(function(file) {
    var image = String(file.mimeType || '').startsWith('image/');
    return '<a class="feed-attachment' + (image ? ' is-image' : '') + '" data-attachment-url="' + escapeHtml(file.url || '') + '" data-attachment-name="' + escapeHtml(file.name || 'Anexo') + '" href="#" target="_blank" rel="noopener">' +
      (image
        ? '<img alt="' + escapeHtml(file.name || 'Imagem anexada') + '" loading="lazy">'
        : '<span class="feed-attachment-icon" aria-hidden="true">📄</span><span>' + escapeHtml(file.name || 'Documento') + '</span>') +
      '</a>';
  }).join('') + '</div>';
}

function renderPostPoll(post, profiles) {
  var poll = post.metadata && post.metadata.poll;
  if (post.type !== 'enquete' || !poll || !Array.isArray(poll.options)) return '';
  var votes = Array.isArray(post.pollVotes) ? post.pollVotes : [];
  var ownVote = votes.find(function(vote) { return vote.userId === muralCurrentUserId; });
  var results = Array.isArray(post.pollResults) ? post.pollResults : [];
  var total = results.reduce(function(sum, result) { return sum + Number(result.vote_count || 0); }, 0);
  if (!results.length) total = votes.length;
  var ended = poll.endsAt && new Date(poll.endsAt).getTime() <= Date.now();
  var optionsHtml = poll.options.map(function(option, index) {
    var resultRow = results.find(function(result) { return Number(result.option_index) === index; });
    var count = resultRow ? Number(resultRow.vote_count || 0) : votes.filter(function(vote) { return Number(vote.optionIndex) === index; }).length;
    var percent = total ? Math.round(count * 100 / total) : 0;
    return '<button type="button" class="feed-poll-option' + (ownVote && Number(ownVote.optionIndex) === index ? ' selected' : '') + '" data-feed-action="poll-vote" data-post-id="' + escapeHtml(post.id) + '" data-option-index="' + index + '"' + (ended ? ' disabled' : '') + '>' +
      '<span class="feed-poll-progress" style="width:' + percent + '%"></span><span class="feed-poll-option-label">' + escapeHtml(option) + '</span><b>' + percent + '%</b></button>';
  }).join('');
  var voterNames = poll.hideNames ? 'Votos anônimos' : votes.map(function(vote) {
    var profile = profiles.find(function(item) { return item.id === vote.userId; });
    return profile ? getProfileDisplayName(profile) : vote.authorName;
  }).filter(Boolean);
  var voters = Array.isArray(voterNames)
    ? (voterNames.length ? voterNames.join(', ') : 'Ninguém votou ainda')
    : voterNames;
  var ending = poll.endsAt ? 'Encerra ' + escapeHtml(new Date(poll.endsAt).toLocaleString('pt-BR')) : '';
  return '<section class="feed-poll"><h4>' + escapeHtml(poll.question || 'Enquete') + '</h4>' + optionsHtml +
    '<div class="feed-poll-meta"><span>' + total + (total === 1 ? ' voto' : ' votos') + (ended ? ' · Encerrada' : '') + '</span><span>' + ending + '</span></div>' +
    '<div class="feed-poll-voters">' + escapeHtml(voters) + '</div></section>';
}

function renderPostEvent(post) {
  var event = post.metadata && post.metadata.event;
  if (post.type !== 'evento' || !event) return '';
  var starts = event.startsAt ? new Date(event.startsAt).toLocaleString('pt-BR') : '';
  var ends = event.endsAt ? new Date(event.endsAt).toLocaleString('pt-BR') : '';
  return '<div class="feed-event"><b>' + escapeHtml(event.title || 'Evento') + '</b><span>Início: ' + escapeHtml(starts) + '</span><span>Término: ' + escapeHtml(ends) + '</span></div>';
}

function hydratePostAttachments(root) {
  root.querySelectorAll('[data-attachment-url]').forEach(function(link) {
    var url = link.dataset.attachmentUrl;
    if (!url || !window.RildonXDocumentUpload) return;
    var parsedUrl;
    try {
      parsedUrl = new URL(url, window.location.href);
    } catch (error) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      return;
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      return;
    }
    window.RildonXDocumentUpload.getViewUrl({ url: url }).then(function(viewUrl) {
      if (!viewUrl) throw new Error('Não foi possível abrir o anexo.');
      link.href = viewUrl;
      var image = link.querySelector('img');
      if (image) image.src = viewUrl;
    }).catch(function(error) {
      console.error('Não foi possível preparar o anexo da publicação:', error);
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
    });
  });
}

function renderHomeFeedPreview() {
  var root = document.getElementById('inicio-updates-live-root');
  if (!root || !window.RildonXStore) return;
  var state = window.RildonXStore.getState();
  var profiles = state.profiles || [];
  var posts = (state.posts || []).slice().sort(function (first, second) {
    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  }).slice(0, 5);
  var muralLoadError = window.RildonXStore.getState().muralLoadError;

  root.innerHTML = muralLoadError && !posts.length
    ? '<div class="feed-empty">' + escapeHtml(muralLoadError) + '</div>'
    : posts.length ? posts.map(function (post) {
    var profile = profiles.find(function(item) { return item.id === post.authorId; });
    var authorName = getProfileDisplayName(profile, post.authorName || 'Colaborador');
    var author = escapeHtml(authorName);
    var summary = post.body || post.title || 'Nova publicação';
    var type = post.type || 'atualizacao';
    var preview = renderHomePostTypePreview(post);
    return '<article class="home-feed-item">' +
      '<div class="home-feed-author">' + escapeHtml(getPostInitials(authorName)) +
      (profile && profile.avatarUrl ? '<img data-profile-avatar-url="' + escapeHtml(profile.avatarUrl) + '" data-profile-avatar-name="' + escapeHtml(authorName) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="home-feed-copy"><div class="home-feed-meta"><div><b>' + author + '</b><span> compartilhou uma atualização</span></div><time>' + escapeHtml(formatPostTime(post.createdAt)) + '</time></div>' +
      '<span class="post-badge ' + escapeHtml(type) + '">' + escapeHtml(getPostTypeLabel(type)) + '</span>' +
      (post.title ? '<b class="home-feed-title">' + escapeHtml(post.title) + '</b>' : '') +
      '<p>' + escapeHtml(summary) + '</p>' + preview + '</div></article>';
  }).join('') : '<div class="feed-empty">Ainda não há publicações no Mural.</div>';
  hydrateProfileAvatarImages(root);
  hydratePostAttachments(root);
}

function renderHomePostTypePreview(post) {
  var image = (Array.isArray(post.attachments) ? post.attachments : []).find(function(file) {
    var mimeType = String(file.mimeType || '').toLowerCase();
    var extension = String(file.name || '').split('.').pop().toLowerCase();
    return (mimeType.indexOf('image/') === 0 ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif'].indexOf(extension) !== -1) && file.url;
  });
  var imagePreview = image
    ? '<a class="home-post-preview home-image-preview" data-attachment-url="' + escapeHtml(image.url) +
      '" data-attachment-name="' + escapeHtml(image.name || 'Imagem da publicação') + '" href="#" target="_blank" rel="noopener">' +
      '<img alt="' + escapeHtml(image.name || 'Prévia da imagem da publicação') + '" loading="lazy" decoding="async"></a>'
    : '';
  if (post.type === 'enquete') {
    var poll = post.metadata && post.metadata.poll;
    if (!poll || !Array.isArray(poll.options)) return imagePreview;
    var results = Array.isArray(post.pollResults) ? post.pollResults : [];
    var votes = Array.isArray(post.pollVotes) ? post.pollVotes : [];
    var counts = poll.options.map(function(option, index) {
      var result = results.find(function(item) { return Number(item.option_index) === index; });
      return result ? Number(result.vote_count || 0) : votes.filter(function(vote) {
        return Number(vote.optionIndex) === index;
      }).length;
    });
    var total = counts.reduce(function(sum, count) { return sum + count; }, 0);
    var options = poll.options.slice(0, 3).map(function(option, index) {
      var percent = total ? Math.round(counts[index] * 100 / total) : 0;
      return '<div class="home-poll-option"><span>' + escapeHtml(option) + '</span><div class="home-poll-track"><i style="width:' + percent + '%"></i></div><b>' + counts[index] + '</b></div>';
    }).join('');
    return '<div class="home-post-preview home-poll-preview"><b>' + escapeHtml(poll.question || 'Resultado da enquete') +
      '</b>' + options + '<span>' + total + (total === 1 ? ' voto' : ' votos') + '</span></div>' + imagePreview;
  }
  if (post.type === 'evento') {
    var event = post.metadata && post.metadata.event;
    if (!event) return imagePreview;
    var startsAt = event.startsAt ? new Date(event.startsAt) : null;
    var dateLabel = startsAt && !Number.isNaN(startsAt.getTime())
      ? startsAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'Data não informada';
    return '<div class="home-post-preview home-event-preview"><b>' + escapeHtml(event.title || post.title || 'Evento') +
      '</b><span>' + escapeHtml(dateLabel) + '</span>' +
      (event.location ? '<span>Local: ' + escapeHtml(event.location) + '</span>' : '') +
      (event.description ? '<span>' + escapeHtml(event.description) + '</span>' : '') + '</div>' + imagePreview;
  }
  return imagePreview;
}

function renderMuralPosts() {
  var root = document.getElementById('mural-posts-root');
  if (!root || !window.RildonXStore) return;
  var profiles = window.RildonXStore.getState().profiles || [];
  var state = window.RildonXStore.getState();
  var posts = (state.posts || []).slice().sort(function (first, second) {
    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  });

  var feedWarning = state.muralLoadError
    ? '<div class="feed-load-warning" role="status">' + escapeHtml(state.muralLoadError) + '</div>'
    : '';
  root.innerHTML = feedWarning + (posts.length ? posts.map(function (post) {
    var profile = profiles.find(function (item) { return item.id === post.authorId; });
    var authorName = getProfileDisplayName(profile, post.authorName || 'Colaborador');
    var reactions = Array.isArray(post.reactions) ? post.reactions : [];
    var comments = Array.isArray(post.comments) ? post.comments : [];
    var liked = reactions.some(function (reaction) { return reaction.userId === muralCurrentUserId; });
    var type = post.type || 'atualizacao';
    var commentsHtml = comments.slice(-3).map(function (comment) {
      var commentProfile = profiles.find(function (item) { return item.id === comment.authorId; });
      var commentAuthor = getProfileDisplayName(commentProfile, comment.authorName || 'Colaborador');
      return '<div class="feed-comment"><div class="feed-comment-avatar">' + escapeHtml(getPostInitials(commentAuthor)) + profileAvatarImageMarkup(commentProfile) + '</div><div class="feed-comment-copy"><b>' + escapeHtml(commentAuthor) + '</b><span>' + escapeHtml(comment.body) + '</span></div></div>';
    }).join('');
    var canDelete = muralCurrentUserId && (muralCurrentUserIsAdmin || post.authorId === muralCurrentUserId);

    return '<article class="card post-card" data-feed-post="' + escapeHtml(post.id) + '">' +
      '<div class="post-head"><div class="post-avatar">' + escapeHtml(getPostInitials(authorName)) +
      (profile && profile.avatarUrl ? '<img data-profile-avatar-url="' + escapeHtml(profile.avatarUrl) + '" data-profile-avatar-name="' + escapeHtml(authorName) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="post-author-block"><div class="post-author">' + escapeHtml(authorName) + '</div><div class="post-time">' + escapeHtml(formatPostTime(post.createdAt)) + '</div></div>' +
      '<span class="post-badge ' + escapeHtml(type) + '">' + escapeHtml(getPostTypeLabel(type)) + '</span>' +
      (canDelete ? '<button type="button" class="post-delete-btn" data-feed-action="delete" data-post-id="' + escapeHtml(post.id) + '" aria-label="Excluir publicação de ' + escapeHtml(authorName) + '" title="Excluir publicação"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg></button>' : '') +
      '</div>' +
      '<div class="post-body">' + (post.title ? '<h4>' + escapeHtml(post.title) + '</h4>' : '') + '<p>' + escapeHtml(post.body).replace(/\n/g, '<br>') + '</p></div>' +
      renderPostAttachments(post) + renderPostEvent(post) + renderPostPoll(post, profiles) +
      '<div class="post-stats"><span>' + reactions.length + ' curtida' + (reactions.length === 1 ? '' : 's') + '</span><span>' + comments.length + ' comentário' + (comments.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="post-foot"><button type="button" class="feed-action' + (liked ? ' liked' : '') + '" data-feed-action="like" data-post-id="' + escapeHtml(post.id) + '" aria-pressed="' + String(liked) + '">👍 Curtir</button>' +
      '<button type="button" class="feed-action" data-feed-action="focus-comment" data-post-id="' + escapeHtml(post.id) + '">💬 Comentar</button></div>' +
      (commentsHtml ? '<div class="feed-comments">' + commentsHtml + '</div>' : '') +
      '<form class="feed-comment-form" data-post-id="' + escapeHtml(post.id) + '">' +
      '<input name="comment" maxlength="2000" placeholder="Escreva um comentário..." aria-label="Escreva um comentário" required>' +
      '<button type="submit" aria-label="Enviar comentário">Enviar</button></form></article>';
  }).join('') : '<div class="card feed-empty mural-empty">Ainda não há publicações. Compartilhe a primeira atualização com a equipe.</div>');
  hydrateProfileAvatarImages(root);
  hydratePostAttachments(root);
}

function updateFeedPost(postId, update) {
  if (!window.RildonXStore) return;
  var state = window.RildonXStore.getState();
  var posts = (state.posts || []).map(function (post) {
    return post.id === postId ? update(post) : post;
  });
  window.RildonXStore.setState({ posts: posts });
}

async function getMuralUser() {
  var client = window.supabaseClient;
  if (!client || !client.auth) throw new Error('O serviço de autenticação não está disponível.');
  var result = await client.auth.getUser();
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error('Sua sessão expirou. Entre novamente para publicar.');
  return result.data.user;
}

function bindMuralFeed() {
  var form = document.getElementById('mural-post-form');
  var root = document.getElementById('mural-posts-root');
  if (!form || !root || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var bodyInput = document.getElementById('mural-post-body');
    var submit = document.getElementById('mural-post-submit');
    var body = bodyInput.value.trim();
    if (!body && form.elements.type.value === 'enquete') body = form.elements.pollQuestion.value.trim();
    if (!body && form.elements.type.value === 'evento') body = form.elements.eventTitle.value.trim();
    if (!body) {
      bodyInput.focus();
      return;
    }
    submit.disabled = true;
    try {
      var user = await getMuralUser();
      var state = window.RildonXStore.getState();
      var profile = (state.profiles || []).find(function (item) { return item.id === user.id; });
      var authorName = (profile && profile.displayName) ||
        (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name)) ||
        String(user.email || 'Colaborador').split('@')[0];
      var composer = await prepareSocialPost(form, user, profile, authorName);
      var result = await window.supabaseClient.from('posts').insert({
        author_id: user.id,
        author_name: authorName,
        author_role: composer.authorRole || null,
        post_type: composer.type,
        post_metadata: composer.metadata,
        attachments: composer.attachments,
        body: body
      }).select('*').single();
      if (result.error) throw result.error;
      addCreatedSocialPost(result.data, composer, authorName);
      form.reset();
      submit.disabled = true;
      syncSocialComposerFields(form);
      updateSocialComposerFiles(form);
    } catch (error) {
      console.error('Não foi possível publicar no Mural:', error);
      showToast(error.message || 'Não foi possível publicar. Tente novamente.');
    } finally {
      updateSocialComposerSubmit(form);
    }
  });

  var bodyInput = form.querySelector('[name="body"]');
  updateSocialComposerSubmit(form);

  root.addEventListener('click', async function (event) {
    var action = event.target.closest('[data-feed-action]');
    if (!action) return;
    var postId = action.dataset.postId;
    if (action.dataset.feedAction === 'focus-comment') {
      var commentForm = Array.prototype.find.call(root.querySelectorAll('.feed-comment-form'), function (item) {
        return item.dataset.postId === postId;
      });
      var commentInput = commentForm && commentForm.querySelector('input');
      if (commentInput) commentInput.focus();
      return;
    }
    if (action.dataset.feedAction === 'delete') {
      var postToDelete = (window.RildonXStore.getState().posts || []).find(function(post) {
        return post.id === postId;
      });
      if (!postToDelete || (!muralCurrentUserIsAdmin && postToDelete.authorId !== muralCurrentUserId)) {
        showToast('Você não tem permissão para excluir esta publicação.');
        return;
      }
      if (!window.confirm('Deseja excluir esta publicação? Essa ação não pode ser desfeita.')) return;
      action.disabled = true;
      try {
        var deletion = await window.supabaseClient.from('posts')
          .delete().eq('id', postId).select('id').maybeSingle();
        if (deletion.error) throw deletion.error;
        if (!deletion.data || deletion.data.id !== postId) {
          throw new Error('A publicação não foi excluída. Verifique suas permissões e tente novamente.');
        }
        window.RildonXStore.setState({
          posts: (window.RildonXStore.getState().posts || []).filter(function(post) {
            return post.id !== postId;
          })
        });
        showToast('Publicação excluída.');
      } catch (error) {
        console.error('Não foi possível excluir a publicação:', error);
        showToast(error.message || 'Não foi possível excluir a publicação.');
        action.disabled = false;
      }
      return;
    }
    if (action.dataset.feedAction === 'poll-vote') {
      action.disabled = true;
      try {
        var voter = await getMuralUser();
        muralCurrentUserId = voter.id;
        var pollIndex = Number(action.dataset.optionIndex);
        var pollPost = (window.RildonXStore.getState().posts || []).find(function(item) { return item.id === postId; });
        var poll = pollPost && pollPost.metadata && pollPost.metadata.poll;
        if (!poll || !Number.isInteger(pollIndex) || pollIndex < 0 || pollIndex >= poll.options.length) {
          throw new Error('Esta opção de enquete não está mais disponível.');
        }
        if (poll.endsAt && new Date(poll.endsAt).getTime() <= Date.now()) {
          throw new Error('Esta enquete já foi encerrada.');
        }
        var voteResult = await window.supabaseClient.from('post_poll_votes').upsert({
          post_id: postId,
          user_id: voter.id,
          option_index: pollIndex
        }, { onConflict: 'post_id,user_id' }).select('*').single();
        if (voteResult.error) throw voteResult.error;
        updateFeedPost(postId, function(item) {
          var votes = (item.pollVotes || []).filter(function(vote) { return vote.userId !== voter.id; });
          var priorVote = (item.pollVotes || []).find(function(vote) { return vote.userId === voter.id; });
          var voterProfile = (window.RildonXStore.getState().profiles || []).find(function(profile) { return profile.id === voter.id; });
          var voterName = voterProfile && voterProfile.displayName ||
            voter.user_metadata && (voter.user_metadata.display_name || voter.user_metadata.full_name) ||
            String(voter.email || 'Colaborador').split('@')[0];
          votes.push({ postId: postId, userId: voter.id, optionIndex: voteResult.data.option_index, authorName: voterName });
          var results = (item.pollResults || []).map(function(result) {
            var count = Number(result.vote_count || 0);
            if (priorVote && Number(result.option_index) === Number(priorVote.optionIndex)) count = Math.max(0, count - 1);
            if (Number(result.option_index) === Number(voteResult.data.option_index)) count += 1;
            return { option_index: result.option_index, vote_count: count };
          });
          if (!results.some(function(result) { return Number(result.option_index) === Number(voteResult.data.option_index); })) {
            results.push({ option_index: voteResult.data.option_index, vote_count: 1 });
          }
          return Object.assign({}, item, { pollVotes: votes, pollResults: results });
        });
      } catch (error) {
        console.error('Não foi possível registrar o voto:', error);
        showToast(error.message || 'Não foi possível registrar seu voto.');
      } finally {
        action.disabled = false;
      }
      return;
    }
    if (action.dataset.feedAction !== 'like') return;
    action.disabled = true;
    try {
      var user = await getMuralUser();
      muralCurrentUserId = user.id;
      var posts = window.RildonXStore.getState().posts || [];
      var post = posts.find(function (item) { return item.id === postId; });
      if (!post) throw new Error('Esta publicação não está mais disponível.');
      var reactions = Array.isArray(post.reactions) ? post.reactions : [];
      var current = reactions.find(function (reaction) { return reaction.userId === user.id; });
      if (current) {
        var removal = await window.supabaseClient.from('post_reactions')
          .delete().eq('post_id', postId).eq('user_id', user.id);
        if (removal.error) throw removal.error;
        updateFeedPost(postId, function (item) {
          return Object.assign({}, item, { reactions: (item.reactions || []).filter(function (reaction) { return reaction.userId !== user.id; }) });
        });
      } else {
        var insertion = await window.supabaseClient.from('post_reactions')
          .insert({ post_id: postId, user_id: user.id, reaction: 'like' })
          .select('*').single();
        if (insertion.error) throw insertion.error;
        updateFeedPost(postId, function (item) {
          return Object.assign({}, item, { reactions: (item.reactions || []).concat([{ id: postId + ':' + user.id, postId: postId, userId: user.id, reaction: 'like', createdAt: insertion.data.created_at }]) });
        });
      }
    } catch (error) {
      console.error('Não foi possível atualizar a reação:', error);
      showToast(error.message || 'Não foi possível registrar sua curtida.');
    } finally {
      action.disabled = false;
    }
  });

  root.addEventListener('submit', async function (event) {
    var commentForm = event.target.closest('.feed-comment-form');
    if (!commentForm) return;
    event.preventDefault();
    var input = commentForm.elements.comment;
    var body = input.value.trim();
    if (!body) return;
    var button = commentForm.querySelector('button');
    button.disabled = true;
    try {
      var user = await getMuralUser();
      muralCurrentUserId = user.id;
      var result = await window.supabaseClient.from('post_comments').insert({
        post_id: commentForm.dataset.postId,
        author_id: user.id,
        body: body
      }).select('*').single();
      if (result.error) throw result.error;
      var state = window.RildonXStore.getState();
      var profile = (state.profiles || []).find(function (item) { return item.id === user.id; });
      var authorName = (profile && profile.displayName) ||
        (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name)) ||
        String(user.email || 'Colaborador').split('@')[0];
      updateFeedPost(commentForm.dataset.postId, function (post) {
        return Object.assign({}, post, { comments: (post.comments || []).concat([{
          id: result.data.id,
          postId: result.data.post_id,
          authorId: result.data.author_id,
          authorName: authorName,
          body: result.data.body,
          createdAt: result.data.created_at
        }]) });
      });
      input.value = '';
    } catch (error) {
      console.error('Não foi possível comentar na publicação:', error);
      showToast(error.message || 'Não foi possível publicar seu comentário.');
    } finally {
      button.disabled = false;
    }
  });
}

function refreshStoreDrivenUi() {
  renderGlobalProfileFromStore();
  renderTaskListsFromStore();
  renderProjectsFromStore();
  renderConversationListFromStore();
  renderNewConversationUsers();
  renderMessagesFromStore();
  renderInicioTasksFromStore();
  renderHomeRecentConversations();
  renderHomeRecentDocuments();
  renderHomeUpcomingEvents();
  renderHomeFeedPreview();
  renderMuralPosts();
  renderPeopleDirectory();
  renderGlobalNotifications();
}

function movePageHeadingToTopbar() {
  var topbar = document.querySelector('.topbar');
  if (!topbar || topbar.querySelector('.topbar-page-heading')) return;

  var pageHead = document.querySelector('.content > .page-view .page-head');
  var title = pageHead && pageHead.querySelector(':scope > div > h1');
  var subtitle = pageHead && pageHead.querySelector(':scope > div > p');
  var heading = document.createElement('div');
  heading.className = 'topbar-page-heading';

  if (title) {
    heading.appendChild(title);
    if (subtitle) heading.appendChild(subtitle);
    var titleContainer = title.parentElement;
    if (titleContainer && titleContainer.parentElement === pageHead) titleContainer.remove();
    if (pageHead.children.length) {
      pageHead.classList.add('page-head-actions-only');
    } else {
      pageHead.remove();
    }
  } else if (document.body.dataset.page === 'inicio') {
    var titleElement = document.createElement('h1');
    titleElement.textContent = 'Início';
    heading.appendChild(titleElement);
    var greeting = document.querySelector('.greet-banner p');
    if (greeting) {
      var subtitleElement = document.createElement('p');
      subtitleElement.textContent = greeting.textContent;
      heading.appendChild(subtitleElement);
      greeting.remove();
    }
  } else {
    return;
  }

  var spacer = topbar.querySelector('.topbar-spacer');
  if (spacer) spacer.remove();
  topbar.insertBefore(heading, topbar.querySelector('.topbar-right'));
}

function bindMessageComposer() {
  var input = document.getElementById('chat-message-input');
  var button = document.getElementById('chat-send-btn');
  var fileInput = document.getElementById('chat-file-input');
  var pendingRoot = document.getElementById('chat-pending-attachments');
  if (!input || !button || button.dataset.bound === 'true') return;

  var pendingFiles = [];
  var isSending = false;

  function renderPendingFiles() {
    if (!pendingRoot) return;
    pendingRoot.innerHTML = pendingFiles.map(function(item, index) {
      return '<div class="pending-file"><span>' + escapeHtml(item.file.name) + '</span><button type="button" data-remove-pending-file="' + index + '" aria-label="Remover ' + escapeHtml(item.file.name) + '">×</button></div>';
    }).join('');
    pendingRoot.hidden = pendingFiles.length === 0;
  }

  function stageSelectedFiles() {
    if (!fileInput || !fileInput.files) return;
    Array.prototype.forEach.call(fileInput.files, function(file) {
      pendingFiles.push({ file: file, document: null });
    });
    renderPendingFiles();
    fileInput.value = '';
  }

  if (fileInput) fileInput.addEventListener('change', stageSelectedFiles);
  if (pendingRoot) pendingRoot.addEventListener('click', function(event) {
    var removeButton = event.target.closest('[data-remove-pending-file]');
    if (!removeButton) return;
    pendingFiles.splice(Number(removeButton.dataset.removePendingFile), 1);
    renderPendingFiles();
  });

  async function sendMessage() {
    var text = input.value.trim();
    if ((!text && !pendingFiles.length) || isSending || !window.RildonXStore || typeof window.RildonXStore.addMessage !== 'function') return;

    isSending = true;
    button.disabled = true;
    var attachmentButton = document.getElementById('attachment-btn');
    if (attachmentButton) attachmentButton.disabled = true;

    var uploadedDocuments = [];
    try {
      var state = window.RildonXStore.getState();
      var userId = muralCurrentUserId || state.user && state.user.id || null;
      var senderProfile = (state.profiles || []).find(function(profile) { return profile.id === userId; });
      var senderName = senderProfile && senderProfile.displayName || state.user && state.user.name || 'Usuário';
      var viewerIds = (state.conversationMemberships || []).filter(function(member) {
        return member.conversationId === activeConversationId && member.userId;
      }).map(function(member) { return member.userId; });
      if (userId && viewerIds.indexOf(userId) === -1) viewerIds.push(userId);
      for (var index = 0; index < pendingFiles.length; index += 1) {
        var pendingFile = pendingFiles[index];
        if (!pendingFile.document) {
          if (!window.RildonXDocumentUpload) {
            throw new Error('O serviço de envio não está disponível. Recarregue a página.');
          }
          pendingFile.document = await window.RildonXDocumentUpload.upload(pendingFile.file, {
            folder: 'Mensagens não salvas',
            senderName: senderName,
            viewerIds: viewerIds
          });
          window.RildonXStore.addDocument(pendingFile.document);
        }
        uploadedDocuments.push(pendingFile.document);
      }

      var sentAt = new Date().toISOString();
      var messageText = text;
      var attachmentIds = uploadedDocuments.map(function(item) { return item.id; });
      var localConversation = activeConversationId === 'local-test';
      var messageId = null;
      var senderId = userId;
      if (!localConversation) {
        var authResult = await window.supabaseClient.auth.getUser();
        if (authResult.error) throw authResult.error;
        var authenticatedUser = authResult.data && authResult.data.user;
        if (!authenticatedUser) throw new Error('Entre novamente para enviar a mensagem.');
        senderId = authenticatedUser.id;
        var remoteMessage = await window.supabaseClient.from('messages').insert({
          conversation_id: activeConversationId,
          sender_id: authenticatedUser.id,
          sender_name: senderName,
          text: messageText,
          sent_at: sentAt,
          attachments: attachmentIds
        }).select('*').single();
        if (remoteMessage.error) throw remoteMessage.error;
        messageId = remoteMessage.data.id;
      }
      var messagePayload = {
        conversationId: activeConversationId,
        senderId: senderId,
        senderName: senderName,
        text: messageText,
        sentAt: sentAt,
        attachments: attachmentIds,
        replyToId: replyToMessageId,
        localOnly: localConversation
      };
      if (messageId) messagePayload.id = messageId;
      window.RildonXStore.addMessage(messagePayload);

      input.value = '';
      replyToMessageId = null;
      var replyPreview = document.getElementById('chat-reply-preview');
      if (replyPreview) {
        replyPreview.hidden = true;
        replyPreview.innerHTML = '';
      }
      pendingFiles = [];
      renderPendingFiles();
    } catch (error) {
      var detail = error && error.message ? ' (' + error.message + ')' : '';
      var message = uploadedDocuments.length
        ? 'A mensagem não foi enviada. Os anexos continuam na fila para tentar novamente e não aparecem em Documentos até serem salvos.'
        : 'Não foi possível enviar a mensagem. Tente novamente.' + detail;
      if (uploadedDocuments.length && typeof window.showToast === 'function') {
        window.showToast(message + detail);
      } else if (typeof window.showToast === 'function') {
        window.showToast(message);
      }
    } finally {
      isSending = false;
      button.disabled = false;
      if (attachmentButton) attachmentButton.disabled = false;
    }
  }

  button.addEventListener('click', sendMessage);
  button.dataset.bound = 'true';
}

var CHAT_EMOJI_CATEGORIES = [
  { id: 'smileys', label: 'Rostos', icon: '😀', emojis: '😀|sorriso feliz rosto sorridente 😃|sorriso feliz 😄|sorriso olhos felizes 😁|grande sorriso 😆|rindo 😂|chorando de rir 🤣|rolando de rir 😊|sorriso contente 😇|anjo 🙂|sorriso leve 🙃|rosto invertido 😉|piscadela 😌|alívio 😍|apaixonado 🥰|amor corações 😘|beijo 😗|beijo 😙|beijo sorrindo 😚|beijo olhos fechados 😋|delícia 😛|língua 😜|piscando língua 🤪|maluco 😝|língua olhos fechados 🤑|dinheiro 🤗|abraço 🤭|mão na boca 🤫|silêncio 🤔|pensando 🤐|boca fechada 🤨|desconfiado 😐|neutro 😑|sem expressão 😶|sem palavras 😶|sumindo 😏|sorriso malicioso 😒|insatisfeito 🙄|revirando olhos 😬|careta 😮‍💨|suspiro 🤥|mentira 😔|triste 😪|sono 🤤|babando 😴|dormindo 😷|máscara 🤒|doente 🤕|machucado 🤢|enjoado 🤮|vomitando 🤧|espirrando 🥵|calor 🥶|frio 🥴|tonto 😵|zonzo 🤯|explodindo cabeça 🤠|caubói 🥳|festa 🥸|disfarce 😎|óculos escuros 🤓|nerd 🧐|monóculo 😕|confuso 😟|preocupado 🙁|triste ☹️|carrancudo 😮|surpreso 😯|silencioso 😲|espantado 😳|corado 🥺|por favor 😦|angustiado 😧|surpreso 😨|medo 😰|ansioso 😥|triste aliviado 😢|chorando 😭|chorando muito 😱|gritando 😖|frustrado 😣|perseverando 😞|decepcionado 😓|suor 😩|cansado 😫|exausto 🥱|bocejando 😤|triunfo 😡|raiva 😠|zangado 🤬|palavrão 😈|diabo sorrindo 👿|diabo bravo 💀|caveira ☠️|caveira perigo 💩|cocô 🤡|palhaço 👹|ogro 👺|duende 👻|fantasma 👽|alienígena 👾|monstro 🤖|robô 😺|gato sorrindo 😸|gato feliz 😹|gato rindo 😻|gato apaixonado 😼|gato sorrindo 😽|gato beijo 🙀|gato assustado 😿|gato chorando 😾|gato bravo 🙈|macaco não vejo 🙉|macaco não ouço 🙊|macaco não falo'.split(' ').filter(Boolean) },
  { id: 'people', label: 'Pessoas', icon: '👋', emojis: '👋|olá tchau mão 👋🏻|olá mão pele clara 👋🏼|olá mão pele média clara 👋🏽|olá mão pele média 👋🏾|olá mão pele média escura 👋🏿|olá mão pele escura 🤚|mão levantada 🖐️|mão aberta ✋|pare mão 🖖|vulcano 👌|ok 🤌|dedos juntos 🤏|pouco 🤞|dedos cruzados 🤟|amo você 🤘|rock 🤙|me liga 👈|dedo esquerda 👉|dedo direita 👆|dedo cima 👇|dedo baixo ☝️|indicador cima 👍|positivo gostei 👎|negativo não gostei ✊|punho 👊|soco 🤛|punho esquerda 🤜|punho direita 👏|palmas 🙌|comemoração 👐|mãos abertas 🤲|mãos juntas 🙏|por favor obrigado 👐|coração com mãos 💪|força músculo 🦾|braço robótico 🦿|perna robótica 🦵|perna 🦶|pé 👂|orelha 🦻|aparelho auditivo 👃|nariz 🧠|cérebro 🫀|coração anatômico 🫁|pulmões 🦷|dente 🦴|osso 👀|olhos 👁️|olho 👅|língua 👄|boca 😬|mordendo lábio 👶|bebê 🧒|criança 👦|menino 👧|menina 🧑|pessoa 👨|homem 👩|mulher 🧔|barba 👵|idosa 👴|idoso 🧓|pessoa idosa 🙍|pessoa triste 🙎|pessoa fazendo bico 🙅|não 🙆|ok 🙋|levantando mão 🙇|reverência 🤦|facepalm 🤷|tanto faz 🧏|surdo 💁|informação 💆|massagem 💇|cortando cabelo 🚶|caminhando 🏃|correndo 💃|dançando 🕺|dançarino 🧘|meditação 🛀|banho 🛌|dormindo 🧎|ajoelhado 🧍|em pé 👮|policial 🕵️|detetive 💂|guarda 👷|construção 🤴|príncipe 👸|princesa 👳|turbante 🧕|véu 👰|noiva 🤵|smoking 👼|anjo 🎅|papai noel 🤶|mamãe noel 🦸|super-herói 🦹|supervilão 🧙|mago 🧚|fada 🧛|vampiro 🧜|sereia 🧝|elfo 🧞|gênio 🧟|zumbi'.split(' ').filter(Boolean) },
  { id: 'animals', label: 'Animais', icon: '🐻', emojis: '🐶|cachorro 🐕|cão 🐩|poodle 🐺|lobo 🦊|raposa 🦝|guaxinim 🐱|gato 🐈|gatinho 🦁|leão 🐯|tigre 🐅|tigre 🐆|leopardo 🐴|cavalo 🐎|cavalo 🦄|unicórnio 🦓|zebra 🦌|veado 🦬|bisão 🐮|vaca 🐂|boi 🐃|búfalo 🐄|vaca 🐷|porco 🐖|porco 🐗|javali 🐽|focinho 🐏|carneiro 🐑|ovelha 🐐|cabra 🐪|camelo 🐫|camelo bactriano 🦙|lhama 🦒|girafa 🐘|elefante 🦣|mamute 🦏|rinoceronte 🦛|hipopótamo 🐭|rato 🐁|camundongo 🐀|rato 🐹|hamster 🐰|coelho 🐇|coelho 🐿️|esquilo 🦫|castor 🦔|ouriço 🦇|morcego 🐻|urso 🐻‍❄️|urso polar 🐨|coala 🐼|panda 🦥|preguiça 🦦|lontra 🦨|gambá 🦘|canguru 🦡|texugo 🐾|pegadas 🦃|peru 🐔|galinha 🐓|galo 🐣|pintinho nascendo 🐤|pintinho 🐥|pintinho 🐦|pássaro 🐧|pinguim 🕊️|pomba 🦅|águia 🦆|pato 🦢|cisne 🦉|coruja 🦤|dodô 🦩|flamingo 🦚|pavão 🦜|papagaio 🪽|asa 🐸|sapo 🐊|crocodilo 🐢|tartaruga 🦎|lagarto 🐍|cobra 🐲|dragão 🐉|dragão 🦕|dinossauro 🦖|t-rex 🐳|baleia 🐋|baleia 🐬|golfinho 🦭|foca 🐟|peixe 🐠|peixe tropical 🐡|baiacu 🦈|tubarão 🐙|polvo 🐚|concha 🪸|coral 🪼|água-viva 🦀|caranguejo 🦞|lagosta 🦐|camarão 🦑|lula 🦪|ostra 🐌|caracol 🦋|borboleta 🐛|lagarta 🐜|formiga 🐝|abelha 🪲|besouro 🐞|joaninha 🦗|grilo 🪳|barata 🕷️|aranha 🕸️|teia 🦂|escorpião 🦟|mosquito 🪰|mosca 🪱|minhoca'.split(' ').filter(Boolean) },
  { id: 'nature', label: 'Natureza', icon: '🌿', emojis: '🌱|muda 🌲|pinheiro 🌳|árvore 🌴|palmeira 🌵|cacto 🌾|arroz 🌿|erva ☘️|trevo 🍀|trevo sorte 🎍|bambu 🪴|planta 🏵️|roseta 🌹|rosa 🥀|rosa murcha 🌺|hibisco 🌻|girassol 🌼|flor 🌷|tulipa 🪻|jacinto 🌸|flor de cerejeira 💐|buquê 🍄|cogumelo 🍁|folha maple 🍂|folhas caindo 🍃|folha ao vento 🪹|ninho vazio 🪺|ninho ovos 🌍|terra europa áfrica 🌎|terra américas 🌏|terra ásia oceania 🌕|lua cheia 🌖|lua minguante 🌗|quarto minguante 🌘|lua crescente 🌑|lua nova 🌒|lua crescente 🌓|quarto crescente 🌔|lua gibosa 🌙|lua 🌚|lua nova rosto 🌝|lua cheia rosto 🌛|lua primeiro quarto 🌜|lua último quarto ⭐|estrela 🌟|estrela brilhante 💫|tontura ✨|brilhos 🌠|estrela cadente ☀️|sol 🌤️|sol nuvens ⛅|sol entre nuvens 🌥️|sol atrás nuvem 🌦️|chuva e sol 🌧️|chuva 🌨️|neve 🌩️|raio chuva ⛈️|tempestade 🌪️|tornado 🌫️|neblina 🌬️|vento 🌀|ciclone 🌈|arco-íris ☔|guarda-chuva chuva 💧|gota 🌊|onda 💥|explosão 🔥|fogo 💨|fumaça ❄️|neve ☃️|boneco neve ⛄|boneco neve 🌡️|termômetro 🧊|gelo'.split(' ').filter(Boolean) },
  { id: 'food', label: 'Comidas', icon: '🍕', emojis: '🍏|maçã verde 🍎|maçã 🍐|pera 🍊|laranja 🍋|limão 🍋‍🟩|lima 🍌|banana 🍉|melancia 🍇|uvas 🍓|morango 🫐|mirtilos 🍈|melão 🍒|cereja 🍑|pêssego 🥭|manga 🍍|abacaxi 🥥|coco 🥝|kiwi 🍅|tomate 🍆|berinjela 🥑|abacate 🥦|brócolis 🥬|folhas 🥒|pepino 🌶️|pimenta 🫑|pimentão 🌽|milho 🥕|cenoura 🫒|azeitona 🧄|alho 🧅|cebola 🥔|batata 🍠|batata doce 🫘|feijão 🌰|castanha 🥜|amendoim 🍞|pão 🥐|croissant 🥖|baguete 🫓|pão sírio 🥨|pretzel 🥯|bagel 🥞|panquecas 🧇|waffle 🧀|queijo 🍖|carne 🍗|frango 🍔|hambúrguer 🍟|batata frita 🍕|pizza 🌭|cachorro quente 🥪|sanduíche 🌮|taco 🌯|burrito 🫔|tamale 🥙|falafel 🧆|bolinho 🥚|ovo 🍳|fritando 🥘|panela 🍲|sopa 🫕|fondue 🥣|tigela 🥗|salada 🍿|pipoca 🧈|manteiga 🧂|sal 🥫|lata 🫙|pote 🍱|marmita 🍘|biscoito arroz 🍙|bolinho arroz 🍚|arroz 🍛|curry 🍜|macarrão 🍝|espaguete 🍠|batata assada 🍢|espetinho 🍣|sushi 🍤|camarão frito 🍥|surimi 🥮|bolo lua 🍡|dango 🍦|sorvete 🍧|raspadinha 🍨|sundae 🍩|rosquinha 🍪|biscoito 🎂|bolo aniversário 🍰|fatia de bolo 🧁|cupcake 🥧|torta 🍫|chocolate 🍬|doce 🍭|pirulito 🍮|pudim 🍯|mel 🍼|mamadeira 🥛|leite ☕|café 🫖|chá 🍵|chá verde 🧃|suco 🥤|copo canudo 🧋|bubble tea 🍶|saquê 🍺|cerveja 🍻|brinde cervejas 🥂|brinde taças 🍷|vinho 🥃|whisky 🍸|coquetel 🍹|bebida tropical 🧉|chimarrão 🧊|gelo'.split(' ').filter(Boolean) },
  { id: 'activities', label: 'Atividades', icon: '⚽', emojis: '⚽|futebol 🏀|basquete 🏈|futebol americano ⚾|baseball 🥎|softball 🎾|tênis 🏐|vôlei 🏉|rugby 🥏|frisbee 🎱|bilhar 🪀|ioiô 🏓|pingue-pongue 🏸|badminton 🏒|hóquei 🏑|hóquei campo 🥍|lacrosse 🏏|críquete 🪃|bumerangue 🥅|gol 🎣|pesca 🤿|mergulho 🥊|boxe 🥋|artes marciais 🎽|camiseta corrida 🛹|skate 🛼|patins 🛷|trenó ⛸️|patinação 🎿|esqui ⛷️|esquiador 🏂|snowboard 🪂|paraquedas 🏋️|levantamento 🏋️‍♀️|levantamento mulher 🏋️‍♂️|levantamento homem 🤼|luta 🤸|ginástica 🤺|esgrima 🏇|corrida cavalo ⛹️|basquete 🏌️|golfe 🏄|surfe 🏊|natação 🤽|polo aquático 🚣|remo 🧗|escalada 🚵|mountain bike 🚴|ciclismo 🏆|troféu 🥇|medalha ouro 🥈|medalha prata 🥉|medalha bronze 🏅|medalha 🎖️|medalha militar 🏵️|roseta 🎗️|laço 🎫|ingresso 🎟️|ingressos 🎪|circo 🤹|malabarismo 🎭|teatro 🎨|arte 🖼️|quadro 🎬|claquete 🎤|microfone 🎧|fone 🎼|partitura 🎹|piano 🥁|tambor 🪘|tambor longo 🎷|saxofone 🎺|trompete 🪗|acordeão 🎸|guitarra 🪕|banjo 🎻|violino 🪈|flauta 🎮|videogame 🕹️|controle 🎲|dados ♟️|xadrez 🧩|quebra-cabeça 🧸|ursinho 🎯|alvo 🪁|pipa 🎊|confete 🎉|festa 🎈|balão 🎁|presente 🎀|laço 🪄|varinha mágica 🎃|abóbora halloween 🎄|árvore natal 🎆|fogos 🎇|faísca 🧨|foguete 🎍|bambu 🎋|enfeite 🎎|bonecas 🎏|bandeira carpa 🎐|sino vento 🧧|envelope vermelho 🎑|lua'.split(' ').filter(Boolean) },
  { id: 'travel', label: 'Viagens', icon: '🚗', emojis: '🚗|carro 🚕|táxi 🚙|utilitário 🚌|ônibus 🚎|trólebus 🏎️|carro corrida 🚓|carro polícia 🚑|ambulância 🚒|bombeiros 🚐|van 🛻|picape 🚚|caminhão 🚛|caminhão carreta 🚜|trator 🏍️|moto 🛵|scooter 🚲|bicicleta 🛴|patinete 🛹|skate 🛞|roda ⛽|combustível 🚨|sirene 🚔|carro polícia 🚍|ônibus 🚘|carro 🚖|táxi 🚡|teleférico 🚠|bondinho 🚟|monotrilho 🚃|vagão 🚋|bonde 🚞|trem montanha 🚝|monotrilho 🚄|trem rápido 🚅|trem bala 🚈|metrô leve 🚂|locomotiva 🚆|trem 🚇|metrô 🚊|bonde 🚉|estação 🚁|helicóptero 🛩️|avião pequeno ✈️|avião 🛫|decolagem 🛬|pouso 🪂|paraquedas 💺|assento 🚀|foguete 🛸|disco voador 🚤|lancha 🛥️|barco 🛳️|navio ⛴️|balsa 🚢|navio ⛵|veleiro 🛶|canoa ⚓|âncora 🛟|boia 🗺️|mapa 🧭|bússola 🏖️|praia 🏝️|ilha 🏜️|deserto 🏕️|acampamento 🏔️|montanha 🏞️|parque 🏟️|estádio 🏛️|templo 🏗️|construção 🧱|tijolo 🏘️|casas 🏚️|casa abandonada 🏠|casa 🏡|casa jardim 🏢|escritório 🏬|loja 🏣|correio 🏤|agência correios 🏥|hospital 🏦|banco 🏨|hotel 🏩|hotel amor 🏪|loja conveniência 🏫|escola 🏭|fábrica 🏰|castelo 🏯|castelo japonês 💒|casamento 🗼|torre 🗽|estátua liberdade ⛪|igreja 🕌|mesquita 🛕|templo hindu 🕍|sinagoga ⛩️|santuário 🕋|caaba ⛲|fonte ⛺|barraca 🌁|neblina 🌃|cidade noite 🌆|cidade pôr do sol 🌇|pôr do sol 🌉|ponte noite 🌄|nascer sol 🌅|amanhecer 🌌|via láctea 🌠|estrela cadente'.split(' ').filter(Boolean) },
  { id: 'objects', label: 'Objetos', icon: '💡', emojis: '⌚|relógio 📱|celular 📲|celular seta ☎️|telefone 📞|telefone 📟|pager 📠|fax 🔋|bateria 🪫|bateria fraca 🔌|tomada 💻|notebook 🖥️|computador 🖨️|impressora ⌨️|teclado 🖱️|mouse 🖲️|trackball 💽|disco 💾|disquete 💿|cd 📀|dvd 🧮|ábaco 🎥|câmera 🎞️|filme 📷|câmera 📸|flash 📹|filmadora 📺|televisão 📻|rádio 🎙️|microfone estúdio 🎚️|controle áudio 🎛️|botões 🔍|lupa 🔎|lupa direita 🕯️|vela 💡|lâmpada 🔦|lanterna 🏮|lanterna papel 🪔|lâmpada óleo 📔|caderno capa 📕|livro fechado 📖|livro aberto 📗|livro verde 📘|livro azul 📙|livro laranja 📚|livros 📓|caderno 📒|livro contabilidade 📃|página enrolada 📜|pergaminho 📄|folha 📑|marcadores 🔖|marcador 🏷️|etiqueta 💰|saco dinheiro 🪙|moeda 💴|iene 💵|dólar 💶|euro 💷|libra 💸|dinheiro voando 💳|cartão crédito 🧾|recibo 💹|gráfico alta ✉️|envelope 📧|email 📨|carta recebida 📩|envelope seta 📤|envelope saída 📥|envelope entrada 📦|pacote 📫|caixa correio 📪|caixa correio fechada 📮|caixa correio 📬|caixa aberta 📭|caixa fechada 📯|corneta 📜|pergaminho 🔐|cadeado chave 🔒|cadeado fechado 🔓|cadeado aberto 🔏|cadeado caneta 🔑|chave 🗝️|chave antiga 🔨|martelo 🪓|machado ⛏️|picareta ⚒️|martelo picareta 🛠️|ferramentas 🔧|chave inglesa 🪛|chave de fenda 🔩|parafuso ⚙️|engrenagem 🗜️|morsa ⚖️|balança 🦯|bengala 🧰|caixa ferramentas 🪜|escada 🧲|ímã 🪝|gancho 🧪|tubo ensaio 🧫|placa petri 🧬|dna 🔬|microscópio 🔭|telescópio 📡|antena 🩹|curativo 🩺|estetoscópio 💊|pílula 💉|seringa 🩻|raio-x 🚪|porta 🛏️|cama 🛋️|sofá 🪑|cadeira 🚽|vaso sanitário 🚿|chuveiro 🛁|banheira 🪥|escova dentes 🧴|loção 🧻|papel higiênico 🧼|sabão 🧽|esponja 🧹|vassoura 🧺|cesto roupa 🧯|extintor 🛒|carrinho compras 🚬|cigarro ⚰️|caixão 🪦|lápide ⚱️|urna 🧿|olho grego 🪬|mão hamsa 🪧|placa 🪤|ratoeira 🪞|espelho 🪟|janela 🛍️|sacolas 🛎️|campainha 🔔|sino 🔕|sino mudo 🎵|nota musical 🎶|notas musicais 🎼|partitura 🎹|teclado musical 🔊|alto-falante 🔉|volume baixo 🔈|volume 🔇|mudo 📢|megafone 📣|megafone 📯|corneta 📺|televisão'.split(' ').filter(Boolean) },
  { id: 'symbols', label: 'Símbolos', icon: '❤️', emojis: '❤️|coração vermelho 🧡|coração laranja 💛|coração amarelo 💚|coração verde 💙|coração azul 💜|coração roxo 🖤|coração preto 🤍|coração branco 🤎|coração marrom 🩷|coração rosa 🩵|coração azul claro 🩶|coração cinza 💔|coração partido ❤️‍🔥|coração em chamas ❤️‍🩹|coração curando 💕|dois corações 💞|corações girando 💓|coração batendo 💗|coração crescendo 💖|coração brilhante 💘|coração flechado 💝|coração presente 💟|decoração coração ❣️|exclamação coração 💌|carta amor 💋|marca beijo 💯|cem 💢|raiva 💥|colisão 💫|tontura 💦|gotas suor 💨|correndo 💣|bomba 💤|dormindo 💬|balão fala 🗨️|balão fala 💭|pensamento 🗯️|balão raiva 👁️‍🗨️|olho balão ♨️|fontes termais 💈|barbearia 🛑|pare 🚫|proibido ⛔|entrada proibida 📛|crachá 🚷|proibido pedestres 🚯|não jogar lixo 🚳|proibido bicicletas 🚱|água imprópria 🚭|proibido fumar 🚸|crianças 🚫|proibido 🔞|maiores 18 ⚠️|atenção 🚸|crianças ⚕️|medicina ♻️|reciclagem ⚜️|flor de lis 🔱|tridente 📛|crachá 🔰|símbolo iniciante ✅|aprovado ☑️|caixa marcada ✔️|certo ❌|erro ❎|x verde ➕|mais ➖|menos ➗|divisão ✖️|multiplicação ♾️|infinito 💲|dólar 💱|câmbio ™️|marca registrada ©️|copyright ®️|registrado 🔴|círculo vermelho 🟠|círculo laranja 🟡|círculo amarelo 🟢|círculo verde 🔵|círculo azul 🟣|círculo roxo ⚫|círculo preto ⚪|círculo branco 🟤|círculo marrom 🔶|losango laranja 🔷|losango azul 🔸|losango pequeno laranja 🔹|losango pequeno azul 🔺|triângulo vermelho 🔻|triângulo invertido 🔼|triângulo cima 🔽|triângulo baixo ⭐|estrela 🌟|estrela brilhante ✨|brilhos 🔆|brilho alto 🔅|brilho baixo 🔝|topo 🔜|em breve 🔙|voltar 🔛|ligado 🔚|fim 🔜|próximo ⬆️|seta cima ⬇️|seta baixo ⬅️|seta esquerda ➡️|seta direita ↗️|seta diagonal ↘️|seta diagonal ↙️|seta diagonal ↖️|seta diagonal 🔃|setas horário 🔄|atualizar 🔁|repetir 🔂|repetir uma 🔀|aleatório ▶️|reproduzir ⏸️|pausar ⏹️|parar ⏺️|gravar ⏭️|próximo faixa ⏮️|faixa anterior ⏩|avançar ⏪|voltar ⏫|subir ⏬|descer 🔔|sino 🔕|silenciar 📣|megafone 🏁|bandeira quadriculada 🚩|bandeira vermelha 🎌|bandeiras cruzadas 🏳️|bandeira branca 🏴|bandeira preta 🏳️‍🌈|bandeira arco-íris 🏳️‍⚧️|bandeira transgênero 🏴‍☠️|bandeira pirata ♠️|espadas ♥️|copas ♦️|ouros ♣️|paus 🃏|coringa 🀄|mahjong 🎴|cartas japonesas 🔠|letras 🔡|letras minúsculas 🔢|números 🔣|símbolos 🔤|alfabeto 🆎|AB 🆑|CL 🆒|legal 🆓|grátis ℹ️|informação 🆔|identificação 🆕|novo 🆖|não ok 🆗|ok 🆙|subindo 🆘|sos 🆚|versus 🈁|japonês 🈂️|serviço 🈷️|mensal 🈶|pago 🈯|reservado 🉐|oferta 🈹|desconto 🈚|grátis 🈲|proibido 🉑|aceitável 🈸|inscrição 🈴|aprovado 🈳|vago 🈵|lotado 🔴|gravar 🟣|círculo'.split(' ').filter(Boolean) },
  { id: 'flags', label: 'Bandeiras', icon: '🏁', emojis: '🏁|bandeira quadriculada 🚩|bandeira vermelha 🎌|bandeiras cruzadas 🏳️|bandeira branca 🏴|bandeira preta 🏳️‍🌈|bandeira arco-íris 🏳️‍⚧️|bandeira transgênero 🏴‍☠️|bandeira pirata 🇧🇷|Brasil 🇵🇹|Portugal 🇺🇸|Estados Unidos 🇨🇦|Canadá 🇲🇽|México 🇦🇷|Argentina 🇨🇱|Chile 🇨🇴|Colômbia 🇵🇪|Peru 🇺🇾|Uruguai 🇵🇾|Paraguai 🇧🇴|Bolívia 🇪🇨|Equador 🇻🇪|Venezuela 🇬🇧|Reino Unido 🇮🇪|Irlanda 🇫🇷|França 🇪🇸|Espanha 🇮🇹|Itália 🇩🇪|Alemanha 🇳🇱|Países Baixos 🇧🇪|Bélgica 🇨🇭|Suíça 🇦🇹|Áustria 🇸🇪|Suécia 🇳🇴|Noruega 🇩🇰|Dinamarca 🇫🇮|Finlândia 🇵🇱|Polônia 🇺🇦|Ucrânia 🇷🇺|Rússia 🇬🇷|Grécia 🇹🇷|Turquia 🇮🇱|Israel 🇸🇦|Arábia Saudita 🇦🇪|Emirados Árabes 🇮🇳|Índia 🇵🇰|Paquistão 🇨🇳|China 🇯🇵|Japão 🇰🇷|Coreia do Sul 🇹🇭|Tailândia 🇻🇳|Vietnã 🇮🇩|Indonésia 🇦🇺|Austrália 🇳🇿|Nova Zelândia 🇿🇦|África do Sul 🇪🇬|Egito 🇳🇬|Nigéria 🇰🇪|Quênia 🇲🇦|Marrocos 🇯🇲|Jamaica 🇨🇺|Cuba 🇩🇴|República Dominicana 🇵🇷|Porto Rico 🇺🇳|Nações Unidas'.split(' ').filter(Boolean) }
];

function bindChatEmojiPicker() {
  var button = document.getElementById('emoji-btn');
  var picker = document.getElementById('chat-emoji-picker');
  var search = document.getElementById('chat-emoji-search');
  var categoriesRoot = document.getElementById('chat-emoji-categories');
  var grid = document.getElementById('chat-emoji-grid');
  var empty = document.getElementById('chat-emoji-empty');
  var closeButton = document.getElementById('chat-emoji-close');
  var input = document.getElementById('chat-message-input');
  if (!button || !picker || !search || !categoriesRoot || !grid || !input || picker.dataset.bound === 'true') return;

  var activeCategory = CHAT_EMOJI_CATEGORIES[0].id;
  var searchTerms = '';
  var savedSelectionStart = 0;
  var savedSelectionEnd = 0;

  function getEmojiEntries(category) {
    var entries = [];
    category.emojis.forEach(function(token) {
      var divider = token.indexOf('|');
      if (divider !== -1) {
        entries.push({
          emoji: token.slice(0, divider),
          label: token.slice(divider + 1)
        });
      } else if (entries.length) {
        entries[entries.length - 1].label += ' ' + token;
      }
    });
    return entries;
  }

  function renderCategories() {
    categoriesRoot.innerHTML = CHAT_EMOJI_CATEGORIES.map(function(category) {
      var selected = category.id === activeCategory;
      return '<button type="button" role="tab" aria-selected="' + selected + '" class="emoji-picker-category' +
        (selected ? ' active' : '') + '" data-emoji-category="' + category.id + '" title="' + category.label +
        '" aria-label="' + category.label + '">' + category.icon + '</button>';
    }).join('');
  }

  function renderEmojis() {
    var query = searchTerms.trim().toLocaleLowerCase('pt-BR');
    var categories = query
      ? CHAT_EMOJI_CATEGORIES
      : CHAT_EMOJI_CATEGORIES.filter(function(category) { return category.id === activeCategory; });
    var results = [];
    categories.forEach(function(category) {
      getEmojiEntries(category).forEach(function(entry) {
        if (!query || entry.label.toLocaleLowerCase('pt-BR').indexOf(query) !== -1) results.push(entry);
      });
    });
    grid.innerHTML = results.map(function(entry) {
      return '<button type="button" class="emoji-picker-item" data-insert-emoji="' + entry.emoji +
        '" aria-label="' +
        escapeHtml(entry.label || entry.emoji) + '">' + entry.emoji + '</button>';
    }).join('');
    empty.hidden = results.length > 0;
    grid.hidden = results.length === 0;
  }

  function setPickerVisible(visible) {
    picker.hidden = !visible;
    button.setAttribute('aria-expanded', String(visible));
    if (visible) {
      savedSelectionStart = input.selectionStart;
      savedSelectionEnd = input.selectionEnd;
      search.focus();
      renderEmojis();
    } else {
      search.value = '';
      searchTerms = '';
      input.focus();
    }
  }

  button.addEventListener('click', function() {
    setPickerVisible(picker.hidden);
  });
  if (closeButton) closeButton.addEventListener('click', function() { setPickerVisible(false); });
  search.addEventListener('input', function() {
    searchTerms = search.value;
    renderEmojis();
  });
  categoriesRoot.addEventListener('click', function(event) {
    var categoryButton = event.target.closest('[data-emoji-category]');
    if (!categoryButton) return;
    activeCategory = categoryButton.dataset.emojiCategory;
    renderCategories();
    renderEmojis();
  });
  grid.addEventListener('click', function(event) {
    var emojiButton = event.target.closest('[data-insert-emoji]');
    if (!emojiButton) return;
    var emoji = emojiButton.dataset.insertEmoji;
    input.focus();
    input.setRangeText(emoji, savedSelectionStart, savedSelectionEnd, 'end');
    savedSelectionStart = input.selectionStart;
    savedSelectionEnd = input.selectionEnd;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('click', function(event) {
    if (!picker.hidden && !picker.contains(event.target) && !button.contains(event.target)) setPickerVisible(false);
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !picker.hidden) {
      setPickerVisible(false);
      button.focus();
    }
  });
  renderCategories();
  renderEmojis();
  picker.dataset.bound = 'true';
}

function renderChatSearchResults(query) {
  var resultsRoot = document.getElementById('chat-search-results');
  if (!resultsRoot || !window.RildonXStore) return;
  var search = String(query || '').trim().toLocaleLowerCase('pt-BR');
  if (!search) {
    resultsRoot.innerHTML = '<p>Digite um texto para buscar nesta conversa.</p>';
    return;
  }
  var messages = (window.RildonXStore.getState().messages || []).filter(function(message) {
    return message.conversationId === activeConversationId &&
      (activeConversationId !== 'local-test' || message.localOnly === true) &&
      String(message.text || '').toLocaleLowerCase('pt-BR').indexOf(search) !== -1;
  }).slice().sort(function(first, second) {
    return new Date(second.sentAt || 0) - new Date(first.sentAt || 0);
  });
  resultsRoot.innerHTML = '<p class="chat-search-count">' + messages.length +
    (messages.length === 1 ? ' resultado' : ' resultados') + '</p>' +
    (messages.length ? messages.map(function(message) {
      var snippet = String(message.text || '').trim();
      if (snippet.length > 120) snippet = snippet.slice(0, 117) + '...';
      return '<button type="button" class="chat-search-result" data-chat-search-result="' +
          escapeHtml(message.id) + '"><b>' + escapeHtml(getProfileDisplayName(
            getMessageSenderProfile(message, window.RildonXStore.getState().profiles),
            message.senderName || 'Usuário'
          )) +
          '</b><span>' + escapeHtml(snippet) + '</span></button>';
    }).join('') : '<p>Nenhuma mensagem encontrada.</p>');
}

function bindMessageActions() {
  var searchButton = document.getElementById('chat-search-btn');
  var searchPanel = document.getElementById('chat-search-panel');
  var searchInput = document.getElementById('chat-search-input');
  var searchCloseButton = document.getElementById('chat-search-close');
  var searchResults = document.getElementById('chat-search-results');
  var attachmentButton = document.getElementById('attachment-btn');
  var fileInput = document.getElementById('chat-file-input');
  var personProfileModal = document.getElementById('person-profile-modal');
  var profileMessageButton = document.getElementById('person-profile-message');

  if (searchButton && searchInput && searchPanel) searchButton.addEventListener('click', function() {
    searchPanel.hidden = !searchPanel.hidden;
    if (searchPanel.hidden) {
      searchInput.value = '';
      renderChatSearchResults('');
      document.querySelectorAll('.msg.search-result-active').forEach(function(message) {
        message.classList.remove('search-result-active');
      });
    } else {
      renderChatSearchResults(searchInput.value);
      searchInput.focus();
    }
  });
  if (searchInput) searchInput.addEventListener('input', function() {
    renderChatSearchResults(searchInput.value);
  });
  if (searchCloseButton && searchPanel) searchCloseButton.addEventListener('click', function() {
    searchPanel.hidden = true;
    if (searchInput) searchInput.value = '';
    renderChatSearchResults('');
    document.querySelectorAll('.msg.search-result-active').forEach(function(message) {
      message.classList.remove('search-result-active');
    });
    if (searchButton) searchButton.focus();
  });
  if (searchResults) searchResults.addEventListener('click', function(event) {
    var resultButton = event.target.closest('[data-chat-search-result]');
    if (!resultButton) return;
    var target = Array.prototype.find.call(
      document.querySelectorAll('[data-chat-message-id]'),
      function(messageElement) { return messageElement.dataset.chatMessageId === resultButton.dataset.chatSearchResult; }
    );
    if (!target) return;
    document.querySelectorAll('.msg.search-result-active').forEach(function(message) {
      message.classList.remove('search-result-active');
    });
    target.classList.add('search-result-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  bindChatEmojiPicker();
  if (attachmentButton && fileInput) attachmentButton.addEventListener('click', function() { fileInput.accept = ''; fileInput.click(); });
  if (profileMessageButton) profileMessageButton.addEventListener('click', function() {
    if (!activePersonProfileId) return;
    profileMessageButton.disabled = true;
    startConversationWithPerson(activePersonProfileId).then(function() {
      if (personProfileModal) personProfileModal.hidden = true;
      activePersonProfileId = null;
    }).catch(function(error) {
      console.error('Não foi possível abrir uma conversa com esta pessoa:', error);
      showToast(error.message || 'Não foi possível iniciar a conversa.');
    }).finally(function() {
      profileMessageButton.disabled = false;
    });
  });
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape' || !personProfileModal || personProfileModal.hidden) return;
    personProfileModal.hidden = true;
    activePersonProfileId = null;
  });
  var messageActionsModal = document.getElementById('message-actions-modal');
  var messageForwardModal = document.getElementById('message-forward-modal');
  document.addEventListener('click', function(event) {
    var createPeopleUserButton = event.target.closest('[data-people-create-user]');
    var closePeopleUserForm = event.target.closest('[data-close-people-user-form]');
    var peopleUserFormModal = document.getElementById('people-user-form-modal');
    var panelPermissionButton = event.target.closest('[data-panel-permission]');
    if (panelPermissionButton) {
      event.preventDefault();
      var enabled = panelPermissionButton.getAttribute('aria-pressed') !== 'true';
      panelPermissionButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      panelPermissionButton.classList.toggle('is-enabled', enabled);
      return;
    }
    if (createPeopleUserButton) {
      event.preventDefault();
      openPeopleUserForm();
      return;
    }
    if (closePeopleUserForm) {
      if (peopleUserFormModal) peopleUserFormModal.hidden = true;
      return;
    }
    var editProfileTrigger = event.target.closest('[data-edit-person-profile]');
    var profileTrigger = event.target.closest('[data-person-profile-id]');
    var messageTrigger = event.target.closest('[data-person-message-id]');
    if (event.target.closest('[data-close-person-profile]') || event.target === personProfileModal) {
      if (personProfileModal) personProfileModal.hidden = true;
      activePersonProfileId = null;
      return;
    }
    if (editProfileTrigger) {
      event.preventDefault();
      event.stopPropagation();
      showPersonProfile(editProfileTrigger.dataset.editPersonProfile, true);
      return;
    }
    if (profileTrigger) {
      showPersonProfile(profileTrigger.dataset.personProfileId);
      return;
    }
    if (messageTrigger) {
      var targetProfileId = messageTrigger.dataset.personMessageId;
      messageTrigger.disabled = true;
      startConversationWithPerson(targetProfileId).catch(function(error) {
        console.error('Não foi possível abrir uma conversa com esta pessoa:', error);
        showToast(error.message || 'Não foi possível iniciar a conversa.');
      }).finally(function() {
        messageTrigger.disabled = false;
      });
      return;
    }
  });
  document.addEventListener('submit', function(event) {
    var peopleUserForm = event.target.closest('#people-user-form');
    if (peopleUserForm) {
      event.preventDefault();
      var inviteButton = peopleUserForm.querySelector('[type="submit"]');
      if (inviteButton) inviteButton.disabled = true;
      createPeopleUser(peopleUserForm).catch(function(error) {
        console.error('Não foi possível cadastrar o usuário pelo diretório Pessoas:', error);
        showToast(error.message || 'Não foi possível cadastrar o usuário.');
      }).finally(function() {
        if (inviteButton && inviteButton.isConnected) inviteButton.disabled = false;
      });
      return;
    }
    var adminProfileForm = event.target.closest('#admin-person-profile-form');
    if (!adminProfileForm) return;
    event.preventDefault();
    var submitButton = adminProfileForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    saveAdminPersonProfile(adminProfileForm).catch(function(error) {
      console.error('Não foi possível atualizar o perfil pelo card Pessoas:', error);
      showToast(error.message || 'Não foi possível salvar as alterações do perfil.');
    }).finally(function() {
      if (submitButton && submitButton.isConnected) submitButton.disabled = false;
    });
    var menuButton = event.target.closest('[data-message-menu]');
    var closeButton = event.target.closest('[data-close-message-actions]');
    var actionButton = event.target.closest('[data-message-menu-action]');
    var state = window.RildonXStore && window.RildonXStore.getState();
    if (menuButton && messageActionsModal && state) {
      activeMessageActionId = menuButton.dataset.messageMenu;
      var message = (state.messages || []).find(function(item) { return String(item.id) === activeMessageActionId; });
      if (!message) return;
      var attachments = (message.attachments || []).map(function(attachment) {
        var id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
        return (state.documents || []).find(function(file) { return id && String(file.id) === String(id); }) ||
          (attachment && typeof attachment === 'object' ? attachment : null);
      }).filter(Boolean);
      var hasFile = attachments.length > 0;
      messageActionsModal.querySelectorAll('[data-message-menu-action="open"],[data-message-menu-action="download"],[data-message-menu-action="save"]').forEach(function(button) {
        button.disabled = !hasFile;
      });
      var saveButton = messageActionsModal.querySelector('[data-message-menu-action="save"]');
      if (saveButton) saveButton.disabled = !hasFile ||
        String(attachments[0].folder || '').trim().toLocaleLowerCase('pt-BR') === 'mensagens';
      var marked = (state.starredMessageIds || []).indexOf(message.id) !== -1;
      var markButton = messageActionsModal.querySelector('[data-message-menu-action="mark"]');
      if (markButton) markButton.textContent = marked ? 'Remover marcação' : 'Marcar mensagem';
      var pinned = (state.conversationPins || {})[message.conversationId];
      var pinButton = messageActionsModal.querySelector('[data-message-menu-action="pin"]');
      if (pinButton) pinButton.textContent = pinned === message.id ? 'Desafixar mensagem' : 'Fixar mensagem no topo';
      messageActionsModal.hidden = false;
      return;
    }
    if (closeButton || event.target === messageActionsModal) {
      if (messageActionsModal) messageActionsModal.hidden = true;
      activeMessageActionId = null;
      return;
    }
    if (!actionButton || !state || !activeMessageActionId) return;
    var selectedMessage = (state.messages || []).find(function(item) { return String(item.id) === activeMessageActionId; });
    if (!selectedMessage) return;
    var action = actionButton.dataset.messageMenuAction;
    if (['open', 'download', 'save'].indexOf(action) !== -1) {
      var attachment = (selectedMessage.attachments || [])[0];
      var attachmentId = typeof attachment === 'string' ? attachment : attachment && attachment.id;
      if (!attachmentId) return;
      var proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.dataset.documentAction = action;
      proxy.dataset.documentId = attachmentId;
      proxy.dataset.messageId = selectedMessage.id;
      document.body.appendChild(proxy);
      proxy.click();
      proxy.remove();
      messageActionsModal.hidden = true;
      activeMessageActionId = null;
      return;
    }
    if (action === 'mark') {
      var markedIds = (state.starredMessageIds || []).slice();
      var markedIndex = markedIds.indexOf(selectedMessage.id);
      if (markedIndex === -1) markedIds.push(selectedMessage.id);
      else markedIds.splice(markedIndex, 1);
      window.RildonXStore.setState({ starredMessageIds: markedIds });
    } else if (action === 'pin') {
      var pins = Object.assign({}, state.conversationPins || {});
      if (pins[selectedMessage.conversationId] === selectedMessage.id) delete pins[selectedMessage.conversationId];
      else pins[selectedMessage.conversationId] = selectedMessage.id;
      window.RildonXStore.setState({ conversationPins: pins });
    } else if (action === 'reply') {
      replyToMessageId = selectedMessage.id;
      var replyPreview = document.getElementById('chat-reply-preview');
      if (replyPreview) {
        replyPreview.innerHTML = '<span><b>Respondendo a ' + escapeHtml(getProfileDisplayName(
          getMessageSenderProfile(selectedMessage, state.profiles),
          selectedMessage.senderName || 'Usuário'
        )) + '</b><small>' +
          escapeHtml(selectedMessage.text || 'Arquivo compartilhado') + '</small></span><button type="button" data-clear-message-reply aria-label="Cancelar resposta">×</button>';
        replyPreview.hidden = false;
      }
      var messageInput = document.getElementById('chat-message-input');
      if (messageInput) messageInput.focus();
    } else if (action === 'forward') {
      pendingForwardMessageId = selectedMessage.id;
      var targets = document.getElementById('message-forward-targets');
      var otherConversations = (state.conversations || []).filter(function(conversation) {
        return conversation.id !== 'local-test' && conversation.name;
      });
      if (targets) targets.innerHTML = otherConversations.length ? otherConversations.map(function(conversation) {
        var otherProfile = getConversationOtherProfile(conversation, state);
        var name = conversation.kind === 'direct'
          ? getProfileDisplayName(otherProfile, conversation.name)
          : conversation.name;
        return '<button type="button" data-forward-conversation="' + escapeHtml(conversation.id) + '">' +
          escapeHtml(name) + '</button>';
      }).join('') : '<p class="conversation-details-empty">Não há outra conversa disponível para encaminhar.</p>';
      if (messageForwardModal) messageForwardModal.hidden = false;
    }
    messageActionsModal.hidden = true;
    activeMessageActionId = null;
  });
  document.addEventListener('click', async function(event) {
    if (event.target.closest('[data-close-message-forward]') || event.target === messageForwardModal) {
      if (messageForwardModal) messageForwardModal.hidden = true;
      pendingForwardMessageId = null;
      return;
    }
    var targetButton = event.target.closest('[data-forward-conversation]');
    if (!targetButton || !pendingForwardMessageId || !window.RildonXStore) return;
    targetButton.disabled = true;
    try {
      var state = window.RildonXStore.getState();
      var source = (state.messages || []).find(function(message) {
        return String(message.id) === String(pendingForwardMessageId);
      });
      var target = (state.conversations || []).find(function(conversation) {
        return String(conversation.id) === targetButton.dataset.forwardConversation;
      });
      if (!source || !target) throw new Error('A mensagem ou conversa de destino não está mais disponível.');
      if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        throw new Error('O serviço de mensagens não está disponível.');
      }
      var authResult = await window.supabaseClient.auth.getUser();
      if (authResult.error) throw authResult.error;
      if (!authResult.data.user) throw new Error('Entre novamente para encaminhar esta mensagem.');
      var senderName = state.user && state.user.name || 'Usuário';
      var sentAt = new Date().toISOString();
      var result = await window.supabaseClient.from('messages').insert({
        conversation_id: target.id,
        sender_id: authResult.data.user.id,
        sender_name: senderName,
        text: source.text ? 'Encaminhada: ' + source.text : 'Arquivo encaminhado.',
        sent_at: sentAt,
        attachments: source.attachments || []
      }).select('*').single();
      if (result.error) throw result.error;
      window.RildonXStore.addMessage({
        id: result.data.id,
        conversationId: target.id,
        senderId: result.data.sender_id,
        senderName: result.data.sender_name,
        text: result.data.text,
        sentAt: result.data.sent_at,
        attachments: result.data.attachments,
        localOnly: false
      });
      if (typeof window.showToast === 'function') window.showToast('Mensagem encaminhada para ' + target.name + '.');
      if (messageForwardModal) messageForwardModal.hidden = true;
      pendingForwardMessageId = null;
    } catch (error) {
      console.error('Não foi possível encaminhar a mensagem:', error);
      if (typeof window.showToast === 'function') {
        window.showToast('Não foi possível encaminhar a mensagem. ' + (error && error.message ? error.message : 'Tente novamente.'));
      }
      targetButton.disabled = false;
    }
  });
  document.addEventListener('click', function(event) {
    if (!event.target.closest('[data-clear-message-reply]')) return;
    replyToMessageId = null;
    var replyPreview = document.getElementById('chat-reply-preview');
    if (replyPreview) {
      replyPreview.hidden = true;
      replyPreview.innerHTML = '';
    }
  });
  document.addEventListener('click', function(event) {
    var previewButton = event.target.closest('[data-chat-image-preview]');
    var viewer = document.getElementById('chat-image-viewer');
    if (previewButton && viewer) {
      var documentId = previewButton.dataset.chatImagePreview;
      var image = previewButton.querySelector('img');
      var viewerImage = document.getElementById('chat-image-viewer-image');
      var openButton = document.getElementById('chat-image-viewer-open');
      var downloadButton = document.getElementById('chat-image-viewer-download');
      if (!image || !image.src || !image.dataset.loaded) return;
      viewerImage.src = image.src;
      viewerImage.alt = image.alt;
      openButton.dataset.documentId = documentId;
      downloadButton.dataset.documentId = documentId;
      viewer.hidden = false;
      document.body.classList.add('image-viewer-open');
      var closeButton = document.getElementById('chat-image-viewer-close');
      if (closeButton) closeButton.focus();
      return;
    }

    if (event.target.closest('[data-close-image-viewer]') ||
      (event.target.id === 'chat-image-viewer')) {
      closeChatImageViewer();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeChatImageViewer();
  });

}

function closeChatImageViewer() {
  var viewer = document.getElementById('chat-image-viewer');
  if (!viewer || viewer.hidden) return;
  viewer.hidden = true;
  document.body.classList.remove('image-viewer-open');
  var image = document.getElementById('chat-image-viewer-image');
  if (image) image.removeAttribute('src');
}

function initProjectActivityTracking() {
  if (!window.RildonXStore || typeof window.RildonXStore.subscribe !== 'function') return;
  var store = window.RildonXStore;
  var previousState;
  var ready = false;
  var writing = false;
  var userId = null;
  var recentId = function () {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'activity-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  };
  var complete = function (task) {
    var status = String(task.status || '').toLocaleLowerCase('pt-BR');
    return status === 'concluída' || status === 'concluida' || status === 'concluído' ||
      status === 'concluido' || status === 'completed' || status === 'done';
  };
  var cleanProject = function (project) {
    var copy = Object.assign({}, project);
    delete copy.activityLog;
    delete copy.progress;
    delete copy.status;
    delete copy.completedAt;
    delete copy.updatedAt;
    return JSON.stringify(copy);
  };
  var snapshotTasks = function (state) {
    var result = {};
    (state.tasks || []).forEach(function (task) {
      if (!task || task.isDemo) return;
      result[String(task.id)] = task;
    });
    return result;
  };

  Promise.resolve(window.RildonXSync && typeof window.RildonXSync.ready === 'function'
    ? window.RildonXSync.ready()
    : null).catch(function (error) {
      console.error('Falha ao aguardar a sincronização antes de registrar atividades:', error);
    }).then(function () {
      var identify = window.supabaseClient && window.supabaseClient.auth
        ? window.supabaseClient.auth.getUser()
        : Promise.resolve(null);
      return Promise.resolve(identify).then(function (result) {
        if (result && result.error) throw result.error;
        userId = result && result.data && result.data.user ? result.data.user.id : null;
      }).catch(function (error) {
        console.error('Não foi possível identificar o autor das atividades de projeto:', error);
      });
    }).then(function () {
      previousState = store.getState();
      ready = true;
      store.subscribe(function (nextState) {
        if (!ready || writing) return;
        var oldState = previousState || nextState;
        previousState = nextState;
        var projects = (nextState.projects || []).filter(function (project) {
          return project && !project.isDemo;
        }).map(function (project) { return Object.assign({}, project); });
        var byId = {};
        var oldProjects = {};
        projects.forEach(function (project) { byId[String(project.id)] = project; });
        (oldState.projects || []).forEach(function (project) { oldProjects[String(project.id)] = project; });
        var changes = {};
        var addActivity = function (projectId, text) {
          var id = String(projectId || '');
          if (!byId[id]) return;
          if (!changes[id]) changes[id] = [];
          changes[id].push({
            id: recentId(),
            description: text,
            actorName: (nextState.profiles || []).find(function (profile) {
              return profile.id === userId;
            })?.displayName || nextState.user?.name || 'Usuário',
            createdAt: new Date().toISOString()
          });
        };
        projects.forEach(function (project) {
          var old = oldProjects[String(project.id)];
          if (!old) addActivity(project.id, 'Projeto criado');
          else if (cleanProject(old) !== cleanProject(project)) {
            addActivity(project.id, old.archived !== project.archived
              ? (project.archived ? 'Projeto arquivado' : 'Projeto desarquivado')
              : 'Informações do projeto atualizadas');
          }
        });

        var oldTasks = snapshotTasks(oldState);
        var newTasks = snapshotTasks(nextState);
        Object.keys(newTasks).forEach(function (id) {
          var task = newTasks[id];
          var old = oldTasks[id];
          if (!old) {
            if (task.projectId) addActivity(task.projectId, 'Tarefa adicionada: ' + (task.title || 'sem título'));
          } else if (JSON.stringify(old) !== JSON.stringify(task)) {
            var becameComplete = complete(task) !== complete(old);
            var changeText = becameComplete
              ? (complete(task) ? 'Tarefa concluída: ' : 'Tarefa reaberta: ') + (task.title || old.title || 'tarefa')
              : 'Tarefa atualizada: ' + (task.title || 'sem título');
            if (old.projectId && String(old.projectId) !== String(task.projectId)) {
              addActivity(old.projectId, 'Tarefa removida do projeto: ' + (old.title || 'tarefa'));
            }
            if (task.projectId) addActivity(task.projectId, changeText);
          }
        });
        Object.keys(oldTasks).forEach(function (id) {
          if (!newTasks[id] && oldTasks[id].projectId) {
            addActivity(oldTasks[id].projectId, 'Tarefa removida: ' + (oldTasks[id].title || 'sem título'));
          }
        });

        var changed = false;
        projects.forEach(function (project) {
          var tasks = (nextState.tasks || []).filter(function (task) {
            return task && !task.isDemo && String(task.projectId || '') === String(project.id);
          });
          var completeCount = tasks.filter(complete).length;
          var progress = tasks.length ? Math.round(completeCount * 100 / tasks.length) : 0;
          var status = tasks.length && completeCount === tasks.length ? 'Concluído' :
            completeCount > 0 ? 'Em andamento' : 'Planejamento';
          var completedAt = status === 'Concluído' ? (project.completedAt || new Date().toISOString()) : null;
          if (project.status !== status || Number(project.progress || 0) !== progress ||
              (project.completedAt || null) !== completedAt) {
            project.status = status;
            project.progress = progress;
            project.completedAt = completedAt;
            project.updatedAt = new Date().toISOString();
            changed = true;
            if (status !== (oldProjects[String(project.id)] || {}).status) {
              addActivity(project.id, 'Status atualizado para ' + status);
            }
          }
          if (changes[String(project.id)] && changes[String(project.id)].length) {
            project.activityLog = (project.activityLog || []).concat(changes[String(project.id)]).slice(-60);
            project.updatedAt = new Date().toISOString();
            changed = true;
          }
        });
        if (changed) {
          writing = true;
          try {
            store.setState({ projects: projects });
          } finally {
            writing = false;
          }
          previousState = store.getState();
        }
      });
    });
}

document.addEventListener('DOMContentLoaded', function () {
  movePageHeadingToTopbar();
  bindGlobalSearch();
  bindGlobalHeaderActions();
  renderGlobalUserSummary();
  applySavedTheme();
  bindProfileSettings();
  bindQuickCreateActions();
  bindMessageComposer();
  bindMessageActions();
  bindConversationDetails();
  bindNewConversationMenu();
  bindMuralFeed();
  observeProfileAvatarImages();
  initProjectActivityTracking();
  var peopleSearch = document.getElementById('people-directory-search');
  if (peopleSearch) {
    peopleSearch.addEventListener('input', renderPeopleDirectory);
    renderPeopleDirectory();
  }
  if (document.body.dataset.page === 'pessoas' &&
      window.RildonXSync && typeof window.RildonXSync.ready === 'function') {
    window.RildonXSync.ready().then(function() {
      if (!currentUserCanManagePeople()) return;
      return syncPeoplePanelCatalog();
    }).catch(function(error) {
      console.error('Não foi possível sincronizar o catálogo de painéis ao abrir Controle de Funcionários:', error);
      showToast('Não foi possível atualizar a lista de painéis. Recarregue a página ou tente novamente.');
    });
  }
  if (window.supabaseClient && window.supabaseClient.auth) {
    window.supabaseClient.auth.getUser().then(function (result) {
      if (!result.error && result.data.user) {
        setCurrentAuthenticatedUser(result.data.user);
        renderMessagesFromStore();
        renderPeopleDirectory();
        renderInicioTasksFromStore();
        renderHomeRecentConversations();
        renderMuralPosts();
      }
    }).catch(function (error) {
      console.error('Não foi possível identificar o usuário do Mural:', error);
    });
  }
  if (window.RildonXStore && typeof window.RildonXStore.subscribe === 'function') {
    refreshStoreDrivenUi();
    window.RildonXStore.subscribe(function () {
      refreshStoreDrivenUi();
    });
  } else {
    refreshStoreDrivenUi();
  }
  if (document.body.dataset.page === 'messenger') {
    var profileParams = new URLSearchParams(window.location.search);
    var requestedPersonId = profileParams.get('personProfile');
    if (requestedPersonId && window.RildonXSync && window.RildonXSync.ready) {
      window.RildonXSync.ready().then(function() {
        return window.supabaseClient && window.supabaseClient.auth
          ? window.supabaseClient.auth.getUser().then(function(result) {
            if (result.error) throw result.error;
            if (result.data && result.data.user) setCurrentAuthenticatedUser(result.data.user);
          })
          : undefined;
      }).then(function() {
        showPersonProfile(requestedPersonId, profileParams.get('editProfile') === 'true');
        var url = new URL(window.location.href);
        url.searchParams.delete('personProfile');
        url.searchParams.delete('editProfile');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }).catch(function(error) {
        console.error('Não foi possível abrir o perfil solicitado:', error);
        showToast('Não foi possível carregar o perfil solicitado.');
      });
    }
  }
});

/* ===================== GENERIC CHOICE / CHIP HELPERS ===================== */
function selectChoice(btn, groupId) {
  document.querySelectorAll('#' + groupId + ' .choice-btn').forEach(function(el){ el.classList.remove('selected'); });
  btn.classList.add('selected');
}
function togglePeopleChip(chip) {
  chip.classList.toggle('selected');
}
function addChecklistItem() {
  var wrap = document.getElementById('nt-checklist');
  var row = document.createElement('div');
  row.className = 'checklist-item';
  row.innerHTML = '<input type="text" placeholder="Item da checklist..."><button type="button" class="rm-btn" onclick="this.parentElement.remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  wrap.appendChild(row);
}

/* ===================== NOVA TAREFA ===================== */
function resetNovaTarefaForm() {
  var name = document.getElementById('nt-nome');
  var dueDate = document.getElementById('nt-prazo');
  var startDate = document.getElementById('nt-inicio');
  var description = document.getElementById('nt-descricao');
  if (name) name.value = '';
  if (dueDate) dueDate.value = '';
  if (startDate) startDate.value = '';
  if (description) description.value = '';
  var checklist = document.getElementById('nt-checklist');
  if (checklist) checklist.innerHTML = '<div class="checklist-item"><input type="text" placeholder="Item da checklist..."><button type="button" class="rm-btn" onclick="this.parentElement.remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
  document.querySelectorAll('#nt-people-group .people-chip').forEach(function(c){ c.classList.remove('selected'); });
  var collaborators = document.getElementById('nt-colaboradores');
  if (collaborators) Array.from(collaborators.options).forEach(function (option) { option.selected = false; });
  var collaboratorPicker = document.getElementById('nt-colaboradores-picker');
  if (collaboratorPicker) {
    collaboratorPicker.querySelectorAll('[data-collaborator-name]').forEach(function (checkbox) { checkbox.checked = false; });
    var summary = collaboratorPicker.querySelector('[data-collaborator-summary]');
    if (summary) summary.textContent = 'Nenhum colaborador selecionado';
  }
  var project = document.getElementById('nt-projeto');
  if (project) project.value = '';
  document.querySelectorAll('#nt-etapa-group .choice-btn').forEach(function(c,i){ c.classList.toggle('selected', i===0); });
  document.querySelectorAll('#nt-prioridade-group .choice-btn').forEach(function(c){ c.classList.toggle('selected', c.dataset.priority==='Média'); });
}
async function submitNovaTarefa() {
  var nameInput = document.getElementById('nt-nome');
  var nome = nameInput ? nameInput.value.trim() : '';
  if (!nome) {
    if (nameInput) {
      nameInput.style.borderColor = 'var(--red)';
      nameInput.focus();
    }
    return;
  }
  var dueDateInput = document.getElementById('nt-prazo');
  var startDateInput = document.getElementById('nt-inicio');
  var descriptionInput = document.getElementById('nt-descricao');
  var projectInput = document.getElementById('nt-projeto');
  var collaboratorsInput = document.getElementById('nt-colaboradores');
  var prazoRaw = dueDateInput ? dueDateInput.value : '';
  var prazo = prazoRaw ? prazoRaw.split('-').reverse().join('/') : '—';
  var etapaBtn = document.querySelector('#nt-etapa-group .choice-btn.selected');
  var etapa = etapaBtn ? etapaBtn.dataset.etapa : 'Pendente';
  var prioBtn = document.querySelector('#nt-prioridade-group .choice-btn.selected');
  var prioridade = prioBtn ? prioBtn.dataset.priority : 'Média';
  var checklistItems = Array.from(document.querySelectorAll('#nt-checklist input')).map(function(i){return i.value.trim();}).filter(Boolean);
  var people = collaboratorsInput
    ? Array.from(collaboratorsInput.selectedOptions).map(function (option) { return option.value; })
    : Array.from(document.querySelectorAll('#nt-people-group .people-chip.selected')).map(function(c){return c.dataset.name;});
  var state = window.RildonXStore ? window.RildonXStore.getState() : {};
  var currentProfile = (state.profiles || []).find(function (profile) { return profile.id === muralCurrentUserId; });
  var currentName = currentProfile && currentProfile.displayName || state.user && state.user.name || 'Usuário';
  if (!people.length) people = [currentName];
  var firstPerson = people[0] || currentName;
  var avatarLetter = firstPerson.charAt(0).toUpperCase();
  var creatorId = muralCurrentUserId || state.user && state.user.id || null;
  if (window.supabaseClient && window.supabaseClient.auth) {
    try {
      var currentUser = await getMuralUser();
      setCurrentAuthenticatedUser(currentUser);
      creatorId = currentUser.id;
    } catch (error) {
      console.error('Não foi possível identificar o criador da tarefa:', error);
      showToast(error.message || 'Não foi possível identificar o criador da tarefa.');
      return;
    }
  }

  var hasStore = window.RildonXStore && typeof window.RildonXStore.addTask === 'function';
  if (hasStore) {
    var currentState = window.RildonXStore.getState();
    var status = etapa === 'Em andamento' ? 'em-andamento' : (etapa === 'Concluída' ? 'concluida' : 'pendente');
    try {
      window.RildonXStore.addTask({
        title: nome,
        description: descriptionInput ? descriptionInput.value.trim() : '',
        startDate: startDateInput ? startDateInput.value || null : null,
        status: status,
        createdBy: creatorId,
        completedAt: etapa === 'Concluída' ? new Date().toISOString() : null,
        priority: prioridade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        dueDate: prazoRaw || null,
        assignees: people,
        checklist: checklistItems.map(function (text) { return { id: (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'item-' + Date.now() + '-' + Math.random().toString(16).slice(2)), text: text, completed: false }; }),
        tags: [],
        projectId: projectInput ? projectInput.value || null : null,
        sector: currentState.user && currentState.user.sector || 'marketing'
      });
    } catch (error) {
      console.error('Não foi possível criar a tarefa:', error);
      showToast(error.message || 'Não foi possível salvar a tarefa. Verifique o espaço disponível e tente novamente.');
      return;
    }
  }

  if (document.body.getAttribute('data-page') === 'tarefas') {
    if (!hasStore) {
      showToast('O serviço de tarefas ainda está carregando. Atualize a página e tente novamente.');
      return;
    }
    closeModal();
    showToast('Tarefa "' + nome + '" criada com sucesso!');
    return;
  }

  var prioClass = prioridade === 'Alta' ? 'alta' : (prioridade === 'Baixa' ? 'baixa' : 'media');
  var stripeColor = prioridade === 'Alta' ? 'var(--red)' : (prioridade === 'Baixa' ? 'var(--green)' : 'var(--orange)');
  var desc = checklistItems.length ? ('0/' + checklistItems.length + ' itens da checklist') : 'Sem checklist';
  var peopleText = people.length ? people.join(', ') : 'Usuário';
  var safeNome = escapeHtml(nome);
  var safeDesc = escapeHtml(desc);
  var safePeopleText = escapeHtml(peopleText);
  var safePrazo = escapeHtml(prazo);
  var safePrioridade = escapeHtml(prioridade);
  var safeEtapa = escapeHtml(etapa);

  var rowHtml = '<div class="task-row">' +
      '<div class="stripe" style="background:' + stripeColor + ';"></div>' +
      '<span class="checkbox"' + (etapa === 'Em andamento' ? ' style="background:var(--blue-600);border-color:var(--blue-600);"' : '') + '></span>' +
      '<div class="task-body"><h4>' + safeNome + '</h4><p>' + safeDesc + ' · ' + safePeopleText + '</p></div>' +
      '<div class="task-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' + safePrazo + '</div>' +
      (etapa === 'Em andamento'
        ? '<span class="tag" style="background:var(--blue-100);color:var(--blue-600);">' + safeEtapa + '</span>'
        : '<span class="priority ' + prioClass + '">' + safePrioridade + '</span>') +
      '<div class="task-avatar">' + escapeHtml(avatarLetter) + '</div>' +
    '</div>';

  var target = (etapa === 'Em andamento') ? 'andamento'
             : (etapa === 'Concluída')     ? 'concluida'
             : 'pendente';

  if (document.body.getAttribute('data-page') !== 'tarefas') {
    // Static multipage: hand the task off to tarefas.html
    if (!hasStore) queueTask({ target: target, html: rowHtml });
    sessionStorage.setItem('rildonx_toast', 'Tarefa "' + nome + '" criada com sucesso!');
    closeModal();
    location.href = 'tarefas.html';
  }
}

/* Tasks created on other pages travel here through sessionStorage */
function queueTask(task) {
  var q = JSON.parse(sessionStorage.getItem('rildonx_tasks') || '[]');
  q.push(task);
  sessionStorage.setItem('rildonx_tasks', JSON.stringify(q));
}
function injectTaskRow(target, rowHtml) {
  if (target === 'andamento') {
    var list = document.getElementById('tarefas-andamento-list');
    if (!list) return;
    list.insertAdjacentHTML('afterbegin', rowHtml);
    bumpCount('count-chip-andamento', 1);
  } else if (target === 'concluida') {
    bumpCount('tab-concluidas-count', 1);
  } else {
    var listP = document.getElementById('tarefas-pendentes-list');
    if (!listP) return;
    listP.insertAdjacentHTML('afterbegin', rowHtml);
    bumpCount('count-chip-pendentes', 1);
    bumpCount('tab-minhas-count', 1);
  }
}
function flushQueuedTasks() {
  if (document.body.getAttribute('data-page') !== 'tarefas') return;
  var q = JSON.parse(sessionStorage.getItem('rildonx_tasks') || '[]');
  q.forEach(function (t) { injectTaskRow(t.target, t.html); });
  sessionStorage.removeItem('rildonx_tasks');

  var pending = sessionStorage.getItem('rildonx_toast');
  if (pending) {
    showToast(pending);
    sessionStorage.removeItem('rildonx_toast');
  }
}
document.addEventListener('DOMContentLoaded', flushQueuedTasks);
function bumpCount(id, delta) {
  var el = document.getElementById(id);
  if (!el) return;
  var n = parseInt(el.textContent, 10) || 0;
  el.textContent = n + delta;
}

/* ===================== SETOR PESSOAL ===================== */
function submitSetorPessoal(opcao) {
  closeModal();
  showToast('✅ Solicitação "' + opcao + '" enviada ao RH / Departamento Pessoal.<br>Usuário Silva · ' + nowStamp());
}

/* ===================== SUPORTE TI ===================== */
function resetSuporteTIForm() {
  document.querySelectorAll('#ti-categoria-group .choice-btn').forEach(function(c,i){ c.classList.toggle('selected', i===0); });
  document.getElementById('ti-texto').value = '';
  document.getElementById('ti-charcount').textContent = '0/150';
}
function submitSuporteTI() {
  if (window.RildonXSupport && typeof window.RildonXSupport.openRequest === 'function') {
    window.RildonXSupport.openRequest();
    return;
  }
  showToast('A central de suporte não está disponível. Recarregue a página e tente novamente.');
}

/* ===================== RESERVA DE SALA ===================== */
var salasOcupadas = [
  {sala:'Sala de Reunião', data:'2026-09-14', inicio:'14:00', fim:'15:00'},
  {sala:'Sala de Reunião', data:'2026-09-14', inicio:'16:30', fim:'17:30'},
  {sala:'Auditório', data:'2026-09-14', inicio:'08:30', fim:'11:30'}
];
function resetReservaSalaForm() {
  document.getElementById('reserva-form-view').style.display = 'block';
  document.getElementById('reserva-confirm-view').style.display = 'none';
  document.getElementById('reserva-form-foot').style.display = 'flex';
  document.getElementById('reserva-conflict-slot').innerHTML = '';
  document.querySelectorAll('#rs-sala-group .choice-btn').forEach(function(c,i){ c.classList.toggle('selected', i===0); });
  document.getElementById('rs-data').value = '2026-09-14';
  document.getElementById('rs-inicio').value = '14:00';
  document.getElementById('rs-fim').value = '15:00';
  document.getElementById('rs-qtd').value = 4;
  document.getElementById('rs-motivo').value = '';
  document.querySelectorAll('#rs-people-group .people-chip').forEach(function(c){ c.classList.remove('selected'); });
  document.querySelectorAll('#modal-reserva-sala .checkbox-opt input').forEach(function(c){ c.checked = false; });
}
function timeOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}
function submitReservaSala() {
  var salaBtn = document.querySelector('#rs-sala-group .choice-btn.selected');
  var sala = salaBtn ? salaBtn.dataset.sala : 'Sala de Reunião';
  var data = document.getElementById('rs-data').value;
  var inicio = document.getElementById('rs-inicio').value;
  var fim = document.getElementById('rs-fim').value;
  var qtd = document.getElementById('rs-qtd').value || '1';
  var motivo = document.getElementById('rs-motivo').value.trim() || 'Reunião';
  var people = Array.from(document.querySelectorAll('#rs-people-group .people-chip.selected')).map(function(c){return c.dataset.name;});
  var recursos = Array.from(document.querySelectorAll('#modal-reserva-sala .checkbox-opt input:checked')).map(function(c){return c.value;});

  var conflictSlot = document.getElementById('reserva-conflict-slot');
  conflictSlot.innerHTML = '';

  if (!inicio || !fim || fim <= inicio) {
    conflictSlot.innerHTML = '<div class="booking-conflict"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Verifique o horário: o fim deve ser depois do início.</div>';
    return;
  }

  var conflict = salasOcupadas.some(function(o) {
    return o.sala === sala && o.data === data && timeOverlap(inicio, fim, o.inicio, o.fim);
  });
  if (conflict) {
    conflictSlot.innerHTML = '<div class="booking-conflict"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Este horário já está ocupado para ' + sala + '. Escolha outro horário.</div>';
    return;
  }

  // register as busy for this session
  salasOcupadas.push({sala:sala, data:data, inicio:inicio, fim:fim});

  var dataFmt = data ? data.split('-').slice(1).reverse().join('/') : '—';
  var participantesTxt = people.length ? people.join(', ') : 'Somente você';
  var motivoSafe = escapeHtml(motivo);
  var salaSafe = escapeHtml(sala);
  var dataSafe = escapeHtml(dataFmt);
  var inicioSafe = escapeHtml(inicio);
  var fimSafe = escapeHtml(fim);
  var qtdSafe = escapeHtml(String(qtd));
  var participantesSafe = escapeHtml(participantesTxt);
  var recursosSafe = escapeHtml(recursos.join(', '));

  var confirmHtml = '<div class="confirm-card">' +
    '<div class="status-badge">🟢 Confirmada</div>' +
    '<h4>🏢 ' + motivoSafe + '</h4>' +
    '<div class="confirm-line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' + dataSafe + ' · ' + inicioSafe + '–' + fimSafe + '</div>' +
    '<div class="confirm-line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + salaSafe + '</div>' +
    '<div class="confirm-line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' + qtdSafe + ' participantes' + (recursos.length ? (' · ' + recursosSafe) : '') + '</div>' +
    '<div class="confirm-participants"><b>Participantes</b>' + participantesSafe + '</div>' +
    '</div>';

  document.getElementById('reserva-confirm-view').innerHTML = confirmHtml;
  document.getElementById('reserva-form-view').style.display = 'none';
  document.getElementById('reserva-confirm-view').style.display = 'block';
  document.getElementById('reserva-form-foot').innerHTML =
    '<button class="btn secondary" onclick="cancelarReserva()">Cancelar reserva</button>' +
    '<button class="btn" onclick="verDetalhesReserva()">Ver detalhes</button>';
  showToast('📅 Sala reservada: ' + sala + ' em ' + dataFmt + ' das ' + inicio + ' às ' + fim + '.');
}
function verDetalhesReserva() {
  showToast('Detalhes da reserva enviados para o seu e-mail.');
}
function cancelarReserva() {
  showToast('Reserva cancelada.');
  resetReservaSalaForm();
}
