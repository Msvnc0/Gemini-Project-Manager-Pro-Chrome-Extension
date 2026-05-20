/**
 * config.js — Shared Configuration, State, and Utilities
 *
 * This module is loaded after i18n.js, validators.js, storage.js, selectors.js, ui_elements.js
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
  HEALTH_CHECK_INTERVAL: 5000, // DOM health check every 5 seconds
  REINIT_DEBOUNCE: 1000, // Debounce for re-initialization attempts
  MAX_REINIT_FAILURES: 3, // Max consecutive re-init failures before backing off
  DELETION_CHECK_DEBOUNCE: 2500,
  DELETION_CHECK_PHASES: 3,
  SIDEBAR_STABILIZE_INTERVAL: 1500,
  SIDEBAR_STABILIZE_REQUIRED: 2,
  DEBUG: false, // Set to true to enable console logging
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
  container: null, // The injected <div data-gpm="root"> in sidebar
  modalHost: null, // Shadow DOM host for modals/overlays only
  modalRoot: null, // Shadow root for modals
  initialized: false,
  pendingChatAssignment: null,
  styleInjected: false,
  enhanceAbortController: null, // AbortController for native chat item listeners
  aliasResolveTimer: null, // Debounced alias resolver timer
  qpOpen: false, // Quick Prompts panel open state
  syncTimeout: null, // Cross-tab sync debounce timer
  healthCheckTimer: null, // DOM health monitor interval ID
  reinitDebounceTimer: null, // Re-initialization debounce timer
  reinitFailCount: 0, // Consecutive re-init failure counter
  _qpCheckInterval: null, // Quick Prompt button check interval ID
  _qpMutationObserver: null, // Quick Prompt button MutationObserver instance
  _qpLastToolbarMethod: null, // Last successful toolbar placement method (prevents method-flapping flicker)
  _initializing: false, // Prevents concurrent gpmInit() calls from racing
  _deletionCheckTimer: null,
  _deletionPhaseCount: 0,
  _sidebarStabilized: false,
  _sidebarStableCount: 0,
  _lastSidebarChatCount: 0,
  _sidebarStabilizeTimer: null,
  _fallbackDeletionInterval: null, // Fallback deletion check (bypasses observer)
  _searchQuery: '',
  spaObserversActive: false,
};

/**
 * Reset GPM_STATE for re-initialization.
 * Clears timers, abort controllers, and resets flags — but preserves
 * pendingChatAssignment to avoid losing in-flight operations.
 */
