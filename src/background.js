/**
 * background.js — Service Worker
 * Handles installation defaults, schema migration, and message routing.
 *
 * Schema Versioning:
 *   gpm_schemaVersion — current schema version number stored in chrome.storage.local
 *   CURRENT_SCHEMA_VERSION — target version defined in code
 *   GPM_MIGRATIONS — ordered list of migration functions
 */

const CURRENT_SCHEMA_VERSION = 1;

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
  // No migrations yet — schema version 1 is the baseline
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

  console.log(
    '[GPM] Running',
    applicable.length,
    'migration(s) from v' + currentVersion,
    'to v' + CURRENT_SCHEMA_VERSION
  );

  // Pre-migration backup
  const allData = await chrome.storage.local.get(null);
  await chrome.storage.local.set({
    gpm_pre_migration_backup: {
      data: {
        gpm_projects: allData.gpm_projects || [],
        gpm_chatMap: allData.gpm_chatMap || {},
        gpm_quickPrompts: allData.gpm_quickPrompts || [],
        gpm_settings: allData.gpm_settings || { lang: 'en', theme: 'auto' },
      },
      fromVersion: currentVersion,
      timestamp: Date.now(),
    },
  });
  console.log('[GPM] Pre-migration backup saved');

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
  console.log('[GPM] Migration complete — now at schema v' + CURRENT_SCHEMA_VERSION);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Fresh install — set defaults with current schema version
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
      gpm_schemaVersion: CURRENT_SCHEMA_VERSION,
    });
    console.log('[GPM] Initialized default storage (schema v' + CURRENT_SCHEMA_VERSION + ').');
  } else if (details.reason === 'update') {
    // 🛡️ Pre-update backup
    await createUpdateBackup(details.previousVersion);

    // Extension updated — check if schema migration is needed
    const result = await chrome.storage.local.get('gpm_schemaVersion');
    const storedVersion = result.gpm_schemaVersion || 0; // 0 = pre-versioning installs
    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      await gpmRunMigrations(storedVersion);
    } else {
      console.log('[GPM] Schema up to date (v' + storedVersion + ').');
    }

    // 🛡️ Notify all Gemini tabs about the update
    await notifyTabsAboutUpdate();
  }
});

/**
 * Create a backup before extension update.
 */
async function createUpdateBackup(previousVersion) {
  try {
    const allData = await chrome.storage.local.get(null);

    await chrome.storage.local.set({
      gpm_update_backup: {
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
 * Notify all Gemini tabs that the extension has been updated.
 * Content script will show a recovery UI asking user to reload.
 */
async function notifyTabsAboutUpdate() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });
    const newVersion = chrome.runtime.getManifest().version;

    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'GPM_EXTENSION_UPDATED',
          newVersion,
        });
      } catch (e) {
        // Tab may not have content script loaded yet
      }
    }

    console.log('[GPM] Notified', tabs.length, 'tab(s) about update to v' + newVersion);
  } catch (e) {
    console.error('[GPM] Failed to notify tabs:', e);
  }
}

// Message relay between content script instances (if needed for multi-tab sync)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GPM_STORAGE_UPDATED') {
    // Broadcast to all Gemini tabs so they re-render
    chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id !== sender.tab?.id) {
          try {
            chrome.tabs.sendMessage(tab.id, { type: 'GPM_SYNC' });
          } catch (_) {
            /* tab may be closed or unresponsive */
          }
        }
      });
      sendResponse({ ok: true });
    });
  }
  return true;
});
