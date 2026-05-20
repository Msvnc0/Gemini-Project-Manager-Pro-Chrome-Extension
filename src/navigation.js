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
function gpmDetectDeletedChats() {
  if (!GPM_STATE._sidebarStabilized) {
    _gpmWaitForSidebarStabilize();
    gpmLog('Deletion check: Sidebar not yet stabilized, deferring check');
    return;
  }

  clearTimeout(GPM_STATE._deletionCheckTimer);
  GPM_STATE._deletionCheckTimer = setTimeout(async () => {
    if (!gpmIsContextValid()) return;

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
    if (!sidebar) return;

    const sidebarLinks = sidebar.querySelectorAll('a[href^="/app/"]');
    const domChatIds = new Set();
    for (const link of sidebarLinks) {
      const href = link.getAttribute('href') || '';
      const cid = extractChatIdFromUrl(href);
      if (cid) domChatIds.add(cid);
    }

    if (domChatIds.size === 0) {
      gpmLog('Deletion check: No chat links in sidebar, skipping (may be loading)');
      GPM_STATE._deletionPhaseCount = 0;
      GPM_STATE._pendingDeletedChatIds = null;
      GPM_STATE._sidebarStabilized = false;
      return;
    }

    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();

    const storedChatIds = new Set();
    for (const project of projects) {
      for (const cid of project.chatIds || []) {
        storedChatIds.add(cid);
      }
    }

    if (storedChatIds.size === 0) {
      GPM_STATE._deletionPhaseCount = 0;
      GPM_STATE._pendingDeletedChatIds = null;
      return;
    }

    if (domChatIds.size < storedChatIds.size) {
      gpmLog(
        'Deletion check: Sidebar not fully loaded (stored:',
        storedChatIds.size,
        'dom:',
        domChatIds.size,
        '), resetting stabilization'
      );
      GPM_STATE._deletionPhaseCount = 0;
      GPM_STATE._pendingDeletedChatIds = null;
      GPM_STATE._sidebarStabilized = false;
      return;
    }

    const orphanedIds = [];
    for (const cid of storedChatIds) {
      if (!domChatIds.has(cid)) {
        orphanedIds.push(cid);
      }
    }

    if (orphanedIds.length === 0) {
      GPM_STATE._deletionPhaseCount = 0;
      GPM_STATE._pendingDeletedChatIds = null;
      return;
    }

    GPM_STATE._deletionPhaseCount++;
    const currentPhase = GPM_STATE._deletionPhaseCount;
    const totalPhases = GPM_CONFIG.DELETION_CHECK_PHASES;

    if (!GPM_STATE._pendingDeletedChatIds) {
      GPM_STATE._pendingDeletedChatIds = new Set(orphanedIds);
    } else {
      const prev = GPM_STATE._pendingDeletedChatIds;
      GPM_STATE._pendingDeletedChatIds = new Set(orphanedIds.filter((cid) => prev.has(cid)));
    }

    gpmLog(
      'Deletion check: Phase',
      currentPhase,
      '/',
      totalPhases,
      '-',
      GPM_STATE._pendingDeletedChatIds.size,
      'candidates remaining'
    );

    if (currentPhase < totalPhases) {
      GPM_STATE._deletionCheckTimer = setTimeout(() => {
        gpmDetectDeletedChats();
      }, GPM_CONFIG.DELETION_CHECK_DEBOUNCE);
      return;
    }

    const confirmedDeleted = [...GPM_STATE._pendingDeletedChatIds];
    GPM_STATE._deletionPhaseCount = 0;
    GPM_STATE._pendingDeletedChatIds = null;

    if (confirmedDeleted.length === 0) {
      gpmLog('Deletion check: No confirmed deletions after all phases');
      return;
    }

    gpmLog('Deletion check: Confirmed deleted chats:', confirmedDeleted);

    if (confirmedDeleted.length >= 3) {
      const confirmed = await new Promise((resolve) => {
        if (!GPM_STATE.modalRoot) {
          resolve(true);
          return;
        }
        GPMUI.showConfirmDialog(GPM_STATE.modalRoot, {
          title: t('confirmDeletion') || 'Confirm Deletion',
          message: (
            t('deletedChatsConfirm') || '{count} chats appear to be deleted from Gemini. Remove them from folders?'
          ).replace('{count}', confirmedDeleted.length),
          confirmText: t('delete') || 'Delete',
          danger: true,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        gpmLog('Deletion cancelled by user');
        return;
      }
    }

    let storageUpdated = false;
    const confirmedSet = new Set(confirmedDeleted);

    for (const project of projects) {
      const before = (project.chatIds || []).length;
      project.chatIds = (project.chatIds || []).filter((cid) => !confirmedSet.has(cid));
      if (project.chatIds.length !== before) {
        storageUpdated = true;
      }
    }

    for (const cid of confirmedDeleted) {
      if (chatMap[cid]) {
        delete chatMap[cid];
        storageUpdated = true;
      }
    }

    if (storageUpdated) {
      await GPMStorage.saveProjects(projects);
      await GPMStorage.saveChatMap(chatMap);
      gpmLog('Deletion check: Removed', confirmedDeleted.length, 'deleted chat(s) from storage');
      gpmRenderTree();
    }
  }, GPM_CONFIG.DELETION_CHECK_DEBOUNCE);
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

  let sidebar =
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
      const relevant = mutations.some((m) => {
        const target = m.target;
        if (target.closest && target.closest('[data-gpm]')) return false;
        if (target.dataset && target.dataset.gpm) return false;
        return true;
      });
      if (!relevant) return;

      clearTimeout(enhanceTimeout);
      enhanceTimeout = setTimeout(() => {
        gpmEnhanceNativeChatItems();
      }, GPM_CONFIG.ENHANCE_DEBOUNCE);

      const hasRemovals = mutations.some((m) => m.removedNodes.length > 0);
      if (hasRemovals) {
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

    // Get the chat title from the link text
    const chatTitle = (item.textContent || '').trim();

    item.addEventListener(
      'dragstart',
      (e) => {
        e.stopPropagation();
        gpmLog('Drag started for chat:', chatId, 'title:', chatTitle);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/gpm-chat-id', chatId);
        e.dataTransfer.setData('text/gpm-chat-title', chatTitle);
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
