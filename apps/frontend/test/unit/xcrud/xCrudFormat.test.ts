import { describe, expect, it } from 'bun:test';

import {
  badgeColorFor, formatCellValue, pageWindow, shortId
} from '@/components/x-crud/xCrudFormat';

/** JUM-772 redesign: grid formatters (X-SYNTH/Smart Table visual language). */
import { setLocale } from '@/i18n';

setLocale('pt-BR');

describe('xCrudFormat helpers', () => {
  it('shortId truncates long ids to 8 chars + ellipsis', () => {
    expect.assertions(3);
    expect(shortId('b1ffc4d2-1a2b-4c3d-9e8f-7a6b5c4d3e01')).toBe('b1ffc4d2…');
    expect(shortId('abc')).toBe('abc');
    expect(shortId(undefined)).toBe('');
  });

  it('badgeColorFor is stable per value and within the CoreUI palette', () => {
    expect.assertions(3);
    expect(badgeColorFor('Active')).toBe(badgeColorFor('Active'));
    expect(badgeColorFor('Active')).not.toBe('');
    expect(['primary', 'success', 'info', 'warning', 'danger', 'secondary'])
      .toContain(badgeColorFor('whatever'));
  });

  it('pageWindow renders the x–y de N counter', () => {
    expect.assertions(4);
    expect(pageWindow(1, 10, 34)).toBe('1–10 de 34');
    expect(pageWindow(4, 10, 34)).toBe('31–34 de 34');
    expect(pageWindow(1, 200, 6)).toBe('1–6 de 6');
    expect(pageWindow(1, 10, 0)).toBe('0 de 0');
  });

  it('formatCellValue keeps grid semantics (arrays, booleans, currency, dates)', () => {
    expect.assertions(5);
    expect(formatCellValue({ name: 'emails', type: 'array', required: false }, [1, 2])).toBe('2');
    expect(formatCellValue({ name: 'isPrimary', type: 'boolean', required: false }, true)).toBe('✓');
    expect(formatCellValue({
      name: 'price', type: 'number', format: 'currency', required: false
    }, 45500)).toContain('45.500');
    expect(formatCellValue({ name: 'password', type: 'string', required: false }, 'secret')).toBe('••••••••');
    expect(formatCellValue({ name: 'name', type: 'string', required: false }, null)).toBe('—');
  });
});
