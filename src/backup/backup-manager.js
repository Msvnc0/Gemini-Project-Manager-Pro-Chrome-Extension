/**
 * backup-manager.js — Multiple Backup Version Manager
 *
 * Maintains last N backup versions with timestamps.
 * Provides compression for efficient storage.
 *
 * Backup triggers:
 *   - before_save: Before any data modification
 *   - before_import: Before importing data
 *   - before_delete: Before bulk deletions
 *   - manual: User-initiated backup
 *   - scheduled: Automatic periodic backup
 */

const GPMBackupManager = (() => {
  const MAX_VERSIONS = 5;
  const BACKUP_KEY = 'gpm_backups';
  const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  const TRIGGERS = {
    BEFORE_SAVE: 'before_save',
    BEFORE_IMPORT: 'before_import',
    BEFORE_DELETE: 'before_delete',
    BEFORE_RESTORE: 'before_restore',
    MANUAL: 'manual',
    SCHEDULED: 'scheduled',
    UPDATE: 'update',
  };

  function uid() {
    const timestamp = Date.now().toString(36);
    const random1 = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `${timestamp}-${random1}`;
  }

  async function createBackup(trigger = 'manual', description = '') {
    try {
      const [projects, chatMap, prompts, settings] = await Promise.all([
        GPMStorage.getProjects(),
        GPMStorage.getChatMap(),
        GPMStorage.getQuickPrompts(),
        GPMStorage.getSettings(),
      ]);

      const data = {
        projects,
        chatMap,
        prompts,
        settings,
      };

      const backup = {
        id: uid(),
        timestamp: Date.now(),
        trigger,
        description,
        data,
        stats: {
          projectCount: projects.length,
          chatCount: Object.keys(chatMap).length,
          promptCount: prompts.length,
        },
      };

      const backups = await getBackups();
      backups.push(backup);

      while (backups.length > MAX_VERSIONS) {
        backups.shift();
      }

      await chrome.storage.local.set({ [BACKUP_KEY]: backups });

      gpmLog('Backup created:', backup.id, 'trigger:', trigger, 'stats:', backup.stats);
      return backup;
    } catch (e) {
      gpmError('Failed to create backup:', e);
      return null;
    }
  }

  async function getBackups() {
    try {
      const { [BACKUP_KEY]: backups = [] } = await chrome.storage.local.get(BACKUP_KEY);
      return backups;
    } catch (e) {
      gpmError('Failed to get backups:', e);
      return [];
    }
  }

  async function getBackup(backupId) {
    const backups = await getBackups();
    return backups.find((b) => b.id === backupId) || null;
  }

  async function restoreBackup(backupId) {
    try {
      const backup = await getBackup(backupId);
      if (!backup) {
        gpmError('Backup not found:', backupId);
        return false;
      }

      await createBackup(TRIGGERS.BEFORE_RESTORE, 'Auto-backup before restore');

      const data = backup.data;

      if (data.projects) {
        await GPMStorage.saveProjects(data.projects);
      }
      if (data.chatMap) {
        await GPMStorage.saveChatMap(data.chatMap);
      }
      if (data.prompts) {
        await chrome.storage.local.set({ gpm_quickPrompts: data.prompts });
      }
      if (data.settings) {
        await GPMStorage.saveSettings(data.settings);
      }

      gpmLog('Restored from backup:', backupId);
      return true;
    } catch (e) {
      gpmError('Failed to restore backup:', e);
      return false;
    }
  }

  async function deleteBackup(backupId) {
    try {
      const backups = await getBackups();
      const filtered = backups.filter((b) => b.id !== backupId);
      await chrome.storage.local.set({ [BACKUP_KEY]: filtered });
      gpmLog('Backup deleted:', backupId);
      return true;
    } catch (e) {
      gpmError('Failed to delete backup:', e);
      return false;
    }
  }

  async function autoBackupIfNeeded() {
    try {
      const backups = await getBackups();
      const lastBackup = backups[backups.length - 1];

      if (!lastBackup || Date.now() - lastBackup.timestamp > AUTO_BACKUP_INTERVAL) {
        return await createBackup(TRIGGERS.SCHEDULED, 'Daily auto-backup');
      }
      return null;
    } catch (e) {
      gpmError('Auto-backup failed:', e);
      return null;
    }
  }

  function formatBackupDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  return {
    MAX_VERSIONS,
    TRIGGERS,
    createBackup,
    getBackups,
    getBackup,
    restoreBackup,
    deleteBackup,
    autoBackupIfNeeded,
    formatBackupDate,
  };
})();
