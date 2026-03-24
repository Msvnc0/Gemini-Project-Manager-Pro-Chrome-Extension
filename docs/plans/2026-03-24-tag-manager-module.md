# Tag Manager Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a modular tag management system with tags, favorites, and bulk operations for organizing Gemini chats.

**Architecture:** New `src/tags/` module with separate files for manager, UI, and suggestions. Extends existing `storage.js` with tag schema and methods. Uses existing validator patterns.

**Tech Stack:** Vanilla JS, Chrome Extension Storage API, Vitest for testing

---

## File Structure

```
src/
├── tags/
│   ├── tag-manager.js      → Core CRUD, filtering, assignment
│   └── tag-ui.js           → UI components (chips, dropdown, modals)
├── storage.js              → Extended with tag methods + schema v3
├── utils/
│   └── validators.js       → Extended with validateTag
├── project-tree.js         → Modified for bulk selection + star button
└── styles.css              → Extended with tag styles

tests/
├── mocks/
│   └── chrome.js           → (existing)
├── storage.test.js         → Extended with tag tests
└── tags/
    └── tag-manager.test.js → New test file

_locales/
├── en/messages.json        → Extended with tag i18n keys
└── tr/messages.json        → Extended with tag i18n keys
```

---

## Task 1: Schema Migration (v2 → v3)

**Files:**
- Modify: `src/storage.js:17-35`
- Modify: `tests/storage.test.js`

- [ ] **Step 1: Write failing test for schema v3 migration**

```javascript
// Add to tests/storage.test.js after line 35

describe('Schema Migration v3', () => {
  it('should migrate from v2 to v3 and initialize tags', async () => {
    // Set up v2 data
    setMockStorage({
      gpm_schemaVersion: 2,
      gpm_projects: [{ id: 'p1', name: 'Test' }],
    });
    
    await GPMStorage.initializeStorage();
    
    const storage = getMockStorage();
    expect(storage.gpm_schemaVersion).toBe(3);
    expect(storage.gpm_tags).toEqual({});
  });
  
  it('should add tags array to existing chatMap entries', async () => {
    setMockStorage({
      gpm_schemaVersion: 2,
      gpm_chatMap: { 'chat-1': { projectId: 'p1', alias: '', pinned: false } },
    });
    
    await GPMStorage.initializeStorage();
    
    const chatMap = await GPMStorage.getChatMap();
    expect(chatMap['chat-1'].tags).toEqual([]);
    expect(chatMap['chat-1'].starredAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Docs/superpowers && npm test -- tests/storage.test.js --run`
Expected: FAIL - migration v3 not implemented

- [ ] **Step 3: Update GPM_SCHEMA_VERSION and add migration**

```javascript
// In src/storage.js, line 17, change:
const GPM_SCHEMA_VERSION = 3;

// Add migration at line 34 (after MIGRATIONS[2]):
    3: (data) => {
      // v2 → v3: Initialize tags and update chatMap schema
      if (!data.gpm_tags) data.gpm_tags = {};
      
      // Add tags and starredAt to existing chatMap entries
      if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object') {
        for (const chatId of Object.keys(data.gpm_chatMap)) {
          if (!data.gpm_chatMap[chatId].tags) {
            data.gpm_chatMap[chatId].tags = [];
          }
          if (data.gpm_chatMap[chatId].starredAt === undefined) {
            data.gpm_chatMap[chatId].starredAt = null;
          }
        }
      }
      return data;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Docs/superpowers && npm test -- tests/storage.test.js --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat(storage): add schema v3 migration for tags"
```

---

## Task 2: Tag Validator

**Files:**
- Modify: `src/utils/validators.js`
- Create: `tests/validators.test.js` (if not exists, or extend existing)

- [ ] **Step 1: Write failing test for validateTag**

```javascript
// Add to tests/validators.test.js or create new file

import { readFileSync } from 'fs';
import { resolve } from 'path';

const validatorsCode = readFileSync(resolve('src/utils/validators.js'), 'utf-8');
const patchedCode = validatorsCode.replace(
  /^const GPMValidators\s*=/m,
  'globalThis.GPMValidators ='
);
new Function(patchedCode)();
const GPMValidators = globalThis.GPMValidators;

describe('GPMValidators - Tags', () => {
  describe('validateTag()', () => {
    it('should validate a valid tag', () => {
      const tag = { id: 't1', name: 'Important', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toMatchObject({
        id: 't1',
        name: 'Important',
        color: '#ef4444',
      });
    });
    
    it('should sanitize tag name and remove HTML', () => {
      const tag = { id: 't1', name: '<script>Bad</script>Important', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result.name).toBe('scriptBadscriptImportant');
    });
    
    it('should return null for missing id', () => {
      const tag = { name: 'Test', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toBeNull();
    });
    
    it('should return null for empty name', () => {
      const tag = { id: 't1', name: '', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toBeNull();
    });
    
    it('should truncate name to 20 characters', () => {
      const tag = { id: 't1', name: 'This is a very long tag name', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result.name.length).toBeLessThanOrEqual(20);
    });
    
    it('should use default color for invalid hex', () => {
      const tag = { id: 't1', name: 'Test', color: 'invalid' };
      const result = GPMValidators.validateTag(tag);
      expect(result.color).toBe('#3b82f6');
    });
  });
  
  describe('sanitizeTagColor()', () => {
    it('should accept valid hex colors', () => {
      expect(GPMValidators.sanitizeTagColor('#ef4444')).toBe('#ef4444');
      expect(GPMValidators.sanitizeTagColor('#22c55e')).toBe('#22c55e');
    });
    
    it('should return default for invalid colors', () => {
      expect(GPMValidators.sanitizeTagColor('red')).toBe('#3b82f6');
      expect(GPMValidators.sanitizeTagColor('')).toBe('#3b82f6');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/validators.test.js --run`
