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

See [CHANGELOG.md](./CHANGELOG.md) for full version history.

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
