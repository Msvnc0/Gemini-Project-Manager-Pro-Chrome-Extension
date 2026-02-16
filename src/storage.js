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
 */

const GPMStorage = (() => {
  // ── Helpers ──
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function _get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  }

  async function _set(key, value) {
    await chrome.storage.local.set({ [key]: value });
    try { chrome.runtime.sendMessage({ type: 'GPM_STORAGE_UPDATED' }); } catch (_) {}
  }

  // ── Projects ──
  async function getProjects() {
    return (await _get('gpm_projects')) || [];
  }

  async function saveProjects(projects) {
    await _set('gpm_projects', projects);
  }

  async function createProject({ name, icon = '📁', color = '#8ab4f8', parentId = null }) {
    const projects = await getProjects();
    const id = uid();
    const project = { id, name, icon, color, parentId, children: [], chatIds: [], collapsed: false };
    projects.push(project);

    if (parentId) {
      const parent = projects.find(p => p.id === parentId);
      if (parent) parent.children.push(id);
    }

    await saveProjects(projects);
    return project;
  }

  async function updateProject(id, updates) {
    const projects = await getProjects();
    const idx = projects.findIndex(p => p.id === id);
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
      const node = projects.find(p => p.id === pid);
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
    const target = projects.find(p => p.id === id);
    if (target?.parentId) {
      const parent = projects.find(p => p.id === target.parentId);
      if (parent) parent.children = parent.children.filter(c => c !== id);
    }

    projects = projects.filter(p => !toDelete.has(p.id));
    await saveProjects(projects);
    await saveChatMap(chatMap);
  }

  function getRootProjects(projects) {
    return projects.filter(p => !p.parentId);
  }

  function getChildren(projects, parentId) {
    return projects.filter(p => p.parentId === parentId);
  }

  // ── Chat Map ──
  async function getChatMap() {
    return (await _get('gpm_chatMap')) || {};
  }

  async function saveChatMap(map) {
    await _set('gpm_chatMap', map);
  }

  async function assignChat(chatId, projectId) {
    const chatMap = await getChatMap();
    const projects = await getProjects();

    // Remove from old project's chatIds
    if (chatMap[chatId]) {
      const oldProj = projects.find(p => p.id === chatMap[chatId].projectId);
      if (oldProj) oldProj.chatIds = oldProj.chatIds.filter(c => c !== chatId);
    }

    chatMap[chatId] = { projectId, alias: chatMap[chatId]?.alias || '', pinned: chatMap[chatId]?.pinned || false };

    // Add to new project's chatIds
    const newProj = projects.find(p => p.id === projectId);
    if (newProj && !newProj.chatIds.includes(chatId)) {
      newProj.chatIds.push(chatId);
    }

    await saveProjects(projects);
    await saveChatMap(chatMap);
  }

  async function unassignChat(chatId) {
    const chatMap = await getChatMap();
    const projects = await getProjects();

    if (chatMap[chatId]) {
      const proj = projects.find(p => p.id === chatMap[chatId].projectId);
      if (proj) proj.chatIds = proj.chatIds.filter(c => c !== chatId);
      delete chatMap[chatId];
    }

    await saveProjects(projects);
    await saveChatMap(chatMap);
  }

  async function setChatAlias(chatId, alias) {
    const chatMap = await getChatMap();
    if (chatMap[chatId]) {
      chatMap[chatId].alias = alias;
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
    prompts = prompts.filter(p => p.id !== id);
    await _set('gpm_quickPrompts', prompts);
  }

  async function updateQuickPrompt(id, updates) {
    const prompts = await getQuickPrompts();
    const idx = prompts.findIndex(p => p.id === id);
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
      getProjects(), getChatMap(), getQuickPrompts(), getSettings()
    ]);
    return JSON.stringify({ gpm_projects: projects, gpm_chatMap: chatMap, gpm_quickPrompts: quickPrompts, gpm_settings: settings }, null, 2);
  }

  async function importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (data.gpm_projects) await _set('gpm_projects', data.gpm_projects);
    if (data.gpm_chatMap) await _set('gpm_chatMap', data.gpm_chatMap);
    if (data.gpm_quickPrompts) await _set('gpm_quickPrompts', data.gpm_quickPrompts);
    if (data.gpm_settings) await _set('gpm_settings', data.gpm_settings);
  }

  async function clearAll() {
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
      gpm_pinnedChats: {}
    });
  }

  return {
    getProjects, saveProjects, createProject, updateProject, deleteProject,
    getRootProjects, getChildren,
    getChatMap, saveChatMap, assignChat, unassignChat, setChatAlias, togglePinChat,
    getQuickPrompts, saveQuickPrompt, deleteQuickPrompt, updateQuickPrompt,
    getSettings, saveSettings,
    exportAll, importAll, clearAll
  };
})();
