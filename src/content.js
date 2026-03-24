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
 *   - tags/             → Tags/labels system
 *   - keyboard/         → Keyboard shortcuts
 *   - history/          → Undo/redo system
 *   - performance/      → Virtualized list
 *   - analytics/        → Usage tracking
 */

// ══════════════════════════════════════
//  INITIALIZATION (Re-entrant safe)
// ══════════════════════════════════════

let _spaObserversActive = false;
let _initialized = false;

async function gpmInit() {
  if (GPM_STATE.initialized) return;

  console.log('[GPM] gpmInit() started - v2.0.0');

  // ── Step 1: Storage initialization & schema migration ──
  try {
    await GPMStorage.initializeStorage();
    console.log('[GPM] Storage initialized');
  } catch (e) {
    console.error('[GPM] Storage initialization failed:', e);
  }

  // ── Step 2: Load settings & set language ──
  const settings = await GPMStorage.getSettings();
  if (settings.lang) {
    gpmSetLang(settings.lang);
  } else {
    const detectedLang = detectBrowserLanguage();
    gpmSetLang(detectedLang);
    await GPMStorage.saveSettings({ ...settings, lang: detectedLang });
  }

  // ── Step 3: Run data integrity check ──
  try {
    const integrityResult = await GPMIntegrityCheck.run();
    if (integrityResult.issues && integrityResult.issues.length > 0) {
      console.log('[GPM] Integrity check found issues:', integrityResult.issues.length);
    }
  } catch (e) {
    console.warn('[GPM] Integrity check failed:', e);
  }

  // ── Step 4: Start context recovery monitoring ──
  try {
    GPMContextRecovery.startMonitoring();
  } catch (e) {
    console.warn('[GPM] Context recovery monitoring failed:', e);
  }

  // ── Step 5: Initialize keyboard shortcuts ──
  try {
    if (typeof GPMKeyboardShortcuts !== 'undefined') {
      GPMKeyboardShortcuts.init();
    }
  } catch (e) {
    console.warn('[GPM] Keyboard shortcuts init failed:', e);
  }

  // ── Step 6: Track session ──
  try {
    if (typeof GPMUsageTracker !== 'undefined') {
      await GPMUsageTracker.trackSession();
    }
  } catch (e) {
    console.warn('[GPM] Session tracking failed:', e);
  }

  // ── Step 7: Auto backup check ──
  try {
    if (typeof GPMBackupManager !== 'undefined') {
      await GPMBackupManager.autoBackupIfNeeded();
    }
  } catch (e) {
    console.warn('[GPM] Auto backup failed:', e);
  }

  // ── Step 8: Inject Quick Prompt trigger EARLY ──
  console.log('[GPM] Early QP injection attempt');
  try {
    gpmInjectQuickPromptTrigger();
    gpmObserveQuickPromptButton();
  } catch (e) {
    console.error('[GPM] Early QP injection error:', e);
  }

  // ── Step 9: Wait for sidebar ──
  const sidebar = await gpmWaitForElement(GPM_SELECTORS.sidebar, GPM_CONFIG.SIDEBAR_TIMEOUT);
  if (!sidebar) {
    gpmWarn('Sidebar not found. Retrying...');
    gpmObserveForSidebar();
    return;
  }

  gpmLog('Sidebar found:', sidebar.tagName, sidebar.className?.slice(0, 60));

  await gpmWaitForSidebarContent(sidebar, GPM_CONFIG.CONTENT_TIMEOUT);

  GPM_STATE.initialized = true;
  GPM_STATE.reinitFailCount = 0;
  gpmLog('Sidebar content ready. Injecting all modules.');

  // ── Step 10: Initialize DOM injection modules ──
  gpmInjectStyles();
  gpmInjectProjectSection(sidebar);
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

  // ── Step 13: Initialize tag filter bar ──
  try {
    const filterBar = await GPMTagUI.createTagFilterBar((tagIds) => {
      GPM_STATE.activeTagFilters = tagIds;
      gpmRenderTree();
    });
    if (GPM_STATE.container) {
      const header = GPM_STATE.container.querySelector('[data-gpm="header"]');
      if (header) {
        header.after(filterBar);
      }
    }
  } catch (e) {
    console.warn('[GPM] Tag filter bar init failed:', e);
  }

  // ── Step 14: Start sync monitoring ──
  try {
    if (typeof GPMSyncManager !== 'undefined') {
      await GPMSyncManager.startAutoSync();
    }
  } catch (e) {
    console.warn('[GPM] Sync monitoring failed:', e);
  }

  console.log('[GPM] Initialization complete');
}

// ══════════════════════════════════════
//  EXTENSION UPDATE HANDLER
// ══════════════════════════════════════

try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!gpmIsContextValid()) return;

    if (msg.type === 'GPM_SYNC') {
      clearTimeout(GPM_STATE.syncTimeout);
      GPM_STATE.syncTimeout = setTimeout(() => gpmRenderTree(), GPM_CONFIG.SYNC_DEBOUNCE);
    }

    if (msg.type === 'GPM_EXTENSION_UPDATED') {
      console.log('[GPM] Extension updated to v' + msg.newVersion);
      GPMContextRecovery.showRecoveryUI();
    }
  });
} catch (e) {
  gpmWarn('Could not register message listener:', e.message);
}

// ══════════════════════════════════════
//  TEMPLATE APPLICATION
// ══════════════════════════════════════

async function gpmApplyTemplate(templateId) {
  if (typeof applyTemplate !== 'undefined') {
    const success = await applyTemplate(templateId);
    if (success) {
      GPMUsageTracker.trackFeatureUsage('template_' + templateId);
    }
    return success;
  }
  return false;
}

// ══════════════════════════════════════
//  BOOT
// ══════════════════════════════════════

(function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gpmInit);
  } else {
    gpmInit();
  }
})();
