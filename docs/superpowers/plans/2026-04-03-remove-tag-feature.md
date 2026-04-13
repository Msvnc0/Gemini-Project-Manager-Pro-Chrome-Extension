# Remove Tag Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the tag/label system entirely from the Chrome extension while preserving the star/favorite feature.

**Architecture:** Delete tag source files and test files, relocate `createStarButton` to a new `src/ui/star-button.js`, then surgically remove all tag references from storage, project-tree, undo-redo, validators, sort-manager, content.js, CSS, manifest, and 17 locale files.

**Tech Stack:** Vanilla JS (Chrome Extension Manifest V3), Vitest for tests.

---

### Task 1: Relocate createStarButton to new file

**Files:**
- Create: `src/ui/star-button.js`
- Modify: `manifest.json`

- [ ] **Step 1: Create `src/ui/star-button.js` with createStarButton extracted from tag-ui.js**

```js
const GPMStarButton = (() => {
  function createStarButton(chatId, isStarred, onToggle) {
    const btn = document.createElement('button');
    btn.className = 'gpm-star-btn' + (isStarred ? ' gpm-starred' : '');
    btn.type = 'button';
    btn.dataset.chatId = chatId;
    btn.textContent = isStarred ? '\u2605' : '\u2606';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStarred = await GPMStorage.toggleStarChat(chatId);
      btn.textContent = newStarred ? '\u2605' : '\u2606';
      btn.classList.toggle('gpm-starred', newStarred);
      if (onToggle) onToggle(newStarred);
    });
    return btn;
  }

  return { createStarButton };
})();
```

- [ ] **Step 2: Update manifest.json — remove tag files, add star-button.js**

Remove these 3 lines from `content_scripts[0].js`:
```
"src/tags/tags-manager.js",
"src/tags/tag-manager.js",
"src/tags/tag-ui.js",
```

Add after `"src/batch-operations.js",`:
```
"src/ui/star-button.js",
```

- [ ] **Step 3: Verify manifest.json loads correctly (visual check)**

---

### Task 2: Delete tag source files and test directory

**Files:**
- Delete: `src/tags/tag-manager.js`
- Delete: `src/tags/tags-manager.js`
- Delete: `src/tags/tag-ui.js`
- Delete: `tests/tags/tag-manager.test.js`
- Delete: `tests/tags/` directory

- [ ] **Step 1: Delete the files**

```bash
rm src/tags/tag-manager.js src/tags/tags-manager.js src/tags/tag-ui.js
rm -rf tests/tags/
```

- [ ] **Step 2: Verify files are deleted**

```bash
ls src/tags/ 2>&1 || echo "Directory removed or empty"
ls tests/tags/ 2>&1 || echo "Directory removed"
```

---

### Task 3: Remove tag code from content.js

**Files:**
- Modify: `src/content.js`

- [ ] **Step 1: Remove tag comment from header (line 16)**

Change:
```js
 *   - tags/             → Tags/labels system
```
Remove this line entirely.

- [ ] **Step 2: Remove Step 13 tag filter bar block (lines 142-156)**

Remove the entire block:
```js
  // ── Step 13: Initialize tag filter bar ──
  try {
    const filterBar = await GPMTagUI.createTagFilterBar((tagIds) => {
      GPM_STATE.activeTagFilters = tagIds;
      gpmRenderTree();
    });
    if (GPM_STATE.container) {
      const header = GPM_STATE.container.querySelector('[data-gpm="header"]');
      if (header) {
        header.after(filterBar);
      }
    }
  } catch (e) {
    console.warn('[GPM] Tag filter bar init failed:', e);
  }
```

Renumber Step 14 → Step 13 (comment only).

- [ ] **Step 3: Verify content.js has no remaining tag references (except tagName DOM property)**

---

### Task 4: Remove tag code from project-tree.js

**Files:**
- Modify: `src/project-tree.js`

- [ ] **Step 1: Remove tag loading in gpmRenderTree (line 85)**

Remove:
```js
  const tags = await GPMStorage.getTags();
```

- [ ] **Step 2: Remove tag search in projectMatchesSearch (lines 242-256)**

Remove the entire block:
```js
    for (const cid of cids) {
      if (chatMap[cid]?.tags) {
        for (const tagId of chatMap[cid].tags) {
          const tagName = tags[tagId]?.name || '';
          if (tagName.toLowerCase().includes(query)) {
            matchCache.set(project.id, { matches: true, source: 'tag' });
            return { matches: true, source: 'tag' };
          }
          if (searchRegex && searchRegex.test(tagName)) {
            matchCache.set(project.id, { matches: true, source: 'tag' });
            return { matches: true, source: 'tag' };
          }
        }
      }
    }
```

- [ ] **Step 3: Remove tag badge in project row (lines 428-434)**

