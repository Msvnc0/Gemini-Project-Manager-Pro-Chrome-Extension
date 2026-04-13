# Gemini Project Manager Pro

Transform your Gemini AI sidebar into a professional workspace with projects, folders, and quick prompts.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jmngplnmgpfacedmkemopgdbapjbcmjk?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
[![Users](https://img.shields.io/chrome-web-store/users/jmngplnmgpfacedmkemopgdbapjbcmjk)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
[![Rating](https://img.shields.io/chrome-web-store/rating/jmngplnmgpfacedmkemopgdbapjbcmjk)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)

## Installation

### Option 1: Chrome Web Store (Recommended)

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)**

### Option 2: Manual Installation

1. **Download the Extension**
   - Go to [Releases](https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension/releases)
   - Download the latest `gemini-project-manager-pro.zip`
   - Extract the ZIP file to a folder

2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the extracted `gemini-project-manager-pro` folder
   - The extension icon should appear in your toolbar

3. **Start Using**
   - Visit [gemini.google.com](https://gemini.google.com)
   - You'll see the new "Projects" section in the sidebar
   - Start organizing your chats!

### Option 3: Build from Source

```bash
# Clone the repository
git clone https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension.git

# Navigate to the folder
cd Gemini-Project-Manager-Pro-Chrome-Extension

# Load in Chrome as unpacked extension (see Option 2, step 2)
```

## Features

### Project Organization
- Create unlimited projects and subfolders
- Drag & drop chats into projects
- Custom icons and colors for each project
- Nested folder structure support
- Project reordering via drag & drop

### Quick Prompts
- Save frequently used prompts
- One-click prompt insertion
- Search and filter prompts
- Backup and restore functionality
- Token count estimation

### Multi-Language Support
- English, Turkish, German, French, Spanish
- Italian, Portuguese, Russian, Japanese, Chinese
- Hindi, Korean, Arabic, Vietnamese, Indonesian
- Bengali, Thai
- Automatic language detection
- 17 languages supported

### Native Integration
- Seamless Gemini UI integration
- Dark mode support
- Google Sans typography
- Material Design 3 aesthetics

### Data Management
- Export/import all data as JSON
- Export filename includes date and time (e.g. `gpm-backup-2026-04-05_14-07-34.json`)
- Auto-backup before every save
- Restore from last backup via Settings
- Manage Backups panel — create, restore, or individually delete backups
- Single backup slot with quota monitoring (warns at 80% of 10MB limit)
- Local storage (no cloud sync)
- Privacy-focused design

### Favorites
- Star/unstar any chat for quick access
- Starred chats sorted by date
- Available across all projects

### Data Protection
- Automatic backup before every data modification
- "Restore from Backup" button in Settings with timestamp preview
- Mutex-based write protection for multi-tab safety
- Cross-tab lock with 5s timeout prevents concurrent writes
- Atomic saves — projects and chatMap written in a single operation
- 3-phase deletion verification with safety ratio check
- Schema v5 migration removes all legacy backup keys
- `unlimitedStorage` permission not needed — quota-aware design

## Usage

### Creating Projects
1. Click "+ New Project" in the sidebar
2. Choose an icon and color (or pick a category preset)
3. Name your project
4. Drag chats into the project

### Quick Prompts
1. Click the button in the input toolbar
2. Add your frequently used prompts
3. Click any prompt to insert it

### Settings
1. Click the gear icon in Projects header
2. Change language
3. Export/import data
4. Restore from backup if needed
5. Manage your workspace

### Managing Backups
1. Click "Manage Backups" in Settings
2. Create a new manual backup
3. Restore or delete any individual backup
4. Each backup shows timestamp, project count, and chat count

### Restoring Lost Data
If you notice missing chats in your projects:
1. Click the gear icon in the Projects header
2. Click "Restore from Backup" — it shows the backup timestamp and content count
3. Confirm to restore your projects and chats

## Privacy

All data is stored locally in your browser. No data is sent to external servers. The extension only requires the `storage` permission to save your projects and settings.

## Changelog

### v1.2.7 — Stability & Reliability Update

🐛 False Deletion Fix:

- Fixed false-positive "chat deleted" detection when Gemini's sidebar loads chats lazily — the extension no longer treats unloaded chats as deleted
- Added sidebar stabilization tracking: deletion detection now waits until the sidebar chat count stabilizes (2 consecutive identical counts) before running any checks
- Stricter threshold: deletion check is skipped entirely if DOM chat count is less than stored chat count, preventing premature false positives
- Stabilization resets on tab visibility change to handle fresh sidebar loads correctly

⌨️ Input Fixes:

- Fixed a regression where the Space key stopped working in Gemini's message composer because global keyboard shortcuts were incorrectly intercepting contenteditable input fields
- Made keyboard shortcut initialization idempotent to prevent duplicate listeners during re-initialization

🔄 Data & Sync Reliability:

- Reworked routine UI refresh sync to react to `chrome.storage` changes instead of relying on tab messaging for standard refresh flows
- Made import and backup restore flows atomic by validating first, creating a backup, and writing the full target state in a single storage operation
- Reduced sync fragility by removing routine dependency on `chrome.tabs` messaging for local refresh propagation

🧪 Test & Stability Improvements:

- Added coverage for duplicate keyboard shortcut initialization
- Strengthened test and mock infrastructure for storage change handling
- Improved DOM observer cleanup behavior during re-initialization and tests

### v1.2.6 — Security Hardening

🔒 Input Sanitization:

- Switched to allowlist-based text sanitization — only known-safe characters are allowed (letters, numbers, punctuation, emoji, and international characters)
- Turkish, CJK, Arabic, and other Unicode scripts are fully preserved while blocking potential XSS characters

⌨️ Input Fixes:

- Fixed a regression where the Space key stopped working in Gemini's message composer because global keyboard shortcuts were incorrectly intercepting contenteditable input fields
- Made keyboard shortcut initialization idempotent to prevent duplicate listeners during re-initialization

🔄 Data & Sync Reliability:

- Reworked local sync handling to react to `chrome.storage` changes instead of relying on tab messaging for routine UI refreshes
- Made import and backup restore flows atomic by validating first, creating a backup, and writing the full target state in a single storage operation

🛡️ Error Handling:

- Invalid JSON imports now show a clear error message with character position hint instead of crashing silently
- Lock chain errors are now logged to console for debugging instead of being silently swallowed

🧹 DOM Safety:

- Replaced `innerHTML` usage in bulk toolbar with safe DOM methods (`createElement` + `textContent`) — eliminates potential XSS injection vector

### v1.2.5 — Backup Management & Data Safety Overhaul

💾 Backup Management:

- Added delete button for each backup in the Manage Backups panel — you can now individually remove backups you no longer need
- Export filename now includes human-readable date and time (e.g. `gpm-backup-2026-04-05_14-07-34.json`) instead of random numbers
- Consolidated 7+ backup keys into a single slot — prevents storage quota overflow
- Quota monitoring warns at 80% of 10MB limit and skips backup automatically if storage is nearly full
- `deleteBackupConfirm` translation added for all 17 languages

⭐ Favorites:

- Star/unstar any chat for quick access across all projects — replaces the old tag/label system
- Starred chats sorted by date for easy browsing

🛡️ Data Safety:

- Fixed critical schema version conflict between storage and background scripts that could cause data loss during extension updates
- Cross-tab write lock with 5s timeout prevents data corruption when using multiple Gemini tabs
- Atomic saves — projects and chat mappings are now written in a single operation
- 3-phase deletion verification with safety ratio check ensures chats are never falsely removed
- `unlimitedStorage` permission removed — no longer needed with the new quota-aware design

### v1.2.3 — Post-Import Cleanup
- ✨ **Added:** Automatic cleanup after importing/restoring backup — deleted chats are now removed from GPM projects
- 🔄 **Added:** Retry logic (3 attempts, 1.5s intervals) waits for Gemini sidebar to load before cleanup
- 💬 **Added:** User notification showing how many deleted chats were cleaned up
- 🌍 **Added:** `deletedChatsCleaned` message in all 17 languages

### v1.2.2 — Chrome Web Store Compliance
- 🐛 **Fixed:** `zh_CN` locale folder renamed to `zh-CN` (Chrome requires hyphen format)
- 🐛 **Fixed:** Removed illegal `nul` file that caused Chrome extension loading error
- 🌍 **Updated:** Chinese language code standardized across all files (`zh` → `zh-CN`)

### v1.2.1 — Deleted Chat Sync Fix
- 🐛 **Fixed:** Chats deleted from Gemini's native interface now automatically disappear from GPM project folders — no more ghost entries
- 🛡️ **Added:** Two-phase deletion verification with debounce prevents false positives from Gemini's lazy-loading or DOM recycling
- 🛡️ **Added:** Safety guard skips cleanup when sidebar is still loading (zero chat links detected)

### v1.2.0 — DOM Resilience & Language Expansion Update
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

### v1.1.0 — Data Safety Update
- 🐛 **Fixed:** Critical bug where chats assigned to projects would randomly disappear due to false-positive cleanup triggered by Gemini's lazy-loading sidebar
- 🛡️ **Added:** Auto-backup before every save — your data is always protected
- 🛡️ **Added:** "Restore from Backup" button in Settings with timestamp and content preview
- 🛡️ **Added:** Mutex-based write serialization prevents data corruption across multiple tabs
- ⚡ **Improved:** Cross-tab sync debounced (300ms) for smoother multi-tab experience
- 🗑️ **Removed:** Aggressive auto-cleanup that incorrectly removed chats not visible in sidebar DOM

### v1.0.0 — Initial Release
- Project and subfolder creation with custom icons and colors
- Drag & drop chat organization
- Quick prompts with search, edit, backup/restore
- 10-language localization
- Native Gemini UI integration with dark/light mode
- Export/import all data as JSON

## Support

- [Report Issues](https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension/issues)
- [Rate on Chrome Web Store](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
- [Discussions](https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension/discussions)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) file for details

---

**Published on Chrome Web Store:** [Gemini Project Manager Pro](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
