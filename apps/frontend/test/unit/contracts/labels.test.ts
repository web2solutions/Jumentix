import {
  afterEach, describe, expect, it
} from 'bun:test';

import { fieldDescriptors } from '@/contracts/formSchema';
import { fieldHelp, fieldLabel, humanize } from '@/contracts/labels';
import { resetLocale, setLocale } from '@/i18n';

/**
 * JUM-780 — labels come from the contract: `x-label[locale]` → `title` →
 * humanized property name; `description` is help text, never the caption.
 * Drift test: adding `x-label` to the spec changes the label with no code change.
 */
describe('field labels from the OAS', () => {
  afterEach(() => {
    resetLocale();
  });

  it('prefers x-label of the active locale, then en, then title, then the humanized name', () => {
    expect.hasAssertions();
    setLocale('pt-BR');
    expect(fieldLabel({ name: 'firstName', xLabel: { en: 'First name', 'pt-BR': 'Nome' } })).toBe('Nome');
    expect(fieldLabel({ name: 'firstName', xLabel: { en: 'First name' } })).toBe('First name');
    expect(fieldLabel({ name: 'firstName', title: 'Given name' })).toBe('Given name');
    expect(fieldLabel({ name: 'firstName' })).toBe('First name');
    expect(fieldLabel({ name: 'firstName' }, { firstName: 'Override' })).toBe('Override');
  });

  it('humanizes camelCase, snake_case and acronyms', () => {
    expect.hasAssertions();
    expect(humanize('zipCode')).toBe('Zip code');
    expect(humanize('country_issue')).toBe('Country issue');
    expect(humanize('userID')).toBe('User id');
    expect(humanize('')).toBe('');
  });

  it('reads x-label from the bundled spec and keeps description as help (drift test)', () => {
    expect.hasAssertions();
    const organization = fieldDescriptors('User').find((d) => d.name === 'organization')!;
    setLocale('en');
    expect(fieldLabel(organization)).toBe('Organization');
    expect(fieldHelp(organization)).toBe('Organization id for tenant users (admin/user)');
    setLocale('pt-BR');
    expect(fieldLabel(organization)).toBe('Organização');
  });
});
