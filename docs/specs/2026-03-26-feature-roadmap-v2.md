# Gemini Project Manager Pro — Feature Roadmap v2.0

**Document Type:** Technical Specification & Implementation Plan  
**Version:** 2.0.0  
**Date:** 2026-03-26  
**Author:** Project Team  
**Status:** Draft → Review → Approved

---

## 📋 Executive Summary

This document defines 7 major feature categories for GPM Pro v2.0, encompassing 25+ individual features. Total estimated implementation: **120-150 hours** across **8 development sprints**.

### Feature Categories Overview

| # | Category | Features | Priority | Est. Hours |
|---|----------|----------|----------|------------|
| 1 | Smart Organization | 4 | High | 20-24 |
| 2 | Advanced Search & Filter | 3 | High | 16-20 |
| 3 | Data Visualization | 3 | Medium | 18-22 |
| 4 | Automation | 4 | Medium | 20-24 |
| 5 | User Experience | 5 | High | 14-18 |
| 6 | Data Management | 4 | Medium | 16-20 |
| 7 | Integrations | 3 | Low | 12-16 |

---

## 🏗️ Architecture Overview

### New Modules Structure

```
src/
├── smart-organization/
│   ├── auto-tagger.js        # Auto-categorization engine
│   ├── folder-suggester.js   # ML-free clustering algorithm
│   └── tag-presets.js        # Predefined tag templates
├── search/
│   ├── advanced-filter.js    # Multi-criteria filter panel
│   ├── fuzzy-search.js       # Fuzzy matching engine
│   └── search-index.js       # Inverted index for fast search
├── analytics/
│   ├── dashboard.js          # Stats dashboard UI
│   ├── heatmap.js            # Activity visualization
│   └── charts.js             # Chart rendering utilities
├── automation/
│   ├── auto-archive.js       # Auto-archive old chats
│   ├── rules-engine.js       # IFTTT-style automation rules
│   └── scheduled-tasks.js    # Cron-like task scheduler
├── integrations/
│   ├── drive-sync.js         # Google Drive backup
│   ├── gist-export.js        # GitHub Gist export
│   └── gemini-native.js      # Gemini native feature integration
└── (existing modules extended)
```

### Schema Changes (v3 → v4)

```javascript
// storage.js schema version bump
const GPM_SCHEMA_VERSION = 4;

// New fields in gpm_chatMap:
{
  [chatId]: {
    // existing fields...
    lastAccessed: number,        // Last access timestamp
    createdAt: number,           // Chat creation timestamp
    wordCount: number,           // Estimated word count
    autoTags: string[],          // Auto-suggested tag IDs
    isArchived: boolean,         // Archive status
    archivedAt: number|null,     // Archive timestamp
  }
}

// New storage keys:
gpm_automation_rules: Rule[]     // Automation rules
gpm_archive_settings: {          // Archive configuration
  enabled: boolean,
  daysThreshold: number,
  excludeStarred: boolean,
  excludeTagged: string[]
}
gpm_search_index: SearchIndex    // Inverted index for search
```

---

# 📁 CATEGORY 1: Smart Organization

## 1.1 Auto Chat Categorization

### Specification

**Goal:** Automatically suggest tags based on chat title keywords and patterns.

**Technical Approach:**
- Keyword-based rule engine (no ML dependencies)
- Extensible pattern matching system
- User can accept/reject suggestions

**Data Structure:**
```javascript
const AUTO_TAG_RULES = [
  {
    id: 'bug',
    keywords: ['bug', 'error', 'fix', 'issue', 'problem', 'debug', 'crash'],
    suggestedTagId: 'tag_bug_id',
    icon: '🐛',
    color: '#ef4444'
  },
  {
    id: 'feature',
    keywords: ['feature', 'add', 'create', 'new', 'implement'],
    suggestedTagId: 'tag_feature_id',
    icon: '✨',
    color: '#22c55e'
  },
  // ... more rules
];
```

**UI Flow:**
1. Chat added to project → Auto-tagger runs
2. If match found → Show toast: "Suggested tag: 🐛 Bug [Accept] [Dismiss]"
3. User accepts → Tag assigned, rule confidence increased
4. User dismisses → Rule confidence decreased

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create auto-tagger module | `src/smart-organization/auto-tagger.js` | 4 | None |
| Define rule engine | `src/smart-organization/tag-rules.js` | 3 | None |
| Add autoTags to schema | `src/storage.js` | 2 | None |
| UI: Suggestion toast | `src/ui_elements.js` | 3 | None |
| Settings: Enable/disable | `src/project-tree.js` | 2 | None |
| Tests | `tests/smart-organization/auto-tagger.test.js` | 3 | All above |

**Total: 17 hours**

---

## 1.2 Smart Folder Suggestions

### Specification

**Goal:** Analyze chat patterns and suggest folder creation for similar chats.

**Algorithm:**
```javascript
function suggestFolders(chatMap, projects) {
  // 1. Group chats by keyword similarity
  const groups = clusterByKeywords(chatMap);
  
  // 2. Filter groups with 3+ chats not in folders
  const candidates = groups.filter(g => g.unfolderedChats >= 3);
  
  // 3. Generate suggestions
  return candidates.map(g => ({
    name: deriveFolderName(g.keywords),
    icon: suggestIcon(g.keywords),
    color: suggestColor(g.keywords),
    chats: g.chatIds,
    confidence: calculateConfidence(g)
  }));
}
```

