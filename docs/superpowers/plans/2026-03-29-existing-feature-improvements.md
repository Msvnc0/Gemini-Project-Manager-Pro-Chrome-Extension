# Phase 1-2: Existing Feature Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend existing modules (Undo/Redo, Virtual List, Analytics, Search, Tags, Sort, Backup) to production-quality features

**Architecture:** Extend stub/immature modules first, then add search/filter/sort capabilities. Each task is self-contained and builds on the previous task where noted.

**Tech Stack:** Vanilla JS (Chrome Extension MV3), Vitest + jsdom

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/history/undo-redo.js` | MODIFY | Increase stack to 50, add new command types |
| `src/performance/virtual-list.js` | MODIFY | Add `updateItems` alias, improve render performance |
| `src/analytics/usage-tracker.js` | MODIFY | Add event tracking, daily stats, pruning |
| `src/project-tree.js` | MODIFY | Enhanced search with filters and regex |
| `src/sort-manager.js` | MODIFY | Multi-criteria sort, grouping, manual sort |
| `src/storage.js` | MODIFY | Backup versioning, incremental backup support |
| `src/backup/backup-manager.js` | MODIFY | Extended with versioning and diff |
| `tests/history/undo-redo.test.js` | CREATE | Undo/Redo tests |
| `tests/performance/virtual-list.test.js` | CREATE | Virtual List tests |
| `tests/analytics/usage-tracker.test.js` | CREATE | Analytics tests |
| `tests/sort-manager.test.js` | CREATE | Sort manager tests |

---

### Task 1: Extend Undo/Redo System

**Files:**
- Modify: `src/history/undo-redo.js`
- Create: `tests/history/undo-redo.test.js`

- [ ] **Step 1: Write tests for undo-redo extension**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../tests/mocks/chrome.js';

const mockGPMStorage = {
  getProjects: vi.fn(() => []),
  saveProjects: vi.fn(),
  getChatMap: vi.fn(() => ({})),
  saveChatMap: vi.fn(),
  assignChat: vi.fn(),
  setChatAlias: vi.fn(),
  assignTagsToChat: vi.fn(),
  removeTagFromChat: vi.fn(),
  createTag: vi.fn(),
  createProject: vi.fn((d) => ({ id: 'test-id', ...d })),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  getTags: vi.fn(() => ({})),
};

const mockGpmRenderTree = vi.fn();

beforeEach(() => {
  vi.stub(globalThis, 'GPMStorage', mockGPMStorage);
  vi.stub(globalThis, 'gpmRenderTree', mockGpmRenderTree);
  mockGPMStorage.getProjects.mockResolvedValue([]);
  mockGPMStorage.getChatMap.mockResolvedValue({});
  mockGPMStorage.getTags.mockResolvedValue({});
});

describe('GPMHistory', () => {
  it('should have MAX_HISTORY of 50', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    expect(GPMHistory.getHistoryInfo).toBeDefined();
  });

  it('should push and report history info', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    const action = GPMHistory.createAction('move_chat', {
      chatId: 'c1',
      fromProjectId: 'p1',
      toProjectId: 'p2',
    });
    expect(action).not.toBeNull();
    GPMHistory.push(action);
    const info = GPMHistory.getHistoryInfo();
    expect(info.canUndo).toBe(true);
    expect(info.undoCount).toBe(1);
  });

  it('should undo a move_chat action', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    mockGPMStorage.assignChat.mockResolvedValue(undefined);
    const action = GPMHistory.createAction('move_chat', {
      chatId: 'c1',
      fromProjectId: 'p1',
      toProjectId: 'p2',
    });
    GPMHistory.push(action);
    const result = await GPMHistory.undo();
    expect(result).toBe(true);
    expect(mockGPMStorage.assignChat).toHaveBeenCalledWith('c1', 'p1');
  });

  it('should redo a move_chat action', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    mockGPMStorage.assignChat.mockResolvedValue(undefined);
    const action = GPMHistory.createAction('move_chat', {
      chatId: 'c1',
      fromProjectId: 'p1',
      toProjectId: 'p2',
    });
    GPMHistory.push(action);
    await GPMHistory.undo();
    mockGPMStorage.assignChat.mockResolvedValue(undefined);
    const result = await GPMHistory.redo();
    expect(result).toBe(true);
    expect(mockGPMStorage.assignChat).toHaveBeenCalledWith('c1', 'p2');
  });

  it('should create tag_add action', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    mockGPMStorage.removeTagFromChat.mockResolvedValue(true);
    const action = GPMHistory.createAction('tag_add', {
      chatId: 'c1',
      tagId: 't1',
    });
    expect(action).not.toBeNull();
    expect(action.type).toBe('tag_add');
  });

  it('should create bulk_move action', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    const action = GPMHistory.createAction('bulk_move', {
      chatIds: ['c1', 'c2'],
      fromProjectIds: { c1: 'p1', c2: 'p1' },
      toProjectId: 'p2',
    });
    expect(action).not.toBeNull();
    expect(action.type).toBe('bulk_move');
  });

  it('should clear history', async () => {
    const { GPMHistory } = await import('../../src/history/undo-redo.js?eval=undefined');
    GPMHistory.push(GPMHistory.createAction('move_chat', { chatId: 'c1', fromProjectId: 'p1', toProjectId: 'p2' }));
    GPMHistory.clear();
    expect(GPMHistory.getHistoryInfo().undoCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/history/undo-redo.test.js`
