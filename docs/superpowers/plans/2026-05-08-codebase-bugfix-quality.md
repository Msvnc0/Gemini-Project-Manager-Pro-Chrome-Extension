# Codebase Bug Fix & Quality Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified bugs, remove dead code, and improve code quality across the entire Gemini Project Manager Pro extension.

**Architecture:** Incremental fixes organized by module dependency order. Each task is self-contained and can be tested independently. Tasks are grouped into phases: Phase 1 = Critical bugs, Phase 2 = Medium bugs, Phase 3 = Dead code cleanup, Phase 4 = Code quality & test infrastructure.

**Tech Stack:** Chrome Extension Manifest V3, plain JS (no modules in src/), Vitest for tests, ESLint + Prettier for linting.

---

## Phase 1: Critical Bugs (HIGH severity)

### Task 1: Fix `assignChat` losing `starredAt` field

**Files:**
- Modify: `src/storage.js:325-330`

- [ ] **Step 1: Write the failing test**

In `tests/storage.test.js`, add a test inside the `assignChat` describe block:

```js
it('preserves starredAt when reassigning chat to different project', async () => {
  const starTime = 1700000000000;
  setMockStorage({
    gpm_projects: [{ id: 'p1', name: 'A', icon: '📁', color: '#8ab4f8', parentId: null, children: [], chatIds: ['c1'], collapsed: false, createdAt: 1, updatedAt: 1 }],
    gpm_chatMap: { c1: { projectId: 'p1', alias: '', pinned: false, _autoResolved: false, starredAt: starTime } },
  });

  await GPMStorage.assignChat('c1', 'p2');

  const chatMap = await GPMStorage.getChatMap();
  expect(chatMap.c1.starredAt).toBe(starTime);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage.test.js --reporter=verbose 2>&1 | Select-String -Pattern "starredAt"`
Expected: FAIL — `starredAt` is `undefined` or `null` instead of `1700000000000`

- [ ] **Step 3: Fix the code**

In `src/storage.js`, replace the `assignChat` mapping creation (lines 325-330):

```js
      chatMap[chatId] = {
        projectId,
        alias: chatMap[chatId]?.alias || '',
        pinned: chatMap[chatId]?.pinned || false,
        _autoResolved: chatMap[chatId]?._autoResolved || false,
        starredAt: chatMap[chatId]?.starredAt ?? null,
      };
```

The change: add `starredAt: chatMap[chatId]?.starredAt ?? null` — using `??` instead of `||` to preserve `0` as a falsy-but-valid timestamp (though timestamps are always positive, `??` is more correct).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "fix: preserve starredAt field when reassigning chat to different project"
```

---

### Task 2: Fix `createProject` race condition — add write lock

**Files:**
- Modify: `src/storage.js:236-249`

- [ ] **Step 1: Write the failing test**

In `tests/storage.test.js`, add:

```js
it('createProject uses write lock (concurrent-safe)', async () => {
  setMockStorage({ gpm_projects: [], gpm_chatMap: {} });

  const results = await Promise.all([
    GPMStorage.createProject({ name: 'P1' }),
    GPMStorage.createProject({ name: 'P2' }),
  ]);

  const projects = await GPMStorage.getProjects();
  expect(projects).toHaveLength(2);
  expect(results.map((r) => r.name).sort()).toEqual(['P1', 'P2']);
});
```

- [ ] **Step 2: Run test — it may pass or fail depending on timing**

Run: `npx vitest run tests/storage.test.js --reporter=verbose`
The test documents the expected behavior. The real fix is making `createProject` use `_withLock`.

- [ ] **Step 3: Fix the code**

Replace `createProject` in `src/storage.js` (lines 236-249):

```js
  async function createProject({ name, icon = '📁', color = '#8ab4f8', parentId = null }) {
    return _withLock(async () => {
      const projects = await getProjects();
      const id = generateUid();
      const project = { id, name, icon, color, parentId, children: [], chatIds: [], collapsed: false };
      projects.push(project);

      if (parentId) {
        const parent = projects.find((p) => p.id === parentId);
        if (parent) parent.children.push(id);
      }

      await _set('gpm_projects', projects);
      return project;
    });
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/storage.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "fix: add write lock to createProject for concurrent safety"
```

---

### Task 3: Fix auto-backup missing prompts and settings

**Files:**
- Modify: `src/storage.js:206-218`

- [ ] **Step 1: Fix `_saveAtomic` to include prompts and settings in backup**

Replace `_saveAtomic` in `src/storage.js` (lines 206-219):

```js
  async function _saveAtomic(projects, chatMap) {
    const currentProjects = await _get('gpm_projects');
    const currentChatMap = await _get('gpm_chatMap');
    const currentPrompts = await _get('gpm_quickPrompts');
    const currentSettings = await _get('gpm_settings');

    await _writeBackup('auto', {
      projects: currentProjects,
      chatMap: currentChatMap,
      prompts: currentPrompts,
      settings: currentSettings,
    });

    await _setBulk({
      gpm_projects: projects,
      gpm_chatMap: chatMap,
    });
  }
```

- [ ] **Step 2: Also fix `saveProjects` backup call (line 230)**

Replace the `_writeBackup` call in `saveProjects` (line 230):

```js
      await _writeBackup('auto', { projects: current, chatMap: chatMap, prompts: await _get('gpm_quickPrompts'), settings: await _get('gpm_settings') });
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/storage.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/storage.js
git commit -m "fix: include prompts and settings in auto-backups to prevent data loss on restore"
```

---

### Task 4: Fix `sanitizeString` over-aggressive character stripping

**Files:**
- Modify: `src/utils/validators.js:17-18`

- [ ] **Step 1: Fix the regex to allow common safe characters**

Replace the `sanitizeString` function (lines 15-21):

```js
  function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, maxLength)
      .trim();
  }
