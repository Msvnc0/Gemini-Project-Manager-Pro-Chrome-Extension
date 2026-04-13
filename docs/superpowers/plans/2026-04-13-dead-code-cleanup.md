# Dead Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 41 verified dead code definitions (5 dead modules, 9 dead global functions, 26 dead module methods, 1 dead config value) from the Chrome extension codebase.

**Architecture:** Dead code was identified via exhaustive cross-reference analysis. Every item was verified against both `src/` (runtime) and `tests/` (test) consumers. Zero runtime consumers exist for all 41 items. 11 items have test consumers that must be cleaned up alongside the source removal.

**Tech Stack:** Chrome Extension (Manifest V3), vanilla JS (no modules, all globals), Vitest for testing, ESLint for linting.

---

## File Structure

### Files to DELETE entirely (5 source + 1 test):
- `src/sync/conflict-resolver.js` — Entire `GPMConflictResolver` module, zero consumers
- `src/ui/star-button.js` — Entire `GPMStarButton` module, zero consumers
- `src/performance/virtual-list.js` — Entire `GPMVirtualList` + `createVirtualList`, zero consumers
- `src/batch-operations.js` — Entire `GPMBatchOperations` module, zero consumers
- `src/sort-manager.js` — Entire `GPMSortManager` module, zero runtime consumers (1 test file)
- `tests/sort-manager.test.js` — Tests for dead `GPMSortManager` module

### Files to MODIFY (source cleanup):
- `manifest.json` — Remove 5 dead module entries from content_scripts
- `src/utils/uid.js` — Remove `uuidv4()`, `shortId()`
- `src/config.js` — Remove `validateChatIdExists()`, remove `bulkSelection` from GPM_STATE
- `src/selectors.js` — Remove `gpmQuerySelectorAll()` (keep `gpmQuerySelector`, `gpmClearSelectorCache`)
- `src/project-tree.js` — Remove `gpmShowTemplateDialog()`, `gpmToggleBulkSelection()`, `gpmClearBulkSelection()`, `gpmUpdateBulkToolbar()`, `gpmBulkMoveToProject()`
- `src/content.js` — Remove `gpmApplyTemplate()`
- `src/ui/toast.js` — Remove `window.removeToastContainer` export
- `src/history/undo-redo.js` — Remove `clear()`, `getHistoryInfo()` functions + exports
- `src/sync/sync-manager.js` — Remove `syncPull()`, `onDataChanged()` functions + exports
- `src/recovery/context-recovery.js` — Remove `stopMonitoring()`, `hideRecoveryUI()`, `safeStorageOperation()` functions + exports
- `src/backup/backup-manager.js` — Remove `clearAllBackups()`, `formatBackupSize()` functions + exports
- `src/favorites-manager.js` — Remove `addFavorite()`, `removeFavorite()`, `getFavoriteProjects()` functions + exports
- `src/analytics/usage-tracker.js` — Remove `clearAnalytics()`, `trackEvent()`, `getDailyStats()`, `getTopSearchTerms()` functions + exports
- `src/keyboard/shortcuts.js` — Remove `destroy()`, `getShortcutsList()` functions + exports; remove `handlers`, `SHORTCUTS` from return object

### Files to MODIFY (test cleanup):
- `tests/selectors.test.js` — Remove `gpmQuerySelectorAll` describe block + import patching
- `tests/ui/toast.test.js` — Replace `window.removeToastContainer()` with inline cleanup
- `tests/history/undo-redo.test.js` — Remove `clears history` test, update `getHistoryInfo` references
- `tests/analytics/usage-tracker.test.js` — Remove tests for dead methods
- `tests/keyboard-shortcuts.test.js` — Remove `destroy?.()` calls

### Files to MODIFY (config cleanup):
- `eslint.config.js` — Remove dead global declarations

---

## Task 1: Delete Dead Modules + Update manifest.json

**Files:**
- Delete: `src/sync/conflict-resolver.js`
- Delete: `src/ui/star-button.js`
- Delete: `src/performance/virtual-list.js`
- Delete: `src/batch-operations.js`
- Delete: `src/sort-manager.js`
- Modify: `manifest.json`

- [ ] **Step 1: Delete the 5 dead module files**

```bash
rm src/sync/conflict-resolver.js
rm src/ui/star-button.js
rm src/performance/virtual-list.js
rm src/batch-operations.js
rm src/sort-manager.js
```

