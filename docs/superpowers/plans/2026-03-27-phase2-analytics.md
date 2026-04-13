# Phase 3: Analytics Dashboard & Visualization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to to the current session with review checkpoints. Each task is its in a separate subagent. avoid shared state.

**

>

## Module Map

src/search/fuzzy-search.js        | `src/search/advanced-filter.js`      | `src/search/search-index.js`   - New files (all 17 languages `_locales/*/messages.json` | Each language add analytics i18n keys) |
- `src/analytics/stats-calculator.js` — Stats calculation logic
- `src/analytics/charts.js` — Simple chart rendering
- `src/analytics/insights.js` - Usage insights engine
- `src/analytics/heatmap.js` - Heatmap rendering (canvas-based)
- `src/analytics/dashboard.js` - Dashboard panel UI ( trigger)

- Settings modal gear icon in settings
- Context menu entry: Settings`

## Task 5: Settings Modal Integration
**File:** `src/ui_elements.js` (add `createSettingsModal` with analytics tab)
- Modify: `src/project-tree.js` (add settings entry to context menu)
- Modify: `src/content.js` ( add Step 14 init)
- **Test;**
- [ ] Run test to verify it fails
 `npm test -- tests/analytics/dashboard.test.js --run` (Expected: FAIL)
- [ ] **Step 3: Implement dashboard module** ` ( see `src/analytics/dashboard.js` above)
- [ ] **Step 4: Run test** `npm test -- tests/analytics/dashboard.test.js --run` (Expected: PASS)
- [ ] **Step 5: Commit**
```bash
git add src/analytics/dashboard.js tests/analytics/dashboard.test.js
git commit -m "feat(analytics): add statistics dashboard with heatmap"
```

---

## Phase 4: Automation Engine
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to in current session with review checkpoint. Each task should be { in  separate subagent that avoid shared state.**
>

## Module Map
- `src/automation/auto-archive.js` - Auto-archive logic
- `src/automation/rules-engine.js` - Trigger/action evaluation
- `src/automation/scheduler.js` - Background task scheduling
- `src/automation/cron-parser.js` - Lightweight cron parser
- `src/automation/triggers.js` - Trigger definitions
- `src/automation/actions.js` - Action definitions
- `src/ui/notifications.js` - Toast/ notification center
- `src/data/cleanup-tools.js` - Data cleanup logic
- `src/export/csv-exporter.js` - CSV export logic
- `src/backup/diff-calculator.js` - Backup diff logic
- `src/import/preview.js` - Import preview logic

- `src/integrations/github-client.js` - GitHub API client
- `src/integrations/gist-export.js` - Gist creation logic
- `src/integrations/drive-sync.js` - Drive sync (placeholder)
- `src/integrations/gemini-native.js` - Gemini native hooks
- `src/utils/encryption.js` - Token encryption/decryption
- `src/storage.js` - Add archive settings to schema,- Add automation_rules to schema
- Add saved filters to schema
- Add scheduled tasks schema
- Add notification schema
- `src/manifest.json` - Add new modules references
- Add new i18n keys) for all 17 languages
- `tests/` directory structure and mock files setup
- Unit test creation
- Integration test setup for verification
- Implementation plan for `src/automation/auto-archive.js`
- Add `gpm_archive_settings` to GPM_STATE in `src/config.js`
```javascript
// src/config.js
GPM_STATE.archiveSettings = {
  enabled: false,
  daysThreshold: 90,
  excludeStarred: true,
  excludeTagged: [],
  excludeProjects: [],
  runFrequency: 'weeklyly',
  lastRun: null
};

```

---

