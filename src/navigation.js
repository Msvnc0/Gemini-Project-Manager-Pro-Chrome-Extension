/**
 * navigation.js — SPA Navigation, Chat Observer, Native Chat Enhancement
 *
 * Handles:
 *   - gpmTriggerNewChat()         — Navigate to new chat page
 *   - gpmNavigateToChat()        — Navigate to a specific chat
 *   - gpmGetCurrentChatId()      — Get current chat ID from URL
 *   - gpmObserveSPANavigation()  — Detect URL changes in SPA
 *   - gpmOnNavigate()            — Handle navigation events
 *   - gpmObserveNewChats()       — Unified polling + chat observer
 *   - gpmEnhanceNativeChatItems() — Make native chat items draggable
 *   - gpmDetectDeletedChats()    — Detect chats deleted from Gemini's native sidebar
 *
 * Dependencies (globals from earlier scripts):
 *   - GPM_CONFIG, GPM_STATE, gpmLog, gpmWarn, gpmError, gpmIsContextValid, extractChatIdFromUrl (config.js)
 *   - GPM_SELECTORS (selectors.js)
 *   - GPMStorage (storage.js)
 *   - gpmRenderTree(), gpmShowChatContextMenu() (project-tree.js)
 *   - gpmInjectProjectSection() (dom-injection.js)
 *   - gpmInjectQuickPromptTrigger() (quick-prompts.js)
 */

// ══════════════════════════════════════
//  GEMINI INTERACTION HELPERS
// ══════════════════════════════════════

function gpmNavigateToUrl(url) {
  try {
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    if (isJsdom) {
      const target = new URL(url, window.location.origin);
      history.replaceState(null, '', target.pathname + target.search + target.hash);
      return;
    }
    window.location.href = url;
  } catch (e) {
    gpmWarn('Navigation fallback failed:', e.message);
  }
}

function gpmTriggerNewChat() {
  gpmLog('Triggering new chat...');

  const currentPath = window.location.pathname;
  const isOnHome = currentPath === '/app' || currentPath === '/app/' || currentPath === '/';

  if (isOnHome) {
    // Already on home page — just focus the input area so user can start typing
    // The pending assignment will fire when URL changes to /app/<id> after sending
    gpmLog('Already on home, focusing input. Pending assignment will trigger on URL change.');
    const input = document.querySelector(GPM_SELECTORS.inputArea);
    if (input) input.focus();
    return;
  }

  // Not on home — need to navigate there
  // Try clicking the "New chat" link first (SPA navigation)
  const candidates = document.querySelectorAll('a[href="/app"]');
  let clicked = false;

  for (const el of candidates) {
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const text = (el.textContent || '').trim().toLowerCase();
    const newChatLabels = [
      'new chat',
      'yeni sohbet',
      'neuer chat',
      'nouvelle conversation',
      'nueva conversación',
      'nuova chat',
      'novo chat',
      'новый чат',
      '新しいチャット',
      '新建聊天',
      '새 채팅',
      'नई चैट',
      'محادثة جديدة',
      'cuộc trò chuyện mới',
      'obrolan baru',
      'แชทใหม่',
      'নতুন চ্যাট',
    ];
    const textLower = text;
    const ariaLower = ariaLabel;
    if (newChatLabels.some((label) => textLower.includes(label) || ariaLower.includes(label))) {
      gpmLog('Clicking "New chat" link');
      el.click();
      clicked = true;
      break;
    }
  }

  if (!clicked && candidates.length > 0) {
    candidates[0].click();
    clicked = true;
  }

  if (!clicked) {
    gpmLog('Fallback: navigating to /app');
    gpmNavigateToUrl('https://gemini.google.com/app');
  }
}

function gpmNavigateToChat(chatId) {
  // Try clicking the sidebar link first
  const links = document.querySelectorAll(GPM_SELECTORS.chatItem);
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes(chatId)) {
      link.click();
      return;
    }
  }
  // Fallback: direct navigation using /app/<id> format
  gpmNavigateToUrl(`https://gemini.google.com/app/${chatId}`);
}