Expected: FAIL - validateTag not defined

- [ ] **Step 3: Add validateTag and sanitizeTagColor to validators.js**

```javascript
// In src/utils/validators.js, add after line 12:
  const MAX_TAG_NAME_LENGTH = 20;

// Add after sanitizeIcon function (around line 57):
  function sanitizeTagColor(color) {
    const VALID_TAG_COLORS = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];
    if (typeof color !== 'string') return '#3b82f6';
    if (VALID_TAG_COLORS.includes(color.toLowerCase())) return color.toLowerCase();
    // Also accept any valid hex
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return '#3b82f6';
  }

// Add after validateSettings function (around line 150):
  function validateTag(t) {
    if (!t || typeof t !== 'object') return null;
    
    const id = sanitizeId(t.id);
    if (!id) return null;
    
    const name = sanitizeString(t.name || '', MAX_TAG_NAME_LENGTH).trim();
    if (!name) return null;
    
    return {
      id,
      name,
      color: sanitizeTagColor(t.color),
      count: typeof t.count === 'number' ? Math.max(0, t.count) : 0,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now(),
    };
  }

// Update return statement (around line 216) to include:
    validateTag,
    sanitizeTagColor,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/validators.test.js --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/validators.js tests/validators.test.js
git commit -m "feat(validators): add validateTag and sanitizeTagColor"
```

---

## Task 3: Storage Tag Methods

**Files:**
- Modify: `src/storage.js`
- Modify: `tests/storage.test.js`

- [ ] **Step 1: Write failing tests for tag CRUD methods**

```javascript
// Add to tests/storage.test.js

describe('Tag CRUD Operations', () => {
  describe('createTag()', () => {
    it('should create a tag with correct structure', async () => {
      const tag = await GPMStorage.createTag({ name: 'Important', color: '#ef4444' });
      
      expect(tag).toMatchObject({
        name: 'Important',
        color: '#ef4444',
        count: 0,
      });
      expect(tag.id).toBeDefined();
      expect(tag.createdAt).toBeDefined();
    });
    
    it('should use default color when not provided', async () => {
      const tag = await GPMStorage.createTag({ name: 'Test' });
      expect(tag.color).toBe('#3b82f6');
    });
    
    it('should persist tag to storage', async () => {
      await GPMStorage.createTag({ name: 'Persisted' });
      const tags = await GPMStorage.getTags();
      expect(Object.keys(tags)).toHaveLength(1);
    });
    
    it('should reject duplicate tag names', async () => {
      await GPMStorage.createTag({ name: 'Unique' });
      await expect(GPMStorage.createTag({ name: 'Unique' })).rejects.toThrow('already exists');
    });
  });
  
  describe('updateTag()', () => {
    it('should update tag name', async () => {
      const tag = await GPMStorage.createTag({ name: 'Original' });
      const updated = await GPMStorage.updateTag(tag.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });
    
    it('should return null for non-existent tag', async () => {
      const result = await GPMStorage.updateTag('nonexistent', { name: 'X' });
      expect(result).toBeNull();
    });
  });
  
  describe('deleteTag()', () => {
    it('should remove tag from storage', async () => {
      const tag = await GPMStorage.createTag({ name: 'ToDelete' });
      await GPMStorage.deleteTag(tag.id);
      
      const tags = await GPMStorage.getTags();
      expect(tags[tag.id]).toBeUndefined();
    });
    
    it('should remove tag from all chatMap entries', async () => {
      const tag = await GPMStorage.createTag({ name: 'Tag1' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      
      await GPMStorage.deleteTag(tag.id);
      
      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].tags).not.toContain(tag.id);
    });
  });
  
  describe('getTags()', () => {
    it('should return empty object when no tags', async () => {
      const tags = await GPMStorage.getTags();
      expect(tags).toEqual({});
    });
  });
});

describe('Tag Assignment', () => {
  describe('assignTagsToChat()', () => {
    it('should assign tags to a chat', async () => {
      const tag = await GPMStorage.createTag({ name: 'Work' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      
      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].tags).toContain(tag.id);
    });
    
    it('should reject more than 5 tags per chat', async () => {
      const tags = [];
      for (let i = 0; i < 6; i++) {
        const t = await GPMStorage.createTag({ name: `Tag${i}` });
        tags.push(t.id);
      }
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      
      await expect(GPMStorage.assignTagsToChat('chat-1', tags)).rejects.toThrow('Maximum 5 tags');
    });
    
    it('should update tag count on assignment', async () => {
      const tag = await GPMStorage.createTag({ name: 'Count' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      
      const tags = await GPMStorage.getTags();
      expect(tags[tag.id].count).toBe(1);
    });
  });
  
  describe('removeTagFromChat()', () => {
    it('should remove tag from chat and decrement count', async () => {
      const tag = await GPMStorage.createTag({ name: 'Remove' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      
      await GPMStorage.removeTagFromChat('chat-1', tag.id);
      
      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].tags).not.toContain(tag.id);
      
      const tags = await GPMStorage.getTags();
      expect(tags[tag.id].count).toBe(0);
    });
  });
  
  describe('getChatsByTag()', () => {
    it('should return chat IDs with specific tag', async () => {
      const tag = await GPMStorage.createTag({ name: 'Find' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      await GPMStorage.assignTagsToChat('chat-2', [tag.id]);
      
      const chats = await GPMStorage.getChatsByTag(tag.id);
      
      expect(chats).toContain('chat-1');
      expect(chats).toContain('chat-2');
    });
  });
});

describe('Favorites (Star)', () => {
  describe('toggleStarChat()', () => {
    it('should star a chat', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      
      const isStarred = await GPMStorage.toggleStarChat('chat-1');
      
      expect(isStarred).toBe(true);
      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].starredAt).toBeDefined();
    });
    
    it('should unstar a chat', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.toggleStarChat('chat-1');
      
      const isStarred = await GPMStorage.toggleStarChat('chat-1');
      
      expect(isStarred).toBe(false);
      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].starredAt).toBeNull();
    });
    
    it('should return false for non-existent chat', async () => {
      const result = await GPMStorage.toggleStarChat('nonexistent');
      expect(result).toBe(false);
    });
  });
  
  describe('getStarredChats()', () => {
    it('should return starred chat IDs sorted by starredAt desc', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      
      await GPMStorage.toggleStarChat('chat-1');
      await new Promise(r => setTimeout(r, 10));
      await GPMStorage.toggleStarChat('chat-2');
      
      const starred = await GPMStorage.getStarredChats();
      
      expect(starred).toHaveLength(2);
      expect(starred[0]).toBe('chat-2'); // Most recent first
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/storage.test.js --run`
Expected: FAIL - tag methods not defined

