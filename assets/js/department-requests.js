(function () {
  'use strict';

  var activeUser = null;
  var activeSector = '';
  var requestCache = [];
  var channel = null;
  var inboxRoot = null;
  var inboxIndex = 0;
  var readKey = '';
  var dismissedThisPage = new Set();

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function sectorKey(value) {
    var sector = normalize(value);
    if (sector.indexOf('qualidade') !== -1 || sector.indexOf('quality') !== -1) return 'quality';
    if (sector === 'ti' || sector.indexOf('tecnologia') !== -1 || sector.indexOf('infraestrutura') !== -1) return 'it';
    if (sector === 'rh' || sector.indexOf('recursos humanos') !== -1 || sector.indexOf('pessoal') !== -1) return 'rh';
    return '';
  }

  function readSeenIds() {
    try {
      var value = localStorage.getItem(readKey);
      return new Set(value ? JSON.parse(value) : []);
    } catch (error) {
      console.error('Não foi possível carregar as solicitações já visualizadas:', error);
      return new Set();
    }
  }

  function saveSeenIds(ids) {
    try {
      localStorage.setItem(readKey, JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('Não foi possível salvar as solicitações visualizadas:', error);
    }
  }

  function showMessage(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  async function getIdentity() {
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      throw new Error('O serviço de solicitações compartilhadas não está disponível.');
    }
    var result = await window.supabaseClient.auth.getUser();
    if (result.error) throw result.error;
    if (!result.data || !result.data.user) throw new Error('Entre novamente para enviar ou responder solicitações.');
    activeUser = result.data.user;
    var profile = (window.RildonXStore && window.RildonXStore.getState().profiles || []).find(function (item) {
      return String(item.id) === String(activeUser.id);
    });
    activeSector = sectorKey(profile && profile.sector || activeUser.user_metadata && activeUser.user_metadata.sector);
    readKey = 'rildonx_department_requests_seen:' + activeUser.id;
    return { user: activeUser, profile: profile };
  }

  async function submit(request) {
    var identity = await getIdentity();
    var profile = identity.profile || {};
    var input = request || {};
    var targetSector = ['quality', 'it', 'rh'].indexOf(input.targetSector) !== -1 ? input.targetSector : '';
    if (!targetSector) throw new Error('Não foi possível identificar o setor que receberá a solicitação.');
    var payload = {
      request_type: String(input.requestType || '').slice(0, 40),
      target_sector: targetSector,
      title: String(input.title || 'Solicitação').trim().slice(0, 180),
      description: String(input.description || '').trim().slice(0, 4000),
      details: input.details && typeof input.details === 'object' ? input.details : {},
      status: targetSector === 'quality' ? 'pending' : 'received',
      requester_id: identity.user.id,
      requester_name: profile.displayName || profile.nickname ||
        identity.user.user_metadata && (identity.user.user_metadata.display_name || identity.user.user_metadata.full_name) ||
        String(identity.user.email || 'Usuário').split('@')[0]
    };
    var result = await window.supabaseClient.from('department_requests').insert(payload).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  }

  function ensureInboxRoot() {
    if (inboxRoot) return inboxRoot;
    inboxRoot = document.createElement('div');
    inboxRoot.className = 'department-request-root';
    inboxRoot.hidden = true;
    document.body.appendChild(inboxRoot);
    inboxRoot.addEventListener('click', handleInboxClick);
    return inboxRoot;
  }

  function visibleRequests() {
    var seen = readSeenIds();
    return requestCache.filter(function (request) {
      if (request.requester_id === activeUser.id) {
        return ['approved', 'rejected'].indexOf(request.status) !== -1 && !seen.has(String(request.id));
      }
      if (request.target_sector !== activeSector) return false;
      if (request.target_sector === 'quality') {
        return request.status === 'pending' && !dismissedThisPage.has(String(request.id));
      }
      return request.status === 'received' && !seen.has(String(request.id));
    });
  }

  function renderInbox() {
    var root = ensureInboxRoot();
    var requests = visibleRequests();
    if (!requests.length) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    inboxIndex = Math.max(0, Math.min(inboxIndex, requests.length - 1));
    var request = requests[inboxIndex];
    var detailPairs = Object.keys(request.details || {}).map(function (key) {
      var value = request.details[key];
      if (Array.isArray(value)) value = value.join(', ');
      if (value && typeof value === 'object') value = JSON.stringify(value);
      return '<div class="department-request-detail"><span>' + escapeHtml(key) + '</span><b>' +
        escapeHtml(value || '—') + '</b></div>';
    }).join('');
    var approved = request.status === 'approved';
    var rejected = request.status === 'rejected';
    var heading = request.requester_id === activeUser.id
      ? 'Atualização da sua solicitação'
      : request.target_sector === 'quality' ? 'Solicitação para Qualidade'
        : request.target_sector === 'it' ? 'Solicitação para TI' : 'Solicitação para RH';
    var status = approved ? 'Aprovada' : rejected ? 'Recusada' :
      request.status === 'pending' ? 'Aguardando aprovação' : 'Recebida';
    var actions = request.requester_id === activeUser.id
      ? '<button type="button" class="btn" data-request-close>Fechar</button>'
      : request.target_sector === 'quality'
        ? '<button type="button" class="btn secondary" data-request-decision="rejected">Recusar</button>' +
          '<button type="button" class="btn" data-request-decision="approved">Aprovar solicitação</button>'
        : '<button type="button" class="btn" data-request-close>Entendi</button>';
    root.innerHTML = '<div class="department-request-backdrop"><section class="department-request-dialog" role="dialog" aria-modal="true" aria-labelledby="department-request-title">' +
      '<header><div><span class="department-request-eyebrow">' + escapeHtml(status) + '</span><h2 id="department-request-title">' +
      escapeHtml(heading) + '</h2></div><button type="button" class="department-request-close" data-request-close aria-label="Fechar">×</button></header>' +
      '<div class="department-request-body"><p class="department-request-title">' + escapeHtml(request.title) + '</p>' +
      '<p class="department-request-description">' + escapeHtml(request.description || 'Sem detalhes adicionais.') + '</p>' +
      '<div class="department-request-meta"><span>Solicitante</span><b>' + escapeHtml(request.requester_name || 'Colaborador') +
      '</b><span>Enviada</span><b>' + escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.created_at))) +
      '</b></div>' + detailPairs + (request.response_text ? '<p class="department-request-response"><b>Resposta:</b> ' +
      escapeHtml(request.response_text) + '</p>' : '') + '</div><footer>' + actions + '</footer></section></div>';
    root.hidden = false;
    var firstButton = root.querySelector('button:not([disabled])');
    if (firstButton) firstButton.focus();
  }

  async function handleInboxClick(event) {
    var closeButton = event.target.closest('[data-request-close]');
    var decisionButton = event.target.closest('[data-request-decision]');
    var root = ensureInboxRoot();
    var requests = visibleRequests();
    var request = requests[inboxIndex];
    if (!request) return;
    if (decisionButton) {
      decisionButton.disabled = true;
      var status = decisionButton.dataset.requestDecision;
      try {
        var result = await window.supabaseClient.from('department_requests')
          .update({
            status: status,
            response_text: status === 'approved' ? 'Aprovada pela Qualidade.' : 'Recusada pela Qualidade.',
            responded_by: activeUser.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id)
          .select('*')
          .single();
        if (result.error) throw result.error;
        requestCache = requestCache.map(function (item) {
          return String(item.id) === String(request.id) ? result.data : item;
        });
        window.RildonXStore.setState({ departmentRequests: requestCache });
        showMessage(status === 'approved' ? 'Solicitação aprovada.' : 'Solicitação recusada.');
        renderInbox();
      } catch (error) {
        console.error('Não foi possível responder à solicitação:', error);
        showMessage(error.message || 'Não foi possível responder à solicitação.');
        decisionButton.disabled = false;
      }
      return;
    }
    if (closeButton || event.target.classList.contains('department-request-backdrop')) {
      var seen = readSeenIds();
      seen.add(String(request.id));
      saveSeenIds(seen);
      if (request.target_sector === 'quality' && request.status === 'pending') {
        dismissedThisPage.add(String(request.id));
      }
      inboxIndex = 0;
      renderInbox();
      if (!root.hidden && requests.length > 1) renderInbox();
    }
  }

  async function refreshInbox() {
    if (!activeUser) await getIdentity();
    var result = await window.supabaseClient.from('department_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (result.error) throw result.error;
    requestCache = result.data || [];
    if (window.RildonXStore) window.RildonXStore.setState({ departmentRequests: requestCache });
    renderInbox();
  }

  function subscribeInbox() {
    if (channel || !window.supabaseClient || typeof window.supabaseClient.channel !== 'function') return;
    channel = window.supabaseClient.channel('rildonx-department-requests-' + activeUser.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_requests' }, function () {
        refreshInbox().catch(function (error) {
          console.error('Não foi possível atualizar as solicitações dos setores:', error);
        });
      })
      .subscribe(function (status, error) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('A atualização em tempo real das solicitações falhou:', error || status);
        }
      });
  }

  async function initialize() {
    try {
      if (window.RildonXSync && typeof window.RildonXSync.ready === 'function') await window.RildonXSync.ready();
      await getIdentity();
      await refreshInbox();
      subscribeInbox();
    } catch (error) {
      if (error && /department_requests|schema cache/i.test(error.message || '')) {
        console.error('Aplique docs/supabase-department-requests.sql para habilitar as solicitações internas:', error);
      } else {
        console.error('Não foi possível carregar as solicitações dos setores:', error);
      }
    }
  }

  window.RildonXDepartmentRequests = { submit: submit, refresh: refreshInbox };
  document.addEventListener('DOMContentLoaded', initialize);
})();
