# AGENTS.md — Gemini Project Manager Pro

Chrome extension (Manifest V3) that adds project/folder organization to the Gemini AI sidebar. No build step — files in `src/` are loaded directly by Chrome.

## Commands

```bash
npm run lint           # ESLint on src/ (no typecheck — plain JS)
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier on src/**/*.{js,css,json}
npm run format:check   # Prettier dry-run
npm test               # Vitest, single run (jsdom env)
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest with v8 coverage
```

Recommended order: `lint → format:check → test`

## Architecture

**Content scripts share a global scope** — they are NOT ES modules. The `manifest.json` `content_scripts` array loads files in dependency order. Each file attaches objects/functions to the global `window`. The ESLint config declares all cross-file globals explicitly; do not add `import`/`export` statements to `src/` files.

**Test files (`tests/`) ARE ES modules** — they use `import`/`export` and vitest globals.

### Loading order (from manifest.json)

1. `i18n.js` → `utils/uid.js` → `utils/validators.js` → `storage.js` → `selectors.js` → `ui_elements.js`
2. `config.js` (depends on i18n, storage, selectors)
3. Feature modules: `recovery/`, `backup/`, `sync/`, `templates/`, `keyboard/`, `history/`, `analytics/`
4. `favorites-manager.js` → `ui/toast.js` → `project-tree.js` → `dom-injection.js` → `quick-prompts.js` → `navigation.js`
5. `content.js` — bootstrapper/coordinator, runs last

`background.js` is the service worker (separate context), handles schema migrations and write-lock messaging.

### Key directories

- `src/` — all extension source (loaded as-is, no bundler)
- `src/styles.css` — injected via `web_accessible_resources`
- `_locales/{lang}/messages.json` — 17 languages, i18n via `chrome.i18n`
- `tests/mocks/chrome.js` — chrome API mock setup (auto-loaded via `setupFiles`)
- `plans/`, `docs/` — planning docs, not shipped

## Testing

- Vitest with jsdom, globals enabled (`describe`, `it`, `expect` available without import)
- Chrome API mock installed globally via `tests/mocks/chrome.js` setup file
- Import helpers from the mock: `import { resetMockStorage, setMockStorage, getMockStorage, triggerStorageOnChanged } from './mocks/chrome.js'`
- Tests mirror `src/` structure: `tests/storage.test.js` → `src/storage.js`
- Coverage thresholds: 80% statements for files listed in `vitest.config.js` `coverage.include`

## Code style

- Prettier: single quotes, trailing comma es5, 120 char width, 2-space tabs, semicolons, CRLF line endings
- Prefix unused params/vars with `_` (eslint `no-unused-vars` ignores them)
- Use `gpmLog`/`gpmWarn`/`gpmError` wrappers instead of raw `console.*` in `src/`
- No `innerHTML` — use safe DOM methods (`createElement` + `textContent`)
- `sourceType: 'script'` for src files; `sourceType: 'module'` for test files

## Storage schema

Current schema version: **5** (tracked in both `storage.js` and `background.js`).

Storage keys: `gpm_schemaVersion`, `gpm_projects`, `gpm_chatMap`, `gpm_quickPrompts`, `gpm_settings`, `gpm_backup_current`, `gpm_lastExtensionUpdate`.

Migrations run in `background.js` on extension update. Add new migrations to the `GPM_MIGRATIONS` array in both `storage.js` (content-side) and `background.js` (service-worker side) — keep them in sync.
