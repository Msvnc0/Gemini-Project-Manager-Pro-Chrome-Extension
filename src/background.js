/**
 * background.js — Service Worker
 * Handles installation defaults, schema migration, and message routing.
 *
 * Schema Versioning:
 *   gpm_schemaVersion — current schema version number stored in chrome.storage.local
 *   CURRENT_SCHEMA_VERSION — target version defined in code
 *   GPM_MIGRATIONS — ordered list of migration functions
 */

const CURRENT_SCHEMA_VERSION = 5;

/**
 * Migration registry — ordered list of migrations.
 * Each entry: { fromVersion, toVersion, migrate(data) → data }
 * `data` is the full storage object; migrate must return the modified object.
 *
 * Add new migrations here when schema changes occur:
 * Example:
 *   { fromVersion: 1, toVersion: 2, migrate: (data) => {
 *       // Add 'tags' field to each project
 *       (data.gpm_projects || []).forEach(p => { if (!p.tags) p.tags = []; });
 *       return data;
 *   }}
 */
const GPM_MIGRATIONS = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate: (data) => {
      (data.gpm_projects || []).forEach((p) => {
        if (!p.createdAt) p.createdAt = Date.now();
        if (!p.updatedAt) p.updatedAt = Date.now();
      });
      return data;
    },
  },
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (data) => {
      if (!data.gpm_backups) data.gpm_backups = [];
      return data;
    },
  },
  {
    fromVersion: 2,
    toVersion: 3,
    migrate: (data) => {
      if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object') {
        for (const chatId of Object.keys(data.gpm_chatMap)) {
          if (data.gpm_chatMap[chatId].starredAt === undefined) {
            data.gpm_chatMap[chatId].starredAt = null;
          }
        }
      }
      return data;
    },
  },
  {
    fromVersion: 3,
    toVersion: 4,
    migrate: (data) => {
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
  },
  {
    fromVersion: 4,
    toVersion: 5,
    migrate: (data) => {
      const legacyKeys = [
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
      for (const key of legacyKeys) {
        if (data[key] !== undefined) delete data[key];
      }
      return data;
    },
  },
];

/**
 * Run all applicable migrations in order.
 * Backs up current data before any migration runs.
 */
async function gpmRunMigrations(currentVersion) {
  const applicable = GPM_MIGRATIONS.filter(
    (m) => m.fromVersion >= currentVersion && m.toVersion <= CURRENT_SCHEMA_VERSION
  ).sort((a, b) => a.fromVersion - b.fromVersion);

  if (applicable.length === 0) {
    console.log('[GPM] No migrations needed (schema v' + currentVersion + ' → v' + CURRENT_SCHEMA_VERSION + ')');
    await chrome.storage.local.set({ gpm_schemaVersion: CURRENT_SCHEMA_VERSION });
    return;
  }

  const allData = await chrome.storage.local.get(null);

  console.log(
    '[GPM] Running',
    applicable.length,
    'migration(s) from v' + currentVersion,
    'to v' + CURRENT_SCHEMA_VERSION
  );

  const bytesUsed = await chrome.storage.local.getBytesInUse(null);
  if (bytesUsed <= 8 * 1024 * 1024) {
    await chrome.storage.local.set({
      gpm_backup_current: {
        type: 'pre_migration',
        data: {
          projects: allData.gpm_projects || [],
          chatMap: allData.gpm_chatMap || {},
          prompts: allData.gpm_quickPrompts || [],
          settings: allData.gpm_settings || { lang: 'en', theme: 'auto' },
        },
        fromVersion: currentVersion,
        timestamp: Date.now(),
      },
    });
    console.log('[GPM] Pre-migration backup saved');
  }

  // Run migrations sequentially
  let data = {
    gpm_projects: allData.gpm_projects || [],
    gpm_chatMap: allData.gpm_chatMap || {},
    gpm_quickPrompts: allData.gpm_quickPrompts || [],
    gpm_settings: allData.gpm_settings || { lang: 'en', theme: 'auto' },
  };

  for (const migration of applicable) {
    try {
      console.log('[GPM] Migrating v' + migration.fromVersion + ' → v' + migration.toVersion);
      data = migration.migrate(data);
    } catch (err) {
      console.error('[GPM] Migration failed (v' + migration.fromVersion + '→v' + migration.toVersion + '):', err);
      // Stop on failure — don't corrupt data further
      return;
    }
  }

  // Write migrated data
  await chrome.storage.local.set({
    gpm_projects: data.gpm_projects,
    gpm_chatMap: data.gpm_chatMap,
    gpm_quickPrompts: data.gpm_quickPrompts,
    gpm_settings: data.gpm_settings,
    gpm_schemaVersion: CURRENT_SCHEMA_VERSION,
  });

  const legacyKeys = [
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
  const keysToRemove = legacyKeys.filter((k) => allData[k] !== undefined);
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
    console.log('[GPM] Cleaned up', keysToRemove.length, 'legacy key(s)');
  }

  console.log('[GPM] Migration complete — now at schema v' + CURRENT_SCHEMA_VERSION);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      await chrome.storage.local.set({
        gpm_projects: [],
        gpm_chatMap: {},
        gpm_quickPrompts: [],
        gpm_settings: { lang: 'en', theme: 'auto' },
        gpm_schemaVersion: CURRENT_SCHEMA_VERSION,
      });
      console.log('[GPM] Initialized default storage (schema v' + CURRENT_SCHEMA_VERSION + ').');
    } else if (details.reason === 'update') {
      await createUpdateBackup(details.previousVersion);

      const result = await chrome.storage.local.get('gpm_schemaVersion');
      const storedVersion = result.gpm_schemaVersion || 0;
      if (storedVersion < CURRENT_SCHEMA_VERSION) {
        await gpmRunMigrations(storedVersion);
      } else {
        console.log('[GPM] Schema up to date (v' + storedVersion + ').');
      }

      await notifyTabsAboutUpdate();
    }
  } catch (e) {
    console.error('[GPM] onInstalled handler failed:', e);
  }
});

