/**
 * storage.js — Data Layer
 * Manages recursive project trees, chat mappings, quick prompts, and settings.
 *
 * Schema Version: 5
 *
 * Data Schema:
 *   gpm_schemaVersion: number — current schema version
 *   gpm_projects: Array<Project>
 *   Project: { id, name, icon, color, parentId: null|string, children: string[], chatIds: string[], collapsed: bool, createdAt: number, updatedAt: number }
 *   gpm_chatMap: { [chatId]: { projectId, alias, pinned, _autoResolved, starredAt: number|null } }
 *   gpm_quickPrompts: Array<{ id, title, content, category }>
 *   gpm_settings: { lang, theme }
 *   gpm_backup_current: { type: string, data: { projects, chatMap, prompts }, timestamp: number }
 *   gpm_favorites: string[] — array of favorited project IDs
 */

const GPM_SCHEMA_VERSION = 5;

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
  'gpm_tags',
];

const GPMStorage = (() => {
  const MIGRATIONS = {
    1: (data) => {
      (data.gpm_projects || []).forEach((p) => {
        if (!p.createdAt) p.createdAt = Date.now();
        if (!p.updatedAt) p.updatedAt = Date.now();
      });
      return data;
    },
    2: (data) => {
      if (!data.gpm_backups) data.gpm_backups = [];
      return data;
    },
    3: (data) => {
      if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object') {
        for (const chatId of Object.keys(data.gpm_chatMap)) {
          if (data.gpm_chatMap[chatId].starredAt === undefined) {
            data.gpm_chatMap[chatId].starredAt = null;
          }
        }
      }
      return data;
    },
    4: (data) => {
      if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object') {
        for (const chatId of Object.keys(data.gpm_chatMap)) {
          if (data.gpm_chatMap[chatId].starredAt === undefined) {
            data.gpm_chatMap[chatId].starredAt = null;
          }
          if (data.gpm_chatMap[chatId].tags) {
            delete data.gpm_chatMap[chatId].tags;
          }
        }
      }
      if (data.gpm_tags) {
        delete data.gpm_tags;
      }
      return data;
    },
    5: (data) => {
      for (const key of GPM_LEGACY_KEYS) {
        if (data[key] !== undefined) delete data[key];
      }
      return data;
    },
  };

  async function runMigrations(data, fromVersion) {
    let currentData = { ...data };
    for (let v = fromVersion + 1; v <= GPM_SCHEMA_VERSION; v++) {
      if (MIGRATIONS[v]) {
        gpmLog('Running migration v' + v);
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

      const keysToRemove = GPM_LEGACY_KEYS.filter((k) => migratedData[k] === undefined && allData[k] !== undefined);
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      await chrome.storage.local.set(migratedData);
      gpmLog('Migrated from v' + currentVersion + ' to ' + GPM_SCHEMA_VERSION);
    }
  }

  let _localLock = Promise.resolve();

  async function _acquireCrossTabLock(maxRetries = 5, delay = 200) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'GPM_ACQUIRE_LOCK' });
        if (resp && resp.granted) return true;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, delay));
    }
    return false;
  }

  async function _releaseCrossTabLock() {
    try {
      await chrome.runtime.sendMessage({ type: 'GPM_RELEASE_LOCK' });
    } catch (_) {}
  }

  function _withLock(fn) {
    const next = _localLock.then(async () => {
      const locked = await _acquireCrossTabLock();
      try {
        return await fn();
      } finally {
        if (locked) await _releaseCrossTabLock();
      }
    });
    _localLock = next.catch((err) => {
      gpmError('Lock chain error:', err);
      return Promise.resolve();
    });
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
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) return;
      throw e;
    }
  }

  async function _setBulk(data) {
    try {
      await chrome.storage.local.set(data);
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) return;
      throw e;
    }
  }

  const GPM_STORAGE_QUOTA_WARN = 0.8;

  async function _checkQuota() {
    try {
      const bytesUsed = await chrome.storage.local.getBytesInUse(null);
      return bytesUsed / (10 * 1024 * 1024);
    } catch (_) {
      return 0;
    }
  }

  async function _writeBackup(type, data) {
    const usage = await _checkQuota();
    if (usage > GPM_STORAGE_QUOTA_WARN) {
      gpmLog('Quota usage', Math.round(usage * 100) + '%, skipping backup');
      return;
    }
    await chrome.storage.local.set({
      gpm_backup_current: {
        type,
        data: {
          projects: data.projects || [],
          chatMap: data.chatMap || {},
          prompts: data.prompts || [],
          settings: data.settings,
        },
        timestamp: Date.now(),
      },
    });
  }

  async function _saveAtomic(projects, chatMap) {
    const currentProjects = await _get('gpm_projects');
    const currentChatMap = await _get('gpm_chatMap');

    await _writeBackup('auto', {
      projects: currentProjects,
      chatMap: currentChatMap,
    });

    await _setBulk({
      gpm_projects: projects,
      gpm_chatMap: chatMap,
    });
  }

  async function getProjects() {
    return (await _get('gpm_projects')) || [];
  }

  async function saveProjects(projects) {
    return _withLock(async () => {
      const current = await _get('gpm_projects');
      const chatMap = await _get('gpm_chatMap');
      if (current && Array.isArray(current) && current.length > 0) {
        await _writeBackup('auto', { projects: current, chatMap: chatMap });
      }
      await _set('gpm_projects', projects);
    });
  }

  async function createProject({ name, icon = '📁', color = '#8ab4f8', parentId = null }) {
    const projects = await getProjects();
    const id = generateUid();
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
    return _withLock(async () => {
      const projects = await getProjects();
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      Object.assign(projects[idx], updates);
      await _set('gpm_projects', projects);
      return projects[idx];
    });
  }

  async function deleteProject(id) {
    return _withLock(async () => {
      const projects = await getProjects();
      const chatMap = await getChatMap();

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

      for (const [chatId, mapping] of Object.entries(chatMap)) {
        if (toDelete.has(mapping.projectId)) {
          delete chatMap[chatId];
        }
      }

      const target = projects.find((p) => p.id === id);
      if (target?.parentId) {
        const parent = projects.find((p) => p.id === target.parentId);
        if (parent) parent.children = parent.children.filter((c) => c !== id);
      }

      const filtered = projects.filter((p) => !toDelete.has(p.id));
      await _saveAtomic(filtered, chatMap);
    });
  }

  function getRootProjects(projects) {
    return projects.filter((p) => !p.parentId);
  }

  async function getChatMap() {
    return (await _get('gpm_chatMap')) || {};
  }

  async function saveChatMap(map) {
    return _withLock(async () => {
      const current = await _get('gpm_chatMap');
      const projects = await _get('gpm_projects');
      if (current && Object.keys(current).length > 0) {
        await _writeBackup('auto', { projects: projects, chatMap: current });
      }
      await _set('gpm_chatMap', map);
    });
  }

  async function assignChat(chatId, projectId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      const projects = await getProjects();

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

      const newProj = projects.find((p) => p.id === projectId);
      if (newProj && !(newProj.chatIds || []).includes(chatId)) {
        if (!newProj.chatIds) newProj.chatIds = [];
        newProj.chatIds.push(chatId);
      }

      await _saveAtomic(projects, chatMap);
    });
  }

  async function unassignChat(chatId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      const projects = await getProjects();

      if (chatMap[chatId]) {
        const proj = projects.find((p) => p.id === chatMap[chatId].projectId);
        if (proj) proj.chatIds = (proj.chatIds || []).filter((c) => c !== chatId);
        delete chatMap[chatId];
      }

      await _saveAtomic(projects, chatMap);
    });
  }

  async function setChatAlias(chatId, alias) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      if (chatMap[chatId]) {
        chatMap[chatId].alias = alias;
        chatMap[chatId]._autoResolved = false;
        await _set('gpm_chatMap', chatMap);
      }
    });
  }

  async function togglePinChat(chatId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      if (chatMap[chatId]) {
        chatMap[chatId].pinned = !chatMap[chatId].pinned;
        await _set('gpm_chatMap', chatMap);
        return chatMap[chatId].pinned;
      }
      return false;
    });
  }

  async function getQuickPrompts() {
    return (await _get('gpm_quickPrompts')) || [];
  }

  async function saveQuickPrompt({ title, content, category = 'General' }) {
    const prompts = await getQuickPrompts();
    prompts.push({ id: generateUid(), title, content, category });
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

  async function toggleStarChat(chatId) {
    return _withLock(async () => {
      const chatMap = await getChatMap();
      if (!chatMap[chatId]) return null;
      chatMap[chatId].starredAt = chatMap[chatId].starredAt ? null : Date.now();
      await _set('gpm_chatMap', chatMap);
      return chatMap[chatId].starredAt;
    });
  }

  async function getStarredChats() {
    const chatMap = await getChatMap();
    return Object.entries(chatMap)
      .filter(([, mapping]) => mapping.starredAt)
      .sort((a, b) => b[1].starredAt - a[1].starredAt)
      .map(([chatId, mapping]) => ({ chatId, ...mapping }));
  }

  async function getSettings() {
    return (await _get('gpm_settings')) || { lang: 'en', theme: 'auto' };
  }

  async function saveSettings(settings) {
    await _set('gpm_settings', settings);
  }

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

  const validateImportData = GPMValidators.validateImportData;

  async function importAll(jsonString) {
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (e) {
      const msg = e.message || String(e);
      const match = msg.match(/position\s+(\d+)/i);
      const posHint = match ? ` (error near character ${match[1]})` : '';
      throw new Error(`Invalid JSON format${posHint}: ${msg}`);
    }

    const validatedImport = validateImportData(parsedData);
    if (!validatedImport.valid) {
      throw new Error(validatedImport.error || 'Invalid import data');
    }

    return _withLock(async () => {
      const [curProjects, curChatMap, curPrompts, curSettings] = await Promise.all([
        _get('gpm_projects'),
        _get('gpm_chatMap'),
        _get('gpm_quickPrompts'),
        _get('gpm_settings'),
      ]);

      await _writeBackup('pre_import', {
        projects: curProjects,
        chatMap: curChatMap,
        prompts: curPrompts,
        settings: curSettings,
      });

      await _setBulk({
        gpm_projects: validatedImport.data.gpm_projects,
        gpm_chatMap: validatedImport.data.gpm_chatMap,
        gpm_quickPrompts: validatedImport.data.gpm_quickPrompts,
        gpm_settings: validatedImport.data.gpm_settings,
      });
    });
  }

  async function clearAll() {
    return _withLock(async () => {
      await chrome.storage.local.set({
        gpm_projects: [],
        gpm_chatMap: {},
        gpm_quickPrompts: [],
        gpm_settings: { lang: 'en', theme: 'auto' },
      });
    });
  }

  async function getBackupInfo() {
    const backup = await _get('gpm_backup_current');
    if (!backup || !backup.timestamp) return null;
    const projects = backup.data?.projects || [];
    const chatMap = backup.data?.chatMap || {};
    const totalChats = projects.reduce((sum, p) => sum + (p.chatIds?.length || 0), 0);
    return {
      type: backup.type,
      timestamp: backup.timestamp,
      projectCount: projects.length,
      chatCount: totalChats,
      chatMapCount: Object.keys(chatMap).length,
    };
  }

  async function restoreFromBackup() {
    const backup = await _get('gpm_backup_current');
    if (!backup || !backup.data) return false;

    return _withLock(async () => {
      const [currentProjects, currentChatMap, currentPrompts, currentSettings] = await Promise.all([
        _get('gpm_projects'),
        _get('gpm_chatMap'),
        _get('gpm_quickPrompts'),
        _get('gpm_settings'),
      ]);

      await _writeBackup('pre_restore', {
        projects: currentProjects,
        chatMap: currentChatMap,
        prompts: currentPrompts,
        settings: currentSettings,
      });

      const d = backup.data;
      await _setBulk({
        gpm_projects: Array.isArray(d.projects) ? d.projects : [],
        gpm_chatMap: d.chatMap && typeof d.chatMap === 'object' ? d.chatMap : {},
        gpm_quickPrompts: Array.isArray(d.prompts) ? d.prompts : [],
        gpm_settings: d.settings && typeof d.settings === 'object' ? d.settings : { lang: 'en', theme: 'auto' },
      });

      gpmLog('Restored from backup (type:', backup.type, ')');
      return true;
    });
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
    toggleStarChat,
    getStarredChats,
    exportAll,
    importAll,
    clearAll,
    getBackupInfo,
    restoreFromBackup,
    _writeBackup,
  };
})();
