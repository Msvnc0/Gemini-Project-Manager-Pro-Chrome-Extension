# Full Bugfix, Dead Code Cleanup & Code Quality Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs, remove dead code, and improve code quality identified in the comprehensive audit of GPM Pro.

**Architecture:** Content scripts share a global scope (no ES modules). Files load in manifest.json order. Test files ARE ES modules. No build step.

**Tech Stack:** Chrome Extension (Manifest V3), plain JS, Vitest + jsdom for tests.

---

## Task 1: Fix background.js migration v5 — legacy keys never cleaned up

**Files:**
- Modify: `src/background.js:148-175`

`background.js` migration creates a subset `data` object with only 4 keys. Migration v5 tries to `delete data[key]` for legacy keys, but they're never in `data` — they exist in `allData`. After migration, legacy keys remain in storage forever.

- [ ] **Step 1: Add `chrome.storage.local.remove()` call after migrations in `gpmRunMigrations`**

In `src/background.js`, after the `chrome.storage.local.set(...)` call at line ~168, add the same `legacyKeys` cleanup that `storage.js` uses:

```js
// After: await chrome.storage.local.set({ ... });  (line 168)

// Clean up legacy keys that are not part of the migrated subset
const legacyKeys = [
  'gpm_projects_backup', 'gpm_backup_ts', 'gpm_chatMap_backup',
  'gpm_pre_import_projects', 'gpm_pre_import_chatMap', 'gpm_pre_import_quickPrompts',
  'gpm_pre_import_ts', 'gpm_pre_migration_backup', 'gpm_update_backup',
  'gpm_emergency_backup_before_reset', 'gpm_projects_pre_restore', 'gpm_backups',
];
const keysToRemove = legacyKeys.filter((k) => allData[k] !== undefined);
if (keysToRemove.length > 0) {
  await chrome.storage.local.remove(keysToRemove);
  console.log('[GPM] Cleaned up', keysToRemove.length, 'legacy key(s)');
}
```

Also remove the v5 migration's no-op `delete data[key]` loop (lines 84-99) since it can never find those keys in the subset object. Replace the entire v5 migration with an empty pass-through:

```js
{
  fromVersion: 4,
  toVersion: 5,
  migrate: (data) => {
    // Legacy key cleanup happens after migrations via chrome.storage.local.remove()
    return data;
  },
},
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/background.js
git commit -m "fix: background.js migration v5 now actually removes legacy storage keys"
```

---

## Task 2: Fix `storage.js` — deduplicate legacyKeys, remove dead validator constants

**Files:**
- Modify: `src/storage.js:58-77,99-117,455-459`

- [ ] **Step 1: Extract `legacyKeys` to a single shared constant**

Replace the two duplicate `legacyKeys` arrays (lines 59-72 and 100-112) with one constant defined before `MIGRATIONS`:

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
  'gpm_backups',
];
```

Use `GPM_LEGACY_KEYS` in both migration 5 and `initializeStorage`. Delete the two inline arrays.

- [ ] **Step 2: Remove 5 dead validator constants**

Delete lines 455-459 (`sanitizeString`, `validateProject`, `validateChatMapping`, `validateQuickPrompt`, `validateSettings`). Only `validateImportData` (line 460) is used.

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/storage.js
git commit -m "refactor: deduplicate legacyKeys, remove unused validator constants"
```

---

## Task 3: Fix navigation.js — timer/listener leak in `gpmObserveNewChats`

**Files:**
- Modify: `src/navigation.js:146-171,513-637`

The `pollIntervalId` is closure-local and unreachable from `gpmCleanupObservers()`. The `visibilitychange` listener is anonymous and stacks on re-init.

- [ ] **Step 1: Move poll interval and visibility listener to module-level state**

Add module-level variables alongside existing ones (after line 116):

```js
let _newChatsPollInterval = null;
let _visibilityHandler = null;
```

- [ ] **Step 2: Refactor `gpmObserveNewChats` to use module-level interval**

In `gpmObserveNewChats()`, remove the closure-local `pollIntervalId`. Replace `gpmStartPolling` / `gpmStopPolling` inner functions with direct usage of `_newChatsPollInterval`:

