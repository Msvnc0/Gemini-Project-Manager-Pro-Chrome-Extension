import { readFileSync } from 'fs';
import { resolve } from 'path';

globalThis.GPM_STATE = {
  container: null,
  modalRoot: null,
};

globalThis.GPMHistory = {
  undo: vi.fn(),
  redo: vi.fn(),
};

globalThis.GPMUI = {
  showBackupPanel: vi.fn(),
};

globalThis.gpmLog = vi.fn();
globalThis.gpmShowCreateProjectModal = vi.fn();
globalThis.gpmTriggerNewChat = vi.fn();

const shortcutsCode = readFileSync(resolve('src/keyboard/shortcuts.js'), 'utf-8');
const patchedCode = shortcutsCode.replace(/^const GPMKeyboardShortcuts = /m, 'globalThis.GPMKeyboardShortcuts = ');

new Function(patchedCode)();

const { GPMKeyboardShortcuts } = globalThis;

describe('GPMKeyboardShortcuts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    GPMKeyboardShortcuts.init();
  });

  afterEach(() => {});

  it('contenteditable içinde space tuşunu engellemez', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    document.body.appendChild(editor);

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    editor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('GPM item focus durumunda space ile toggle çalışır', () => {
    const item = document.createElement('div');
    item.setAttribute('data-gpm', 'item');
    item.setAttribute('tabindex', '0');
    const clickSpy = vi.spyOn(item, 'click');
    document.body.appendChild(item);
    item.focus();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    item.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('contenteditable içinde Escape tuşuna izin verir', () => {
    const overlay = document.createElement('div');
    overlay.className = 'gpm-overlay';
    document.body.appendChild(overlay);

    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    document.body.appendChild(editor);

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    editor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('.gpm-overlay')).toBeNull();
  });

  it('init iki kez çağrılsa da kısayol tek kez çalışır', () => {
    GPMKeyboardShortcuts.init();

    const item = document.createElement('div');
    item.setAttribute('data-gpm', 'item');
    item.setAttribute('tabindex', '0');
    const clickSpy = vi.spyOn(item, 'click');
    document.body.appendChild(item);
    item.focus();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    item.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
