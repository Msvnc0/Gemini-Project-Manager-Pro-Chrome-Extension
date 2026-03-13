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
    if (text.includes('new chat') || text.includes('yeni sohbet') ||
      ariaLabel.includes('new chat') || ariaLabel.includes('yeni sohbet')) {
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
    window.location.href = 'https://gemini.google.com/app';
  }
}

function gpmNavigateToChat(chatId) {
  // Try clicking the sidebar link first
  const links = document.querySelectorAll(GPM_SELECTORS.chatItem);
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes(chatId)) { link.click(); return; }
  }
  // Fallback: direct navigation using /app/<id> format
  window.location.href = `https://gemini.google.com/app/${chatId}`;
}

function gpmGetCurrentChatId() {
  // Gemini uses /app/<id> format for chats
  // /app alone = home page (no chat), /app/<id> = specific chat
  return extractChatIdFromUrl(window.location.pathname);
}

// ══════════════════════════════════════
//  SPA NAVIGATION OBSERVER
// ══════════════════════════════════════

function gpmObserveSPANavigation() {
  let lastUrl = location.href;
  const check = () => {
    if (location.href !== lastUrl) { lastUrl = location.href; gpmOnNavigate(); }
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', check);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...a) { origPush.apply(this, a); check(); };
  history.replaceState = function (...a) { origReplace.apply(this, a); check(); };
}

function gpmOnNavigate() {
  setTimeout(() => {
    if (!gpmIsContextValid()) return;
    if (!document.querySelector('#gpm-project-section')) {
      const sidebar = document.querySelector(GPM_SELECTORS.sidebar);
      if (sidebar) gpmInjectProjectSection(sidebar);
    }
    gpmInjectQuickPromptTrigger();
  }, GPM_CONFIG.NAV_DELAY);
}

// ══════════════════════════════════════
//  NEW CHAT OBSERVER (Unified Polling)
// ══════════════════════════════════════

function gpmObserveNewChats() {
  let lastChatId = gpmGetCurrentChatId();
  let lastUrl = location.href;
  let pollIntervalId = null;

  // ── Unified polling function (replaces 3 separate setIntervals) ──
  function gpmPollCheck() {
    if (!gpmIsContextValid()) { gpmStopPolling(); return; }

    const currentUrl = location.href;
    const id = gpmGetCurrentChatId();

    // Detect URL change
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      gpmLog('URL changed to:', currentUrl, 'chatId:', id);
    }

    if (id && id !== lastChatId) {
      gpmLog('Chat ID changed:', lastChatId, '->', id);
      lastChatId = id;

      if (GPM_STATE.pendingChatAssignment) {
        const { projectId } = GPM_STATE.pendingChatAssignment;
        GPM_STATE.pendingChatAssignment = null;
        gpmLog('Auto-assigning chat', id, 'to project:', projectId);
        GPMStorage.assignChat(id, projectId).then(() => {
          gpmLog('Chat assigned successfully');
          gpmRenderTree();
          // Retry alias resolution after delays to catch Gemini title update
          setTimeout(() => { if (gpmIsContextValid()) gpmScheduleAliasResolve(); }, 2000);
          setTimeout(() => { if (gpmIsContextValid()) gpmScheduleAliasResolve(); }, 5000);
          setTimeout(() => { if (gpmIsContextValid()) gpmScheduleAliasResolve(); }, 10000);
        });
      } else {
        // Re-render to update active chat highlight
        gpmRenderTree();
      }
    }

    // Also detect when we navigate AWAY from a chat (to home/app page)
    if (!id && lastChatId) {
      lastChatId = null;
      gpmLog('Navigated to home page (new chat pending:', !!GPM_STATE.pendingChatAssignment, ')');
    }

    // Pending assignment timeout check (was a separate 5s setInterval)
    if (GPM_STATE.pendingChatAssignment && GPM_STATE.pendingChatAssignment._ts) {
      if (Date.now() - GPM_STATE.pendingChatAssignment._ts > GPM_CONFIG.ASSIGNMENT_TIMEOUT) {
        gpmWarn('Pending assignment timed out');
        GPM_STATE.pendingChatAssignment = null;
      }
    }
  }

  function gpmStartPolling() {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(gpmPollCheck, GPM_CONFIG.POLL_INTERVAL);
  }

  function gpmStopPolling() {
    if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
  }

  // ── Visibility-based polling control — stop in background tabs ──
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      gpmStartPolling();
      // Re-render on tab focus to catch cross-tab changes
      gpmRenderTree();
    } else {
      gpmStopPolling();
    }
  });

  // Start polling only if tab is visible
  if (document.visibilityState === 'visible') {
    gpmStartPolling();
  }

  // Enhance native chat items for drag & drop
  // Optimized: observe only chat list changes, filter out GPM's own mutations (PERF-004)
  const sidebar = document.querySelector(GPM_SELECTORS.sidebar);
  if (sidebar) {
    let enhanceTimeout = null;

    new MutationObserver((mutations) => {
      // Filter: ignore mutations from our own GPM elements to avoid feedback loops
      const relevant = mutations.some(m => {
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
    }).observe(sidebar, { childList: true, subtree: true });
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
  document.querySelectorAll('[data-gpm-enhanced]').forEach(el => {
    if (!el.closest('[data-gpm]')) delete el.dataset.gpmEnhanced;
  });

  // Gemini uses /app/<id> format — find all chat links (exclude /app itself which is "New chat")
  const chatItems = document.querySelectorAll('a[href^="/app/"]');

  chatItems.forEach(item => {
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

    item.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      gpmLog('Drag started for chat:', chatId, 'title:', chatTitle);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/gpm-chat-id', chatId);
      e.dataTransfer.setData('text/gpm-chat-title', chatTitle);
      e.dataTransfer.setData('text/plain', chatId);
      item.style.opacity = '0.5';
    }, { signal });

    item.addEventListener('dragend', () => {
      item.style.opacity = '';
    }, { signal });

    // Custom right-click context menu
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!GPM_STATE.modalRoot) return;

      const projects = await GPMStorage.getProjects();
      const chatMap = await GPMStorage.getChatMap();
      gpmShowChatContextMenu(e.clientX, e.clientY, chatId, chatMap[chatId], projects);
    }, { signal });
  });
}
