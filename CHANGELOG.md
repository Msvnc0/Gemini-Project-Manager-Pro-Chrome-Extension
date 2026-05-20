# Changelog

## v1.3.0 — Faster Initialization

- **Perf:** Projects now inject immediately into sidebar even before chat links load (was silently aborting)
- **Perf:** Sidebar content wait reduced from 10s to 3s — projects render into empty sidebar
- **Perf:** Navigation re-inject delay reduced from 600ms to 300ms
- **Perf:** Storage reads parallelized in render (getProjects + getChatMap)

## v1.2.9

- **Fix:** Drag-drop chat title was stale — now reads live from DOM at drag time
- **Fix:** Search input stripped spaces on each keystroke — spaces are now preserved

## v1.2.8 — Gemini UI Compatibility & Health Scan

🔧 **Gemini New UI Compatibility:**

- Fixed Projects section appearing in the wrong place (top bar instead of left sidebar) on Gemini's redesigned layout
- Sidebar is now discovered by climbing up from chat links instead of relying on fragile CSS selectors
- Quick Prompt button no longer flickers — added fast-path cache, stale insertRef guard, and floating button idempotency
- Reduced initialization latency by parallelizing storage, sidebar wait, and non-blocking setup steps

🛡️ **Health Scan & Stability:**

- Fixed critical `gpmInit` deadlock: `_initializing` flag is now guaranteed to clear via `try/finally`, preventing permanent init lock after any error
- Cross-tab write lock (`_withLock`) now skips execution instead of running unlocked when lock cannot be acquired
- Added `createdAt`/`updatedAt` timestamps to all newly created/updated projects
- Timer leak fixes: `gpmCleanupObservers` now clears `_deletionCheckTimer` and `_sidebarStabilizeTimer`
- Auto-assign promise (`GPMStorage.assignChat`) now has `.catch` to prevent unhandled rejections
- Sidebar observer resilience: if `gpmInit` throws inside observer, it re-attaches itself for retry

🧹 **Code Quality:**

- Lint: 88 warnings → 0 (dead globals removed, `var`→`let/const`, unused params prefixed)
- ESLint globals cleaned up: removed `_gpmIsValidSidebar`, `GPM_LANG`, `showToast`, `gpmFindInsertionPoint`; added `gpmStopHealthMonitor`, `gpmObserveForSidebar`

## v1.2.7 — Stability & Reliability Update

🐛 **False Deletion Fix:**

- Fixed false-positive "chat deleted" detection when Gemini's sidebar loads chats lazily — the extension no longer treats unloaded chats as deleted
- Added sidebar stabilization tracking: deletion detection now waits until the sidebar chat count stabilizes (2 consecutive identical counts) before running any checks
- Stricter threshold: deletion check is skipped entirely if DOM chat count is less than stored chat count, preventing premature false positives
- Stabilization resets on tab visibility change to handle fresh sidebar loads correctly

⌨️ **Input Fixes:**

- Fixed a regression where the Space key stopped working in Gemini's message composer because global keyboard shortcuts were incorrectly intercepting contenteditable input fields
- Made keyboard shortcut initialization idempotent to prevent duplicate listeners during re-initialization

🔄 **Data & Sync Reliability:**

- Reworked routine UI refresh sync to react to `chrome.storage` changes instead of relying on tab messaging for standard refresh flows
- Made import and backup restore flows atomic by validating first, creating a backup, and writing the full target state in a single storage operation
- Reduced sync fragility by removing routine dependency on `chrome.tabs` messaging for local refresh propagation

🧪 **Test & Stability Improvements:**

- Added coverage for duplicate keyboard shortcut initialization
- Strengthened test and mock infrastructure for storage change handling
- Improved DOM observer cleanup behavior during re-initialization and tests

## v1.2.6 — Security Hardening

🔒 **Input Sanitization:**

- Switched to allowlist-based text sanitization — only known-safe characters are allowed (letters, numbers, punctuation, emoji, and international characters)
- Turkish, CJK, Arabic, and other Unicode scripts are fully preserved while blocking potential XSS characters

⌨️ **Input Fixes:**

- Fixed a regression where the Space key stopped working in Gemini's message composer because global keyboard shortcuts were incorrectly intercepting contenteditable input fields
- Made keyboard shortcut initialization idempotent to prevent duplicate listeners during re-initialization

🔄 **Data & Sync Reliability:**

- Reworked local sync handling to react to `chrome.storage` changes instead of relying on tab messaging for routine UI refreshes
- Made import and backup restore flows atomic by validating first, creating a backup, and writing the full target state in a single storage operation

🛡️ **Error Handling:**

- Invalid JSON imports now show a clear error message with character position hint instead of crashing silently
- Lock chain errors are now logged to console for debugging instead of being silently swallowed

🧹 **DOM Safety:**

- Replaced `innerHTML` usage in bulk toolbar with safe DOM methods (`createElement` + `textContent`) — eliminates potential XSS injection vector