```js
function gpmStartPolling() {
  if (_newChatsPollInterval) return;
  _newChatsPollInterval = setInterval(gpmPollCheck, GPM_CONFIG.POLL_INTERVAL);
}

function gpmStopPolling() {
  if (_newChatsPollInterval) {
    clearInterval(_newChatsPollInterval);
    _newChatsPollInterval = null;
  }
}
```

Move `gpmPollCheck`, `gpmStartPolling`, `gpmStopPolling` to module scope (outside `gpmObserveNewChats`). They reference `lastChatId` and `lastUrl` — convert those to module-level vars too:

```js
let _pollLastChatId = null;
let _pollLastUrl = null;
```

- [ ] **Step 3: Store visibility handler for removal**

Replace the anonymous visibilitychange listener (line 590) with a named, stored handler:

```js
if (_visibilityHandler) {
  document.removeEventListener('visibilitychange', _visibilityHandler);
}
_visibilityHandler = () => {
  if (document.visibilityState === 'visible') {
    gpmStartPolling();
    GPM_STATE._sidebarStabilized = false;
    GPM_STATE._sidebarStableCount = 0;
    GPM_STATE._lastSidebarChatCount = 0;
    _gpmWaitForSidebarStabilize();
    gpmRenderTree();
  } else {
    gpmStopPolling();
  }
};
document.addEventListener('visibilitychange', _visibilityHandler);
```

- [ ] **Step 4: Add cleanup in `gpmCleanupObservers`**

Add to the end of `gpmCleanupObservers()` (after line 170):

```js
gpmStopPolling();
if (_visibilityHandler) {
  document.removeEventListener('visibilitychange', _visibilityHandler);
  _visibilityHandler = null;
}
_pollLastChatId = null;
_pollLastUrl = null;
```

