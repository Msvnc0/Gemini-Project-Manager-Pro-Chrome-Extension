# Phase 0: Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical runtime bugs: missing showToast, missing bulk modals, missing create tag modal, tag schema conflict, and XSS vulnerabilities.

**Architecture:** Each fix is self-contained. Toast system is a new module. Bulk modals wrap existing functions. Tag schema unification adds a migration. XSS fixes replace innerHTML with DOM API.

**Tech Stack:** Vanilla JS (Chrome Extension MV3), Vitest for testing, jsdom for DOM mocking.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/ui/toast.js` | CREATE | Central toast notification system |
| `src/project-tree.js` | MODIFY | Replace showToast bare calls with import; fix innerHTML in bulk toolbar |
| `src/tags/tag-ui.js` | MODIFY | Implement showCreateTagModal |
| `src/tags/tags-manager.js` | MODIFY | Convert to thin wrapper over GPMStorage |
| `src/ui_elements.js` | MODIFY | Remove innerHTML from createModal, showTemplateDialog, showBackupPanel |
| `src/storage.js` | MODIFY | Add tag schema migration (v3→v4) |
| `src/content.js` | MODIFY | Register showToast global |
| `src/styles.css` | MODIFY | Add toast styles |
| `manifest.json` | MODIFY | Add toast.js to content_scripts |
| `tests/ui/toast.test.js` | CREATE | Toast system tests |

---

### Task 1: Create Toast Notification System

**Files:**
- Create: `src/ui/toast.js`
- Create: `tests/ui/toast.test.js`
- Modify: `src/styles.css` (append toast styles)

- [ ] **Step 1: Write failing test for showToast**

```js
// tests/ui/toast.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../tests/mocks/chrome.js';

let showToast, removeToastContainer;

beforeEach(async () => {
  document.body.innerHTML = '<div id="gpm-toast-container"></div>';
  const mod = await import('../src/ui/toast.js');
  showToast = mod.showToast;
  removeToastContainer = mod.removeToastContainer;
});