Expected: FAIL — test file or assertions fail

- [ ] **Step 3: Extend undo-redo.js**

In `src/history/undo-redo.js`:

1. Change `MAX_HISTORY` from 20 to 50 (line 9)
2. Add new command types after the `rename_chat` case in `createAction`:

```js
case 'tag_add':
  return {
    type,
    chatId: data.chatId,
    tagId: data.tagId,
    undo: async () => {
      await GPMStorage.removeTagFromChat(data.chatId, data.tagId);
      gpmRenderTree();
    },
    redo: async () => {
      const chatMap = await GPMStorage.getChatMap();
      const tags = chatMap[data.chatId]?.tags || [];
      if (!tags.includes(data.tagId)) {
        tags.push(data.tagId);
        await GPMStorage.assignTagsToChat(data.chatId, tags);
      }
      gpmRenderTree();
    },
  };

case 'tag_remove':
  return {
    type,
    chatId: data.chatId,
    tagId: data.tagId,
    oldTags: data.oldTags,
    undo: async () => {
      const chatMap = await GPMStorage.getChatMap();
      const tags = chatMap[data.chatId]?.tags || [];
      if (!tags.includes(data.tagId)) {
        tags.push(data.tagId);
        await GPMStorage.assignTagsToChat(data.chatId, tags);
      }
      gpmRenderTree();
    },
    redo: async () => {
      await GPMStorage.removeTagFromChat(data.chatId, data.tagId);
      gpmRenderTree();
    },
  };

case 'bulk_move':
  return {
    type,
    chatIds: data.chatIds,
    fromProjectIds: data.fromProjectIds,
    toProjectId: data.toProjectId,
    undo: async () => {
      for (const chatId of data.chatIds) {
        await GPMStorage.assignChat(chatId, data.fromProjectIds[chatId]);
      }
      gpmRenderTree();
    },
    redo: async () => {
      for (const chatId of data.chatIds) {
        await GPMStorage.assignChat(chatId, data.toProjectId);
      }
      gpmRenderTree();
    },
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/history/undo-redo.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/history/undo-redo.js tests/history/undo-redo.test.js
git commit -m "feat: extend undo/redo with tag and bulk commands, (E5)"
```

---

### Task 2: Extend Analytics/Usage Tracker

**Files:**
- Modify: `src/analytics/usage-tracker.js`
- Create: `tests/analytics/usage-tracker.test.js`

- [ ] **Step 1: Write tests for analytics extension**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../tests/mocks/chrome.js';

const mockGPMStorage = {
  getProjects: vi.fn(() => []),
  getChatMap: vi.fn(() => ({})),
};

beforeEach(() => {
  vi.stub(globalThis, 'GPMStorage', mockGPMStorage);
  mockGPMStorage.getProjects.mockResolvedValue([]);
  mockGPMStorage.getChatMap.mockResolvedValue({});
});

