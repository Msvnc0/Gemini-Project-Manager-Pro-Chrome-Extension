# Tag Feature Removal Design

**Date:** 2026-04-03
**Status:** Approved

## Goal

Remove the entire tag/label system from Gemini Project Manager Pro while preserving the star/favorite functionality.

## Scope

### Delete
- `src/tags/tag-manager.js`
- `src/tags/tags-manager.js`
- `src/tags/tag-ui.js`
- `tests/tags/` directory

### Relocate
- `createStarButton()` from `tag-ui.js` → new file `src/ui/star-button.js`
- `.gpm-star-btn` CSS stays in `styles.css`

### Modify — Source Files

**manifest.json:**
- Remove 3 `src/tags/*` entries
- Add `src/ui/star-button.js`

**src/content.js:**
- Remove Step 13 (tag filter bar initialization)

**src/project-tree.js:**
- Remove tag loading for search (`getTags()`)
- Remove tag matching in `projectMatchesSearch()`
- Remove tag badge rendering (`source === 'tag'`)
- Remove tags submenu from chat context menu
- Remove "Tag Selected" bulk action button and handler
- Remove `gpmBulkAssignTags()` and `showBulkTagModal()`

**src/storage.js:**
- Remove tag storage functions: `getTags`, `saveTags`, `createTag`, `updateTag`, `deleteTag`, `getChatsByTag`, `assignTagsToChat`, `removeTagFromChat`
- Keep migration v3/v4 untouched (they silently handle tag data without breaking)
- Remove tag validation/import from `exportAll()` and `importAll()`
- Remove `gpm_tags` reset from `clearAll()`

**src/history/undo-redo.js:**
- Remove `tag_add` and `tag_remove` cases

**src/utils/validators.js:**
- Remove `MAX_TAG_NAME_LENGTH`, `sanitizeTagColor`, `VALID_TAG_COLORS`, `validateTag`
- Remove `tags` field handling from `validateChatMapping`

**src/sort-manager.js:**
- Remove `groupChatsByTag()` function

**src/styles.css:**
- Remove `.gpm-tag-badge`, `.gpm-tag-chip`, `.gpm-tag-chip-active`, `.gpm-tag-chip-remove`, `.gpm-tag-selector`, `.gpm-tag-selector-trigger`, `.gpm-tag-selector-dropdown`, `.gpm-tag-selector-item`, `.gpm-tag-filter-bar`
- Keep `.gpm-star-btn` styles

### Modify — Locale Files (17 languages)
Remove these keys from all `_locales/*/messages.json`:
`tags`, `createTag`, `tagName`, `tagNamePlaceholder`, `tagColor`, `noTags`, `maxTagsReached`, `tagSelected`, `taggedChats`

### Modify — Test Files
- `tests/storage.test.js` — remove tag-related tests (~12 cases + migration)
- `tests/sort-manager.test.js` — remove `groupChatsByTag` test
- `tests/history/undo-redo.test.js` — remove `tag_add`/`tag_remove` tests
- `tests/validators.test.js` — remove `validateTag` tests

## Data Safety

Existing users' `gpm_tags` data in Chrome Storage will remain but become inert. Migration code is preserved to avoid breaking schema versioning.
