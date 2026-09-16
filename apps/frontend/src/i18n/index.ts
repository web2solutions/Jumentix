import { computed, ref } from 'vue';

import { LOCALES, messages, type Locale } from './messages';

/**
 * Minimal i18n (JUM-780): no dependency, one reactive locale, `t(key, params)`
 * with `{param}` interpolation. Contract modules (`errors.ts`, `oasForm.ts`,
 * `validation.ts`) call `t()` directly — they are not components — so the
 * locale lives in a module-level ref rather than a Pinia store, and the
 * store-shaped composable below is what components use.
 */
const STORAGE_KEY = 'jumentix-frontend-locale';

const detectLocale = (): Locale => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && (LOCALES as string[]).includes(stored)) return stored as Locale;
  } catch {
    // storage unavailable (private mode, SSR) — fall through to navigator
  }
  const navigatorLocale = typeof navigator !== 'undefined' && typeof navigator.language === 'string'
    ? navigator.language
    : '';
  return navigatorLocale.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
};

const locale = ref<Locale>(detectLocale());

export const currentLocale = (): Locale => locale.value;

export const setLocale = (next: Locale): void => {
  if (!(LOCALES as string[]).includes(next)) return;
  locale.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable — locale still applies for this session
  }
};

/** Resets to the detected default; test hook. */
export const resetLocale = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  locale.value = detectLocale();
};

const interpolate = (template: string, params?: Record<string, unknown>): string => (
  template.replace(/\{(\w+)\}/g, (_match, key: string) => (
    params && params[key] !== undefined ? String(params[key]) : `{${key}}`
  ))
);

/**
 * Translates `key` in the active locale. A missing key returns the key itself
 * — visible in the UI and greppable — never an empty string.
 */
export const t = (key: string, params?: Record<string, unknown>): string => {
  const table = messages[locale.value] ?? messages.en;
  const template = table[key] ?? messages.en[key];
  if (template === undefined) return key;
  return interpolate(template, params);
};

/** A plain string, or one text per locale (`{ en, 'pt-BR' }`) — config-side i18n (JUM-780). */
export type Localized = string | Partial<Record<Locale, string>>;

/** Resolves a `Localized` value for the active locale, falling back to `en`, then any entry. */
export const localized = (value: Localized | undefined): string => {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[locale.value] ?? value.en ?? Object.values(value).find((entry) => Boolean(entry)) ?? '';
};

/** Component composable: reactive locale + `t`. */
export const useI18n = () => ({
  locale: computed(() => locale.value),
  locales: LOCALES,
  setLocale,
  t,
  localized
});

export type { Locale };