/**
 * Create a backup before extension update.
 */
async function createUpdateBackup(previousVersion) {
  try {
    const allData = await chrome.storage.local.get(null);

    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    if (bytesUsed > 8 * 1024 * 1024) {
      console.log('[GPM] Skipping update backup, quota usage high');
      return;
    }

    await chrome.storage.local.set({
      gpm_backup_current: {
        type: 'update',
        data: {
          projects: allData.gpm_projects || [],
          chatMap: allData.gpm_chatMap || {},
          prompts: allData.gpm_quickPrompts || [],
          settings: allData.gpm_settings || { lang: 'en', theme: 'auto' },
        },
        previousVersion,
        timestamp: Date.now(),
      },
    });

    console.log('[GPM] Pre-update backup created (from v' + previousVersion + ')');
  } catch (e) {
    console.error('[GPM] Failed to create update backup:', e);
  }
}

/**
 * Mark extension update in storage so content scripts can react without tabs permission.
 */
async function notifyTabsAboutUpdate() {
  try {
    const newVersion = chrome.runtime.getManifest().version;
    await chrome.storage.local.set({
      gpm_lastExtensionUpdate: {
        version: newVersion,
        timestamp: Date.now(),
      },
    });
    console.log('[GPM] Update marker saved for v' + newVersion);
  } catch (e) {
    console.error('[GPM] Failed to save update marker:', e);
  }
}

const GPM_WRITE_LOCK_TIMEOUT = 5000;
let _writeLockHolder = null;
let _writeLockTimer = null;

function gpmAcquireWriteLock(tabId) {
  if (typeof tabId !== 'number') return false;
  if (_writeLockHolder !== null && _writeLockHolder !== tabId) {
    return false;
  }
  _writeLockHolder = tabId;
  clearTimeout(_writeLockTimer);
  _writeLockTimer = setTimeout(() => {
    _writeLockHolder = null;
  }, GPM_WRITE_LOCK_TIMEOUT);
  return true;
}

function gpmReleaseWriteLock(tabId) {
  if (_writeLockHolder === tabId) {
    _writeLockHolder = null;
    clearTimeout(_writeLockTimer);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GPM_ACQUIRE_LOCK') {
    const tabId = sender.tab?.id;
    sendResponse({ granted: gpmAcquireWriteLock(tabId) });
    return;
  }

  if (message.type === 'GPM_RELEASE_LOCK') {
    const tabId = sender.tab?.id;
    gpmReleaseWriteLock(tabId);
    sendResponse({ ok: true });
    return;
  }
  return false;
});