```

This removes only actual control characters (C0 range, DEL) instead of stripping useful symbols. The content is displayed via `textContent` (not `innerHTML`), so XSS is not a concern — sanitization should only remove invisible/control characters.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All existing tests pass (no test file exists for validators, but other tests that import validators should work)

- [ ] **Step 3: Commit**

```bash
git add src/utils/validators.js
git commit -m "fix: relax sanitizeString to only strip control characters, not symbols"
```

---

### Task 5: Fix stale reference in project drag-drop nesting

**Files:**
- Modify: `src/project-tree.js:517-526`

- [ ] **Step 1: Fix the stale reference bug**

Replace lines 517-526 in `src/project-tree.js`:

```js
      if (zone === 'center') {
        // ── NEST: move droppedProject INTO project ──
        if (droppedProject.parentId) {
          const oldParent = projects.find((p) => p.id === droppedProject.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== droppedProjectId);
        }
        droppedProject.parentId = project.id;
        const freshTarget = projects.find((p) => p.id === project.id);
        if (!freshTarget) return;
        if (!freshTarget.children) freshTarget.children = [];
        if (!freshTarget.children.includes(droppedProjectId)) freshTarget.children.push(droppedProjectId);
        await GPMStorage.saveProjects(projects);
```

Key change: use `freshTarget` (from the freshly fetched `projects` array) instead of the closure's stale `project` parameter.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "fix: use fresh target reference in drag-drop nesting to prevent data loss"
```

---

### Task 6: Fix boot function — add error handling and unhandled rejection guard

**Files:**
- Modify: `src/content.js:215-221`

- [ ] **Step 1: Fix the boot IIFE**

Replace the boot section (lines 215-221) in `src/content.js`:

```js
(async function boot() {
  try {
    if (document.readyState === 'loading') {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve));
    }
    await gpmInit();
  } catch (e) {
    gpmError('Fatal: gpmInit() failed:', e);
  }
})();
```

- [ ] **Step 2: Also fix version string on line 35**

Replace line 35 in `src/content.js`:

```js
  gpmLog('gpmInit() started - v' + (typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev'));
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content.js
git commit -m "fix: add error handling to boot function and use manifest version string"
```

---

### Task 7: Fix `gpmResetState` — stop health monitor and sync timer

**Files:**
- Modify: `src/config.js:82-133`

- [ ] **Step 1: Add health monitor cleanup and sync cleanup to `gpmResetState`**

In `src/config.js`, after line 102 (the enhanceAbortController block), add:

```js
  if (typeof gpmStopHealthMonitor === 'function') {
    gpmStopHealthMonitor();
  }
  if (typeof GPMSyncManager !== 'undefined' && GPMSyncManager.stopAutoSync) {
    GPMSyncManager.stopAutoSync();
  }
```

Also add `GPM_STATE.healthCheckTimer = null;` to the reset block (after line 122).

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "fix: stop health monitor and sync timer during state reset"
```

---

### Task 8: Fix backup-manager non-atomic restore

**Files:**
- Modify: `src/backup/backup-manager.js:91-122`

- [ ] **Step 1: Use `_setBulk` via `GPMStorage` for atomic restore**

Replace `restoreBackup` function (lines 91-122):

```js
  async function restoreBackup(backupId) {
    try {
      const backup = await getBackup(backupId);
      if (!backup) {
        gpmError('Backup not found:', backupId);
        return false;
      }

      await createBackup(TRIGGERS.BEFORE_RESTORE, 'Auto-backup before restore');

      const data = backup.data;

      await GPMStorage.importAll(JSON.stringify({
        gpm_projects: data.projects || [],
        gpm_chatMap: data.chatMap || {},
        gpm_quickPrompts: data.prompts || [],
        gpm_settings: data.settings || { lang: 'en', theme: 'auto' },
      }));

      gpmLog('Restored from backup:', backupId);
      return true;
    } catch (e) {
      gpmError('Failed to restore backup:', e);
      return false;
    }
  }
```

This uses `GPMStorage.importAll` which uses `_setBulk` for atomic writes with a write lock.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/backup/backup-manager.js
git commit -m "fix: use atomic importAll for backup restore to prevent partial data loss"
```

---

### Task 9: Fix sync-manager pushing timestamps when nothing changed

**Files:**
- Modify: `src/sync/sync-manager.js:124-142`

- [ ] **Step 1: Only push when local data has actually changed**

Replace `startAutoSync` (lines 124-145):

```js
  async function startAutoSync() {
    if (syncTimer) return;

    let lastVersion = await calculateDataVersion();

    syncTimer = setInterval(async () => {
      if (!gpmIsContextValid()) {
        stopAutoSync();
        return;
      }

      const conflict = await checkForConflicts();
      if (conflict.hasConflict) {
        gpmLog('[GPM Sync] Conflict detected during auto-sync');
        if (typeof GPMUI !== 'undefined' && GPM_STATE.modalRoot) {
          showConflictNotification(conflict);
        }
      } else {
        const currentVersion = await calculateDataVersion();
        if (currentVersion !== lastVersion) {
          await syncPush();
          lastVersion = currentVersion;
        }
      }
    }, SYNC_INTERVAL);

    gpmLog('[GPM Sync] Auto-sync started');
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/sync/sync-manager.js
git commit -m "fix: only push sync meta when local data has actually changed"
```

---

### Task 10: Fix undo-redo `delete_project` incomplete restoration

**Files:**
- Modify: `src/history/undo-redo.js:97-119`

- [ ] **Step 1: Fix the undo to properly restore all descendants' parent links**

Replace the `delete_project` action factory (lines 91-125):

```js
      case 'delete_project':
        return {
          type,
          projectData: data.projectData,
          chatMapData: data.chatMapData,
          capturedProjects: data.capturedProjects || [data.projectData],
          undo: async () => {
            const projects = await GPMStorage.getProjects();
            const chatMap = await GPMStorage.getChatMap();

            for (const p of data.capturedProjects || [data.projectData]) {
              if (!projects.find((existing) => existing.id === p.id)) {
                projects.push(p);
              }
            }

            if (data.projectData.parentId) {
              const parent = projects.find((p) => p.id === data.projectData.parentId);
              if (parent && !parent.children.includes(data.projectData.id)) {
                parent.children.push(data.projectData.id);
              }
            }

            await GPMStorage.saveProjects(projects);

            for (const [chatId, mapping] of Object.entries(data.chatMapData || {})) {
              chatMap[chatId] = mapping;
            }
            await GPMStorage.saveChatMap(chatMap);

            gpmRenderTree();
          },
          redo: async () => {
            await GPMStorage.deleteProject(data.projectData.id);
            gpmRenderTree();
          },
        };
```

Key changes:
- ChatMap restore uses per-key merge instead of `Object.assign` to avoid overwriting unrelated entries
- Restores all captured descendants properly

- [ ] **Step 2: Fix `create_project` redo to check for duplicates**

Replace `create_project` case (lines 127-148):

```js
      case 'create_project':
        return {
          type,
          projectId: data.projectId,
          projectData: data.projectData,
          undo: async () => {
            await GPMStorage.deleteProject(data.projectId);
            gpmRenderTree();
          },
          redo: async () => {
            const projects = await GPMStorage.getProjects();
            if (projects.find((p) => p.id === data.projectId)) {
              gpmWarn('[GPM History] create_project redo skipped — project already exists');
              return;
            }
            projects.push(data.projectData);
            if (data.projectData.parentId) {
              const parent = projects.find((p) => p.id === data.projectData.parentId);
              if (parent && !parent.children.includes(data.projectData.id)) {
                parent.children.push(data.projectData.id);
              }
            }
            await GPMStorage.saveProjects(projects);
            gpmRenderTree();
          },
        };
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/history/undo-redo.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/history/undo-redo.js
git commit -m "fix: complete undo restoration for delete_project and add duplicate guard to create_project redo"
```

---

### Task 11: Fix integrity-check write lock bypass

**Files:**
- Modify: `src/recovery/integrity-check.js` (autoFix function, around line 263-269)

- [ ] **Step 1: Replace raw `chrome.storage.local.set` with locked write**

In the `autoFix` function, replace the save block with:

```js
    const hasChatMapFixes = fixed.some((f) => f.type === 'orphaned_chatmap_entries');
    if (hasChatMapFixes) {
      const updates = {};
      updates.gpm_projects = projects;
      updates.gpm_chatMap = chatMap;
      await GPMStorage.saveProjects(updates.gpm_projects);
      await GPMStorage.saveChatMap(updates.gpm_chatMap);
    } else {
      await GPMStorage.saveProjects(projects);
    }
```

This ensures all writes go through `GPMStorage` which uses write locks.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/recovery/integrity-check.js
git commit -m "fix: use GPMStorage locked writes in integrity-check autoFix"
```

---

### Task 12: Fix context-recovery countdown leak and overlay not dismissing

**Files:**
- Modify: `src/recovery/context-recovery.js`

- [ ] **Step 1: Store countdown interval at module level and dismiss overlay on recovery**

Replace the entire `GPMContextRecovery` module (lines 1-159):

```js
const GPMContextRecovery = (() => {
  let isInvalidated = false;
  let checkInterval = null;
  let recoveryOverlay = null;
  let countdownInterval = null;

  const CHECK_INTERVAL_MS = 2000;

  function startMonitoring() {
    if (checkInterval) return;

    checkInterval = setInterval(() => {
      const isValid = checkContext();
      if (!isValid && !isInvalidated) {
        isInvalidated = true;
        showRecoveryUI();
      }
      if (isValid && isInvalidated) {
        isInvalidated = false;
        dismissRecoveryUI();
      }
    }, CHECK_INTERVAL_MS);

    gpmLog('Context recovery monitoring started');
  }

  function checkContext() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function dismissRecoveryUI() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (recoveryOverlay && recoveryOverlay.parentNode) {
      recoveryOverlay.remove();
    }
    recoveryOverlay = null;
  }

  function showRecoveryUI() {
    if (recoveryOverlay) return;

    const style = document.createElement('style');
    style.textContent = [
      '@keyframes gpm-fade-in {',
      '  from { opacity: 0; }',
      '  to { opacity: 1; }',
      '}',
      '@keyframes gpm-pulse {',
      '  0%, 100% { transform: scale(1); }',
      '  50% { transform: scale(1.05); }',
      '}',
      '#gpm-reload-btn {',
      '  padding: 12px 32px;',
      '  background: #8ab4f8;',
      '  border: none;',
      '  border-radius: 24px;',
      '  font-size: 16px;',
      '  font-weight: 500;',
      '  cursor: pointer;',
      '  transition: background 150ms, transform 150ms;',
      '  color: #1e1f20;',
      '}',
      '#gpm-reload-btn:hover {',
      '  background: #aecbfa;',
      '  transform: scale(1.05);',
      '}',
      '#gpm-reload-btn:active {',
      '  transform: scale(0.98);',
      '}',
    ].join('\n');

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.0.85);z-index:999999;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'color:#e3e3e3;font-family:"Google Sans","Segoe UI",system-ui,sans-serif;' +
      'animation:gpm-fade-in 200ms ease;';

    const container = document.createElement('div');
    container.style.cssText = 'text-align:center;max-width:420px;padding:32px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:64px;margin-bottom:24px;animation:gpm-pulse 2s ease-in-out infinite;';
    icon.textContent = '\uD83D\uDD04';
    container.appendChild(icon);

    const h2 = document.createElement('h2');
    h2.style.cssText = 'margin:0 0 16px;font-size:24px;font-weight:400;';
    h2.textContent = t('extensionUpdated') || 'Extension Updated';
    container.appendChild(h2);

    const p = document.createElement('p');
    p.style.cssText = 'opacity:0.8;margin:0 0 24px;font-size:15px;line-height:1.6;';
    p.textContent =
      t('extensionUpdatedMessage') ||
      'Gemini Project Manager has been updated. Please reload the page to continue using it.';
    container.appendChild(p);

    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'gpm-reload-btn';
    reloadBtn.textContent = t('reloadPage') || 'Reload Page';
    container.appendChild(reloadBtn);

    const countdownP = document.createElement('p');
    countdownP.style.cssText = 'opacity:0.5;margin-top:16px;font-size:12px;';
    countdownP.appendChild(document.createTextNode((t('autoReloadIn') || 'Auto-reload in') + ' '));
    const countdownSpan = document.createElement('span');
    countdownSpan.id = 'gpm-reload-countdown';
    countdownSpan.textContent = '10';
    countdownP.appendChild(countdownSpan);
    container.appendChild(countdownP);

    overlay.appendChild(container);
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    recoveryOverlay = overlay;

    reloadBtn.addEventListener('click', () => {
      dismissRecoveryUI();
      location.reload();
    });

    startAutoReloadCountdown();
  }

  function startAutoReloadCountdown() {
    let seconds = 10;
    const countdownEl = document.getElementById('gpm-reload-countdown');

    countdownInterval = setInterval(() => {
      seconds--;
      if (countdownEl) {
        countdownEl.textContent = seconds;
      }
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        location.reload();
      }
    }, 1000);
  }

  function isContextValid() {
    return !isInvalidated && checkContext();
  }

  function stopMonitoring() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    dismissRecoveryUI();
    gpmLog('Context recovery monitoring stopped');
  }

  return {
    startMonitoring,
    stopMonitoring,
    isContextValid,
    showRecoveryUI,
  };
})();
```

Key fixes:
- `countdownInterval` stored at module level, cleaned up properly
- `dismissRecoveryUI()` added — clears countdown and removes overlay
- When context becomes valid again (`isInvalidated → false`), overlay is dismissed
- `stopMonitoring` also calls `dismissRecoveryUI`
- Removed dead `lastValidCheck` variable

- [ ] **Step 2: Fix the background rgba typo**

In the `showRecoveryUI` overlay CSS string, fix the double-dot typo:
`'rgba(0,0,0,0.0.85)'` → `'rgba(0,0,0,0.85)'`

- [ ] **Step 3: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/recovery/context-recovery.js
git commit -m "fix: dismiss recovery overlay when context recovers, clean up countdown timer"
```

