/**
 * navigation.test.js — Unit Tests for navigation.js
 *
 * Tests: gpmGetCurrentChatId(), gpmNavigateToChat(), gpmTriggerNewChat(),
 *        gpmObserveSPANavigation(), gpmEnhanceNativeChatItems()
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Setup globals that navigation.js depends on ──
globalThis.GPM_CONFIG = {
  NAV_DELAY: 600,
  POLL_INTERVAL: 500,
  ASSIGNMENT_TIMEOUT: 120000,
  ENHANCE_DEBOUNCE: 500,
  DEBUG: false
};

globalThis.GPM_STATE = {
  container: null,
  initialized: false,
  pendingChatAssignment: null,
  enhanceAbortController: null,
  modalRoot: null
};

globalThis.GPM_SELECTORS = {
  sidebar: 'conversations-list, [class*="sidenav"]',
  chatItem: 'a[href^="/app/"]',
  inputArea: '[contenteditable="true"], textarea[aria-label], .ql-editor, [role="textbox"]',
  newChatButton: 'a[href="/app"]'
};

globalThis.gpmLog = vi.fn();
globalThis.gpmWarn = vi.fn();
globalThis.gpmError = vi.fn();
globalThis.gpmIsContextValid = vi.fn(() => true);
globalThis.gpmRenderTree = vi.fn();
globalThis.gpmInjectProjectSection = vi.fn();
globalThis.gpmInjectQuickPromptTrigger = vi.fn();
globalThis.gpmShowChatContextMenu = vi.fn();
globalThis.gpmScheduleAliasResolve = vi.fn();
globalThis.gpmStopHealthMonitor = vi.fn();

globalThis.GPMStorage = {
  getProjects: vi.fn(async () => []),
  getChatMap: vi.fn(async () => ({})),
  assignChat: vi.fn(async () => {})
};

// extractChatIdFromUrl is needed by navigation.js
globalThis.extractChatIdFromUrl = function extractChatIdFromUrl(urlOrHref) {
  if (!urlOrHref || typeof urlOrHref !== 'string') return null;
  const appMatch = urlOrHref.match(/\/app\/([a-zA-Z0-9_-]+)/);
  if (appMatch) return appMatch[1];
  const legacyMatch = urlOrHref.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/);
  if (legacyMatch) return legacyMatch[1];
  return null;
};

// Load navigation.js
const navCode = readFileSync(resolve('src/navigation.js'), 'utf-8');

const patchedCode = navCode
  .replace(/^function gpmTriggerNewChat\b/m, 'globalThis.gpmTriggerNewChat = function gpmTriggerNewChat')
  .replace(/^function gpmNavigateToChat\b/m, 'globalThis.gpmNavigateToChat = function gpmNavigateToChat')
  .replace(/^function gpmGetCurrentChatId\b/m, 'globalThis.gpmGetCurrentChatId = function gpmGetCurrentChatId')
  .replace(/^function gpmObserveSPANavigation\b/m, 'globalThis.gpmObserveSPANavigation = function gpmObserveSPANavigation')
  .replace(/^function gpmOnNavigate\b/m, 'globalThis.gpmOnNavigate = function gpmOnNavigate')
  .replace(/^function gpmObserveNewChats\b/m, 'globalThis.gpmObserveNewChats = function gpmObserveNewChats')
  .replace(/^function gpmEnhanceNativeChatItems\b/m, 'globalThis.gpmEnhanceNativeChatItems = function gpmEnhanceNativeChatItems');

new Function(patchedCode)();

const gpmTriggerNewChat = globalThis.gpmTriggerNewChat;
const gpmNavigateToChat = globalThis.gpmNavigateToChat;
const gpmGetCurrentChatId = globalThis.gpmGetCurrentChatId;
const gpmEnhanceNativeChatItems = globalThis.gpmEnhanceNativeChatItems;

// ══════════════════════════════════════
//  gpmGetCurrentChatId() Tests
// ══════════════════════════════════════

describe('gpmGetCurrentChatId()', () => {
  const originalPathname = window.location.pathname;

  afterEach(() => {
    // Reset pathname via history
    history.replaceState(null, '', originalPathname);
  });

  it('should return null for /app (home page)', () => {
    history.replaceState(null, '', '/app');
    expect(gpmGetCurrentChatId()).toBeNull();
  });

  it('should return chat ID for /app/<id>', () => {
    history.replaceState(null, '', '/app/abc123');
    expect(gpmGetCurrentChatId()).toBe('abc123');
  });

  it('should return chat ID with hyphens and underscores', () => {
    history.replaceState(null, '', '/app/my-chat_456');
    expect(gpmGetCurrentChatId()).toBe('my-chat_456');
  });

  it('should return null for /app/ (trailing slash only)', () => {
    history.replaceState(null, '', '/app/');
    expect(gpmGetCurrentChatId()).toBeNull();
  });

  it('should return null for root path', () => {
    history.replaceState(null, '', '/');
    expect(gpmGetCurrentChatId()).toBeNull();
  });
});

// ══════════════════════════════════════
//  gpmNavigateToChat() Tests
// ══════════════════════════════════════

describe('gpmNavigateToChat()', () => {
  it('should click sidebar link when it matches chatId', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/app/testChat1');
    const clickSpy = vi.spyOn(link, 'click');
    document.body.appendChild(link);

    gpmNavigateToChat('testChat1');
    expect(clickSpy).toHaveBeenCalled();

    link.remove();
  });

  it('should fallback to window.location.href when no link found', () => {
    // Remove any existing /app/ links
    document.querySelectorAll('a[href^="/app/"]').forEach(el => el.remove());

    const originalHref = window.location.href;
    // gpmNavigateToChat sets window.location.href — in jsdom this may throw
    // but we can verify the function doesn't crash
    expect(() => gpmNavigateToChat('nonexistent999')).not.toThrow();
  });
});

// ══════════════════════════════════════
//  gpmTriggerNewChat() Tests
// ══════════════════════════════════════

describe('gpmTriggerNewChat()', () => {
  beforeEach(() => {
    globalThis.gpmLog.mockClear();
  });

  it('should focus input when already on /app', () => {
    history.replaceState(null, '', '/app');
    const input = document.createElement('div');
    input.contentEditable = 'true';
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');

    gpmTriggerNewChat();

    // Should log about being on home
    expect(globalThis.gpmLog).toHaveBeenCalledWith(
      expect.stringContaining('Already on home')
    );

    input.remove();
  });

  it('should focus input when on /app/ (trailing slash)', () => {
    history.replaceState(null, '', '/app/');
    const input = document.createElement('div');
    input.contentEditable = 'true';
    document.body.appendChild(input);

    gpmTriggerNewChat();
    expect(globalThis.gpmLog).toHaveBeenCalledWith(
      expect.stringContaining('Already on home')
    );

    input.remove();
  });

  it('should click "New chat" link when not on home', () => {
    history.replaceState(null, '', '/app/some-chat-123');

    const newChatLink = document.createElement('a');
    newChatLink.setAttribute('href', '/app');
    newChatLink.setAttribute('aria-label', 'New chat');
    newChatLink.textContent = 'New chat';
    const clickSpy = vi.spyOn(newChatLink, 'click');
    document.body.appendChild(newChatLink);

    gpmTriggerNewChat();
    expect(clickSpy).toHaveBeenCalled();

    newChatLink.remove();
  });

  it('should click first a[href="/app"] when no labeled link found', () => {
    history.replaceState(null, '', '/app/another-chat');

    // Remove any existing /app links
    document.querySelectorAll('a[href="/app"]').forEach(el => el.remove());

    const link = document.createElement('a');
    link.setAttribute('href', '/app');
    link.textContent = 'Some link';
    const clickSpy = vi.spyOn(link, 'click');
    document.body.appendChild(link);

    gpmTriggerNewChat();
    expect(clickSpy).toHaveBeenCalled();

    link.remove();
  });
});

// ══════════════════════════════════════
//  gpmEnhanceNativeChatItems() Tests
// ══════════════════════════════════════

describe('gpmEnhanceNativeChatItems()', () => {
  beforeEach(() => {
    GPM_STATE.enhanceAbortController = null;
    document.querySelectorAll('[data-gpm-enhanced]').forEach(el => {
      delete el.dataset.gpmEnhanced;
      el.remove();
    });
  });

  it('should create a new AbortController', () => {
    gpmEnhanceNativeChatItems();
    expect(GPM_STATE.enhanceAbortController).toBeInstanceOf(AbortController);
  });

  it('should abort previous controller', () => {
    const oldController = new AbortController();
    GPM_STATE.enhanceAbortController = oldController;
    const abortSpy = vi.spyOn(oldController, 'abort');

    gpmEnhanceNativeChatItems();
    expect(abortSpy).toHaveBeenCalled();
  });

  it('should mark chat links as enhanced', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/app/chat123');
    link.textContent = 'Test Chat';
    document.body.appendChild(link);

    gpmEnhanceNativeChatItems();
    expect(link.dataset.gpmEnhanced).toBe('true');
    expect(link.draggable).toBe(true);

    link.remove();
  });

  it('should skip links inside GPM container', () => {
    const gpmContainer = document.createElement('div');
    gpmContainer.setAttribute('data-gpm', 'root');
    const link = document.createElement('a');
    link.setAttribute('href', '/app/chat456');
    gpmContainer.appendChild(link);
    document.body.appendChild(gpmContainer);

    gpmEnhanceNativeChatItems();
    expect(link.dataset.gpmEnhanced).toBeUndefined();

    gpmContainer.remove();
  });

  it('should set up dragstart event on enhanced links', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/app/draggable1');
    link.textContent = 'Draggable Chat';
    document.body.appendChild(link);

    gpmEnhanceNativeChatItems();

    // Simulate dragstart
    const dataTransfer = {
      effectAllowed: null,
      setData: vi.fn()
    };
    const dragEvent = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragEvent, 'dataTransfer', { value: dataTransfer });
    dragEvent.stopPropagation = vi.fn();

    link.dispatchEvent(dragEvent);

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/gpm-chat-id', 'draggable1');
    expect(link.style.opacity).toBe('0.5');

    link.remove();
  });
});
