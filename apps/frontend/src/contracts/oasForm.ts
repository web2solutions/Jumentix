import type { FieldDescriptor } from './formSchema';

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
export const validateField = (descriptor: FieldDescriptor, value: unknown): string | null => {
  const text = value === undefined || value === null ? '' : String(value);
  if (descriptor.required && !text.trim()) {
    return `${descriptor.name} é obrigatório.`;
  }
  if (!text) {
    return null; // optional and empty — nullable/optional per OAS
  }
  if (descriptor.minLength !== undefined && text.length < descriptor.minLength) {
    return `${descriptor.name} precisa de ao menos ${descriptor.minLength} caracteres.`;
  }
  if (descriptor.maxLength !== undefined && text.length > descriptor.maxLength) {
    return `${descriptor.name} aceita no máximo ${descriptor.maxLength} caracteres.`;
  }
  if (descriptor.pattern && !new RegExp(descriptor.pattern).test(text)) {
    return `${descriptor.name} fora do formato esperado.`;
  }
  if (descriptor.enum && !descriptor.enum.includes(text)) {
    return `${descriptor.name} deve ser um de: ${descriptor.enum.join(', ')}.`;
  }
  return null;
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