- [ ] **Step 5: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/navigation.js
git commit -m "fix: prevent timer/listener leak in gpmObserveNewChats on re-init"
```

---

## Task 4: Fix undo-redo — `delete_project` undo loses data

**Files:**
- Modify: `src/history/undo-redo.js:87-107`
- Modify: `src/project-tree.js:811-818`

- [ ] **Step 1: Capture full data in `delete_project` action creation**

In `src/project-tree.js`, in the delete confirm handler (line ~810), collect descendant projects and their chatMap entries before passing to `GPMHistory.createAction`:

```js
onConfirm: async () => {
  if (typeof GPMHistory !== 'undefined') {
    // Capture ALL descendant projects and their chatMap entries
    const allProjs = await GPMStorage.getProjects();
    const allChatMap = await GPMStorage.getChatMap();
    function collectDescendants(pid) {
      const node = allProjs.find((p) => p.id === pid);
      if (!node) return [pid];
      let ids = [pid];
      for (const childId of node.children || []) {
        ids = ids.concat(collectDescendants(childId));
      }
      return ids;
    }
    const descendantIds = new Set(collectDescendants(project.id));
    const capturedProjects = allProjs.filter((p) => descendantIds.has(p.id));
    const capturedChatMap = {};
    for (const cid of Object.keys(allChatMap)) {
      if (descendantIds.has(allChatMap[cid].projectId)) {
        capturedChatMap[cid] = allChatMap[cid];
      }
    }

    const action = GPMHistory.createAction('delete_project', {
      projectId: project.id,
      projectData: project,
      chatMapData: capturedChatMap,
      capturedProjects: capturedProjects,
    });
    GPMHistory.push(action);
  }
  await GPMStorage.deleteProject(project.id);
  gpmRenderTree();
},
```

- [ ] **Step 2: Fix undo to restore parent-child link and all descendants**

In `src/history/undo-redo.js`, update the `delete_project` case:

```js
case 'delete_project':
  return {
    type,
    projectData: data.projectData,
    chatMapData: data.chatMapData,
    capturedProjects: data.capturedProjects || [data.projectData],
    undo: async () => {
      const projects = await GPMStorage.getProjects();

      // Restore all captured projects (including descendants)
      for (const p of data.capturedProjects || [data.projectData]) {
        if (!projects.find((existing) => existing.id === p.id)) {
          projects.push(p);
        }
      }

      // Restore parent's children array link
      if (data.projectData.parentId) {
        const parent = projects.find((p) => p.id === data.projectData.parentId);
        if (parent && !parent.children.includes(data.projectData.id)) {
          parent.children.push(data.projectData.id);
        }
      }

      await GPMStorage.saveProjects(projects);

      const chatMap = await GPMStorage.getChatMap();
      Object.assign(chatMap, data.chatMapData);
      await GPMStorage.saveChatMap(chatMap);

      gpmRenderTree();
    },
    redo: async () => {
      await GPMStorage.deleteProject(data.projectData.id);
      gpmRenderTree();
    },
  };
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/history/undo-redo.js src/project-tree.js
git commit -m "fix: delete_project undo now restores parent link and all descendants"
```

---

## Task 5: Fix re-init race condition — guard against double initialization

**Files:**
- Modify: `src/dom-injection.js:677-707`

`gpmInit()` is async and can take seconds. A second re-init during the first one causes double initialization.

- [ ] **Step 1: Add a re-init lock**

In `src/dom-injection.js`, add a module-level flag:

```js
let _reinitInProgress = false;
```

Update `gpmScheduleReinit` to set/check the flag:

```js
function gpmScheduleReinit(reason) {
  if (GPM_STATE.reinitFailCount >= GPM_CONFIG.MAX_REINIT_FAILURES) {
    gpmWarn(
      'Re-init backed off after',
      GPM_STATE.reinitFailCount,
      'consecutive failures. Waiting for sidebar observer.'
    );
    GPM_STATE.initialized = false;
    gpmObserveForSidebar();
    return;
  }

  if (GPM_STATE.reinitDebounceTimer || _reinitInProgress) return;

  gpmLog('Scheduling re-initialization:', reason);
  GPM_STATE.reinitDebounceTimer = setTimeout(() => {
    GPM_STATE.reinitDebounceTimer = null;
    if (!gpmIsContextValid()) return;

    gpmLog('Executing re-initialization (attempt', GPM_STATE.reinitFailCount + 1, ')');
    _reinitInProgress = true;
    GPM_STATE.reinitFailCount++;

    gpmResetState();

    gpmInit().finally(() => {
      _reinitInProgress = false;
    });
  }, GPM_CONFIG.REINIT_DEBOUNCE);
}
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/dom-injection.js
git commit -m "fix: prevent double re-init with async lock in gpmScheduleReinit"
```

---

## Task 6: Fix health monitor — clean up observers before resetting

**Files:**
- Modify: `src/dom-injection.js:629-636`

When the health monitor detects the sidebar is gone, it sets `initialized = false` without stopping existing observers.

- [ ] **Step 1: Call cleanup before observing for sidebar**

Replace lines 634-636:

```js
} else {
  gpmLog('Health check: Sidebar not found, waiting for re-appearance');
  GPM_STATE.initialized = false;
  gpmObserveForSidebar();
}
```

With:

```js
} else {
  gpmLog('Health check: Sidebar not found, waiting for re-appearance');
  gpmStopHealthMonitor();
  if (typeof gpmCleanupObservers === 'function') gpmCleanupObservers();
  GPM_STATE.initialized = false;
  gpmObserveForSidebar();
}
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/dom-injection.js
git commit -m "fix: health monitor cleans up observers before waiting for sidebar"
```

---

## Task 7: Fix quick-prompts — performance of `_gpmFindToolsButton`

**Files:**
- Modify: `src/quick-prompts.js:198-220`

`document.querySelectorAll('span, div')` matches thousands of elements.

- [ ] **Step 1: Replace the broad span/div query with scoped search**

Replace the second loop in `_gpmFindToolsButton` (lines 207-218). Instead of querying all span/div globally, scope to the input container area:

```js
// Also check elements near the input area for "Tools" label
const inputArea = document.querySelector(GPM_SELECTORS.inputArea);
if (inputArea) {
  const container = inputArea.closest('form') || inputArea.closest('[role="region"]') || inputArea.parentElement?.parentElement;
  if (container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const text = textNode.textContent?.trim();
      if (text && _GPM_TOOLS_LABELS.includes(text)) {
        const el = textNode.parentElement;
        const clickable = el?.closest('button, [role="button"]');
        if (clickable) return clickable;
        if (el && el.children.length <= 2) return el;
      }
    }
  }
}
```

- [ ] **Step 2: Remove duplicate "Tools" entry in `_GPM_TOOLS_LABELS`**

In `_GPM_TOOLS_LABELS` array, remove the duplicate `'Tools'` at line 162 (German section — `'Tools'` is already at line 158 for English).

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/quick-prompts.js
git commit -m "perf: scope _gpmFindToolsButton search to input area instead of global DOM"
```

