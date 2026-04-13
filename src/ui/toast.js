(function () {
  const MAX_TOASTS = 3;
  const DEFAULT_DURATIONS = {
    success: 3000,
    info: 3000,
    warning: 3000,
    error: 5000,
  };

  function getContainer() {
    let container = document.getElementById('gpm-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'gpm-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type, options) {
    type = type || 'info';
    options = options || {};

    const container = getContainer();
    const duration = options.duration != null ? options.duration : DEFAULT_DURATIONS[type] || 3000;

    while (container.children.length >= MAX_TOASTS) {
      const oldest = container.firstElementChild;
      clearTimeout(oldest._gpmTimerId);
      container.removeChild(oldest);
    }

    const toast = document.createElement('div');
    toast.className = 'gpm-toast gpm-toast-' + type;
    toast.style.position = 'relative';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'gpm-toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (options.undoAction) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'gpm-toast-undo';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', function () {
        options.undoAction();
        dismissToast(toast);
      });
      toast.appendChild(undoBtn);
    }

    if (options.progress) {
      const progressBar = document.createElement('div');
      progressBar.className = 'gpm-toast-progress';
      toast.appendChild(progressBar);
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