Change the badge rendering from:
```js
      badge.textContent = matchInfo.source === 'chat' ? '💬' : matchInfo.source === 'tag' ? '🏷️' : '📂';
      badge.title =
        matchInfo.source === 'chat'
          ? t('matchInChat')
          : matchInfo.source === 'tag'
            ? t('matchInTag') || 'Match in tag'
            : t('matchInSubfolder');
```

To:
```js
      badge.textContent = matchInfo.source === 'chat' ? '💬' : '📂';
      badge.title = matchInfo.source === 'chat' ? t('matchInChat') : t('matchInSubfolder');
```

- [ ] **Step 4: Remove tags submenu from chat context menu (lines 956-974)**

Remove the entire block:
```js
  // Tags submenu (if tags manager is available)
  if (typeof GPMTagsManager !== 'undefined') {
    items.push({ divider: true });
    items.push({
      icon: '🏷️',
      label: t('tags'),
      submenu: [
        { icon: '+', label: t('addTag'), action: () => {} },
        ...GPMTagsManager.DEFAULT_TAGS.slice(0, 5).map((tag) => ({
          icon: tag.icon,
          label: tag.name,
          action: async () => {
            await GPMTagsManager.addTagToChat(chatId, tag.id);
            gpmRenderTree();
          },
        })),
      ],
    });
  }
```

- [ ] **Step 5: Remove "Tag Selected" bulk action (line 1142)**

Remove from the actions array:
```js
    { action: 'tag', text: t('tagSelected'), cls: '' },
```

- [ ] **Step 6: Remove tag case from switch (lines 1160-1161)**

Remove:
```js
      case 'tag':
        showBulkTagModal();
        break;
```

- [ ] **Step 7: Remove gpmBulkAssignTags function (lines 1184-1189)**

Remove:
```js
async function gpmBulkAssignTags(tagIds) {
  const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
  await TagManager.bulkAssignTags(chatIds, tagIds);
  showToast(t('taggedChats').replace('{count}', chatIds.length));
  gpmClearBulkSelection();
}
```

- [ ] **Step 8: Remove showBulkTagModal function (lines 1214-1234)**

Remove the entire `showBulkTagModal()` function.

---

### Task 5: Remove tag storage functions from storage.js

**Files:**
- Modify: `src/storage.js`

- [ ] **Step 1: Remove tag schema comment (lines 11-12)**

Remove:
```
 *   gpm_chatMap: { [chatId]: { projectId, alias, pinned, _autoResolved, tags: string[], starredAt: number|null } }
 *   gpm_tags: { [tagId]: { id, name, color, icon, count, parentId, createdAt, updatedAt } }
```

Replace with (keep chatMap but without tags):
```
 *   gpm_chatMap: { [chatId]: { projectId, alias, pinned, _autoResolved, starredAt: number|null } }
```

Note: Keep migrations v3 and v4 untouched — they silently handle existing tag data.

- [ ] **Step 2: Remove all tag storage functions (lines 344-452)**

Remove these functions entirely:
- `getTags()`
- `saveTags(tags)`
- `createTag({name, color, icon, parentId})`
- `updateTag(id, updates)`
- `deleteTag(id)`
- `getChatsByTag(tagId)`
- `assignTagsToChat(chatId, tagIds)`
- `removeTagFromChat(chatId, tagId)`

Keep `toggleStarChat` and `getStarredChats` — they are not tag-related.

- [ ] **Step 3: Remove tags from exportAll (lines 483-501)**

Change `exportAll()` from loading tags to not loading them:
```js
  async function exportAll() {
    const [projects, chatMap, quickPrompts, settings] = await Promise.all([
      getProjects(),
      getChatMap(),
      getQuickPrompts(),
      getSettings(),
    ]);
    return JSON.stringify(
      {
        gpm_projects: projects,
        gpm_chatMap: chatMap,
        gpm_quickPrompts: quickPrompts,
        gpm_settings: settings,
      },
      null,
      2
    );
  }
```

- [ ] **Step 4: Remove validateTag import and usage (line 509)**

Remove:
```js
  const validateTag = GPMValidators.validateTag;
```

- [ ] **Step 5: Remove tags from importAll pre-import backup (lines 515-527)**

Remove `curTags` from destructuring, remove `_get('gpm_tags')`, remove `gpm_pre_import_tags` from the backup set. Also remove the tag validation block (lines 550-557):

```js
    if (data.gpm_tags && typeof data.gpm_tags === 'object' && !Array.isArray(data.gpm_tags)) {
      const validated = {};
      for (const [tagId, tag] of Object.entries(data.gpm_tags)) {
        const clean = validateTag(tag);
        if (clean) validated[sanitizeString(tagId)] = clean;
      }
      await _set('gpm_tags', validated);
    }
```

- [ ] **Step 6: Remove gpm_tags from clearAll (line 566)**

Remove:
```js
      gpm_tags: {},
```

- [ ] **Step 7: Remove tag exports from return object (lines 657-664)**