function gpmGetCurrentChatId() {
  // Gemini uses /app/<id> format for chats
  // /app alone = home page (no chat), /app/<id> = specific chat
  return extractChatIdFromUrl(window.location.pathname);
}

// ══════════════════════════════════════
//  SPA NAVIGATION OBSERVER
// ══════════════════════════════════════

let _spaObserver = null;
let _spaCheckFn = null;
let _sidebarObserver = null;
let _newChatsObserver = null;
let _newChatsPollInterval = null;
let _visibilityHandler = null;
let _pollLastChatId = null;
let _pollLastUrl = null;

function gpmObserveSPANavigation() {
  if (_spaObserver) return;

  let lastUrl = location.href;
  _spaCheckFn = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      gpmOnNavigate();
    }
  };

  _spaObserver = new MutationObserver(_spaCheckFn);
  _spaObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', _spaCheckFn);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...a) {
    origPush.apply(this, a);
    _spaCheckFn();
  };
  history.replaceState = function (...a) {
    origReplace.apply(this, a);
    _spaCheckFn();
  };

  GPM_STATE._origPushState = origPush;
  GPM_STATE._origReplaceState = origReplace;
}

function gpmCleanupObservers() {
  if (_spaObserver) {
    _spaObserver.disconnect();
    _spaObserver = null;
  }
  if (_spaCheckFn) {
    window.removeEventListener('popstate', _spaCheckFn);
    _spaCheckFn = null;
  }
  if (_sidebarObserver) {
    _sidebarObserver.disconnect();
    _sidebarObserver = null;
  }
  if (_newChatsObserver) {
    _newChatsObserver.disconnect();
    _newChatsObserver = null;
  }
  if (GPM_STATE._origPushState) {
    history.pushState = GPM_STATE._origPushState;
    delete GPM_STATE._origPushState;
  }
  if (GPM_STATE._origReplaceState) {
    history.replaceState = GPM_STATE._origReplaceState;
    delete GPM_STATE._origReplaceState;
  }
  gpmStopPolling();
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
  clearTimeout(GPM_STATE._deletionCheckTimer);
  clearInterval(GPM_STATE._sidebarStabilizeTimer);
  _pollLastChatId = null;
  _pollLastUrl = null;
}

function gpmOnNavigate() {
  setTimeout(() => {
    if (!gpmIsContextValid()) return;
    if (!document.querySelector('#gpm-project-section')) {
      gpmInjectProjectSection();
    }
    gpmInjectQuickPromptTrigger();
  }, GPM_CONFIG.NAV_DELAY);
}

// ══════════════════════════════════════
//  DELETED CHAT DETECTION
// ══════════════════════════════════════

function _gpmGetSidebarChatCount() {
  // Direct document count — sidebar container discovery is fragile on the new Gemini UI.
  // We count all /app/ links on the page; false positives are harmless because stabilization
  // only cares about the *count* trending to a stable value.
  const links = document.querySelectorAll('a[href^="/app/"]');
  let count = 0;
  for (let i = 0; i < links.length; i++) {
    if (extractChatIdFromUrl(links[i].getAttribute('href') || '')) {
      count++;
    }
  }
  return count;
}