- [ ] **Step 3: Implement tag methods in storage.js**

```javascript
// In src/storage.js, add after getBackupInfo function (around line 370):

  // ══════════════════════════════════════
  //  Tags
  // ══════════════════════════════════════

  async function getTags() {
    return (await _get('gpm_tags')) || {};
  }

  async function createTag({ name, color = '#3b82f6' }) {
    const tags = await getTags();
    const sanitizedName = GPMValidators.sanitizeString(name, 20).trim();
    
    // Check for duplicate name
    const existingNames = Object.values(tags).map(t => t.name.toLowerCase());
    if (existingNames.includes(sanitizedName.toLowerCase())) {
      throw new Error(`Tag "${sanitizedName}" already exists`);
    }
    
    const id = uid();
    const tag = {
      id,
      name: sanitizedName,
      color: GPMValidators.sanitizeTagColor(color),
      count: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    tags[id] = tag;
    await _set('gpm_tags', tags);
    return tag;
  }

  async function updateTag(tagId, updates) {
    const tags = await getTags();
    if (!tags[tagId]) return null;
    
    if (updates.name) {
      updates.name = GPMValidators.sanitizeString(updates.name, 20).trim();
    }
    if (updates.color) {
      updates.color = GPMValidators.sanitizeTagColor(updates.color);
    }
    
    Object.assign(tags[tagId], updates, { updatedAt: Date.now() });
    await _set('gpm_tags', tags);
    return tags[tagId];
  }

  async function deleteTag(tagId) {
    const tags = await getTags();
    if (!tags[tagId]) return;
    
    // Remove tag from all chatMap entries
    const chatMap = await getChatMap();
    for (const chatId of Object.keys(chatMap)) {
      if (chatMap[chatId].tags && chatMap[chatId].tags.includes(tagId)) {
        chatMap[chatId].tags = chatMap[chatId].tags.filter(t => t !== tagId);
      }
    }
    await saveChatMap(chatMap);
    
    delete tags[tagId];
    await _set('gpm_tags', tags);
  }

  async function assignTagsToChat(chatId, tagIds) {
    if (tagIds.length > 5) {
      throw new Error('Maximum 5 tags allowed per chat');
    }
    
    const chatMap = await getChatMap();
    const tags = await getTags();
    
    if (!chatMap[chatId]) {
      throw new Error('Chat not found in chatMap');
    }
    
    const oldTags = chatMap[chatId].tags || [];
    
    // Decrement count for removed tags
    for (const tId of oldTags) {
      if (!tagIds.includes(tId) && tags[tId]) {
        tags[tId].count = Math.max(0, (tags[tId].count || 0) - 1);
      }
    }
    
    // Increment count for new tags
    for (const tId of tagIds) {
      if (!oldTags.includes(tId) && tags[tId]) {
        tags[tId].count = (tags[tId].count || 0) + 1;
      }
    }
    
    chatMap[chatId].tags = tagIds;
    
    await saveChatMap(chatMap);
    await _set('gpm_tags', tags);
  }

  async function removeTagFromChat(chatId, tagId) {
    const chatMap = await getChatMap();
    const tags = await getTags();
    
    if (!chatMap[chatId] || !chatMap[chatId].tags) return;
    
    chatMap[chatId].tags = chatMap[chatId].tags.filter(t => t !== tagId);
    
    if (tags[tagId]) {
      tags[tagId].count = Math.max(0, (tags[tagId].count || 0) - 1);
    }
    
    await saveChatMap(chatMap);
    await _set('gpm_tags', tags);
  }

  async function getChatsByTag(tagId) {
    const chatMap = await getChatMap();
    return Object.entries(chatMap)
      .filter(([_, entry]) => entry.tags && entry.tags.includes(tagId))
      .map(([chatId, _]) => chatId);
  }

  // ══════════════════════════════════════
  //  Favorites (Star)
  // ══════════════════════════════════════

  async function toggleStarChat(chatId) {
    const chatMap = await getChatMap();
    if (!chatMap[chatId]) return false;
    
    const isStarred = chatMap[chatId].starredAt !== null;
    chatMap[chatId].starredAt = isStarred ? null : Date.now();
    
    await saveChatMap(chatMap);
    return !isStarred;
  }

  async function getStarredChats() {
    const chatMap = await getChatMap();
    return Object.entries(chatMap)
      .filter(([_, entry]) => entry.starredAt !== null)
      .sort((a, b) => b[1].starredAt - a[1].starredAt)
      .map(([chatId, _]) => chatId);
  }

// Update the return statement at the end of GPMStorage IIFE (around line 390):
    getTags,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToChat,
    removeTagFromChat,
    getChatsByTag,
    toggleStarChat,
    getStarredChats,
```

- [ ] **Step 4: Update validateChatMapping to include tags and starredAt**

