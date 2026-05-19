(function () {
  const MAX_TOASTS = 3;
  const DEFAULT_DURATIONS = {
    success: 3000,
    info: 3000,
    warning: 3000,
    error: 5000,
  };

  const TOAST_STYLES = `
    #gpm-toast-container {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .gpm-toast {
      pointer-events: auto;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      color: #fff;
      max-width: 380px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: gpm-toast-in 200ms ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .gpm-toast-info { background: #1a73e8; }
    .gpm-toast-success { background: #1e8e3e; }
    .gpm-toast-warning { background: #e37400; }
    .gpm-toast-error { background: #d93025; }
    .gpm-toast-exit { animation: gpm-toast-out 300ms ease forwards; }
    .gpm-toast-undo {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: #fff;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .gpm-toast-undo:hover { background: rgba(255,255,255,0.3); }
    @keyframes gpm-toast-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes gpm-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-8px); } }
  `;

  function getContainer() {
    const root = typeof GPM_STATE !== 'undefined' && GPM_STATE.modalRoot ? GPM_STATE.modalRoot : document.body;
    let container = root.querySelector('#gpm-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'gpm-toast-container';
      const style = document.createElement('style');
      style.textContent = TOAST_STYLES;
      container.appendChild(style);
      root.appendChild(container);
    }
    return container;
  }

  function showToast(message, type, options) {
    type = type || 'info';
    options = options || {};
    const container = getContainer();
    const duration = options.duration != null ? options.duration : DEFAULT_DURATIONS[type] || 3000;

    while (container.querySelectorAll('.gpm-toast').length >= MAX_TOASTS) {
      const oldest = container.querySelector('.gpm-toast');
      if (oldest) {
        clearTimeout(oldest._gpmTimerId);
        oldest.remove();
      }
    }

    const toast = document.createElement('div');
    toast.className = 'gpm-toast gpm-toast-' + type;
    const msgSpan = document.createElement('span');
    msgSpan.className = 'gpm-toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (options.undoAction) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'gpm-toast-undo';
      undoBtn.textContent = typeof t === 'function' ? t('undo') || 'Undo' : 'Undo';
      undoBtn.addEventListener('click', function () {
        options.undoAction();
        dismissToast(toast);
      });
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    const timerId = setTimeout(function () {
      dismissToast(toast);
    }, duration);
    toast._gpmTimerId = timerId;
    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._gpmTimerId);
    toast.classList.add('gpm-toast-exit');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  window.showToast = showToast;
})();