function _gpmWaitForSidebarStabilize() {
  if (GPM_STATE._sidebarStabilized) return;

  clearInterval(GPM_STATE._sidebarStabilizeTimer);
  GPM_STATE._sidebarStableCount = 0;
  GPM_STATE._lastSidebarChatCount = 0;

  GPM_STATE._sidebarStabilizeTimer = setInterval(() => {
    if (!gpmIsContextValid()) {
      clearInterval(GPM_STATE._sidebarStabilizeTimer);
      return;
    }

    const count = _gpmGetSidebarChatCount();

    if (count === 0) {
      GPM_STATE._sidebarStableCount = 0;
      GPM_STATE._lastSidebarChatCount = 0;
      return;
    }

    if (count === GPM_STATE._lastSidebarChatCount) {
      GPM_STATE._sidebarStableCount++;
    } else {
      GPM_STATE._sidebarStableCount = 0;
    }
    GPM_STATE._lastSidebarChatCount = count;

    if (GPM_STATE._sidebarStableCount >= GPM_CONFIG.SIDEBAR_STABILIZE_REQUIRED) {
      clearInterval(GPM_STATE._sidebarStabilizeTimer);
      GPM_STATE._sidebarStabilized = true;
      gpmLog('Sidebar stabilized with', count, 'chat(s), enabling deletion detection');
    }
  }, GPM_CONFIG.SIDEBAR_STABILIZE_INTERVAL);
}

/**
 * Detect chats that have been deleted from Gemini's native sidebar and
 * remove them from GPM's storage (projects.chatIds + chatMap).
 *
 * Strategy:
 *   0. Wait for sidebar chat count to stabilize (lazy-load protection)
 *   1. Collect all chat IDs currently visible in the sidebar DOM
 *   2. Compare against all chat IDs stored in GPM's projects
 *   3. If a stored chat ID is missing from the DOM, it may be deleted
 *   4. Use a multi-phase verification: first mutation marks candidates,
 *      debounced check verifies they're still missing after stabilization
 *
 * This avoids false positives from Gemini lazy-loading or DOM recycling.
 */
// ══════════════════════════════════════
//  DELETED CHAT DETECTION (Simple & Robust)
// ══════════════════════════════════════

/**
 * Extract ALL chat IDs currently visible anywhere on the page.
 * This bypasses sidebar selector fragility completely.
 */
function _gpmGetAllPageChatIds() {
  const ids = new Set();
  const links = document.querySelectorAll('a[href^="/app/"]');
  for (const link of links) {
    const cid = extractChatIdFromUrl(link.getAttribute('href') || '');
    if (cid) ids.add(cid);
  }
  return ids;
}

/**
 * Core deletion logic — no stabilization, no phases, no sidebar selector.
 * Simply: if a stored chat ID is not on the page, remove it.
 * Guard: only act when page has at least as many chats as stored (lazy-load safety).
 */
async function _gpmRunDeletionCheckCore() {
  if (!gpmIsContextValid()) return;

  const domChatIds = _gpmGetAllPageChatIds();
  if (domChatIds.size === 0) return; // Page not ready

  const projects = await GPMStorage.getProjects();
  const chatMap = await GPMStorage.getChatMap();

  const storedChatIds = [];
  for (const p of projects) {
    for (const cid of p.chatIds || []) storedChatIds.push(cid);
  }
  if (storedChatIds.length === 0) return;

  // Lazy-load guard: if DOM has fewer chats than stored, sidebar may still be loading
  if (domChatIds.size < storedChatIds.length) {
    gpmLog(
      'Deletion check: DOM chat count (' + domChatIds.size + ') < stored (' + storedChatIds.length + '), deferring'
    );
    return;
  }

  const orphaned = storedChatIds.filter((cid) => !domChatIds.has(cid));
  if (orphaned.length === 0) return;

  gpmWarn('Deletion check: removing', orphaned.length, 'orphaned chat(s):', orphaned);

  const orphanedSet = new Set(orphaned);
  for (const p of projects) {
    p.chatIds = (p.chatIds || []).filter((cid) => !orphanedSet.has(cid));
  }
  for (const cid of orphaned) delete chatMap[cid];

  await GPMStorage.saveProjects(projects);
  await GPMStorage.saveChatMap(chatMap);
  gpmRenderTree();
}

/**
 * Legacy entry point — keeps backward compat with caller sites.
 * Immediately runs the core check (no stabilization wait).
 */
