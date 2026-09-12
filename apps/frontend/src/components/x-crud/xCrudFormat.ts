/**
 * XCrudField — the single source of truth for "how to display/edit this OAS
 * field" (JUM-772). Shared by the 3 form modes, grid cells and inline edit.
 */
import type { FieldDescriptor } from '@/contracts/formSchema';

/** Readonly display of one value, formatted per OAS type/format. */
export const formatCellValue = (descriptor: FieldDescriptor, value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  if (descriptor.name === 'password' || descriptor.format === 'password') return '••••••••';
  if (Array.isArray(value)) return `${value.length}`;
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (descriptor.type === 'number' || descriptor.type === 'integer') {
    const numeric = Number(value);
    if (descriptor.format === 'currency' || descriptor.format === 'money') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric);
    }
    if (descriptor.format === 'percent') return `${numeric}%`;
    return String(numeric);
  }
  if (descriptor.format === 'date-time' || descriptor.format === 'date') {
    const time = Date.parse(String(value));
    if (!Number.isNaN(time)) {
      return new Date(time).toLocaleString('pt-BR', descriptor.format === 'date'
        ? { dateStyle: 'short' }
        : { dateStyle: 'short', timeStyle: 'short' });
    }
  }
  return String(value);
};

/** True when the field is editable inline in the grid (scalars only). */
export const isInlineEditable = (descriptor: FieldDescriptor): boolean => (
  !['array', 'object'].includes(descriptor.type)
  && descriptor.format !== 'password'
  && !['id', 'createdAt', 'updatedAt'].includes(descriptor.name)
);

/** True for array-of-scalars fields (chips/checkbox groups). */
export const isScalarArray = (descriptor: FieldDescriptor): boolean => descriptor.type === 'array';

/** Stable palette for enum badges: same value → same CoreUI color. */
const BADGE_COLORS = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'] as const;

export const badgeColorFor = (value: unknown): string => {
  const text = String(value ?? '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 997;
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length];
};

/** Short id for grid cells: first 8 chars, uuid-style. */
export const shortId = (value: unknown): string => {
  const text = String(value ?? '');
  return text.length > 10 ? `${text.slice(0, 8)}…` : text;
};

/** "x–y de N" counter for the pager footer. */
export const pageWindow = (page: number, pageSize: number, total: number): string => {
  if (total === 0) return '0 de 0';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `${from}–${to} de ${total}`;
};
