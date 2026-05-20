/**
 * config.test.js — Unit Tests for config.js
 *
 * Tests: extractChatIdFromUrl(), gpmIsContextValid(), gpmResetState(),
 *        gpmWaitForElement(), gpmLog/gpmWarn/gpmError, GPM_CONFIG, GPM_STATE
 */

import { resetMockStorage } from './mocks/chrome.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configCode = readFileSync(resolve('src/config.js'), 'utf-8');

// Patch globals for test scope
const patchedCode = configCode
  .replace(/^const GPM_CONFIG\s*=/m, 'globalThis.GPM_CONFIG =')
  .replace(/^const GPM_STATE\s*=/m, 'globalThis.GPM_STATE =')
  .replace(/^function gpmLog\b/m, 'globalThis.gpmLog = function gpmLog')
  .replace(/^function gpmWarn\b/m, 'globalThis.gpmWarn = function gpmWarn')
  .replace(/^function gpmError\b/m, 'globalThis.gpmError = function gpmError')
  .replace(/^function gpmIsContextValid\b/m, 'globalThis.gpmIsContextValid = function gpmIsContextValid')
  .replace(/^function extractChatIdFromUrl\b/m, 'globalThis.extractChatIdFromUrl = function extractChatIdFromUrl')
  .replace(/^function gpmWaitForElement\b/m, 'globalThis.gpmWaitForElement = function gpmWaitForElement')
  .replace(/^function gpmResetState\b/m, 'globalThis.gpmResetState = function gpmResetState');

// Mock gpmClearSelectorCache (defined in selectors.js, called by gpmResetState)
globalThis.gpmClearSelectorCache = vi.fn();

new Function(patchedCode)();

const GPM_CONFIG = globalThis.GPM_CONFIG;
const GPM_STATE = globalThis.GPM_STATE;
const gpmLog = globalThis.gpmLog;
const gpmWarn = globalThis.gpmWarn;
const gpmError = globalThis.gpmError;
const gpmIsContextValid = globalThis.gpmIsContextValid;
const extractChatIdFromUrl = globalThis.extractChatIdFromUrl;
const gpmWaitForElement = globalThis.gpmWaitForElement;
const gpmResetState = globalThis.gpmResetState;

describe('GPM_CONFIG', () => {
  it('should have all required configuration keys', () => {
    expect(GPM_CONFIG.SIDEBAR_TIMEOUT).toBe(15000);
    expect(GPM_CONFIG.CONTENT_TIMEOUT).toBe(3000);
    expect(GPM_CONFIG.NAV_DELAY).toBe(300);
    expect(GPM_CONFIG.POLL_INTERVAL).toBe(500);
    expect(GPM_CONFIG.ASSIGNMENT_TIMEOUT).toBe(120000);
    expect(GPM_CONFIG.SYNC_DEBOUNCE).toBe(300);
    expect(GPM_CONFIG.ENHANCE_DEBOUNCE).toBe(500);
    expect(GPM_CONFIG.QP_BUTTON_CHECK).toBe(1000);
    expect(GPM_CONFIG.HEALTH_CHECK_INTERVAL).toBe(5000);
    expect(GPM_CONFIG.REINIT_DEBOUNCE).toBe(1000);
    expect(GPM_CONFIG.MAX_REINIT_FAILURES).toBe(3);
    expect(GPM_CONFIG.DEBUG).toBe(false);
  });
});

describe('GPM_STATE', () => {
  it('should have all required state keys with default values', () => {
    expect(GPM_STATE).toHaveProperty('container');
    expect(GPM_STATE).toHaveProperty('modalHost');
    expect(GPM_STATE).toHaveProperty('modalRoot');
    expect(GPM_STATE).toHaveProperty('initialized');
    expect(GPM_STATE).toHaveProperty('pendingChatAssignment');
    expect(GPM_STATE).toHaveProperty('styleInjected');
    expect(GPM_STATE).toHaveProperty('qpOpen');
    expect(GPM_STATE).toHaveProperty('healthCheckTimer');
    expect(GPM_STATE).toHaveProperty('reinitDebounceTimer');
    expect(GPM_STATE).toHaveProperty('reinitFailCount');
  });
});

