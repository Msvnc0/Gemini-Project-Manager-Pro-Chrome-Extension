/**
 * storage.js — Data Layer
 * Manages recursive project trees, chat mappings, quick prompts, and settings.
 *
 * Schema Version: 3
 *
 * Data Schema:
 *   gpm_schemaVersion: number — current schema version
 *   gpm_projects: Array<Project>
 *   Project: { id, name, icon, color, parentId: null|string, children: string[], chatIds: string[], collapsed: bool, createdAt: number, updatedAt: number }
 *   gpm_chatMap: { [chatId]: { projectId, alias, pinned, _autoResolved, tags: string[], starredAt: number|null } }
 *   gpm_tags: { [tagId]: { id, name, color, count, createdAt, updatedAt } }
 *   gpm_quickPrompts: Array<{ id, title, content, category }>
 *   gpm_settings: { lang, theme }
 *   gpm_backups: Array<Backup> — multiple backup versions
 */

const GPM_SCHEMA_VERSION = 3;

const GPMStorage = (() => {
  // ── Schema Migrations ──
  const MIGRATIONS = {
    1: (data) => {
      // v0 → v1: Add timestamps to projects
      (data.gpm_projects || []).forEach((p) => {
        if (!p.createdAt) p.createdAt = Date.now();
        if (!p.updatedAt) p.updatedAt = Date.now();
      });
      return data;
    },
    2: (data) => {
      // v1 → v2: Initialize backups array
      if (!data.gpm_backups) data.gpm_backups = [];
      return data;
    },
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
  };

  async function runMigrations(data, fromVersion) {
    let currentData = { ...data };
    for (let v = fromVersion + 1; v <= GPM_SCHEMA_VERSION; v++) {
      if (MIGRATIONS[v]) {
        console.log(`[GPM Storage] Running migration v${v}`);
        currentData = MIGRATIONS[v](currentData);
      }
    }
    currentData.gpm_schemaVersion = GPM_SCHEMA_VERSION;
    return currentData;
  }

  async function initializeStorage() {
    const stored = await _get('gpm_schemaVersion');
    const currentVersion = stored || 0;

    if (currentVersion < GPM_SCHEMA_VERSION) {
      const allData = await chrome.storage.local.get(null);
      const migratedData = await runMigrations(allData, currentVersion);
      await chrome.storage.local.set(migratedData);
      console.log(`[GPM Storage] Migrated from v${currentVersion} to v${GPM_SCHEMA_VERSION}`);
    }
  }

  // ── Helpers ──
  function uid() {
    const timestamp = Date.now().toString(36);
    const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const random2 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `${timestamp}-${random1}-${random2}`;
  }

  // ── Mutex for serializing writes ──
  let _writeLock = Promise.resolve();

  function _withLock(fn) {
    const next = _writeLock.then(fn, fn);
    _writeLock = next.catch(() => {});
    return next;
  }

  async function _get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) return undefined;
      throw e;
    }
  }

  async function _set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      try {
        chrome.runtime.sendMessage({ type: 'GPM_STORAGE_UPDATED' });
      } catch (_) {}
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) return;
      throw e;
    }
  }

  // ── Projects ──
  async function getProjects() {
    return (await _get('gpm_projects')) || [];
  }

  async function saveProjects(projects) {
    // Auto-backup: save current state before overwriting
    const current = await _get('gpm_projects');
    if (current && Array.isArray(current) && current.length > 0) {
      await chrome.storage.local.set({ gpm_projects_backup: current, gpm_backup_ts: Date.now() });
    }
    await _set('gpm_projects', projects);
  }

  async function createProject({ name, icon = '📁', color = '#8ab4f8', parentId = null }) {
    const projects = await getProjects();
    const id = uid();
    const project = { id, name, icon, color, parentId, children: [], chatIds: [], collapsed: false };
    projects.push(project);

    if (parentId) {
      const parent = projects.find((p) => p.id === parentId);
      if (parent) parent.children.push(id);
    }

    await saveProjects(projects);
    return project;
  }

  async function updateProject(id, updates) {
    const projects = await getProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    Object.assign(projects[idx], updates);
    await saveProjects(projects);
    return projects[idx];
  }

  async function deleteProject(id) {
    let projects = await getProjects();
    const chatMap = await getChatMap();

    // Recursively collect all descendant IDs
    function collectDescendants(pid) {
      const node = projects.find((p) => p.id === pid);
      if (!node) return [pid];
      let ids = [pid];
      for (const childId of node.children) {
        ids = ids.concat(collectDescendants(childId));
      }
      return ids;
    }

    const toDelete = new Set(collectDescendants(id));

    // Remove chat mappings for deleted projects
    for (const [chatId, mapping] of Object.entries(chatMap)) {
      if (toDelete.has(mapping.projectId)) {
        delete chatMap[chatId];
      }
    }

    // Remove from parent's children array
    const target = projects.find((p) => p.id === id);
    if (target?.parentId) {
      const parent = projects.find((p) => p.id === target.parentId);
      if (parent) parent.children = parent.children.filter((c) => c !== id);
    }

    projects = projects.filter((p) => !toDelete.has(p.id));
    await saveProjects(projects);
    await saveChatMap(chatMap);
  }

  function getRootProjects(projects) {
    return projects.filter((p) => !p.parentId);
  }

  // ── Chat Map ──
  async function getChatMap() {
    return (await _get('gpm_chatMap')) || {};
  }

  async function saveChatMap(map) {
    // Auto-backup: save current chatMap before overwriting
    const current = await _get('gpm_chatMap');
    if (current && Object.keys(current).length > 0) {
      await chrome.storage.local.set({ gpm_chatMap_backup: current });
    }
    await _set('gpm_chatMap', map);
  }

  // Mutex-protected assignChat — prevents race conditions across tabs
  async function assignChat(chatId, projectId) {
    return _withLock(async () => {
      // Re-read fresh data inside the lock to avoid stale writes
      const chatMap = await getChatMap();
      const projects = await getProjects();

      // Remove from old project's chatIds
      if (chatMap[chatId]) {
        const oldProj = projects.find((p) => p.id === chatMap[chatId].projectId);
        if (oldProj) oldProj.chatIds = (oldProj.chatIds || []).filter((c) => c !== chatId);
      }

      chatMap[chatId] = {
        projectId,
        alias: chatMap[chatId]?.alias || '',
        pinned: chatMap[chatId]?.pinned || false,
        _autoResolved: chatMap[chatId]?._autoResolved || false,
      };

      // Add to new project's chatIds
      const newProj = projects.find((p) => p.id === projectId);
      if (newProj && !(newProj.chatIds || []).includes(chatId)) {
        if (!newProj.chatIds) newProj.chatIds = [];
        newProj.chatIds.push(chatId);
      }

      await saveProjects(projects);
      await saveChatMap(chatMap);
    });
  }

  // Mutex-protected unassignChat
  async function unassignChat(chatId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      const projects = await getProjects();

      if (chatMap[chatId]) {
        const proj = projects.find((p) => p.id === chatMap[chatId].projectId);
        if (proj) proj.chatIds = (proj.chatIds || []).filter((c) => c !== chatId);
        delete chatMap[chatId];
      }

      await saveProjects(projects);
      await saveChatMap(chatMap);
    });
  }

  async function setChatAlias(chatId, alias) {
    const chatMap = await getChatMap();
    if (chatMap[chatId]) {
      chatMap[chatId].alias = alias;
      chatMap[chatId]._autoResolved = false; // Manual rename — protect from auto-overwrite
      await saveChatMap(chatMap);
    }
  }

  async function togglePinChat(chatId) {
    const chatMap = await getChatMap();
    if (chatMap[chatId]) {
      chatMap[chatId].pinned = !chatMap[chatId].pinned;
      await saveChatMap(chatMap);
      return chatMap[chatId].pinned;
    }
    return false;
  }

  // ── Quick Prompts ──
  async function getQuickPrompts() {
    return (await _get('gpm_quickPrompts')) || [];
  }

  async function saveQuickPrompt({ title, content, category = 'General' }) {
    const prompts = await getQuickPrompts();
    prompts.push({ id: uid(), title, content, category });
    await _set('gpm_quickPrompts', prompts);
  }

  async function deleteQuickPrompt(id) {
    let prompts = await getQuickPrompts();
    prompts = prompts.filter((p) => p.id !== id);
    await _set('gpm_quickPrompts', prompts);
  }

  async function updateQuickPrompt(id, updates) {
    const prompts = await getQuickPrompts();
    const idx = prompts.findIndex((p) => p.id === id);
    if (idx !== -1) Object.assign(prompts[idx], updates);
    await _set('gpm_quickPrompts', prompts);
  }

  // ── Tags ──
  async function getTags() {
    return (await _get('gpm_tags')) || {};
  }

  async function saveTags(tags) {
    const current = await _get('gpm_tags');
    if (current && Object.keys(current).length > 0) {
      await chrome.storage.local.set({ gpm_tags_backup: current });
    }
    await _set('gpm_tags', tags);
  }

  async function createTag({ name, color = '#3b82f6' }) {
    const tags = await getTags();
    const id = uid();
    const tag = {
      id,
      name,
      color,
      count: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tags[id] = tag;
    await saveTags(tags);
    return tag;
  }

  async function updateTag(id, updates) {
    const tags = await getTags();
    if (!tags[id]) return null;
    Object.assign(tags[id], updates, { updatedAt: Date.now() });
    await saveTags(tags);
    return tags[id];
  }

  async function deleteTag(id) {
    const tags = await getTags();
    const chatMap = await getChatMap();
    delete tags[id];
    for (const chatId of Object.keys(chatMap)) {
      if (chatMap[chatId].tags) {
        chatMap[chatId].tags = chatMap[chatId].tags.filter((t) => t !== id);
      }
    }
    await saveTags(tags);
    await saveChatMap(chatMap);
  }

  async function getChatsByTag(tagId) {
    const chatMap = await getChatMap();
    return Object.entries(chatMap)
      .filter(([, mapping]) => mapping.tags && mapping.tags.includes(tagId))
      .map(([chatId]) => chatId);
  }

  async function assignTagsToChat(chatId, tagIds) {
    if (tagIds.length > 5) {
      throw new Error('Maximum 5 tags allowed per chat');
    }
    return _withLock(async () => {
      const chatMap = await getChatMap();
      const tags = await getTags();
      if (!chatMap[chatId]) {
        throw new Error('Chat not found in chatMap');
      }
      const oldTags = chatMap[chatId].tags || [];
      const newTags = tagIds.filter((id) => tags[id]);
      for (const tagId of oldTags) {
        if (!newTags.includes(tagId) && tags[tagId]) {
          tags[tagId].count = Math.max(0, (tags[tagId].count || 1) - 1);
        }
      }
      for (const tagId of newTags) {
        if (!oldTags.includes(tagId) && tags[tagId]) {
          tags[tagId].count = (tags[tagId].count || 0) + 1;
        }
      }
      chatMap[chatId].tags = newTags;
      await saveChatMap(chatMap);
      await saveTags(tags);
      return true;
    });
  }

  async function removeTagFromChat(chatId, tagId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      const tags = await getTags();
      if (!chatMap[chatId] || !tags[tagId]) return false;
      if (chatMap[chatId].tags) {
        const idx = chatMap[chatId].tags.indexOf(tagId);
        if (idx !== -1) {
          chatMap[chatId].tags.splice(idx, 1);
          tags[tagId].count = Math.max(0, (tags[tagId].count || 1) - 1);
          await saveChatMap(chatMap);
          await saveTags(tags);
        }
      }
      return true;
    });
  }

  async function toggleStarChat(chatId) {
    const chatMap = await getChatMap();
    if (!chatMap[chatId]) return null;
    chatMap[chatId].starredAt = chatMap[chatId].starredAt ? null : Date.now();
    await saveChatMap(chatMap);
    return chatMap[chatId].starredAt;
  }

  async function getStarredChats() {
    const chatMap = await getChatMap();
    return Object.entries(chatMap)
      .filter(([, mapping]) => mapping.starredAt)
      .sort((a, b) => b[1].starredAt - a[1].starredAt)
      .map(([chatId, mapping]) => ({ chatId, ...mapping }));
  }

  // ── Settings ──
  async function getSettings() {
    return (await _get('gpm_settings')) || { lang: 'en', theme: 'auto' };
  }

  async function saveSettings(settings) {
    await _set('gpm_settings', settings);
  }

  // ── Import / Export ──
  async function exportAll() {
    const [projects, chatMap, quickPrompts, settings, tags] = await Promise.all([
      getProjects(),
      getChatMap(),
      getQuickPrompts(),
      getSettings(),
      getTags(),
    ]);
    return JSON.stringify(
      {
        gpm_projects: projects,
        gpm_chatMap: chatMap,
        gpm_quickPrompts: quickPrompts,
        gpm_settings: settings,
        gpm_tags: tags,
      },
      null,
      2
    );
  }

  // ── Validation & Sanitization Helpers (via GPMValidators) ──
  const sanitizeString = GPMValidators.sanitizeString;
  const validateProject = GPMValidators.validateProject;
  const validateChatMapping = GPMValidators.validateChatMapping;
  const validateQuickPrompt = GPMValidators.validateQuickPrompt;
  const validateSettings = GPMValidators.validateSettings;
  const validateTag = GPMValidators.validateTag;

  async function importAll(jsonString) {
    const data = JSON.parse(jsonString);

    // Pre-import backup of current data
    const [curProjects, curChatMap, curPrompts, curTags] = await Promise.all([
      _get('gpm_projects'),
      _get('gpm_chatMap'),
      _get('gpm_quickPrompts'),
      _get('gpm_tags'),
    ]);
    await chrome.storage.local.set({
      gpm_pre_import_projects: curProjects || [],
      gpm_pre_import_chatMap: curChatMap || {},
      gpm_pre_import_quickPrompts: curPrompts || [],
      gpm_pre_import_tags: curTags || {},
      gpm_pre_import_ts: Date.now(),
    });

    // Validate and sanitize each data field before writing
    if (data.gpm_projects && Array.isArray(data.gpm_projects)) {
      const validated = data.gpm_projects.map(validateProject).filter(Boolean);
      await _set('gpm_projects', validated);
    }
    if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object' && !Array.isArray(data.gpm_chatMap)) {
      const validated = {};
      for (const [chatId, mapping] of Object.entries(data.gpm_chatMap)) {
        const clean = validateChatMapping(mapping);
        if (clean) validated[sanitizeString(chatId)] = clean;
      }
      await _set('gpm_chatMap', validated);
    }
    if (data.gpm_quickPrompts && Array.isArray(data.gpm_quickPrompts)) {
      const validated = data.gpm_quickPrompts.map(validateQuickPrompt).filter(Boolean);
      await _set('gpm_quickPrompts', validated);
    }
    if (data.gpm_settings && typeof data.gpm_settings === 'object') {
      const validated = validateSettings(data.gpm_settings);
      if (validated) await _set('gpm_settings', validated);
    }
    if (data.gpm_tags && typeof data.gpm_tags === 'object' && !Array.isArray(data.gpm_tags)) {
      const validated = {};
      for (const [tagId, tag] of Object.entries(data.gpm_tags)) {
        const clean = validateTag(tag);
        if (clean) validated[sanitizeString(tagId)] = clean;
      }
      await _set('gpm_tags', validated);
    }
  }

  async function clearAll() {
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
      gpm_tags: {},
    });
  }

  // ── Backup / Restore ──
  async function getBackupInfo() {
    const ts = await _get('gpm_backup_ts');
    const backup = await _get('gpm_projects_backup');
    if (!ts || !backup) return null;
    const totalChats = backup.reduce((sum, p) => sum + (p.chatIds?.length || 0), 0);
    return { timestamp: ts, projectCount: backup.length, chatCount: totalChats };
  }

  async function restoreFromBackup() {
    const backup = await _get('gpm_projects_backup');
    const chatMapBackup = await _get('gpm_chatMap_backup');
    if (!backup || !Array.isArray(backup)) return false;
    // Save current as "pre-restore" in case user wants to undo
    const current = await _get('gpm_projects');
    if (current && current.length > 0) {
      await chrome.storage.local.set({ gpm_projects_pre_restore: current });
    }
    await _set('gpm_projects', backup);
    if (chatMapBackup) {
      await _set('gpm_chatMap', chatMapBackup);
    }
    if (typeof console !== 'undefined' && console.log)
      console.log('[GPM] Restored from backup:', backup.length, 'projects');
    return true;
  }

  return {
    initializeStorage,
    getProjects,
    saveProjects,
    createProject,
    updateProject,
    deleteProject,
    getRootProjects,
    getChatMap,
    saveChatMap,
    assignChat,
    unassignChat,
    setChatAlias,
    togglePinChat,
    getQuickPrompts,
    saveQuickPrompt,
    deleteQuickPrompt,
    updateQuickPrompt,
    getSettings,
    saveSettings,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToChat,
    removeTagFromChat,
    getChatsByTag,
    toggleStarChat,
    getStarredChats,
    exportAll,
    importAll,
    clearAll,
    getBackupInfo,
    restoreFromBackup,
  };
})();