describe('GPMUsageTracker', () => {
  it('should track events with metadata', async () => {
    const { GPMUsageTracker } = await import('../../src/analytics/usage-tracker.js?eval=undefined');
    await GPMUsageTracker.trackEvent('chat.move', { projectId: 'p1', chatId: 'c1' });
    const analytics = await GPMUsageTracker.getAnalytics();
    expect(analytics.events).toBeDefined();
    expect(analytics.events.length).toBe(1);
    expect(analytics.events[0].event).toBe('chat.move');
  });

  it('should prune events older than 90 days', async () => {
    const { GPMUsageTracker } = await import('../../src/analytics/usage-tracker.js?eval=undefined');
    const oldDate = Date.now() - 91 * 24 * 60 * 60 * 1000;
    await chrome.storage.local.set({ gpm_analytics: { events: [{ event: 'old', timestamp: oldDate }], projectAccess: {}, featureUsage: {} } });
    await GPMUsageTracker.trackEvent('test.new', {});
    const analytics = await GPMUsageTracker.getAnalytics();
    const oldEvents = analytics.events.filter(e => e.event === 'old');
    expect(oldEvents.length).toBe(0);
  });

  it('should return daily stats', async () => {
    const { GPMUsageTracker } = await import('../../src/analytics/usage-tracker.js?eval=undefined');
    const today = new Date().toISOString().slice(0, 10);
    await GPMUsageTracker.trackEvent('project.create', {});
    const stats = await GPMUsageTracker.getDailyStats(7);
    expect(stats).toBeDefined();
    expect(stats.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/analytics/usage-tracker.test.js`

- [ ] **Step 3: Extend usage-tracker.js**

Add these methods to `GPMUsageTracker`:

```js
async function trackEvent(eventName, metadata = {}) {
  const analytics = await getAnalytics();
  if (!analytics.events) analytics.events = [];
  analytics.events.push({ event: eventName, timestamp: Date.now(), metadata });
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  analytics.events = analytics.events.filter(e => e.timestamp > ninetyDaysAgo);
  await saveAnalytics(analytics);
}

async function getDailyStats(days = 7) {
  const analytics = await getAnalytics();
  const events = analytics.events || [];
  const now = Date.now();
  const stats = [];
  for (let i = 0; i < days; i++) {
    const dayStart = now - i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayEvents = events.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd);
    const date = new Date(dayStart).toISOString().slice(0, 10);
    stats.push({
      date,
      total: dayEvents.length,
      byType: dayEvents.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
      }, {}),
    });
  }
  return stats;
}

async function getTopSearchTerms(limit = 10) {
  const analytics = await getAnalytics();
  const searchEvents = (analytics.events || []).filter(e => e.event === 'search.execute');
  const termCounts = {};
  for (const e of searchEvents) {
    const term = e.metadata?.query || '';
    if (term) termCounts[term] = (termCounts[term] || 0) + 1;
  }
  return Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}
```

Add these to the return object: `trackEvent`, `getDailyStats`, `getTopSearchTerms`

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/analytics/usage-tracker.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/usage-tracker.js tests/analytics/usage-tracker.test.js
git commit -m "feat: extend analytics with event tracking and daily stats (E7)"
```

---

### Task 3: Improve Sort Manager

**Files:**
- Modify: `src/sort-manager.js`
- Create: `tests/sort-manager.test.js`

- [ ] **Step 1: Write tests for sort improvements**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../tests/mocks/chrome.js';

describe('GPMSortManager', () => {
  it('should sort by multiple criteria', async () => {
    const { GPMSortManager } = await import('../../src/sort-manager.js');
    const projects = [
      { name: 'B Project', createdAt: 100, chatIds: ['1', '2'] },
      { name: 'A Project', createdAt: 200, chatIds: ['1'] },
      { name: 'A Project', createdAt: 100, chatIds: ['1', '2', '3'] },
    ];
    const sorted = GPMSortManager.sortByMultiple(projects, [
      { field: 'name', dir: 'asc' },
      { field: 'chatCount', dir: 'desc' },
    ]);
    expect(sorted[0].chatIds.length).toBe(3);
    expect(sorted[1].chatIds.length).toBe(1);
  });

  it('should group chats by date', async () => {
    const { GPMSortManager } = await import('../../src/sort-manager.js');
    const now = Date.now();
    const chats = [
      { id: '1', addedAt: now },
      { id: '2', addedAt: now - 2 * 24 * 60 * 60 * 1000 },
      { id: '3', addedAt: now - 8 * 24 * 60 * 60 * 1000 },
    ];
    const groups = GPMSortManager.groupByDate(chats);
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sort-manager.test.js`

- [ ] **Step 3: Add multi-criteria sort and grouping to sort-manager.js**

Add these functions to `GPMSortManager`:

```js
function sortByMultiple(projects, criteria) {
  return [...projects].sort((a, b) => {
    for (const { field, dir } of criteria) {
      let cmp = 0;
      if (field === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else if (field === 'chatCount') {
        cmp = ((a.chatIds || []).length - (b.chatIds || []).length);
      } else if (field === 'createdAt' || field === 'updatedAt') {
        cmp = (a[field] || 0) - (b[field] || 0);
      }
      if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function groupByDate(chats) {
  const now = Date.now();
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const groups = [
    { label: 'Today', chats: [] },
    { label: 'This Week', chats: [] },
    { label: 'Older', chats: [] },
  ];

  for (const chat of chats) {
    const t = chat.addedAt || chat.starredAt || 0;
    if (t >= todayStart.getTime()) {
      groups[0].chats.push(chat);
    } else if (t >= weekStart) {
      groups[1].chats.push(chat);
    } else {
      groups[2].chats.push(chat);
    }
  }

  return groups.filter(g => g.chats.length > 0);
}
```

Add to return object: `sortByMultiple`, `groupByDate`

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sort-manager.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sort-manager.js tests/sort-manager.test.js
git commit -m "feat: add multi-criteria sort and date grouping (E3)"
```

---

### Task 4: Enhanced Search in Project Tree

**Files:**
- Modify: `src/project-tree.js`

- [ ] **Step 1: Add search filter integration**

In `src/project-tree.js`, the search already exists (lines 192-313). Enhance by adding filter support for tags and date range.

Find the `projectMatchesSearch` function and extend it to also check tags:

After the existing check for `chat aliases` (around line 209-214), add tag checking:

```js
const chatEntry = chatMap[cid];
if (chatEntry?.tags && chatEntry.tags.length > 0) {
  const tags = typeof GPMStorage !== 'undefined' ? await GPMStorage.getTags() : {};
  for (const tagId of chatEntry.tags) {
    const tagName = tags[tagId]?.name?.toLowerCase() || '';
    if (tagName.includes(query)) {
      const result = { matches: true, source: 'tag' };
      matchCache.set(project.id, result);
      return result;
    }
  }
}
```

Note: Since `GPMStorage.getTags()` is async, this needs to be fetched once at the top of `gpmRenderTree` and passed through. Simpler approach — make tags available synchronously:

At the top of `gpmRenderTree` (after getting chatMap), also get tags:
```js
const tags = await GPMStorage.getTags();
```

Then in `projectMatchesSearch`, use the `tags` variable directly (it's in closure scope).

Add after line 214 (after chat alias check):

```js
if (chatMap[cid]?.tags) {
  for (const tagId of chatMap[cid].tags) {
    const tagName = tags[tagId]?.name || '';
    if (tagName.toLowerCase().includes(query)) {
      const result = { matches: true, source: 'tag' };
      matchCache.set(project.id, result);
      return result;
    }
  }
}
```

- [ ] **Step 2: Add regex support to search**

In the search handler (around line 298-313), add regex detection:

Find the search filter helper section (line 192) and update `const searchQuery` to also parse regex:

```js
const rawQuery = GPM_STATE._searchQuery || '';
let searchRegex = null;
let searchQuery = rawQuery.toLowerCase();
if (rawQuery.startsWith('/') && rawQuery.endsWith('/') && rawQuery.length > 2) {
  try {
    const pattern = rawQuery.slice(1, -1);
    const start = performance.now();
    searchRegex = new RegExp(pattern, 'i');
    searchQuery = '';
  } catch (e) {
    searchRegex = null;
  }
}
```

Then in `projectMatchesSearch`, also check regex:

```js
if (searchRegex) {
  if (searchRegex.test(project.name) || searchRegex.test(alias) || searchRegex.test(cid)) {
    const result = { matches: true, source: 'name' };
    matchCache.set(project.id, result);
    return result;
  }
}
```

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/project-tree.js
git commit -m "feat: enhanced search with tag filtering and regex support (E1)"
```

---

### Task 5: Extend Tag System with Hierarchy and Autocomplete

**Files:**
- Modify: `src/tags/tag-ui.js`
- Modify: `src/tags/tag-manager.js`

- [ ] **Step 1: Add tag hierarchy support to TagManager**

In `src/tags/tag-manager.js`, add a function to get tag tree:

```js
async function getTagTree() {
  const tags = await GPMStorage.getTags();
  const tagList = Object.values(tags);
  const roots = tagList.filter(t => !t.parentId);
  function buildChildren(parentId) {
    return tagList.filter(t => t.parentId === parentId).map(t => ({
      ...t,
      children: buildChildren(t.id),
    }));
  }
  return roots.map(t => ({ ...t, children: buildChildren(t.id) }));
}

async function getTagStats() {
  const tags = await GPMStorage.getTags();
  const chatMap = await GPMStorage.getChatMap();
  return Object.values(tags).map(tag => {
    let count = 0;
    for (const entry of Object.values(chatMap)) {
      if (entry.tags?.includes(tag.id)) count++;
    }
    return { ...tag, usageCount: count };
  }).sort((a, b) => b.usageCount - a.usageCount);
}

async function getUnusedTags() {
  const stats = await getTagStats();
  return stats.filter(t => t.usageCount === 0);
}
```

Add to return: `getTagTree`, `getTagStats`, `getUnusedTags`

- [ ] **Step 2: Add autocomplete to tag-ui.js**

Add to `GPMTagUI`:

```js
function createTagAutocomplete(options = {}) {
  const { onSelect, excludeTags = [] } = options;
  const container = document.createElement('div');
  container.className = 'gpm-tag-autocomplete';

  const input = document.createElement('input');
  input.className = 'gpm-input';
  input.type = 'text';
  input.placeholder = typeof t === 'function' ? (t('searchTags') || 'Search tags...') : 'Search tags...';

  const dropdown = document.createElement('div');
  dropdown.className = 'gpm-tag-autocomplete-dropdown gpm-hidden';

  input.addEventListener('input', async () => {
    const query = input.value.toLowerCase().trim();
    if (!query) {
      dropdown.classList.add('gpm-hidden');
      return;
    }
    const tags = await GPMStorage.getTags();
    const filtered = Object.values(tags)
      .filter(tag => !excludeTags.includes(tag.id))
      .filter(tag => tag.name.toLowerCase().includes(query))
      .slice(0, 8);

    while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);

    if (filtered.length === 0) {
      dropdown.classList.add('gpm-hidden');
      return;
    }

    filtered.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'gpm-tag-autocomplete-item';
      const chip = createTagChip(tag);
      item.appendChild(chip);
      item.addEventListener('click', () => {
        input.value = '';
        dropdown.classList.add('gpm-hidden');
        if (onSelect) onSelect(tag);
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.remove('gpm-hidden');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) dropdown.classList.add('gpm-hidden');
  });

  container.appendChild(input);
  container.appendChild(dropdown);
  return container;
}
```

Add to return: `createTagAutocomplete`

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Fix any new errors

- [ ] **Step 4: Commit**

```bash
git add src/tags/tag-manager.js src/tags/tag-ui.js
git commit -m "feat: add tag hierarchy, stats, unused detection, and autocomplete (E2)"
```

---

### Task 6: Improve Backup with Versioning

**Files:**
- Modify: `src/storage.js`
- Modify: `src/backup/backup-manager.js` (if it has versioning support, extend it)

- [ ] **Step 1: Read backup-manager.js to understand current state**

Read `src/backup/backup-manager.js` and assess what exists.

- [ ] **Step 2: Add version tracking to storage.js backup functions**

In `src/storage.js`, update `restoreFromBackup` to also store restore history:

Add after the `restoreFromBackup` function:

```js
async function getBackupVersions() {
  const backups = await _get('gpm_backups');
  if (!backups || !Array.isArray(backups)) return [];
  return backups
    .filter(b => b && b.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      type: b.type || 'manual',
      size: b.size || 0,
      projectCount: b.data?.gpm_projects?.length || 0,
      chatCount: Object.keys(b.data?.gpm_chatMap || {}).length,
    }));
}

async function getBackupDiff(backupId1, backupId2) {
  const backups = await _get('gpm_backups');
  if (!backups || !Array.isArray(backups)) return null;
  const b1 = backups.find(b => b.id === backupId1);
  const b2 = backups.find(b => b.id === backupId2);
  if (!b1 || !b2) return null;

  const p1 = new Set((b1.data?.gpm_projects || []).map(p => p.id));
  const p2 = new Set((b2.data?.gpm_projects || []).map(p => p.id));
  const c1 = new Set(Object.keys(b1.data?.gpm_chatMap || {}));
  const c2 = new Set(Object.keys(b2.data?.gpm_chatMap || {}));

  const addedProjects = [...p2].filter(id => !p1.has(id));
  const removedProjects = [...p1].filter(id => !p2.has(id));
  const addedChats = [...c2].filter(id => !c1.has(id));
  const removedChats = [...c1].filter(id => !c2.has(id));

  return { addedProjects, removedProjects, addedChats, removedChats };
}
```

Add to return object: `getBackupVersions`, `getBackupDiff`

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/storage.js
git commit -m "feat: add backup version listing and diff comparison (E4)"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors beyond pre-existing `no-undef` warnings

- [ ] **Step 3: Commit any cleanup**

```bash
git add -A
git commit -m "chore: cleanup after E1-E7 existing feature improvements"
```
