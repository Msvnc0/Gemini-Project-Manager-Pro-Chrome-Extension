/**
 * selectors.js — Gemini DOM Selector Configuration (Adaptive)
 *
 * Centralized selector definitions with fallback chains and structural discovery.
 * When Gemini updates its DOM structure, only this file needs to be updated.
 *
 * Each selector key has a comma-separated list of CSS selectors tried in order.
 * The first match wins. This provides resilience against Gemini UI changes.
 *
 * Adaptive features:
 *   - Structural discovery: finds elements by DOM relationships, not class names
 *   - Selector cache: remembers working selectors to avoid repeated discovery
 *   - Auto-invalidation: cache entries expire when they stop working
 */

const GPM_SELECTORS = {
  // ── Sidebar container ──
  // Primary: custom element name (most stable)
  // Fallbacks: class-based, semantic HTML, ARIA roles
  sidebar: 'conversations-list, [class*="sidenav"], [class*="overflow-container"], nav[aria-label], nav, [role="navigation"]',

  // ── Individual chat items in the sidebar ──
  // Gemini uses /app/<id> format for chat URLs
  chatItem: 'a[href^="/app/"]',

  // ── The "New Chat" button ──
  // Try aria-label first (most reliable), then generic /app link
  newChatButton: 'a[href="/app"][aria-label*="New chat"], a[href="/app"][aria-label*="Yeni sohbet"], a[href="/app"]:not([href*="/app/"])',

  // ── The text input / prompt area ──
  // contenteditable is most common, textarea and role="textbox" as fallbacks
  inputArea: '[contenteditable="true"], textarea[aria-label], .ql-editor, [role="textbox"]',
  inputContainer: 'form, [class*="input-area"], [class*="prompt"]',

  // ── Dark mode detection ──
  darkModeIndicator: 'html[dark], html[data-theme="dark"], body.dark-theme, html.dark-theme',

  // ── Toolbar elements (for Quick Prompt button injection) ──
  // Multiple fallbacks: Gemini frequently renames these classes
  leadingActions: '.leading-actions-wrapper, .input-area-leading-actions, [class*="leading-actions"], [class*="toolbar-actions"]',
  toolboxDrawer: 'toolbox-drawer, [class*="toolbox-drawer"], [class*="tool-drawer"]',
  toolboxButtonContainer: '.toolbox-drawer-button-container, [class*="toolbox-button"]',

  // ── Sidebar sections ──
  chatHistory: '.chat-history',
  gemsList: '.gems-list-container',
  sideNavEntry: '.side-nav-entry-container'
};

// ── Selector Cache (adaptive discovery results) ──
const _gpmSelectorCache = {};

/**
 * Structural discovery functions for critical selectors.
 * Called when CSS-based selectors fail. Each returns an Element or null.
 * These do NOT depend on CSS class names — they use DOM structure relationships.
 */
const _gpmStructuralDiscovery = {
  /**
   * Find sidebar by structural heuristics:
   *   - Contains <a href="/app/..."> links (chat items)
   *   - Is a scrollable container
   *   - Contains section labels like "Chats", "Gems"
   */
  sidebar() {
    // Heuristic: find the scrollable container that holds chat links
    const chatLink = document.querySelector('a[href^="/app/"]');
    if (chatLink) {
      let el = chatLink.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!el || el === document.body) break;
        const style = window.getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
        const isReasonableSize = el.clientHeight > 200;
        if (isScrollable && isReasonableSize) {
          if (typeof gpmLog === 'function') gpmLog('Sidebar discovered via structural search (scrollable ancestor of chat link)');
          return el;
        }
        el = el.parentElement;
      }
    }
    return null;
  },

  /**
   * Find input area by structural heuristics:
   *   - Focused/focusable element at bottom of page
   *   - contenteditable or textarea
   */
  inputArea() {
    // Try active element first
    const active = document.activeElement;
    if (active && (active.contentEditable === 'true' || active.tagName === 'TEXTAREA')) {
      if (typeof gpmLog === 'function') gpmLog('Input area discovered via active element');
      return active;
    }

    // Find contenteditable elements that are visible and near bottom of viewport
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const rect = el.getBoundingClientRect();
      // Input is typically in the bottom third of the viewport
      if (rect.top > window.innerHeight * 0.5 && rect.height > 20 && rect.height < 300) {
        if (typeof gpmLog === 'function') gpmLog('Input area discovered via position heuristic');
        return el;
      }
    }
    return null;
  }
};

/**
 * Try to find an element using a selector with fallback chain.
 * If CSS selectors fail, attempts structural discovery for critical keys.
 * Successful discoveries are cached for faster subsequent lookups.
 *
 * @param {string} selectorKey — Key from GPM_SELECTORS
 * @param {Element} [context=document] — Optional parent element to search within
 * @returns {Element|null} — The first matching element or null
 */
function gpmQuerySelector(selectorKey, context) {
  const selector = GPM_SELECTORS[selectorKey];
  if (!selector) {
    if (typeof gpmWarn === 'function') gpmWarn('Unknown selector key:', selectorKey);
    return null;
  }
  const root = context || document;

  // Try CSS selector first (fastest path)
  const result = root.querySelector(selector);
  if (result) return result;

  // Check cache — a previously discovered element might still be valid
  const cached = _gpmSelectorCache[selectorKey];
  if (cached && cached.isConnected) {
    return cached;
  }
  // Cache entry expired — remove it
  if (cached) {
    delete _gpmSelectorCache[selectorKey];
  }

  // Try structural discovery for keys that have discovery functions
  const discoveryFn = _gpmStructuralDiscovery[selectorKey];
  if (discoveryFn && root === document) {
    const discovered = discoveryFn();
    if (discovered) {
      // Cache the discovered element
      _gpmSelectorCache[selectorKey] = discovered;
      if (typeof gpmLog === 'function') gpmLog('Cached discovered element for:', selectorKey);
      return discovered;
    }
  }

  if (typeof gpmWarn === 'function') {
    gpmWarn('Selector failed for key:', selectorKey, '| Tried:', selector.slice(0, 80),
      discoveryFn ? '+ structural discovery' : '');
  }
  return null;
}

/**
 * Try to find all elements using a selector with fallback chain.
 * @param {string} selectorKey — Key from GPM_SELECTORS
 * @param {Element} [context=document] — Optional parent element to search within
 * @returns {NodeList} — All matching elements
 */
function gpmQuerySelectorAll(selectorKey, context) {
  const selector = GPM_SELECTORS[selectorKey];
  if (!selector) {
    if (typeof gpmWarn === 'function') gpmWarn('Unknown selector key:', selectorKey);
    return [];
  }
  const root = context || document;
  return root.querySelectorAll(selector);
}

/**
 * Invalidate all cached selector discoveries.
 * Called during re-initialization when DOM structure may have changed.
 */
function gpmClearSelectorCache() {
  for (const key in _gpmSelectorCache) {
    delete _gpmSelectorCache[key];
  }
  if (typeof gpmLog === 'function') gpmLog('Selector cache cleared');
}
