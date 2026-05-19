# Codebase Audit Fixes — Comprehensive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs, remove dead code, and improve code quality across the entire GPM codebase (22 files) based on the comprehensive audit findings.

**Architecture:** Content scripts share a global scope (no import/export). Loading order is defined in manifest.json. background.js is a separate service worker context. All fixes must preserve the existing loading order and global scope pattern.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS (no build step), Vitest for testing.

---

## Phase 1: Critical Data Loss Bugs (Tasks 1–3)

### Task 1: Fix `gpm_backups` deletion in migration v5

`gpm_backups` is actively used by `backup-manager.js` but migration v5 and background.js legacy cleanup both delete it. Users migrating from v4→v5 lose all backup versions silently.

**Files:**
- Modify: `src/storage.js:20-34` (GPM_LEGACY_KEYS)
- Modify: `src/background.js:159-172` (legacyKeys)

- [ ] **Step 1: Remove `gpm_backups` from GPM_LEGACY_KEYS in storage.js**

In `src/storage.js`, remove `'gpm_backups'` from the `GPM_LEGACY_KEYS` array (line 32):

```js
const GPM_LEGACY_KEYS = [
  'gpm_projects_backup',
  'gpm_backup_ts',
  'gpm_chatMap_backup',
  'gpm_pre_import_projects',
  'gpm_pre_import_chatMap',
  'gpm_pre_import_quickPrompts',
  'gpm_pre_import_ts',
  'gpm_pre_migration_backup',
  'gpm_update_backup',
  'gpm_emergency_backup_before_reset',
  'gpm_projects_pre_restore',
  'gpm_tags',
];
```

- [ ] **Step 2: Remove `gpm_backups` from legacyKeys in background.js**

In `src/background.js`, remove `'gpm_backups'` from the `legacyKeys` array (line 171):

```js
const legacyKeys = [
  'gpm_projects_backup',
  'gpm_backup_ts',
  'gpm_chatMap_backup',
  'gpm_pre_import_projects',
  'gpm_pre_import_chatMap',
  'gpm_pre_import_quickPrompts',
  'gpm_pre_import_ts',
  'gpm_pre_migration_backup',
  'gpm_update_backup',
  'gpm_emergency_backup_before_reset',
  'gpm_projects_pre_restore',
];
```

- [ ] **Step 3: Also add missing `gpm_tags` to background.js legacyKeys**

The audit found `gpm_tags` is in storage.js but missing from background.js. Add it:

```js
const legacyKeys = [
  'gpm_projects_backup',
  'gpm_backup_ts',
  'gpm_chatMap_backup',
  'gpm_pre_import_projects',
  'gpm_pre_import_chatMap',
  'gpm_pre_import_quickPrompts',
  'gpm_pre_import_ts',
  'gpm_pre_migration_backup',
  'gpm_update_backup',
  'gpm_emergency_backup_before_reset',
  'gpm_projects_pre_restore',
  'gpm_tags',
];
```

