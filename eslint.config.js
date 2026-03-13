import globals from 'globals';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // Chrome extension content scripts are not ES modules
      globals: {
        ...globals.browser,
        // Chrome Extension APIs
        chrome: 'readonly',
        // GPM globals (loaded via content_scripts in order)
        GPM_STRINGS: 'readonly',
        GPM_LANG: 'writable',
        gpmSetLang: 'readonly',
        t: 'readonly',
        GPMStorage: 'readonly',
        GPM_SELECTORS: 'readonly',
        gpmQuerySelector: 'readonly',
        gpmQuerySelectorAll: 'readonly',
        GPMUI: 'readonly',
        GPM_CONFIG: 'readonly',
        GPM_STATE: 'readonly',
        gpmLog: 'readonly',
        gpmWarn: 'readonly',
        gpmError: 'readonly',
        gpmIsContextValid: 'readonly',
        extractChatIdFromUrl: 'readonly',
        gpmWaitForElement: 'readonly',
        // dom-injection.js
        gpmInjectStyles: 'readonly',
        gpmCreateModalHost: 'readonly',
        gpmFindInsertionPoint: 'readonly',
        gpmInjectProjectSection: 'readonly',
        gpmWaitForSidebarContent: 'readonly',
        gpmSidebarHasContent: 'readonly',
        gpmObserveForSidebar: 'readonly',
        // project-tree.js
        gpmRenderTree: 'readonly',
        gpmScheduleAliasResolve: 'readonly',
        gpmCreateProjectRow: 'readonly',
        gpmCreateChatRow: 'readonly',
        gpmShowProjectContextMenu: 'readonly',
        gpmShowChatContextMenu: 'readonly',
        gpmShowCreateProjectModal: 'readonly',
        gpmShowSettingsModal: 'readonly',
        // quick-prompts.js
        gpmInjectQuickPromptTrigger: 'readonly',
        gpmObserveQuickPromptButton: 'readonly',
        gpmToggleQuickPrompts: 'readonly',
        gpmInsertPromptText: 'readonly',
        // navigation.js
        gpmTriggerNewChat: 'readonly',
        gpmNavigateToChat: 'readonly',
        gpmGetCurrentChatId: 'readonly',
        gpmObserveSPANavigation: 'readonly',
        gpmOnNavigate: 'readonly',
        gpmObserveNewChats: 'readonly',
        gpmEnhanceNativeChatItems: 'readonly',
        // content.js
        gpmInit: 'readonly',
      },
    },
    rules: {
      // Relaxed rules for existing codebase
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off', // We use gpmLog/gpmWarn/gpmError wrappers
      'no-undef': 'error',
      // Disabled: content_scripts share global scope — functions defined in one file
      // are declared as globals for others, causing false "redeclare" errors
      'no-redeclare': 'off',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'warn',
      'no-throw-literal': 'warn',
    },
  },
  {
    // Test files use ES modules and vitest globals
    files: ['tests/**/*.js', 'tests/**/*.test.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/',
      'icons/',
      '_locales/',
      '*.md',
      '*.json',
      'plans/',
    ],
  },
];