```javascript
// In src/utils/validators.js, update validateChatMapping function:
  function validateChatMapping(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const projectId = sanitizeId(entry.projectId);
    if (!projectId) return null;

    return {
      projectId,
      alias: sanitizeName(entry.alias || ''),
      pinned: typeof entry.pinned === 'boolean' ? entry.pinned : false,
      _autoResolved: typeof entry._autoResolved === 'boolean' ? entry._autoResolved : false,
      tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 5).map(sanitizeId).filter(Boolean) : [],
      starredAt: typeof entry.starredAt === 'number' ? entry.starredAt : null,
    };
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/storage.test.js --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/utils/validators.js tests/storage.test.js
git commit -m "feat(storage): add tag and favorites methods"
```

---

## Task 4: Tag Manager Module

**Files:**
- Create: `src/tags/tag-manager.js`
- Create: `tests/tags/tag-manager.test.js`

- [ ] **Step 1: Write failing tests for TagManager module**

```javascript
// tests/tags/tag-manager.test.js

import { resetMockStorage, getMockStorage } from '../mocks/chrome.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load dependencies
const storageCode = readFileSync(resolve('src/storage.js'), 'utf-8');
const patchedStorage = storageCode.replace(/^const GPMStorage\s*=/m, 'globalThis.GPMStorage =');
new Function(patchedStorage)();

const tagManagerCode = readFileSync(resolve('src/tags/tag-manager.js'), 'utf-8');
const patchedTagManager = tagManagerCode.replace(/^const TagManager\s*=/m, 'globalThis.TagManager =');
new Function(patchedTagManager)();
const TagManager = globalThis.TagManager;

describe('TagManager', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  describe('filterChatsByTags()', () => {
    it('should return chats that have ALL specified tags (AND logic)', async () => {
      const tag1 = await GPMStorage.createTag({ name: 'Work' });
      const tag2 = await GPMStorage.createTag({ name: 'Important' });
      const project = await GPMStorage.createProject({ name: 'P' });
      
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      await GPMStorage.assignChat('chat-3', project.id);
      
      await GPMStorage.assignTagsToChat('chat-1', [tag1.id]);
      await GPMStorage.assignTagsToChat('chat-2', [tag1.id, tag2.id]);
      await GPMStorage.assignTagsToChat('chat-3', [tag2.id]);
      
      const result = await TagManager.filterChatsByTags([tag1.id, tag2.id]);
      
      expect(result).toContain('chat-2');
      expect(result).not.toContain('chat-1');
      expect(result).not.toContain('chat-3');
    });
    
    it('should return all chats when no tags specified', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      
      const result = await TagManager.filterChatsByTags([]);
      
      expect(result).toHaveLength(2);
    });
  });
  
  describe('getTagStats()', () => {
    it('should return usage statistics for tags', async () => {
      const tag = await GPMStorage.createTag({ name: 'Stats' });
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      await GPMStorage.assignTagsToChat('chat-1', [tag.id]);
      await GPMStorage.assignTagsToChat('chat-2', [tag.id]);
      
      const stats = await TagManager.getTagStats(tag.id);
      
      expect(stats.count).toBe(2);
      expect(stats.tagId).toBe(tag.id);
    });
  });
  
  describe('suggestTagsForChat()', () => {
    it('should suggest tags based on chat title keywords', async () => {
      await GPMStorage.createTag({ name: 'Bug' });
      await GPMStorage.createTag({ name: 'Feature' });
      
      const suggestions = await TagManager.suggestTagsForChat('Bug fix for login');
      
      expect(suggestions).toContainEqual(expect.objectContaining({ name: 'Bug' }));
    });
    
    it('should return empty array when no matching tags', async () => {
      await GPMStorage.createTag({ name: 'Random' });
      
      const suggestions = await TagManager.suggestTagsForChat('Completely different title');
      
      expect(suggestions).toHaveLength(0);
    });
  });
  
  describe('getMostUsedTags()', () => {
    it('should return tags sorted by usage count', async () => {
      const tag1 = await GPMStorage.createTag({ name: 'Popular' });
      const tag2 = await GPMStorage.createTag({ name: 'Less' });
      const project = await GPMStorage.createProject({ name: 'P' });
      
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);
      await GPMStorage.assignChat('chat-3', project.id);
      
      await GPMStorage.assignTagsToChat('chat-1', [tag1.id]);
      await GPMStorage.assignTagsToChat('chat-2', [tag1.id]);
      await GPMStorage.assignTagsToChat('chat-3', [tag2.id]);
      
      const mostUsed = await TagManager.getMostUsedTags(3);
      
      expect(mostUsed[0].id).toBe(tag1.id);
      expect(mostUsed[1].id).toBe(tag2.id);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/tags/tag-manager.test.js --run`
Expected: FAIL - TagManager not defined

- [ ] **Step 3: Create tag-manager.js**

