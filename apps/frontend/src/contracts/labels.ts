import type { FieldDescriptor } from '@/contracts/formSchema';
import { currentLocale } from '@/i18n';

/**
 * Field labels from the contract (JUM-780). Order of precedence:
 *
 * 1. `x-label[locale]` (then `x-label.en`) — the localized label the OAS declares;
 * 2. `title` — JSON Schema's own display name;
 * 3. the humanized property name (`firstName` → "First name").
 *
 * `description` is deliberately *not* a label any more: it is help text. The
 * previous behaviour rendered "Organization id for tenant users (admin/user)"
 * as a form label, which is documentation, not a caption.
 */
export const humanize = (name: string): string => {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
  if (!spaced) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

export const fieldLabel = (
  descriptor: Pick<FieldDescriptor, 'name' | 'title' | 'xLabel'>,
  overrides?: Record<string, string>
): string => {
  const override = overrides?.[descriptor.name];
  if (override) return override;
  const locale = currentLocale();
  const localized = descriptor.xLabel?.[locale] ?? descriptor.xLabel?.en;
  if (localized) return localized;
  if (descriptor.title) return descriptor.title;
  return humanize(descriptor.name);
};

/** Help text: the OAS description, shown under the control, never as its label. */
export const fieldHelp = (descriptor: Pick<FieldDescriptor, 'description'>): string | undefined => (
  descriptor.description
);
