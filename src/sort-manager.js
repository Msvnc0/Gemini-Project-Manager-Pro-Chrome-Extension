/**
 * sort-manager.js — Sorting Options for Projects and Chats
 *
 * Provides multiple sorting strategies for the project tree.
 */

const GPMSortManager = (() => {
  const SORT_KEY = 'gpm_sortPreference';

  const SORT_OPTIONS = {
    name_asc: {
      id: 'name_asc',
      name: 'İsim (A-Z)',
      nameEn: 'Name (A-Z)',
      compare: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    name_desc: {
      id: 'name_desc',
      name: 'İsim (Z-A)',
      nameEn: 'Name (Z-A)',
      compare: (a, b) => (b.name || '').localeCompare(a.name || ''),
    },
    created_asc: {
      id: 'created_asc',
      name: 'Oluşturulma (Eski)',
      nameEn: 'Created (Oldest)',
      compare: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    },
    created_desc: {
      id: 'created_desc',
      name: 'Oluşturulma (Yeni)',
      nameEn: 'Created (Newest)',
      compare: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    },
    updated_asc: {
      id: 'updated_asc',
      name: 'Güncelleme (Eski)',
      nameEn: 'Updated (Oldest)',
      compare: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
    },
    updated_desc: {
      id: 'updated_desc',
      name: 'Güncelleme (Yeni)',
      nameEn: 'Updated (Newest)',
      compare: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    },
    chat_count: {
      id: 'chat_count',
      name: 'Sohbet Sayısı',
      nameEn: 'Chat Count',
      compare: (a, b) => (b.chatIds || []).length - (a.chatIds || []).length,
    },
    usage: {
      id: 'usage',
      name: 'Kullanım Sıklığı',
      nameEn: 'Usage Frequency',
      compare: (a, b) => (b.accessCount || 0) - (a.accessCount || 0),
    },
  };

  async function getSortPreference() {
    const { [SORT_KEY]: pref } = await chrome.storage.local.get(SORT_KEY);
    return pref || 'name_asc';
  }

  async function setSortPreference(sortId) {
    await chrome.storage.local.set({ [SORT_KEY]: sortId });
  }

  function getSortOption(sortId) {
    return SORT_OPTIONS[sortId] || SORT_OPTIONS.name_asc;
  }

  function getSortOptionsList() {
    return Object.values(SORT_OPTIONS).map((opt) => ({
      id: opt.id,
      name: opt.name,
      nameEn: opt.nameEn,
    }));
  }

  function sortProjects(projects, sortId = 'name_asc') {
    const sortOption = getSortOption(sortId);
    return [...projects].sort(sortOption.compare);
  }

  function sortChats(chatIds, chatMap, sortId = 'name_asc') {
    const sortOption = getSortOption(sortId);

    return [...chatIds].sort((a, b) => {
      const aData = chatMap[a] || {};
      const bData = chatMap[b] || {};

      if (sortId.startsWith('name')) {
        return sortOption.compare({ name: aData.alias || a }, { name: bData.alias || b });
      }

      return sortOption.compare(
        { createdAt: aData.addedAt, updatedAt: aData.lastAccessed },
        { createdAt: bData.addedAt, updatedAt: bData.lastAccessed }
      );
    });
  }

  return {
    getSortPreference,
    setSortPreference,
    getSortOption,
    getSortOptionsList,
    sortProjects,
    sortChats,
    SORT_OPTIONS,
  };
})();
