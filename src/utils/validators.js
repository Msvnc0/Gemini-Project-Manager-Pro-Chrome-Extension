/**
 * validators.js — Input Validation & XSS Sanitization
 *
 * Provides secure validation and sanitization for all user inputs.
 * Prevents XSS attacks and ensures data integrity.
 */

const GPMValidators = (() => {
  const MAX_STRING_LENGTH = 1000;
  const MAX_NAME_LENGTH = 200;
  const MAX_CONTENT_LENGTH = 50000;

  // ── Sanitization ──

  function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
    if (typeof str !== 'string') return '';
    return (
      str
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .slice(0, maxLength)
        .trim()
    );
  }

  function sanitizeName(str) {
    return sanitizeString(str, MAX_NAME_LENGTH);
  }

  function sanitizeContent(str) {
    return sanitizeString(str, MAX_CONTENT_LENGTH);
  }

  function sanitizeColor(color) {
    if (typeof color !== 'string') return '#8ab4f8';
    const valid = /^#[0-9a-fA-F]{3,8}$/.test(color);
    return valid ? color : '#8ab4f8';
  }

  function sanitizeIcon(icon) {
    if (typeof icon !== 'string') return '📁';
    if (icon.length > 10) return '📁';
    if (/^[^\w\s]$/.test(icon) || /[\u{1F300}-\u{1F9FF}]/u.test(icon)) {
      return icon;
    }
    return '📁';
  }

  function sanitizeId(id) {
    if (typeof id !== 'string') return null;
    const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return cleaned.length > 0 ? cleaned : null;
  }

  // ── Validation ──

  function validateProject(p) {
    if (!p || typeof p !== 'object') return null;

    const id = sanitizeId(p.id);
    if (!id) return null;

    const name = sanitizeName(p.name);
    if (!name) return null;

    return {
      id,
      name,
      icon: sanitizeIcon(p.icon),
      color: sanitizeColor(p.color),
      parentId: sanitizeId(p.parentId) || null,
      children: Array.isArray(p.children) ? p.children.map(sanitizeId).filter(Boolean) : [],
      chatIds: Array.isArray(p.chatIds) ? p.chatIds.map(sanitizeId).filter(Boolean) : [],
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : false,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    };
  }

  function validateChatMapping(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const projectId = sanitizeId(entry.projectId);
    if (!projectId) return null;

    return {
      projectId,
      alias: sanitizeName(entry.alias || ''),
      pinned: typeof entry.pinned === 'boolean' ? entry.pinned : false,
      _autoResolved: typeof entry._autoResolved === 'boolean' ? entry._autoResolved : false,
      starredAt: typeof entry.starredAt === 'number' ? entry.starredAt : null,
    };
  }

  function validateQuickPrompt(p) {
    if (!p || typeof p !== 'object') return null;

    const title = sanitizeName(p.title);
    if (!title) return null;

    const content = sanitizeContent(p.content);
    if (!content) return null;

    return {
      id: sanitizeId(p.id) || null,
      title,
      content,
      category: sanitizeName(p.category || 'General'),
    };
  }

  function validateSettings(s) {
    if (!s || typeof s !== 'object') return null;

    const validLangs = [
      'ar',
      'bn',
      'de',
      'en',
      'es',
      'fr',
      'hi',
      'id',
      'it',
      'ja',
      'ko',
      'pt',
      'ru',
      'th',
      'tr',
      'vi',
      'zh-CN',
    ];

    const validThemes = ['auto', 'dark', 'light'];

    return {
      lang: validLangs.includes(s.lang) ? s.lang : 'en',
      theme: validThemes.includes(s.theme) ? s.theme : 'auto',
    };
  }

  // ── Schema Validation for Import ──

  function validateImportData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data format' };
    }

    const result = {
      valid: true,
      data: {},
      warnings: [],
    };

    if (data.gpm_projects && Array.isArray(data.gpm_projects)) {
      result.data.gpm_projects = data.gpm_projects.map(validateProject).filter(Boolean);
      if (result.data.gpm_projects.length !== data.gpm_projects.length) {
        result.warnings.push('Some projects were invalid and removed');
      }
    } else {
      result.data.gpm_projects = [];
    }

    if (data.gpm_chatMap && typeof data.gpm_chatMap === 'object' && !Array.isArray(data.gpm_chatMap)) {
      result.data.gpm_chatMap = {};
      for (const [chatId, mapping] of Object.entries(data.gpm_chatMap)) {
        const cleanId = sanitizeId(chatId);
        const cleanMapping = validateChatMapping(mapping);
        if (cleanId && cleanMapping) {
          result.data.gpm_chatMap[cleanId] = cleanMapping;
        }
      }
    } else {
      result.data.gpm_chatMap = {};
    }

    if (data.gpm_quickPrompts && Array.isArray(data.gpm_quickPrompts)) {
      result.data.gpm_quickPrompts = data.gpm_quickPrompts.map(validateQuickPrompt).filter(Boolean);
    } else {
      result.data.gpm_quickPrompts = [];
    }

    if (data.gpm_settings && typeof data.gpm_settings === 'object') {
      result.data.gpm_settings = validateSettings(data.gpm_settings) || { lang: 'en', theme: 'auto' };
    } else {
      result.data.gpm_settings = { lang: 'en', theme: 'auto' };
    }

    return result;
  }

  // ── Duplicate Check ──

  function findDuplicateChat(chatId, projects, chatMap) {
    const existingEntry = chatMap[chatId];
    if (!existingEntry) return null;

    const existingProject = projects.find((p) => p.id === existingEntry.projectId);
    return {
      projectId: existingEntry.projectId,
      projectName: existingProject ? existingProject.name : 'Unknown',
      alias: existingEntry.alias,
    };
  }

  return {
    sanitizeString,
    sanitizeName,
    sanitizeContent,
    sanitizeColor,
    sanitizeIcon,
    sanitizeId,
    validateProject,
    validateChatMapping,
    validateQuickPrompt,
    validateSettings,
    validateImportData,
    findDuplicateChat,
  };
})();