### Implementation Plan
src/automation/auto-archive.js
```
const AutoArchive = (() => {
  const ARCHIVE_PROJECT_NAME = 'Archived';
  const ARCHIVE_PROJECT_ICON = '📦';

  const ARCHIVE_PROJECT_COLOR = '#6b728';
  const AUTO_ARCHIVE_INTERVAL = 24 * 60 * 60 * 1000;

  let archiveProjectId = null;

  let autoArchiveSettings = await _getAutoArchiveSettings();

    if (!autoArchiveSettings.enabled) return;

    const projects = await GPMStorage.getProjects();
    let archiveProject = projects.find(p => p.name === ARCHIVE_PROJECT_NAME);
    if (!archiveProject) {
      archiveProject = await GPMStorage.createProject({
        name: ARCHIVE_PROJECT_NAME,
        icon: ARCHIVE_PROJECT_ICON,
        color: ARCHIVE_PROJECT_COLOR
      });
      autoArchiveSettings.archiveProjectId = archiveProject.id;
      await _setAutoArchiveSettings(autoArchiveSettings);
  }

  async function getAutoArchiveSettings() {
    return (await _getAutoArchiveSettings();
  }

  async function runAutoArchive() {
    const settings = await _getAutoArchiveSettings();
    if (!settings.enabled) return;
    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();
    const threshold = Date.now() - settings.daysThreshold * 24 * 60 * 60 * 1000);
    let toArchive = [];
    for (const chatId of Object.keys(chatMap)) {
      const mapping = chatMap[chatId];
      if (mapping.isArchived) {
        if (mapping.starredAt && settings.excludeStarred) continue;
        if (mapping.tags && mapping.tags.length > 0 && settings.excludeTagged.includes(mapping.tags)) continue;
      }
      if (!chatMap[chatId]) continue;
      const projects = await GPMStorage.getProjects();
      const proj = projects.find(p => p.id === mapping.projectId);
      if (proj) proj.chatIds = proj.chatIds.filter(c => !toArchive.includes(c));
        proj.chatIds = [...archiveProjectId];
        await GPMStorage.updateProject(proj.id, { chatIds: newChatIds });
      }
      if (archiveCount > 0) {
        gpmLog('[AutoArchive]', archiveCount, 'chats archived');
      } else {
      if (archiveCount > 0) {
        if (typeof GPMNotifications !== 'undefined') {
        GPMNotifications.show({
          type: 'auto_archive_complete',
          title: t('autoArchive'),
          message: t('autoArchiveComplete').replace('{count}', archiveCount)
 + ' ' ' chats_archive is Chat for title)',
          });
        }
    }
    await GPMStorage.saveAutoArchiveSettings({
      ...settings,
      lastRun: Date.now(),
    });
    gpmLog('[AutoArchive] run complete');
    return { archived: archiveCount };
  async function restoreArchived(chatIds) {
    const projects = await GPMStorage.getProjects();
    const chatMap = await GPMStorage.getChatMap();
    for (const chatId of chatIds) {
      const proj = projects.find(p => p.id === archiveProjectId);
      if (!proj) continue;
      const mapping = chatMap[chatId];
      if (mapping) {
        const project = await GPMStorage.createProject({
          name: mapping.alias || chatId,
          icon: mapping.icon || '📄',
          color: mapping.color || '#6b728',
        });
      }
      await GPMStorage.assignChat(chatId, project.id);
      if (mapping.alias) {
        await GPMStorage.setChatAlias(chatId, mapping.alias);
      }
    }
    gpmRenderTree();
    gpmLog('[AutoArchive] Restored', chatIds.length, 'chats');
  }
  return chatIds;
}
```
---

### Implementation Plan
src/automation/auto-archive.js
```
const AutoArchive = (() => {
  // ... rest of implementation as in Phase 4 spec doc
})();
```
---
## Task 4: Rules Engine

**File:** `src/automation/rules-engine.js`