function gpmResetState() {
  gpmLog('Resetting GPM state for re-initialization');

  clearTimeout(GPM_STATE.aliasResolveTimer);
  clearTimeout(GPM_STATE.syncTimeout);
  clearTimeout(GPM_STATE.reinitDebounceTimer);
  clearTimeout(GPM_STATE._deletionCheckTimer);
  clearTimeout(GPM_STATE._sidebarStabilizeTimer);

  if (GPM_STATE._qpCheckInterval) {
    clearInterval(GPM_STATE._qpCheckInterval);
    GPM_STATE._qpCheckInterval = null;
  }
  if (GPM_STATE._qpMutationObserver) {
    GPM_STATE._qpMutationObserver.disconnect();
    GPM_STATE._qpMutationObserver = null;
  }
  if (GPM_STATE.enhanceAbortController) {
    GPM_STATE.enhanceAbortController.abort();
    GPM_STATE.enhanceAbortController = null;
  }
  if (typeof gpmCleanupObservers === 'function') {
    gpmCleanupObservers();
  }
  if (typeof window.gpmStopHealthMonitor === 'function') {
    window.gpmStopHealthMonitor();
  }
  if (typeof GPMSyncManager !== 'undefined' && GPMSyncManager.stopAutoSync) {
    GPMSyncManager.stopAutoSync();
  }
  GPM_STATE.container = null;
  GPM_STATE.modalHost = null;
  GPM_STATE.modalRoot = null;
  if (typeof gpmClearSelectorCache === 'function') gpmClearSelectorCache();
  GPM_STATE.initialized = false;
  GPM_STATE.styleInjected = false;
  GPM_STATE.qpOpen = false;
  GPM_STATE.aliasResolveTimer = null;
  GPM_STATE.syncTimeout = null;
  GPM_STATE.reinitDebounceTimer = null;
  GPM_STATE._deletionCheckTimer = null;
  GPM_STATE._pendingDeletedChatIds = null;
  GPM_STATE._deletionPhaseCount = 0;
  GPM_STATE._sidebarStabilized = false;
  GPM_STATE._sidebarStableCount = 0;
  GPM_STATE._lastSidebarChatCount = 0;
  GPM_STATE._sidebarStabilizeTimer = null;
  GPM_STATE.healthCheckTimer = null;
  GPM_STATE.spaObserversActive = false;
  GPM_STATE._searchQuery = '';
  GPM_STATE._matchCache = null;
  if (typeof gpmResetObserversFlag === 'function') {
    gpmResetObserversFlag();
  }
  if (typeof GPMContextRecovery !== 'undefined' && GPMContextRecovery.stopMonitoring) {
    GPMContextRecovery.stopMonitoring();
  }
  if (typeof GPMKeyboardShortcuts !== 'undefined' && GPMKeyboardShortcuts.destroy) {
    GPMKeyboardShortcuts.destroy();
  }
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
 * Supports multiple formats for maximum compatibility with Gemini URL changes.
 *
 * Supported formats:
 *   - /app/<chatId>           (current Gemini format)
 *   - /chat/<chatId>          (legacy format)
 *   - /c/<chatId>             (short format)
 *   - ?chat=<chatId>          (query parameter)
 *   - #/chat/<chatId>         (hash-based routing)
 *   - UUID pattern anywhere   (fallback for new formats)
 *   - Long alphanumeric       (fallback for chat-like IDs)
 *
 * @param {string} urlOrHref — Full URL, relative href, or pathname
 * @returns {string|null} — The extracted chat ID or null if not found
 */
function extractChatIdFromUrl(urlOrHref) {
  if (!urlOrHref || typeof urlOrHref !== 'string') return null;

  // Format 1: /app/<chatId> (current Gemini format)
  const appMatch = urlOrHref.match(/\/app\/([a-zA-Z0-9_-]+)/);
  if (appMatch) return appMatch[1];

  // Format 2: /chat/<chatId> (legacy format)
  const chatMatch = urlOrHref.match(/\/chat\/([a-zA-Z0-9_-]+)/);
  if (chatMatch) return chatMatch[1];

  // Format 3: /c/<chatId> (short format)
  const shortMatch = urlOrHref.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  // Format 4: ?chat=<chatId> (query parameter)
  const queryMatch = urlOrHref.match(/[?&]chat=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  // Format 5: #/chat/<chatId> (hash-based routing)
  const hashMatch = urlOrHref.match(/#\/chat\/([a-zA-Z0-9_-]+)/);
  if (hashMatch) return hashMatch[1];

  // Format 6: UUID pattern (standard UUID v4)
  const uuidMatch = urlOrHref.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1];

  // Format 7: Long alphanumeric string (20+ chars) that looks like a chat ID
  // This is a fallback for new/unknown formats
  const fallbackMatch = urlOrHref.match(/\/([a-zA-Z0-9_-]{20,})(?:\/|$|\?|#)/);
  if (fallbackMatch) return fallbackMatch[1];

  return null;
}

/**
 * Wait for a DOM element matching a selector to appear.
 * @param {string} selector — CSS selector string
 * @param {number} timeout — Maximum wait time in ms
 * @returns {Promise<Element|null>}
 */
function gpmWaitForElement(selector, timeout) {
  if (timeout === undefined) timeout = 10000;
  return new Promise(function (resolve) {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const timer = { id: null };
    const observer = new MutationObserver(function (_, obs) {
      const found = document.querySelector(selector);
      if (found) {
        obs.disconnect();
        clearTimeout(timer.id);
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer.id = setTimeout(function () {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Wait for Gemini's actual sidebar to appear.
 * Uses structural discovery (chat link → scrollable ancestor) first,
 * then falls back to CSS selectors. This avoids matching the wrong
 * container (e.g., main-content wrappers) on the new Gemini layout.
 * @param {number} timeout
 * @returns {Promise<Element|null>}
 */
function gpmWaitForSidebar(timeout) {
  if (timeout === undefined) timeout = 15000;

  const tryFind = function () {
    // Structural discovery: walk up from a chat link to the sidebar container.
    // We do NOT rely on overflow/scroll styles — the new Gemini layout may not
    // use traditional scrolling. Instead we climb from the chat link until we hit
    // the body, and take the widest ancestor that still looks like a nav list.
    const chatLink = document.querySelector('a[href^="/app/"]');
    if (chatLink) {
      let el = chatLink.parentElement;
      let candidate = null;
      for (let i = 0; i < 15; i++) {
        if (!el || el === document.body) break;
        // Track the deepest element that has multiple children (likely a list)
        if (el.children.length >= 2) {
          candidate = el;
        }
        el = el.parentElement;
      }
      if (candidate) return candidate;
    }
    // CSS fallback — only if structural discovery failed
    return document.querySelector(GPM_SELECTORS.sidebar);
  };

  return new Promise(function (resolve) {
    const found = tryFind();
    if (found) return resolve(found);

    const timer = { id: null };
    const observer = new MutationObserver(function (_, obs) {
      const found = tryFind();
      if (found) {
        obs.disconnect();
        clearTimeout(timer.id);
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer.id = setTimeout(function () {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function generateUid() {
  const timestamp = Date.now().toString(36);
  const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const random2 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${timestamp}-${random1}-${random2}`;
}
