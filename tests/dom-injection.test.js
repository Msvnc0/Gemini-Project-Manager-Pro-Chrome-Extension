/**
 * dom-injection.test.js — Unit Tests for dom-injection.js
 *
 * Tests: gpmInjectStyles(), gpmCreateModalHost(), gpmSidebarHasContent(),
 *        gpmFindInsertionPoint(), gpmStartHealthMonitor(), gpmStopHealthMonitor(),
 *        gpmScheduleReinit()
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Setup globals that dom-injection.js depends on ──
globalThis.GPM_CONFIG = {
  HEALTH_CHECK_INTERVAL: 5000,
  REINIT_DEBOUNCE: 1000,
  MAX_REINIT_FAILURES: 3,
  DEBUG: false
};

globalThis.GPM_STATE = {
  container: null,
  modalHost: null,
  modalRoot: null,
  initialized: false,
  styleInjected: false,
  healthCheckTimer: null,
  reinitDebounceTimer: null,
  reinitFailCount: 0,
  qpOpen: false
};

globalThis.GPM_SELECTORS = {
  sidebar: 'conversations-list, [class*="sidenav"]',
  chatItem: 'a[href^="/app/"]'
};

globalThis.gpmLog = vi.fn();
globalThis.gpmWarn = vi.fn();
globalThis.gpmError = vi.fn();
globalThis.gpmIsContextValid = vi.fn(() => true);
globalThis.gpmInit = vi.fn();
globalThis.gpmRenderTree = vi.fn();
globalThis.gpmInjectQuickPromptTrigger = vi.fn();
globalThis.gpmClearSelectorCache = vi.fn();
globalThis.gpmResetState = vi.fn(() => {
  GPM_STATE.initialized = false;
  GPM_STATE.container = null;
  GPM_STATE.modalHost = null;
  GPM_STATE.modalRoot = null;
  GPM_STATE.styleInjected = false;
});

// Mock chrome.runtime.getURL
globalThis.chrome = {
  runtime: {
    id: 'mock-id',
    getURL: vi.fn((path) => `chrome-extension://mock/${path}`)
  }
};

const domInjectionCode = readFileSync(resolve('src/dom-injection.js'), 'utf-8');

const patchedCode = domInjectionCode
  .replace(/^function gpmInjectStyles\b/m, 'globalThis.gpmInjectStyles = function gpmInjectStyles')
  .replace(/^function gpmCreateModalHost\b/m, 'globalThis.gpmCreateModalHost = function gpmCreateModalHost')
  .replace(/^function gpmFindInsertionPoint\b/m, 'globalThis.gpmFindInsertionPoint = function gpmFindInsertionPoint')
  .replace(/^function gpmInjectProjectSection\b/m, 'globalThis.gpmInjectProjectSection = function gpmInjectProjectSection')
  .replace(/^function gpmWaitForSidebarContent\b/m, 'globalThis.gpmWaitForSidebarContent = function gpmWaitForSidebarContent')
  .replace(/^function gpmSidebarHasContent\b/m, 'globalThis.gpmSidebarHasContent = function gpmSidebarHasContent')
  .replace(/^function gpmObserveForSidebar\b/m, 'globalThis.gpmObserveForSidebar = function gpmObserveForSidebar')
  .replace(/^function gpmStartHealthMonitor\b/m, 'globalThis.gpmStartHealthMonitor = function gpmStartHealthMonitor')
  .replace(/^function gpmStopHealthMonitor\b/m, 'globalThis.gpmStopHealthMonitor = function gpmStopHealthMonitor')
  .replace(/^function gpmScheduleReinit\b/m, 'globalThis.gpmScheduleReinit = function gpmScheduleReinit');

new Function(patchedCode)();

const gpmInjectStyles = globalThis.gpmInjectStyles;
const gpmCreateModalHost = globalThis.gpmCreateModalHost;
const gpmSidebarHasContent = globalThis.gpmSidebarHasContent;
const gpmFindInsertionPoint = globalThis.gpmFindInsertionPoint;
const gpmStartHealthMonitor = globalThis.gpmStartHealthMonitor;
const gpmStopHealthMonitor = globalThis.gpmStopHealthMonitor;
const gpmScheduleReinit = globalThis.gpmScheduleReinit;

// ══════════════════════════════════════
//  gpmInjectStyles() Tests
// ══════════════════════════════════════

describe('gpmInjectStyles()', () => {
  beforeEach(() => {
    GPM_STATE.styleInjected = false;
    document.querySelector('#gpm-injected-styles')?.remove();
  });

  it('should inject a style element into head', () => {
    gpmInjectStyles();
    const style = document.querySelector('#gpm-injected-styles');
    expect(style).not.toBeNull();
    expect(style.tagName).toBe('STYLE');
  });

  it('should set styleInjected to true', () => {
    gpmInjectStyles();
    expect(GPM_STATE.styleInjected).toBe(true);
  });

  it('should be idempotent (not inject twice)', () => {
    gpmInjectStyles();
    gpmInjectStyles();
    const styles = document.querySelectorAll('#gpm-injected-styles');
    expect(styles.length).toBe(1);
  });

  it('should contain GPM CSS rules', () => {
    gpmInjectStyles();
    const style = document.querySelector('#gpm-injected-styles');
    expect(style.textContent).toContain('[data-gpm="root"]');
    expect(style.textContent).toContain('[data-gpm="header"]');
    expect(style.textContent).toContain('[data-gpm="item"]');
  });
});

// ══════════════════════════════════════
//  gpmCreateModalHost() Tests
// ══════════════════════════════════════

describe('gpmCreateModalHost()', () => {
  beforeEach(() => {
    GPM_STATE.modalHost = null;
    GPM_STATE.modalRoot = null;
    document.querySelector('#gpm-modal-host')?.remove();
  });

  it('should create modal host element', () => {
    gpmCreateModalHost();
    expect(GPM_STATE.modalHost).not.toBeNull();
    expect(GPM_STATE.modalHost.id).toBe('gpm-modal-host');
  });

  it('should create shadow root', () => {
    gpmCreateModalHost();
    expect(GPM_STATE.modalRoot).not.toBeNull();
  });

  it('should append modal host to body', () => {
    gpmCreateModalHost();
    expect(document.body.contains(GPM_STATE.modalHost)).toBe(true);
  });

  it('should be idempotent', () => {
    gpmCreateModalHost();
    const first = GPM_STATE.modalHost;
    gpmCreateModalHost();
    expect(GPM_STATE.modalHost).toBe(first);
  });
});

// ══════════════════════════════════════
//  gpmSidebarHasContent() Tests
// ══════════════════════════════════════

describe('gpmSidebarHasContent()', () => {
  let sidebar;

  beforeEach(() => {
    sidebar = document.createElement('div');
  });

  it('should return true when chat links exist', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/app/test123');
    sidebar.appendChild(link);
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when legacy /chat/ links exist', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/chat/legacy1');
    sidebar.appendChild(link);
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when "Chats" text exists (English)', () => {
    sidebar.textContent = 'Gems Chats Recent';
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when "Sohbetler" text exists (Turkish)', () => {
    sidebar.textContent = 'Sohbetler';
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when "แชท" text exists (Thai)', () => {
    sidebar.textContent = 'แชท';
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when "চ্যাটস" text exists (Bengali)', () => {
    sidebar.textContent = 'চ্যাটস';
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when .chat-history exists', () => {
    const el = document.createElement('div');
    el.className = 'chat-history';
    sidebar.appendChild(el);
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when .gems-list-container exists', () => {
    const el = document.createElement('div');
    el.className = 'gems-list-container';
    sidebar.appendChild(el);
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when Gems text exists', () => {
    sidebar.textContent = 'Gems';
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return true when .side-nav-entry-container exists', () => {
    const el = document.createElement('div');
    el.className = 'side-nav-entry-container';
    sidebar.appendChild(el);
    expect(gpmSidebarHasContent(sidebar)).toBe(true);
  });

  it('should return false for empty sidebar', () => {
    expect(gpmSidebarHasContent(sidebar)).toBe(false);
  });

  it('should return false for sidebar with unrelated content', () => {
    sidebar.textContent = 'Loading...';
    expect(gpmSidebarHasContent(sidebar)).toBe(false);
  });
});

// ══════════════════════════════════════
//  gpmFindInsertionPoint() Tests
// ══════════════════════════════════════

describe('gpmFindInsertionPoint()', () => {
  let sidebar;

  beforeEach(() => {
    sidebar = document.createElement('div');
  });

  it('should find .chat-history and insert before it (Strategy 1)', () => {
    const chatHistory = document.createElement('div');
    chatHistory.className = 'chat-history';
    sidebar.appendChild(chatHistory);

    const result = gpmFindInsertionPoint(sidebar);
    expect(result.parent).toBe(sidebar);
    expect(result.before).toBe(chatHistory);
  });

  it('should find .gems-list-container and insert after it (Strategy 2)', () => {
    const gems = document.createElement('div');
    gems.className = 'gems-list-container';
    const next = document.createElement('div');
    sidebar.appendChild(gems);
    sidebar.appendChild(next);

    const result = gpmFindInsertionPoint(sidebar);
    expect(result.parent).toBe(sidebar);
    expect(result.before).toBe(next);
  });

  it('should use first chat link as fallback (Strategy 5)', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/app/test1');
    sidebar.appendChild(link);

    const result = gpmFindInsertionPoint(sidebar);
    expect(result).toBeDefined();
    expect(result.parent).toBeDefined();
  });

  it('should insert before last child as last resort (Strategy 6)', () => {
    const child1 = document.createElement('div');
    child1.textContent = 'First';
    const child2 = document.createElement('div');
    child2.textContent = 'Second';
    sidebar.appendChild(child1);
    sidebar.appendChild(child2);

    const result = gpmFindInsertionPoint(sidebar);
    expect(result.parent).toBe(sidebar);
    expect(result.before).toBe(child2);
  });

  it('should return parent: sidebar, before: null for empty sidebar', () => {
    const result = gpmFindInsertionPoint(sidebar);
    expect(result.parent).toBe(sidebar);
    expect(result.before).toBeNull();
  });
});

// ══════════════════════════════════════
//  Health Monitor Tests
// ══════════════════════════════════════

describe('gpmStartHealthMonitor()', () => {
  beforeEach(() => {
    gpmStopHealthMonitor();
    GPM_STATE.healthCheckTimer = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    gpmStopHealthMonitor();
    vi.useRealTimers();
  });

  it('should start the health check timer', () => {
    gpmStartHealthMonitor();
    expect(GPM_STATE.healthCheckTimer).not.toBeNull();
  });

  it('should be idempotent (not start multiple timers)', () => {
    gpmStartHealthMonitor();
    const firstTimer = GPM_STATE.healthCheckTimer;
    gpmStartHealthMonitor();
    expect(GPM_STATE.healthCheckTimer).toBe(firstTimer);
  });
});

describe('gpmStopHealthMonitor()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear the health check timer', () => {
    gpmStartHealthMonitor();
    expect(GPM_STATE.healthCheckTimer).not.toBeNull();
    gpmStopHealthMonitor();
    expect(GPM_STATE.healthCheckTimer).toBeNull();
  });

  it('should be safe to call when no timer exists', () => {
    GPM_STATE.healthCheckTimer = null;
    expect(() => gpmStopHealthMonitor()).not.toThrow();
  });
});

describe('gpmScheduleReinit()', () => {
  beforeEach(() => {
    GPM_STATE.reinitFailCount = 0;
    GPM_STATE.reinitDebounceTimer = null;
    GPM_STATE.initialized = true;
    globalThis.gpmIsContextValid.mockReturnValue(true);
    globalThis.gpmResetState.mockClear();
    globalThis.gpmInit.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearTimeout(GPM_STATE.reinitDebounceTimer);
    GPM_STATE.reinitDebounceTimer = null;
    vi.useRealTimers();
  });

  it('should schedule a debounced re-init', () => {
    gpmScheduleReinit('test reason');
    expect(GPM_STATE.reinitDebounceTimer).not.toBeNull();
  });

  it('should not schedule multiple re-inits (debounce)', () => {
    gpmScheduleReinit('first');
    const firstTimer = GPM_STATE.reinitDebounceTimer;
    gpmScheduleReinit('second');
    expect(GPM_STATE.reinitDebounceTimer).toBe(firstTimer);
  });

  it('should back off after MAX_REINIT_FAILURES', () => {
    GPM_STATE.reinitFailCount = GPM_CONFIG.MAX_REINIT_FAILURES;
    gpmScheduleReinit('backed off');
    // Should not schedule — instead observe for sidebar
    expect(GPM_STATE.initialized).toBe(false);
  });
});
