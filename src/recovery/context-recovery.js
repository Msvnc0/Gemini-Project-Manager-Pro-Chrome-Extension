const GPMContextRecovery = (() => {
  let isInvalidated = false;
  let checkInterval = null;
  let recoveryOverlay = null;
  let countdownInterval = null;

  const CHECK_INTERVAL_MS = 2000;

  function startMonitoring() {
    if (checkInterval) return;

    checkInterval = setInterval(() => {
      const isValid = checkContext();
      if (!isValid && !isInvalidated) {
        isInvalidated = true;
        showRecoveryUI();
      }
      if (isValid && isInvalidated) {
        isInvalidated = false;
        dismissRecoveryUI();
      }
    }, CHECK_INTERVAL_MS);

    gpmLog('Context recovery monitoring started');
  }

  let _recoveryStyleEl = null;

  function checkContext() {
    try {
      const isValid = !!(chrome.runtime && chrome.runtime.id);
      return isValid;
    } catch (e) {
      return false;
    }
  }

  function showRecoveryUI() {
    if (recoveryOverlay) return;

    const style = document.createElement('style');
    style.textContent = [
      '@keyframes gpm-fade-in {',
      '  from { opacity: 0; }',
      '  to { opacity: 1; }',
      '}',
      '@keyframes gpm-pulse {',
      '  0%, 100% { transform: scale(1); }',
      '  50% { transform: scale(1.05); }',
      '}',
      '#gpm-reload-btn {',
      '  padding: 12px 32px;',
      '  background: #8ab4f8;',
      '  border: none;',
      '  border-radius: 24px;',
      '  font-size: 16px;',
      '  font-weight: 500;',
      '  cursor: pointer;',
      '  transition: background 150ms, transform 150ms;',
      '  color: #1e1f20;',
      '}',
      '#gpm-reload-btn:hover {',
      '  background: #aecbfa;',
      '  transform: scale(1.05);',
      '}',
      '#gpm-reload-btn:active {',
      '  transform: scale(0.98);',
      '}',
    ].join('\n');

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999999;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'color:#e3e3e3;font-family:"Google Sans","Segoe UI",system-ui,sans-serif;' +
      'animation:gpm-fade-in 200ms ease;';

    const container = document.createElement('div');
    container.style.cssText = 'text-align:center;max-width:420px;padding:32px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:64px;margin-bottom:24px;animation:gpm-pulse 2s ease-in-out infinite;';
    icon.textContent = '\uD83D\uDD04';
    container.appendChild(icon);

    const h2 = document.createElement('h2');
    h2.style.cssText = 'margin:0 0 16px;font-size:24px;font-weight:400;';
    h2.textContent = t('extensionUpdated') || 'Extension Updated';
    container.appendChild(h2);

    const p = document.createElement('p');
    p.style.cssText = 'opacity:0.8;margin:0 0 24px;font-size:15px;line-height:1.6;';
    p.textContent =
      t('extensionUpdatedMessage') ||
      'Gemini Project Manager has been updated. Please reload the page to continue using it.';
    container.appendChild(p);

    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'gpm-reload-btn';
    reloadBtn.textContent = t('reloadPage') || 'Reload Page';
    container.appendChild(reloadBtn);

    const countdownP = document.createElement('p');
    countdownP.style.cssText = 'opacity:0.5;margin-top:16px;font-size:12px;';
    countdownP.appendChild(document.createTextNode((t('autoReloadIn') || 'Auto-reload in') + ' '));
    const countdownSpan = document.createElement('span');
    countdownSpan.id = 'gpm-reload-countdown';
    countdownSpan.textContent = '10';
    countdownP.appendChild(countdownSpan);
    container.appendChild(countdownP);

    overlay.appendChild(container);
    document.head.appendChild(style);
    _recoveryStyleEl = style;
    document.body.appendChild(overlay);

    recoveryOverlay = overlay;

    reloadBtn.addEventListener('click', () => {
      dismissRecoveryUI();
      location.reload();
    });

    startAutoReloadCountdown();
  }

  function startAutoReloadCountdown() {
    let seconds = 10;
    const countdownEl = document.getElementById('gpm-reload-countdown');

    countdownInterval = setInterval(() => {
      seconds--;
      if (countdownEl) countdownEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        location.reload();
      }
    }, 1000);
  }

  function dismissRecoveryUI() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (_recoveryStyleEl && _recoveryStyleEl.parentNode) {
      _recoveryStyleEl.remove();
      _recoveryStyleEl = null;
    }
    if (recoveryOverlay && recoveryOverlay.parentNode) {
      recoveryOverlay.remove();
    }
    recoveryOverlay = null;
  }

  function isContextValid() {
    return !isInvalidated && checkContext();
  }

  function stopMonitoring() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    dismissRecoveryUI();
    gpmLog('Context recovery monitoring stopped');
  }

  return {
    startMonitoring,
    stopMonitoring,
    isContextValid,
    showRecoveryUI,
  };
})();
