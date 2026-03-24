/**
 * conflict-resolver.js — Data Conflict Resolution
 *
 * Handles conflicts when data differs between devices.
 * Provides UI for user to choose resolution strategy.
 *
 * Resolution Strategies:
 *   1. Keep Local - Ignore remote changes
 *   2. Accept Remote - Load remote data (from backup)
 *   3. Merge - Combine local and remote (advanced)
 */

const GPMConflictResolver = (() => {
  async function resolveConflict(conflictInfo) {
    if (!GPM_STATE.modalRoot) {
      return { strategy: 'keep_local' };
    }

    return new Promise((resolve) => {
      showConflictDialog(conflictInfo, (strategy) => {
        resolve({ strategy });
      });
    });
  }

  function showConflictDialog(conflictInfo, onResolve) {
    if (!GPM_STATE.modalRoot) {
      onResolve('keep_local');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'gpm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'gpm-modal';
    dialog.style.cssText = 'width: 420px;';

    const remoteTime = new Date(conflictInfo.remoteTime).toLocaleString();
    const localTime = new Date(conflictInfo.localTime).toLocaleString();

    dialog.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 18px; font-weight: 400; margin: 0 0 12px;">
          ⚠️ ${t('syncConflict') || 'Sync Conflict Detected'}
        </h3>
        <p style="font-size: 14px; color: var(--gpm-text-secondary); margin: 0 0 16px; line-height: 1.5;">
          ${t('syncConflictDescription') || 'Your data was modified on another device.'}
        </p>
        <div style="background: var(--gpm-bg); padding: 12px; border-radius: 8px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--gpm-text-secondary);">Remote:</span>
            <span>${remoteTime}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--gpm-text-secondary);">Local:</span>
            <span>${localTime}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="gpm-btn gpm-btn-primary" data-action="accept_remote">
          ${t('acceptRemote') || 'Accept Remote'}
        </button>
        <button class="gpm-btn gpm-btn-ghost" data-action="keep_local">
          ${t('keepLocal') || 'Keep Local'}
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    GPM_STATE.modalRoot.appendChild(overlay);

    const handleClick = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        overlay.remove();
        onResolve(action);
      }
    };

    dialog.addEventListener('click', handleClick);
  }

  async function applyResolution(strategy, conflictInfo) {
    switch (strategy) {
      case 'keep_local':
        await GPMSyncManager.syncPush();
        gpmLog('[GPM Conflict] Kept local data, updated sync meta');
        break;

      case 'accept_remote':
        const backups = await GPMBackupManager.getBackups();
        if (backups.length > 0) {
          const latestBackup = backups[backups.length - 1];
          await GPMBackupManager.restoreBackup(latestBackup.id);
          gpmLog('[GPM Conflict] Accepted remote data from backup');
        }
        break;

      default:
        gpmWarn('[GPM Conflict] Unknown strategy:', strategy);
    }

    return true;
  }

  return {
    resolveConflict,
    showConflictDialog,
    applyResolution,
  };
})();