```javascript
// src/tags/tag-manager.js

const TagManager = (() => {
  // ══════════════════════════════════════
  //  Filtering
  // ══════════════════════════════════════

  async function filterChatsByTags(tagIds) {
    if (!tagIds || tagIds.length === 0) {
      const chatMap = await GPMStorage.getChatMap();
      return Object.keys(chatMap);
    }
    
    const chatMap = await GPMStorage.getChatMap();
    
    // AND logic: chat must have ALL specified tags
    return Object.entries(chatMap)
      .filter(([_, entry]) => {
        if (!entry.tags) return false;
        return tagIds.every(tagId => entry.tags.includes(tagId));
      })
      .map(([chatId, _]) => chatId);
  }

  // ══════════════════════════════════════
  //  Statistics
  // ══════════════════════════════════════

  async function getTagStats(tagId) {
    const tags = await GPMStorage.getTags();
    const chats = await GPMStorage.getChatsByTag(tagId);
    
    return {
      tagId,
      count: chats.length,
      tag: tags[tagId] || null,
    };
  }

  async function getMostUsedTags(limit = 10) {
    const tags = await GPMStorage.getTags();
    
    return Object.values(tags)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, limit);
  }

  // ══════════════════════════════════════
  //  Tag Suggestions
  // ══════════════════════════════════════

  async function suggestTagsForChat(chatTitle) {
    if (!chatTitle || typeof chatTitle !== 'string') return [];
    
    const tags = await GPMStorage.getTags();
    const titleLower = chatTitle.toLowerCase();
    
    // Match tag names in title (case-insensitive)
    const matched = Object.values(tags)
      .filter(tag => titleLower.includes(tag.name.toLowerCase()))
      .slice(0, 3);
    
    return matched;
  }

  async function suggestTagsForProject(projectId) {
    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();
    const tags = await GPMStorage.getTags();
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];
    
    // Find most common tags in this project
    const tagCounts = {};
    for (const chatId of project.chatIds || []) {
      const entry = chatMap[chatId];
      if (entry && entry.tags) {
        for (const tagId of entry.tags) {
          tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
        }
      }
    }
    
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tagId]) => tags[tagId])
      .filter(Boolean);
  }

  // ══════════════════════════════════════
  //  Bulk Operations
  // ══════════════════════════════════════

  async function bulkAssignTags(chatIds, tagIds) {
    for (const chatId of chatIds) {
      try {
        const chatMap = await GPMStorage.getChatMap();
        const existingTags = chatMap[chatId]?.tags || [];
        const newTags = [...new Set([...existingTags, ...tagIds])].slice(0, 5);
        await GPMStorage.assignTagsToChat(chatId, newTags);
      } catch (e) {
        console.warn(`[TagManager] Failed to assign tags to ${chatId}:`, e.message);
      }
    }
  }

  async function bulkRemoveTags(chatIds, tagIds) {
    for (const chatId of chatIds) {
      for (const tagId of tagIds) {
        try {
          await GPMStorage.removeTagFromChat(chatId, tagId);
        } catch (e) {
          console.warn(`[TagManager] Failed to remove tag from ${chatId}:`, e.message);
        }
      }
    }
  }

  return {
    filterChatsByTags,
    getTagStats,
    getMostUsedTags,
    suggestTagsForChat,
    suggestTagsForProject,
    bulkAssignTags,
    bulkRemoveTags,
  };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/tags/tag-manager.test.js --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tags/tag-manager.js tests/tags/tag-manager.test.js
git commit -m "feat(tags): add TagManager module with filtering and suggestions"
```

---

## Task 5: Tag UI Components

**Files:**
- Create: `src/tags/tag-ui.js`
- Modify: `src/styles.css`
- Modify: `src/manifest.json`

- [ ] **Step 1: Create TagChip and TagSelector components**

