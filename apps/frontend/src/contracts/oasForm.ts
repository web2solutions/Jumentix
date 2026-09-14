import type { FieldDescriptor } from './formSchema';
import { fieldLabel } from './labels';
import { t } from '@/i18n';

/**
 * Collects the request body from descriptor names (JUM-766): the OAS field
 * name is the body key, so a renamed field in the spec flows through with no
 * code change. Declared defaults fill untouched fields.
 */
export const collectBody = (
  descriptors: FieldDescriptor[],
  values: Record<string, unknown>
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  for (const descriptor of descriptors) {
    const value = values[descriptor.name];
    const untouched = value === undefined || value === '';
    if (!untouched) {
      body[descriptor.name] = value;
    } else if (descriptor.default !== undefined) {
      body[descriptor.name] = descriptor.default;
    }
  }
  return body;
};

/** Per-field validation against every facet the OAS declares for it. */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const validateFilledField = (
  descriptor: FieldDescriptor,
  text: string,
  field: string
): string | null => {
  if (descriptor.minLength !== undefined && text.length < descriptor.minLength) {
    return t('validation.minLength', { field, min: descriptor.minLength });
  }
  if (descriptor.maxLength !== undefined && text.length > descriptor.maxLength) {
    return t('validation.maxLength', { field, max: descriptor.maxLength });
  }
  if (descriptor.pattern && !new RegExp(descriptor.pattern).test(text)) {
    return t('validation.pattern', { field });
  }
  if (descriptor.enum && !descriptor.enum.includes(text)) {
    return t('validation.enum', { field, values: descriptor.enum.join(', ') });
  }
  if (descriptor.format === 'uuid' && !UUID_PATTERN.test(text)) {
    return t('validation.uuid', { field });
  }
  if (descriptor.format === 'email' && !EMAIL_PATTERN.test(text)) {
    return t('validation.email', { field });
  }
  return null;
};

export const validateField = (descriptor: FieldDescriptor, value: unknown): string | null => {
  const text = value === undefined || value === null ? '' : String(value);
  const field = fieldLabel(descriptor);
  if (descriptor.required && !text.trim()) {
    return t('validation.required', { field });
  }
  if (descriptor.type === 'array' || !text) {
    return null;
  }
  return validateFilledField(descriptor, text, field);
};

/** First invalid field wins; returns null when the whole form is valid. */
export const validateAll = (
  descriptors: FieldDescriptor[],
  values: Record<string, unknown>
): string | null => {
  for (const descriptor of descriptors) {
    const error = validateField(descriptor, values[descriptor.name]);
    if (error) {
      return error;
    }
  }
  return null;
};
