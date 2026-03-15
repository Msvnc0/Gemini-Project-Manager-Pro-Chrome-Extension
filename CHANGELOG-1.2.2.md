# v1.2.2 — Chrome Web Store Compliance

## Chrome Web Store Listing — What's New

🐛 Fixed: Extension now loads correctly in Chrome — resolved duplicate `messages.json` error and illegal `nul` file issue.

🌍 Chinese locale folder renamed to standard `zh-CN` format.

---

## Chrome Store Short Description (for "What's new" field)

v1.2.2: Fixed Chrome Web Store upload errors — renamed `zh_CN` to `zh-CN` locale, removed illegal `nul` file.

---

## Full Changelog

### 🐛 Bug Fixes
- **Chrome Web Store upload error** — Fixed "Duplicate files found in package: messages.json" caused by `zh_CN` folder naming
- **Extension loading error** — Fixed "Cannot load extension with file or directory name nul" by removing illegal `nul` file from project root

### 🌍 Localization
- **Chinese locale** — Renamed `_locales/zh_CN` folder to `_locales/zh-CN` (Chrome requires hyphen format for locale codes)
- **Code updates** — Updated all `zh` references to `zh-CN` in `i18n.js`, `storage.js`, and test files
- **Native name** — Updated Chinese display name to `中文 (简体)`

### ⚡ Technical Details
- Updated `SUPPORTED_LANG_CODES` array in `i18n.js`
- Updated `validLangs` array in `storage.js`
- Updated `LANG_ALIASES` map to redirect all zh variants to `zh-CN`
- Updated all 17 language test cases in `i18n.test.js`