```javascript
// src/tags/tag-ui.js

const GPM_TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

const GPMTagUI = (() => {
  // ══════════════════════════════════════
  //  TagChip Component
  // ══════════════════════════════════════

  function createTagChip(tag, options = {}) {
    const { removable = false, onRemove, onClick } = options;
    
    const chip = document.createElement('span');
    chip.className = 'gpm-tag-chip';
    chip.dataset.tagId = tag.id;
    chip.style.setProperty('--tag-color', tag.color);
    chip.textContent = tag.name;
    
    if (onClick) {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => onClick(tag));
    }
    
    if (removable && onRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'gpm-tag-chip-remove';
      removeBtn.textContent = '×';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(tag);
      });
      chip.appendChild(removeBtn);
    }
    
    return chip;
  }

  // ══════════════════════════════════════
  //  TagSelector Dropdown
  // ══════════════════════════════════════

  function createTagSelector(options = {}) {
    const { selectedTags = [], onChange, chatId, maxTags = 5 } = options;
    
    const container = document.createElement('div');
    container.className = 'gpm-tag-selector';
    
    const trigger = document.createElement('button');
    trigger.className = 'gpm-tag-selector-trigger';
    trigger.type = 'button';
    trigger.innerHTML = `<span class="gpm-tag-icon">🏷️</span>`;
    trigger.title = t('tags');
    
    const dropdown = document.createElement('div');
    dropdown.className = 'gpm-tag-selector-dropdown gpm-hidden';
    
    trigger.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('gpm-hidden');
      if (!dropdown.classList.contains('gpm-hidden')) {
        await populateTagDropdown(dropdown, selectedTags, async (tagId, isSelected) => {
          let newTags;
          if (isSelected) {
            newTags = selectedTags.filter(t => t !== tagId);
          } else {
            if (selectedTags.length >= maxTags) {
              showToast(t('maxTagsReached'));
              return;
            }
            newTags = [...selectedTags, tagId];
          }
          if (onChange) {
            await onChange(newTags);
          }
          selectedTags.length = 0;
          selectedTags.push(...newTags);
          await populateTagDropdown(dropdown, selectedTags, arguments.callee);
        });
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.add('gpm-hidden');
      }
    });
    
    container.appendChild(trigger);
    container.appendChild(dropdown);
    
    return container;
  }

  async function populateTagDropdown(dropdown, selectedTags, onToggle) {
    const tags = await GPMStorage.getTags();
    const tagList = Object.values(tags).sort((a, b) => a.name.localeCompare(b.name));
    
    dropdown.innerHTML = '';
    
    if (tagList.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gpm-tag-selector-empty';
      empty.textContent = t('noTags');
      dropdown.appendChild(empty);
    } else {
      for (const tag of tagList) {
        const isSelected = selectedTags.includes(tag.id);
        const item = document.createElement('label');
        item.className = 'gpm-tag-selector-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isSelected;
        checkbox.addEventListener('change', () => onToggle(tag.id, isSelected));
        
        const chip = createTagChip(tag);
        
        item.appendChild(checkbox);
        item.appendChild(chip);
        dropdown.appendChild(item);
      }
    }
    
    // Add "Create new tag" option
    const createBtn = document.createElement('button');
    createBtn.className = 'gpm-tag-selector-create';
    createBtn.type = 'button';
    createBtn.textContent = '+ ' + t('createTag');
    createBtn.addEventListener('click', () => {
      showCreateTagModal(async (newTag) => {
        if (newTag && onToggle) {
          await onToggle(newTag.id, false);
        }
      });
    });
    dropdown.appendChild(createBtn);
  }

  // ══════════════════════════════════════
  //  Create Tag Modal
  // ══════════════════════════════════════

  function showCreateTagModal(onSave) {
    if (!GPM_STATE.modalRoot) return;
    
    const modal = document.createElement('div');
    modal.className = 'gpm-modal-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'gpm-modal gpm-modal-small';
    
    dialog.innerHTML = `
      <div class="gpm-modal-header">
        <h3>${t('createTag')}</h3>
        <button class="gpm-modal-close" type="button">×</button>
      </div>
      <div class="gpm-modal-body">
        <div class="gpm-form-group">
          <label>${t('tagName')}</label>
          <input type="text" class="gpm-input gpm-tag-name-input" maxlength="20" placeholder="${t('tagNamePlaceholder')}">
        </div>
        <div class="gpm-form-group">
          <label>${t('tagColor')}</label>
          <div class="gpm-color-picker">
            ${GPM_TAG_COLORS.map(c => `
              <button type="button" class="gpm-color-option" data-color="${c}" style="background:${c}"></button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="gpm-modal-footer">
        <button class="gpm-btn gpm-btn-secondary gpm-modal-cancel" type="button">${t('cancel')}</button>
        <button class="gpm-btn gpm-btn-primary gpm-tag-create-submit" type="button">${t('create')}</button>
      </div>
    `;
    
    let selectedColor = GPM_TAG_COLORS[5]; // Default blue
    
    dialog.querySelectorAll('.gpm-color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        dialog.querySelectorAll('.gpm-color-option').forEach(b => b.classList.remove('gpm-color-selected'));
        btn.classList.add('gpm-color-selected');
        selectedColor = btn.dataset.color;
      });
    });
    
    const nameInput = dialog.querySelector('.gpm-tag-name-input');
    const submitBtn = dialog.querySelector('.gpm-tag-create-submit');
    
    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      
      try {
        const tag = await GPMStorage.createTag({ name, color: selectedColor });
        modal.remove();
        if (onSave) onSave(tag);
      } catch (e) {
        showToast(e.message);
      }
    });
    
    dialog.querySelector('.gpm-modal-close').addEventListener('click', () => modal.remove());
    dialog.querySelector('.gpm-modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    modal.appendChild(dialog);
    GPM_STATE.modalRoot.appendChild(modal);
    nameInput.focus();
  }

  // ══════════════════════════════════════
  //  Star Button Component
  // ══════════════════════════════════════

  function createStarButton(chatId, isStarred, onToggle) {
    const btn = document.createElement('button');
    btn.className = 'gpm-star-btn';
    btn.type = 'button';
    btn.dataset.chatId = chatId;
    btn.textContent = isStarred ? '★' : '☆';
    btn.title = isStarred ? t('unstarred') : t('starred');
    
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStarred = await GPMStorage.toggleStarChat(chatId);
      btn.textContent = newStarred ? '★' : '☆';
      btn.title = newStarred ? t('unstarred') : t('starred');
      btn.classList.toggle('gpm-starred', newStarred);
      if (onToggle) onToggle(newStarred);
    });
    
    if (isStarred) {
      btn.classList.add('gpm-starred');
    }
    
    return btn;
  }

  // ══════════════════════════════════════
  //  Tag Filter Bar
  // ══════════════════════════════════════

  async function createTagFilterBar(onFilterChange) {
    const container = document.createElement('div');
    container.className = 'gpm-tag-filter-bar';
    
    const tags = await GPMStorage.getTags();
    const tagList = Object.values(tags).sort((a, b) => a.name.localeCompare(b.name));
    
    if (tagList.length === 0) {
      container.style.display = 'none';
      return container;
    }
    
    const selectedFilters = new Set();
    
    for (const tag of tagList) {
      const chip = createTagChip(tag, {
        onClick: () => {
          if (selectedFilters.has(tag.id)) {
            selectedFilters.delete(tag.id);
            chip.classList.remove('gpm-tag-chip-active');
          } else {
            selectedFilters.add(tag.id);
            chip.classList.add('gpm-tag-chip-active');
          }
          if (onFilterChange) {
            onFilterChange(Array.from(selectedFilters));
          }
        }
      });
      chip.style.cursor = 'pointer';
      container.appendChild(chip);
    }
    
    return container;
  }

  return {
    createTagChip,
    createTagSelector,
    showCreateTagModal,
    createStarButton,
    createTagFilterBar,
    GPM_TAG_COLORS,
  };
})();
```

- [ ] **Step 2: Add CSS styles for tags**

```css
/* Add to src/styles.css */

/* ══════════════════════════════════════
   Tag Chip
   ══════════════════════════════════════ */

.gpm-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--tag-color, #3b82f6);
  color: #fff;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gpm-tag-chip-active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--tag-color);
}

.gpm-tag-chip-remove {
  background: none;
  border: none;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 0 0 4px;
  opacity: 0.7;
}

.gpm-tag-chip-remove:hover {
  opacity: 1;
}

/* ══════════════════════════════════════
   Tag Selector
   ══════════════════════════════════════ */

.gpm-tag-selector {
  position: relative;
  display: inline-block;
}

.gpm-tag-selector-trigger {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.6;
  border-radius: 4px;
  transition: opacity 150ms, background 150ms;
}

