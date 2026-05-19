/**
 * content.js — Bootstrapper / Coordinator
 *
 * This file is now a thin orchestrator that initializes all GPM modules.
 * All logic has been extracted into dedicated modules:
 *
 *   - config.js        → GPM_CONFIG, GPM_STATE, utilities, loggers
 *   - dom-injection.js  → Style injection, modal host, sidebar injection
 *   - project-tree.js   → Tree rendering, project/chat rows, context menus, drag-drop
 *   - quick-prompts.js  → Quick prompt trigger, panel, toggle
 *   - navigation.js     → SPA navigation, chat observer, native chat enhancement
 *   - recovery/         → Context recovery, integrity check
 *   - backup/           → Multiple backup versions
 *   - sync/             → Cross-device sync, conflict resolution
 *   - templates/        → Folder templates
 *   - keyboard/         → Keyboard shortcuts
 *   - history/          → Undo/redo system
 *   - performance/      → (reserved for future use)
 *   - analytics/        → Usage tracking
 */

// ══════════════════════════════════════
//  INITIALIZATION (Re-entrant safe)
// ══════════════════════════════════════

let _spaObserversActive = false;

function gpmResetObserversFlag() {
  _spaObserversActive = false;
}

async function gpmInit() {
  // Prevent concurrent initialization races (multiple triggers can fire simultaneously)
  if (GPM_STATE._initializing) return;
  if (GPM_STATE.initialized) return;

  GPM_STATE._initializing = true;

  gpmLog(
    'gpmInit() started - v' +
      (typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev')
  );

  // ── Start sidebar wait immediately (usually the longest pole) ──
  const sidebarPromise = gpmWaitForSidebar(GPM_CONFIG.SIDEBAR_TIMEOUT);

  // ── Storage + settings (needed before tree render) ──
  try {
    await GPMStorage.initializeStorage();
    gpmLog('Storage initialized');
  } catch (e) {
    gpmError('Storage initialization failed:', e);
  }

  const settings = await GPMStorage.getSettings();
  if (settings.lang) {
    gpmSetLang(settings.lang);
  } else {
    const detectedLang = detectBrowserLanguage();
    gpmSetLang(detectedLang);
    await GPMStorage.saveSettings({ ...settings, lang: detectedLang });
  }

  // ── Fire-and-forget: everything that does NOT block injection ──
  Promise.resolve()
    .then(() => GPMIntegrityCheck.run())
    .then((integrityResult) => {
      if (integrityResult.issues && integrityResult.issues.length > 0) {
        gpmLog('Integrity check found issues:', integrityResult.issues.length);
      }
    })
    .catch((e) => gpmWarn('Integrity check failed:', e));

  Promise.resolve()
    .then(() => GPMContextRecovery.startMonitoring())
    .catch((e) => gpmWarn('Context recovery monitoring failed:', e));

  Promise.resolve()
    .then(() => {
      if (typeof GPMKeyboardShortcuts !== 'undefined') GPMKeyboardShortcuts.init();
    })
    .catch((e) => gpmWarn('Keyboard shortcuts init failed:', e));

  Promise.resolve()
    .then(() => {
      if (typeof GPMUsageTracker !== 'undefined') return GPMUsageTracker.trackSession();
    })
    .catch((e) => gpmWarn('Session tracking failed:', e));

  Promise.resolve()
    .then(() => {
      if (typeof GPMBackupManager !== 'undefined') return GPMBackupManager.autoBackupIfNeeded();
    })
    .catch((e) => gpmWarn('Auto backup failed:', e));

  // ── Step 8: Inject Quick Prompt trigger EARLY ──
  gpmLog('Early QP injection attempt');
  try {
    gpmInjectQuickPromptTrigger();
    gpmObserveQuickPromptButton();
  } catch (e) {
    gpmError('Early QP injection error:', e);
  }

  // ── Step 9: Wait only for sidebar (already kicked off at top) ──
  const sidebar = await sidebarPromise;
  if (!sidebar) {
    gpmWarn('Sidebar not found. Retrying...');
    gpmObserveForSidebar();
    GPM_STATE._initializing = false;
    return;
  }

  gpmLog('Sidebar found:', sidebar.tagName, sidebar.className?.slice(0, 60));

  const contentReady = await gpmWaitForSidebarContent(sidebar, GPM_CONFIG.CONTENT_TIMEOUT);
  if (!contentReady) {
    gpmWarn('Sidebar content not ready after timeout, proceeding with empty sidebar');
  }

  GPM_STATE.initialized = true;
  GPM_STATE._initializing = false;
  GPM_STATE.reinitFailCount = 0;
  gpmLog('Sidebar content ready. Injecting all modules.');

  // ── Step 10: Initialize DOM injection modules ──
  gpmInjectStyles();
  gpmInjectProjectSection();
  gpmCreateModalHost();
  gpmInjectQuickPromptTrigger();
  gpmObserveQuickPromptButton();

  // ── Step 11: Start SPA observers (once only) ──
  if (!_spaObserversActive) {
    _spaObserversActive = true;
    gpmObserveSPANavigation();
    gpmObserveNewChats();
  }

  // ── Step 12: Start DOM health monitor ──
  gpmStartHealthMonitor();

  // ── Step 13: Start sync monitoring ──
  try {
    if (typeof GPMSyncManager !== 'undefined') {
      await GPMSyncManager.startAutoSync();
    }
  } catch (e) {
    gpmWarn('Sync monitoring failed:', e);
  }

  gpmLog('Initialization complete');
}

// ══════════════════════════════════════
//  EXTENSION UPDATE HANDLER
// ══════════════════════════════════════

function gpmScheduleSyncRender() {
  clearTimeout(GPM_STATE.syncTimeout);
  GPM_STATE.syncTimeout = setTimeout(() => {
    if (gpmIsContextValid() && GPM_STATE.initialized) {
      gpmRenderTree();
    }
  }, GPM_CONFIG.SYNC_DEBOUNCE);
}

try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!gpmIsContextValid()) return;

    if (msg.type === 'GPM_SYNC') {
      gpmScheduleSyncRender();
    }

    if (msg.type === 'GPM_EXTENSION_UPDATED') {
      gpmLog('Extension updated to v' + msg.newVersion);
      GPMContextRecovery.showRecoveryUI();
    }
  });
} catch (e) {
  gpmWarn('Could not register message listener:', e.message);
}

try {
  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (!gpmIsContextValid() || areaName !== 'local') return;

      const relevantKeys = ['gpm_projects', 'gpm_chatMap', 'gpm_quickPrompts', 'gpm_settings'];

      if (relevantKeys.some((key) => key in changes)) {
        gpmScheduleSyncRender();
      }

      if ('gpm_lastExtensionUpdate' in changes) {
        const updateInfo = changes.gpm_lastExtensionUpdate?.newValue;
        if (updateInfo?.version === chrome.runtime.getManifest().version) {
          gpmLog('Extension updated to v' + updateInfo.version);
          GPMContextRecovery.showRecoveryUI();
        }
      }
    });
  }
} catch (e) {
  gpmWarn('Could not register storage change listener:', e.message);
}

// ══════════════════════════════════════
//  BOOT
// ══════════════════════════════════════

(async function boot() {
  try {
    if (document.readyState === 'loading') {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve));
    }
    await gpmInit();
  } catch (e) {
    gpmError('Fatal: gpmInit() failed:', e);
  }
})();