---

## Task 8: Fix templates — i18n support for folder templates

**Files:**
- Modify: `src/templates/folder-templates.js:131-157`

Templates always display Turkish names regardless of user locale.

- [ ] **Step 1: Use `nameEn` when user language is not Turkish**

In `applyTemplate`, replace `name: item.name` with language-aware name selection:

```js
async function applyTemplate(templateId) {
  const template = GPM_FOLDER_TEMPLATES[templateId];
  if (!template) {
    gpmError('Template not found:', templateId);
    return false;
  }

  const settings = await GPMStorage.getSettings();
  const useEnglish = settings.lang !== 'tr';

  function getLocalizedName(item) {
    return useEnglish && item.nameEn ? item.nameEn : item.name;
  }

  async function createStructure(items, parentId = null) {
    for (const item of items) {
      const project = await GPMStorage.createProject({
        name: getLocalizedName(item),
        icon: item.icon || '📁',
        color: '#8ab4f8',
        parentId,
      });

      if (item.children && item.children.length > 0) {
        await createStructure(item.children, project.id);
      }
    }
  }

  await createStructure(template.structure);
  gpmRenderTree();

  return true;
}

function getTemplateList() {
  const settings = typeof GPMStorage !== 'undefined' ? null : null;
  return Object.entries(GPM_FOLDER_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.nameEn || template.name,
    icon: template.icon,
    description: template.description,
  }));
}
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/templates/folder-templates.js
git commit -m "fix: template names now respect user language setting"
```

---

## Task 9: Fix favorites-manager — use GPMStorage instead of raw chrome.storage

**Files:**
- Modify: `src/favorites-manager.js` (full rewrite)

- [ ] **Step 1: Rewrite to use GPMStorage abstraction**

```js
const GPMFavoritesManager = (() => {
  const FAVORITES_KEY = 'gpm_favorites';

  async function getFavorites() {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(FAVORITES_KEY, (data) => resolve(data));
    });
    return result[FAVORITES_KEY] || [];
  }

  async function saveFavorites(favorites) {
    await new Promise((resolve) => {
      chrome.storage.local.set({ [FAVORITES_KEY]: favorites }, resolve);
    });
  }

  async function toggleFavorite(projectId) {
    const favorites = await getFavorites();
    const idx = favorites.indexOf(projectId);

    if (idx > -1) {
      favorites.splice(idx, 1);
    } else {
      favorites.push(projectId);
    }

    await saveFavorites(favorites);
    return idx === -1;
  }

  async function isFavorite(projectId) {
    const favorites = await getFavorites();
    return favorites.includes(projectId);
  }

  return {
    getFavorites,
    saveFavorites,
    toggleFavorite,
    isFavorite,
  };
})();
```

Note: We keep direct `chrome.storage.local` calls because `GPMStorage` doesn't expose generic get/set for custom keys, but we use the Promise-based pattern consistently and document the key in storage.js.

- [ ] **Step 2: Add `gpm_favorites` to the documented schema in `storage.js` header**

