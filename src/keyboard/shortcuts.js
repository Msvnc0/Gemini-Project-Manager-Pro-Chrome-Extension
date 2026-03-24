/**
 * shortcuts.js — Keyboard Shortcuts for GPM
 *
 * Global shortcuts for common operations.
 * Shortcuts work when the sidebar or a GPM element has focus.
 */

const GPMKeyboardShortcuts = (() => {
  const SHORTCUTS = {
    'ctrl+n': { action: 'newFolder', description: 'Yeni klasör oluştur' },
    'ctrl+f': { action: 'focusSearch', description: 'Arama alanına odaklan' },
    'ctrl+shift+n': { action: 'newChat', description: 'Yeni sohbet başlat' },
    'ctrl+e': { action: 'editSelected', description: 'Seçili öğeyi düzenle' },
    delete: { action: 'deleteSelected', description: 'Seçili öğeyi sil' },
    escape: { action: 'closeModal', description: 'Modalı kapat' },
    'ctrl+z': { action: 'undo', description: 'Geri al' },
    'ctrl+shift+z': { action: 'redo', description: 'Yinele' },
    'ctrl+b': { action: 'toggleSidebar', description: 'Kenar çubuğunu aç/kapat' },
    'ctrl+shift+b': { action: 'showBackupPanel', description: 'Yedek panelini göster' },
    arrow_up: { action: 'navigateUp', description: 'Yukarı git' },
    arrow_down: { action: 'navigateDown', description: 'Aşağı git' },
    enter: { action: 'selectItem', description: 'Öğeyi seç' },
    space: { action: 'toggleExpand', description: 'Genişlet/Daralt' },
  };

  const handlers = {
    newFolder: () => {
      if (typeof gpmShowCreateProjectModal === 'function') {
        gpmShowCreateProjectModal();
      }
    },

    focusSearch: () => {
      const searchInput = document.querySelector('[data-gpm="search"]');
      if (searchInput) {
        searchInput.focus();
      }
    },

    newChat: () => {
      if (typeof gpmTriggerNewChat === 'function') {
        gpmTriggerNewChat();
      }
    },

    editSelected: () => {
      const selected = document.querySelector('[data-gpm="item"]:focus, [data-gpm="chat"]:focus');
      if (selected) {
        selected.dispatchEvent(new CustomEvent('gpm-edit'));
      }
    },

    deleteSelected: () => {
      const selected = document.querySelector('[data-gpm="item"]:focus, [data-gpm="chat"]:focus');
      if (selected) {
        selected.dispatchEvent(new CustomEvent('gpm-delete'));
      }
    },

    closeModal: () => {
      const overlay = document.querySelector('.gpm-overlay');
      if (overlay) {
        overlay.remove();
      }
    },

    undo: () => {
      if (typeof GPMHistory !== 'undefined') {
        GPMHistory.undo();
      }
    },

    redo: () => {
      if (typeof GPMHistory !== 'undefined') {
        GPMHistory.redo();
      }
    },

    toggleSidebar: () => {
      const container = GPM_STATE.container;
      if (container) {
        container.style.display = container.style.display === 'none' ? '' : 'none';
      }
    },

    navigateUp: () => {
      const items = Array.from(document.querySelectorAll('[data-gpm="item"], [data-gpm="chat"]'));
      const focused = document.activeElement;
      const idx = items.indexOf(focused);
      if (idx > 0) {
        items[idx - 1].focus();
      }
    },

    navigateDown: () => {
      const items = Array.from(document.querySelectorAll('[data-gpm="item"], [data-gpm="chat"]'));
      const focused = document.activeElement;
      const idx = items.indexOf(focused);
      if (idx < items.length - 1) {
        items[idx + 1].focus();
      }
    },

    selectItem: () => {
      const focused = document.activeElement;
      if (focused && focused.dataset.gpm) {
        focused.click();
      }
    },

    toggleExpand: () => {
      const focused = document.activeElement;
      if (focused && focused.dataset.gpm === 'item') {
        focused.click();
      }
    },

    showBackupPanel: () => {
      if (typeof GPMUI !== 'undefined' && typeof GPMUI.showBackupPanel === 'function' && GPM_STATE.modalRoot) {
        GPMUI.showBackupPanel(GPM_STATE.modalRoot);
      }
    },
  };

  function getShortcutKey(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key.startsWith('arrow')) key = key.replace('arrow', 'arrow_');

    parts.push(key);
    return parts.join('+');
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key !== 'Escape') return;
      }

      const shortcutKey = getShortcutKey(e);
      const shortcut = SHORTCUTS[shortcutKey];

      if (shortcut && handlers[shortcut.action]) {
        e.preventDefault();
        handlers[shortcut.action]();
      }
    });

    gpmLog('[GPM Keyboard] Shortcuts initialized');
  }

  function getShortcutsList() {
    return Object.entries(SHORTCUTS).map(([key, config]) => ({
      key,
      action: config.action,
      description: config.description,
    }));
  }

  return {
    init,
    getShortcutsList,
    handlers,
    SHORTCUTS,
  };
})();