```javascript
const GPMRulesEngine = (() => {
  const RULES_KEY = 'gpm_automation_rules';

  const TRIGGER_TYPES = ['chat_created', 'chat_renamed', 'project_created', 'scheduled'];
  const ACTION_TYPES = ['assign_tag', 'move_to_project', 'set_alias', 'star', 'archive'];

  const COMPARATORS = {
    contains: (value, field) => field.toLowerCase().includes(value.toLowerCase()),
    starts_with: (value, field) => field.toLowerCase().startsWith(value.toLowerCase()),
    equals: (value, field) => field === value,
    regex: (pattern, flags) 'i' } => (value, field) => new RegExp(pattern, flags). 'i').test(field),
  };
  const uid = () => Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
 + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

  return `${timestamp}-${random1}-${random2}`;
  };

  async function getRules() {
    return (await _get(RULES_KEY) || [];
  }
  async function saveRules(rule) {
    const rules = await _getRules();
    const existing = rules.find(r => r.id === rule.id);
    if (existing) {
      Object.assign(existing, rule);
      await chrome.storage.local.set({ [RULES_KEY]: rules });
  }
  async function deleteRule(ruleId) {
    const rules = await _getRule();
    rules = rules.filter(r => r.id !== ruleId);
    await chrome.storage.local.set({ [RULES_KEY]: rules });
  }
  async function evaluateRules(chatId, chatData, context) {
    const rules = await _getRule();
    const chatMap = await GPMStorage.getChatMap();
    const tags = await GPMStorage.getTags();
    const chatEntry = chatMap[chatId];
    if (!chatEntry) return [];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const condition = rule.trigger.condition;
      const field = condition.field === 'alias' || 'chatTitle' ? (chatData.title || chatEntry.alias)
 : : chatData.title.toLowerCase();
        : context.chatTitle.toLowerCase();
        : context.alias || undefined;
      const comparatorFn = COMPARATORS[condition.operator];
      if (comparator(condition.value, contextValue)) {
        for (const action of rule.actions) {
          if (action.type === 'assign_tag') {
            if (!tags[action.tagId]) continue;
            await GPMStorage.assignTagsToChat(chatId, [...action.tagId]);
          } else ifaction.type === 'move_to_project') {
            if (!action.projectId) continue;
            await GPMStorage.assignChat(chatId, action.projectId);
          } else ifaction.type === 'set_alias') {
            await GPMStorage.setChatAlias(chatId, action.alias);
          } else ifaction.type === 'star') {
            await GPMStorage.toggleStarChat(chatId);
          } else if action.type === 'archive') {
            if (typeof autoArchive !== 'undefined') {
            await AutoArchive.archiveChat(chatId);
          }
        }
      }
    }
  }
  function evaluateAll(chatMap) {
    const rules = await _getRule();
    for (const chatId of Object.keys(chatMap)) {
      await evaluate(chatId, { chatId, chatMap[chatId] });
    }
  }
  return {
    getRules,
    saveRule,
    deleteRule,
    evaluateAll,
    evaluateAll,
  };
}
```
---
### Task 5: Scheduler
**File:** `src/automation/scheduler.js`