**UI:**
- Settings → Smart Suggestions panel
- List of suggestions with [Create Folder] button
- Preview: "5 chats will be moved to 'Bug Fixes' folder"

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create folder-suggester module | `src/smart-organization/folder-suggester.js` | 6 | None |
| Implement clustering algorithm | `src/smart-organization/clustering.js` | 5 | None |
| UI: Suggestions panel | `src/ui_elements.js` | 4 | None |
| Integration with project-tree | `src/project-tree.js` | 3 | None |
| Tests | `tests/smart-organization/folder-suggester.test.js` | 3 | All above |

**Total: 21 hours**

---

## 1.3 Tag Presets & Templates

### Specification

**Goal:** Predefined tag sets for common workflows.

**Built-in Presets:**
```javascript
const TAG_PRESETS = {
  'software-dev': {
    name: 'Software Development',
    tags: [
      { name: 'Bug', icon: '🐛', color: '#ef4444' },
      { name: 'Feature', icon: '✨', color: '#22c55e' },
      { name: 'Refactor', icon: '♻️', color: '#3b82f6' },
      { name: 'Docs', icon: '📝', color: '#f59e0b' },
      { name: 'Testing', icon: '🧪', color: '#8b5cf6' }
    ]
  },
  'writing': {
    name: 'Writing',
    tags: [
      { name: 'Draft', icon: '✏️', color: '#fbbf24' },
      { name: 'Review', icon: '👀', color: '#3b82f6' },
      { name: 'Published', icon: '✅', color: '#22c55e' }
    ]
  },
  'research': { /* ... */ },
  'planning': { /* ... */ }
};
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create tag-presets module | `src/smart-organization/tag-presets.js` | 3 | None |
| UI: Preset selector | `src/tags/tag-ui.js` | 4 | None |
| Import preset functionality | `src/storage.js` | 2 | None |
| i18n for preset names | `_locales/*/messages.json` | 2 | None |

**Total: 11 hours**

---

## 1.4 Quick Tags (Favorites)

### Specification

**Goal:** Mark frequently used tags as favorites for quick access.

**UI:**
```
Tag Selector Dropdown:
┌─────────────────────┐
│ ⭐ Favorites         │
│ [🐛 Bug] [✨ Feature]│
├─────────────────────┤
│ All Tags            │
│ [🐛 Bug]            │
│ [✨ Feature]        │
│ [📝 Docs]           │
├─────────────────────┤
│ ⭐ Add to Favorites │
│ ➕ Create Tag       │
└─────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Add favoriteTags to settings | `src/storage.js` | 1 | None |
| UI: Favorite section | `src/tags/tag-ui.js` | 3 | None |
| Toggle favorite function | `src/tags/tag-manager.js` | 2 | None |

**Total: 6 hours**

---

# 🔍 CATEGORY 2: Advanced Search & Filter

## 2.1 Advanced Filter Panel

### Specification

**Goal:** Multi-criteria filtering with visual UI.

**Filter Criteria:**
- [ ] Starred chats
- [ ] Tagged chats
- [ ] Date range (Last 7/30/90 days)
- [ ] Has alias (manually renamed)
- [ ] In project (dropdown)
- [ ] Has tags (multi-select)

**UI Component:**
```
┌─────────────────────────────────┐
│ 🔍 Advanced Filters         ✕   │
├─────────────────────────────────┤
│ Quick Filters:                  │
│ ☐ ⭐ Starred (5)                │
│ ☐ 🏷️ Tagged (12)               │
│ ☐ 📁 In Project: [All ▼]       │
│                                 │
│ Date Range:                     │
│ ○ Any time                      │
│ ● Last 7 days                   │
│ ○ Last 30 days                  │
│ ○ Custom: [__] to [__]          │
│                                 │
│ Tags:                           │
│ [🐛 Bug] [✨ Feature] [+ Add]   │
│                                 │
│ [Apply Filter] [Clear] [Save]   │
└─────────────────────────────────┘
```

**Saved Filters:**
- Users can save filter combinations
- Quick access from filter panel
- Stored in `gpm_saved_filters`

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create advanced-filter module | `src/search/advanced-filter.js` | 6 | None |
| UI: Filter panel component | `src/ui_elements.js` | 5 | None |
| Filter application logic | `src/project-tree.js` | 4 | None |
| Saved filters storage | `src/storage.js` | 2 | None |
| CSS for filter panel | `src/styles.css` | 2 | None |

**Total: 19 hours**

---

## 2.2 Fuzzy Search

### Specification

**Goal:** Search chats even with typos or partial matches.

**Algorithm:** Use lightweight fuzzy matching (no external deps)
```javascript
function fuzzyMatch(query, text) {
  // Implement simple Levenshtein-based or substring matching
  // Score: 0-1 (1 = exact match)
  // Threshold: 0.6 for results
}
```

**Search Scope:**
- Chat aliases
- Chat IDs (for power users)
- Project names
- Tag names

**UI:**
- Search results show match type: "Matched in: Alias"
- Highlight matched portions
- Sort by relevance score

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create fuzzy-search module | `src/search/fuzzy-search.js` | 5 | None |
| Integrate with search input | `src/project-tree.js` | 3 | None |
| Highlight matches UI | `src/project-tree.js:58-72` | 2 | None |
| Tests for edge cases | `tests/search/fuzzy-search.test.js` | 3 | None |

**Total: 13 hours**

---

## 2.3 Search Index (Performance)

### Specification

**Goal:** Fast search for 1000+ chats without scanning all data.

**Data Structure:** Inverted Index
```javascript
gpm_search_index = {
  words: {
    'bug': ['chat1', 'chat5', 'chat12'],
    'feature': ['chat2', 'chat8'],
    // ...
  },
  projects: {
    'proj1': ['chat1', 'chat2'],
    // ...
  },
  tags: {
    'tag1': ['chat1', 'chat3'],
    // ...
  },
  lastBuilt: timestamp
}
```

**Rebuild Strategy:**
- Rebuild index on data changes (debounced 5s)
- Full rebuild on extension load
- Incremental updates for single chat changes

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create search-index module | `src/search/search-index.js` | 6 | None |
| Index build function | `src/search/search-index.js` | 4 | None |
| Incremental update hooks | `src/storage.js` | 3 | None |
| Integration with fuzzy-search | `src/search/fuzzy-search.js` | 2 | search-index |

**Total: 15 hours**

---

# 📊 CATEGORY 3: Data Visualization

## 3.1 Statistics Dashboard

### Specification

**Goal:** Visual overview of project usage and chat statistics.

**Metrics:**
```javascript
{
  totalChats: number,
  totalProjects: number,
  totalTags: number,
  chatsPerProject: { [projectId]: count },
  chatsPerDay: { '2026-03-25': count, ... },
  topTags: [{ tagId, count }, ...],
  avgChatsPerProject: number,
  emptyProjects: number,
  starredChats: number,
  archivedChats: number
}
```

**UI Layout:**
```
┌────────────────────────────────────────────┐
│ 📊 Statistics Dashboard                 ✕  │
├────────────────────────────────────────────┤
│ Overview                                   │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │  156 │ │  12  │ │  24  │ │  8   │       │
│ │Chats │ │Projects│ │ Tags │ │Starred│    │
│ └──────┘ └──────┘ └──────┘ └──────┘       │
├────────────────────────────────────────────┤
│ Chats per Day (Last 7 Days)                │
│ ████▁▁██ (bar chart)                       │
├────────────────────────────────────────────┤
│ Top Tags                                   │
│ 🐛 Bug (24)  ✨ Feature (18)  📝 Docs (12) │
├────────────────────────────────────────────┤
│ Project Distribution                       │
│ Project A: ████████░░ 80%                  │
│ Project B: ████░░░░░░ 40%                  │
└────────────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create dashboard module | `src/analytics/dashboard.js` | 5 | None |
| Stats calculation logic | `src/analytics/stats-calculator.js` | 4 | None |
| UI: Dashboard panel | `src/ui_elements.js` | 5 | None |
| Simple bar chart renderer | `src/analytics/charts.js` | 4 | None |
| Settings entry point | `src/project-tree.js` | 1 | None |

**Total: 19 hours**

---

## 3.2 Activity Heatmap

### Specification

**Goal:** GitHub-style contribution graph for chat activity.

**Data Structure:**
```javascript
activityHeatmap = {
  '2026-03-01': { created: 3, modified: 5, accessed: 12 },
  '2026-03-02': { created: 1, modified: 2, accessed: 8 },
  // ... last 365 days
}
```

**UI:**
```
┌─────────────────────────────────────┐
│ Activity Heatmap                    │
├─────────────────────────────────────┤
│  Mon  ░▒▓█░░░▒▓█░░░▒▓█░░░▒▓█░░░   │
│  Wed  ▒▓█░░░▒▓█░░░▒▓█░░░▒▓█░░░▒▓   │
│  Fri  ░░▒▓█░░░▒▓█░░░▒▓█░░░▒▓█░░░   │
│       Jan Feb Mar Apr May Jun ...   │
├─────────────────────────────────────┤
│ Legend: ░0 ▒1-3 █4+                │
└─────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create heatmap module | `src/analytics/heatmap.js` | 5 | None |
| Data aggregation logic | `src/analytics/heatmap.js` | 3 | None |
| Canvas-based renderer | `src/analytics/heatmap.js` | 5 | None |
| UI: Heatmap panel | `src/ui_elements.js` | 3 | None |

**Total: 16 hours**

---

## 3.3 Usage Trends & Insights

### Specification

**Goal:** Provide actionable insights from usage patterns.

**Insight Types:**
```javascript
const INSIGHTS = [
  {
    id: 'unused_projects',
    type: 'warning',
    message: 'You have 3 empty projects',
    action: { label: 'Review', handler: showEmptyProjects }
  },
  {
    id: 'most_active_day',
    type: 'info',
    message: 'Your most productive day is Tuesday',
  },
  {
    id: 'tag_suggestion',
    type: 'suggestion',
    message: 'You use "Bug" tag frequently. Create a Bug project?',
    action: { label: 'Create', handler: createBugProject }
  }
];
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create insights engine | `src/analytics/insights.js` | 5 | None |
| Define insight rules | `src/analytics/insights.js` | 3 | None |
| UI: Insights panel | `src/ui_elements.js` | 3 | None |
| Dashboard integration | `src/analytics/dashboard.js` | 2 | None |

**Total: 13 hours**

---

# ⚙️ CATEGORY 4: Automation

## 4.1 Auto-Archive

### Specification

**Goal:** Automatically archive old, unused chats.

**Settings:**
```javascript
gpm_archive_settings = {
  enabled: true,
  daysThreshold: 90,
  excludeStarred: true,
  excludeTagged: ['important_tag_id'],
  excludeProjects: ['active_project_ids'],
  runFrequency: 'weekly', // daily, weekly, monthly
  lastRun: timestamp
}
```

**Archive Behavior:**
- Archived chats moved to special "Archived" project
- Hidden from default view
- Toggle: "Show Archived" in filter
- Can be restored anytime

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create auto-archive module | `src/automation/auto-archive.js` | 5 | None |
| Add archive fields to schema | `src/storage.js` | 2 | None |
| UI: Archive settings | `src/ui_elements.js` | 3 | None |
| Archive project management | `src/storage.js` | 2 | None |
| Scheduled task runner | `src/automation/scheduler.js` | 4 | None |

**Total: 16 hours**

---

## 4.2 Automation Rules Engine

### Specification

**Goal:** IFTTT-style automation rules for chat management.

**Rule Structure:**
```javascript
{
  id: 'rule_1',
  name: 'Auto-tag bug reports',
  trigger: {
    type: 'chat_created',
    condition: { field: 'title', operator: 'contains', value: 'bug' }
  },
  actions: [
    { type: 'assign_tag', tagId: 'bug_tag_id' },
    { type: 'move_to_project', projectId: 'bugs_project_id' }
  ],
  enabled: true
}
```

**Trigger Types:**
- `chat_created` - New chat detected
- `chat_renamed` - Chat alias changed
- `project_created` - New project created
- `scheduled` - Time-based trigger

**Action Types:**
- `assign_tag` - Add tag to chat
- `move_to_project` - Move chat to project
- `set_alias` - Auto-rename chat
- `star` - Star the chat
- `archive` - Archive the chat

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create rules-engine module | `src/automation/rules-engine.js` | 8 | None |
| Define trigger system | `src/automation/triggers.js` | 5 | None |
| Define action system | `src/automation/actions.js` | 5 | None |
| UI: Rule builder | `src/ui_elements.js` | 6 | None |
| Rule evaluation on events | `src/navigation.js` | 3 | None |

**Total: 27 hours**

---

## 4.3 Scheduled Tasks

### Specification

**Goal:** Run recurring tasks on schedule.

**Scheduler:**
```javascript
gpm_scheduled_tasks = [
  {
    id: 'task_1',
    name: 'Weekly cleanup',
    cron: '0 0 * * 0', // Every Sunday at midnight
    action: 'auto_archive',
    params: { daysThreshold: 30 },
    lastRun: null,
    nextRun: timestamp
  }
]
```

**Built-in Tasks:**
- `auto_archive` - Run auto-archive
- `backup` - Create backup
- `analytics_refresh` - Recalculate stats
- `index_rebuild` - Rebuild search index

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create scheduler module | `src/automation/scheduler.js` | 6 | None |
| Cron parser (lightweight) | `src/automation/cron-parser.js` | 3 | None |
| Task execution engine | `src/automation/scheduler.js` | 4 | None |
| UI: Task management | `src/ui_elements.js` | 4 | None |
| Background worker integration | `src/background.js` | 3 | None |

**Total: 20 hours**

---

## 4.4 Smart Notifications

### Specification

**Goal:** Contextual notifications for automation events.

**Notification Types:**
```javascript
{
  type: 'auto_archive_complete',
  title: 'Auto-Archive Complete',
  message: '12 chats archived (90+ days old)',
  actions: [
    { label: 'View', handler: showArchived },
    { label: 'Undo', handler: undoArchive }
  ]
}
```

**UI:**
- Toast notifications (top-right)
- Notification center (bell icon in settings)
- Dismissed notifications stored

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create notification module | `src/ui/notifications.js` | 4 | None |
| Toast component | `src/ui_elements.js` | 3 | None |
| Notification center UI | `src/ui_elements.js` | 4 | None |
| Integration with automation | Multiple | 3 | Auto modules |

**Total: 14 hours**

---

# 🎨 CATEGORY 5: User Experience

## 5.1 Enhanced Keyboard Shortcuts

### Specification

**Goal:** Comprehensive keyboard navigation and commands.

**New Shortcuts:**
```javascript
const SHORTCUTS = {
  // Existing...
  'ctrl+k': { action: 'quickSearch', description: 'Quick search (Cmd+K)' },
  'ctrl+shift+s': { action: 'showStarred', description: 'Show starred chats' },
  'ctrl+shift+t': { action: 'toggleTags', description: 'Toggle tag filter' },
  'ctrl+shift+a': { action: 'showAnalytics', description: 'Show analytics' },
  'ctrl+shift+r': { action: 'quickRestore', description: 'Quick restore backup' },
  'ctrl+/': { action: 'showShortcuts', description: 'Show shortcut help' },
  
  // Bulk selection
  'ctrl+click': { action: 'multiSelect', description: 'Add to selection' },
  'ctrl+a': { action: 'selectAll', description: 'Select all in view' },
  
  // Navigation
  'j': { action: 'nextItem', description: 'Next item' },
  'k': { action: 'prevItem', description: 'Previous item' },
  'o': { action: 'openItem', description: 'Open item' },
  'f': { action: 'toggleFavorite', description: 'Toggle favorite' }
};
```

**Quick Search (Cmd+K style):**
```
┌─────────────────────────────────┐
│ 🔍 Quick Search...          ✕   │
├─────────────────────────────────┤
│ 💬 Chat: Fix login bug          │
│ 💬 Chat: API endpoint design    │
│ 📁 Project: Bug Reports         │
│ 🏷️ Tag: Bug                    │
└─────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Extend shortcuts module | `src/keyboard/shortcuts.js` | 4 | None |
| Quick search UI | `src/ui_elements.js` | 5 | None |
| Quick search integration | `src/search/fuzzy-search.js` | 3 | None |
| Shortcut help modal | `src/ui_elements.js` | 2 | None |
| Vim-style navigation | `src/keyboard/shortcuts.js` | 3 | None |

**Total: 17 hours**

---

## 5.2 Multi-Select & Bulk Operations

### Specification

**Goal:** Select multiple chats and perform bulk actions.

**Selection Methods:**
- Ctrl+Click: Toggle selection
- Shift+Click: Range selection
- Ctrl+A: Select all in view
- Checkbox mode: Toggle button shows checkboxes

**Bulk Actions:**
- Move to project
- Assign tags
- Remove from project
- Star/Unstar
- Archive
- Delete

**UI:**
```
Selection Toolbar (sticky bottom):
┌─────────────────────────────────────────────────┐
│ 12 selected                              ✕      │
│ [Move To ▼] [Tag ▼] [Star] [Archive] [Delete]  │
└─────────────────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Extend bulk selection | `src/project-tree.js` | 5 | None |
| Multi-select handlers | `src/project-tree.js` | 4 | None |
| Bulk action toolbar | `src/ui_elements.js` | 3 | None |
| Bulk move modal | `src/ui_elements.js` | 2 | None |
| Bulk tag modal | `src/tags/tag-ui.js` | 2 | None |

**Total: 16 hours**

---

## 5.3 Context Menu Enhancements

### Specification

**Goal:** Richer context menus with more actions.

**New Menu Items:**
```
Chat Context Menu:
├─ Open in New Tab
├─ Copy Link
├─ Rename
├─ Move to Project ▶
├─ Assign Tags ▶
├─ Star/Unstar
├─ Add to Favorites
├─ Archive
├─ ────────
└─ Remove from Project

Project Context Menu:
├─ New Chat Here
├─ Create Subfolder
├─ Rename
├─ Change Icon/Color
├─ Sort Chats ▶
│   ├─ By Name (A-Z)
│   ├─ By Name (Z-A)
│   ├─ By Date (Newest)
│   └─ By Date (Oldest)
├─ Expand All
├─ Collapse All
├─ ────────
├─ Export Project
└─ Delete
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Extend context menus | `src/project-tree.js` | 4 | None |
| Copy link function | `src/navigation.js` | 1 | None |
| Sort submenu | `src/sort-manager.js` | 3 | None |
| Export project | `src/storage.js` | 2 | None |

**Total: 10 hours**

---

## 5.4 Drag & Drop Improvements

### Specification

**Goal:** Enhanced drag-drop with visual feedback.

**Improvements:**
1. Multi-drag: Select multiple, drag all
2. Drop zones: Visual indicators for valid targets
3. Ghost image: Show count when dragging multiple
4. Snap zones: Clear top/center/bottom indicators

**Visual Feedback:**
```
Dragging 3 chats:
┌─────────────────┐
│ 💬 Chat 1       │
│ 💬 Chat 2   +3  │ ← Ghost image shows count
│ 💬 Chat 3       │
└─────────────────┘

Drop target:
┌─────────────────┐
│ 📁 Project A    │ ← Green highlight (center = nest)
├─────────────────┤  ← Blue line (top = before)
│ 📁 Project B    │ ← Blue line (bottom = after)
└─────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Multi-drag support | `src/project-tree.js` | 5 | None |
| Enhanced drop zones | `src/project-tree.js` | 4 | None |
| Visual feedback CSS | `src/styles.css` | 3 | None |
| Ghost image rendering | `src/project-tree.js` | 3 | None |

**Total: 15 hours**

---

## 5.5 Command Palette

### Specification

**Goal:** Centralized command interface (VS Code-style).

**Commands:**
```
> [Filter commands...]

Projects
  Create New Project
  Create Subfolder
  Sort Projects...

Chats
  Quick Search
  Show Starred
  Show Archived
  Bulk Select Mode

Tags
  Create Tag
  Manage Tags
  Filter by Tag...

Automation
  Run Automation Rule
  View Scheduled Tasks
  Auto-Archive Now

Data
  Export All Data
  Import Data
  Restore from Backup
  Clear All Data

Settings
  Open Settings
  Keyboard Shortcuts
  About
```

**UI:**
```
┌─────────────────────────────────────┐
│ > _                              ✕  │
├─────────────────────────────────────┤
│ Projects                            │
│   📁 Create New Project             │
│   📂 Create Subfolder               │
├─────────────────────────────────────┤
│ Chats                               │
│   🔍 Quick Search                   │
│   ⭐ Show Starred                   │
└─────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create command-palette module | `src/ui/command-palette.js` | 6 | None |
| Command registry | `src/ui/command-palette.js` | 3 | None |
| UI: Palette component | `src/ui_elements.js` | 5 | None |
| Keyboard trigger (Ctrl+Shift+P) | `src/keyboard/shortcuts.js` | 1 | None |

**Total: 15 hours**

---

# 💾 CATEGORY 6: Data Management

## 6.1 Backup Version History

### Specification

**Goal:** View and compare backup versions with diff visualization.

**Data Structure:**
```javascript
gpm_backups = [
  {
    id: 'backup_1',
    timestamp: Date.now(),
    trigger: 'before_save',
    stats: { projects: 12, chats: 156, tags: 24 },
    diff: {  // Computed on restore preview
      added: { projects: 2, chats: 15, tags: 3 },
      removed: { projects: 0, chats: 5, tags: 0 },
      modified: { projects: 1, chats: 20, tags: 2 }
    },
    data: { /* compressed */ }
  }
]
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Backup History                      ✕   │
├─────────────────────────────────────────┤
│ 🔙 Mar 25, 2026 14:32 (Auto-backup)     │
│    12 projects, 156 chats, 24 tags      │
│    +2 projects, +15 chats, -5 chats     │
│    [Preview] [Restore] [Delete]         │
├─────────────────────────────────────────┤
│ 🔙 Mar 24, 2026 09:15 (Manual)          │
│    10 projects, 141 chats, 21 tags      │
│    [Preview] [Restore] [Delete]         │
└─────────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Extend backup manager | `src/backup/backup-manager.js` | 4 | None |
| Diff calculation | `src/backup/diff-calculator.js` | 5 | None |
| UI: Backup history panel | `src/ui_elements.js` | 5 | None |
| Preview modal | `src/ui_elements.js` | 4 | None |