- [ ] **Step 2: Remove entries from manifest.json**

Remove these 5 lines from the `js` array in `content_scripts`:
- Line 23: `"src/sync/conflict-resolver.js",`
- Line 25: `"src/ui/star-button.js",`
- Line 28: `"src/performance/virtual-list.js",`
- Line 30: `"src/batch-operations.js",`
- Line 32: `"src/sort-manager.js",`

The manifest.json content_scripts `js` array should become:
```json
"js": [
    "src/i18n.js",
    "src/utils/uid.js",
    "src/utils/validators.js",
    "src/storage.js",
    "src/selectors.js",
    "src/ui_elements.js",
    "src/config.js",
    "src/recovery/context-recovery.js",
    "src/backup/backup-manager.js",
    "src/recovery/integrity-check.js",
    "src/sync/sync-manager.js",
    "src/templates/folder-templates.js",
    "src/keyboard/shortcuts.js",
    "src/history/undo-redo.js",
    "src/analytics/usage-tracker.js",
    "src/favorites-manager.js",
    "src/ui/toast.js",
    "src/project-tree.js",
    "src/dom-injection.js",
    "src/quick-prompts.js",
    "src/navigation.js",
    "src/content.js"
],
```

- [ ] **Step 3: Run lint to verify no missing references**

Run: `npm run lint`
Expected: Same warnings as before (no new errors). No `undeclared` errors for the deleted modules since they weren't ESLint globals (except `GPMStarButton` — will be cleaned in Task 8).

---

## Task 2: Remove Dead Global Functions — uid.js, config.js

**Files:**
- Modify: `src/utils/uid.js`
- Modify: `src/config.js`

- [ ] **Step 1: Remove `uuidv4()` from src/utils/uid.js**

Remove lines 17-23 (the comment block + function):
```javascript
// DELETE THIS BLOCK:
/**
 * Generate a UUID v4 compliant ID.
 * Useful for cases where standard UUID format is preferred.
 */
function uuidv4() {
  return crypto.randomUUID();
}
```

- [ ] **Step 2: Remove `shortId()` from src/utils/uid.js**

Remove lines 25-32 (the comment block + function):
```javascript
// DELETE THIS BLOCK:
/**
 * Generate a shorter ID for cases where length matters.
 * Still collision-resistant for reasonable usage.
 */
function shortId() {
  const arr = crypto.getRandomValues(new Uint32Array(2));
  return arr[0].toString(36) + arr[1].toString(36);
}
```

- [ ] **Step 3: Remove `validateChatIdExists()` from src/config.js**

Remove lines 192-216 (the comment block + entire function):
```javascript
// DELETE THIS BLOCK:
/**
 * Validate if a chat ID exists in Gemini's sidebar.
 * Used to verify chat existence before deletion detection.
 *
 * @param {string} chatId — The chat ID to validate
 * @returns {Promise<boolean>} — True if chat exists in sidebar
 */
async function validateChatIdExists(chatId) {
  if (!chatId) return false;

  const sidebar = gpmQuerySelector ? gpmQuerySelector('sidebar') : document.querySelector(GPM_SELECTORS.sidebar);
  if (!sidebar) return false;

  const links = sidebar.querySelectorAll('a[href^="/app/"], a[href^="/chat/"], a[href^="/c/"]');

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const extractedId = extractChatIdFromUrl(href);
    if (extractedId === chatId) {
      return true;
    }
  }

  return false;
}
```

- [ ] **Step 4: Run tests to verify no breakage**

Run: `npm test`
Expected: All tests pass (uid.js and config.js dead functions had zero test references).

---

## Task 3: Remove Dead Global Functions — selectors.js, content.js, toast.js

**Files:**
- Modify: `src/selectors.js`
- Modify: `src/content.js`
- Modify: `src/ui/toast.js`

- [ ] **Step 1: Remove `gpmQuerySelectorAll()` from src/selectors.js**

Remove lines 162-176 (the comment + function):
```javascript
// DELETE THIS BLOCK:
/**
 * Try to find all elements using a selector with fallback chain.
 * @param {string} selectorKey — Key from GPM_SELECTORS
 * @param {Element} [context=document] — Optional parent element to search within
 * @returns {NodeList} — All matching elements
 */
function gpmQuerySelectorAll(selectorKey, context) {
  const selector = GPM_SELECTORS[selectorKey];
  if (!selector) {
    if (typeof gpmWarn === 'function') gpmWarn('Unknown selector key:', selectorKey);
    return [];
  }
  const root = context || document;
  return root.querySelectorAll(selector);
}
```

