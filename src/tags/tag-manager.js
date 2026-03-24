const TagManager = (() => {
  async function filterChatsByTags(tagIds) {
    if (!tagIds || tagIds.length === 0) {
      const chatMap = await GPMStorage.getChatMap();
      return Object.keys(chatMap);
    }

    const chatMap = await GPMStorage.getChatMap();

    return Object.entries(chatMap)
      .filter(([_, entry]) => {
        if (!entry.tags) return false;
        return tagIds.every((tagId) => entry.tags.includes(tagId));
      })
      .map(([chatId, _]) => chatId);
  }

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

  async function suggestTagsForChat(chatTitle) {
    if (!chatTitle || typeof chatTitle !== 'string') return [];

    const tags = await GPMStorage.getTags();
    const titleLower = chatTitle.toLowerCase();

    const matched = Object.values(tags)
      .filter((tag) => titleLower.includes(tag.name.toLowerCase()))
      .slice(0, 3);

    return matched;
  }

  async function suggestTagsForProject(projectId) {
    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();
    const tags = await GPMStorage.getTags();

    const project = projects.find((p) => p.id === projectId);
    if (!project) return [];

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
