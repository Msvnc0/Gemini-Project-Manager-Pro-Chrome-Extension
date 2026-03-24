/**
 * tags-manager.js — Tags/Labels System for Chats
 *
 * Allows assigning multiple tags to chats for better organization.
 * Tags are stored separately and referenced in chatMap entries.
 */

const GPMTagsManager = (() => {
  const TAGS_KEY = 'gpm_tags';

  const DEFAULT_TAGS = [
    { id: 'important', name: 'Önemli', nameEn: 'Important', color: '#f28b82', icon: '⭐' },
    { id: 'urgent', name: 'Acil', nameEn: 'Urgent', color: '#fdd663', icon: '🚨' },
    { id: 'work', name: 'İş', nameEn: 'Work', color: '#8ab4f8', icon: '💼' },
    { id: 'personal', name: 'Kişisel', nameEn: 'Personal', color: '#81c995', icon: '🏠' },
    { id: 'reference', name: 'Referans', nameEn: 'Reference', color: '#c4c4c4', icon: '📚' },
  ];

  async function getTags() {
    const { [TAGS_KEY]: tags } = await chrome.storage.local.get(TAGS_KEY);
    return tags || DEFAULT_TAGS;
  }

  async function saveTags(tags) {
    await chrome.storage.local.set({ [TAGS_KEY]: tags });
  }

  async function createTag({ name, nameEn, color, icon }) {
    const tags = await getTags();
    const id = `tag-${Date.now().toString(36)}`;
    const newTag = { id, name, nameEn: nameEn || name, color: color || '#8ab4f8', icon: icon || '🏷️' };
    tags.push(newTag);
    await saveTags(tags);
    return newTag;
  }

  async function updateTag(id, updates) {
    const tags = await getTags();
    const idx = tags.findIndex((t) => t.id === id);
    if (idx !== -1) {
      tags[idx] = { ...tags[idx], ...updates };
      await saveTags(tags);
      return tags[idx];
    }
    return null;
  }

  async function deleteTag(id) {
    const tags = await getTags();
    const filtered = tags.filter((t) => t.id !== id);
    await saveTags(filtered);

    const chatMap = await GPMStorage.getChatMap();
    for (const chatId in chatMap) {
      if (chatMap[chatId].tags) {
        chatMap[chatId].tags = chatMap[chatId].tags.filter((t) => t !== id);
      }
    }
    await GPMStorage.saveChatMap(chatMap);
  }

  async function addTagToChat(chatId, tagId) {
    const chatMap = await GPMStorage.getChatMap();
    if (!chatMap[chatId]) return false;

    if (!chatMap[chatId].tags) {
      chatMap[chatId].tags = [];
    }

    if (!chatMap[chatId].tags.includes(tagId)) {
      chatMap[chatId].tags.push(tagId);
      await GPMStorage.saveChatMap(chatMap);
    }

    return true;
  }

  async function removeTagFromChat(chatId, tagId) {
    const chatMap = await GPMStorage.getChatMap();
    if (!chatMap[chatId] || !chatMap[chatId].tags) return false;

    chatMap[chatId].tags = chatMap[chatId].tags.filter((t) => t !== tagId);
    await GPMStorage.saveChatMap(chatMap);
    return true;
  }

  async function getChatsByTag(tagId) {
    const chatMap = await GPMStorage.getChatMap();
    const chats = [];

    for (const [chatId, mapping] of Object.entries(chatMap)) {
      if (mapping.tags && mapping.tags.includes(tagId)) {
        chats.push({ chatId, ...mapping });
      }
    }

    return chats;
  }

  function renderTagBadge(tag, small = false) {
    return `<span class="gpm-tag-badge" style="
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: ${small ? '1px 4px' : '2px 6px'};
      background: ${tag.color}22;
      color: ${tag.color};
      border-radius: 4px;
      font-size: ${small ? '10px' : '11px'};
      white-space: nowrap;
    ">${tag.icon} ${tag.name}</span>`;
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
    renderTagBadge,
    DEFAULT_TAGS,
  };
})();
