import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
  constructor() {
    this.locale = app.getLocale();
    this.translations = {};
    this.loadTranslations();
  }

  resolveLocale(lang = this.locale) {
    const localesDir = path.resolve(__dirname, '../../../src/renderer/features/i18n/locales');
    const requestedPath = path.join(localesDir, `${lang}.json`);
    if (fs.existsSync(requestedPath)) {
      return lang;
    }

    const languageCode = lang.toLowerCase().split('-')[0];
    const languageMatch = fs.readdirSync(localesDir)
      .find((fileName) => fileName.toLowerCase().startsWith(`${languageCode}-`));

    return languageMatch ? languageMatch.replace('.json', '') : 'en-US';
  }

  loadTranslations(lang = this.locale) {
    const targetLang = this.resolveLocale(lang);
    this.locale = targetLang;
    const localesDir = path.resolve(__dirname, '../../../src/renderer/features/i18n/locales');

    const filePath = path.join(localesDir, `${targetLang}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        this.translations = JSON.parse(content);
      } else {
        // Fallback to en-US
        const fallbackPath = path.join(localesDir, 'en-US.json');
        if (fs.existsSync(fallbackPath)) {
          const content = fs.readFileSync(fallbackPath, 'utf8');
          this.translations = JSON.parse(content);
        }
      }
    } catch (error) {
      console.error('Failed to load translations in main process:', error);
    }
  }

  /**
   * Translate key, supports dot notation for nested objects or flat keys.
   * @param {string} key 
   * @param {string} defaultValue 
   * @returns {string}
   */
  t(key, defaultValue = '') {
    // 1. Try exact match (flat key like "menu.file")
    if (this.translations[key]) return this.translations[key];

    // 2. Try nested resolution
    const parts = key.split('.');
    let current = this.translations;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue || key;
      }
    }
    return typeof current === 'string' ? current : (defaultValue || key);
  }
}

export const i18n = new I18n();
export const $t = i18n.t.bind(i18n);