- [ ] **Step 4: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/background.js
git commit -m "fix: remove gpm_backups from legacy key deletion, sync legacy lists"
```

---

### Task 2: Add `_withLock` to unprotected write operations in storage.js

7 write operations bypass the lock mechanism, risking concurrent data corruption across tabs.

**Files:**
- Modify: `src/storage.js` (functions: `saveProjects`, `updateProject`, `saveChatMap`, `setChatAlias`, `togglePinChat`, `toggleStarChat`, `clearAll`)

- [ ] **Step 1: Wrap `saveProjects` with `_withLock`**

In `src/storage.js`, replace the `saveProjects` function (lines 226-233):

```js
async function saveProjects(projects) {
  return _withLock(async () => {
    const current = await _get('gpm_projects');
    const chatMap = await _get('gpm_chatMap');
    if (current && Array.isArray(current) && current.length > 0) {
      await _writeBackup('auto', { projects: current, chatMap: chatMap });
    }
    await _set('gpm_projects', projects);
  });
}
```

- [ ] **Step 2: Wrap `updateProject` with `_withLock`**

Replace `updateProject` (lines 250-257):

```js
async function updateProject(id, updates) {
  return _withLock(async () => {
    const projects = await getProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    Object.assign(projects[idx], updates);
    await saveProjects(projects);
    return projects[idx];
  });
}
```

Note: `updateProject` calls `saveProjects` which is now also locked. Since `_withLock` chains via promise, nested calls will queue correctly. However, to avoid double-locking, make `updateProject` call `_set` directly inside the lock instead:

```js
async function updateProject(id, updates) {
  return _withLock(async () => {
    const projects = await getProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    Object.assign(projects[idx], updates);
    await _set('gpm_projects', projects);
    return projects[idx];
  });
}
```

- [ ] **Step 3: Wrap `saveChatMap` with `_withLock`**

Replace `saveChatMap` (lines 301-308):

```js
async function saveChatMap(map) {
  return _withLock(async () => {
    const current = await _get('gpm_chatMap');
    const projects = await _get('gpm_projects');
    if (current && Object.keys(current).length > 0) {
      await _writeBackup('auto', { projects: projects, chatMap: current });
    }
    await _set('gpm_chatMap', map);
  });
}
```

- [ ] **Step 4: Wrap `setChatAlias` with `_withLock`**

Replace `setChatAlias` (lines 352-359):

```js
async function setChatAlias(chatId, alias) {
  return _withLock(async () => {
    const chatMap = await getChatMap();
    if (chatMap[chatId]) {
      chatMap[chatId].alias = alias;
      chatMap[chatId]._autoResolved = false;
      await _set('gpm_chatMap', chatMap);
    }
  });
}
```

- [ ] **Step 5: Wrap `togglePinChat` with `_withLock`**

Replace `togglePinChat` (lines 361-369):

```js
async function togglePinChat(chatId) {
  return _withLock(async () => {
    const chatMap = await getChatMap();
    if (chatMap[chatId]) {
      chatMap[chatId].pinned = !chatMap[chatId].pinned;
      await _set('gpm_chatMap', chatMap);
      return chatMap[chatId].pinned;
    }
    return false;
  });
}
```

- [ ] **Step 6: Wrap `toggleStarChat` with `_withLock`**

Replace `toggleStarChat` (lines 394-399):

```js
async function toggleStarChat(chatId) {
  return _withLock(async () => {
    const chatMap = await getChatMap();
    if (!chatMap[chatId]) return null;
    chatMap[chatId].starredAt = chatMap[chatId].starredAt ? null : Date.now();
    await _set('gpm_chatMap', chatMap);
    return chatMap[chatId].starredAt;
  });
}
```

- [ ] **Step 7: Wrap `clearAll` with `_withLock`**

Replace `clearAll` (lines 479-486):

```js
async function clearAll() {
  return _withLock(async () => {
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
    });
  });
}
```

- [ ] **Step 8: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 9: Commit**

```bash
git add src/storage.js
git commit -m "fix: add _withLock to all unprotected write operations in storage"
```

---

### Task 3: Fix `isFavorite` missing `await` in project-tree.js

`GPMFavoritesManager.isFavorite()` is async but called without `await`, making the result always truthy (Promise object). The favorite icon always shows "Remove from favorites".

**Files:**
- Modify: `src/project-tree.js:738-786` (gpmShowProjectContextMenu)

- [ ] **Step 1: Make `gpmShowProjectContextMenu` async and add `await`**

In `src/project-tree.js`, change the function signature on line 738:

```js
async function gpmShowProjectContextMenu(x, y, project, allProjects) {
```

Then fix the `isFavorite` call on line 745:

```js
const isFavorite = typeof GPMFavoritesManager !== 'undefined' && (await GPMFavoritesManager.isFavorite(project.id));
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "fix: add missing await for isFavorite in project context menu"
```

---

## Phase 2: High-Priority Bugs (Tasks 4–11)

### Task 4: Fix `Ctrl+F` hijacking browser's native Find

`Ctrl+F` is intercepted globally, preventing users from using browser's built-in page search.

**Files:**
- Modify: `src/keyboard/shortcuts.js:10`

- [ ] **Step 1: Change `Ctrl+F` to `Ctrl+Shift+F`**

In `src/keyboard/shortcuts.js`, change the shortcut on line 11:

```js
'ctrl+shift+f': { action: 'focusSearch', description: 'Arama alanına odaklan' },
```

- [ ] **Step 2: Run tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/keyboard/shortcuts.js
git commit -m "fix: change search shortcut from Ctrl+F to Ctrl+Shift+F to avoid browser conflict"
```

---

### Task 5: Fix `createAction` returning null and `push` not validating

`createAction` returns `null` for unknown action types, and `push()` doesn't validate the action shape. Callers pass `null` directly to `push()`.

**Files:**
- Modify: `src/history/undo-redo.js:13-23, 198-199`

- [ ] **Step 1: Add null guard in `push` function**

In `src/history/undo-redo.js`, add a guard at the top of the `push` function (line 13):

```js
function push(action) {
  if (!action || typeof action.undo !== 'function' || typeof action.redo !== 'function') {
    gpmWarn('[GPM History] Invalid action pushed, ignoring:', action);
    return;
  }
  undoStack.push(action);
```

- [ ] **Step 2: Run tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/history/undo-redo.js
git commit -m "fix: validate action shape in GPMHistory.push to prevent null crashes"
```

---

### Task 6: Fix `calculateDataVersion` including `Date.now()` in sync-manager

The version string includes `Date.now()`, making every calculation unique and conflict detection useless.

**Files:**
- Modify: `src/sync/sync-manager.js:71-83`

- [ ] **Step 1: Remove `Date.now()` from version calculation**

Replace `calculateDataVersion` in `src/sync/sync-manager.js` (lines 71-83):

```js
async function calculateDataVersion() {
  const [projects, chatMap, prompts] = await Promise.all([
    GPMStorage.getProjects(),
    GPMStorage.getChatMap(),
    GPMStorage.getQuickPrompts(),
  ]);

  const projectCount = projects.length;
  const chatCount = Object.keys(chatMap).length;
  const promptCount = prompts.length;

  const projectHash = projects.reduce((h, p) => h ^ (p.id.length + p.chatIds?.length), 0);
  return `${projectCount}-${chatCount}-${promptCount}-${projectHash}`;
}
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/sync/sync-manager.js
git commit -m "fix: remove Date.now() from calculateDataVersion for deterministic versioning"
```

---

### Task 7: Fix `gpmWaitForSidebarContent` return value ignored in content.js

The return value of `gpmWaitForSidebarContent` is not checked, so initialization proceeds even if the sidebar has no content.

**Files:**
- Modify: `src/content.js:118`

- [ ] **Step 1: Check the return value and handle timeout**

In `src/content.js`, replace line 118:

```js
const contentReady = await gpmWaitForSidebarContent(sidebar, GPM_CONFIG.CONTENT_TIMEOUT);

if (!contentReady) {
  gpmWarn('Sidebar content not ready after timeout, proceeding with empty sidebar');
}
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/content.js
git commit -m "fix: check gpmWaitForSidebarContent return value, warn on timeout"
```

---

### Task 8: Fix multi-language support in `gpmTriggerNewChat`

Only English and Turkish "New chat" text is checked, ignoring the other 15 supported languages.

**Files:**
- Modify: `src/navigation.js:64-69`

- [ ] **Step 1: Add all supported languages to the "New chat" text matching**

In `src/navigation.js`, replace lines 64-69 inside `gpmTriggerNewChat`:

```js
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
const textLower = (el.textContent || '').trim().toLowerCase();
const ariaLower = (el.getAttribute('aria-label') || '').toLowerCase();
if (
  newChatLabels.some((label) => textLower.includes(label) || ariaLower.includes(label))
) {
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/navigation.js
git commit -m "fix: support all 17 languages in gpmTriggerNewChat text matching"
```

---

### Task 9: Fix `gpmInit()` error handling in dom-injection.js reinit

`gpmInit()` call uses `.finally()` without `.catch()`, silently swallowing errors.

**Files:**
- Modify: `src/dom-injection.js:705`

- [ ] **Step 1: Add `.catch()` to the reinit call**

In `src/dom-injection.js`, replace line 705:

```js
gpmInit()
  .catch((err) => {
    gpmError('Re-initialization failed:', err);
  })
  .finally(() => {
    _reinitInProgress = false;
  });
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/dom-injection.js
git commit -m "fix: add .catch() to gpmInit() reinit call in dom-injection"
```

---

### Task 10: Fix race conditions in usage-tracker.js

Read-modify-write pattern without locking can lose data under concurrent access.

**Files:**
- Modify: `src/analytics/usage-tracker.js`

- [ ] **Step 1: Add write queue to prevent race conditions**

Replace the entire `src/analytics/usage-tracker.js`:

```js
const GPMUsageTracker = (() => {
  const ANALYTICS_KEY = 'gpm_analytics';
  let _writeQueue = Promise.resolve();

  function _withQueue(fn) {
    const next = _writeQueue.then(fn).catch((e) => {
      if (typeof gpmError === 'function') gpmError('[GPM Analytics] Queue error:', e);
    });
    _writeQueue = next;
    return next;
  }

  async function getAnalytics() {
    try {
      const { [ANALYTICS_KEY]: analytics } = await chrome.storage.local.get(ANALYTICS_KEY);
      return (
        analytics || {
          projectAccess: {},
          featureUsage: {},
          lastSession: null,
          totalSessions: 0,
        }
      );
    } catch (e) {
      return {
        projectAccess: {},
        featureUsage: {},
        lastSession: null,
        totalSessions: 0,
      };
    }
  }

  async function saveAnalytics(analytics) {
    try {
      await chrome.storage.local.set({ [ANALYTICS_KEY]: analytics });
    } catch (_) {}
  }

  function trackFeatureUsage(featureName) {
    return _withQueue(async () => {
      const analytics = await getAnalytics();

      if (!analytics.featureUsage[featureName]) {
        analytics.featureUsage[featureName] = { count: 0, lastUsed: null };
      }

      analytics.featureUsage[featureName].count++;
      analytics.featureUsage[featureName].lastUsed = Date.now();

      await saveAnalytics(analytics);
    });
  }

  function trackSession() {
    return _withQueue(async () => {
      const analytics = await getAnalytics();
      analytics.lastSession = Date.now();
      analytics.totalSessions = (analytics.totalSessions || 0) + 1;
      await saveAnalytics(analytics);
    });
  }

  return {
    trackFeatureUsage,
    trackSession,
  };
})();
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/analytics/usage-tracker.js
git commit -m "fix: add write queue to usage-tracker to prevent race conditions"
```

---

### Task 11: Fix `isInvalidated` never resetting in context-recovery.js

Once `isInvalidated` is set to `true`, it never resets. `isContextValid()` will return `false` forever, even if the extension context becomes valid again (e.g., after page reload).

**Files:**
- Modify: `src/recovery/context-recovery.js:2,14`

- [ ] **Step 1: Reset `isInvalidated` when context becomes valid again**

In `src/recovery/context-recovery.js`, modify the `checkContext` function and the monitoring logic. Change line 14 condition:

```js
if (!isValid && !isInvalidated) {
  isInvalidated = true;
  showRecoveryUI();
}
if (isValid && isInvalidated) {
  isInvalidated = false;
}
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/recovery/context-recovery.js
git commit -m "fix: reset isInvalidated flag when context becomes valid again"
```

---

## Phase 3: Background Service Worker Fixes (Tasks 12–13)

### Task 12: Fix write lock acquired by `undefined` tabId and update backup overwrite

**Files:**
- Modify: `src/background.js:266-289` (lock acquisition)
- Modify: `src/background.js:194-201` (backup overwrite)

- [ ] **Step 1: Validate tabId is a number before granting lock**

In `src/background.js`, modify `gpmAcquireWriteLock` (line 266):

```js
function gpmAcquireWriteLock(tabId) {
  if (typeof tabId !== 'number') return false;
  if (_writeLockHolder !== null && _writeLockHolder !== tabId) {
    return false;
  }
```

- [ ] **Step 2: Use separate backup keys for update vs migration**

Modify `createUpdateBackup` in `src/background.js` (around line 224) to use `gpm_backup_update` key:

```js
await chrome.storage.local.set({
  gpm_backup_update: {
    type: 'update',
```

And modify `gpmRunMigrations` backup (around line 115) to keep using `gpm_backup_current`:

No change needed for migration backup since it already uses `gpm_backup_current`.

- [ ] **Step 3: Add top-level try/catch to onInstalled handler**

Wrap the entire handler body (lines 182-209):

```js
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
```

And close with:

```js
  } catch (e) {
    console.error('[GPM] onInstalled handler failed:', e);
  }
});
```

- [ ] **Step 4: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 5: Commit**

```bash
git add src/background.js
git commit -m "fix: validate tabId for write lock, separate backup keys, add onInstalled error handling"
```

---

### Task 13: Remove dead `GPM_STORAGE_UPDATED` message handler

**Files:**
- Modify: `src/background.js:299-303`

- [ ] **Step 1: Remove the unused handler**

Delete lines 299-303 from `src/background.js`:

```js
// Remove this block:
//   if (message.type === 'GPM_STORAGE_UPDATED') {
//     gpmReleaseWriteLock(sender.tab?.id);
//     sendResponse({ ok: true });
//     return;
//   }
```

- [ ] **Step 2: Commit**

```bash
git add src/background.js
git commit -m "chore: remove unused GPM_STORAGE_UPDATED message handler"
```

---

## Phase 4: Logging Consistency (Task 14)

### Task 14: Replace raw `console.*` with `gpmLog`/`gpmWarn`/`gpmError` in content scripts

Multiple files use raw `console.log/error/warn` instead of the debug-controllable wrappers.

**Files:**
- Modify: `src/storage.js` (7 occurrences)
- Modify: `src/content.js` (11 occurrences)

- [ ] **Step 1: Fix storage.js logging**

In `src/storage.js`, replace all raw console calls:

| Line | Old | New |
|------|-----|-----|
| 87 | `console.log('[GPM Storage] Running migration v${v}')` | `gpmLog('Running migration v' + v)` |
| 109 | `console.log('[GPM Storage] Migrated...')` | `gpmLog('Migrated from v' + currentVersion + ' to ' + GPM_SCHEMA_VERSION)` |
| 142 | `console.error('[GPM Storage] Lock chain error:', err)` | `gpmError('Lock chain error:', err)` |
| 190 | `console.log('[GPM Storage] Quota usage...')` | `gpmLog('Quota usage', ...)` |
| 530-531 | `console.log('[GPM] Restored from backup...')` | `gpmLog('Restored from backup (type:', backup.type, ')')` |

- [ ] **Step 2: Fix content.js logging**

In `src/content.js`, replace all raw console calls with the appropriate `gpmLog`/`gpmWarn`/`gpmError` wrapper. All 11 occurrences follow the same pattern — replace `console.log('[GPM] ...')` with `gpmLog(...)`, `console.error('[GPM] ...')` with `gpmError(...)`, and `console.warn('[GPM] ...')` with `gpmWarn(...)`.

- [ ] **Step 3: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 4: Commit**

```bash
git add src/storage.js src/content.js
git commit -m "fix: replace raw console.* with gpmLog/gpmWarn/gpmError wrappers"
```

---

## Phase 5: Config & State Fixes (Task 15)

### Task 15: Fix `spaObserversActive` missing from initial GPM_STATE and fix comment

**Files:**
- Modify: `src/config.js:50-74, 122`

- [ ] **Step 1: Add `spaObserversActive` to initial GPM_STATE**

In `src/config.js`, add to the GPM_STATE object after `_renderId: 0` (line 73):

```js
spaObserversActive: false,
```

- [ ] **Step 2: Fix the incorrect comment on lines 4-5**

Change:
```
 * This module is loaded FIRST (after i18n.js, storage.js, selectors.js, ui_elements.js)
```
To:
```
 * This module is loaded after i18n.js, validators.js, storage.js, selectors.js, ui_elements.js
```

- [ ] **Step 3: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 4: Commit**

```bash
git add src/config.js
git commit -m "fix: add spaObserversActive to initial GPM_STATE, fix loading order comment"
```

---

## Phase 6: Dead Code Removal (Task 16)

### Task 16: Remove all dead code identified in the audit

**Files:**
- Modify: `src/ui/toast.js` (entire file — never called from src/)
- Modify: `src/utils/validators.js` (remove unused exports)
- Modify: `src/selectors.js` (remove unused selector keys)
- Modify: `src/ui_elements.js` (remove unused exports)
- Modify: `src/undo-redo.js` (remove unused exports)
- Modify: `src/sync/sync-manager.js` (remove unused exports)
- Modify: `src/favorites-manager.js` (remove unused export)
- Modify: `src/recovery/integrity-check.js` (remove unused exports)
- Modify: `src/storage.js` (remove `_writeBackup` export)
- Modify: `manifest.json` (remove toast.js from content_scripts)

- [ ] **Step 1: Remove toast.js from manifest.json and keep file for tests only**

In `manifest.json`, check if toast.js is listed in content_scripts. If not present, no manifest change needed — the file stays for test compatibility.

Note: The toast system is never called from production code. The file should remain for test compatibility but is already not causing harm. No action needed unless explicitly listed in manifest.json.

- [ ] **Step 2: Remove unused exports from validators.js**

In `src/utils/validators.js`, check the return statement. Remove functions that are never called externally:
- `sanitizeString`, `sanitizeContent`, `sanitizeHtml`, `sanitizeColor`, `sanitizeIcon`, `sanitizeId`
- `validateProject`, `validateChatMapping`, `validateQuickPrompt`, `validateSettings`

Keep only `validateImportData` and `findDuplicateChat` in the exports.

- [ ] **Step 3: Remove unused selector keys from selectors.js**

In `src/selectors.js`, remove:
- `toolboxButtonContainer` (line 45)
- `sideNavEntry` (line 50)

- [ ] **Step 4: Remove unused exports from ui_elements.js**

In `src/ui_elements.js`, check the return statement of the GPMUI IIFE. Remove from exports:
- `showTemplateDialog` (never called externally)
- `createSVGIcon` (only used internally)
- `COLORS`, `PROJECT_ICONS`, `CATEGORIES` (only used internally)

- [ ] **Step 5: Remove unused exports from undo-redo.js**

In `src/history/undo-redo.js`, remove `canUndo` and `canRedo` from the return statement.

- [ ] **Step 6: Remove unused exports from sync-manager.js**

In `src/sync/sync-manager.js`, reduce the return statement to only what's used externally:

```js
return {
  startAutoSync,
  stopAutoSync,
};
```

- [ ] **Step 7: Remove unused export from favorites-manager.js**

In `src/favorites-manager.js`, remove `saveFavorites` from the return statement:

```js
return {
  getFavorites,
  toggleFavorite,
  isFavorite,
};
```

- [ ] **Step 8: Remove unused exports from integrity-check.js**

In `src/recovery/integrity-check.js`, reduce the return statement to only `run`:

```js
return {
  run,
};
```

- [ ] **Step 9: Remove `_writeBackup` from storage.js exports**

In `src/storage.js`, remove `_writeBackup` from the return statement (line 563).

- [ ] **Step 10: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 11: Commit**

```bash
git add src/utils/validators.js src/selectors.js src/ui_elements.js src/history/undo-redo.js src/sync/sync-manager.js src/favorites-manager.js src/recovery/integrity-check.js src/storage.js
git commit -m "chore: remove unused exports and dead code across all modules"
```

---

## Phase 7: Code Quality Improvements (Tasks 17–20)

### Task 17: Fix stale `allProjects` in project-tree.js drop handler

The drop handler at line 577 uses `allProjects` from the render snapshot instead of fresh data fetched at line 500.

**Files:**
- Modify: `src/project-tree.js:577`

- [ ] **Step 1: Use fresh projects for duplicate check**

In `src/project-tree.js`, change line 577 from:

```js
const duplicateInfo = GPMValidators.findDuplicateChat(cleanId, allProjects, chatMap);
```

To:

```js
const freshProjects = await GPMStorage.getProjects();
const freshChatMap = await GPMStorage.getChatMap();
const duplicateInfo = GPMValidators.findDuplicateChat(cleanId, freshProjects, freshChatMap);
```

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "fix: use fresh data for duplicate chat check in drop handler"
```

---

### Task 18: Fix `_gpmCountAllChats` O(n²) performance

The function calls `.filter()` on every recursive call, making it O(n²).

**Files:**
- Modify: `src/project-tree.js:73-77`

- [ ] **Step 1: Pre-build child map and use it in the count function**

In `src/project-tree.js`, replace the `_gpmCountAllChats` function:

```js
function _gpmBuildChildMap(allProjs) {
  const map = new Map();
  for (const p of allProjs) {
    if (p.parentId) {
      const children = map.get(p.parentId) || [];
      children.push(p);
      map.set(p.parentId, children);
    }
  }
  return map;
}

function _gpmCountAllChats(proj, childMap) {
  const own = (proj.chatIds || []).length;
  const kids = childMap.get(proj.id) || [];
  return own + kids.reduce((sum, kid) => sum + _gpmCountAllChats(kid, childMap), 0);
}
```

- [ ] **Step 2: Update callers to pass the child map**

In `gpmCreateProjectRow`, before the recursive call pattern, build the child map once. Find where `_gpmCountAllChats` is called (line 375) and update:

In `gpmRenderTree`, after `const projects = await GPMStorage.getProjects();` (line 86), add:

```js
const _childMap = _gpmBuildChildMap(projects);
```

Then pass `_childMap` down to `gpmCreateProjectRow` and use it in the `_gpmCountAllChats` call.

Update `gpmCreateProjectRow` signature to accept the child map:

```js
function gpmCreateProjectRow(project, allProjects, chatMap, childMap) {
```

And update the count call:

```js
const total = _gpmCountAllChats(project, childMap);
```

Update all callers of `gpmCreateProjectRow` in `gpmRenderTree` to pass `_childMap`:

```js
const row = gpmCreateProjectRow(project, projects, chatMap, _childMap);
```

And in the recursive call inside `gpmCreateProjectRow` (line 420):

```js
const childRow = gpmCreateProjectRow(child, allProjects, chatMap, childMap);
```

- [ ] **Step 3: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 4: Commit**

```bash
git add src/project-tree.js
git commit -m "perf: pre-build child map to reduce _gpmCountAllChats from O(n²) to O(n)"
```

---

### Task 19: Consolidate alias resolve timers in navigation.js

Three separate `setTimeout` calls (2000ms, 5000ms, 10000ms) schedule alias resolution after chat assignment. Should be a single progressive retry.

**Files:**
- Modify: `src/navigation.js:549-557`

- [ ] **Step 1: Replace three setTimeout with a single retry loop**

In `src/navigation.js`, replace lines 549-557:

```js
const aliasRetryDelays = [2000, 5000, 10000];
for (const delay of aliasRetryDelays) {
  setTimeout(() => {
    if (gpmIsContextValid()) gpmScheduleAliasResolve();
  }, delay);
}
```

This is functionally identical but cleaner and easier to extend. Alternatively, for a more robust approach:

```js
function _gpmRetryAliasResolve(delays, attempt = 0) {
  if (attempt >= delays.length || !gpmIsContextValid()) return;
  setTimeout(() => {
    gpmScheduleAliasResolve();
    _gpmRetryAliasResolve(delays, attempt + 1);
  }, delays[attempt] - (attempt > 0 ? delays[attempt - 1] : 0));
}
_gpmRetryAliasResolve([2000, 5000, 10000]);
```

For simplicity, use the loop approach.

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`

- [ ] **Step 3: Commit**

```bash
git add src/navigation.js
git commit -m "refactor: consolidate alias resolve retry timers into loop"
```

---

### Task 20: Update AGENTS.md to fix `uid.js` reference

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Fix the loading order documentation**

In `AGENTS.md`, find the line that mentions `utils/uid.js` and remove it. The actual loading order from manifest.json is:

```
i18n.js → utils/validators.js → storage.js → selectors.js → ui_elements.js → config.js → ...
```

Also add a note about `background.js` using raw `console.*` since `gpmLog` wrappers are not available in the service worker context:

Under "Code style", add:

```markdown
- `background.js` is exempt from the `gpmLog` rule — it runs in the service worker context where the wrappers are not available
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: fix uid.js reference in loading order, document background.js console exemption"
```

---

## Phase 8: Final Verification (Task 21)

### Task 21: Run full verification suite

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: No errors

- [ ] **Step 2: Run format check**

Run: `npm run format:check`

Expected: No differences

- [ ] **Step 3: Run all tests**

Run: `npm test`

Expected: All tests pass

- [ ] **Step 4: Run coverage check**

Run: `npm run test:coverage`

Expected: Statements threshold (80%) met for all covered files

---

## Summary

| Phase | Tasks | Description | Estimated Changes |
|-------|-------|-------------|-------------------|
| 1 | 1–3 | Critical data loss bugs | 3 files |
| 2 | 4–11 | High-priority bugs | 7 files |
| 3 | 12–13 | Background service worker fixes | 1 file |
| 4 | 14 | Logging consistency | 2 files |
| 5 | 15 | Config & state fixes | 1 file |
| 6 | 16 | Dead code removal | 9 files |
| 7 | 17–20 | Code quality improvements | 4 files |
| 8 | 21 | Final verification | — |
| **Total** | **21 tasks** | | **~15 files** |
