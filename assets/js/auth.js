(function () {
  'use strict';

  var LOGIN_EMAILS = {
    'adson.ri': 'adson.ri@rildonx.local'
  };

  function loginToEmail(login) {
    var normalizedLogin = String(login || '').trim().toLowerCase();
    return LOGIN_EMAILS[normalizedLogin] || normalizedLogin;
  }

  function getClient() {
    return window.supabaseClient && typeof window.supabaseClient.auth === 'object' ? window.supabaseClient : null;
  }

  async function waitForClient() {
    var client = getClient();
    var deadline = Date.now() + 5000;
    while (!client && Date.now() < deadline) {
      await new Promise(function (resolve) { window.setTimeout(resolve, 50); });
      client = getClient();
    }
    return client;
  }

  async function withTimeout(promise, timeoutMs, message) {
    var timer;
    try {
      return await Promise.race([
        promise,
        new Promise(function (_, reject) {
          timer = window.setTimeout(function () { reject(new Error(message)); }, timeoutMs);
        })
      ]);
    } finally {
      window.clearTimeout(timer);
    }
  }

  function showError(message) {
    var target = document.getElementById('login-error');
    if (target) target.textContent = message;
  }

  function showServiceUnavailable() {
    var message = 'O serviço de autenticação não está disponível. Recarregue a página e tente novamente.';
    var loginError = document.getElementById('login-error');
    if (loginError) {
      loginError.textContent = message;
      return;
    }
    var notice = document.getElementById('auth-service-error');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'auth-service-error';
      notice.className = 'auth-error';
      notice.setAttribute('role', 'alert');
      document.body.insertBefore(notice, document.body.firstChild);
    }
    notice.textContent = message;
  }

  function showStatus(message) {
    var target = document.getElementById('login-status');
    if (target) target.textContent = message;
  }

  function isAllowedLogin(login) {
    return Boolean(LOGIN_EMAILS[login]) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
  }

  function bindPasswordVisibility(root) {
    (root || document).querySelectorAll('[data-password-toggle]').forEach(function (button) {
      if (button.dataset.passwordToggleReady === 'true') return;
      button.dataset.passwordToggleReady = 'true';
      button.addEventListener('click', function () {
        var input = document.getElementById(button.getAttribute('aria-controls'));
        if (!input) return;
        var visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.textContent = visible ? 'Ocultar' : 'Mostrar';
        button.setAttribute('aria-pressed', visible ? 'true' : 'false');
        button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
      });
    });
  }

  async function getSession() {
    var client = await waitForClient();
    if (!client) throw new Error('O cliente de autenticação não foi inicializado.');
    var result = await withTimeout(
      client.auth.getSession(),
      10000,
      'A verificação da sessão demorou demais. Entre novamente.'
    );
    if (result.error) throw result.error;
    return result.data && result.data.session ? result.data.session : null;
  }

  async function isAccountActive(userId) {
    var client = await waitForClient();
    if (!client || !userId) return false;
    var result = await withTimeout(
      client.rpc('get_rildonx_profiles'),
      10000,
      'A verificação do acesso demorou demais. Entre novamente.'
    );
    if (result.error) throw result.error;
    var profile = (result.data || []).find(function (item) {
      return String(item.id) === String(userId);
    });
    return Boolean(profile && profile.active !== false);
  }

  async function handleLogin(event) {
    event.preventDefault();
    var login = document.getElementById('login-name').value.trim().toLowerCase();
    var password = document.getElementById('login-password').value;
    showError('');
    showStatus('');
    if (!isAllowedLogin(login)) {
      showError('Digite um e-mail válido ou o login de administrador autorizado.');
      return;
    }

    var client = await waitForClient();
    if (!client) {
      showServiceUnavailable();
      return;
    }

    var result;
    try {
      result = await client.auth.signInWithPassword({ email: loginToEmail(login), password: password });
    } catch (error) {
      if (error && error.name === 'AuthRetryableFetchError') {
        showError('Não foi possível conectar ao serviço de autenticação. Verifique a conexão e tente novamente.');
        return;
      }
      throw error;
    }
    if (result.error) {
      if (result.error.name === 'AuthRetryableFetchError' || result.error.status === 0 || result.error.status >= 500) {
        showError('Não foi possível conectar ao serviço de autenticação. Verifique a conexão e tente novamente.');
        return;
      }
      showError('Login ou senha inválidos.');
      return;
    }

    var user = result.data.user;
    try {
      if (!await isAccountActive(user && user.id)) {
        await client.auth.signOut();
        showError('Esta conta está desabilitada. Entre em contato com o RH.');
        return;
      }
    } catch (error) {
      console.error('Não foi possível verificar o status da conta:', error);
      await client.auth.signOut();
      showError('Não foi possível verificar se sua conta está habilitada. Tente novamente.');
      return;
    }
    if (user && user.user_metadata && user.user_metadata.must_change_password !== false) {
      sessionStorage.setItem('rildonx_force_password_change', 'true');
    }
    window.location.href = 'index.html';
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    showError('');
    showStatus('');
    var login = document.getElementById('login-name').value.trim().toLowerCase();
    if (!isAllowedLogin(login)) {
      showError('Digite primeiro um e-mail válido ou o login de administrador autorizado.');
      document.getElementById('login-name').focus();
      return;
    }
    var client = await waitForClient();
    if (!client) {
      showServiceUnavailable();
      return;
    }
    var button = event.currentTarget;
    button.disabled = true;
    try {
      var redirectUrl = new URL('login.html', window.location.href);
      redirectUrl.searchParams.set('resetPassword', 'true');
      var result = await client.auth.resetPasswordForEmail(loginToEmail(login), {
        redirectTo: redirectUrl.href
      });
      if (result.error) throw result.error;
      showStatus('Se a conta estiver habilitada para recuperação, enviaremos um link para o e-mail cadastrado.');
    } catch (error) {
      console.error('Não foi possível solicitar a recuperação de senha:', error);
      showError('Não foi possível enviar o link de recuperação. Verifique a conexão ou tente novamente mais tarde.');
    } finally {
      button.disabled = false;
    }
  }

  function createPasswordPanel(isRecovery) {
    if (document.getElementById('password-change-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'password-change-panel';
    panel.className = 'auth-overlay';
    var heading = isRecovery ? 'Redefinir senha' : 'Atualize sua senha';
    var lead = isRecovery
      ? 'Crie uma nova senha para sua conta.'
      : 'Por segurança, a senha inicial precisa ser trocada antes de continuar.';
    panel.innerHTML = '<section class="auth-card auth-modal" aria-labelledby="password-title"><p class="auth-eyebrow">' +
      (isRecovery ? 'Recuperação de acesso' : 'Primeiro acesso') + '</p><h2 id="password-title">' + heading +
      '</h2><p class="auth-lead">' + lead + '</p><form id="password-change-form">' +
      '<label for="new-password">Nova senha</label><div class="auth-password-wrap"><input id="new-password" type="password" minlength="6" autocomplete="new-password" required>' +
      '<button type="button" class="auth-password-toggle" data-password-toggle aria-controls="new-password" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div>' +
      '<label for="confirm-password">Confirme a nova senha</label><div class="auth-password-wrap"><input id="confirm-password" type="password" minlength="6" autocomplete="new-password" required>' +
      '<button type="button" class="auth-password-toggle" data-password-toggle aria-controls="confirm-password" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div>' +
      '<button class="btn auth-submit" type="submit">Salvar nova senha</button>' +
      (isRecovery ? '<button type="button" class="btn secondary auth-recovery-continue" id="recovery-continue">Entrar sem alterar a senha</button>' : '') +
      '<p class="auth-error" id="password-error" role="alert"></p></form></section>';
    document.body.appendChild(panel);
    document.getElementById('password-change-form').addEventListener('submit', changePassword);
    var continueButton = document.getElementById('recovery-continue');
    if (continueButton) continueButton.addEventListener('click', continueWithoutPasswordChange);
    bindPasswordVisibility(panel);
  }

  function continueWithoutPasswordChange() {
    var url = new URL(window.location.href);
    url.searchParams.delete('resetPassword');
    url.hash = '';
    window.history.replaceState(null, '', url.pathname + url.search);
    sessionStorage.removeItem('rildonx_force_password_change');
    window.location.href = 'index.html';
  }

  async function changePassword(event) {
    event.preventDefault();
    var password = document.getElementById('new-password').value;
    var confirmation = document.getElementById('confirm-password').value;
    var errorTarget = document.getElementById('password-error');
    if (password.length < 6 || password !== confirmation) {
      errorTarget.textContent = 'Use pelo menos 6 caracteres e confirme a mesma senha.';
      return;
    }
    try {
      var client = await waitForClient();
      if (!client) throw new Error('O cliente de autenticação não foi inicializado.');
      var result = await client.auth.updateUser({ password: password, data: { must_change_password: false } });
      if (result.error) throw result.error;
      sessionStorage.removeItem('rildonx_force_password_change');
      if (new URLSearchParams(window.location.search).get('resetPassword') === 'true') {
        window.location.href = 'index.html';
        return;
      }
      if (document.body.dataset.authPage === 'login') {
        window.location.href = 'index.html';
        return;
      }
      document.getElementById('password-change-panel').remove();
    } catch (error) {
      console.error('Não foi possível atualizar a senha:', error);
      errorTarget.textContent = 'Não foi possível atualizar a senha. O link pode ter expirado; solicite outro e tente novamente.';
    }
  }

  async function protectPage() {
    var session;
    try {
      session = await getSession();
    } catch (error) {
      console.error('Não foi possível verificar a sessão de autenticação:', error);
      window.location.replace('login.html?authUnavailable=true');
      return false;
    }
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    try {
      if (!await isAccountActive(session.user && session.user.id)) {
        var client = getClient();
        if (client) await client.auth.signOut();
        window.location.href = 'login.html?disabled=true';
        return false;
      }
    } catch (error) {
      console.error('Não foi possível verificar o status da conta autenticada:', error);
      window.location.replace('login.html?authUnavailable=true');
      return false;
    }
    if (sessionStorage.getItem('rildonx_force_password_change') === 'true') createPasswordPanel();
    return true;
  }

  async function init() {
    if (document.body.dataset.authPage === 'login') {
      var recoveryRequested = new URLSearchParams(window.location.search).get('resetPassword') === 'true';
      var authUnavailable = new URLSearchParams(window.location.search).get('authUnavailable') === 'true';
      var callbackType = new URLSearchParams(window.location.hash.slice(1)).get('type');
      var authError = new URLSearchParams(window.location.search).get('error_description') ||
        new URLSearchParams(window.location.hash.slice(1)).get('error_description');
      if (authUnavailable) {
        showServiceUnavailable();
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        document.getElementById('forgot-password').addEventListener('click', handleForgotPassword);
        bindPasswordVisibility();
        return;
      }
      if (new URLSearchParams(window.location.search).get('disabled') === 'true') {
        showError('Esta conta está desabilitada. Entre em contato com o RH.');
      }
      if (authError) {
        showError('O link de recuperação expirou ou não é válido. Solicite um novo link.');
        window.history.replaceState(null, '', window.location.pathname);
      }
      var session;
      try {
        session = await getSession();
      } catch (error) {
        console.error('Não foi possível verificar a sessão na página de login:', error);
        showServiceUnavailable();
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        document.getElementById('forgot-password').addEventListener('click', handleForgotPassword);
        bindPasswordVisibility();
        return;
      }
      if (recoveryRequested) {
        if (!session) {
          showError('Link de recuperação expirado ou inválido. Solicite um novo link.');
          document.getElementById('login-form').addEventListener('submit', handleLogin);
          document.getElementById('forgot-password').addEventListener('click', handleForgotPassword);
          bindPasswordVisibility();
          return;
        }
        createPasswordPanel(true);
        return;
      }
      if (session) {
        if (callbackType === 'invite' ||
            session.user && session.user.user_metadata && session.user.user_metadata.must_change_password === true) {
          sessionStorage.setItem('rildonx_force_password_change', 'true');
          createPasswordPanel(false);
          return;
        }
        window.location.href = 'index.html';
        return;
      }
      if (callbackType === 'invite') {
        showError('O convite expirou ou não é válido. Solicite um novo convite ao RH.');
      }
      document.getElementById('login-form').addEventListener('submit', handleLogin);
      document.getElementById('forgot-password').addEventListener('click', handleForgotPassword);
      bindPasswordVisibility();
      return;
    }
    if (!(await protectPage())) return;
    document.querySelectorAll('.logout-item').forEach(function (button) {
      button.addEventListener('click', async function (event) {
        event.preventDefault();
        var client = getClient();
        if (client) await client.auth.signOut();
        window.location.href = 'login.html';
      });
    });
  }

  window.RildonXAuth = { loginToEmail: loginToEmail, protectPage: protectPage };
  window.addEventListener('DOMContentLoaded', init);
})();