## v1.2.5 — Backup Management & Data Safety Overhaul

💾 **Backup Management:**

- Added delete button for each backup in the Manage Backups panel — you can now individually remove backups you no longer need
- Export filename now includes human-readable date and time (e.g. `gpm-backup-2026-04-05_14-07-34.json`) instead of random numbers
- Consolidated 7+ backup keys into a single slot — prevents storage quota overflow
- Quota monitoring warns at 80% of 10MB limit and skips backup automatically if storage is nearly full
- `deleteBackupConfirm` translation added for all 17 languages

⭐ **Favorites:**

- Star/unstar any chat for quick access across all projects — replaces the old tag/label system
- Starred chats sorted by date for easy browsing

🛡️ **Data Safety:**

- Fixed critical schema version conflict between storage and background scripts that could cause data loss during extension updates
- Cross-tab write lock with 5s timeout prevents data corruption when using multiple Gemini tabs
- Atomic saves — projects and chat mappings are now written in a single operation
- 3-phase deletion verification with safety ratio check ensures chats are never falsely removed
- `unlimitedStorage` permission removed — no longer needed with the new quota-aware design

## v1.2.3 — Post-Import Cleanup

- ✨ **Added:** Automatic cleanup after importing/restoring backup — deleted chats are now removed from GPM projects
- 🔄 **Added:** Retry logic (3 attempts, 1.5s intervals) waits for Gemini sidebar to load before cleanup
- 💬 **Added:** User notification showing how many deleted chats were cleaned up
- 🌍 **Added:** `deletedChatsCleaned` message in all 17 languages

## v1.2.2 — Chrome Web Store Compliance

- 🐛 **Fixed:** `zh_CN` locale folder renamed to `zh-CN` (Chrome requires hyphen format)
- 🐛 **Fixed:** Removed illegal `nul` file that caused Chrome extension loading error
- 🌍 **Updated:** Chinese language code standardized across all files (`zh` → `zh-CN`)

## v1.2.1 — Deleted Chat Sync Fix

- 🐛 **Fixed:** Chats deleted from Gemini's native interface now automatically disappear from GPM project folders — no more ghost entries
- 🛡️ **Added:** Two-phase deletion verification with debounce prevents false positives from Gemini's lazy-loading or DOM recycling
- 🛡️ **Added:** Safety guard skips cleanup when sidebar is still loading (zero chat links detected)

## v1.2.0 — DOM Resilience & Language Expansion Update

- 🔍 **Added:** Search bar in Projects sidebar — quickly filter and find chats across all projects
- 🛡️ **Added:** Self-healing DOM observer — extension auto-recovers when Gemini re-mounts its page
- 🛡️ **Added:** Adaptive selector engine with structural discovery fallbacks for sidebar and input area
- 🛡️ **Added:** Multi-strategy toolbar detection (CSS classes, content-based "Tools" label search, structural walk-up)
- 🛡️ **Added:** DOM health monitor with container watchdog
- 🐛 **Fixed:** Quick Prompt ⚡ button stuck as floating fallback — retry logic now properly relocates it into the toolbar once available
- 🐛 **Fixed:** MutationObserver and interval check suppressed by floating button presence — both now continue retrying until toolbar placement succeeds
- ⚡ **Improved:** Quick Prompt button toolbar discovery walks up from "Tools" label to find proper toolbar row container
- ⚡ **Improved:** MutationObserver uses content-based detection ("Tools" label in 17 languages) to trigger toolbar injection
- 🌍 **Added:** 8 new languages: Arabic (العربية), Bengali (বাংলা), Hindi (हिन्दी), Indonesian (Bahasa Indonesia), Korean (한국어), Portuguese (Português), Thai (ไทย), Vietnamese (Tiếng Việt)
- 🐛 **Fixed:** Data import now correctly preserves Hindi, Korean, and Arabic language preferences
- 📊 Expanded from 9 → 17 languages total

## v1.1.0 — Data Safety Update

- 🐛 **Fixed:** Critical bug where chats assigned to projects would randomly disappear due to false-positive cleanup triggered by Gemini's lazy-loading sidebar
- 🛡️ **Added:** Auto-backup before every save — your data is always protected
- 🛡️ **Added:** "Restore from Backup" button in Settings with timestamp and content preview
- 🛡️ **Added:** Mutex-based write serialization prevents data corruption across multiple tabs
- ⚡ **Improved:** Cross-tab sync debounced (300ms) for smoother multi-tab experience
- 🗑️ **Removed:** Aggressive auto-cleanup that incorrectly removed chats not visible in sidebar DOM

## v1.0.0 — Initial Release

- Project and subfolder creation with custom icons and colors
- Drag & drop chat organization
- Quick prompts with search, edit, backup/restore
- 10-language localization
- Native Gemini UI integration with dark/light mode
- Export/import all data as JSON
