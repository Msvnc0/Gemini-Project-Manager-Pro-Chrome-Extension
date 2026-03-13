/**
 * config.js — Shared Configuration, State, and Utilities
 *
 * This module is loaded FIRST (after i18n.js, storage.js, selectors.js, ui_elements.js)
 * and provides shared globals used by all other GPM modules.
 *
 * Exports (global):
 *   - GPM_CONFIG   — Configuration constants (timeouts, intervals, flags)
 *   - GPM_STATE    — Centralized mutable state object
 *   - gpmLog()     — Debug logger (only when GPM_CONFIG.DEBUG is true)
 *   - gpmWarn()    — Debug warning logger
 *   - gpmError()   — Error logger (always logs)
 *   - gpmIsContextValid() — Check if extension context is still valid
 *   - extractChatIdFromUrl() — Extract chat ID from URL/href/path
 *   - gpmWaitForElement()   — Wait for a DOM element to appear
 */

// ── Configuration Constants ──
const GPM_CONFIG = {
  SIDEBAR_TIMEOUT: 15000,
  CONTENT_TIMEOUT: 10000,
  NAV_DELAY: 600,
  POLL_INTERVAL: 500,
  ASSIGNMENT_TIMEOUT: 120000,
  SYNC_DEBOUNCE: 300,
  ENHANCE_DEBOUNCE: 500,
  QP_BUTTON_CHECK: 1000,
  HEALTH_CHECK_INTERVAL: 5000,  // DOM health check every 5 seconds
  REINIT_DEBOUNCE: 1000,        // Debounce for re-initialization attempts
  MAX_REINIT_FAILURES: 3,       // Max consecutive re-init failures before backing off
  DEBUG: false  // Set to true to enable console logging
};

// ── Debug Logger — only logs when GPM_CONFIG.DEBUG is true ──
function gpmLog(...args) {
  if (GPM_CONFIG.DEBUG) console.log('[GPM]', ...args);
}
function gpmWarn(...args) {
  if (GPM_CONFIG.DEBUG) console.warn('[GPM]', ...args);
}
function gpmError(...args) {
  console.error('[GPM]', ...args); // Errors always log
}

// ── Centralized State (GPM_STATE) ──
const GPM_STATE = {
  container: null,              // The injected <div data-gpm="root"> in sidebar
  modalHost: null,              // Shadow DOM host for modals/overlays only
  modalRoot: null,              // Shadow root for modals
  initialized: false,
  pendingChatAssignment: null,
  styleInjected: false,
  enhanceAbortController: null, // AbortController for native chat item listeners
  aliasResolveTimer: null,      // Debounced alias resolver timer
  qpOpen: false,                // Quick Prompts panel open state
  syncTimeout: null,            // Cross-tab sync debounce timer
  healthCheckTimer: null,       // DOM health monitor interval ID
  reinitDebounceTimer: null,    // Re-initialization debounce timer
  reinitFailCount: 0,           // Consecutive re-init failure counter
  _qpCheckInterval: null,       // Quick Prompt button check interval ID
  _qpMutationObserver: null     // Quick Prompt button MutationObserver instance
};

/**
 * Reset GPM_STATE for re-initialization.
 * Clears timers, abort controllers, and resets flags — but preserves
 * pendingChatAssignment to avoid losing in-flight operations.
 */
function gpmResetState() {
  gpmLog('Resetting GPM state for re-initialization');

  // Clear timers
  clearTimeout(GPM_STATE.aliasResolveTimer);
  clearTimeout(GPM_STATE.syncTimeout);
  clearTimeout(GPM_STATE.reinitDebounceTimer);

  // Clear Quick Prompt button monitor (interval + observer)
  if (GPM_STATE._qpCheckInterval) {
    clearInterval(GPM_STATE._qpCheckInterval);
    GPM_STATE._qpCheckInterval = null;
  }
  if (GPM_STATE._qpMutationObserver) {
    GPM_STATE._qpMutationObserver.disconnect();
    GPM_STATE._qpMutationObserver = null;
  }

  // Abort outstanding native chat listeners
  if (GPM_STATE.enhanceAbortController) {
    GPM_STATE.enhanceAbortController.abort();
    GPM_STATE.enhanceAbortController = null;
  }

  // Remove stale DOM references (container may have been removed by Gemini re-mount)
  GPM_STATE.container = null;
  GPM_STATE.modalHost = null;
  GPM_STATE.modalRoot = null;

  // Clear adaptive selector cache (DOM structure may have changed)
  if (typeof gpmClearSelectorCache === 'function') gpmClearSelectorCache();

  // Reset flags — allow re-initialization
  GPM_STATE.initialized = false;
  GPM_STATE.styleInjected = false;
  GPM_STATE.qpOpen = false;
  GPM_STATE.aliasResolveTimer = null;
  GPM_STATE.syncTimeout = null;
  GPM_STATE.reinitDebounceTimer = null;

  // NOTE: pendingChatAssignment is intentionally preserved
  // NOTE: healthCheckTimer is NOT cleared here — the caller manages it
}

// ── Extension context check ──
function gpmIsContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

/**
 * Extract chat ID from a URL, href, or path string.
 * Supports both new format (/app/<id>) and legacy formats (/chat/<id>, /c/<id>).
 * @param {string} urlOrHref — Full URL, relative href, or pathname
 * @returns {string|null} — The extracted chat ID or null if not found
 */
function extractChatIdFromUrl(urlOrHref) {
  if (!urlOrHref || typeof urlOrHref !== 'string') return null;
  // New format: /app/<chatId>
  const appMatch = urlOrHref.match(/\/app\/([a-zA-Z0-9_-]+)/);
  if (appMatch) return appMatch[1];
  // Legacy formats: /chat/<chatId> or /c/<chatId>
  const legacyMatch = urlOrHref.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/);
  if (legacyMatch) return legacyMatch[1];
  return null;
}

/**
 * Wait for a DOM element matching a selector to appear.
 * @param {string} selector — CSS selector string
 * @param {number} timeout — Maximum wait time in ms
 * @returns {Promise<Element|null>}
 */
function gpmWaitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver((_, obs) => {
      const found = document.querySelector(selector);
      if (found) { obs.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}
