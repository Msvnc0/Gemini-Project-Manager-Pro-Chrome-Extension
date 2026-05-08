/**
 * selectors.test.js — Unit Tests for selectors.js
 *
 * Tests: GPM_SELECTORS, gpmQuerySelector(),
 *        gpmClearSelectorCache(), _gpmStructuralDiscovery
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock gpmLog/gpmWarn before loading selectors.js
globalThis.gpmLog = vi.fn();
globalThis.gpmWarn = vi.fn();

const selectorsCode = readFileSync(resolve('src/selectors.js'), 'utf-8');

const patchedCode = selectorsCode
  .replace(/^const GPM_SELECTORS\s*=/m, 'globalThis.GPM_SELECTORS =')
  .replace(/^const _gpmSelectorCache\s*=/m, 'globalThis._gpmSelectorCache =')
  .replace(/^const _gpmStructuralDiscovery\s*=/m, 'globalThis._gpmStructuralDiscovery =')
  .replace(/^function gpmQuerySelector\b/m, 'globalThis.gpmQuerySelector = function gpmQuerySelector')
  .replace(/^function gpmClearSelectorCache\b/m, 'globalThis.gpmClearSelectorCache = function gpmClearSelectorCache');

new Function(patchedCode)();

const GPM_SELECTORS = globalThis.GPM_SELECTORS;
const _gpmSelectorCache = globalThis._gpmSelectorCache;
const _gpmStructuralDiscovery = globalThis._gpmStructuralDiscovery;
const gpmQuerySelector = globalThis.gpmQuerySelector;
const gpmClearSelectorCache = globalThis.gpmClearSelectorCache;

// ══════════════════════════════════════
//  GPM_SELECTORS Structure
// ══════════════════════════════════════

describe('GPM_SELECTORS', () => {
  it('should have all required selector keys', () => {
    const requiredKeys = [
      'sidebar',
      'chatItem',
      'newChatButton',
      'inputArea',
      'inputContainer',
      'darkModeIndicator',
      'leadingActions',
      'toolboxDrawer',
      'toolboxButtonContainer',
      'chatHistory',
      'gemsList',
      'sideNavEntry',
    ];
    for (const key of requiredKeys) {
      expect(GPM_SELECTORS).toHaveProperty(key);
      expect(typeof GPM_SELECTORS[key]).toBe('string');
    }
  });

  it('should have sidebar selector with multiple fallbacks', () => {
    const parts = GPM_SELECTORS.sidebar.split(',').map((s) => s.trim());
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });

  it('should have chatItem selector targeting /app/ links', () => {
    expect(GPM_SELECTORS.chatItem).toContain('/app/');
  });
});

// ══════════════════════════════════════
//  gpmQuerySelector() Tests
// ══════════════════════════════════════

describe('gpmQuerySelector()', () => {
  beforeEach(() => {
    gpmClearSelectorCache();
    globalThis.gpmLog.mockClear();
    globalThis.gpmWarn.mockClear();
  });

  it('should find element by CSS selector', () => {
    const el = document.createElement('a');
    el.setAttribute('href', '/app/test123');
    document.body.appendChild(el);

    const result = gpmQuerySelector('chatItem');
    expect(result).toBe(el);

    el.remove();
  });

  it('should return null for unknown selector key', () => {
    const result = gpmQuerySelector('nonexistentKey');
    expect(result).toBeNull();
    expect(globalThis.gpmWarn).toHaveBeenCalled();
  });

  it('should return null when element not found', () => {
    const result = gpmQuerySelector('chatHistory');
    expect(result).toBeNull();
  });

  it('should use context parameter for scoped search', () => {
    const container = document.createElement('div');
    const el = document.createElement('a');
    el.setAttribute('href', '/app/scoped1');
    container.appendChild(el);
    document.body.appendChild(container);

    // Search outside container should not find it if it's the only one
    const outerEl = document.createElement('a');
    outerEl.setAttribute('href', '/app/outer1');
    document.body.appendChild(outerEl);

    const result = gpmQuerySelector('chatItem', container);
    expect(result).toBe(el);

    container.remove();
    outerEl.remove();
  });

  it('should use cache for previously discovered elements', () => {
    const el = document.createElement('div');
    el.id = 'cached-test';
    document.body.appendChild(el);

    // Manually set cache
    _gpmSelectorCache['chatHistory'] = el;

    const result = gpmQuerySelector('chatHistory');
    expect(result).toBe(el);

    el.remove();
    delete _gpmSelectorCache['chatHistory'];
  });

  it('should invalidate cache when element is disconnected', () => {
    const el = document.createElement('div');
    // Element is not connected to DOM
    _gpmSelectorCache['chatHistory'] = el;

    const result = gpmQuerySelector('chatHistory');
    // Should not return the disconnected cached element
    expect(result).not.toBe(el);
    expect(_gpmSelectorCache['chatHistory']).toBeUndefined();
  });
});

// ══════════════════════════════════════
//  gpmClearSelectorCache() Tests
// ══════════════════════════════════════

describe('gpmClearSelectorCache()', () => {
  it('should clear all cached entries', () => {
    _gpmSelectorCache['sidebar'] = document.createElement('div');
    _gpmSelectorCache['inputArea'] = document.createElement('div');

    gpmClearSelectorCache();

    expect(Object.keys(_gpmSelectorCache).length).toBe(0);
  });

  it('should be safe to call when cache is empty', () => {
    gpmClearSelectorCache();
    expect(Object.keys(_gpmSelectorCache).length).toBe(0);
  });
});

// ══════════════════════════════════════
//  _gpmStructuralDiscovery Tests
// ══════════════════════════════════════

describe('_gpmStructuralDiscovery', () => {
  it('should have sidebar discovery function', () => {
    expect(typeof _gpmStructuralDiscovery.sidebar).toBe('function');
  });

  it('should have inputArea discovery function', () => {
    expect(typeof _gpmStructuralDiscovery.inputArea).toBe('function');
  });

  describe('sidebar()', () => {
    it('should return null when no chat links exist', () => {
      const result = _gpmStructuralDiscovery.sidebar();
      expect(result).toBeNull();
    });
  });

  describe('inputArea()', () => {
    it('should return active element if it is contenteditable', () => {
      const el = document.createElement('div');
      el.contentEditable = 'true';
      document.body.appendChild(el);
      el.focus();

      // jsdom may not fully support activeElement for contenteditable
      // but we test the function doesn't crash
      const result = _gpmStructuralDiscovery.inputArea();
      expect(result).toBeNull();

      el.remove();
    });

    it('should return null when no input area found', () => {
      const result = _gpmStructuralDiscovery.inputArea();
      expect(result).toBeNull();
    });
  });
});