**Total: 18 hours**

---

## 6.2 CSV Export

### Specification

**Goal:** Export data in CSV format for external analysis.

**Export Formats:**
```javascript
// chats.csv
chat_id,alias,project_name,tags,starred,created_at,last_accessed
abc123,Fix login bug,Bug Reports,"Bug,Urgent",true,2026-01-15,2026-03-25

// projects.csv
project_id,name,icon,color,chat_count,created_at
proj1,Bug Reports,🐛,#ef4444,24,2026-01-01

// tags.csv
tag_id,name,color,usage_count,created_at
tag1,Bug,#ef4444,24,2026-01-01
```

**UI:**
```
Export Data:
○ JSON (All data)
● CSV (Spreadsheet)
  ☐ Chats
  ☐ Projects
  ☐ Tags
  ☐ All

[Export Selected]
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create CSV exporter | `src/export/csv-exporter.js` | 5 | None |
| CSV stringification | `src/export/csv-exporter.js` | 3 | None |
| UI: Export options | `src/ui_elements.js` | 2 | None |
| File download handling | `src/export/csv-exporter.js` | 1 | None |

**Total: 11 hours**

---

## 6.3 Data Cleanup Tools

### Specification

**Goal:** Identify and clean up data issues.

**Cleanup Categories:**
```
Data Cleanup:
┌─────────────────────────────────────────┐
│ 🔍 Scan for Issues                      │
├─────────────────────────────────────────┤
│ ⚠️ Duplicate Aliases (3)                │
│    "New chat" appears 3 times           │
│    [Review] [Auto-fix]                  │
├─────────────────────────────────────────┤
│ 📭 Empty Projects (2)                   │
│    "Old Project" - 0 chats              │
│    "Test" - 0 chats                     │
│    [Review] [Delete All]                │
├─────────────────────────────────────────┤
│ 🏷️ Unused Tags (4)                     │
│    "Legacy" - 0 chats                   │
│    [Review] [Delete All]                │
├─────────────────────────────────────────┤
│ 🔗 Orphaned Chats (5)                   │
│    Chats with invalid project refs      │
│    [Review] [Fix]                       │
└─────────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Create cleanup module | `src/data/cleanup-tools.js` | 6 | None |
| Duplicate detection | `src/data/cleanup-tools.js` | 3 | None |
| Orphan detection | `src/data/cleanup-tools.js` | 3 | None |
| UI: Cleanup panel | `src/ui_elements.js` | 4 | None |
| Auto-fix functions | `src/data/cleanup-tools.js` | 4 | None |

