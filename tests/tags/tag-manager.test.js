import { resetMockStorage } from '../mocks/chrome.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const validatorsCode = readFileSync(resolve('src/utils/validators.js'), 'utf-8');
const patchedValidators = validatorsCode.replace(/^const GPMValidators\s*=/m, 'globalThis.GPMValidators =');
new Function(patchedValidators)();

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
