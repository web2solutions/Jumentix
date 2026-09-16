import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';

import {
  currentLocale, localized, resetLocale, setLocale, t
} from '@/i18n';
import { LOCALES, messages } from '@/i18n/messages';

/** JUM-780 — one message table per locale, interpolation, persistence, fallbacks. */
describe('i18n', () => {
  beforeEach(() => {
    resetLocale();
  });

  afterEach(() => {
    resetLocale();
  });

  it('translates with interpolation and falls back to English, then to the key', () => {
    expect.hasAssertions();
    setLocale('en');
    expect(t('crud.created', { entity: 'User' })).toBe('User: record created.');
    setLocale('pt-BR');
    expect(t('crud.created', { entity: 'Usuário' })).toBe('Usuário: registro criado.');
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(t('crud.pageWindow', { from: 1, to: 10 })).toBe('1–10 de {total}');
  });

  it('keeps every key present in both locales so no screen falls back silently', () => {
    expect.hasAssertions();
    const en = Object.keys(messages.en).sort();
    const pt = Object.keys(messages['pt-BR']).sort();
    expect(pt).toStrictEqual(en);
    expect(LOCALES).toStrictEqual(['en', 'pt-BR']);
  });

  it('persists the chosen locale and ignores unknown ones', () => {
    expect.hasAssertions();
    setLocale('pt-BR');
    expect(localStorage.getItem('jumentix-frontend-locale')).toBe('pt-BR');
    expect(currentLocale()).toBe('pt-BR');
    setLocale('fr' as never);
    expect(currentLocale()).toBe('pt-BR');
  });

  it('resolves localized config captions with en as the fallback', () => {
    expect.hasAssertions();
    setLocale('pt-BR');
    expect(localized({ en: 'User', 'pt-BR': 'Usuário' })).toBe('Usuário');
    expect(localized({ en: 'User' })).toBe('User');
    expect(localized('Plain')).toBe('Plain');
    expect(localized(undefined)).toBe('');
  });
});
