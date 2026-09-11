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
