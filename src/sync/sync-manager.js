/**
 * sync-manager.js — Cross-Device Synchronization Manager
 *
 * Manages sync metadata across devices using chrome.storage.sync.
 * Full data stays in chrome.storage.local (unlimited), but metadata
 * (last modified, device ID, version) syncs across devices.
 *
 * Conflict Detection:
 *   - Compares local lastModified with sync lastModified
 *   - If remote is newer, shows conflict dialog
 *   - User chooses: keep local, accept remote, or merge
 */

const GPMSyncManager = (() => {
  const SYNC_META_KEY = 'gpm_syncMeta';
  const SYNC_INTERVAL = 30000; // 30 seconds

  let syncTimer = null;
  let lastSyncTime = 0;

  async function getDeviceId() {
    let { gpm_deviceId } = await chrome.storage.local.get('gpm_deviceId');
    if (!gpm_deviceId) {
      gpm_deviceId = crypto.randomUUID();
      await chrome.storage.local.set({ gpm_deviceId });
    }
    return gpm_deviceId;
  }

  async function getLocalMeta() {
    const meta = await chrome.storage.local.get('gpm_localMeta');
    return (
      meta.gpm_localMeta || {
        lastModified: 0,
        deviceId: await getDeviceId(),
        version: 0,
      }
    );
  }

  async function updateLocalMeta() {
    const meta = {
      lastModified: Date.now(),
      deviceId: await getDeviceId(),
      version: await calculateDataVersion(),
    };
    await chrome.storage.local.set({ gpm_localMeta: meta });
    return meta;
  }

  async function getSyncMeta() {
    try {
      const result = await chrome.storage.sync.get(SYNC_META_KEY);
      return result[SYNC_META_KEY] || null;
    } catch (e) {
      gpmWarn('[GPM Sync] Could not read sync meta:', e);
      return null;
    }
  }

  async function setSyncMeta(meta) {
    try {
      await chrome.storage.sync.set({ [SYNC_META_KEY]: meta });
      return true;
    } catch (e) {
      gpmError('[GPM Sync] Could not write sync meta:', e);
      return false;
    }
  }

  async function calculateDataVersion() {
    const [projects, chatMap, prompts] = await Promise.all([
      GPMStorage.getProjects(),
      GPMStorage.getChatMap(),
      GPMStorage.getQuickPrompts(),
    ]);

    const projectCount = projects.length;
    const chatCount = Object.keys(chatMap).length;
    const promptCount = prompts.length;

    const projectHash = projects.reduce((h, p) => h ^ (p.id.length + (p.chatIds || []).length), 0);
    return `${projectCount}-${chatCount}-${promptCount}-${projectHash}`;
  }

  async function checkForConflicts() {
    const localMeta = await getLocalMeta();
    const syncMeta = await getSyncMeta();

    if (!syncMeta) {
      return { hasConflict: false };
    }

    if (syncMeta.deviceId === localMeta.deviceId) {
      return { hasConflict: false };
    }

    if (syncMeta.lastModified > localMeta.lastModified) {
      return {
        hasConflict: true,
        remoteDevice: syncMeta.deviceId,
        remoteTime: syncMeta.lastModified,
        localTime: localMeta.lastModified,
        remoteVersion: syncMeta.version,
      };
    }

    return { hasConflict: false };
  }

  async function syncPush() {
    try {
      const localMeta = await updateLocalMeta();
      await setSyncMeta(localMeta);
      lastSyncTime = Date.now();
      gpmLog('[GPM Sync] Pushed local meta to sync storage');
      return true;
    } catch (e) {
      gpmError('[GPM Sync] Push failed:', e);
      return false;
    }
  }

  async function startAutoSync() {
    if (syncTimer) return;

    syncTimer = setInterval(async () => {
      if (!gpmIsContextValid()) {
        stopAutoSync();
        return;
      }

      const conflict = await checkForConflicts();
      if (conflict.hasConflict) {
        gpmLog('[GPM Sync] Conflict detected during auto-sync');
        if (typeof GPMUI !== 'undefined' && GPM_STATE.modalRoot) {
          showConflictNotification(conflict);
        }
      } else {
        await syncPush();
      }
    }, SYNC_INTERVAL);

    gpmLog('[GPM Sync] Auto-sync started');
  }

  function stopAutoSync() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
      gpmLog('[GPM Sync] Auto-sync stopped');
    }
  }

  function showConflictNotification(conflict) {
    if (!GPM_STATE.modalRoot) return;

    GPMUI.showAlertDialog(GPM_STATE.modalRoot, {
      title: t('syncConflict') || 'Sync Conflict',
      message: (
        t('syncConflictMessage') ||
        'Your data was modified on another device ({time}). Reload to see the latest changes.'
      ).replace('{time}', new Date(conflict.remoteTime).toLocaleString()),
    });
  }

  return {
    getDeviceId,
    getLocalMeta,
    getSyncMeta,
    setSyncMeta,
    checkForConflicts,
    syncPush,
    startAutoSync,
    stopAutoSync,
  };
})();
