import { createI18n } from 'vue-i18n';
import localeProviders from '@renderer/features/settings/config/locale-providers.json';
import { I18N_CONSTANTS } from '../constants/i18n.constants';

type LocaleMessages = Record<string, string>;

const localeModules = import.meta.glob('../locales/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, LocaleMessages>;

function extractLocale(modulePath: string): string {
  return modulePath.split('/').pop()?.replace(I18N_CONSTANTS.JSON_EXT, '') || I18N_CONSTANTS.DEFAULT_LOCALE_EN_US;
}

const registeredMessages = Object.fromEntries(
  Object.entries(localeModules).map(([modulePath, messages]) => [extractLocale(modulePath), messages]),
) as Record<string, LocaleMessages>;

export const languageOptions = Object.entries(localeProviders).map(([locale, label]) => ({
  value: locale,
  label: String(label),
}));

const knownLocales = new Set(languageOptions.map((option) => option.value));

function findBestLocaleMatch(locale?: string | null): string {
  if (!locale) {
    return I18N_CONSTANTS.DEFAULT_LOCALE_EN_US;
  }

  if (knownLocales.has(locale)) {
    return locale;
  }

  const normalized = locale.toLowerCase();
  const languageMatch = languageOptions.find((option) => option.value.toLowerCase().startsWith(`${normalized.split('-')[0]}-`));
  return languageMatch?.value || I18N_CONSTANTS.DEFAULT_LOCALE_EN_US;
}

export function resolveLocale(locale?: string | null): string {
  if (!locale || locale === I18N_CONSTANTS.SYSTEM_LOCALE) {
    const systemLocale = typeof navigator !== 'undefined' ? navigator.language : I18N_CONSTANTS.DEFAULT_LOCALE_EN_US;
    return findBestLocaleMatch(systemLocale);
  }

  return findBestLocaleMatch(locale);
}

const messages = languageOptions.reduce<Record<string, LocaleMessages>>((acc, option) => {
  acc[option.value] = registeredMessages[option.value] || {};
  return acc;
}, {});

const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(),
  fallbackLocale: I18N_CONSTANTS.DEFAULT_LOCALE_EN_US,
  messages,
});

export async function switchLanguage(locale?: string | null): Promise<string> {
  const nextLocale = resolveLocale(locale);
  if (!i18n.global.availableLocales.includes(nextLocale)) {
    i18n.global.setLocaleMessage(nextLocale, {});
  }

  i18n.global.locale.value = nextLocale;
  document.documentElement.lang = nextLocale;
  return nextLocale;
}

export default i18n;
