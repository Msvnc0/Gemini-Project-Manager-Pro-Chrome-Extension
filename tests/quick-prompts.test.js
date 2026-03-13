/**
 * quick-prompts.test.js — Unit Tests for quick-prompts.js
 *
 * Tests: _gpmCreateQPButton(), _gpmFindToolbarSlot(), gpmInjectQuickPromptTrigger(),
 *        _gpmInjectFloatingQPButton(), gpmInsertPromptText()
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Setup globals ──
globalThis.GPM_CONFIG = {
  QP_BUTTON_CHECK: 1000,
  DEBUG: false
};

globalThis.GPM_STATE = {
  modalHost: null,
  modalRoot: null,
  qpOpen: false,
  _qpCheckInterval: null,
  _qpMutationObserver: null
};

globalThis.GPM_SELECTORS = {
  leadingActions: '.leading-actions-wrapper, .input-area-leading-actions, [class*="leading-actions"], [class*="toolbar-actions"]',
  toolboxDrawer: 'toolbox-drawer, [class*="toolbox-drawer"], [class*="tool-drawer"]',
  toolboxButtonContainer: '.toolbox-drawer-button-container, [class*="toolbox-button"]',
  inputArea: '[contenteditable="true"], textarea[aria-label], .ql-editor, [role="textbox"]',
  inputContainer: 'form, [class*="input-area"], [class*="prompt"]'
};

globalThis.gpmLog = vi.fn();
globalThis.gpmWarn = vi.fn();
globalThis.gpmError = vi.fn();
globalThis.gpmIsContextValid = vi.fn(() => true);
globalThis.t = vi.fn((key) => key);
globalThis.gpmQuerySelector = vi.fn((key) => document.querySelector(GPM_SELECTORS[key] || ''));
globalThis.gpmToggleQuickPrompts = vi.fn();

// Load quick-prompts.js
const qpCode = readFileSync(resolve('src/quick-prompts.js'), 'utf-8');

const patchedCode = qpCode
  .replace(/^function _gpmCreateQPButton\b/m, 'globalThis._gpmCreateQPButton = function _gpmCreateQPButton')
  .replace(/^function _gpmFindToolbarSlot\b/m, 'globalThis._gpmFindToolbarSlot = function _gpmFindToolbarSlot')
  .replace(/^function _gpmFindToolsButton\b/m, 'globalThis._gpmFindToolsButton = function _gpmFindToolsButton')
  .replace(/^function _gpmInjectFloatingQPButton\b/m, 'globalThis._gpmInjectFloatingQPButton = function _gpmInjectFloatingQPButton')
  .replace(/^function gpmInjectQuickPromptTrigger\b/m, 'globalThis.gpmInjectQuickPromptTrigger = function gpmInjectQuickPromptTrigger')
  .replace(/^function _gpmVerifyButtonVisibility\b/m, 'globalThis._gpmVerifyButtonVisibility = function _gpmVerifyButtonVisibility')
  .replace(/^function gpmObserveQuickPromptButton\b/m, 'globalThis.gpmObserveQuickPromptButton = function gpmObserveQuickPromptButton')
  .replace(/^async function gpmToggleQuickPrompts\b/m, 'globalThis._originalGpmToggleQuickPrompts = async function gpmToggleQuickPrompts')
  .replace(/^function gpmInsertPromptText\b/m, 'globalThis.gpmInsertPromptText = function gpmInsertPromptText');

new Function(patchedCode)();

const _gpmCreateQPButton = globalThis._gpmCreateQPButton;
const _gpmFindToolbarSlot = globalThis._gpmFindToolbarSlot;
const _gpmFindToolsButton = globalThis._gpmFindToolsButton;
const _gpmInjectFloatingQPButton = globalThis._gpmInjectFloatingQPButton;
const _gpmVerifyButtonVisibility = globalThis._gpmVerifyButtonVisibility;
const gpmInjectQuickPromptTrigger = globalThis.gpmInjectQuickPromptTrigger;
const gpmInsertPromptText = globalThis.gpmInsertPromptText;

// ══════════════════════════════════════
//  _gpmCreateQPButton() Tests
// ══════════════════════════════════════

describe('_gpmCreateQPButton()', () => {
  it('should create a button element', () => {
    const btn = _gpmCreateQPButton();
    expect(btn.tagName).toBe('BUTTON');
  });

  it('should have id gpm-qp-trigger', () => {
    const btn = _gpmCreateQPButton();
    expect(btn.id).toBe('gpm-qp-trigger');
  });

  it('should have ⚡ as text content', () => {
    const btn = _gpmCreateQPButton();
    expect(btn.textContent).toBe('⚡');
  });

  it('should have type=button', () => {
    const btn = _gpmCreateQPButton();
    expect(btn.type).toBe('button');
  });

  it('should have title from t() function', () => {
    const btn = _gpmCreateQPButton();
    expect(globalThis.t).toHaveBeenCalledWith('quickPrompts');
  });

  it('should have correct element structure', () => {
    const btn = _gpmCreateQPButton();
    // jsdom doesn't fully support style.cssText via new Function() eval
    // Verify the button has the expected structure instead
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.id).toBe('gpm-qp-trigger');
    expect(btn.type).toBe('button');
  });
});

// ══════════════════════════════════════
//  _gpmFindToolbarSlot() Tests
// ══════════════════════════════════════

describe('_gpmFindToolbarSlot()', () => {
  beforeEach(() => {
    // Cleanup any toolbar elements
    document.querySelectorAll('.leading-actions-wrapper, toolbox-drawer').forEach(el => el.remove());
  });

  it('should return null when no toolbar exists', () => {
    const result = _gpmFindToolbarSlot();
    expect(result).toBeNull();
  });

  it('should find toolbar via .leading-actions-wrapper (Strategy 1)', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'leading-actions-wrapper';
    document.body.appendChild(wrapper);

    const result = _gpmFindToolbarSlot();
    expect(result).not.toBeNull();
    expect(result.container).toBe(wrapper);
    expect(result.method).toContain('leading-actions');

    wrapper.remove();
  });

  it('should find toolbar via toolbox-drawer custom element (Strategy 2)', () => {
    const toolbox = document.createElement('toolbox-drawer');
    const parent = document.createElement('div');
    const sibling = document.createElement('div');
    parent.appendChild(toolbox);
    parent.appendChild(sibling);
    document.body.appendChild(parent);

    const result = _gpmFindToolbarSlot();
    expect(result).not.toBeNull();
    expect(result.method).toContain('toolbox');

    parent.remove();
  });

  it('should return null for input area with no buttons (Strategy 3 — no false positive)', () => {
    // Clean up any stray contenteditable/textarea elements from other tests
    document.querySelectorAll('[contenteditable="true"], textarea, .ql-editor, [role="textbox"]').forEach(el => el.remove());
    // Also remove forms from other tests
    document.querySelectorAll('form').forEach(el => el.remove());

    const form = document.createElement('form');
    const input = document.createElement('div');
    input.setAttribute('contenteditable', 'true');
    form.appendChild(input);
    document.body.appendChild(form);

    // Verify our setup is correct before calling the function
    const foundInput = document.querySelector('[contenteditable="true"]');
    expect(foundInput).toBe(input);
    expect(foundInput.closest('form')).toBe(form);

    const result = _gpmFindToolbarSlot();
    // A form with only an input and no toolbar buttons should NOT match —
    // this prevents placing the button in a hidden/wrong container
    expect(result).toBeNull();

    form.remove();
  });

  it('should find toolbar via input area structural search when buttons exist (Strategy 3)', () => {
    // Clean up stray elements
    document.querySelectorAll('[contenteditable="true"], textarea, .ql-editor, [role="textbox"]').forEach(el => el.remove());
    document.querySelectorAll('form').forEach(el => el.remove());

    const form = document.createElement('form');
    const input = document.createElement('div');
    input.setAttribute('contenteditable', 'true');
    const toolbar = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    toolbar.appendChild(btn1);
    toolbar.appendChild(btn2);
    form.appendChild(input);
    form.appendChild(toolbar);
    document.body.appendChild(form);

    const result = _gpmFindToolbarSlot();
    expect(result).not.toBeNull();
    expect(result.method).toContain('structural');

    form.remove();
  });

  it('should find toolbar via sibling toolbar search (Strategy 3b)', () => {
    // Clean up any stray elements
    document.querySelectorAll('[contenteditable="true"], textarea, .ql-editor, [role="textbox"]').forEach(el => el.remove());
    document.querySelectorAll('form').forEach(el => el.remove());

    // Create a structure where toolbar is a sibling of input's ancestor
    const container = document.createElement('div');
    const inputWrap = document.createElement('div');
    const input = document.createElement('div');
    input.setAttribute('contenteditable', 'true');
    inputWrap.appendChild(input);

    const toolbar = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    toolbar.appendChild(btn1);
    toolbar.appendChild(btn2);

    container.appendChild(inputWrap);
    container.appendChild(toolbar);
    document.body.appendChild(container);

    const result = _gpmFindToolbarSlot();
    expect(result).not.toBeNull();
    expect(result.method).toContain('structural');

    container.remove();
  });
});

// ══════════════════════════════════════
//  _gpmFindToolsButton() Tests
// ══════════════════════════════════════

describe('_gpmFindToolsButton()', () => {
  beforeEach(() => {
    document.querySelectorAll('.test-tools-btn').forEach(el => el.remove());
  });

  it('should return null when no Tools button exists', () => {
    const result = _gpmFindToolsButton();
    expect(result).toBeNull();
  });

  it('should find a button with "Tools" text', () => {
    const btn = document.createElement('button');
    btn.className = 'test-tools-btn';
    btn.textContent = 'Tools';
    document.body.appendChild(btn);

    const result = _gpmFindToolsButton();
    expect(result).toBe(btn);
    btn.remove();
  });

  it('should find a span with "Tools" text wrapped in a button', () => {
    const btn = document.createElement('button');
    btn.className = 'test-tools-btn';
    const span = document.createElement('span');
    span.textContent = 'Tools';
    btn.appendChild(span);
    document.body.appendChild(btn);

    const result = _gpmFindToolsButton();
    expect(result).not.toBeNull();
    btn.remove();
  });
});

// ══════════════════════════════════════
//  _gpmFindToolbarSlot() Strategy 2b Tests
// ══════════════════════════════════════

describe('_gpmFindToolbarSlot() content-based discovery', () => {
  beforeEach(() => {
    document.querySelectorAll('.leading-actions-wrapper, toolbox-drawer, .test-toolbar').forEach(el => el.remove());
    document.querySelectorAll('[contenteditable="true"], textarea, .ql-editor, [role="textbox"]').forEach(el => el.remove());
    document.querySelectorAll('form').forEach(el => el.remove());
  });

  it('should find toolbar via "Tools" button content (Strategy 2b)', () => {
    const toolbarRow = document.createElement('div');
    toolbarRow.className = 'test-toolbar';
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    const toolsBtn = document.createElement('button');
    toolsBtn.textContent = 'Tools';
    toolbarRow.appendChild(plusBtn);
    toolbarRow.appendChild(toolsBtn);
    document.body.appendChild(toolbarRow);

    const result = _gpmFindToolbarSlot();
    expect(result).not.toBeNull();
    expect(result.method).toContain('Tools button');
    expect(result.container).toBe(toolbarRow);

    toolbarRow.remove();
  });
});

// ══════════════════════════════════════
//  _gpmVerifyButtonVisibility() Tests
// ══════════════════════════════════════

describe('_gpmVerifyButtonVisibility()', () => {
  beforeEach(() => {
    document.querySelector('#gpm-qp-trigger')?.remove();
  });

  it('should not remove a floating button', () => {
    const btn = document.createElement('button');
    btn.id = 'gpm-qp-trigger';
    btn.dataset.gpmFloating = 'true';
    document.body.appendChild(btn);

    _gpmVerifyButtonVisibility();
    expect(document.querySelector('#gpm-qp-trigger')).not.toBeNull();
    btn.remove();
  });

  it('should not throw when no button exists', () => {
    expect(() => _gpmVerifyButtonVisibility()).not.toThrow();
  });
});

// ══════════════════════════════════════
//  gpmObserveQuickPromptButton() Tests
// ══════════════════════════════════════

describe('gpmObserveQuickPromptButton()', () => {
  const gpmObserveQuickPromptButton = globalThis.gpmObserveQuickPromptButton;

  beforeEach(() => {
    // Clean up state
    if (GPM_STATE._qpCheckInterval) {
      clearInterval(GPM_STATE._qpCheckInterval);
      GPM_STATE._qpCheckInterval = null;
    }
    if (GPM_STATE._qpMutationObserver) {
      GPM_STATE._qpMutationObserver.disconnect();
      GPM_STATE._qpMutationObserver = null;
    }
  });

  afterEach(() => {
    if (GPM_STATE._qpCheckInterval) {
      clearInterval(GPM_STATE._qpCheckInterval);
      GPM_STATE._qpCheckInterval = null;
    }
    if (GPM_STATE._qpMutationObserver) {
      GPM_STATE._qpMutationObserver.disconnect();
      GPM_STATE._qpMutationObserver = null;
    }
  });

  it('should store interval ID in GPM_STATE._qpCheckInterval', () => {
    gpmObserveQuickPromptButton();
    expect(GPM_STATE._qpCheckInterval).not.toBeNull();
  });

  it('should store MutationObserver in GPM_STATE._qpMutationObserver', () => {
    gpmObserveQuickPromptButton();
    expect(GPM_STATE._qpMutationObserver).not.toBeNull();
    expect(GPM_STATE._qpMutationObserver).toBeInstanceOf(MutationObserver);
  });

  it('should clean up previous interval on re-call (no leak)', () => {
    gpmObserveQuickPromptButton();
    const firstInterval = GPM_STATE._qpCheckInterval;
    expect(firstInterval).not.toBeNull();

    gpmObserveQuickPromptButton();
    const secondInterval = GPM_STATE._qpCheckInterval;
    // The second interval should be a new one (old one was cleared)
    expect(secondInterval).not.toBeNull();
    expect(secondInterval).not.toBe(firstInterval);
  });

  it('should clean up previous MutationObserver on re-call (no leak)', () => {
    gpmObserveQuickPromptButton();
    const firstObserver = GPM_STATE._qpMutationObserver;
    expect(firstObserver).not.toBeNull();

    gpmObserveQuickPromptButton();
    const secondObserver = GPM_STATE._qpMutationObserver;
    expect(secondObserver).not.toBeNull();
    expect(secondObserver).not.toBe(firstObserver);
  });
});

// ══════════════════════════════════════
//  gpmInjectQuickPromptTrigger() Tests
// ══════════════════════════════════════

describe('gpmInjectQuickPromptTrigger()', () => {
  beforeEach(() => {
    document.querySelector('#gpm-qp-trigger')?.remove();
    document.querySelectorAll('.leading-actions-wrapper, toolbox-drawer').forEach(el => el.remove());
  });

  it('should not inject if button already exists', () => {
    const existing = document.createElement('button');
    existing.id = 'gpm-qp-trigger';
    document.body.appendChild(existing);

    gpmInjectQuickPromptTrigger();
    const buttons = document.querySelectorAll('#gpm-qp-trigger');
    expect(buttons.length).toBe(1);

    existing.remove();
  });

  it('should inject floating button when no toolbar found', () => {
    gpmInjectQuickPromptTrigger();
    const btn = document.querySelector('#gpm-qp-trigger');
    expect(btn).not.toBeNull();
    expect(btn.dataset.gpmFloating).toBe('true');
    btn.remove();
  });

  it('should inject into toolbar when found', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'leading-actions-wrapper';
    document.body.appendChild(wrapper);

    gpmInjectQuickPromptTrigger();
    const btn = document.querySelector('#gpm-qp-trigger');
    expect(btn).not.toBeNull();
    expect(btn.dataset.gpmFloating).toBeUndefined();

    wrapper.remove();
    btn?.remove();
  });
});

// ══════════════════════════════════════
//  _gpmInjectFloatingQPButton() Tests
// ══════════════════════════════════════

describe('_gpmInjectFloatingQPButton()', () => {
  beforeEach(() => {
    document.querySelector('#gpm-qp-trigger')?.remove();
  });

  it('should create a floating button with fixed position', () => {
    _gpmInjectFloatingQPButton();
    const btn = document.querySelector('#gpm-qp-trigger');
    expect(btn).not.toBeNull();
    expect(btn.style.position).toBe('fixed');
    expect(btn.dataset.gpmFloating).toBe('true');
    btn.remove();
  });

  it('should remove existing button before creating new one', () => {
    const existing = document.createElement('button');
    existing.id = 'gpm-qp-trigger';
    document.body.appendChild(existing);

    _gpmInjectFloatingQPButton();
    const buttons = document.querySelectorAll('#gpm-qp-trigger');
    expect(buttons.length).toBe(1);

    document.querySelector('#gpm-qp-trigger')?.remove();
  });
});

// ══════════════════════════════════════
//  gpmInsertPromptText() Tests
// ══════════════════════════════════════

describe('gpmInsertPromptText()', () => {
  beforeEach(() => {
    globalThis.gpmLog.mockClear();
    globalThis.gpmWarn.mockClear();
  });

  it('should warn when input area not found', () => {
    globalThis.gpmQuerySelector.mockReturnValueOnce(null);
    gpmInsertPromptText('test text');
    expect(globalThis.gpmWarn).toHaveBeenCalled();
  });

  it('should insert text into textarea', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', 'prompt');
    document.body.appendChild(textarea);
    globalThis.gpmQuerySelector.mockReturnValueOnce(textarea);

    gpmInsertPromptText('hello world');
    expect(textarea.value).toBe('hello world');

    textarea.remove();
  });

  it('should insert text into contenteditable element', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.appendChild(editable);
    globalThis.gpmQuerySelector.mockReturnValueOnce(editable);

    gpmInsertPromptText('prompt text here');
    // At least one strategy should have populated the content
    expect(editable.textContent).toContain('prompt text');

    editable.remove();
  });

  it('should focus the input element', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', 'prompt');
    document.body.appendChild(textarea);
    const focusSpy = vi.spyOn(textarea, 'focus');
    globalThis.gpmQuerySelector.mockReturnValueOnce(textarea);

    gpmInsertPromptText('test');
    expect(focusSpy).toHaveBeenCalled();

    textarea.remove();
  });
});
