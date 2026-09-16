import { describe, expect, it } from 'bun:test';

import {
  badgeColorFor, formatCellValue, isInlineEditable, isScalarArray, pageWindow, shortId
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

describe('xCrudFormat numbers, dates and inline editing', () => {
  it('formats percent and plain numbers in the active locale', () => {
    expect.assertions(2);
    expect(formatCellValue({
      name: 'rate', type: 'number', format: 'percent', required: false
    }, 12.5)).toBe('12.5%');
    expect(formatCellValue({ name: 'amount', type: 'integer', required: false }, 1234567)).toContain('1.234.567');
  });

  it('formats timestamps in the locale and falls back on unparsable dates', () => {
    expect.assertions(3);
    const formatted = formatCellValue({ name: 'createdAt', type: 'string', required: false }, '2026-01-05T10:00:00.000Z');
    expect(formatted).not.toBe('2026-01-05T10:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatCellValue({ name: 'updatedAt', type: 'string', required: false }, 'not-a-date')).toBe('not-a-date');
  });

  it('gates inline editing to scalar, non-system fields', () => {
    expect.assertions(4);
    expect(isInlineEditable({ name: 'firstName', type: 'string', required: false })).toBe(true);
    expect(isInlineEditable({ name: 'emails', type: 'array', required: false })).toBe(false);
    expect(isInlineEditable({
      name: 'secret', type: 'string', format: 'password', required: false
    })).toBe(false);
    expect(isInlineEditable({ name: 'id', type: 'string', required: true })).toBe(false);
  });

  it('detects scalar arrays for chips and checkbox groups', () => {
    expect.assertions(2);
    expect(isScalarArray({ name: 'roles', type: 'array', required: false })).toBe(true);
    expect(isScalarArray({ name: 'firstName', type: 'string', required: false })).toBe(false);
  });
});
