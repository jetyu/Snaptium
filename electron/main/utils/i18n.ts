import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { loggerService } from '../services/logger.service.js';
import { getErrorMessage } from './error.utils.js';

const logger = loggerService.createLogger('Electron:I18n Utils');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isDirectory(targetPath: string): boolean {
  try {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function resolveLocalesDirectory(): string {
  if (app.isPackaged) {
    return path.resolve(process.resourcesPath, 'assets/locales');
  }

  return path.resolve(app.getAppPath(), 'electron/assets/locales');
}

interface I18nTranslations {
  [key: string]: string | I18nTranslations;
}

class I18n {
  private locale: string;
  private translations: I18nTranslations;
  private localesDir: string;

  constructor() {
    this.locale = app.getLocale();
    this.translations = {};
    this.localesDir = resolveLocalesDirectory();
    this.loadTranslations();
  }

  resolveLocale(lang: string = this.locale): string {
    if (!isDirectory(this.localesDir)) {
      logger.warn('Locales directory not found; fallback locale will be used', {
        localesDir: this.localesDir,
      });
      return 'en-US';
    }

    const requestedPath = path.join(this.localesDir, `${lang}${VFS_CONSTANTS.JSON_FILE_EXT}`);
    if (fs.existsSync(requestedPath)) {
      return lang;
    }

    const languageCode = lang.toLowerCase().split('-')[0];
    const languageMatch = fs.readdirSync(this.localesDir)
      .find((fileName) => fileName.toLowerCase().startsWith(`${languageCode}-`));

    return languageMatch ? languageMatch.replace(VFS_CONSTANTS.JSON_FILE_EXT, '') : 'en-US';
  }

  loadTranslations(lang: string = this.locale): void {
    if (!isDirectory(this.localesDir)) {
      this.translations = {};
      return;
    }

    const targetLang = this.resolveLocale(lang);
    this.locale = targetLang;
    const filePath = path.join(this.localesDir, `${targetLang}${VFS_CONSTANTS.JSON_FILE_EXT}`);

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        this.translations = JSON.parse(content) as I18nTranslations;
      } else {
        const fallbackPath = path.join(this.localesDir, 'en-US.json');
        if (fs.existsSync(fallbackPath)) {
          const content = fs.readFileSync(fallbackPath, 'utf8');
          this.translations = JSON.parse(content) as I18nTranslations;
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to load translations in main process', { error: getErrorMessage(error) });
    }
  }

  t(key: string, defaultValue = ''): string {
    const directValue = this.translations[key];
    if (typeof directValue === 'string') {
      return directValue;
    }

    const parts = key.split('.');
    let current: string | I18nTranslations = this.translations;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part] as string | I18nTranslations;
      } else {
        return defaultValue || key;
      }
    }
    return typeof current === 'string' ? current : (defaultValue || key);
  }
}

export const i18n = new I18n();
export const $t = i18n.t.bind(i18n);