Update the doc block at `src/storage.js:14` to include `gpm_favorites: string[]` in the schema list.

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/favorites-manager.js src/storage.js
git commit -m "fix: favorites-manager uses consistent storage pattern, document schema key"
```

---

## Task 10: Fix project-tree — recursive chat count

**Files:**
- Modify: `src/project-tree.js:369`

- [ ] **Step 1: Count chats recursively through all descendant projects**

Replace line 369:

```js
const total = chatIds.length + children.reduce((s, c) => s + (c.chatIds?.length || 0), 0);
```

With a recursive helper:

```js
function countAllChats(proj, allProjs) {
  const own = (proj.chatIds || []).length;
  const kids = allProjs.filter((p) => p.parentId === proj.id);
  return own + kids.reduce((sum, kid) => sum + countAllChats(kid, allProjs), 0);
}
```

Call it:

```js
const total = countAllChats(project, allProjects);
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "fix: project chat count now includes all nested subfolders recursively"
```

---

## Task 11: Fix context-recovery — add stopMonitoring for interval cleanup

**Files:**
- Modify: `src/recovery/context-recovery.js:9-21,142-146`

- [ ] **Step 1: Add stopMonitoring function and expose it**

```js
function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  gpmLog('Context recovery monitoring stopped');
}
```

Add `stopMonitoring` to the return object.

- [ ] **Step 2: Call `GPMContextRecovery.stopMonitoring()` from `gpmResetState` in config.js**

In `src/config.js`, inside `gpmResetState()`, add:

```js
if (typeof GPMContextRecovery !== 'undefined' && GPMContextRecovery.stopMonitoring) {
  GPMContextRecovery.stopMonitoring();
}
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/recovery/context-recovery.js src/config.js
git commit -m "fix: context-recovery interval now properly cleaned up on re-init"
```

---

## Task 12: Fix keyboard shortcuts — cleanup on re-init

**Files:**
- Modify: `src/keyboard/shortcuts.js:146-171,175-178`

- [ ] **Step 1: Add destroy method and reset `_initialized`**

Add to `GPMKeyboardShortcuts`:

```js
function destroy() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _initialized = false;
  gpmLog('[GPM Keyboard] Shortcuts destroyed');
}
```

Add `destroy` to the return object.

- [ ] **Step 2: Call `GPMKeyboardShortcuts.destroy()` from `gpmResetState` in config.js**

Add after the context-recovery cleanup added in Task 11:

```js
if (typeof GPMKeyboardShortcuts !== 'undefined' && GPMKeyboardShortcuts.destroy) {
  GPMKeyboardShortcuts.destroy();
}
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/keyboard/shortcuts.js src/config.js
git commit -m "fix: keyboard shortcuts now properly cleaned up on re-init"
```

---

## Task 13: Fix background.js — remove `return true` for unmatched messages

**Files:**
- Modify: `src/background.js:300`

- [ ] **Step 1: Remove the unconditional `return true`**

Replace line 300:

```js
return true;
```

With:

```js
return false;
```

This prevents Chrome from keeping the message channel open for unhandled message types.

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/background.js
git commit -m "fix: background.js no longer leaks message ports for unhandled messages"
```

---

## Task 14: Remove dead code — uid.js, performance/, duplicate CSS

**Files:**
- Remove: `src/utils/uid.js` (entire file)
- Remove: `src/performance/` (entire empty directory)
- Modify: `manifest.json` (remove `src/utils/uid.js` from content_scripts)
- Modify: `src/styles.css` (remove duplicate rules)
- Modify: `src/ui/toast.js` (document or remove unused export)
- Modify: `tests/mocks/chrome.js:339` (remove `__legacyDoNotUse`)

- [ ] **Step 1: Remove `src/utils/uid.js` and update manifest.json**

Delete the file `src/utils/uid.js`. In `manifest.json`, remove `"src/utils/uid.js"` from the `content_scripts.js` array (line 14).

- [ ] **Step 2: Remove empty `src/performance/` directory**

Delete the empty directory `src/performance/`. Also update the comment in `src/content.js:18` that references it:

Change:
```
*   - performance/      → Virtualized list
```
To:
```
*   - performance/      → (reserved for future use)
```

- [ ] **Step 3: Remove duplicate CSS rules in styles.css**

Read `src/styles.css` and identify duplicate rule blocks. Remove the EARLIER definition of each duplicated rule (the later one wins in cascade):

- `.gpm-modal-title` (keep the one at ~line 893, remove ~line 298)
- `.gpm-input` (keep ~line 1258, remove ~line 306)
- `.gpm-field` (keep ~line 1276, remove ~line 352)
- `.gpm-label` (keep ~line 1280, remove ~line 342)
- `.gpm-toast` (keep ~line 1363, remove ~line 183)
- `@keyframes gpm-toast-in` (keep ~line 1419, remove ~line 265)