**Total: 20 hours**

---

## 6.4 Import Validation & Preview

### Specification

**Goal:** Preview and validate data before importing.

**Import Flow:**
1. Select file → Parse JSON
2. Validate structure → Show errors
3. Preview changes → Show diff
4. Confirm → Import

**Preview UI:**
```
┌─────────────────────────────────────────┐
│ Import Preview                          │
├─────────────────────────────────────────┤
│ Current:    12 projects, 156 chats      │
│ Importing:  5 projects, 42 chats        │
│ Result:     17 projects, 198 chats      │
├─────────────────────────────────────────┤
│ ⚠️ Conflicts Detected:                  │
│    - 3 chat IDs already exist           │
│    - 2 project names duplicate          │
│                                         │
│ Resolution:                             │
│ ○ Skip duplicates                       │
│ ● Overwrite existing                    │
│ ○ Keep both (rename)                    │
├─────────────────────────────────────────┤
│ [Cancel] [Import]                       │
└─────────────────────────────────────────┘
```

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Extend import validation | `src/storage.js` | 4 | None |
| Diff preview calculation | `src/import/preview.js` | 5 | None |
| UI: Import preview modal | `src/ui_elements.js` | 5 | None |
| Conflict resolution UI | `src/ui_elements.js` | 4 | None |

