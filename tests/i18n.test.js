/**
 * i18n.test.js — Unit Tests for GPM_STRINGS, gpmSetLang(), t()
 *
 * Target coverage: 80%+
 * Tests: key consistency across all 17 languages, fallback mechanism,
 *        missing key behavior, gpmSetLang() / t() integration
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const i18nCode = readFileSync(resolve('src/i18n.js'), 'utf-8');

// Patch globals for ESM test scope
const patchedCode = i18nCode
  .replace(/^const GPM_STRINGS\s*=/m, 'globalThis.GPM_STRINGS =')
  .replace(/^const LANGUAGE_NATIVE_NAMES\s*=/m, 'globalThis.LANGUAGE_NATIVE_NAMES =')
  .replace(/^const SUPPORTED_LANG_CODES\s*=/m, 'globalThis.SUPPORTED_LANG_CODES =')
  .replace(/^const LANGUAGE_NAMES_IN\s*=/m, 'globalThis.LANGUAGE_NAMES_IN =')
  .replace(/^let _gpmLang\s*=/m, 'globalThis._gpmLang =')
  .replace(/^function gpmSetLang/m, 'globalThis.gpmSetLang = function gpmSetLang')
  .replace(/^function t\(/m, 'globalThis.t = function t(')
  .replace(/^function getLanguageDisplayName/m, 'globalThis.getLanguageDisplayName = function getLanguageDisplayName')
  .replace(/^function getLanguageOptions/m, 'globalThis.getLanguageOptions = function getLanguageOptions')
  .replace(/^function detectBrowserLanguage/m, 'globalThis.detectBrowserLanguage = function detectBrowserLanguage');

new Function(patchedCode)();

const GPM_STRINGS = globalThis.GPM_STRINGS;
const gpmSetLang = globalThis.gpmSetLang;
const t = globalThis.t;
const getLanguageDisplayName = globalThis.getLanguageDisplayName;
const getLanguageOptions = globalThis.getLanguageOptions;
const detectBrowserLanguage = globalThis.detectBrowserLanguage;
const LANGUAGE_NATIVE_NAMES = globalThis.LANGUAGE_NATIVE_NAMES;
const SUPPORTED_LANG_CODES = globalThis.SUPPORTED_LANG_CODES;
const LANGUAGE_NAMES_IN = globalThis.LANGUAGE_NAMES_IN;

// ── Constants ──
const SUPPORTED_LANGUAGES = ['ar', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'th', 'tr', 'vi', 'zh'];
const ENGLISH_KEYS = Object.keys(GPM_STRINGS.en);

describe('GPM_STRINGS structure', () => {
  it('should have all 15 supported languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(GPM_STRINGS[lang]).toBeDefined();
      expect(typeof GPM_STRINGS[lang]).toBe('object');
    }
  });

  it('should not have unexpected languages', () => {
    const actualLangs = Object.keys(GPM_STRINGS);
    for (const lang of actualLangs) {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    }
  });

  it('should have a non-empty English language pack', () => {
    expect(ENGLISH_KEYS.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════
//  Key Consistency Across Languages
// ══════════════════════════════════════

describe('Key consistency across all languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    describe(`Language: ${lang}`, () => {
      it('should have all English keys present', () => {
        const langKeys = Object.keys(GPM_STRINGS[lang]);
        const missingKeys = ENGLISH_KEYS.filter((k) => !langKeys.includes(k));

        if (missingKeys.length > 0) {
          throw new Error(`Language "${lang}" is missing keys: ${missingKeys.join(', ')}`);
        }
        expect(missingKeys).toHaveLength(0);
      });

      it('should not have extra keys not in English', () => {
        const langKeys = Object.keys(GPM_STRINGS[lang]);
        const extraKeys = langKeys.filter((k) => !ENGLISH_KEYS.includes(k));

        if (extraKeys.length > 0) {
          throw new Error(`Language "${lang}" has extra keys: ${extraKeys.join(', ')}`);
        }
        expect(extraKeys).toHaveLength(0);
      });

      it('should have all values as non-empty strings', () => {
        for (const [key, value] of Object.entries(GPM_STRINGS[lang])) {
          expect(typeof value).toBe('string');
          expect(value.trim().length).toBeGreaterThan(0);
        }
      });

      it('should have same number of keys as English', () => {
        expect(Object.keys(GPM_STRINGS[lang]).length).toBe(ENGLISH_KEYS.length);
      });
    });
  }
});

// ══════════════════════════════════════
//  gpmSetLang() Tests
// ══════════════════════════════════════

describe('gpmSetLang()', () => {
  afterEach(() => {
    gpmSetLang('en'); // Reset to default
  });

  it('should set a valid language', () => {
    gpmSetLang('tr');
    expect(t('projects')).toBe('Projeler');
  });

  it('should accept all supported languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      gpmSetLang(lang);
      // After setting lang, t() should return a value from that language
      const val = t('projects');
      expect(val).toBe(GPM_STRINGS[lang].projects);
    }
  });

  it('should fallback to English for unknown language', () => {
    gpmSetLang('xx');
    expect(t('projects')).toBe('Projects');
  });

  it('should fallback to English for empty string', () => {
    gpmSetLang('');
    expect(t('projects')).toBe('Projects');
  });

  it('should fallback to English for null', () => {
    gpmSetLang(null);
    expect(t('projects')).toBe('Projects');
  });

  it('should fallback to English for undefined', () => {
    gpmSetLang(undefined);
    expect(t('projects')).toBe('Projects');
  });
});

// ══════════════════════════════════════
//  t() Translation Function Tests
// ══════════════════════════════════════

describe('t() translation function', () => {
  afterEach(() => {
    gpmSetLang('en');
  });

  it('should return English translation by default', () => {
    gpmSetLang('en');
    expect(t('newProject')).toBe('New Project');
    expect(t('settings')).toBe('Settings');
    expect(t('delete')).toBe('Delete');
  });

  it('should return Turkish translation when lang is tr', () => {
    gpmSetLang('tr');
    expect(t('newProject')).toBe('Yeni Proje');
    expect(t('settings')).toBe('Ayarlar');
    expect(t('delete')).toBe('Sil');
  });

  it('should return German translation when lang is de', () => {
    gpmSetLang('de');
    expect(t('newProject')).toBe('Neues Projekt');
    expect(t('settings')).toBe('Einstellungen');
  });

  it('should return French translation when lang is fr', () => {
    gpmSetLang('fr');
    expect(t('newProject')).toBe('Nouveau projet');
    expect(t('settings')).toBe('Paramètres');
  });

  it('should return Spanish translation when lang is es', () => {
    gpmSetLang('es');
    expect(t('newProject')).toBe('Nuevo proyecto');
  });

  it('should return Italian translation when lang is it', () => {
    gpmSetLang('it');
    expect(t('newProject')).toBe('Nuovo progetto');
  });

  it('should return Portuguese translation when lang is pt', () => {
    gpmSetLang('pt');
    expect(t('newProject')).toBe('Novo projeto');
  });

  it('should return Russian translation when lang is ru', () => {
    gpmSetLang('ru');
    expect(t('newProject')).toBe('Новый проект');
  });

  it('should return Japanese translation when lang is ja', () => {
    gpmSetLang('ja');
    expect(t('newProject')).toBe('新しいプロジェクト');
  });

  it('should return Chinese translation when lang is zh', () => {
    gpmSetLang('zh');
    expect(t('newProject')).toBe('新建项目');
  });

  it('should return the key itself for non-existent key', () => {
    gpmSetLang('en');
    expect(t('nonExistentKey123')).toBe('nonExistentKey123');
  });

  it('should fallback to English for key missing in current language', () => {
    // Simulate a language with a missing key by temporarily removing one
    const original = GPM_STRINGS.tr.newProject;
    delete GPM_STRINGS.tr.newProject;

    gpmSetLang('tr');
    expect(t('newProject')).toBe('New Project'); // English fallback

    // Restore
    GPM_STRINGS.tr.newProject = original;
  });

  it('should handle category keys correctly', () => {
    gpmSetLang('en');
    expect(t('categoryHomework')).toBe('Homework');
    expect(t('categoryCoding')).toBe('Coding');
    expect(t('categoryDesign')).toBe('Design');
  });

  it('should handle all category keys in all languages', () => {
    const categoryKeys = ENGLISH_KEYS.filter((k) => k.startsWith('category'));
    expect(categoryKeys.length).toBeGreaterThan(0);

    for (const lang of SUPPORTED_LANGUAGES) {
      gpmSetLang(lang);
      for (const key of categoryKeys) {
        const val = t(key);
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

// ══════════════════════════════════════
//  Edge Cases
// ══════════════════════════════════════

describe('Edge cases', () => {
  afterEach(() => {
    gpmSetLang('en');
  });

  it('should handle rapid language switching', () => {
    gpmSetLang('tr');
    gpmSetLang('de');
    gpmSetLang('fr');
    gpmSetLang('en');
    expect(t('projects')).toBe('Projects');
  });

  it('should handle setting the same language twice', () => {
    gpmSetLang('tr');
    gpmSetLang('tr');
    expect(t('projects')).toBe('Projeler');
  });

  it('should translate all keys without throwing', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      gpmSetLang(lang);
      for (const key of ENGLISH_KEYS) {
        expect(() => t(key)).not.toThrow();
      }
    }
  });
});

// ══════════════════════════════════════
//  Language Display Name Tests
// ══════════════════════════════════════

describe('LANGUAGE_NATIVE_NAMES', () => {
  it('should have entries for all supported language codes', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      expect(LANGUAGE_NATIVE_NAMES[code]).toBeDefined();
      expect(typeof LANGUAGE_NATIVE_NAMES[code]).toBe('string');
      expect(LANGUAGE_NATIVE_NAMES[code].length).toBeGreaterThan(0);
    }
  });
});

describe('LANGUAGE_NAMES_IN', () => {
  it('should have translation maps for all supported UI languages', () => {
    for (const uiLang of SUPPORTED_LANG_CODES) {
      expect(LANGUAGE_NAMES_IN[uiLang]).toBeDefined();
      expect(typeof LANGUAGE_NAMES_IN[uiLang]).toBe('object');
    }
  });

  it('should have translations for all target languages in each UI language map', () => {
    for (const uiLang of SUPPORTED_LANG_CODES) {
      for (const targetLang of SUPPORTED_LANG_CODES) {
        const translated = LANGUAGE_NAMES_IN[uiLang]?.[targetLang];
        expect(translated).toBeDefined();
        expect(typeof translated).toBe('string');
        expect(translated.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getLanguageDisplayName()', () => {
  afterEach(() => {
    gpmSetLang('en');
  });

  it('should show native name + English translation in parentheses when UI is English', () => {
    gpmSetLang('en');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (German)');
    expect(getLanguageDisplayName('fr')).toBe('Français (French)');
    expect(getLanguageDisplayName('ja')).toBe('日本語 (Japanese)');
    expect(getLanguageDisplayName('zh')).toBe('中文 (Chinese)');
    expect(getLanguageDisplayName('ar')).toBe('العربية (Arabic)');
    expect(getLanguageDisplayName('ko')).toBe('한국어 (Korean)');
    expect(getLanguageDisplayName('es')).toBe('Español (Spanish)');
  });

  it('should show only native name when native equals translated (same language)', () => {
    gpmSetLang('en');
    expect(getLanguageDisplayName('en')).toBe('English');
  });

  it('should show Turkish translations when UI is Turkish', () => {
    gpmSetLang('tr');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (Almanca)');
    expect(getLanguageDisplayName('fr')).toBe('Français (Fransızca)');
    expect(getLanguageDisplayName('en')).toBe('English (İngilizce)');
    expect(getLanguageDisplayName('ja')).toBe('日本語 (Japonca)');
    expect(getLanguageDisplayName('tr')).toBe('Türkçe');
  });

  it('should show Japanese translations when UI is Japanese', () => {
    gpmSetLang('ja');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (ドイツ語)');
    expect(getLanguageDisplayName('fr')).toBe('Français (フランス語)');
    expect(getLanguageDisplayName('en')).toBe('English (英語)');
    expect(getLanguageDisplayName('ja')).toBe('日本語');
  });

  it('should show Arabic translations when UI is Arabic', () => {
    gpmSetLang('ar');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (الألمانية)');
    expect(getLanguageDisplayName('en')).toBe('English (الإنجليزية)');
    expect(getLanguageDisplayName('ar')).toBe('العربية');
  });

  it('should show Chinese translations when UI is Chinese', () => {
    gpmSetLang('zh');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (德语)');
    expect(getLanguageDisplayName('fr')).toBe('Français (法语)');
    expect(getLanguageDisplayName('zh')).toBe('中文');
  });

  it('should dynamically change when UI language changes', () => {
    gpmSetLang('en');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (German)');

    gpmSetLang('tr');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (Almanca)');

    gpmSetLang('ja');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (ドイツ語)');

    gpmSetLang('ko');
    expect(getLanguageDisplayName('de')).toBe('Deutsch (독일어)');
  });

  it('should return the code for unknown language codes', () => {
    gpmSetLang('en');
    expect(getLanguageDisplayName('xx')).toBe('xx');
  });
});

describe('getLanguageOptions()', () => {
  afterEach(() => {
    gpmSetLang('en');
  });

  it('should return an array with entries for all supported languages', () => {
    gpmSetLang('en');
    const options = getLanguageOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBe(SUPPORTED_LANG_CODES.length);
  });

  it('should return objects with code and displayName properties', () => {
    gpmSetLang('en');
    const options = getLanguageOptions();
    for (const opt of options) {
      expect(opt).toHaveProperty('code');
      expect(opt).toHaveProperty('displayName');
      expect(typeof opt.code).toBe('string');
      expect(typeof opt.displayName).toBe('string');
    }
  });

  it('should include all supported language codes', () => {
    gpmSetLang('en');
    const options = getLanguageOptions();
    const codes = options.map(o => o.code);
    for (const code of SUPPORTED_LANG_CODES) {
      expect(codes).toContain(code);
    }
  });

  it('should reflect current UI language in display names', () => {
    gpmSetLang('en');
    const enOptions = getLanguageOptions();
    const deOptionEn = enOptions.find(o => o.code === 'de');
    expect(deOptionEn.displayName).toBe('Deutsch (German)');

    gpmSetLang('tr');
    const trOptions = getLanguageOptions();
    const deOptionTr = trOptions.find(o => o.code === 'de');
    expect(deOptionTr.displayName).toBe('Deutsch (Almanca)');
  });
});

// ══════════════════════════════════════
//  Browser Language Detection Tests
// ══════════════════════════════════════

describe('detectBrowserLanguage()', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  function mockNavigator({ languages, language }) {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        languages: languages || [],
        language: language || ''
      },
      writable: true,
      configurable: true
    });
  }

  it('should detect direct language code match (e.g. "tr")', () => {
    mockNavigator({ languages: ['tr'], language: 'tr' });
    expect(detectBrowserLanguage()).toBe('tr');
  });

  it('should detect direct language code match (e.g. "de")', () => {
    mockNavigator({ languages: ['de'], language: 'de' });
    expect(detectBrowserLanguage()).toBe('de');
  });

  it('should detect regional variant via alias (e.g. "zh-CN" → "zh")', () => {
    mockNavigator({ languages: ['zh-CN'], language: 'zh-CN' });
    expect(detectBrowserLanguage()).toBe('zh');
  });

  it('should detect regional variant via alias (e.g. "pt-BR" → "pt")', () => {
    mockNavigator({ languages: ['pt-BR'], language: 'pt-BR' });
    expect(detectBrowserLanguage()).toBe('pt');
  });

  it('should detect base language code from regional variant (e.g. "fr-CA" → "fr")', () => {
    mockNavigator({ languages: ['fr-CA'], language: 'fr-CA' });
    expect(detectBrowserLanguage()).toBe('fr');
  });

  it('should detect base language code from regional variant (e.g. "es-MX" → "es")', () => {
    mockNavigator({ languages: ['es-MX'], language: 'es-MX' });
    expect(detectBrowserLanguage()).toBe('es');
  });

  it('should prefer first matching language from navigator.languages', () => {
    mockNavigator({ languages: ['sv', 'de', 'fr'], language: 'sv' });
    // "sv" is not supported, "de" is → should return "de"
    expect(detectBrowserLanguage()).toBe('de');
  });

  it('should fallback to "en" when no languages match', () => {
    mockNavigator({ languages: ['sv', 'fi', 'da'], language: 'sv' });
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('should fallback to "en" when navigator.languages is empty', () => {
    mockNavigator({ languages: [], language: '' });
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('should use navigator.language when navigator.languages is not available', () => {
    mockNavigator({ languages: undefined, language: 'ja' });
    expect(detectBrowserLanguage()).toBe('ja');
  });

  it('should handle case-insensitive language codes', () => {
    mockNavigator({ languages: ['TR'], language: 'TR' });
    expect(detectBrowserLanguage()).toBe('tr');
  });

  it('should handle "en-US" as English', () => {
    mockNavigator({ languages: ['en-US'], language: 'en-US' });
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('should handle "en-GB" as English', () => {
    mockNavigator({ languages: ['en-GB'], language: 'en-GB' });
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('should handle "zh-TW" as Chinese', () => {
    mockNavigator({ languages: ['zh-TW'], language: 'zh-TW' });
    expect(detectBrowserLanguage()).toBe('zh');
  });

  it('should handle complex language preference lists', () => {
    mockNavigator({ languages: ['nb-NO', 'sv-SE', 'ko-KR', 'en-US'], language: 'nb-NO' });
    // nb and sv not supported; ko-KR base "ko" is supported
    expect(detectBrowserLanguage()).toBe('ko');
  });

  it('should detect Bengali (bn)', () => {
    mockNavigator({ languages: ['bn-BD'], language: 'bn-BD' });
    expect(detectBrowserLanguage()).toBe('bn');
  });

  it('should detect Thai (th)', () => {
    mockNavigator({ languages: ['th-TH'], language: 'th-TH' });
    expect(detectBrowserLanguage()).toBe('th');
  });

  it('should detect Indonesian (id)', () => {
    mockNavigator({ languages: ['id-ID'], language: 'id-ID' });
    expect(detectBrowserLanguage()).toBe('id');
  });
});