- [ ] **Step 2: Remove `gpmApplyTemplate()` from src/content.js**

Remove lines 212-225 (section header + comment + function):
```javascript
// DELETE THIS BLOCK:
// ══════════════════════════════════════
//  TEMPLATE APPLICATION
// ══════════════════════════════════════

async function gpmApplyTemplate(templateId) {
  if (typeof applyTemplate !== 'undefined') {
    const success = await applyTemplate(templateId);
    if (success) {
      GPMUsageTracker.trackFeatureUsage('template_' + templateId);
    }
    return success;
  }
  return false;
}
```

- [ ] **Step 3: Remove `window.removeToastContainer` from src/ui/toast.js**

Remove line 85:
```javascript
// DELETE THIS LINE:
window.removeToastContainer = removeToastContainer;
```

Keep `window.showToast = showToast;` (line 84) — showToast IS used at runtime.

Also remove the internal `removeToastContainer` function (lines 79-82):
```javascript
// DELETE THIS BLOCK:
function removeToastContainer() {
  const container = document.getElementById('gpm-toast-container');
  if (container) container.parentNode.removeChild(container);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: Tests in `tests/selectors.test.js`, `tests/ui/toast.test.js` will FAIL — this is expected. They will be fixed in Task 6.

---

## Task 4: Remove Dead Global Functions — project-tree.js (Bulk Selection Subsystem)

**Files:**
- Modify: `src/project-tree.js`
- Modify: `src/config.js` (remove bulkSelection state)

This removes the entire dead bulk selection subsystem: `gpmShowTemplateDialog`, `gpmToggleBulkSelection`, `gpmClearBulkSelection`, `gpmUpdateBulkToolbar`, `gpmBulkMoveToProject`.

- [ ] **Step 1: Remove `gpmShowTemplateDialog()` from src/project-tree.js**

Remove lines 926-936:
```javascript
// DELETE THIS BLOCK:
function gpmShowTemplateDialog() {
  if (!GPM_STATE.modalRoot) return;
  GPMUI.showTemplateDialog(GPM_STATE.modalRoot, async (templateId) => {
    if (typeof applyTemplate !== 'undefined') {
      await applyTemplate(templateId);
      if (typeof GPMUsageTracker !== 'undefined') {
        GPMUsageTracker.trackFeatureUsage('template_' + templateId);
      }
    }
  });
}
```

- [ ] **Step 2: Remove bulk selection functions from src/project-tree.js**

Remove lines 1011-1099 (all 5 functions as a block):
- `gpmToggleBulkSelection()` (lines 1011-1031)
- `gpmClearBulkSelection()` (lines 1033-1038)
- `gpmUpdateBulkToolbar()` (lines 1040-1092)
- `gpmBulkMoveToProject()` (lines 1094-1099)

Read the file around these lines to find the exact section boundaries and remove the entire block.

- [ ] **Step 3: Remove `bulkSelection` from GPM_STATE in src/config.js**

Remove lines 67-70 in config.js:
```javascript
// DELETE THESE LINES:
  bulkSelection: {
    active: false,
    selectedChatIds: new Set(),
  },
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: Tests should pass. The bulk selection functions had zero test references.

---

## Task 5: Remove Dead Module Methods (Return Objects + Internal Functions)

**Files:**
- Modify: `src/history/undo-redo.js`
- Modify: `src/sync/sync-manager.js`
- Modify: `src/recovery/context-recovery.js`
- Modify: `src/backup/backup-manager.js`
- Modify: `src/favorites-manager.js`
- Modify: `src/analytics/usage-tracker.js`
- Modify: `src/keyboard/shortcuts.js`

For each module, the process is:
1. Remove the internal function definition + its JSDoc comment
2. Remove the method from the return object

- [ ] **Step 1: Clean `src/history/undo-redo.js`**

Remove internal functions:
- `clear()` function (around lines 69-72)
- `getHistoryInfo()` function (around lines 74-83)

Remove from return object:
```javascript
// Change return object from:
return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    getHistoryInfo,
    createAction,
};

// To:
return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    createAction,
};
```

