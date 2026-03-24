/**
 * context-recovery.js — Extension Context Recovery Module
 *
 * Detects when extension context is invalidated (e.g., extension updated)
 * and shows a recovery UI to prevent silent data loss.
 *
 * Scenarios handled:
 *   - Extension updated/reloaded while Gemini tab is open
 *   - Extension disabled and re-enabled
 *   - Chrome storage access failure due to invalid context
 */

const GPMContextRecovery = (() => {
  let isInvalidated = false;
  let lastValidCheck = Date.now();
  let checkInterval = null;
  let recoveryOverlay = null;

  const CHECK_INTERVAL_MS = 2000;

  function startMonitoring() {
    if (checkInterval) return;

    checkInterval = setInterval(() => {
      const isValid = checkContext();
      if (!isValid && !isInvalidated) {
        isInvalidated = true;
        showRecoveryUI();
      }
    }, CHECK_INTERVAL_MS);

    gpmLog('Context recovery monitoring started');
  }

  function stopMonitoring() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    gpmLog('Context recovery monitoring stopped');
  }

  function checkContext() {
    try {
      const isValid = !!(chrome.runtime && chrome.runtime.id);
      if (isValid) {
        lastValidCheck = Date.now();
      }
      return isValid;
    } catch (e) {
      return false;
    }
  }

  function showRecoveryUI() {
    if (recoveryOverlay) return;

    recoveryOverlay = document.createElement('div');
    recoveryOverlay.id = 'gpm-recovery-overlay';
    recoveryOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #e3e3e3;
      font-family: 'Google Sans', 'Segoe UI', system-ui, sans-serif;
      animation: gpm-fade-in 200ms ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes gpm-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes gpm-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      #gpm-reload-btn {
        padding: 12px 32px;
        background: #8ab4f8;
        border: none;
        border-radius: 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: background 150ms, transform 150ms;
        color: #1e1f20;
      }
      #gpm-reload-btn:hover {
        background: #aecbfa;
        transform: scale(1.05);
      }
      #gpm-reload-btn:active {
        transform: scale(0.98);
      }
    `;

    recoveryOverlay.innerHTML = `
      <div style="text-align: center; max-width: 420px; padding: 32px;">
        <div style="font-size: 64px; margin-bottom: 24px; animation: gpm-pulse 2s ease-in-out infinite;">
          🔄
        </div>
        <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 400;">
          ${t('extensionUpdated') || 'Extension Updated'}
        </h2>
        <p style="opacity: 0.8; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
          ${t('extensionUpdatedMessage') || 'Gemini Project Manager has been updated. Please reload the page to continue using it.'}
        </p>
        <button id="gpm-reload-btn">
          ${t('reloadPage') || 'Reload Page'}
        </button>
        <p style="opacity: 0.5; margin-top: 16px; font-size: 12px;">
          ${t('autoReloadIn') || 'Auto-reload in'} <span id="gpm-reload-countdown">10</span>s
        </p>
      </div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(recoveryOverlay);

    const reloadBtn = document.getElementById('gpm-reload-btn');
    reloadBtn.addEventListener('click', () => {
      location.reload();
    });

    startAutoReloadCountdown();
  }

  function startAutoReloadCountdown() {
    let seconds = 10;
    const countdownEl = document.getElementById('gpm-reload-countdown');

    const interval = setInterval(() => {
      seconds--;
      if (countdownEl) {
        countdownEl.textContent = seconds;
      }

      if (seconds <= 0) {
        clearInterval(interval);
        location.reload();
      }
    }, 1000);
  }

  function hideRecoveryUI() {
    if (recoveryOverlay) {
      recoveryOverlay.remove();
      recoveryOverlay = null;
    }
    isInvalidated = false;
  }

  function isContextValid() {
    return !isInvalidated && checkContext();
  }

  async function safeStorageOperation(operation, fallback = null) {
    if (!isContextValid()) {
      gpmWarn('Context invalid, skipping storage operation');
      return fallback;
    }

    try {
      return await operation();
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        isInvalidated = true;
        showRecoveryUI();
        return fallback;
      }
      throw e;
    }
  }

  return {
    startMonitoring,
    stopMonitoring,
    isContextValid,
    safeStorageOperation,
    showRecoveryUI,
    hideRecoveryUI,
  };
})();