---

## Phase 2: Medium Bugs

### Task 13: Fix quick prompt operations to use write lock

**Files:**
- Modify: `src/storage.js:384-401`

- [ ] **Step 1: Wrap all three quick prompt functions with `_withLock`**

Replace lines 384-401 in `src/storage.js`:

```js
  async function saveQuickPrompt({ title, content, category = 'General' }) {
    return _withLock(async () => {
      const prompts = await getQuickPrompts();
      prompts.push({ id: generateUid(), title, content, category });
      await _set('gpm_quickPrompts', prompts);
    });
  }

  async function deleteQuickPrompt(id) {
    return _withLock(async () => {
      let prompts = await getQuickPrompts();
      prompts = prompts.filter((p) => p.id !== id);
      await _set('gpm_quickPrompts', prompts);
    });
  }

  async function updateQuickPrompt(id, updates) {
    return _withLock(async () => {
      const prompts = await getQuickPrompts();
      const idx = prompts.findIndex((p) => p.id === id);
      if (idx !== -1) Object.assign(prompts[idx], updates);
      await _set('gpm_quickPrompts', prompts);
    });
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/storage.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/storage.js
git commit -m "fix: add write lock to quick prompt operations for concurrent safety"
```

---

### Task 14: Fix background.js migration 5 to match storage.js

