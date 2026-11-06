(function() {
  'use strict';

  var currentVersion = window.RildonXBuildVersion;
  if (!currentVersion) return;

  var checkInProgress = false;
  var hasLoggedCheckError = false;
  var updateNotice;

  function showUpdateNotice() {
    if (updateNotice) return;
    updateNotice = document.createElement('div');
    updateNotice.className = 'site-update-notice';
    updateNotice.setAttribute('role', 'status');
    updateNotice.setAttribute('aria-live', 'polite');

    var message = document.createElement('span');
    message.textContent = 'Uma nova versão do site está disponível.';
    var reloadButton = document.createElement('button');
    reloadButton.type = 'button';
    reloadButton.textContent = 'Atualizar agora';
    reloadButton.addEventListener('click', function() {
      window.location.reload();
    });

    updateNotice.append(message, reloadButton);
    document.body.appendChild(updateNotice);
  }

  async function checkForUpdate() {
    if (checkInProgress || document.visibilityState === 'hidden') return;
    checkInProgress = true;
    try {
      var versionUrl = new URL('version.json', document.baseURI);
      versionUrl.searchParams.set('check', String(Date.now()));
      var response = await fetch(versionUrl.href, { cache: 'no-store' });
      if (!response.ok) throw new Error('A consulta da versão retornou HTTP ' + response.status + '.');
      var latest = await response.json();
      if (latest && latest.version && latest.version !== currentVersion) showUpdateNotice();
      hasLoggedCheckError = false;
    } catch (error) {
      if (!hasLoggedCheckError) {
        console.warn('Não foi possível verificar se há uma nova versão do site:', error);
        hasLoggedCheckError = true;
      }
    } finally {
      checkInProgress = false;
    }
  }

  window.setTimeout(checkForUpdate, 30000);
  window.setInterval(checkForUpdate, 300000);
  document.addEventListener('visibilitychange', checkForUpdate);
})();
