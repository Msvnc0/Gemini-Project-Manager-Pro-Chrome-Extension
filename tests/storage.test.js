/**
 * storage.test.js — Unit Tests for GPMStorage
 *
 * Target coverage: 90%+
 * Tests: uid(), createProject(), deleteProject(), assignChat(), unassignChat(),
 *        importAll(), exportAll(), round-trip integrity, _withLock(), auto-backup
 */

import { resetMockStorage, getMockStorage, setMockStorage } from './mocks/chrome.js';

// Load validators.js and storage.js — they define globals as IIFEs
// We need to eval them since they're not ES modules
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load and execute validators.js first (storage.js depends on it)
const validatorsCode = readFileSync(resolve('src/utils/validators.js'), 'utf-8');
const patchedValidators = validatorsCode.replace(/^const GPMValidators\s*=/m, 'globalThis.GPMValidators =');
new Function(patchedValidators)();

// Provide generateUid global (defined in config.js, used by storage.js)
globalThis.generateUid = function () {
  const timestamp = Date.now().toString(36);
  const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const random2 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${timestamp}-${random1}-${random2}`;
};

globalThis.gpmLog = (..._args) => {};
globalThis.gpmWarn = (..._args) => {};
globalThis.gpmError = (..._args) => {};

// Load and execute storage.js
const storageCode = readFileSync(resolve('src/storage.js'), 'utf-8');
const patchedCode = storageCode.replace(/^const GPMStorage\s*=/m, 'globalThis.GPMStorage =');
new Function(patchedCode)();
const GPMStorage = globalThis.GPMStorage;

describe('Schema Migration v5', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it('should migrate from v2 to v5', async () => {
    setMockStorage({
      gpm_schemaVersion: 2,
      gpm_projects: [{ id: 'p1', name: 'Test' }],
    });

    await GPMStorage.initializeStorage();

    const storage = getMockStorage();
    expect(storage.gpm_schemaVersion).toBe(5);
    expect(storage.gpm_tags).toBeUndefined();
  });

  it('should add starredAt and remove tags from chatMap entries', async () => {
    setMockStorage({
      gpm_schemaVersion: 2,
      gpm_chatMap: {
        chat1: { projectId: 'p1', alias: '', pinned: false, tags: ['tag1'] },
      },
      gpm_tags: { tag1: 'Tag 1' },
    });

    await GPMStorage.initializeStorage();

    const storage = getMockStorage();
    expect(storage.gpm_chatMap['chat1'].starredAt).toBeNull();
    expect(storage.gpm_chatMap['chat1'].tags).toBeUndefined();
    expect(storage.gpm_tags).toBeUndefined();
  });

  it('should remove legacy backup keys on v5 migration', async () => {
    setMockStorage({
      gpm_schemaVersion: 4,
      gpm_projects: [{ id: 'p1', name: 'Test' }],
      gpm_projects_backup: [{ id: 'old', name: 'Old' }],
      gpm_backup_ts: Date.now(),
      gpm_chatMap_backup: {},
      gpm_pre_import_projects: [],
      gpm_pre_import_ts: Date.now(),
      gpm_update_backup: {},
      gpm_emergency_backup_before_reset: {},
      gpm_backups: [{ id: 'bk1', ts: Date.now() }],
    });

    await GPMStorage.initializeStorage();

    const storage = getMockStorage();
    expect(storage.gpm_schemaVersion).toBe(5);
    expect(storage.gpm_projects_backup).toBeUndefined();
    expect(storage.gpm_backup_ts).toBeUndefined();
    expect(storage.gpm_chatMap_backup).toBeUndefined();
    expect(storage.gpm_pre_import_projects).toBeUndefined();
    expect(storage.gpm_pre_import_ts).toBeUndefined();
    expect(storage.gpm_update_backup).toBeUndefined();
    expect(storage.gpm_emergency_backup_before_reset).toBeUndefined();
    expect(storage.gpm_backups).toEqual([{ id: 'bk1', ts: expect.any(Number) }]);
  });
});

describe('GPMStorage', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  // ══════════════════════════════════════
  //  uid() — Uniqueness Tests
  // ══════════════════════════════════════

  describe('uid() uniqueness', () => {
    it('should generate unique IDs across 1000 calls', async () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        const project = await GPMStorage.createProject({ name: `P${i}` });
        ids.add(project.id);
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate non-empty string IDs', async () => {
      const project = await GPMStorage.createProject({ name: 'Test' });
      expect(typeof project.id).toBe('string');
      expect(project.id.length).toBeGreaterThan(0);
    });
  });

  // ══════════════════════════════════════
  //  createProject() Tests
  // ══════════════════════════════════════

  describe('createProject()', () => {
    it('should create a project with correct structure', async () => {
      const project = await GPMStorage.createProject({
        name: 'My Project',
        icon: '💻',
        color: '#81c995',
      });

      expect(project).toMatchObject({
        name: 'My Project',
        icon: '💻',
        color: '#81c995',
        parentId: null,
        children: [],
        chatIds: [],
        collapsed: false,
      });
      expect(project.id).toBeDefined();
    });

    it('should use default icon and color when not provided', async () => {
      const project = await GPMStorage.createProject({ name: 'Defaults' });
      expect(project.icon).toBe('📁');
      expect(project.color).toBe('#8ab4f8');
    });

    it('should persist project to storage', async () => {
      await GPMStorage.createProject({ name: 'Persisted' });
      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Persisted');
    });

    it('should create a child project with parentId', async () => {
      const parent = await GPMStorage.createProject({ name: 'Parent' });
      const child = await GPMStorage.createProject({ name: 'Child', parentId: parent.id });

      expect(child.parentId).toBe(parent.id);

      const projects = await GPMStorage.getProjects();
      const updatedParent = projects.find((p) => p.id === parent.id);
      expect(updatedParent.children).toContain(child.id);
    });

    it('should handle multiple projects', async () => {
      await GPMStorage.createProject({ name: 'A' });
      await GPMStorage.createProject({ name: 'B' });
      await GPMStorage.createProject({ name: 'C' });

      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(3);
    });
  });

  // ══════════════════════════════════════
  //  updateProject() Tests
  // ══════════════════════════════════════

  describe('updateProject()', () => {
    it('should update project name', async () => {
      const project = await GPMStorage.createProject({ name: 'Original' });
      await GPMStorage.updateProject(project.id, { name: 'Updated' });

      const projects = await GPMStorage.getProjects();
      expect(projects[0].name).toBe('Updated');
    });

    it('should return null for non-existent project', async () => {
      const result = await GPMStorage.updateProject('nonexistent', { name: 'X' });
      expect(result).toBeNull();
    });

    it('should preserve other fields when updating', async () => {
      const project = await GPMStorage.createProject({ name: 'Test', icon: '💻', color: '#ff0000' });
      await GPMStorage.updateProject(project.id, { name: 'Updated' });

      const projects = await GPMStorage.getProjects();
      expect(projects[0].icon).toBe('💻');
      expect(projects[0].color).toBe('#ff0000');
    });
  });

  // ══════════════════════════════════════
  //  deleteProject() — Cascade Tests
  // ══════════════════════════════════════

  describe('deleteProject()', () => {
    it('should remove the project from storage', async () => {
      const project = await GPMStorage.createProject({ name: 'ToDelete' });
      await GPMStorage.deleteProject(project.id);

      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('should cascade-delete child projects', async () => {
      const parent = await GPMStorage.createProject({ name: 'Parent' });
      await GPMStorage.createProject({ name: 'Child', parentId: parent.id });

      await GPMStorage.deleteProject(parent.id);

      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('should cascade-delete grandchild projects', async () => {
      const root = await GPMStorage.createProject({ name: 'Root' });
      const child = await GPMStorage.createProject({ name: 'Child', parentId: root.id });
      await GPMStorage.createProject({ name: 'Grandchild', parentId: child.id });

      await GPMStorage.deleteProject(root.id);

      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('should clean up chatMap for deleted projects', async () => {
      const project = await GPMStorage.createProject({ name: 'WithChat' });
      await GPMStorage.assignChat('chat-1', project.id);

      await GPMStorage.deleteProject(project.id);

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1']).toBeUndefined();
    });

    it('should remove from parent children array', async () => {
      const parent = await GPMStorage.createProject({ name: 'Parent' });
      const child = await GPMStorage.createProject({ name: 'Child', parentId: parent.id });

      await GPMStorage.deleteProject(child.id);

      const projects = await GPMStorage.getProjects();
      const updatedParent = projects.find((p) => p.id === parent.id);
      expect(updatedParent.children).not.toContain(child.id);
    });

    it('should not affect sibling projects', async () => {
      const parent = await GPMStorage.createProject({ name: 'Parent' });
      const child1 = await GPMStorage.createProject({ name: 'Child1', parentId: parent.id });
      const child2 = await GPMStorage.createProject({ name: 'Child2', parentId: parent.id });

      await GPMStorage.deleteProject(child1.id);

      const projects = await GPMStorage.getProjects();
      expect(projects.find((p) => p.id === child2.id)).toBeDefined();
      expect(projects).toHaveLength(2); // parent + child2
    });
  });

  // ══════════════════════════════════════
  //  getRootProjects() Tests
  // ══════════════════════════════════════

  describe('getRootProjects()', () => {
    it('should return only root-level projects', async () => {
      const root1 = await GPMStorage.createProject({ name: 'Root1' });
      const root2 = await GPMStorage.createProject({ name: 'Root2' });
      await GPMStorage.createProject({ name: 'Child', parentId: root1.id });

      const projects = await GPMStorage.getProjects();
      const roots = GPMStorage.getRootProjects(projects);

      expect(roots).toHaveLength(2);
      expect(roots.map((r) => r.id)).toContain(root1.id);
      expect(roots.map((r) => r.id)).toContain(root2.id);
    });

    it('should return empty array if no projects', () => {
      const roots = GPMStorage.getRootProjects([]);
      expect(roots).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════
  //  assignChat() / unassignChat() Tests
  // ══════════════════════════════════════

  describe('assignChat()', () => {
    it('should assign a chat to a project', async () => {
      const project = await GPMStorage.createProject({ name: 'Target' });
      await GPMStorage.assignChat('chat-1', project.id);

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1']).toBeDefined();
      expect(chatMap['chat-1'].projectId).toBe(project.id);
    });

    it('should add chatId to project chatIds array', async () => {
      const project = await GPMStorage.createProject({ name: 'Target' });
      await GPMStorage.assignChat('chat-1', project.id);

      const projects = await GPMStorage.getProjects();
      const updated = projects.find((p) => p.id === project.id);
      expect(updated.chatIds).toContain('chat-1');
    });

    it('should move chat from old project to new project', async () => {
      const proj1 = await GPMStorage.createProject({ name: 'Old' });
      const proj2 = await GPMStorage.createProject({ name: 'New' });

      await GPMStorage.assignChat('chat-1', proj1.id);
      await GPMStorage.assignChat('chat-1', proj2.id);

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].projectId).toBe(proj2.id);

      const projects = await GPMStorage.getProjects();
      const old = projects.find((p) => p.id === proj1.id);
      const newP = projects.find((p) => p.id === proj2.id);
      expect(old.chatIds).not.toContain('chat-1');
      expect(newP.chatIds).toContain('chat-1');
    });

    it('should preserve alias when reassigning', async () => {
      const proj1 = await GPMStorage.createProject({ name: 'P1' });
      const proj2 = await GPMStorage.createProject({ name: 'P2' });

      await GPMStorage.assignChat('chat-1', proj1.id);
      await GPMStorage.setChatAlias('chat-1', 'My Chat');
      await GPMStorage.assignChat('chat-1', proj2.id);

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].alias).toBe('My Chat');
    });
  });

  describe('unassignChat()', () => {
    it('should remove chat from chatMap', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.unassignChat('chat-1');

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1']).toBeUndefined();
    });

    it('should remove chatId from project chatIds', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.unassignChat('chat-1');

      const projects = await GPMStorage.getProjects();
      expect(projects[0].chatIds).not.toContain('chat-1');
    });

    it('should handle unassigning non-existent chat gracefully', async () => {
      await GPMStorage.unassignChat('nonexistent');
      const chatMap = await GPMStorage.getChatMap();
      expect(Object.keys(chatMap)).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════
  //  setChatAlias() / togglePinChat()
  // ══════════════════════════════════════

  describe('setChatAlias()', () => {
    it('should set alias for assigned chat', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.setChatAlias('chat-1', 'Custom Name');

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-1'].alias).toBe('Custom Name');
    });
  });

  describe('togglePinChat()', () => {
    it('should toggle pin state', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);

      const pinned1 = await GPMStorage.togglePinChat('chat-1');
      expect(pinned1).toBe(true);

      const pinned2 = await GPMStorage.togglePinChat('chat-1');
      expect(pinned2).toBe(false);
    });

    it('should return false for non-existent chat', async () => {
      const result = await GPMStorage.togglePinChat('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ══════════════════════════════════════
  //  Quick Prompts Tests
  // ══════════════════════════════════════

  describe('Quick Prompts', () => {
    it('should save and retrieve quick prompts', async () => {
      await GPMStorage.saveQuickPrompt({ title: 'Test', content: 'Hello', category: 'General' });
      const prompts = await GPMStorage.getQuickPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('Test');
      expect(prompts[0].content).toBe('Hello');
    });

    it('should delete a quick prompt by id', async () => {
      await GPMStorage.saveQuickPrompt({ title: 'A', content: 'a' });
      const prompts = await GPMStorage.getQuickPrompts();
      await GPMStorage.deleteQuickPrompt(prompts[0].id);

      const updated = await GPMStorage.getQuickPrompts();
      expect(updated).toHaveLength(0);
    });

    it('should update a quick prompt', async () => {
      await GPMStorage.saveQuickPrompt({ title: 'Original', content: 'old' });
      const prompts = await GPMStorage.getQuickPrompts();
      await GPMStorage.updateQuickPrompt(prompts[0].id, { title: 'Updated', content: 'new' });

      const updated = await GPMStorage.getQuickPrompts();
      expect(updated[0].title).toBe('Updated');
      expect(updated[0].content).toBe('new');
    });

    it('should use default category "General"', async () => {
      await GPMStorage.saveQuickPrompt({ title: 'T', content: 'C' });
      const prompts = await GPMStorage.getQuickPrompts();
      expect(prompts[0].category).toBe('General');
    });
  });

  // ══════════════════════════════════════
  //  Settings Tests
  // ══════════════════════════════════════

  describe('Settings', () => {
    it('should return default settings when none saved', async () => {
      const settings = await GPMStorage.getSettings();
      expect(settings).toEqual({ lang: 'en', theme: 'auto' });
    });

    it('should save and retrieve settings', async () => {
      await GPMStorage.saveSettings({ lang: 'tr', theme: 'dark' });
      const settings = await GPMStorage.getSettings();
      expect(settings).toEqual({ lang: 'tr', theme: 'dark' });
    });
  });

  // ══════════════════════════════════════
  //  exportAll() / importAll() — Round-trip Tests
  // ══════════════════════════════════════

  describe('exportAll() / importAll()', () => {
    it('should export all data as JSON', async () => {
      await GPMStorage.createProject({ name: 'Export Test' });
      await GPMStorage.saveSettings({ lang: 'de', theme: 'light' });

      const json = await GPMStorage.exportAll();
      const data = JSON.parse(json);

      expect(data.gpm_projects).toHaveLength(1);
      expect(data.gpm_projects[0].name).toBe('Export Test');
      expect(data.gpm_settings.lang).toBe('de');
      expect(data.gpm_chatMap).toBeDefined();
      expect(data.gpm_quickPrompts).toBeDefined();
    });

    it('should round-trip export → import correctly', async () => {
      // Create data
      const proj = await GPMStorage.createProject({ name: 'Round Trip', icon: '🎯', color: '#ff0000' });
      await GPMStorage.assignChat('chat-rt', proj.id);
      await GPMStorage.setChatAlias('chat-rt', 'My Chat');
      await GPMStorage.saveQuickPrompt({ title: 'QP', content: 'Test prompt' });
      await GPMStorage.saveSettings({ lang: 'fr', theme: 'dark' });

      // Export
      const json = await GPMStorage.exportAll();

      // Clear everything
      await GPMStorage.clearAll();
      let projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(0);

      // Import
      await GPMStorage.importAll(json);

      // Verify
      projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Round Trip');
      expect(projects[0].icon).toBe('🎯');

      const chatMap = await GPMStorage.getChatMap();
      expect(chatMap['chat-rt']).toBeDefined();
      expect(chatMap['chat-rt'].alias).toBe('My Chat');

      const settings = await GPMStorage.getSettings();
      expect(settings.lang).toBe('fr');
    });

    it('should create pre-import backup', async () => {
      const project = await GPMStorage.createProject({ name: 'Original' });

      const json = JSON.stringify({
        gpm_projects: [
          {
            id: 'imported',
            name: 'Imported',
            icon: '📁',
            color: '#000',
            parentId: null,
            children: [],
            chatIds: [],
            collapsed: false,
          },
        ],
      });

      await GPMStorage.importAll(json);

      const storage = getMockStorage();
      expect(storage.gpm_backup_current).toBeDefined();
      expect(storage.gpm_backup_current.type).toBe('pre_import');
      expect(storage.gpm_backup_current.timestamp).toBeDefined();
    });

    it('should validate and sanitize imported data', async () => {
      const maliciousJson = JSON.stringify({
        gpm_projects: [
          {
            id: 'safe',
            name: 'Safe<script>',
            icon: '📁',
            color: '#8ab4f8',
            parentId: null,
            children: [],
            chatIds: [],
            collapsed: false,
          },
          { id: '', name: '', icon: '📁', color: '#000' }, // invalid: empty id/name
          null, // invalid
        ],
        gpm_settings: { lang: 'invalid', theme: 'invalid' },
      });

      await GPMStorage.importAll(maliciousJson);

      const projects = await GPMStorage.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Safescript'); // sanitized

      const settings = await GPMStorage.getSettings();
      expect(settings.lang).toBe('en'); // fallback
      expect(settings.theme).toBe('auto'); // fallback
    });
  });

  // ══════════════════════════════════════
  //  clearAll() Tests
  // ══════════════════════════════════════

  describe('clearAll()', () => {
    it('should clear all data', async () => {
      await GPMStorage.createProject({ name: 'Temp' });
      await GPMStorage.saveQuickPrompt({ title: 'QP', content: 'x' });
      await GPMStorage.saveSettings({ lang: 'tr', theme: 'dark' });

      await GPMStorage.clearAll();

      const projects = await GPMStorage.getProjects();
      const prompts = await GPMStorage.getQuickPrompts();
      const settings = await GPMStorage.getSettings();

      expect(projects).toHaveLength(0);
      expect(prompts).toHaveLength(0);
      expect(settings).toEqual({ lang: 'en', theme: 'auto' });
    });
  });

  // ══════════════════════════════════════
  //  Auto-backup Tests
  // ══════════════════════════════════════

  describe('Auto-backup', () => {
    it('should create backup on saveProjects()', async () => {
      await GPMStorage.createProject({ name: 'V1' });

      const projects = await GPMStorage.getProjects();
      projects[0].name = 'V2';
      await GPMStorage.saveProjects(projects);

      const storage = getMockStorage();
      expect(storage.gpm_backup_current).toBeDefined();
      expect(storage.gpm_backup_current.type).toBe('auto');
      expect(storage.gpm_backup_current.data.projects[0].name).toBe('V1');
      expect(storage.gpm_backup_current.timestamp).toBeDefined();
    });

    it('should create backup on saveChatMap()', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);

      const chatMap = await GPMStorage.getChatMap();
      chatMap['chat-2'] = { projectId: project.id, alias: '', pinned: false };
      await GPMStorage.saveChatMap(chatMap);

      const storage = getMockStorage();
      expect(storage.gpm_backup_current).toBeDefined();
    });
  });

  // ══════════════════════════════════════
  //  Backup / Restore Tests
  // ══════════════════════════════════════

  describe('Backup / Restore', () => {
    it('should return backup info', async () => {
      await GPMStorage.createProject({ name: 'P1' });
      // Force a backup by saving again
      const projects = await GPMStorage.getProjects();
      await GPMStorage.saveProjects(projects);

      const info = await GPMStorage.getBackupInfo();
      expect(info).toBeDefined();
      expect(info.projectCount).toBe(1);
      expect(info.timestamp).toBeDefined();
    });

    it('should return null when no backup exists', async () => {
      const info = await GPMStorage.getBackupInfo();
      expect(info).toBeNull();
    });

    it('should restore from backup', async () => {
      // Create V1
      await GPMStorage.createProject({ name: 'V1' });

      // Create V2 (triggers backup of V1)
      const projects = await GPMStorage.getProjects();
      projects[0].name = 'V2';
      await GPMStorage.saveProjects(projects);

      // Restore
      const ok = await GPMStorage.restoreFromBackup();
      expect(ok).toBe(true);

      const restored = await GPMStorage.getProjects();
      expect(restored[0].name).toBe('V1');
    });

    it('should return false when no backup available', async () => {
      const ok = await GPMStorage.restoreFromBackup();
      expect(ok).toBe(false);
    });
  });

  // ══════════════════════════════════════
  //  Tags Tests
  // ══════════════════════════════════════

  describe('Starred Chats', () => {
    it('should toggle star on a chat', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);

      const starredAt = await GPMStorage.toggleStarChat('chat-1');
      expect(starredAt).toBeTruthy();

      const unstarred = await GPMStorage.toggleStarChat('chat-1');
      expect(unstarred).toBeNull();
    });

    it('should return null for non-existent chat when toggling star', async () => {
      const result = await GPMStorage.toggleStarChat('nonexistent');
      expect(result).toBeNull();
    });

    it('should get starred chats sorted by starredAt', async () => {
      const project = await GPMStorage.createProject({ name: 'P' });
      await GPMStorage.assignChat('chat-1', project.id);
      await GPMStorage.assignChat('chat-2', project.id);

      await GPMStorage.toggleStarChat('chat-1');
      await new Promise((r) => setTimeout(r, 10));
      await GPMStorage.toggleStarChat('chat-2');

      const starred = await GPMStorage.getStarredChats();
      expect(starred).toHaveLength(2);
      expect(starred[0].chatId).toBe('chat-2');
      expect(starred[1].chatId).toBe('chat-1');
    });
  });

  // ══════════════════════════════════════
  //  Concurrent Writes (_withLock) Tests
  // ══════════════════════════════════════

  describe('_withLock (concurrent writes)', () => {
    it('should serialize concurrent assignChat calls', async () => {
      const project = await GPMStorage.createProject({ name: 'Concurrent' });

      // Fire multiple assignments concurrently
      await Promise.all([
        GPMStorage.assignChat('c1', project.id),
        GPMStorage.assignChat('c2', project.id),
        GPMStorage.assignChat('c3', project.id),
      ]);

      const chatMap = await GPMStorage.getChatMap();
      expect(Object.keys(chatMap)).toHaveLength(3);

      const projects = await GPMStorage.getProjects();
      const p = projects.find((pr) => pr.id === project.id);
      expect(p.chatIds).toContain('c1');
      expect(p.chatIds).toContain('c2');
      expect(p.chatIds).toContain('c3');
    });
  });
});
