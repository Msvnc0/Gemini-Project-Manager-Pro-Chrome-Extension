# v1.2.3 — Post-Import Cleanup

## Chrome Web Store Listing — What's New

✨ New: After importing or restoring a backup, the extension now automatically removes chats that were deleted from Gemini. No more ghost entries from old backups!

💬 You'll see a notification showing exactly how many deleted chats were cleaned up.

---

## Chrome Store Short Description (for "What's new" field)

v1.2.3: Automatic cleanup after backup restore — deleted chats are removed from projects. Retry logic handles slow-loading sidebars. Notification shows cleanup results.

---

## Full Changelog

### ✨ New Features
- **Post-import cleanup** — After importing data or restoring from backup, the extension automatically checks for chats that no longer exist in Gemini's sidebar and removes them from GPM projects
- **User notification** — Shows a dialog with the count of deleted chats that were cleaned up (e.g., "3 silinmiş sohbet projelerden kaldırıldı")

### 🔄 Reliability
- **Retry logic** — Up to 3 attempts with 1.5-second intervals to wait for Gemini sidebar to load
- **Graceful fallback** — If sidebar never loads, cleanup is silently skipped (no error shown to user)

### 🌍 Localization
- **New message** — `deletedChatsCleaned` added to all 17 supported languages

### ⚡ Technical Details
- New `gpmCleanupAfterImport()` function in `navigation.js`
- Called from `onImport` and `onRestoreBackup` callbacks in `project-tree.js`
- Returns count of removed chats for user notification
- Single-pass verification (no two-phase needed for intentional import operations)