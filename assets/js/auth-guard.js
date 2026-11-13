(function () {
  'use strict';

  var MAX_SESSION_MS = 8 * 60 * 60 * 1000;
  var MAX_IDLE_MS = 60 * 60 * 1000;
  var tokenKeyPattern = /^sb-.+-auth-token$/;

  function redirectToLogin(expired) {
    var target = 'login.html' + (expired ? '?sessionExpired=true' : '');
    window.location.replace(target);
  }

  function readSessionKey(session) {
    var userId = session && session.user && session.user.id;
    if (!userId || !session.access_token) return null;
    var sessionId = '';
    try {
      var parts = String(session.access_token).split('.');
      if (parts.length === 3) {
        var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4) payload += '=';
        var claims = JSON.parse(window.atob(payload));
        sessionId = String(claims.session_id || claims.sid || '');
      }
    } catch (error) {
      console.error('Não foi possível validar a sessão desta aba:', error);
    }
    return 'rildonx_session_started_v1:' + encodeURIComponent(userId) + ':' +
      encodeURIComponent(sessionId || 'active-session');
  }

  try {
    var storage = window.sessionStorage;
    var authKey = Object.keys(storage).find(function (key) {
      return tokenKeyPattern.test(key);
    });
    if (!authKey) {
      redirectToLogin(false);
      return;
    }

    var session;
    try {
      session = JSON.parse(storage.getItem(authKey));
    } catch (error) {
      console.error('A sessão armazenada nesta aba está corrompida:', error);
      storage.removeItem(authKey);
      redirectToLogin(false);
      return;
    }

    var sessionKey = readSessionKey(session);
    if (!sessionKey) {
      storage.removeItem(authKey);
      redirectToLogin(false);
      return;
    }

    var now = Date.now();
    var startedAt = Number(storage.getItem(sessionKey));
    var activityKey = sessionKey + ':last_activity';
    var lastActivityAt = Number(storage.getItem(activityKey));
    if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now) {
      startedAt = now;
      storage.setItem(sessionKey, String(startedAt));
    }
    if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0 || lastActivityAt > now) {
      lastActivityAt = now;
      storage.setItem(activityKey, String(lastActivityAt));
    }
    if (now - startedAt >= MAX_SESSION_MS || now - lastActivityAt >= MAX_IDLE_MS) {
      storage.removeItem(authKey);
      storage.removeItem(sessionKey);
      storage.removeItem(activityKey);
      redirectToLogin(true);
    }
  } catch (error) {
    console.error('Não foi possível verificar a sessão desta aba:', error);
    redirectToLogin(false);
  }
})();