Note: `canUndo` and `canRedo` are kept in the return object because they are used internally by other code paths, even though no external code calls them directly.

- [ ] **Step 2: Clean `src/sync/sync-manager.js`**

Remove internal functions:
- `syncPull()` function (around lines 123-132)
- `onDataChanged()` function (around lines 177-180)

Remove from return object:
```javascript
// Remove these lines from the return object:
    syncPull,
    onDataChanged,
```

- [ ] **Step 3: Clean `src/recovery/context-recovery.js`**

Remove internal functions:
- `stopMonitoring()` function (around lines 23-29)
- `hideRecoveryUI()` function (around lines 146-152)
- `safeStorageOperation()` function (around lines 158-174)

Remove from return object:
```javascript
// Remove these lines from the return object:
    stopMonitoring,
    safeStorageOperation,
    hideRecoveryUI,
```

- [ ] **Step 4: Clean `src/backup/backup-manager.js`**

Remove internal functions:
- `clearAllBackups()` function (around lines 143-152)
- `formatBackupSize()` function (around lines 173-177)

Remove from return object:
```javascript
// Remove these lines from the return object:
    clearAllBackups,
    formatBackupSize,
```

- [ ] **Step 5: Clean `src/favorites-manager.js`**

Remove internal functions:
- `addFavorite()` function (around lines 39-45)
- `removeFavorite()` function (around lines 47-51)
- `getFavoriteProjects()` function (around lines 53-57)

Remove from return object:
```javascript
// Remove these lines from the return object:
    addFavorite,
    removeFavorite,
    getFavoriteProjects,
```

- [ ] **Step 6: Clean `src/analytics/usage-tracker.js`**

Remove internal functions:
- `clearAnalytics()` function (around lines 114-121)
- `trackEvent()` function (around lines 123-130)
- `getDailyStats()` function (around lines 132-152)
- `getTopSearchTerms()` function (around lines 154-166)

Remove from return object:
```javascript
// Remove these lines from the return object:
    clearAnalytics,
    trackEvent,
    getDailyStats,
    getTopSearchTerms,
```

Also remove dead methods that are NOT in tests (truly unused):
- `trackProjectAccess()` function — remove from return object + internal definition
- `getMostUsedProjects()` function — remove from return object + internal definition
- `getRecentlyUsedProjects()` function — remove from return object + internal definition
- `getUsageStats()` function — remove from return object + internal definition

- [ ] **Step 7: Clean `src/keyboard/shortcuts.js`**

Remove internal functions:
- `destroy()` function (around lines 175-181)
- `getShortcutsList()` function (around lines 183-189)

Remove from return object:
```javascript
// Remove these lines from the return object:
    destroy,
    getShortcutsList,
    handlers,
    SHORTCUTS,
```

Note: `handlers` and `SHORTCUTS` are internal data structures. If `SHORTCUTS` constant is referenced internally by `init()`, keep the internal constant but remove only from the return object. Read the file to verify before removing the internal definition.

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: Tests in `tests/history/undo-redo.test.js`, `tests/analytics/usage-tracker.test.js`, `tests/keyboard-shortcuts.test.js` will FAIL — this is expected. They will be fixed in Task 6.

---

## Task 6: Update Test Files

**Files:**
- Delete: `tests/sort-manager.test.js`
- Modify: `tests/selectors.test.js`
- Modify: `tests/ui/toast.test.js`
- Modify: `tests/history/undo-redo.test.js`
- Modify: `tests/analytics/usage-tracker.test.js`
- Modify: `tests/keyboard-shortcuts.test.js`

- [ ] **Step 1: Delete `tests/sort-manager.test.js`**

```bash
rm tests/sort-manager.test.js
```

- [ ] **Step 2: Clean `tests/selectors.test.js`**

Remove the `gpmQuerySelectorAll` import patching at line 22:
```javascript
// DELETE THIS LINE:
  .replace(/^function gpmQuerySelectorAll\b/m, 'globalThis.gpmQuerySelectorAll = function gpmQuerySelectorAll')
```

Remove the reference at line 31:
```javascript
// DELETE THIS LINE:
const gpmQuerySelectorAll = globalThis.gpmQuerySelectorAll;
```