**Total: 18 hours**

---

# 🔌 CATEGORY 7: Integrations

## 7.1 Google Drive Sync

### Specification

**Goal:** Automatically backup to Google Drive.

**Implementation:**
- Use Google Drive API (OAuth2)
- Store backups as private files
- Sync on schedule or manual trigger

**Auth Flow:**
1. User clicks "Connect Drive"
2. OAuth2 popup → Grant permission
3. Store access token (encrypted)
4. Upload backups to Drive folder

**Limitations:**
- Requires OAuth setup in Chrome Dev Console
- May need server-side component for token security

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| OAuth2 setup | `src/integrations/drive-auth.js` | 6 | External API |
| Drive API integration | `src/integrations/drive-sync.js` | 8 | Auth |
| UI: Drive settings | `src/ui_elements.js` | 4 | None |
| Scheduled sync | `src/automation/scheduler.js` | 3 | Scheduler |

**Total: 21 hours**

**Note:** Requires Google Cloud Project setup. Consider for v2.1.

---

## 7.2 GitHub Gist Export

### Specification

**Goal:** Export backups as GitHub Gists.

**Implementation:**
- Use GitHub Personal Access Token
- Create secret gists for backups
- Gist description: "GPM Backup - YYYY-MM-DD"

**Auth:**
- User generates PAT on GitHub
- Enter token in settings (stored encrypted)
- Token stored in chrome.storage.sync (encrypted)

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| GitHub API client | `src/integrations/github-client.js` | 5 | None |
| Gist creation | `src/integrations/gist-export.js` | 4 | None |
| UI: GitHub settings | `src/ui_elements.js` | 3 | None |
| Token encryption | `src/utils/encryption.js` | 3 | None |