function gpmDetectDeletedChats() {
  Promise.resolve()
    .then(_gpmRunDeletionCheckCore)
    .catch((e) => gpmWarn('Deletion check error:', e));
}

// ══════════════════════════════════════
//  CLEANUP AFTER IMPORT (Post-import sync)
// ══════════════════════════════════════

/**
 * Clean up deleted chats after importing/restoring data.
 * Uses retry logic to wait for Gemini sidebar to load.
 *
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 1500)
 * @returns {Promise<number>} - Number of chats removed
 */
async function gpmCleanupAfterImport(maxRetries = 5, retryDelay = 3000) {
  if (!gpmIsContextValid()) return 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const sidebar =
      document.querySelector(GPM_SELECTORS.sidebar) ||
      (typeof _gpmStructuralDiscovery !== 'undefined' && _gpmStructuralDiscovery.sidebar
        ? _gpmStructuralDiscovery.sidebar()
        : null) ||
      (() => {
        const first = document.querySelector('a[href^="/app/"]');
        for (let n = first; n; n = n.parentElement) if (n.children.length >= 2) return n;
        return null;
      })();
    if (!sidebar) {
      gpmLog(`Cleanup attempt ${attempt}/${maxRetries}: Sidebar not found, waiting...`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      continue;
    }

    const sidebarLinks = sidebar.querySelectorAll('a[href^="/app/"]');
    const domChatIds = new Set();
    for (const link of sidebarLinks) {
      const href = link.getAttribute('href') || '';
      const cid = extractChatIdFromUrl(href);
      if (cid) domChatIds.add(cid);
    }

    if (domChatIds.size === 0) {
      gpmLog(`Cleanup attempt ${attempt}/${maxRetries}: No chat links in sidebar, waiting...`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      continue;
    }

    gpmLog(`Cleanup attempt ${attempt}/${maxRetries}: Found ${domChatIds.size} chats in sidebar`);

    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();

    const storedChatIds = new Set();
    for (const project of projects) {
      for (const cid of project.chatIds || []) {
        storedChatIds.add(cid);
      }
    }

    if (storedChatIds.size > 0 && domChatIds.size < storedChatIds.size * 0.5) {
      gpmLog(
        `Cleanup attempt ${attempt}/${maxRetries}: Sidebar likely incomplete (stored:`,
        storedChatIds.size,
        'dom:',
        domChatIds.size,
        '), waiting...'
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      continue;
    }

    const orphanedIds = [];
    for (const cid of storedChatIds) {
      if (!domChatIds.has(cid)) {
        orphanedIds.push(cid);
      }
    }

    if (orphanedIds.length === 0) {
      gpmLog('Cleanup: No orphaned chats found');
      return 0;
    }

    gpmLog('Cleanup: Found', orphanedIds.length, 'orphaned chat(s) to remove');

    // Remove orphaned chats from storage
    const orphanedSet = new Set(orphanedIds);
    for (const project of projects) {
      project.chatIds = (project.chatIds || []).filter((cid) => !orphanedSet.has(cid));
    }

    for (const cid of orphanedIds) {
      delete chatMap[cid];
    }

    await GPMStorage.saveProjects(projects);
    await GPMStorage.saveChatMap(chatMap);

    gpmLog('Cleanup: Removed', orphanedIds.length, 'deleted chat(s) from storage');
    return orphanedIds.length;
  }

  gpmLog('Cleanup: Max retries reached, sidebar may not be loaded');
  return 0;
}

// ══════════════════════════════════════
//  NEW CHAT OBSERVER (Unified Polling)
// ══════════════════════════════════════

function gpmPollCheck() {
  if (!gpmIsContextValid()) {
    gpmStopPolling();
    return;
  }

  const currentUrl = location.href;
  const id = gpmGetCurrentChatId();

  if (currentUrl !== _pollLastUrl) {
    _pollLastUrl = currentUrl;
    gpmLog('URL changed to:', currentUrl, 'chatId:', id);
  }

  if (id && id !== _pollLastChatId) {
    gpmLog('Chat ID changed:', _pollLastChatId, '->', id);
    _pollLastChatId = id;

    if (GPM_STATE.pendingChatAssignment) {
      const { projectId } = GPM_STATE.pendingChatAssignment;
      GPM_STATE.pendingChatAssignment = null;
      gpmLog('Auto-assigning chat', id, 'to project:', projectId);
      GPMStorage.assignChat(id, projectId)
        .then(() => {
          gpmLog('Chat assigned successfully');
          gpmRenderTree();
          const aliasRetryDelays = [2000, 5000, 10000];
          for (const delay of aliasRetryDelays) {
            setTimeout(() => {
              if (gpmIsContextValid()) gpmScheduleAliasResolve();
            }, delay);
          }
        })
        .catch((err) => gpmError('Auto-assign failed:', err));
    } else {
      gpmRenderTree();
    }
  }

  if (!id && _pollLastChatId) {
    _pollLastChatId = null;
    gpmLog('Navigated to home page (new chat pending:', !!GPM_STATE.pendingChatAssignment, ')');
  }

  if (GPM_STATE.pendingChatAssignment && GPM_STATE.pendingChatAssignment._ts) {
    if (Date.now() - GPM_STATE.pendingChatAssignment._ts > GPM_CONFIG.ASSIGNMENT_TIMEOUT) {
      gpmWarn('Pending assignment timed out');
      GPM_STATE.pendingChatAssignment = null;
    }
  }
}

function gpmStartPolling() {
  if (_newChatsPollInterval) return;
  _newChatsPollInterval = setInterval(gpmPollCheck, GPM_CONFIG.POLL_INTERVAL);
}

function gpmStopPolling() {
  if (_newChatsPollInterval) {
    clearInterval(_newChatsPollInterval);
    _newChatsPollInterval = null;
  }
}

function gpmObserveNewChats() {
  _pollLastChatId = gpmGetCurrentChatId();
  _pollLastUrl = location.href;

  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }

  _visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      gpmStartPolling();
      GPM_STATE._sidebarStabilized = false;
      GPM_STATE._sidebarStableCount = 0;
      GPM_STATE._lastSidebarChatCount = 0;
      _gpmWaitForSidebarStabilize();
      gpmRenderTree();
    } else {
      gpmStopPolling();
    }
  };
  document.addEventListener('visibilitychange', _visibilityHandler);

  if (document.visibilityState === 'visible') {
    gpmStartPolling();
    _gpmWaitForSidebarStabilize();
  }

  const sidebar =
    document.querySelector(GPM_SELECTORS.sidebar) ||
    _gpmStructuralDiscovery.sidebar() ||
    (() => {
      const first = document.querySelector('a[href^="/app/"]');
      for (let n = first; n; n = n.parentElement) if (n.children.length >= 2) return n;
      return null;
    })();
  if (sidebar) {
    let enhanceTimeout = null;

    _newChatsObserver = new MutationObserver((mutations) => {
      const hasNonGPMRemovals = mutations.some((m) => {
        for (const node of m.removedNodes) {
          if (node.nodeType === 1) {
            if (node.dataset && node.dataset.gpm) continue;
            if (node.closest && node.closest('[data-gpm]')) continue;
            // Chat link veya içerdiği bir element mi?
            if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('/app/')) return true;
            if (node.querySelector && node.querySelector('a[href^="/app/"]')) return true;
          }
        }
        return false;
      });

      const hasRelevantAdditions = mutations.some((m) => {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.dataset && node.dataset.gpm) continue;
            if (node.closest && node.closest('[data-gpm]')) continue;
            if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('/app/')) return true;
            if (node.querySelector && node.querySelector('a[href^="/app/"]')) return true;
          }
        }
        return false;
      });

      if (hasRelevantAdditions) {
        clearTimeout(enhanceTimeout);
        enhanceTimeout = setTimeout(() => {
          gpmEnhanceNativeChatItems();
        }, GPM_CONFIG.ENHANCE_DEBOUNCE);
        gpmScheduleAliasResolve();
      }

      if (hasNonGPMRemovals) {
        gpmDetectDeletedChats();
      }
    });
    _newChatsObserver.observe(sidebar, { childList: true, subtree: true });
    gpmEnhanceNativeChatItems();
  }
}