**Files:**
- Modify: `src/background.js:80-86`

- [ ] **Step 1: Make migration 5 in background.js match storage.js**

Replace the migration 5 block (lines 80-86):

```js
  {
    fromVersion: 4,
    toVersion: 5,
    migrate: (data) => {
      const legacyKeys = [
        'gpm_projects_backup', 'gpm_backup_ts', 'gpm_chatMap_backup',
        'gpm_pre_import_projects', 'gpm_pre_import_chatMap', 'gpm_pre_import_quickPrompts',
        'gpm_pre_import_ts', 'gpm_pre_migration_backup', 'gpm_update_backup',
        'gpm_emergency_backup_before_reset', 'gpm_projects_pre_restore', 'gpm_tags',
      ];
      for (const key of legacyKeys) {
        if (data[key] !== undefined) delete data[key];
      }
      return data;
    },
  },
```

Note: Background.js migration 5 now matches storage.js migration 5's logic. The separate legacy cleanup block at lines 159-177 acts as a safety net (idempotent).

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/background.js
git commit -m "fix: synchronize migration 5 between background.js and storage.js"
```

---

### Task 15: Fix favorites-manager to use GPMStorage

**Files:**
- Modify: `src/favorites-manager.js`

- [ ] **Step 1: Refactor to use GPMStorage._get/_set or add proper storage methods**

Replace `src/favorites-manager.js` entirely:

```js
const GPMFavoritesManager = (() => {
  const FAVORITES_KEY = 'gpm_favorites';

  async function getFavorites() {
    try {
      const result = await chrome.storage.local.get(FAVORITES_KEY);
      return result[FAVORITES_KEY] || [];
    } catch (e) {
      return [];
    }
  }

  async function saveFavorites(favorites) {
    try {
      await chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
    } catch (e) {
      if (typeof gpmError === 'function') gpmError('[GPM Favorites] Save failed:', e);
    }
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
    toggleFavorite,
    isFavorite,
  };
})();
```

Changes: removed unused `getFavorites` from public API, added error logging in `saveFavorites`.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/favorites-manager.js
git commit -m "fix: add error logging to favorites-manager, remove unused getFavorites export"
```