**Total: 15 hours**

---

## 7.3 Gemini Native Integration

### Specification

**Goal:** Integrate with Gemini's native features.

**Potential Integrations:**
1. **Native Export:** Hook into Gemini's chat export
2. **Conversation Threading:** If Gemini adds threading
3. **Chat Sharing:** If Gemini adds sharing features

**Current Limitations:**
- No official Gemini API for chat management
- DOM-based integration only
- Features depend on Gemini updates

### Implementation Plan

| Task | File | Hours | Dependencies |
|------|------|-------|--------------|
| Monitor Gemini updates | Ongoing | 2/week | External |
| Native export hook | `src/integrations/gemini-native.js` | 4 | Gemini changes |
| Share menu integration | `src/integrations/gemini-native.js` | 3 | Gemini changes |

**Total: 9 hours** (ongoing)

**Note:** Dependent on Gemini feature releases. Low priority until Gemini exposes APIs.

---

# 📅 IMPLEMENTATION ROADMAP

## Phase 1: Foundation (Sprints 1-2) - 40 hours

**Goal:** Core infrastructure for all features

| Sprint | Features | Hours |
|--------|----------|-------|
| 1 | Schema v4, Auto-tagger, Search Index | 20 |
| 2 | Advanced Filter, Keyboard Shortcuts | 20 |