// ══════════════════════════════════════
//  ENHANCE NATIVE CHAT ITEMS (Drag & Drop)
// ══════════════════════════════════════

function gpmExtractChatTitle(el) {
  let title = '';
  const ariaLabel = (el.getAttribute('aria-label') || '').trim();
  if (ariaLabel && ariaLabel.length > 1 && !ariaLabel.startsWith('http')) title = ariaLabel;
  if (!title) {
    const tAttr = (el.getAttribute('title') || '').trim();
    if (tAttr && tAttr.length > 1) title = tAttr;
  }
  if (!title) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let node;
    const texts = [];
    while ((node = walker.nextNode())) {
      const txt = node.textContent?.trim();
      if (txt && txt.length > 2 && !/^\d+$/.test(txt) && !/^[\W_]+$/.test(txt)) texts.push(txt);
    }
    if (texts.length > 0) {
      texts.sort((a, b) => b.length - a.length);
      title = texts[0];
    }
  }
  if (!title) title = (el.textContent || '').trim();
  const GARBAGE = ['new chat', 'yeni sohbet', 'nouveau chat', 'neuer chat', 'nuova conversazione', 'nova conversa'];
  if (GARBAGE.some((g) => title.toLowerCase().startsWith(g))) title = t('newChat') || 'New chat';
  return title;
}