Remove these lines from the return statement:
```js
    getTags,
    saveTags,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToChat,
    removeTagFromChat,
    getChatsByTag,
```

---

### Task 6: Remove tag code from undo-redo.js

**Files:**
- Modify: `src/history/undo-redo.js`

- [ ] **Step 1: Remove tag_add and tag_remove cases (lines 180-218)**

Remove:
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
```

---

### Task 7: Remove tag code from validators.js

**Files:**
- Modify: `src/utils/validators.js`

- [ ] **Step 1: Remove MAX_TAG_NAME_LENGTH constant (line 12)**

Remove:
```js
  const MAX_TAG_NAME_LENGTH = 20;
```

- [ ] **Step 2: Remove sanitizeTagColor function (lines 60-66)**

Remove the entire `sanitizeTagColor` function.

- [ ] **Step 3: Remove tags field from validateChatMapping (lines 105, 112)**

Remove:
```js
    const tags = Array.isArray(entry.tags) ? entry.tags.map((t) => sanitizeId(t)).filter(Boolean) : [];
```

Remove from the return object:
```js
      tags,
```

- [ ] **Step 4: Remove validateTag function (lines 165-182)**

Remove the entire `validateTag` function.

- [ ] **Step 5: Remove tag exports (lines 256, 261)**

Remove from the return statement:
```js
    sanitizeTagColor,
```
```js
    validateTag,
```

---

### Task 8: Remove groupChatsByTag from sort-manager.js

**Files:**
- Modify: `src/sort-manager.js`

- [ ] **Step 1: Remove groupChatsByTag function (lines 151-166)**

Remove the entire `groupChatsByTag` function.

- [ ] **Step 2: Remove groupChatsByTag from return object (line 186)**

Remove:
```js
    groupChatsByTag,
```

---

### Task 9: Remove tag CSS from styles.css

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Remove tag badge styles (lines 1042-1052)**

Remove:
```css
/* ── Tag Badge ── */
.gpm-tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  margin-right: 4px;
}
```

- [ ] **Step 2: Remove tag UI component styles (lines 1300-1401)**

Remove all CSS between `/* TAG UI COMPONENTS */` and `/* ── Star Button ── */`:
- `.gpm-tag-chip` and related
- `.gpm-tag-chip-active`
- `.gpm-tag-chip-remove`
- `.gpm-tag-selector` and related
- `.gpm-tag-selector-trigger`
- `.gpm-tag-selector-dropdown`
- `.gpm-tag-selector-item`
- `.gpm-tag-filter-bar`

Keep `.gpm-star-btn`, `.gpm-star-btn:hover`, `.gpm-star-btn.gpm-starred` styles.

---

### Task 10: Remove tag locale keys from all 17 locale files

**Files:**
- Modify: `_locales/en/messages.json` (and 16 other locale files)

- [ ] **Step 1: Remove tag keys from English locale**

Remove these keys from `_locales/en/messages.json`:
- `tags`
- `createTag`
- `tagName`
- `tagNamePlaceholder`
- `tagColor`
- `noTags`
- `maxTagsReached`
- `tagSelected`
- `taggedChats`

- [ ] **Step 2: Remove same keys from all 16 other locale files**

Files: `_locales/{ar,bn,de,es,fr,hi,id,it,ja,ko,pt,ru,th,tr,vi,zh-CN}/messages.json`

Remove the same 9 keys from each file.

---

### Task 11: Remove tag tests

**Files:**
- Modify: `tests/storage.test.js`
- Modify: `tests/sort-manager.test.js`
- Modify: `tests/history/undo-redo.test.js`
- Modify: `tests/validators.test.js`

- [ ] **Step 1: Remove tag tests from storage.test.js**

Remove the entire `describe('Tags', ...)` block (lines 640-756).

Also check if migration tests reference tags — those should stay since migrations are preserved.

- [ ] **Step 2: Remove groupChatsByTag test from sort-manager.test.js**

Remove the test `'groups chats by tag'` (lines 40-52).

- [ ] **Step 3: Remove tag tests from undo-redo.test.js**

Remove mock fields: `assignTagsToChat`, `removeTagFromChat`, `getTags` from mockGPMStorage.
Remove `mockGPMStorage.removeTagFromChat.mockResolvedValue(true)`.
Remove `mockGPMStorage.assignTagsToChat.mockResolvedValue(true)`.
Remove tests: `'creates tag_add action'` and `'creates tag_remove action'`.

- [ ] **Step 4: Remove entire validators.test.js (it's all tag tests)**

The entire `tests/validators.test.js` file only contains tag-related tests. Delete it or replace with minimal non-tag validator tests if needed.

---

### Task 12: Run tests and verify

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors related to removed tag code.

- [ ] **Step 2: Run tests**

```bash
npm run test
```

Expected: All tests pass. No remaining references to removed tag functions.

- [ ] **Step 3: Run format check**

```bash
npm run format:check
```

Expected: All files properly formatted.