Remove the entire describe block at lines 141-170:
```javascript
// DELETE THIS ENTIRE BLOCK:
describe('gpmQuerySelectorAll()', () => {
  it('should return all matching elements', () => {
    ...
  });
  it('should return empty array for unknown key', () => {
    ...
  });
  it('should return empty NodeList when no matches', () => {
    ...
  });
});
```

- [ ] **Step 3: Clean `tests/ui/toast.test.js`**

Replace line 10 in `afterEach`:
```javascript
// CHANGE FROM:
    window.removeToastContainer();

// CHANGE TO:
    const container = document.getElementById('gpm-toast-container');
    if (container) container.remove();
```

- [ ] **Step 4: Clean `tests/history/undo-redo.test.js`**

Remove the `'clears history'` test (lines 89-94):
```javascript
// DELETE THIS ENTIRE BLOCK:
  it('clears history', () => {
    GPMHistory.push(GPMHistory.createAction('move_chat', { chatId: 'c1', fromProjectId: 'p1', toProjectId: 'p2' }));
    GPMHistory.clear();
    expect(GPMHistory.getHistoryInfo().undoCount).toBe(0);
    expect(GPMHistory.getHistoryInfo().redoCount).toBe(0);
  });
```

Also update line 51 where `getHistoryInfo()` is used:
```javascript
// CHANGE FROM:
    expect(GPMHistory.getHistoryInfo().undoCount).toBe(1);

// CHANGE TO:
    expect(GPMHistory.undo()).toBe(true);
```

Read the test file to understand the context around line 51 before making this change — verify that the test is checking "undo stack has one item" and adjust accordingly.

- [ ] **Step 5: Clean `tests/analytics/usage-tracker.test.js`**

This test file heavily uses dead methods (`trackEvent`, `clearAnalytics`, `getDailyStats`, `getTopSearchTerms`). Read the full file and identify which `describe` blocks or `it` blocks use these dead methods. Remove entire test blocks that exclusively test dead methods. If a test block mixes live and dead method calls, rewrite it to use only live methods (`trackSession`, `trackFeatureUsage`, `getAnalytics`, `saveAnalytics`).

Key dead method calls to remove:
- All `trackEvent(...)` calls (lines 24, 41, 51-53, 65-67)
- All `clearAnalytics()` calls (lines 50, 64, 77)
- All `getDailyStats(...)` calls (line 54)
- All `getTopSearchTerms(...)` calls (lines 68, 78)

- [ ] **Step 6: Clean `tests/keyboard-shortcuts.test.js`**

Remove `GPMKeyboardShortcuts.destroy?.()` calls:
```javascript
// In beforeEach (line 36), DELETE:
    GPMKeyboardShortcuts.destroy?.();

// In afterEach (line 41), DELETE:
    GPMKeyboardShortcuts.destroy?.();
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: ALL tests pass. Fix any remaining failures before proceeding.

---

## Task 7: Clean eslint.config.js

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Remove dead global declarations**

Remove these lines from the `globals` object:
```
gpmQuerySelectorAll: 'readonly',    (line 24)
gpmApplyTemplate: 'readonly',       (line 72)
GPMHistory: 'readonly',             (line 78)
GPMFavoritesManager: 'readonly',    (line 79)
GPMUsageTracker: 'readonly',        (line 80)
GPMBackupManager: 'readonly',       (line 81)
GPMSyncManager: 'readonly',         (line 82)
GPMIntegrityCheck: 'readonly',      (line 83)
GPMContextRecovery: 'readonly',     (line 84)
GPMKeyboardShortcuts: 'readonly',   (line 85)
GPMStarButton: 'readonly',          (line 86)
applyTemplate: 'readonly',          (line 87)
```

Read the file first to confirm exact line numbers before editing.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors. Warnings for dead modules should be gone. Remaining warnings should be the pre-existing ones for still-used functions.

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: ALL tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors. Fewer warnings than before (dead module warnings eliminated).

- [ ] **Step 3: Verify deleted files are gone**

Run: `ls src/sync/conflict-resolver.js src/ui/star-button.js src/performance/virtual-list.js src/batch-operations.js src/sort-manager.js tests/sort-manager.test.js`
Expected: All files should NOT exist (error from ls confirms deletion).

- [ ] **Step 4: Verify manifest.json is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json is valid')"`
Expected: `manifest.json is valid`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove 41 dead code definitions (5 dead modules, 9 dead functions, 26 dead methods, 1 dead config value)"
```
