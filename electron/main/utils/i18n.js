import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { loggerService } from '../services/logger.service.js';

const logger = loggerService.createLogger('Electron:I18n Utils');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../../assets/locales');

class I18n {
  constructor() {
    this.locale = app.getLocale();
    this.translations = {};
    this.loadTranslations();
  }

  resolveLocale(lang = this.locale) {
    const requestedPath = path.join(localesDir, `${lang}${VFS_CONSTANTS.JSON_FILE_EXT}`);
    if (fs.existsSync(requestedPath)) {
      return lang;
    }

    const languageCode = lang.toLowerCase().split('-')[0];
    const languageMatch = fs.readdirSync(localesDir)
      .find((fileName) => fileName.toLowerCase().startsWith(`${languageCode}-`));

    return languageMatch ? languageMatch.replace(VFS_CONSTANTS.JSON_FILE_EXT, '') : 'en-US';
  }

  loadTranslations(lang = this.locale) {
    const targetLang = this.resolveLocale(lang);
    this.locale = targetLang;
    const filePath = path.join(localesDir, `${targetLang}${VFS_CONSTANTS.JSON_FILE_EXT}`);

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        this.translations = JSON.parse(content);
      } else {
        const fallbackPath = path.join(localesDir, 'en-US.json');
        if (fs.existsSync(fallbackPath)) {
          const content = fs.readFileSync(fallbackPath, 'utf8');
          this.translations = JSON.parse(content);
        }
      }
    } catch (error) {
      logger.error('Failed to load translations in main process', error);
    }
  }

  t(key, defaultValue = '') {
    if (this.translations[key]) return this.translations[key];

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