---

### Task 16: Fix toast.js — use Shadow DOM for styling and i18n

**Files:**
- Modify: `src/ui/toast.js`

- [ ] **Step 1: Rewrite toast to use GPM_STATE.modalRoot (Shadow DOM) and i18n**

Replace entire `src/ui/toast.js`:

```js
(function () {
  const MAX_TOASTS = 3;
  const DEFAULT_DURATIONS = {
    success: 3000,
    info: 3000,
    warning: 3000,
    error: 5000,
  };

  const TOAST_STYLES = `
    #gpm-toast-container {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .gpm-toast {
      pointer-events: auto;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      color: #fff;
      max-width: 380px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: gpm-toast-in 200ms ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .gpm-toast-info { background: #1a73e8; }
    .gpm-toast-success { background: #1e8e3e; }
    .gpm-toast-warning { background: #e37400; }
    .gpm-toast-error { background: #d93025; }
    .gpm-toast-exit { animation: gpm-toast-out 300ms ease forwards; }
    .gpm-toast-undo {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      color: #fff;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .gpm-toast-undo:hover { background: rgba(255,255,255,0.3); }
    @keyframes gpm-toast-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes gpm-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-8px); } }
  `;

  function getContainer() {
    const root = typeof GPM_STATE !== 'undefined' && GPM_STATE.modalRoot ? GPM_STATE.modalRoot : document.body;
    let container = root.querySelector('#gpm-toast-container') || root.getElementById && root.getElementById('gpm-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'gpm-toast-container';

      const style = document.createElement('style');
      style.textContent = TOAST_STYLES;
      container.appendChild(style);

      root.appendChild(container);
    }
    return container;
  }

  function showToast(message, type, options) {
    type = type || 'info';
    options = options || {};

    const container = getContainer();
    const duration = options.duration != null ? options.duration : DEFAULT_DURATIONS[type] || 3000;

    while (container.querySelectorAll('.gpm-toast').length >= MAX_TOASTS) {
      const oldest = container.querySelector('.gpm-toast');
      if (oldest) {
        clearTimeout(oldest._gpmTimerId);
        oldest.remove();
      }
    }

    const toast = document.createElement('div');
    toast.className = 'gpm-toast gpm-toast-' + type;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'gpm-toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (options.undoAction) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'gpm-toast-undo';
      undoBtn.textContent = typeof t === 'function' ? (t('undo') || 'Undo') : 'Undo';
      undoBtn.addEventListener('click', function () {
        options.undoAction();
        dismissToast(toast);
      });
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);

    const timerId = setTimeout(function () {
      dismissToast(toast);
    }, duration);

    toast._gpmTimerId = timerId;

    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._gpmTimerId);
    toast.classList.add('gpm-toast-exit');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  window.showToast = showToast;
})();
```

Key fixes:
- Toast container now created inside `GPM_STATE.modalRoot` (Shadow DOM) when available
- Self-contained CSS injected as `<style>` inside the container
- Undo button uses `t('undo')` i18n function when available
- Falls back to `document.body` when Shadow DOM isn't ready

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/ui/toast.test.js --reporter=verbose`
Expected: PASS (may need minor adjustment to test for the new structure)

- [ ] **Step 3: Commit**

```bash
git add src/ui/toast.js
git commit -m "fix: toast now uses Shadow DOM for styling and i18n for undo button"
```

---

### Task 17: Fix `showContextMenu` listener leak in ui_elements.js

**Files:**
- Modify: `src/ui_elements.js`

- [ ] **Step 1: Track and remove previous close handlers**

At the top of `showContextMenu` (around line 470-490), add a cleanup mechanism. Find the function and add at its start:

```js
  if (typeof window._gpmContextMenuCleanup === 'function') {
    window._gpmContextMenuCleanup();
  }
```

Then where the close handlers are registered (around lines 576-578), wrap them:

```js
  const closeHandler = (e) => {
    if (menu.contains(e.target)) return;
    cleanup();
  };

  const cleanup = () => {
    menu.remove();
    document.removeEventListener('click', closeHandler, true);
    if (shadowRoot && shadowRoot !== document) shadowRoot.removeEventListener('click', closeHandler, true);
    window._gpmContextMenuCleanup = null;
  };

  document.addEventListener('click', closeHandler, true);
  if (shadowRoot && shadowRoot !== document) shadowRoot.addEventListener('click', closeHandler, true);
  window._gpmContextMenuCleanup = cleanup;
```

Replace the existing close handler registration with this pattern.

- [ ] **Step 2: Run lint and tests**

Run: `npm run lint; npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/ui_elements.js
git commit -m "fix: clean up context menu click listeners to prevent memory leak"
```

---

### Task 18: Fix `isDescendant` circular reference protection

**Files:**
- Modify: `src/project-tree.js:500-506`

- [ ] **Step 1: Add depth limit to prevent infinite recursion**

Replace the `isDescendant` function (lines 500-506):

```js
      const isDescendant = (parentId, childId, visited = new Set()) => {
        if (visited.has(childId)) return false;
        visited.add(childId);
        const p = allProjects.find((pr) => pr.id === childId);
        if (!p) return false;
        if (p.parentId === parentId) return true;
        if (p.parentId) return isDescendant(parentId, p.parentId, visited);
        return false;
      };
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/project-tree.js
git commit -m "fix: add visited-set guard to isDescendant to prevent infinite loops on circular data"
```

---

### Task 19: Fix keyboard shortcut closeModal to properly clean up

**Files:**
- Modify: `src/keyboard/shortcuts.js:60-65`

- [ ] **Step 1: Dispatch close event instead of raw remove**

Replace the `closeModal` handler (lines 60-65):

```js
    closeModal: () => {
      const overlays = document.querySelectorAll('.gpm-overlay');
      const overlay = overlays[overlays.length - 1];
      if (overlay) {
        const closeBtn = overlay.querySelector('[data-gpm="close"]');
        if (closeBtn) {
          closeBtn.click();
        } else {
          overlay.dispatchEvent(new CustomEvent('gpm-close'));
          overlay.remove();
        }
      }
    },
```

This attempts to use the overlay's own close button (which handles cleanup) before falling back to remove.

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/keyboard-shortcuts.test.js --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/keyboard/shortcuts.js
git commit -m "fix: keyboard closeModal uses overlay's close button for proper cleanup"
```

---

### Task 20: Fix quick-prompts file input leak on cancel

**Files:**
- Modify: `src/quick-prompts.js:596-641`

- [ ] **Step 1: Add cancel event listener and cleanup timeout**

Replace the file input section (around lines 596-641):

```js
    onRestore: () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        fileInput.remove();
      };

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) { cleanup(); return; }
        const reader = new FileReader();
        reader.onload = async (ev) => {
          cleanup();
          try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
              let importedCount = 0;
              for (const p of imported) {
                if (
                  p && typeof p === 'object' &&
                  typeof p.title === 'string' && typeof p.content === 'string' &&
                  p.title.trim() && p.content.trim()
                ) {
                  const safeTitle = p.title.replace(/[<>]/g, '').trim();
                  const safeContent = p.content.replace(/[<>]/g, '').trim();
                  const safeCategory = (typeof p.category === 'string' ? p.category.replace(/[<>]/g, '').trim() : 'General') || 'General';
                  await GPMStorage.saveQuickPrompt({ title: safeTitle, content: safeContent, category: safeCategory });
                  importedCount++;
                }
              }
              gpmLog('Imported', importedCount, 'prompts');
              GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
              gpmToggleQuickPrompts();
            }
          } catch (err) {
            gpmError('Failed to restore prompts:', err);
            if (GPM_STATE.modalRoot) GPMUI.showAlertDialog(GPM_STATE.modalRoot, { title: t('restore'), message: t('importError') });
          }
        };
        reader.readAsText(file);
      });

      const cancelTimeout = setTimeout(cleanup, 60000);
      fileInput.addEventListener('cancel', () => { clearTimeout(cancelTimeout); cleanup(); });

      document.body.appendChild(fileInput);
      fileInput.click();
    },
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/quick-prompts.js
git commit -m "fix: clean up file input element on cancel and add timeout safety"
```

---

### Task 21: Fix duplicate event listeners on floating QP button

**Files:**
- Modify: `src/quick-prompts.js:27-44 and 301-310`

- [ ] **Step 1: Remove mouseenter/mouseleave from `_gpmCreateQPButton` since floating button overrides them**

In `_gpmCreateQPButton` (lines 27-44), remove lines 35-40 (the mouseenter/mouseleave handlers):

```js
function _gpmCreateQPButton() {
  const btn = document.createElement('button');
  btn.id = 'gpm-qp-trigger';
  btn.textContent = '⚡';
  btn.title = t('quickPrompts');
  btn.type = 'button';
  btn.style.cssText =
    'background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:50%;color:inherit;opacity:0.6;transition:opacity 150ms;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;vertical-align:middle;';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    gpmToggleQuickPrompts();
  });
  return btn;
}
```

Move the toolbar-specific hover effects to the injection point where the button is placed in the toolbar.

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/quick-prompts.js
git commit -m "fix: remove conflicting hover listeners from base QP button"
```

---

### Task 22: Fix `showBackupPanel` unguarded `gpmRenderTree` call

**Files:**
- Modify: `src/ui_elements.js:1398`

- [ ] **Step 1: Add typeof guard**

Find the `gpmRenderTree()` call in `showBackupPanel` (around line 1398) and replace:

```js
  if (typeof gpmRenderTree === 'function') gpmRenderTree();
```

- [ ] **Step 2: Commit**

```bash
git add src/ui_elements.js
git commit -m "fix: add typeof guard to gpmRenderTree call in showBackupPanel"
```

---

## Phase 3: Dead Code Cleanup

### Task 23: Remove dead code from multiple files

**Files:**
- Modify: `src/validators.js` — remove `sanitizeHtml`
- Modify: `src/undo-redo.js` — expose `canUndo`/`canRedo`, remove unused action types
- Modify: `src/sync-manager.js` — remove `lastSyncTime`
- Modify: `src/analytics/usage-tracker.js` — remove `saveAnalytics` from public API
- Modify: `src/config.js` — remove `_renderId` and fix `spaObserversActive`

- [ ] **Step 1: Remove `sanitizeHtml` from validators.js**

Delete lines 31-39 and remove `sanitizeHtml` from the return object (line 218).

- [ ] **Step 2: Remove `rename_project`, `rename_chat`, and `bulk_move` from undo-redo.js**

Delete lines 150-201 (the three unused action type cases). Keep only `move_chat`, `delete_project`, `create_project`.

- [ ] **Step 3: Expose `canUndo` and `canRedo` from undo-redo.js**

Add to the return object (line 207-212):

```js
  return {
    push,
    undo,
    redo,
    createAction,
    canUndo,
    canRedo,
  };
```

- [ ] **Step 4: Remove `lastSyncTime` from sync-manager.js**

Delete line 19 (`let lastSyncTime = 0;`) and line 115 (`lastSyncTime = Date.now();`).

- [ ] **Step 5: Remove `saveAnalytics` from usage-tracker.js public API**

Remove `saveAnalytics` from the return object (line 72).

- [ ] **Step 6: Remove `_renderId` from GPM_STATE in config.js**

Remove line 73 (`_renderId: 0,`) from the `GPM_STATE` object.

- [ ] **Step 7: Run lint and tests**

Run: `npm run lint; npm test`
Expected: PASS (fix any lint errors from unused variables)

- [ ] **Step 8: Commit**

```bash
git add src/utils/validators.js src/history/undo-redo.js src/sync/sync-manager.js src/analytics/usage-tracker.js src/config.js
git commit -m "chore: remove dead code — sanitizeHtml, unused action types, lastSyncTime, _renderId"
```

---

### Task 24: Remove dead exports from backup-manager.js

**Files:**
- Modify: `src/backup/backup-manager.js:156-166`

- [ ] **Step 1: Remove `MAX_VERSIONS`, `TRIGGERS`, and `getBackup` from exports**

Replace the return block:

```js
  return {
    createBackup,
    getBackups,
    restoreBackup,
    deleteBackup,
    autoBackupIfNeeded,
    formatBackupDate,
  };
```

- [ ] **Step 2: Commit**

```bash
git add src/backup/backup-manager.js
git commit -m "chore: remove unused public exports from backup-manager"
```

---

### Task 25: Fix duplicate icons in PROJECT_ICONS

**Files:**
- Modify: `src/ui_elements.js:25-68`

- [ ] **Step 1: Remove duplicate emoji entries**

Find and remove the second occurrences of `'🌐'` and `'🔬'` from the `PROJECT_ICONS` array.

- [ ] **Step 2: Commit**

```bash
git add src/ui_elements.js
git commit -m "chore: remove duplicate emoji from PROJECT_ICONS array"
```

---

### Task 26: Remove unused i18n RTL languages

**Files:**
- Modify: `src/i18n.js` (near line 2700)

- [ ] **Step 1: Remove unsupported languages from RTL_LANGS**

Find `RTL_LANGS` and replace:

```js
const RTL_LANGS = ['ar'];
```

Only `ar` (Arabic) is in `SUPPORTED_LANG_CODES`.

- [ ] **Step 2: Commit**

```bash
git add src/i18n.js
git commit -m "chore: remove unsupported languages from RTL_LANGS"
```

---

## Phase 4: Code Quality & Test Infrastructure

### Task 27: Fix `_set`/`_setBulk` silent swallowing of errors

**Files:**
- Modify: `src/storage.js:157-173`

- [ ] **Step 1: Log the error instead of silently swallowing**

Replace `_set` (lines 157-163):

```js
  async function _set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        gpmWarn('Write skipped — extension context invalidated');
        return;
      }
      throw e;
    }
  }