describe('showToast', () => {
  it('creates a toast element with message text', () => {
    showToast('Hello', 'info');
    const container = document.getElementById('gpm-toast-container');
    const toast = container.querySelector('.gpm-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Hello');
  });

  it('applies correct type class', () => {
    showToast('Error!', 'error');
    const container = document.getElementById('gpm-toast-container');
    const toast = container.querySelector('.gpm-toast');
    expect(toast.classList.contains('gpm-toast-error')).toBe(true);
  });

  it('auto-removes after duration', () => {
    vi.useFakeTimers();
    showToast('Bye', 'info', { duration: 1000 });
    const container = document.getElementById('gpm-toast-container');
    expect(container.querySelector('.gpm-toast')).toBeTruthy();
    vi.advanceTimersByTime(1100);
    expect(container.querySelector('.gpm-toast')).toBeNull();
    vi.useRealTimers();
  });

  it('shows undo button when undoAction provided', () => {
    showToast('Deleted', 'info', { undoAction: () => {} });
    const container = document.getElementById('gpm-toast-container');
    expect(container.querySelector('.gpm-toast-undo')).toBeTruthy();
  });

  it('calls undoAction when undo button clicked', () => {
    const undoFn = vi.fn();
    showToast('Deleted', 'info', { undoAction: undoFn });
    const container = document.getElementById('gpm-toast-container');
    container.querySelector('.gpm-toast-undo').click();
    expect(undoFn).toHaveBeenCalled();
  });

  it('stacks max 3 toasts, removes oldest', () => {
    showToast('A', 'info');
    showToast('B', 'info');
    showToast('C', 'info');
    showToast('D', 'info');
    const container = document.getElementById('gpm-toast-container');
    const toasts = container.querySelectorAll('.gpm-toast');
    expect(toasts.length).toBe(3);
    expect(toasts[0].textContent).toContain('B');
    expect(toasts[2].textContent).toContain('D');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/toast.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write toast.js implementation**

```js
// src/ui/toast.js

const GPM_TOAST_MAX = 3;

function _getContainer() {
  let container = document.getElementById('gpm-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'gpm-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function _getDuration(type, options) {
  if (options?.duration !== undefined) return options.duration;
  return type === 'error' ? 5000 : 3000;
}

function showToast(message, type = 'info', options = {}) {
  const container = _getContainer();

  const existing = container.querySelectorAll('.gpm-toast');
  while (existing.length >= GPM_TOAST_MAX) {
    existing[0].remove();
  }

  const toast = document.createElement('div');
  toast.className = `gpm-toast gpm-toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  const msgSpan = document.createElement('span');
  msgSpan.className = 'gpm-toast-message';
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (options.undoAction) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'gpm-toast-undo';
    undoBtn.type = 'button';
    undoBtn.textContent = typeof t === 'function' ? (t('undo') || 'Undo') : 'Undo';
    undoBtn.addEventListener('click', () => {
      options.undoAction();
      toast.remove();
    });
    toast.appendChild(undoBtn);
  }

  if (options.progress) {
    const bar = document.createElement('div');
    bar.className = 'gpm-toast-progress';
    toast.appendChild(bar);
  }

  const duration = _getDuration(type, options);
  const timer = setTimeout(() => {
    toast.classList.add('gpm-toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  toast._gpmTimer = timer;

  container.appendChild(toast);
  return toast;
}

function removeToastContainer() {
  const container = document.getElementById('gpm-toast-container');
  if (container) container.remove();
}

window.showToast = showToast;
```

- [ ] **Step 4: Add toast CSS to styles.css**

Append to `src/styles.css`:

```css
#gpm-toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 99999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}
.gpm-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-family: "Google Sans", sans-serif;
  font-size: 13px;
  color: #fff;
  background: #323232;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: gpm-toast-in 300ms ease;
  max-width: 360px;
}
.gpm-toast-success { background: #1e7e34; }
.gpm-toast-error { background: #bd2130; }
.gpm-toast-warning { background: #d39e00; color: #212529; }
.gpm-toast-info { background: #323232; }
.gpm-toast-exit { animation: gpm-toast-out 300ms ease forwards; }
.gpm-toast-message { flex: 1; }
.gpm-toast-undo {
  background: none;
  border: none;
  color: #8ab4f8;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 13px;
}
.gpm-toast-undo:hover { text-decoration: underline; }
.gpm-toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: rgba(255,255,255,0.4);
  border-radius: 0 0 8px 8px;
  width: 100%;
  animation: gpm-toast-progress 3s linear;
}
@keyframes gpm-toast-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes gpm-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(10px); } }
@keyframes gpm-toast-progress { from { width: 100%; } to { width: 0%; } }
```

- [ ] **Step 5: Add toast.js to manifest.json content_scripts**

In `manifest.json`, add `"src/ui/toast.js"` to the `content_scripts[0].js` array, right before `"src/config.js"`:

```json
"js": [
  "src/i18n.js",
  "src/utils/uid.js",
  "src/utils/validators.js",
  "src/storage.js",
  "src/selectors.js",
  "src/ui/toast.js",
  "src/ui_elements.js",
  "src/config.js",
  ...
]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/ui/toast.test.js`
Expected: All 6 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/toast.js tests/ui/toast.test.js src/styles.css manifest.json
git commit -m "feat: add central toast notification system (fixes #1.1)"
```

---

### Task 2: Implement showBulkMoveModal and showBulkTagModal

**Files:**
- Modify: `src/project-tree.js` (lines 1066-1093, 1095-1107)

- [ ] **Step 1: Replace innerHTML bulk toolbar with DOM construction**

Replace lines 1064-1092 in `src/project-tree.js` (the `gpmUpdateBulkToolbar` function):

```js
function gpmUpdateBulkToolbar() {
  const existing = document.querySelector('.gpm-bulk-toolbar');
  if (existing) existing.remove();

  if (!GPM_STATE.bulkSelection.active || GPM_STATE.bulkSelection.selectedChatIds.size === 0) return;

  const count = GPM_STATE.bulkSelection.selectedChatIds.size;
  const toolbar = document.createElement('div');
  toolbar.className = 'gpm-bulk-toolbar';

  const countSpan = document.createElement('span');
  countSpan.className = 'gpm-bulk-count';
  countSpan.textContent = count + ' ' + t('selected');
  toolbar.appendChild(countSpan);

  const moveBtn = document.createElement('button');
  moveBtn.className = 'gpm-btn gpm-btn-sm';
  moveBtn.type = 'button';
  moveBtn.dataset.action = 'move';
  moveBtn.textContent = t('moveSelected');
  toolbar.appendChild(moveBtn);

  const tagBtn = document.createElement('button');
  tagBtn.className = 'gpm-btn gpm-btn-sm';
  tagBtn.type = 'button';
  tagBtn.dataset.action = 'tag';
  tagBtn.textContent = t('tagSelected');
  toolbar.appendChild(tagBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'gpm-btn gpm-btn-sm gpm-btn-danger';
  deleteBtn.type = 'button';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.textContent = t('delete');
  toolbar.appendChild(deleteBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'gpm-btn gpm-btn-sm gpm-btn-secondary';
  cancelBtn.type = 'button';
  cancelBtn.dataset.action = 'cancel';
  cancelBtn.textContent = t('cancel');
  toolbar.appendChild(cancelBtn);

  toolbar.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    switch (action) {
      case 'move':
        showBulkMoveModal();
        break;
      case 'tag':
        showBulkTagModal();
        break;
      case 'delete':
        const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
        for (const id of chatIds) await GPMStorage.unassignChat(id);
        showToast(t('removedChats').replace('{count}', chatIds.length));
        gpmClearBulkSelection();
        break;
      case 'cancel':
        gpmClearBulkSelection();
        break;
    }
  });

  if (GPM_STATE.container) GPM_STATE.container.appendChild(toolbar);
}
```

- [ ] **Step 2: Add showBulkMoveModal function**

Add after `gpmBulkAssignTags` (after line 1107):

```js
function showBulkMoveModal() {
  if (!GPM_STATE.modalRoot) return;
  const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
  if (chatIds.length === 0) return;

  GPMStorage.getProjects().then((projects) => {
    const rootProjects = GPMStorage.getRootProjects(projects);
    const items = rootProjects.map((p) => ({
      icon: p.icon,
      label: p.name,
      action: async () => {
        await gpmBulkMoveToProject(p.id);
      },
    }));

    GPMUI.showContextMenu(GPM_STATE.modalRoot, {
      x: Math.round(window.innerWidth / 2 - 90),
      y: Math.round(window.innerHeight / 2 - 100),
      items,
    });
  });
}

function showBulkTagModal() {
  if (!GPM_STATE.modalRoot) return;
  const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
  if (chatIds.length === 0) return;

  const tagItems = GPMTagsManager.DEFAULT_TAGS.map((tag) => ({
    icon: tag.icon,
    label: tag.name,
    action: async () => {
      await gpmBulkAssignTags([tag.id]);
    },
  }));

  GPMUI.showContextMenu(GPM_STATE.modalRoot, {
    x: Math.round(window.innerWidth / 2 - 90),
    y: Math.round(window.innerHeight / 2 - 100),
    items: tagItems,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "feat: implement showBulkMoveModal and showBulkTagModal, fix innerHTML in bulk toolbar"
```

---

### Task 3: Implement showCreateTagModal

**Files:**
- Modify: `src/tags/tag-ui.js` (lines 52-54)

- [ ] **Step 1: Replace empty stub with full implementation**

Replace the empty `showCreateTagModal` function (lines 52-54) with:

```js
function showCreateTagModal(onSave) {
  if (!GPM_STATE?.modalRoot) return;

  let tagName = '';
  let tagColor = GPM_TAG_COLORS[0];

  const overlay = document.createElement('div');
  overlay.className = 'gpm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'gpm-modal';
  modal.style.cssText = 'width:360px;padding:24px;';

  const header = document.createElement('div');
  header.className = 'gpm-modal-header-sm';
  const titleEl = document.createElement('div');
  titleEl.className = 'gpm-modal-title';
  titleEl.textContent = typeof t === 'function' ? (t('addTag') || 'Add Tag') : 'Add Tag';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '\u2715';
  closeBtn.className = 'gpm-close-btn';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.append(titleEl, closeBtn);

  const nameInput = document.createElement('input');
  nameInput.className = 'gpm-input';
  nameInput.type = 'text';
  nameInput.placeholder = typeof t === 'function' ? (t('tagName') || 'Tag name') : 'Tag name';
  nameInput.addEventListener('input', () => { tagName = nameInput.value; });

  const colorGrid = document.createElement('div');
  colorGrid.className = 'gpm-color-grid';
  GPM_TAG_COLORS.forEach((color) => {
    const swatch = document.createElement('div');
    swatch.className = 'gpm-color-swatch' + (color === tagColor ? ' gpm-selected' : '');
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.addEventListener('click', () => {
      tagColor = color;
      colorGrid.querySelectorAll('.gpm-color-swatch').forEach((s) => {
        s.classList.toggle('gpm-selected', s.dataset.color === color);
      });
    });
    colorGrid.appendChild(swatch);
  });

  const footer = document.createElement('div');
  footer.className = 'gpm-btn-row';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'gpm-btn gpm-btn-ghost';
  cancelBtn.type = 'button';
  cancelBtn.textContent = typeof t === 'function' ? (t('cancel') || 'Cancel') : 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());
  const saveBtn = document.createElement('button');
  saveBtn.className = 'gpm-btn gpm-btn-primary';
  saveBtn.type = 'button';
  saveBtn.textContent = typeof t === 'function' ? (t('save') || 'Save') : 'Save';
  saveBtn.addEventListener('click', () => {
    if (!tagName.trim()) { nameInput.focus(); return; }
    overlay.remove();
    if (onSave) onSave({ name: tagName.trim(), color: tagColor });
  });
  footer.append(cancelBtn, saveBtn);

  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'gpm-field';
  fieldDiv.style.marginBottom = '16px';
  fieldDiv.appendChild(nameInput);

  modal.append(header, fieldDiv, colorGrid, footer);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  GPM_STATE.modalRoot.appendChild(overlay);
  setTimeout(() => nameInput.focus(), 50);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tags/tag-ui.js
git commit -m "feat: implement showCreateTagModal with name input and color picker"
```

---

### Task 4: Tag Schema Unification

**Files:**
- Modify: `src/tags/tags-manager.js` — convert to wrapper over GPMStorage
- Modify: `src/storage.js` — add migration v3→v4, add icon/parentId fields to tag schema

- [ ] **Step 1: Add tag schema migration in storage.js**

Add migration v4 in the MIGRATIONS object (after the v3 migration, around line 53):

```js
4: (data) => {
  if (data.gpm_tags && Array.isArray(data.gpm_tags)) {
    const migrated = {};
    data.gpm_tags.forEach((tag) => {
      migrated[tag.id] = {
        id: tag.id,
        name: tag.nameEn || tag.name,
        color: tag.color || '#8ab4f8',
        icon: tag.icon || '',
        count: 0,
        parentId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
    data.gpm_tags = migrated;
  }
  return data;
},
```

Also update `GPM_SCHEMA_VERSION` from 3 to 4 (line 18):

```js
const GPM_SCHEMA_VERSION = 4;
```

And update the `createTag` function (line 315) to include new fields:

```js
async function createTag({ name, color = '#3b82f6', icon = '', parentId = null }) {
  const tags = await getTags();
  const id = uid();
  const tag = {
    id,
    name,
    color,
    icon,
    count: 0,
    parentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tags[id] = tag;
  await saveTags(tags);
  return tag;
}
```

- [ ] **Step 2: Convert tags-manager.js to thin wrapper**

Replace the entire `GPMTagsManager` with a wrapper that delegates to `GPMStorage`:

```js
const GPMTagsManager = (() => {
  const DEFAULT_TAGS = [
    { id: 'important', name: 'Important', color: '#f28b82', icon: '\u2B50' },
    { id: 'urgent', name: 'Urgent', color: '#fdd663', icon: '\uD83D\uDEA8' },
    { id: 'work', name: 'Work', color: '#8ab4f8', icon: '\uD83D\uDCBC' },
    { id: 'personal', name: 'Personal', color: '#81c995', icon: '\uD83C\uDFE0' },
    { id: 'reference', name: 'Reference', color: '#c4c4c4', icon: '\uD83D\uDCDA' },
  ];

  async function _ensureDefaults() {
    const tags = await GPMStorage.getTags();
    let changed = false;
    for (const def of DEFAULT_TAGS) {
      if (!tags[def.id]) {
        tags[def.id] = {
          id: def.id,
          name: def.name,
          color: def.color,
          icon: def.icon,
          count: 0,
          parentId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        changed = true;
      }
    }
    if (changed) await GPMStorage.saveTags(tags);
    return tags;
  }

  async function getTags() {
    await _ensureDefaults();
    return GPMStorage.getTags();
  }

  async function saveTags(tags) {
    return GPMStorage.saveTags(tags);
  }

  async function createTag({ name, color, icon }) {
    return GPMStorage.createTag({ name, color, icon });
  }

  async function updateTag(id, updates) {
    return GPMStorage.updateTag(id, updates);
  }

  async function deleteTag(id) {
    return GPMStorage.deleteTag(id);
  }

  async function addTagToChat(chatId, tagId) {
    const chatMap = await GPMStorage.getChatMap();
    if (!chatMap[chatId]) return false;
    const currentTags = chatMap[chatId].tags || [];
    if (currentTags.length >= 5) return false;
    if (!currentTags.includes(tagId)) {
      currentTags.push(tagId);
      await GPMStorage.assignTagsToChat(chatId, currentTags);
    }
    return true;
  }

  async function removeTagFromChat(chatId, tagId) {
    return GPMStorage.removeTagFromChat(chatId, tagId);
  }

  async function getChatsByTag(tagId) {
    return GPMStorage.getChatsByTag(tagId);
  }

  return {
    getTags,
    saveTags,
    createTag,
    updateTag,
    deleteTag,
    addTagToChat,
    removeTagFromChat,
    getChatsByTag,
    DEFAULT_TAGS,
  };
})();
```

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/storage.js src/tags/tags-manager.js
git commit -m "fix: unify tag schema (v3→v4 migration), convert tags-manager to GPMStorage wrapper"
```

---

### Task 5: XSS Fix — innerHTML Cleanup in ui_elements.js

**Files:**
- Modify: `src/ui_elements.js`

- [ ] **Step 1: Fix createModal — replace innerHTML with DOM construction**

Replace the `contentEl` creation in `createModal` (lines 1198-1201):

```js
const contentEl = el('div', { className: 'gpm-modal-content' });
if (typeof content === 'string') {
  const parser = document.createElement('div');
  parser.textContent = content;
  contentEl.textContent = parser.textContent;
} else if (content instanceof Node) {
  contentEl.appendChild(content);
}
```

- [ ] **Step 2: Rewrite showTemplateDialog with DOM construction**

Replace the entire `showTemplateDialog` function (lines 1239-1295):

```js
function showTemplateDialog(shadowRoot, onSelect) {
  const templates = typeof getTemplateList === 'function' ? getTemplateList() : [];

  const overlay = createModal(shadowRoot, {
    title: '\uD83D\uDCC1 ' + (typeof t === 'function' ? (t('createFromTemplate') || 'Create from Template') : 'Create from Template'),
    content: null,
    buttons: [{ text: typeof t === 'function' ? (t('cancel') || 'Cancel') : 'Cancel', class: 'gpm-btn-ghost', action: 'cancel' }],
  });

  const modalContent = overlay.querySelector('.gpm-modal-content');
  if (!modalContent) return;

  const desc = el('p', {
    textContent: typeof t === 'function' ? (t('selectTemplateDesc') || 'Select a folder structure:') : 'Select a folder structure:',
    style: { marginBottom: '16px', opacity: '0.8' },
  });
  modalContent.appendChild(desc);

  const list = el('div', { className: 'gpm-template-list' });
  templates.forEach((tmpl) => {
    const item = el('button', {
      type: 'button',
      className: 'gpm-template-item',
      'data-template-id': tmpl.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px',
        marginBottom: '8px',
        background: 'var(--gpm-bg)',
        border: '1px solid var(--gpm-border)',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
      },
      onClick: () => {
        overlay.remove();
        onSelect?.(tmpl.id);
      },
    }, [
      el('span', { textContent: tmpl.icon, style: { fontSize: '24px' } }),
      el('div', {}, [
        el('div', { textContent: tmpl.name, style: { fontWeight: '500' } }),
        el('div', { textContent: tmpl.description || '', style: { fontSize: '12px', opacity: '0.6' } }),
      ]),
    ]);
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--gpm-bg-hover)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'var(--gpm-bg)'; });
    list.appendChild(item);
  });
  modalContent.appendChild(list);
}
```

- [ ] **Step 3: Rewrite showBackupPanel with DOM construction**

Replace the entire `showBackupPanel` function (lines 1298-1373):

```js
async function showBackupPanel(shadowRoot) {
  const backups = typeof GPMBackupManager !== 'undefined' ? await GPMBackupManager.getBackups() : [];

  const overlay = createModal(shadowRoot, {
    title: '\uD83D\uDCE6 ' + t('manageBackups'),
    content: null,
    buttons: [{ text: t('cancel'), class: 'gpm-btn-ghost', action: 'close' }],
  });

  const modalContent = overlay.querySelector('.gpm-modal-content');
  if (!modalContent) return;

  const createBtn = el('button', {
    className: 'gpm-btn gpm-btn-primary',
    textContent: '+ ' + t('newBackup'),
    type: 'button',
    style: { width: '100%', marginBottom: '16px' },
    onClick: async () => {
      if (typeof GPMBackupManager !== 'undefined') {
        await GPMBackupManager.createBackup('manual', t('newBackup'));
        overlay.remove();
        showBackupPanel(shadowRoot);
      }
    },
  });
  modalContent.appendChild(createBtn);

  if (backups.length === 0) {
    modalContent.appendChild(
      el('div', {
        textContent: t('noBackupsYet'),
        style: { textAlign: 'center', padding: '20px', opacity: '0.6' },
      })
    );
  } else {
    const listWrap = el('div', { style: { maxHeight: '300px', overflowY: 'auto' } });
    [...backups].reverse().forEach((b) => {
      const item = el('div', {
        className: 'gpm-backup-item',
        'data-backup-id': b.id,
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          marginBottom: '8px',
          background: 'var(--gpm-bg)',
          border: '1px solid var(--gpm-border)',
          borderRadius: '8px',
        },
      }, [
        el('div', {}, [
          el('div', {
            textContent: typeof GPMBackupManager !== 'undefined' ? GPMBackupManager.formatBackupDate(b.timestamp) : new Date(b.timestamp).toLocaleString(),
            style: { fontWeight: '500' },
          }),
          el('div', {
            textContent: t('projectsCount').replace('{count}', b.stats?.projectCount || 0) + ', ' + t('chatsCount').replace('{count}', b.stats?.chatCount || 0),
            style: { fontSize: '12px', opacity: '0.6' },
          }),
        ]),
        el('button', {
          className: 'gpm-btn gpm-btn-sm',
          textContent: t('restoreThisBackup'),
          type: 'button',
          'data-action': 'restore',
          onClick: async () => {
            if (typeof GPMBackupManager !== 'undefined') {
              GPMUI.showConfirmDialog(shadowRoot, {
                title: t('restoreBackup'),
                message: t('restoreBackupConfirm') || t('restoreConfirm'),
                confirmText: t('restoreBackup'),
                onConfirm: async () => {
                  await GPMBackupManager.restoreBackup(b.id);
                  gpmRenderTree();
                  overlay.remove();
                },
              });
            }
          },
        }),
      ]);
      listWrap.appendChild(item);
    });
    modalContent.appendChild(listWrap);
  }
}
```

- [ ] **Step 4: Fix innerHTML in tag-ui.js createTagSelector trigger**

In `src/tags/tag-ui.js`, line 36, replace:

```js
trigger.innerHTML = `<span class="gpm-tag-icon">\uD83C\uDFF7\uFE0F</span>`;
```

with:

```js
const tagIcon = document.createElement('span');
tagIcon.className = 'gpm-tag-icon';
tagIcon.textContent = '\uD83C\uDFF7\uFE0F';
trigger.appendChild(tagIcon);
```

- [ ] **Step 5: Run lint and tests**

Run: `npx vitest run && npm run lint`
Expected: All tests pass, no lint errors

- [ ] **Step 6: Commit**

```bash
git add src/ui_elements.js src/tags/tag-ui.js
git commit -m "fix: remove all innerHTML usage, replace with DOM API (XSS fix)"
```

---

### Task 6: Verify All Bug Fixes

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: cleanup after Phase 0 bug fixes"
```