After removing, verify the file still has consistent styling by checking the remaining rules.

- [ ] **Step 4: Clean up `__legacyDoNotUse` in chrome.js mock**

In `tests/mocks/chrome.js`, remove line 339:

```js
let __legacyDoNotUse = null;
```

- [ ] **Step 5: Update eslint.config.js — remove uid global**

In `eslint.config.js`, the `generateUid: 'readonly'` or `uid: 'readonly'` global may be declared. Check and remove if present.

- [ ] **Step 6: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (uid.js, empty performance/, duplicate CSS, legacy mock var)"
```

---

## Task 15: Code quality — replace raw console.* with gpmLog wrappers

**Files:**
- Modify: `src/quick-prompts.js:91,99,138,289,294,305,317,326`
- Modify: `src/sync/sync-manager.js:56,66`

- [ ] **Step 1: Replace console.log/error in quick-prompts.js**

Replace all `console.log('[GPM-DIAG]...')` with `gpmLog('...')` and `console.error('[GPM-DIAG]...')` with `gpmError('...')`. Remove the `[GPM-DIAG]` prefix since `gpmLog` already prefixes with `[GPM]`.

Lines to change:
- `console.log('[GPM-DIAG]...')` → `gpmLog('...')`
- `console.error('[GPM-DIAG]...')` → `gpmError('...')`

- [ ] **Step 2: Replace console.warn/error in sync-manager.js**

- Line 56: `console.warn('[GPM Sync]...')` → `gpmWarn('[GPM Sync]...')`
- Line 66: `console.error('[GPM Sync]...')` → `gpmError('[GPM Sync]...')`

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/quick-prompts.js src/sync/sync-manager.js
git commit -m "style: replace raw console.* with gpmLog/gpmWarn/gpmError wrappers"
```

---

## Task 16: Fix tests — improve mock and fix weak assertions

**Files:**
- Modify: `tests/mocks/chrome.js:192-197`
- Modify: `tests/storage.test.js` (improve migration test)
- Modify: `tests/selectors.test.js:198`

- [ ] **Step 1: Add lock contention support to chrome mock**

In `tests/mocks/chrome.js`, add a lock state and make `runtimeSendMessage` respect it:

```js
let _mockLockGranted = true;

export function setMockLockGranted(granted) {
  _mockLockGranted = granted;
}

function runtimeSendMessage(msg) {
  if (msg && msg.type === 'GPM_ACQUIRE_LOCK') return Promise.resolve({ granted: _mockLockGranted });
  if (msg && msg.type === 'GPM_RELEASE_LOCK') return Promise.resolve({ ok: true });
  if (msg && msg.type === 'GPM_STORAGE_UPDATED') return Promise.resolve({ ok: true });
  return Promise.resolve();
}
```

Export `setMockLockGranted`.

- [ ] **Step 2: Fix storage migration test to actually test tag removal**

In `tests/storage.test.js`, update the v2→v5 migration test to create entries WITH tags before migrating:

```js
// Before migration, set tags on chatMap entries
chatMapWithStarred['chat1'].tags = ['tag1', 'tag2'];
// Also set gpm_tags
mockData.gpm_tags = { tag1: 'Tag 1', tag2: 'Tag 2' };
```

Then assert after migration that `tags` is gone and `gpm_tags` is gone.

- [ ] **Step 3: Fix tautological assertion in selectors.test.js**

Replace line 198:

```js
expect(result === null || result === el).toBe(true);
```

With a meaningful test — either assert the specific expected result, or use `test.skip` with a comment:

```js
// jsdom cannot reproduce Gemini's DOM structure for this selector
// Verify the function doesn't throw
expect(() => gpmQuerySelector('inputArea')).not.toThrow();
```