function gpmEnhanceNativeChatItems() {
  // Abort previous listeners to prevent memory leaks from DOM node recycling
  if (GPM_STATE.enhanceAbortController) {
    GPM_STATE.enhanceAbortController.abort();
  }
  GPM_STATE.enhanceAbortController = new AbortController();
  const { signal } = GPM_STATE.enhanceAbortController;

  // Clear previous enhancement markers (nodes may have been recycled)
  document.querySelectorAll('[data-gpm-enhanced]').forEach((el) => {
    if (!el.closest('[data-gpm]')) delete el.dataset.gpmEnhanced;
  });

  // Gemini uses /app/<id> format — find all chat links (exclude /app itself which is "New chat")
  const chatItems = document.querySelectorAll('a[href^="/app/"]');

  chatItems.forEach((item) => {
    // Skip items inside our own GPM container
    if (item.closest('[data-gpm]')) return;

    item.dataset.gpmEnhanced = 'true';

    const href = item.getAttribute('href') || '';
    const chatId = extractChatIdFromUrl(href);
    if (!chatId) return;

    // Make the whole <a> draggable
    item.draggable = true;

    item.addEventListener(
      'dragstart',
      (e) => {
        e.stopPropagation();
        const liveTitle = gpmExtractChatTitle(item);
        gpmLog('Drag started for chat:', chatId, 'title:', liveTitle);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/gpm-chat-id', chatId);
        e.dataTransfer.setData('text/gpm-chat-title', liveTitle);
        e.dataTransfer.setData('text/plain', chatId);
        item.style.opacity = '0.5';
      },
      { signal }
    );

    item.addEventListener(
      'dragend',
      () => {
        item.style.opacity = '';
      },
      { signal }
    );

    // Custom right-click context menu
    item.addEventListener(
      'contextmenu',
      async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!GPM_STATE.modalRoot) return;

        const projects = await GPMStorage.getProjects();
        const chatMap = await GPMStorage.getChatMap();
        gpmShowChatContextMenu(e.clientX, e.clientY, chatId, chatMap[chatId], projects);
      },
      { signal }
    );
  });
}
