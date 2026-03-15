/**
 * storage.js — Data Layer
 * Manages recursive project trees, chat mappings, quick prompts, and settings.
 *
 * Data Schema:
 *   gpm_projects: Array<Project>
 *   Project: { id, name, icon, color, parentId: null|string, children: string[], chatIds: string[], collapsed: bool }
 *   gpm_chatMap: { [chatId]: { projectId, alias, pinned } }
 *   gpm_quickPrompts: Array<{ id, title, content, category }>
 *   gpm_settings: { lang, theme }
 *   gpm_projects_backup: Array<Project>  — auto-backup before each save
 *   gpm_chatMap_backup: { [chatId]: ... } — auto-backup before each save
 */

const GPMStorage = (() => {
  // ── Helpers ──
  function uid() {
    const arr = crypto.getRandomValues(new Uint32Array(2));
    return arr[0].toString(36) + arr[1].toString(36) + Date.now().toString(36);
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

  // ── Settings ──
  async function getSettings() {
    return (await _get('gpm_settings')) || { lang: 'en', theme: 'auto' };
  }

  async function saveSettings(settings) {
    await _set('gpm_settings', settings);
  }

  // ── Import / Export ──
  async function exportAll() {
    const [projects, chatMap, quickPrompts, settings] = await Promise.all([
      getProjects(),
      getChatMap(),
      getQuickPrompts(),
      getSettings(),
    ]);
    return JSON.stringify(
      { gpm_projects: projects, gpm_chatMap: chatMap, gpm_quickPrompts: quickPrompts, gpm_settings: settings },
      null,
      2
    );
  }

  // ── Validation & Sanitization Helpers ──
  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
  }

  function validateProject(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.id !== 'string' || !p.id) return null;
    if (typeof p.name !== 'string' || !p.name) return null;
    return {
      id: sanitizeString(p.id),
      name: sanitizeString(p.name),
      icon: typeof p.icon === 'string' ? p.icon.slice(0, 8) : '📁',
      color: typeof p.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#8ab4f8',
      parentId: typeof p.parentId === 'string' ? sanitizeString(p.parentId) : null,
      children: Array.isArray(p.children) ? p.children.filter((c) => typeof c === 'string').map(sanitizeString) : [],
      chatIds: Array.isArray(p.chatIds) ? p.chatIds.filter((c) => typeof c === 'string').map(sanitizeString) : [],
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : false,
      order: typeof p.order === 'number' ? p.order : undefined,
    };
  }

  function validateChatMapping(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.projectId !== 'string') return null;
    return {
      projectId: sanitizeString(entry.projectId),
      alias: typeof entry.alias === 'string' ? sanitizeString(entry.alias) : '',
      pinned: typeof entry.pinned === 'boolean' ? entry.pinned : false,
    };
  }

  function validateQuickPrompt(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.title !== 'string' || !p.title) return null;
    if (typeof p.content !== 'string' || !p.content) return null;
    return {
      id: typeof p.id === 'string' ? sanitizeString(p.id) : uid(),
      title: sanitizeString(p.title),
      content: sanitizeString(p.content),
      category: typeof p.category === 'string' ? sanitizeString(p.category) : 'General',
    };
  }

  function validateSettings(s) {
    if (!s || typeof s !== 'object') return null;
    const validLangs = [
      'ar',
      'bn',
      'de',
      'en',
      'es',
      'fr',
      'hi',
      'id',
      'it',
      'ja',
      'ko',
      'pt',
      'ru',
      'th',
      'tr',
      'vi',
      'zh-CN',
    ];
    const validThemes = ['auto', 'dark', 'light'];
    return {
      lang: validLangs.includes(s.lang) ? s.lang : 'en',
      theme: validThemes.includes(s.theme) ? s.theme : 'auto',
    };
  }

  async function importAll(jsonString) {
    const data = JSON.parse(jsonString);

    // Pre-import backup of current data
    const [curProjects, curChatMap, curPrompts] = await Promise.all([
      _get('gpm_projects'),
      _get('gpm_chatMap'),
      _get('gpm_quickPrompts'),
    ]);
    await chrome.storage.local.set({
      gpm_pre_import_projects: curProjects || [],
      gpm_pre_import_chatMap: curChatMap || {},
      gpm_pre_import_quickPrompts: curPrompts || [],
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
  }

  async function clearAll() {
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
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
    exportAll,
    importAll,
    clearAll,
    getBackupInfo,
    restoreFromBackup,
  };
})();