.gpm-tag-selector-trigger:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}

.gpm-tag-selector-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 160px;
  background: var(--gpm-surface, #1e1e1e);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 0;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.gpm-tag-selector-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.gpm-tag-selector-item:hover {
  background: rgba(255,255,255,0.05);
}

.gpm-tag-selector-empty {
  padding: 12px;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  text-align: center;
}

.gpm-tag-selector-create {
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-top: 1px solid rgba(255,255,255,0.1);
  color: var(--gpm-accent, #8ab4f8);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.gpm-tag-selector-create:hover {
  background: rgba(255,255,255,0.05);
}

/* ══════════════════════════════════════
   Star Button
   ══════════════════════════════════════ */

.gpm-star-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 4px;
  color: rgba(255,255,255,0.4);
  transition: color 150ms, transform 150ms;
}

.gpm-star-btn:hover {
  color: #fbbf24;
  transform: scale(1.1);
}

.gpm-star-btn.gpm-starred {
  color: #fbbf24;
}

/* ══════════════════════════════════════
   Tag Filter Bar
   ══════════════════════════════════════ */

.gpm-tag-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
}

/* ══════════════════════════════════════
   Color Picker
   ══════════════════════════════════════ */

.gpm-color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.gpm-color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 150ms;
}

.gpm-color-option:hover {
  transform: scale(1.1);
}

.gpm-color-option.gpm-color-selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
}
```

- [ ] **Step 3: Update manifest.json to include new files**

```json
// Add to manifest.json content_scripts.js array (after src/tags/tags-manager.js):
        "src/tags/tag-manager.js",
        "src/tags/tag-ui.js",
```

- [ ] **Step 4: Commit**

```bash
git add src/tags/tag-ui.js src/styles.css src/manifest.json
git commit -m "feat(ui): add TagChip, TagSelector, StarButton components"
```

---

## Task 6: Bulk Operations UI

**Files:**
- Modify: `src/project-tree.js`
- Modify: `src/config.js`

- [ ] **Step 1: Add bulk selection state to GPM_STATE**

```javascript
// In src/config.js, add to GPM_STATE:
const GPM_STATE = {
  // ... existing state ...
  bulkSelection: {
    active: false,
    selectedChatIds: new Set(),
  },
};
```

- [ ] **Step 2: Add bulk selection handlers to project-tree.js**

```javascript
// Add to src/project-tree.js

function gpmToggleBulkSelection(chatId, event) {
  if (!GPM_STATE.bulkSelection.active) {
    GPM_STATE.bulkSelection.active = true;
  }
  
  if (event && (event.ctrlKey || event.metaKey)) {
    if (GPM_STATE.bulkSelection.selectedChatIds.has(chatId)) {
      GPM_STATE.bulkSelection.selectedChatIds.delete(chatId);
    } else {
      if (GPM_STATE.bulkSelection.selectedChatIds.size >= 50) {
        showToast(t('bulkLimitReached'));
        return;
      }
      GPM_STATE.bulkSelection.selectedChatIds.add(chatId);
    }
  } else {
    GPM_STATE.bulkSelection.selectedChatIds.clear();
    GPM_STATE.bulkSelection.selectedChatIds.add(chatId);
  }
  
  gpmRenderTree();
  gpmUpdateBulkToolbar();
}

function gpmClearBulkSelection() {
  GPM_STATE.bulkSelection.active = false;
  GPM_STATE.bulkSelection.selectedChatIds.clear();
  gpmRenderTree();
  gpmUpdateBulkToolbar();
}

function gpmSelectAllChats(projectId) {
  const projects = GPMStorage.getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  GPM_STATE.bulkSelection.active = true;
  GPM_STATE.bulkSelection.selectedChatIds.clear();
  
  for (const chatId of project.chatIds || []) {
    if (GPM_STATE.bulkSelection.selectedChatIds.size >= 50) break;
    GPM_STATE.bulkSelection.selectedChatIds.add(chatId);
  }
  
  gpmRenderTree();
  gpmUpdateBulkToolbar();
}

async function gpmBulkMoveToProject(targetProjectId) {
  const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
  
  for (const chatId of chatIds) {
    await GPMStorage.assignChat(chatId, targetProjectId);
  }
  
  showToast(t('movedChats').replace('{count}', chatIds.length));
  gpmClearBulkSelection();
}

async function gpmBulkAssignTags(tagIds) {
  const chatIds = Array.from(GPM_STATE.bulkSelection.selectedChatIds);
  await TagManager.bulkAssignTags(chatIds, tagIds);
  showToast(t('taggedChats').replace('{count}', chatIds.length));
  gpmClearBulkSelection();
}

function gpmUpdateBulkToolbar() {
  const existing = document.querySelector('.gpm-bulk-toolbar');
  if (existing) existing.remove();
  
  if (!GPM_STATE.bulkSelection.active || GPM_STATE.bulkSelection.selectedChatIds.size === 0) {
    return;
  }
  
  const count = GPM_STATE.bulkSelection.selectedChatIds.size;
  const toolbar = document.createElement('div');
  toolbar.className = 'gpm-bulk-toolbar';
  
  toolbar.innerHTML = `
    <span class="gpm-bulk-count">${count} ${t('selected')}</span>
    <button class="gpm-btn gpm-btn-sm" data-action="move">${t('moveSelected')}</button>
    <button class="gpm-btn gpm-btn-sm" data-action="tag">${t('tagSelected')}</button>
    <button class="gpm-btn gpm-btn-sm gpm-btn-danger" data-action="delete">${t('delete')}</button>
    <button class="gpm-btn gpm-btn-sm gpm-btn-secondary" data-action="cancel">${t('cancel')}</button>
  `;
  
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
        for (const id of chatIds) {
          await GPMStorage.unassignChat(id);
        }
        showToast(t('removedChats').replace('{count}', chatIds.length));
        gpmClearBulkSelection();
        break;
      case 'cancel':
        gpmClearBulkSelection();
        break;
    }
  });
  
  if (GPM_STATE.container) {
    GPM_STATE.container.appendChild(toolbar);
  }
}