// ══════════════════════════════════════
//  extractChatIdFromUrl() Tests
// ══════════════════════════════════════

describe('extractChatIdFromUrl()', () => {
  it('should extract chat ID from /app/<id> format', () => {
    expect(extractChatIdFromUrl('/app/abc123')).toBe('abc123');
  });

  it('should extract chat ID from full URL with /app/<id>', () => {
    expect(extractChatIdFromUrl('https://gemini.google.com/app/xyz789')).toBe('xyz789');
  });

  it('should extract chat ID from legacy /chat/<id> format', () => {
    expect(extractChatIdFromUrl('/chat/legacy123')).toBe('legacy123');
  });

  it('should extract chat ID from legacy /c/<id> format', () => {
    expect(extractChatIdFromUrl('/c/short456')).toBe('short456');
  });

  it('should return null for /app (no chat ID)', () => {
    expect(extractChatIdFromUrl('/app')).toBeNull();
  });

  it('should return null for /app/ (trailing slash, no ID)', () => {
    expect(extractChatIdFromUrl('/app/')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractChatIdFromUrl('')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(extractChatIdFromUrl(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(extractChatIdFromUrl(undefined)).toBeNull();
  });

  it('should return null for non-string input', () => {
    expect(extractChatIdFromUrl(123)).toBeNull();
  });

  it('should handle IDs with hyphens and underscores', () => {
    expect(extractChatIdFromUrl('/app/my-chat_123')).toBe('my-chat_123');
  });

  it('should handle URLs with query parameters', () => {
    expect(extractChatIdFromUrl('/app/abc123?param=value')).toBe('abc123');
  });

  it('should return null for unrelated paths', () => {
    expect(extractChatIdFromUrl('/settings')).toBeNull();
    expect(extractChatIdFromUrl('/home')).toBeNull();
  });
});

// ══════════════════════════════════════
//  gpmIsContextValid() Tests
// ══════════════════════════════════════

describe('gpmIsContextValid()', () => {
  it('should return true when chrome.runtime.id exists', () => {
    expect(gpmIsContextValid()).toBe(true);
  });

  it('should return false when chrome.runtime.id is undefined', () => {
    const originalId = chrome.runtime.id;
    chrome.runtime.id = undefined;
    expect(gpmIsContextValid()).toBe(false);
    chrome.runtime.id = originalId;
  });

  it('should return false when chrome.runtime throws', () => {
    const originalRuntime = chrome.runtime;
    Object.defineProperty(chrome, 'runtime', {
      get() { throw new Error('Extension context invalidated'); },
      configurable: true
    });
    expect(gpmIsContextValid()).toBe(false);
    Object.defineProperty(chrome, 'runtime', {
      value: originalRuntime,
      configurable: true,
      writable: true
    });
  });
});

// ══════════════════════════════════════
//  gpmResetState() Tests
// ══════════════════════════════════════

describe('gpmResetState()', () => {
  beforeEach(() => {
    // Set up state with non-default values
    GPM_STATE.container = document.createElement('div');
    GPM_STATE.modalHost = document.createElement('div');
    GPM_STATE.modalRoot = {};
    GPM_STATE.initialized = true;
    GPM_STATE.styleInjected = true;
    GPM_STATE.qpOpen = true;
    GPM_STATE.pendingChatAssignment = { projectId: 'test' };
    GPM_STATE.enhanceAbortController = new AbortController();
    GPM_STATE.aliasResolveTimer = setTimeout(() => {}, 10000);
    GPM_STATE.syncTimeout = setTimeout(() => {}, 10000);
    GPM_STATE.reinitDebounceTimer = setTimeout(() => {}, 10000);
    globalThis.gpmClearSelectorCache.mockClear();
  });

  afterEach(() => {
    clearTimeout(GPM_STATE.aliasResolveTimer);
    clearTimeout(GPM_STATE.syncTimeout);
    clearTimeout(GPM_STATE.reinitDebounceTimer);
  });

  it('should reset container to null', () => {
    gpmResetState();
    expect(GPM_STATE.container).toBeNull();
  });

  it('should reset modalHost and modalRoot to null', () => {
    gpmResetState();
    expect(GPM_STATE.modalHost).toBeNull();
    expect(GPM_STATE.modalRoot).toBeNull();
  });

  it('should reset initialized to false', () => {
    gpmResetState();
    expect(GPM_STATE.initialized).toBe(false);
  });

  it('should reset styleInjected to false', () => {
    gpmResetState();
    expect(GPM_STATE.styleInjected).toBe(false);
  });

  it('should reset qpOpen to false', () => {
    gpmResetState();
    expect(GPM_STATE.qpOpen).toBe(false);
  });

  it('should preserve pendingChatAssignment', () => {
    gpmResetState();
    expect(GPM_STATE.pendingChatAssignment).toEqual({ projectId: 'test' });
  });

  it('should abort enhanceAbortController', () => {
    const controller = GPM_STATE.enhanceAbortController;
    const abortSpy = vi.spyOn(controller, 'abort');
    gpmResetState();
    expect(abortSpy).toHaveBeenCalled();
    expect(GPM_STATE.enhanceAbortController).toBeNull();
  });

  it('should call gpmClearSelectorCache', () => {
    gpmResetState();
    expect(globalThis.gpmClearSelectorCache).toHaveBeenCalled();
  });

  it('should clear reinitDebounceTimer', () => {
    gpmResetState();
    expect(GPM_STATE.reinitDebounceTimer).toBeNull();
  });
});

// ══════════════════════════════════════
//  gpmWaitForElement() Tests
// ══════════════════════════════════════

describe('gpmWaitForElement()', () => {
  it('should resolve immediately if element exists', async () => {
    const el = document.createElement('div');
    el.id = 'test-immediate';
    document.body.appendChild(el);

    const result = await gpmWaitForElement('#test-immediate');
    expect(result).toBe(el);

    el.remove();
  });

  it('should resolve when element appears later', async () => {
    const promise = gpmWaitForElement('#test-delayed', 5000);

    // Add element after a short delay
    setTimeout(() => {
      const el = document.createElement('div');
      el.id = 'test-delayed';
      document.body.appendChild(el);
    }, 50);

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result.id).toBe('test-delayed');

    document.querySelector('#test-delayed')?.remove();
  });

  it('should resolve with null on timeout', async () => {
    const result = await gpmWaitForElement('#nonexistent-element', 100);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════
//  Logging Functions Tests
// ══════════════════════════════════════

describe('Logging functions', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gpmLog should not log when DEBUG is false', () => {
    GPM_CONFIG.DEBUG = false;
    gpmLog('test');
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('gpmLog should log when DEBUG is true', () => {
    GPM_CONFIG.DEBUG = true;
    gpmLog('test message');
    expect(consoleSpy.log).toHaveBeenCalledWith('[GPM]', 'test message');
    GPM_CONFIG.DEBUG = false;
  });

  it('gpmWarn should not warn when DEBUG is false', () => {
    GPM_CONFIG.DEBUG = false;
    gpmWarn('test');
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  });

  it('gpmWarn should warn when DEBUG is true', () => {
    GPM_CONFIG.DEBUG = true;
    gpmWarn('warn message');
    expect(consoleSpy.warn).toHaveBeenCalledWith('[GPM]', 'warn message');
    GPM_CONFIG.DEBUG = false;
  });

  it('gpmError should always log errors regardless of DEBUG', () => {
    GPM_CONFIG.DEBUG = false;
    gpmError('error message');
    expect(consoleSpy.error).toHaveBeenCalledWith('[GPM]', 'error message');
  });
});
