(function () {
  'use strict';

  var authenticatedUser = null;

  function localDate(value) {
    if (!value) return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    var date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function isComplete(task) {
    return /conclu|complete|cancelad|cancelled/i.test(String(task.status || ''));
  }

  function isAssignedToCurrentUser(task, names, userId) {
    var assignedIds = Array.isArray(task.viewerIds) ? task.viewerIds : [];
    var assignees = Array.isArray(task.assignees) ? task.assignees : [];
    if (userId && assignedIds.some(function (id) { return String(id) === userId; })) return true;
    return assignees.some(function (assignee) {
      if (assignee && typeof assignee === 'object') {
        var id = assignee.id || assignee.userId || assignee.user_id;
        var name = assignee.name || assignee.displayName || assignee.nickname;
        return Boolean((userId && id && String(id) === userId) ||
          (name && names.indexOf(String(name).trim().toLocaleLowerCase()) >= 0));
      }
      var value = String(assignee || '').trim();
      return Boolean((userId && value === userId) ||
        names.indexOf(value.toLocaleLowerCase()) >= 0);
    });
  }

  function getIdentity(state) {
    var userId = String(authenticatedUser && authenticatedUser.id || '');
    var profile = (state.profiles || []).find(function (item) {
      return String(item.id) === userId;
    });
    var names = [
      profile && profile.displayName,
      profile && profile.nickname,
      authenticatedUser && authenticatedUser.user_metadata &&
        (authenticatedUser.user_metadata.display_name || authenticatedUser.user_metadata.full_name ||
          authenticatedUser.user_metadata.name),
      authenticatedUser && authenticatedUser.email && authenticatedUser.email.split('@')[0]
    ].filter(Boolean).map(function (name) { return String(name).trim().toLocaleLowerCase(); });
    return { id: userId, names: names };
  }

  function renderMyDay() {
    var store = window.RildonXStore;
    var statsRoot = document.getElementById('home-focus-stats');
    if (!store || !statsRoot) return;

    var state = store.getState();
    var identity = getIdentity(state);
    if (!identity.id) return;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    var dueTasks = (state.tasks || []).filter(function (task) {
      if (!task || task.isDemo || isComplete(task) ||
          !isAssignedToCurrentUser(task, identity.names, identity.id)) return false;
      var dueDate = localDate(task.dueDate);
      return Boolean(dueDate && dueDate < weekEnd);
    }).map(function (task) {
      return { task: task, dueDate: localDate(task.dueDate) };
    }).sort(function (first, second) {
      return first.dueDate - second.dueDate;
    });

    var overdue = dueTasks.filter(function (item) { return item.dueDate < today; }).length;
    var todayCount = dueTasks.filter(function (item) { return item.dueDate.getTime() === today.getTime(); }).length;
    var upcoming = dueTasks.filter(function (item) { return item.dueDate > today; }).length;
    statsRoot.innerHTML = [
      ['Vencidos', overdue, 'is-overdue'],
      ['Para hoje', todayCount, ''],
      ['Próximos 7 dias', upcoming, '']
    ].map(function (item) {
      return '<div class="home-focus-stat ' + item[2] + '"><strong>' + item[1] +
        '</strong><span>' + item[0] + '</span></div>';
    }).join('');
  }

  function syncTaskSummaryHeight() {
    var summary = document.querySelector('.home-focus');
    var quickLinks = document.querySelector('.home-quick-links');
    if (!summary || !quickLinks) return;
    if (window.innerWidth <= 760) {
      summary.style.minHeight = '';
      return;
    }
    summary.style.minHeight = Math.ceil(quickLinks.getBoundingClientRect().height) + 'px';
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncTaskSummaryHeight();
    if (window.ResizeObserver) {
      var quickLinks = document.querySelector('.home-quick-links');
      if (quickLinks) new ResizeObserver(syncTaskSummaryHeight).observe(quickLinks);
    }
    window.addEventListener('resize', syncTaskSummaryHeight);
    var userRequest = window.getMuralUser ? window.getMuralUser() :
      (window.supabaseClient && window.supabaseClient.auth
        ? window.supabaseClient.auth.getUser().then(function (result) {
          if (result.error) throw result.error;
          if (!result.data.user) throw new Error('Sua sessão expirou.');
          return result.data.user;
        })
        : Promise.reject(new Error('O serviço de autenticação não está disponível.')));
    userRequest.then(function (user) {
      authenticatedUser = user;
      renderMyDay();
      if (window.RildonXStore && typeof window.RildonXStore.subscribe === 'function') {
        window.RildonXStore.subscribe(renderMyDay);
      }
    }).catch(function (error) {
      console.error('Não foi possível validar a sessão para carregar o resumo pessoal:', error);
      renderMyDay();
    });
  });
})();