function showBulkMoveModal() {
  // Implementation similar to existing modals
  // Shows project selector and calls gpmBulkMoveToProject
}

function showBulkTagModal() {
  // Implementation similar to existing modals
  // Shows tag selector and calls gpmBulkAssignTags
}
```

- [ ] **Step 3: Add bulk toolbar CSS**

```css
/* Add to src/styles.css */

.gpm-bulk-toolbar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--gpm-surface, #1e1e1e);
  border-top: 1px solid rgba(255,255,255,0.1);
  z-index: 10;
}

.gpm-bulk-count {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
}

.gpm-bulk-toolbar .gpm-btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/project-tree.js src/config.js src/styles.css
git commit -m "feat(bulk): add bulk selection and operations UI"
```

---

## Task 7: i18n Keys

**Files:**
- Modify: `_locales/en/messages.json`
- Modify: `_locales/tr/messages.json`
- (Repeat for all 17 languages)

- [ ] **Step 1: Add English i18n keys**

```json
// Add to _locales/en/messages.json
  "tags": {
    "message": "Tags"
  },
  "createTag": {
    "message": "Create Tag"
  },
  "tagName": {
    "message": "Tag Name"
  },
  "tagNamePlaceholder": {
    "message": "Enter tag name..."
  },
  "tagColor": {
    "message": "Tag Color"
  },
  "noTags": {
    "message": "No tags yet"
  },
  "maxTagsReached": {
    "message": "Maximum 5 tags per chat"
  },
  "favorites": {
    "message": "Starred"
  },
  "starred": {
    "message": "Star"
  },
  "unstarred": {
    "message": "Unstar"
  },
  "bulkSelection": {
    "message": "Bulk Selection"
  },
  "selected": {
    "message": "selected"
  },
  "moveSelected": {
    "message": "Move Selected"
  },
  "tagSelected": {
    "message": "Tag Selected"
  },
  "deleteSelected": {
    "message": "Delete Selected"
  },
  "movedChats": {
    "message": "Moved {count} chats"
  },
  "taggedChats": {
    "message": "Tagged {count} chats"
  },
  "removedChats": {
    "message": "Removed {count} chats"
  },
  "bulkLimitReached": {
    "message": "Maximum 50 chats can be selected"
  }
```

- [ ] **Step 2: Add Turkish i18n keys**

```json
// Add to _locales/tr/messages.json
  "tags": {
    "message": "Etiketler"
  },
  "createTag": {
    "message": "Etiket Oluştur"
  },
  "tagName": {
    "message": "Etiket Adı"
  },
  "tagNamePlaceholder": {
    "message": "Etiket adı girin..."
  },
  "tagColor": {
    "message": "Etiket Rengi"
  },
  "noTags": {
    "message": "Henüz etiket yok"
  },
  "maxTagsReached": {
    "message": "Her chat için maksimum 5 etiket"
  },
  "favorites": {
    "message": "Yıldızlılar"
  },
  "starred": {
    "message": "Yıldızla"
  },
  "unstarred": {
    "message": "Yıldızı Kaldır"
  },
  "bulkSelection": {
    "message": "Toplu Seçim"
  },
  "selected": {
    "message": "seçildi"
  },
  "moveSelected": {
    "message": "Seçili olanları taşı"
  },
  "tagSelected": {
    "message": "Seçili olanları etiketle"
  },
  "deleteSelected": {
    "message": "Seçili olanları sil"
  },
  "movedChats": {
    "message": "{count} chat taşındı"
  },
  "taggedChats": {
    "message": "{count} chat etiketlendi"
  },
  "removedChats": {
    "message": "{count} chat kaldırıldı"
  },
  "bulkLimitReached": {
    "message": "Maksimum 50 chat seçilebilir"
  }
```

- [ ] **Step 3: Add i18n keys to remaining 15 languages**

(Same pattern for: de, fr, es, it, pt, ru, ja, zh-CN, ko, hi, ar, vi, id, th, bn)

- [ ] **Step 4: Commit**

```bash
git add _locales/
git commit -m "feat(i18n): add tag and bulk operation keys for all 17 languages"
```

---

## Task 8: Integration & Testing

**Files:**
- Modify: `src/content.js`
- Run: Full test suite

- [ ] **Step 1: Initialize tag modules in content.js**

```javascript
// In src/content.js, after Step 12 (gpmStartHealthMonitor), add:

  // ── Step 14: Initialize tag filter bar ──
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

- [ ] **Step 2: Run full test suite**

Run: `npm test --run`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Manual testing in browser**

1. Load extension in Chrome (chrome://extensions → Load unpacked)
2. Navigate to gemini.google.com
3. Create a tag via chat context menu
4. Assign tags to chats
5. Test tag filtering
6. Star/unstar chats
7. Test bulk selection (Ctrl+click)
8. Test bulk move and tag operations

- [ ] **Step 5: Final commit**

```bash
git add src/content.js
git commit -m "feat: integrate TagManager into main initialization flow"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Schema migration v2→v3 | storage.js |
| 2 | Tag validator | validators.js |
| 3 | Storage tag methods | storage.js |
| 4 | TagManager module | src/tags/tag-manager.js |
| 5 | Tag UI components | src/tags/tag-ui.js, styles.css |
| 6 | Bulk operations UI | project-tree.js, config.js |
| 7 | i18n keys | _locales/*/messages.json |
| 8 | Integration & testing | content.js |

**Estimated effort:** 8-12 hours for complete implementation and testing.