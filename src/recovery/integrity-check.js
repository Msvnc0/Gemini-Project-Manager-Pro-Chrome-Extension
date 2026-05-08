/**
 * integrity-check.js — Data Integrity Verification Module
 *
 * Runs on extension startup to verify data consistency.
 * Auto-recovers from backup if corruption is detected.
 *
 * Checks performed:
 *   1. Projects array validity
 *   2. ChatMap object validity
 *   3. Orphan chatIds (chatIds in projects but not in chatMap)
 *   4. Missing parent references (parentId points to non-existent project)
 *   5. Circular references in parent hierarchy
 *   6. Duplicate chatIds across projects
 */

const GPMIntegrityCheck = (() => {
  async function run() {
    gpmLog('Running data integrity check...');

    const issues = [];
    let projects = [];
    let chatMap = {};

    try {
      projects = await GPMStorage.getProjects();
      chatMap = await GPMStorage.getChatMap();
    } catch (e) {
      gpmError('Failed to load data for integrity check:', e);
      return { success: false, error: e.message };
    }

    if (!Array.isArray(projects)) {
      issues.push({ type: 'projects_invalid', severity: 'critical', message: 'Projects data is not an array' });
    }

    if (typeof chatMap !== 'object' || Array.isArray(chatMap)) {
      issues.push({ type: 'chatmap_invalid', severity: 'critical', message: 'ChatMap data is not an object' });
    }

    if (issues.some((i) => i.severity === 'critical')) {
      gpmError('Critical data issues detected, attempting recovery...');
      return await attemptRecovery(issues);
    }

    const orphanChatIds = findOrphanChatIds(projects, chatMap);
    if (orphanChatIds.length > 0) {
      issues.push({
        type: 'orphan_chatids',
        severity: 'medium',
        count: orphanChatIds.length,
        message: `${orphanChatIds.length} chatId(s) in projects but not in chatMap`,
        items: orphanChatIds.slice(0, 10),
      });
    }

    const orphanedChatMapEntries = findOrphanedChatMapEntries(projects, chatMap);
    if (orphanedChatMapEntries.length > 0) {
      issues.push({
        type: 'orphaned_chatmap_entries',
        severity: 'low',
        count: orphanedChatMapEntries.length,
        message: `${orphanedChatMapEntries.length} chatMap entry/entries not in any project.chatIds`,
        items: orphanedChatMapEntries.slice(0, 10),
      });
    }

    const missingParents = findMissingParentRefs(projects);
    if (missingParents.length > 0) {
      issues.push({
        type: 'missing_parents',
        severity: 'medium',
        count: missingParents.length,
        message: `${missingParents.length} project(s) reference non-existent parent`,
        items: missingParents.slice(0, 10),
      });
    }

    const circular = findCircularRefs(projects);
    if (circular.length > 0) {
      issues.push({
        type: 'circular_refs',
        severity: 'high',
        count: circular.length,
        message: `${circular.length} circular reference(s) detected`,
        items: circular.slice(0, 10),
      });
    }

    const duplicates = findDuplicateChatIds(projects);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate_chatids',
        severity: 'low',
        count: duplicates.length,
        message: `${duplicates.length} chatId(s) appear in multiple projects`,
        items: duplicates.slice(0, 10),
      });
    }

    if (issues.length === 0) {
      gpmLog('Data integrity check passed - no issues found');
      return { success: true, issues: [], fixed: [] };
    }

    const fixed = await autoFix(issues, projects, chatMap);

    gpmLog('Data integrity check completed:', issues.length, 'issues found,', fixed.length, 'fixed');
    return { success: true, issues, fixed };
  }

  function findOrphanChatIds(projects, chatMap) {
    const orphans = [];
    for (const project of projects) {
      for (const chatId of project.chatIds || []) {
        if (!chatMap[chatId]) {
          orphans.push({ projectId: project.id, projectName: project.name, chatId });
        }
      }
    }
    return orphans;
  }

  function findOrphanedChatMapEntries(projects, chatMap) {
    const allAssigned = new Set();
    for (const project of projects) {
      for (const chatId of project.chatIds || []) {
        allAssigned.add(chatId);
      }
    }
    const orphans = [];
    for (const chatId of Object.keys(chatMap)) {
      if (!allAssigned.has(chatId)) {
        orphans.push({ chatId, projectId: chatMap[chatId].projectId });
      }
    }
    return orphans;
  }

  function findMissingParentRefs(projects) {
    const projectIds = new Set(projects.map((p) => p.id));
    const missing = [];

    for (const project of projects) {
      if (project.parentId && !projectIds.has(project.parentId)) {
        missing.push({
          projectId: project.id,
          projectName: project.name,
          missingParent: project.parentId,
        });
      }
    }

    return missing;
  }

  function findCircularRefs(projects) {
    const circular = [];
    const visited = new Set();

    for (const project of projects) {
      visited.clear();
      let current = project;

      while (current) {
        if (visited.has(current.id)) {
          circular.push({
            projectId: project.id,
            projectName: project.name,
            cycleStart: current.id,
          });
          break;
        }
        visited.add(current.id);
        current = projects.find((p) => p.id === current.parentId);
      }
    }

    return circular;
  }

  function findDuplicateChatIds(projects) {
    const chatIdMap = new Map();

    for (const project of projects) {
      for (const chatId of project.chatIds || []) {
        if (!chatIdMap.has(chatId)) {
          chatIdMap.set(chatId, []);
        }
        chatIdMap.get(chatId).push(project.id);
      }
    }

    const duplicates = [];
    for (const [chatId, projectIds] of chatIdMap) {
      if (projectIds.length > 1) {
        duplicates.push({ chatId, projectIds });
      }
    }

    return duplicates;
  }

  async function autoFix(issues, projects, chatMap) {
    const fixed = [];

    const orphanIssue = issues.find((i) => i.type === 'orphan_chatids');
    if (orphanIssue) {
      const chatIdSet = new Set(Object.keys(chatMap));
      for (const project of projects) {
        const before = (project.chatIds || []).length;
        project.chatIds = (project.chatIds || []).filter((chatId) => chatIdSet.has(chatId));
        if (project.chatIds.length !== before) {
          fixed.push({ type: 'orphan_chatids', projectId: project.id, removed: before - project.chatIds.length });
        }
      }
      orphanIssue.fixed = true;
    }

    const parentIssue = issues.find((i) => i.type === 'missing_parents');
    if (parentIssue) {
      for (const project of projects) {
        if (project.parentId) {
          const parentExists = projects.some((p) => p.id === project.parentId);
          if (!parentExists) {
            fixed.push({ type: 'missing_parents', projectId: project.id, oldParent: project.parentId });
            project.parentId = null;
          }
        }
      }
      parentIssue.fixed = true;
    }

    const circularIssue = issues.find((i) => i.type === 'circular_refs');
    if (circularIssue) {
      for (const item of circularIssue.items || []) {
        const project = projects.find((p) => p.id === item.projectId);
        if (project) {
          fixed.push({ type: 'circular_refs', projectId: project.id, oldParent: project.parentId });
          project.parentId = null;
        }
      }
      circularIssue.fixed = true;
    }

    const orphanedMapIssue = issues.find((i) => i.type === 'orphaned_chatmap_entries');
    if (orphanedMapIssue) {
      const allAssigned = new Set();
      for (const project of projects) {
        for (const chatId of project.chatIds || []) {
          allAssigned.add(chatId);
        }
      }
      const toRemove = Object.keys(chatMap).filter((chatId) => !allAssigned.has(chatId));
      for (const chatId of toRemove) {
        delete chatMap[chatId];
      }
      if (toRemove.length > 0) {
        fixed.push({ type: 'orphaned_chatmap_entries', removed: toRemove.length });
      }
      orphanedMapIssue.fixed = true;
    }

    if (fixed.length > 0) {
      if (fixed.some((f) => f.type === 'orphaned_chatmap_entries')) {
        await GPMStorage.saveProjects(projects);
        await GPMStorage.saveChatMap(chatMap);
      } else {
        await GPMStorage.saveProjects(projects);
      }
      gpmLog('Auto-fixed', fixed.length, 'integrity issues');
    }

    return fixed;
  }

  async function attemptRecovery(issues) {
    gpmError('Critical data issues, attempting recovery from backup...');

    const backup = await GPMStorage.getBackupInfo();

    if (backup) {
      const restored = await GPMStorage.restoreFromBackup();

      if (restored) {
        gpmLog('Data recovered from backup (type:', backup.type, ')');
        return {
          success: true,
          recovered: true,
          backupType: backup.type,
          backupDate: new Date(backup.timestamp).toISOString(),
          issues,
        };
      }
    }

    gpmError('No valid backup available, creating emergency backup and resetting');

    try {
      const currentData = await chrome.storage.local.get(null);
      const bytesUsed = await chrome.storage.local.getBytesInUse(null);
      if (bytesUsed <= 8 * 1024 * 1024) {
        await chrome.storage.local.set({
          gpm_backup_current: {
            type: 'emergency',
            data: currentData,
            timestamp: Date.now(),
          },
        });
      }

      await GPMStorage.clearAll();

      return {
        success: false,
        recovered: false,
        error: 'No valid backup found - data reset to defaults',
        emergencyBackupCreated: true,
        issues,
      };
    } catch (e) {
      gpmError('Emergency backup/reset failed:', e);
      return {
        success: false,
        recovered: false,
        error: e.message,
        issues,
      };
    }
  }
  return {
    run,
  };
})();