- [ ] **Step 4: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: fix weak assertions, add lock contention mock support"
```

---

## Task 17: Fix dom-injection.js duplicate "Chats" entry in `gpmSidebarHasContent`

**Files:**
- Modify: `src/dom-injection.js:524-540`

- [ ] **Step 1: Fix comments and remove duplicate entry**

The `chatLabels` array has 'Chats' listed twice (lines 525 and 527). Remove the duplicate and fix comments:

```js
const chatLabels = [
  'Chats',        // en, fr, pt
  'Sohbetler',    // tr
  'Chat',         // de, it
  'Чаты',         // ru
  'チャット',      // ja
  '聊天',         // zh
  'Conversaciones', // es
  'चैट्स',        // hi
  '대화',          // ko
  'المحادثات',    // ar
  'Cuộc trò chuyện', // vi
  'Obrolan',      // id
  'แชท',          // th
  'চ্যাটস',       // bn
];
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/dom-injection.js
git commit -m "fix: remove duplicate 'Chats' entry in sidebar content detection"
```

---

## Task 18: Deduplicate uid() — consolidate to single implementation

**Files:**
- Modify: `src/storage.js:124-129` (remove private `uid()`)
- Modify: `src/backup/backup-manager.js` (remove private `uid()`, use global or inline)

The global `uid()` from `uid.js` was removed in Task 14. Now `storage.js` and `backup-manager.js` have their own copies.

- [ ] **Step 1: Read `src/backup/backup-manager.js` to find its uid()**

Read the file and locate the private `uid()` function.

- [ ] **Step 2: Create a shared `generateUid` utility**

Add a global `generateUid()` function in `src/config.js` (which loads early and is available to all):

```js
function generateUid() {
  const timestamp = Date.now().toString(36);
  const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const random2 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${timestamp}-${random1}-${random2}`;
}
```

- [ ] **Step 3: Replace private `uid()` calls in storage.js and backup-manager.js**

In `src/storage.js`, rename the private `uid()` to call `generateUid()`:

```js
// Remove the private uid() function (lines 124-129)
// Replace all uid() calls with generateUid()
```

In `src/backup/backup-manager.js`, replace its private `uid()` with `generateUid()`.

- [ ] **Step 4: Update eslint.config.js**

Add `generateUid: 'readonly'` to the globals list if not already present.

- [ ] **Step 5: Run lint and tests**

```bash
npm run lint && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/storage.js src/backup/backup-manager.js eslint.config.js
git commit -m "refactor: consolidate uid() into shared generateUid() in config.js"
```

---

## Task 19: Final verification — run full suite and fix any regressions

**Files:** All modified files

- [ ] **Step 1: Run full verification pipeline**

```bash
npm run lint
npm run format:check
npm test
npm run test:coverage
```

- [ ] **Step 2: Fix any lint errors, format issues, or test failures**

Address each issue found in the verification pipeline.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix verification issues from full audit cleanup"
```

---

## Summary

| Task | Category | Severity | Key Change |
|------|----------|----------|------------|
| 1 | BUG | HIGH | background.js migration v5 actually cleans legacy keys |
| 2 | DEAD | MEDIUM | Deduplicate legacyKeys, remove dead validators |
| 3 | BUG | HIGH | navigation.js timer/listener leak on re-init |
| 4 | BUG | HIGH | delete_project undo restores parent link + descendants |
| 5 | BUG | HIGH | Re-init race condition guard |
| 6 | BUG | MEDIUM | Health monitor cleans up observers |
| 7 | PERF | HIGH | _gpmFindToolsButton scoped to input area |
| 8 | BUG | HIGH | Template names respect user language |
| 9 | BUG | MEDIUM | favorites-manager consistent storage pattern |
| 10 | BUG | LOW | Recursive chat count for nested folders |
| 11 | BUG | MEDIUM | context-recovery interval cleanup |
| 12 | BUG | MEDIUM | keyboard shortcuts cleanup on re-init |
| 13 | BUG | MEDIUM | background.js no longer leaks message ports |
| 14 | DEAD | HIGH | Remove uid.js, empty perf/, duplicate CSS |
| 15 | QUAL | MEDIUM | Use gpmLog wrappers consistently |
| 16 | TEST | MEDIUM | Fix weak test assertions, add lock mock |
| 17 | BUG | LOW | Remove duplicate chatLabels entry |
| 18 | DEAD | MEDIUM | Consolidate uid() to single shared function |
| 19 | VERIFY | — | Full pipeline verification |
