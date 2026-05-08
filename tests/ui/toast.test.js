import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, afterEach } from 'vitest';

const code = readFileSync(resolve('src/ui/toast.js'), 'utf-8');
new Function(code)();

describe('showToast', () => {
  afterEach(() => {
    const container = document.getElementById('gpm-toast-container');
    if (container) container.remove();
  });

  it('creates toast with message text', () => {
    const toast = window.showToast('Hello world');
    expect(toast).toBeTruthy();
    expect(toast.querySelector('.gpm-toast-message').textContent).toBe('Hello world');
    expect(document.getElementById('gpm-toast-container')).toBeTruthy();
  });

  it('applies correct type class', () => {
    const t1 = window.showToast('ok', 'success');
    expect(t1.classList.contains('gpm-toast-success')).toBe(true);

    const t2 = window.showToast('no', 'error');
    expect(t2.classList.contains('gpm-toast-error')).toBe(true);

    const t3 = window.showToast('warn', 'warning');
    expect(t3.classList.contains('gpm-toast-warning')).toBe(true);

    const t4 = window.showToast('info', 'info');
    expect(t4.classList.contains('gpm-toast-info')).toBe(true);
  });

  it('auto-removes after duration', () => {
    vi.useFakeTimers();
    const toast = window.showToast('gone soon', 'info', { duration: 2000 });
    const container = document.getElementById('gpm-toast-container');
    expect(container.contains(toast)).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(toast.classList.contains('gpm-toast-exit')).toBe(true);

    vi.advanceTimersByTime(300);
    expect(container.contains(toast)).toBe(false);
  });

  it('shows undo button when undoAction provided', () => {
    const toast = window.showToast('deleted', 'info', { undoAction: () => {} });
    const undoBtn = toast.querySelector('.gpm-toast-undo');
    expect(undoBtn).toBeTruthy();
    expect(undoBtn.textContent).toBe('Undo');
  });

  it('calls undoAction on undo click', () => {
    const spy = vi.fn();
    const toast = window.showToast('deleted', 'info', { undoAction: spy });
    const undoBtn = toast.querySelector('.gpm-toast-undo');
    undoBtn.click();
    expect(spy).toHaveBeenCalledOnce();
    expect(toast.classList.contains('gpm-toast-exit')).toBe(true);
  });

  it('stacks max 3 and removes oldest', () => {
    const t1 = window.showToast('first', 'info');
    const _t2 = window.showToast('second', 'info');
    const _t3 = window.showToast('third', 'info');
    const container = document.getElementById('gpm-toast-container');
    expect(container.querySelectorAll('.gpm-toast').length).toBe(3);

    const t4 = window.showToast('fourth', 'info');
    expect(container.querySelectorAll('.gpm-toast').length).toBe(3);
    expect(container.contains(t1)).toBe(false);
    expect(container.contains(t4)).toBe(true);
  });
});
