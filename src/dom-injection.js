/**
 * dom-injection.js — Sidebar Injection, Style Injection, Modal Host
 *
 * Handles all DOM injection into Gemini's sidebar:
 *   - Scoped CSS style injection into <head>
 *   - Shadow DOM modal host creation
 *   - Finding the correct insertion point in the sidebar
 *   - Injecting the GPM project section container
 *   - Sidebar content detection and waiting
 *
 * Dependencies (globals from earlier scripts):
 *   - GPM_CONFIG, GPM_STATE, gpmLog, gpmWarn, gpmError (config.js)
 *   - GPM_SELECTORS (selectors.js)
 */

// ══════════════════════════════════════
//  INJECT SCOPED STYLES (into <head>)
// ══════════════════════════════════════

function gpmInjectStyles() {
  const existing = document.getElementById('gpm-injected-styles');
  if (existing) {
    GPM_STATE.styleInjected = true;
    return;
  }
  if (GPM_STATE.styleInjected) return;
  GPM_STATE.styleInjected = true;

  const style = document.createElement('style');
  style.id = 'gpm-injected-styles';
  style.textContent = `
    /* ── GPM Section Container ── */
    [data-gpm="root"] {
      padding: 0 0 4px 0;
      width: 100%;
      font-family: "Google Sans", "Helvetica Neue", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Section Header (like "Gems" / "Chats") ── */
    [data-gpm="header"] {
      display: flex;
      align-items: center;
      padding: 10px 16px 4px;
      cursor: pointer;
      user-select: none;
    }

    [data-gpm="header-chevron"] {
      font-size: 10px;
      margin-right: 4px;
      transition: transform 150ms ease;
      color: var(--gm-colorsurface-variant, #9aa0a6);
    }

    [data-gpm="header-chevron"].gpm-open {
      transform: rotate(0deg);
    }

    [data-gpm="header-chevron"].gpm-closed {
      transform: rotate(-90deg);
    }

    [data-gpm="header-title"] {
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
      color: inherit;
      flex: 1;
    }

    /* ── Items List ── */
    [data-gpm="list"] {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    [data-gpm="list"].gpm-hidden {
      display: none;
    }

    /* ── New Project Row ── */
    [data-gpm="item"] {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px 8px 24px;
      cursor: pointer;
      border-radius: 0 24px 24px 0;
      margin-right: 8px;
      transition: background 150ms ease;
      text-decoration: none;
      color: inherit;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
      line-height: 20px;
      position: relative;
    }

    [data-gpm="item"]:hover {
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
    }

    [data-gpm="item-icon"] {
      font-size: 18px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    [data-gpm="item-label"] {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
    }

    [data-gpm="item-count"] {
      font-size: 12px;
      opacity: 0.5;
    }

    /* ── New Project button ── */
    [data-gpm="new-project"] [data-gpm="item-icon"] {
      color: var(--gm-colorsurface-variant, #9aa0a6);
    }

    /* ── Subfolder indent ── */
    [data-gpm="sublist"] {
      list-style: none;
      margin: 0;
      padding: 0 0 0 16px;
    }

    [data-gpm="sublist"].gpm-hidden {
      display: none;
    }

    /* ── Chat items inside project ── */
    [data-gpm="chat"] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 16px 6px 40px;
      cursor: pointer;
      border-radius: 0 24px 24px 0;
      margin-right: 8px;
      transition: background 150ms ease;
      font-size: 13px;
      color: inherit;
      opacity: 0.8;
    }

    [data-gpm="chat"]:hover {
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
      opacity: 1;
    }

    [data-gpm="chat"].gpm-active {
      background: rgba(138, 180, 248, 0.16);
      opacity: 1;
    }

    [data-gpm="chat-dot"] {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    [data-gpm="chat-label"] {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [data-gpm="chat"].gpm-pinned::before {
      content: '📌';
      font-size: 10px;
    }

    /* ── Drag over ── */
    [data-gpm="item"].gpm-drag-over {
      outline: 2px solid #8ab4f8;
      outline-offset: -2px;
      background: rgba(138, 180, 248, 0.1);
    }

    /* ── Divider ── */
    [data-gpm="divider"] {
      height: 1px;
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
      margin: 4px 16px;
    }
    
    /* ── Drag reorder indicators (UX-003) ── */
    [data-gpm="item"].gpm-drag-top {
      border-top: 2px solid #8ab4f8;
      margin-top: -1px;
    }

    [data-gpm="item"].gpm-drag-bottom {
      border-bottom: 2px solid #8ab4f8;
      margin-bottom: -1px;
    }

    [data-gpm="chat"].gpm-drag-top {
      border-top: 2px solid #8ab4f8;
      margin-top: -1px;
    }

    [data-gpm="chat"].gpm-drag-bottom {
      border-bottom: 2px solid #8ab4f8;
      margin-bottom: -1px;
    }

    /* ── Native chat drag handle ── */
    [data-gpm-enhanced] {
      display: flex !important;
      align-items: center !important;
    }

    /* ── Search input ── */
    [data-gpm="search-wrap"] {
      padding: 4px 16px 8px;
    }

    [data-gpm="search-wrap"].gpm-hidden {
      display: none;
    }

    [data-gpm="search"] {
      width: 100%;
      padding: 6px 12px;
      border: 1px solid var(--gm-colorsurface-container-high, rgba(255,255,255,0.12));
      border-radius: 20px;
      background: transparent;
      color: inherit;
      font-family: "Google Sans", "Helvetica Neue", sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 150ms ease;
    }

    [data-gpm="search"]:focus {
      border-color: #8ab4f8;
    }

    [data-gpm="search"]::placeholder {
      color: var(--gm-colorsurface-variant, #9aa0a6);
      opacity: 0.7;
    }

    /* ── Focus visible (keyboard navigation — sidebar items) ── */
    [data-gpm="item"]:focus-visible,
    [data-gpm="chat"]:focus-visible,
    [data-gpm="header"]:focus-visible {
      outline: 2px solid #8ab4f8;
      outline-offset: -2px;
      border-radius: 0 24px 24px 0;
    }

    /* ── Search highlight (matched text) ── */
    [data-gpm] mark.gpm-highlight {
      background: rgba(138, 180, 248, 0.3);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }

    /* ── Search clear button ── */
    [data-gpm="search-clear"] {
      position: absolute;
      right: 24px;
      top: 10px;
      background: none;
      border: none;
      cursor: pointer;
      color: inherit;
      opacity: 0.5;
      font-size: 12px;
      padding: 2px 4px;
      line-height: 1;
      transition: opacity 150ms;
    }

    [data-gpm="search-clear"]:hover {
      opacity: 1;
    }

    /* ── Search result count ── */
    [data-gpm="search-count"] {
      font-size: 11px;
      opacity: 0.5;
      padding: 2px 16px 0;
    }

    /* ── Match source badge ── */
    .gpm-match-badge {
      font-size: 10px;
      opacity: 0.6;
      margin-left: 4px;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

// ══════════════════════════════════════
//  CREATE MODAL HOST (Shadow DOM — only for modals/overlays)
// ══════════════════════════════════════

function gpmCreateModalHost() {
  const existing = document.getElementById('gpm-modal-host');
  if (existing) {
    GPM_STATE.modalHost = existing;
    GPM_STATE.modalRoot = existing.shadowRoot;
    return;
  }
  if (GPM_STATE.modalHost) return;
  GPM_STATE.modalHost = document.createElement('div');
  GPM_STATE.modalHost.id = 'gpm-modal-host';
  GPM_STATE.modalHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:99999;pointer-events:none;';
  GPM_STATE.modalRoot = GPM_STATE.modalHost.attachShadow({ mode: 'open' });

  // Load styles for modals
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/styles.css');
    GPM_STATE.modalRoot.appendChild(link);
  } catch (e) {
    // Fallback: inject styles inline if extension context is invalidated
    gpmWarn('Could not load styles.css via runtime URL, using inline fallback');
  }

  document.body.appendChild(GPM_STATE.modalHost);
}

// ══════════════════════════════════════
//  FIND INSERTION POINT IN SIDEBAR
// ══════════════════════════════════════

/**
 * Find where to insert the Projects section.
 *
 * APPROACH: Scan ALL text nodes in the sidebar for "Chats" / "Sohbetler".
 * When found, walk up to the nearest block-level element and insert before it.
 * This is the most reliable method because:
 *   - It doesn't depend on DOM depth or structure
 *   - "Chats" is always visible as a section header in the sidebar
 *   - Works regardless of how deeply nested the text is
 */
function gpmFindInsertionPoint(sidebar) {
  // Strategy 1: Find chat-history container and insert before it (after Gems)
  const chatHistory = sidebar.querySelector('.chat-history');
  if (chatHistory && chatHistory.parentElement) {
    gpmLog('Found .chat-history, inserting before it (after Gems)');
    return { parent: chatHistory.parentElement, before: chatHistory };
  }

  // Strategy 2: Find gems-list-container and insert after it
  const gemsList = sidebar.querySelector('.gems-list-container');
  if (gemsList && gemsList.nextElementSibling) {
    gpmLog('Found .gems-list-container, inserting after it');
    return { parent: gemsList.parentElement, before: gemsList.nextElementSibling };
  }

  // Strategy 3: Find "Chats" / "Sohbetler" text node and insert before its section
  const targetTexts = ['chats', 'sohbetler', 'recent', 'recents'];
  const walker = document.createTreeWalker(sidebar, NodeFilter.SHOW_TEXT, null);
  let textNode;

  while ((textNode = walker.nextNode())) {
    const txt = textNode.textContent?.trim().toLowerCase();
    if (targetTexts.includes(txt)) {
      let el = textNode.parentElement;
      gpmLog('Found "Chats" text in:', el.tagName, el.className?.slice(0, 60));

      let insertTarget = el;
      let depth = 0;
      while (el && el !== sidebar && depth < 20) {
        const parent = el.parentElement;
        if (!parent || parent === sidebar) {
          insertTarget = el;
          break;
        }
        if (parent.children.length >= 2) {
          const siblingTexts = Array.from(parent.children).map((c) => c.textContent?.trim().slice(0, 20));
          if (new Set(siblingTexts).size >= 2) {
            insertTarget = el;
            break;
          }
        }
        el = parent;
        insertTarget = el;
        depth++;
      }

      const resolvedParent = insertTarget.parentElement || sidebar;
      if (insertTarget.parentElement === resolvedParent) {
        return { parent: resolvedParent, before: insertTarget };
      }
      return { parent: sidebar, before: null };
    }
  }

  // Strategy 4: Find "Gems" / "Gem'ler" text and insert after its section container
  const gemTexts = ['gems', "gem'ler"];
  const walker2 = document.createTreeWalker(sidebar, NodeFilter.SHOW_TEXT, null);
  while ((textNode = walker2.nextNode())) {
    const txt = textNode.textContent?.trim().toLowerCase();
    if (gemTexts.includes(txt)) {
      let el = textNode.parentElement;
      // Walk up to find the section-level container (gems-list-container or similar)
      for (let i = 0; i < 10; i++) {
        if (!el || !el.parentElement) break;
        if (el.parentElement.children.length >= 3) {
          // Found the multi-sibling parent, insert after this element
          const next = el.nextElementSibling;
          gpmLog('Found Gems section, inserting after it');
          return { parent: el.parentElement, before: next || null };
        }
        el = el.parentElement;
      }
    }
  }

  // Strategy 5: Use first chat link
  const firstChat = sidebar.querySelector('a[href^="/app/"]');
  if (firstChat) {
    let el = firstChat;
    while (el.parentElement && el.parentElement !== sidebar) el = el.parentElement;
    gpmLog('Fallback: inserting before chat container');
    return { parent: el.parentElement || sidebar, before: el };
  }

  // Strategy 6: Append before last child
  if (sidebar.lastElementChild) {
    gpmLog('Last resort: inserting before last child of sidebar');
    return { parent: sidebar, before: sidebar.lastElementChild };
  }

  return { parent: sidebar, before: null };
}

// ══════════════════════════════════════
//  INJECT PROJECT SECTION
// ══════════════════════════════════════

function gpmInjectProjectSection(_sidebar) {
  // ── Global duplicate guard ──
  const oldRoots = document.querySelectorAll('[data-gpm="root"]');
  oldRoots.forEach((el) => el.remove());
  if (GPM_STATE.container && GPM_STATE.container.isConnected) {
    GPM_STATE.container.remove();
  }
  GPM_STATE.container = null;

  // ── Discover sidebar from chat links (most reliable on new Gemini layout) ──
  // We do NOT trust the _sidebar parameter because it may be a main-content
  // wrapper matched by the broad CSS selector. Instead we climb from the
  // first chat link up to the real sidebar container.
  let sidebar = null;
  let listContainer = null;

  const chatLink = document.querySelector('a[href^="/app/"]');
  if (chatLink) {
    listContainer = chatLink.parentElement;
    for (let i = 0; i < 10; i++) {
      if (!listContainer || listContainer === document.body) break;
      if (listContainer.children.length >= 2) break;
      listContainer = listContainer.parentElement;
    }
    sidebar = listContainer && listContainer !== document.body ? listContainer.parentElement : null;
    if (sidebar && sidebar !== document.body) {
      gpmLog('Sidebar discovered from chat link:', sidebar.tagName, sidebar.className?.slice(0, 50));
    } else {
      sidebar = null;
    }
  }

  if (!sidebar) {
    gpmWarn('gpmInjectProjectSection: no chat links in DOM yet, aborting');
    return;
  }

  GPM_STATE.container = document.createElement('div');
  GPM_STATE.container.setAttribute('data-gpm', 'root');
  GPM_STATE.container.id = 'gpm-project-section';

  try {
    if (listContainer && listContainer.parentElement === sidebar) {
      sidebar.insertBefore(GPM_STATE.container, listContainer);
    } else {
      sidebar.insertBefore(GPM_STATE.container, sidebar.firstChild);
    }
  } catch (e) {
    gpmWarn('insertBefore failed, using appendChild fallback:', e.message);
    try {
      sidebar.appendChild(GPM_STATE.container);
    } catch (_) {}
  }

  gpmRenderTree();
}

// ══════════════════════════════════════
//  SIDEBAR CONTENT DETECTION
// ══════════════════════════════════════

/**
 * Wait until the sidebar has meaningful content (chat links or "Chats" text).
 */
function gpmWaitForSidebarContent(sidebar, timeout = 10000) {
  return new Promise((resolve) => {
    // Check immediately
    if (gpmSidebarHasContent(sidebar)) return resolve(true);

    const observer = new MutationObserver(() => {
      if (gpmSidebarHasContent(sidebar)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(sidebar, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeout);
  });
}

function gpmSidebarHasContent(sidebar) {
  // Check for chat links — Gemini uses /app/<id> format
  if (sidebar.querySelector('a[href^="/app/"]')) return true;
  // Legacy formats
  if (sidebar.querySelector('a[href*="/chat/"], a[href*="/c/"]')) return true;
  // Check for "Chats" text in all 10 supported languages
  const chatLabels = [
    'Chats', // en, fr, pt
    'Sohbetler', // tr
    'Chat', // de, it
    'Чаты', // ru
    'チャット', // ja
    '聊天', // zh
    'Conversaciones', // es
    'चैट्स', // hi
    '대화', // ko
    'المحادثات', // ar
    'Cuộc trò chuyện', // vi
    'Obrolan', // id
    'แชท', // th
    'চ্যাটস', // bn
  ];
  const sidebarText = sidebar.textContent || '';
  if (chatLabels.some((label) => sidebarText.includes(label))) return true;
  // Check for Gems section (sidebar loaded even if no chats exist)
  if (sidebar.querySelector('.gems-list-container')) return true;
  if (sidebar.querySelector('.chat-history')) return true;
  const gemLabels = [
    'Gems',
    "Gem'ler",
    'Gemmes',
    'Gemas',
    'ジェム',
    '宝石',
    'जेम्स',
    '젬',
    'الأحجار',
    'Gem',
    'เจม',
    'জেমস',
  ];
  if (gemLabels.some((label) => sidebarText.includes(label))) return true;
  // Check for "My stuff" / "Öğelerim" section
  if (sidebar.querySelector('.side-nav-entry-container')) return true;
  return false;
}

let _sidebarPresenceObserver = null;
let _reinitInProgress = false;

function gpmObserveForSidebar() {
  if (_sidebarPresenceObserver) return;
  if (typeof document === 'undefined' || !document.body) return;

  _sidebarPresenceObserver = new MutationObserver(() => {
    if (typeof document === 'undefined') {
      _sidebarPresenceObserver?.disconnect();
      _sidebarPresenceObserver = null;
      return;
    }

    const sidebar = document.querySelector('a[href^="/app/"]');
    if (sidebar && !GPM_STATE.initialized) {
      _sidebarPresenceObserver.disconnect();
      _sidebarPresenceObserver = null;
      try {
        gpmInit();
      } catch (e) {
        gpmWarn('Sidebar observer gpmInit() failed:', e);
        // Re-attach observer so we can retry later
        gpmObserveForSidebar();
      }
    }
  });
  _sidebarPresenceObserver.observe(document.body, { childList: true, subtree: true });
}

// ══════════════════════════════════════
//  DOM HEALTH MONITOR (Self-Healing)
// ══════════════════════════════════════

/**
 * Start a periodic health check that detects when GPM's injected elements
 * have been removed from the DOM (e.g., Gemini re-mounts its sidebar).
 * When detected, it resets state and re-initializes GPM.
 */
function gpmStartHealthMonitor() {
  // Don't start multiple monitors
  if (GPM_STATE.healthCheckTimer) return;

  GPM_STATE.healthCheckTimer = setInterval(() => {
    if (!gpmIsContextValid()) {
      gpmStopHealthMonitor();
      return;
    }

    // Skip checks if not yet initialized
    if (!GPM_STATE.initialized) return;

    // ── Check 1: Is our container still in the DOM? ──
    const containerInDOM = GPM_STATE.container && GPM_STATE.container.isConnected;

    // ── Check 2: Is our modal host still in the DOM? ──
    const modalHostInDOM = GPM_STATE.modalHost && GPM_STATE.modalHost.isConnected;

    // ── Check 3: Does the sidebar still exist? ──
    const sidebarExists = !!document.querySelector('a[href^="/app/"]');

    if (!containerInDOM || !modalHostInDOM) {
      gpmLog(
        'Health check: DOM element missing — container:',
        containerInDOM,
        'modalHost:',
        modalHostInDOM,
        'sidebar:',
        sidebarExists
      );

      if (sidebarExists) {
        // Sidebar exists but our elements are gone → Gemini re-mounted
        gpmScheduleReinit('container or modalHost removed but sidebar exists');
      } else {
        // Sidebar itself is gone → might be navigating, wait for it
        gpmLog('Health check: Sidebar not found, waiting for re-appearance');
        gpmStopHealthMonitor();
        if (typeof gpmCleanupObservers === 'function') gpmCleanupObservers();
        GPM_STATE.initialized = false;
        gpmObserveForSidebar();
      }
    } else {
      // Everything healthy — reset failure counter
      GPM_STATE.reinitFailCount = 0;

      // ── Check 4: Is Quick Prompt button still present? ──
      // (lightweight — doesn't trigger full reinit, just re-injects the button)
      const qpBtn = document.querySelector('#gpm-qp-trigger');
      if (!qpBtn || !qpBtn.isConnected) {
        gpmLog('Health check: QP button missing, re-injecting');
        if (typeof gpmInjectQuickPromptTrigger === 'function') {
          gpmInjectQuickPromptTrigger();
        }
      }
    }
  }, GPM_CONFIG.HEALTH_CHECK_INTERVAL);

  gpmLog('DOM health monitor started (interval:', GPM_CONFIG.HEALTH_CHECK_INTERVAL, 'ms)');
}

/**
 * Stop the health monitor (when extension context is invalidated).
 */
function gpmStopHealthMonitor() {
  if (GPM_STATE.healthCheckTimer) {
    clearInterval(GPM_STATE.healthCheckTimer);
    GPM_STATE.healthCheckTimer = null;
    gpmLog('DOM health monitor stopped');
  }
  if (_sidebarPresenceObserver) {
    _sidebarPresenceObserver.disconnect();
    _sidebarPresenceObserver = null;
  }
}

/**
 * Schedule a debounced re-initialization of GPM.
 * Prevents rapid re-init cycles when Gemini is actively re-rendering.
 * @param {string} reason — Why re-init was triggered (for logging)
 */
function gpmScheduleReinit(reason) {
  if (GPM_STATE.reinitFailCount >= GPM_CONFIG.MAX_REINIT_FAILURES) {
    gpmWarn(
      'Re-init backed off after',
      GPM_STATE.reinitFailCount,
      'consecutive failures. Waiting for sidebar observer.'
    );
    GPM_STATE.initialized = false;
    gpmObserveForSidebar();
    return;
  }

  if (GPM_STATE.reinitDebounceTimer || _reinitInProgress) return;

  gpmLog('Scheduling re-initialization:', reason);
  GPM_STATE.reinitDebounceTimer = setTimeout(() => {
    GPM_STATE.reinitDebounceTimer = null;

    if (!gpmIsContextValid()) return;

    gpmLog('Executing re-initialization (attempt', GPM_STATE.reinitFailCount + 1, ')');
    _reinitInProgress = true;
    GPM_STATE.reinitFailCount++;

    gpmResetState();

    gpmInit()
      .catch((err) => {
        gpmError('Re-initialization failed:', err);
      })
      .finally(() => {
        _reinitInProgress = false;
      });
  }, GPM_CONFIG.REINIT_DEBOUNCE);
}
