# v1.2.0 — DOM Resilience & Language Expansion Update

## Chrome Web Store Listing — What's New

🔍 Search Bar — New search bar in the Projects sidebar lets you quickly filter and find chats across all projects.

🛡️ DOM Resilience — Extension now auto-recovers when Google Gemini updates its page structure. Multi-strategy toolbar detection ensures the Quick Prompt ⚡ button always appears in the right place.

🐛 Fixed: Quick Prompt button getting stuck as a floating overlay instead of appearing next to the "Tools" button in the input toolbar.

⚡ Improved: Smarter toolbar discovery that uses content-based detection ("Tools" label in 17 languages) as a reliable fallback when CSS class names change.

🌍 Added: 8 new languages — Arabic, Bengali, Hindi, Indonesian, Korean, Portuguese, Thai, Vietnamese (expanded from 9 → 17 languages total).

🐛 Fixed: Data import now correctly preserves Hindi, Korean, and Arabic language preferences.

---

## Chrome Store Short Description (for "What's new" field)

v1.2.0: Added search bar for projects. Fixed Quick Prompt button placement issue. Added self-healing DOM resilience for Gemini UI changes. Added 8 new languages (Arabic, Bengali, Hindi, Indonesian, Korean, Portuguese, Thai, Vietnamese). Now 17 languages supported.

---

## Full Changelog

### 🔍 New Features
- Search bar in Projects sidebar — quickly filter and find chats across all projects

### 🛡️ DOM Resilience
- Self-healing DOM observer — extension auto-recovers when Gemini re-mounts its page
- Adaptive selector engine with structural discovery fallbacks for sidebar and input area
- Multi-strategy toolbar detection (CSS classes → content-based "Tools" label → structural walk-up)
- DOM health monitor with container watchdog

### 🐛 Bug Fixes
- Quick Prompt ⚡ button stuck as floating fallback — retry logic now properly relocates it into the toolbar once available
- MutationObserver and interval check suppressed by floating button presence — both now continue retrying until toolbar placement succeeds
- Data import now correctly preserves Hindi, Korean, and Arabic language preferences

### ⚡ Improvements
- Quick Prompt button toolbar discovery walks up from "Tools" label to find proper toolbar row container
- MutationObserver uses content-based detection ("Tools" label in 17 languages) to trigger toolbar injection
- Enhanced diagnostic logging for easier troubleshooting

### 🌍 Language Expansion (9 → 17 languages)
- Added Arabic (العربية)
- Added Bengali (বাংলা)
- Added Hindi (हिन्दी)
- Added Indonesian (Bahasa Indonesia)
- Added Korean (한국어)
- Added Portuguese (Português)
- Added Thai (ไทย)
- Added Vietnamese (Tiếng Việt)
- Now supports 17 languages total