**Deliverables:**
- Schema v4 migration
- Auto-tagging engine
- Search infrastructure
- Enhanced shortcuts

---

## Phase 2: Organization (Sprints 3-4) - 42 hours

**Goal:** Smart organization features

| Sprint | Features | Hours |
|--------|----------|-------|
| 3 | Folder Suggestions, Tag Presets | 21 |
| 4 | Multi-select, Bulk Operations | 21 |

**Deliverables:**
- Smart folder suggestions
- Tag templates
- Bulk selection UI

---

## Phase 3: Analytics (Sprints 5-6) - 48 hours

**Goal:** Visualization and insights

| Sprint | Features | Hours |
|--------|----------|-------|
| 5 | Statistics Dashboard, Heatmap | 35 |
| 6 | Usage Insights, Notifications | 13 |

**Deliverables:**
- Dashboard UI
- Activity heatmap
- Insights engine

---

## Phase 4: Automation (Sprints 7-8) - 47 hours

**Goal:** Automation and integrations

| Sprint | Features | Hours |
|--------|----------|-------|
| 7 | Auto-Archive, Rules Engine | 43 |
| 8 | Scheduled Tasks, CSV Export | 24 |

**Deliverables:**
- Automation rules
- Task scheduler
- CSV export

---

## Phase 5: Polish (Sprints 9-10) - 49 hours

**Goal:** UX improvements and data management

| Sprint | Features | Hours |
|--------|----------|-------|
| 9 | Command Palette, Context Menus | 25 |
| 10 | Backup History, Cleanup Tools | 44 |

**Deliverables:**
- Command palette
- Enhanced context menus
- Backup diff viewer

---

## Phase 6: Integrations (Sprint 11+) - 36 hours

**Goal:** External integrations

| Sprint | Features | Hours |
|--------|----------|-------|
| 11 | GitHub Gist, Import Preview | 33 |
| 12+ | Google Drive (optional) | 21 |

**Deliverables:**
- Gist export
- Import preview
- Drive sync (optional)

---

# 🧪 TESTING STRATEGY

## Unit Tests

**Coverage Target:** 80%+