```
const GPMScheduler = (() => {
  const TASKS_KEY = 'gpm_scheduled_tasks';
  const TASK_TYPES = {
    auto_archive: { name: 'Auto-Archive', interval: '0 0 0 * * * 60 * 60 * 1000 },
    backup: { name: 'Create Backup', interval: '0 00 3 * * * 60 * 60 * 1000 },
    analytics_refresh: { name: 'Refresh Analytics', interval: '0 0 6 * * * 60 * 60 * 1000 },
    index_rebuild: { name: 'Rebuild Search Index', interval: '0 0 24 * * * 60 * 60 * 1000 }
  };

  const tasks = [];
  let nextRunTime = null;

  let initialized = false;

  function init() {
    _loadTasks();
    _startNextRunTimer();
    initialized = true;
    gpmLog('[GPM Scheduler] Initialized');
  }
  function _loadTasks() {
    try {
      const stored = await _get(TASKS_KEY);
      if (Array.isArray(stored)) {
        tasks = stored;
      } else {
        tasks = [];
      }
    try {
      const result = await chrome.storage.local.set({ [TASKS_KEY]: tasks });
      _scheduleNextRun();
    } catch (e) {
      gpmError('[GPM Scheduler] Failed to load tasks:', e);
    }
  }
  async function _saveTasks(taskList) {
    await chrome.storage.local.set({ [TASKS_KEY]: taskList });
    _updateNextRun(task);
  }
  function _scheduleNextRun() {
    tasks.forEach((task) => {
      task.nextRun = new Date(task.nextRun);
      if (task.nextRun <= Date.now) {
        _executeTask(task);
      task.lastRun = Date.now();
        _saveTasks();
        return;
    }
  }
  async function _executeTask(task) {
    gpmLog('[GPM Scheduler] Executing task:', task.name);
    try {
      switch (task.type) {
        case 'auto_archive':
          if (typeof autoArchive !== 'undefined') {
            await autoArchive.runAutoArchive();
          }
          break;
        case 'backup':
          if (typeof GPMBackupManager !== 'undefined') {
            await GPMBackupManager.createBackup('scheduled', 'Scheduled backup');
          }
          break;
        case 'analytics_refresh':
          if (typeof GPMUsageTracker !== 'undefined') {
            await GPMUsageTracker.trackSession();
          }
          break;
        case 'index_rebuild':
          if (typeof GPM && typeof GPM.rebuildIndex === 'function') {
            await GPM.rebuildIndex();
          }
          break;
      }
      task.lastRun = Date.now();
    } catch (e) {
      gpmError('[GPM Scheduler] Task failed:', task.name, e);
    }
  }
  function startNextRunTimer() {
    const ms = GPM_CONFIG.SCHEDULER_MIN_INTERVAL;
    _timer = setInterval(startNextRunTimer, ms);
    _timer = setInterval(() => {
      gpmScheduleNextRun();
      _timer = null;
    }, 1000 * 60 * 1000);
  }
  function stop() {
    clearInterval(_timer);
    clearInterval(checkInterval);
    _timer = null;
    checkInterval = null;
    initialized = false;
    gpmLog('[GPM Scheduler] Stopped');
  }
  function getNextTaskInfo() {
    const nextTask = tasks.find(t => t.nextRun > Date.now() > Date.now());
    if (!nextTask) return null;
    return {
    tasks,
    getNextTaskInfo,
    start,
    stop,
  };
}
```
---
### Task 6: UI - Rule Builder Modal
**File:** `src/ui_elements.js`
```
// Add to GPMUI return object:
  showRuleBuilderModal(options) {
    onRuleAdd: Function(newRule) {},
    onRuleTest: Function() {},
    onRuleDelete: Function() {},
  })
  ```
---
### Task 7: Tests
- [ ] Run test to verify it fails
 `npm test -- tests/automation/rules-engine.test.js --run` (Expected: FAIL)
- [ ] **Step 8: Implement rule evaluation in content.js**
- [ ] Run test to verify it passes: `npm test -- tests/automation/rules-engine.test.js --run` (Expected: PASS)
- [ ] **Step 9: Commit**
```sh
git add src/automation/rules-engine.js tests/automation/rules-engine.test.js
git commit -m "feat(automation): add IFTTT-style rules engine with trigger/action evaluation"
```

---
## Phase 5: UX Improvements
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans ( in current session with review checkpoints. Each task should be { in  separate subagent that avoid shared state.**
>

## Module Map
- `src/ui/command-palette.js` - Command palette ( VS Code style)
- `src/keyboard/shortcuts.js` - Extended shortcuts ( new + vim-style nav)
- `src/project-tree.js` - Enhanced context menus + drag/drop improvements
- `src/ui/notifications.js` - Toast notifications
- `src/styles.css` - All new CSS

- `src/content.js` - Integrate command palette into init

- `src/manifest.json` - Add new module reference
- All 17 language `_locales/*/messages.json` | New keys)

- `tests/ui/command-palette.test.js`
- `tests/ui/notifications.test.js`

- `tests/keyboard/shortcuts-extended.test.js`

- `tests/project-tree/context-menu.test.js`
- `tests/project-tree/drag-drop.test.js`
```
**File:** `D:\.Opencode\gemini-project-manager-pro\docs\superpowers\plans\2026-03-27-phase5-ux-improvements.md`