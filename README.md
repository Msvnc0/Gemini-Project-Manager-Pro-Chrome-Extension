# Gemini Project Manager Pro

Transform your Gemini AI sidebar into a professional workspace with projects, folders, and quick prompts.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jmngplnmgpfacedmkemopgdbapjbcmjk?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
[![Users](https://img.shields.io/chrome-web-store/users/jmngplnmgpfacedmkemopgdbapjbcmjk)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
[![Rating](https://img.shields.io/chrome-web-store/rating/jmngplnmgpfacedmkemopgdbapjbcmjk)](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)

## 🚀 Installation

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

### 📁 Project Organization
- Create unlimited projects and subfolders
- Drag & drop chats into projects
- Custom icons and colors for each project
- Nested folder structure support
- Project reordering via drag & drop

### ⚡ Quick Prompts
- Save frequently used prompts
- One-click prompt insertion
- Search and filter prompts
- Backup and restore functionality
- Token count estimation

### 🌍 Multi-Language Support
- English, Turkish, German, French, Spanish
- Italian, Portuguese, Russian, Japanese, Chinese
- Hindi, Korean, Arabic, Vietnamese, Indonesian
- Bengali, Thai
- Automatic language detection
- 17 languages supported

### 🎨 Native Integration
- Seamless Gemini UI integration
- Dark mode support
- Google Sans typography
- Material Design 3 aesthetics

### 💾 Data Management
- Export/import all data as JSON
- Auto-backup before every save
- Restore from last backup via Settings
- Local storage (no cloud sync)
- Privacy-focused design

### 🛡️ Data Protection (v1.1.0)
- Automatic backup before every data modification
- "Restore from Backup" button in Settings with timestamp preview
- Mutex-based write protection for multi-tab safety
- Cross-tab sync with debounce for smooth performance

## Usage

### Creating Projects
1. Click "+ New Project" in the sidebar
2. Choose an icon and color (or pick a category preset)
3. Name your project
4. Drag chats into the project

### Quick Prompts
1. Click the ⚡ button in the input toolbar
2. Add your frequently used prompts
3. Click any prompt to insert it

### Settings
1. Click the ⚙ gear icon in Projects header
2. Change language
3. Export/import data
4. Restore from backup if needed
5. Manage your workspace

### Restoring Lost Data
If you notice missing chats in your projects:
1. Click ⚙ in the Projects header
2. Click "Restore from Backup" — it shows the backup timestamp and content count
3. Confirm to restore your projects and chats

## Privacy

All data is stored locally in your browser. No data is sent to external servers. The extension only requires the `storage` permission to save your projects and settings.

## Changelog

### v1.1.0 — Data Safety Update
- 🐛 **Fixed:** Critical bug where chats assigned to projects would randomly disappear due to false-positive cleanup triggered by Gemini's lazy-loading sidebar
- 🛡️ **Added:** Auto-backup before every save — your data is always protected
- 🛡️ **Added:** "Restore from Backup" button in Settings with timestamp and content preview
- 🛡️ **Added:** Mutex-based write serialization prevents data corruption across multiple tabs
- ⚡ **Improved:** Cross-tab sync debounced (300ms) for smoother multi-tab experience
- 🗑️ **Removed:** Aggressive auto-cleanup that incorrectly removed chats not visible in sidebar DOM

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
- 🌍 **Added:** 8 new languages: Arabic (العربية), Bengali (বাংলা), Hindi (हिন्दी), Indonesian (Bahasa Indonesia), Korean (한국어), Portuguese (Português), Thai (ไทย), Vietnamese (Tiếng Việt)
- 🐛 **Fixed:** Data import now correctly preserves Hindi, Korean, and Arabic language preferences
- 📊 Expanded from 9 → 17 languages total

### v1.0.0 — Initial Release
- Project and subfolder creation with custom icons and colors
- Drag & drop chat organization
- Quick prompts with search, edit, backup/restore
- 10-language localization
- Native Gemini UI integration with dark/light mode
- Export/import all data as JSON

## Support

- 🐛 [Report Issues](https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension/issues)
- ⭐ [Rate on Chrome Web Store](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
- 💬 [Discussions](https://github.com/Msvnc0/Gemini-Project-Manager-Pro-Chrome-Extension/discussions)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See [LICENSE](LICENSE) file for details

---

**Published on Chrome Web Store:** [Gemini Project Manager Pro](https://chromewebstore.google.com/detail/gemini-project-manager-pr/jmngplnmgpfacedmkemopgdbapjbcmjk)