```javascript
// Example: Auto-tagger tests
describe('AutoTagger', () => {
  it('should suggest bug tag for bug-related titles', async () => {
    const suggestions = await AutoTagger.suggestTags('Fix login bug');
    expect(suggestions).toContainEqual(expect.objectContaining({
      id: 'bug'
    }));
  });
  
  it('should not suggest tags for generic titles', async () => {
    const suggestions = await AutoTagger.suggestTags('New chat');
    expect(suggestions).toHaveLength(0);
  });
});
```

## Integration Tests

**Test Scenarios:**
1. Chat created → Auto-tagger runs → Tag suggested
2. Filter applied → Tree re-renders → Correct chats shown
3. Automation rule triggers → Action executes → UI updates

## E2E Tests

**Tool:** Playwright (Chrome Extension support)

**Test Flows:**
1. Create project → Add chats → Apply tags → Export CSV
2. Set auto-archive → Wait → Verify archived chats
3. Import backup → Verify data integrity

---

# 📊 SUCCESS METRICS

## Adoption Metrics
- [ ] 50% of users enable auto-tagger
- [ ] 30% use advanced filters weekly
- [ ] 20% create automation rules

## Performance Metrics
- [ ] Search results < 100ms for 1000 chats
- [ ] Dashboard loads < 500ms
- [ ] No memory leaks after 1 hour

## Quality Metrics
- [ ] < 1% crash rate
- [ ] 4.5+ Chrome Web Store rating
- [ ] < 10 bug reports per release

---

# 🔒 SECURITY CONSIDERATIONS

## Data Privacy
- All data remains local (chrome.storage.local)
- No analytics sent to external servers
- Optional integrations (Drive, Gist) require explicit user consent

## Token Security
- OAuth tokens encrypted before storage
- Tokens stored in chrome.storage.sync with encryption
- No tokens sent to third-party servers

## Input Validation
- All user inputs sanitized (existing validators)
- Import data validated before write
- XSS prevention in all UI components

---

# 📝 APPENDIX

## A. Schema Migration (v3 → v4)

```javascript
// In src/storage.js
const GPM_SCHEMA_VERSION = 4;

const MIGRATIONS = {
  4: (data) => {
    // Add new fields to chatMap
    if (data.gpm_chatMap) {
      for (const chatId of Object.keys(data.gpm_chatMap)) {
        if (!data.gpm_chatMap[chatId].lastAccessed) {
          data.gpm_chatMap[chatId].lastAccessed = Date.now();
        }
        if (!data.gpm_chatMap[chatId].createdAt) {
          data.gpm_chatMap[chatId].createdAt = Date.now();
        }
        if (!data.gpm_chatMap[chatId].autoTags) {
          data.gpm_chatMap[chatId].autoTags = [];
        }
        if (!data.gpm_chatMap[chatId].isArchived) {
          data.gpm_chatMap[chatId].isArchived = false;
        }
      }
    }
    
    // Initialize new storage keys
    if (!data.gpm_automation_rules) data.gpm_automation_rules = [];
    if (!data.gpm_archive_settings) data.gpm_archive_settings = { enabled: false };
    if (!data.gpm_search_index) data.gpm_search_index = { words: {}, lastBuilt: Date.now() };
    if (!data.gpm_saved_filters) data.gpm_saved_filters = [];
    
    return data;
  }
};
```

## B. New i18n Keys

```json
{
  "autoTagSuggestions": { "message": "Auto-tag Suggestions" },
  "advancedFilters": { "message": "Advanced Filters" },
  "statistics": { "message": "Statistics" },
  "activityHeatmap": { "message": "Activity Heatmap" },
  "autoArchive": { "message": "Auto-Archive" },
  "automationRules": { "message": "Automation Rules" },
  "scheduledTasks": { "message": "Scheduled Tasks" },
  "commandPalette": { "message": "Command Palette" },
  "backupHistory": { "message": "Backup History" },
  "dataCleanup": { "message": "Data Cleanup" },
  "csvExport": { "message": "CSV Export" },
  "githubGist": { "message": "GitHub Gist" },
  "googleDrive": { "message": "Google Drive" }
}
```

## C. File Checklist

**New Files to Create:**
```
src/smart-organization/auto-tagger.js
src/smart-organization/folder-suggester.js
src/smart-organization/clustering.js
src/smart-organization/tag-presets.js
src/search/advanced-filter.js
src/search/fuzzy-search.js
src/search/search-index.js
src/analytics/dashboard.js
src/analytics/heatmap.js
src/analytics/charts.js
src/analytics/insights.js
src/analytics/stats-calculator.js
src/automation/auto-archive.js
src/automation/rules-engine.js
src/automation/triggers.js
src/automation/actions.js
src/automation/scheduler.js
src/automation/cron-parser.js
src/ui/notifications.js
src/ui/command-palette.js
src/export/csv-exporter.js
src/import/preview.js
src/data/cleanup-tools.js
src/backup/diff-calculator.js
src/integrations/github-client.js
src/integrations/gist-export.js
src/integrations/drive-sync.js
src/integrations/gemini-native.js
src/utils/encryption.js
```

**Total: 29 new files**

---

**Document End**

*Next Steps:*
1. Review this specification
2. Approve/reject features
3. Prioritize phases
4. Invoke writing-plans skill for detailed implementation tasks
