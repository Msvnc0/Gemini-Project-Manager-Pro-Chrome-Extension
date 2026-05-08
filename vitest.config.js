import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/storage.js', 'src/i18n.js', 'src/config.js', 'src/selectors.js', 'src/dom-injection.js', 'src/quick-prompts.js', 'src/navigation.js', 'src/utils/validators.js', 'src/history/undo-redo.js', 'src/analytics/usage-tracker.js', 'src/keyboard/shortcuts.js', 'src/backup/backup-manager.js', 'src/sync/sync-manager.js', 'src/favorites-manager.js'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
      },
    },
    setupFiles: ['tests/mocks/chrome.js'],
  },
});
