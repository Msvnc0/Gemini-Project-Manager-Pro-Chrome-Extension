# v1.2.1 — Deleted Chat Sync Fix

## Chrome Web Store Listing — What's New

🐛 Fixed: Chats deleted from Gemini's native interface now automatically disappear from GPM project folders. Previously, deleted chats remained as ghost entries in the project tree.

🛡️ Two-phase verification ensures no false positives — chats are only removed after being confirmed missing in two consecutive checks.

---

## Chrome Store Short Description (for "What's new" field)

v1.2.1: Fixed deleted chat sync — chats removed from Gemini's native sidebar now automatically disappear from project folders. Two-phase verification prevents false positives.

---

## Full Changelog

### 🐛 Bug Fixes
- **Deleted chat sync** — Chats deleted from Gemini's native chat interface now automatically removed from GPM project folders and chat map storage
- Previously, deleted chats remained as ghost entries in the project tree indefinitely

### 🛡️ Reliability
- **Two-phase deletion verification** — Orphaned chat IDs are detected in a first pass, then re-verified after a 2-second debounce to prevent false positives from Gemini's lazy-loading or DOM recycling
- **Safety guard** — Deletion detection is skipped when sidebar has zero chat links (indicates Gemini is still loading, not that all chats were deleted)

### ⚡ Technical Details
- New `gpmDetectDeletedChats()` function in `navigation.js` compares sidebar DOM chat links against stored chat IDs
- Integrated into existing sidebar MutationObserver — triggers only on `removedNodes` events
- New config constants: `DELETION_CHECK_DEBOUNCE` (2000ms)
- New state fields: `_deletionCheckTimer`, `_pendingDeletedChatIds`
- State cleanup properly handled in `gpmResetState()`