```

Replace `_setBulk` (lines 166-173):

```js
  async function _setBulk(data) {
    try {
      await chrome.storage.local.set(data);
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        gpmWarn('Write skipped — extension context invalidated');
        return;
      }
      throw e;
    }
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/storage.js
git commit -m "fix: log warning instead of silently swallowing invalidated context errors"
```

---

### Task 28: Fix `gpmWaitForElement` timer leak

**Files:**
- Modify: `src/config.js:201-218`

- [ ] **Step 1: Clear timeout when observer finds element**

Replace `gpmWaitForElement` (lines 201-218):

```js
function gpmWaitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    let timer;
    const observer = new MutationObserver((_, obs) => {
      const found = document.querySelector(selector);
      if (found) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "fix: clear timeout timer in gpmWaitForElement when observer succeeds"
```

---

### Task 29: Initialize missing GPM_STATE properties

**Files:**
- Modify: `src/config.js:50-75`

- [ ] **Step 1: Add missing state properties and fix `spaObserversActive`**

In `GPM_STATE`, after line 72 (`_renderId` was removed in Task 23):

Add:
```js
  _searchQuery: '',
```

And ensure the reset function clears it:
```js
  GPM_STATE._searchQuery = '';
  GPM_STATE._matchCache = null;
```

- [ ] **Step 2: Commit**

```bash
git add src/config.js
git commit -m "chore: initialize _searchQuery in GPM_STATE and clear in reset"
```

---

### Task 30: Fix mock `_mockLockGranted` not being reset

**Files:**
- Modify: `tests/mocks/chrome.js`

- [ ] **Step 1: Add `_mockLockGranted = true` to `resetAllMocks`**

Find the `resetAllMocks` function (around line 229-234) and add:

```js
function resetAllMocks() {
  resetStorageArea();
  resetRuntimeMocks();
  resetTabMocks();
  resetStorageChangeListeners();
  _mockLockGranted = true;
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/mocks/chrome.js
git commit -m "fix: reset _mockLockGranted in resetAllMocks to prevent cross-test contamination"
```

---

### Task 31: Expand vitest coverage config

**Files:**
- Modify: `vitest.config.js:10`

- [ ] **Step 1: Add more source files to coverage tracking**

Replace line 10:

```js
      include: ['src/storage.js', 'src/i18n.js', 'src/config.js', 'src/selectors.js', 'src/dom-injection.js', 'src/quick-prompts.js', 'src/navigation.js', 'src/utils/validators.js', 'src/history/undo-redo.js', 'src/analytics/usage-tracker.js', 'src/keyboard/shortcuts.js', 'src/backup/backup-manager.js', 'src/sync/sync-manager.js', 'src/favorites-manager.js'],
```

- [ ] **Step 2: Run coverage report**

Run: `npx vitest run --coverage`
Expected: Coverage report runs for all included files

- [ ] **Step 3: Commit**

```bash
git add vitest.config.js
git commit -m "chore: expand vitest coverage to include 14 source files"
```

---

### Task 32: Add lint script for test files

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `lint:all` script**

In `package.json` scripts section, add:

```json
    "lint:all": "eslint src/ tests/",
```

- [ ] **Step 2: Run it**

Run: `npm run lint:all`
Expected: May show warnings in test files — fix as needed

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add lint:all script to lint both src and test files"
```

---

### Task 33: Final verification

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run format check**

Run: `npm run format:check`
Expected: No issues

- [ ] **Step 4: Run coverage**

Run: `npm run test:coverage`
Expected: Coverage thresholds met

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | Tasks 1-12 | Critical HIGH severity bugs |
| Phase 2 | Tasks 13-22 | Medium severity bugs |
| Phase 3 | Tasks 23-26 | Dead code cleanup |
| Phase 4 | Tasks 27-33 | Code quality and test infrastructure |

**Total: 33 tasks across 4 phases, touching 22 source files and 4 config/test files.**
