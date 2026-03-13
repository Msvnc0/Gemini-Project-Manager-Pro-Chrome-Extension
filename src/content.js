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
 *
 * Load order (manifest.json content_scripts):
 *   1. i18n.js          — Internationalization strings + t() function
 *   2. storage.js       — Data layer (GPMStorage)
 *   3. selectors.js     — DOM selector configuration (GPM_SELECTORS)
 *   4. ui_elements.js   — UI component factory (GPMUI)
 *   5. config.js        — Shared config, state, utilities
 *   6. dom-injection.js — DOM injection helpers
 *   7. project-tree.js  — Project tree rendering
 *   8. quick-prompts.js — Quick prompts feature
 *   9. navigation.js    — SPA navigation & chat observer
 *  10. content.js       — THIS FILE — bootstrapper (loaded last)
 */

// ══════════════════════════════════════
//  INITIALIZATION (Re-entrant safe)
// ══════════════════════════════════════

// Track whether SPA observers have been set up (these should only run once)
let _spaObserversActive = false;

async function gpmInit() {
  // Guard: prevent concurrent or redundant initialization
  if (GPM_STATE.initialized) return;

  console.log('[GPM-DIAG] gpmInit() started');

  const settings = await GPMStorage.getSettings();
  if (settings.lang) {
    gpmSetLang(settings.lang);
  } else {
    // First install: auto-detect from browser language preferences
    const detectedLang = detectBrowserLanguage();
    gpmSetLang(detectedLang);
    // Persist detected language so it's not re-detected on next load
    await GPMStorage.saveSettings({ ...settings, lang: detectedLang });
  }

  // ── Inject Quick Prompt trigger EARLY (independent of sidebar) ──
  // The QP button goes in the input toolbar, not the sidebar.
  // Don't gate it behind sidebar detection.
  console.log('[GPM-DIAG] Early QP injection attempt');
  try {
    gpmInjectQuickPromptTrigger();
    gpmObserveQuickPromptButton();
  } catch (e) {
    console.error('[GPM-DIAG] Early QP injection error:', e);
  }

  const sidebar = await gpmWaitForElement(GPM_SELECTORS.sidebar, GPM_CONFIG.SIDEBAR_TIMEOUT);
  if (!sidebar) {
    gpmWarn('Sidebar not found. Retrying...');
    console.log('[GPM-DIAG] Sidebar not found — QP button should still be injected independently');
    gpmObserveForSidebar();
    return;
  }

  gpmLog('Sidebar found:', sidebar.tagName, sidebar.className?.slice(0, 60));
  console.log('[GPM-DIAG] Sidebar found:', sidebar.tagName, sidebar.className?.slice(0, 60));

  // Wait for chat content to load inside the sidebar before injecting.
  // Gemini lazy-loads sidebar sections — we need "Chats" or chat links to exist first.
  await gpmWaitForSidebarContent(sidebar, GPM_CONFIG.CONTENT_TIMEOUT);

  GPM_STATE.initialized = true;
  GPM_STATE.reinitFailCount = 0; // Reset failure counter on successful init
  gpmLog('Sidebar content ready. Injecting.');
  console.log('[GPM-DIAG] Sidebar content ready. Injecting all modules.');

  // Initialize DOM injection modules (safe to call multiple times)
  gpmInjectStyles();              // dom-injection.js — idempotent (checks styleInjected)
  gpmInjectProjectSection(sidebar); // dom-injection.js — removes old container first
  gpmCreateModalHost();           // dom-injection.js — idempotent (checks modalHost)
  gpmInjectQuickPromptTrigger();  // quick-prompts.js — idempotent (checks #gpm-qp-trigger)
  gpmObserveQuickPromptButton();  // quick-prompts.js — starts interval + observer

  // SPA observers should only be set up ONCE per page lifetime
  // (they use history monkey-patching which must not be applied twice)
  if (!_spaObserversActive) {
    _spaObserversActive = true;
    gpmObserveSPANavigation();    // navigation.js — monkey-patches history (once only)
    gpmObserveNewChats();         // navigation.js — starts polling + MutationObserver
  }

  // Start DOM health monitor (self-healing)
  gpmStartHealthMonitor();        // dom-injection.js — idempotent (checks healthCheckTimer)
}

// ══════════════════════════════════════
//  CROSS-TAB SYNC
// ══════════════════════════════════════

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!gpmIsContextValid()) return;
    if (msg.type === 'GPM_SYNC') {
      clearTimeout(GPM_STATE.syncTimeout);
      GPM_STATE.syncTimeout = setTimeout(() => gpmRenderTree(), GPM_CONFIG.SYNC_DEBOUNCE);
    }
  });
} catch (e) {
  gpmWarn('Could not register message listener:', e.message);
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
