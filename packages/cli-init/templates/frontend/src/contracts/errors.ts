import { t } from '@/i18n';

/**
 * Human-readable mapping of the SDK's `REST request failed: <status> <body>`
 * errors (JUM-765). Backend error messages are preserved when present;
 * generic texts come from the i18n table (JUM-780).
 */
export const formatApiError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const match = /REST request failed: (\d{3})\s*(.*)/s.exec(message);
  if (!match) {
    return message;
  }
  const status = Number(match[1]);
  let backendMessage = '';
  try {
    const parsed = JSON.parse(match[2] || '{}') as { message?: string };
    backendMessage = parsed.message ?? '';
  } catch {
    backendMessage = match[2]?.slice(0, 120) ?? '';
  }

  switch (status) {
    case 400:
      return backendMessage || t('error.badRequest');
    case 401:
      return t('error.unauthorized');
    case 403:
      return t('error.forbidden');
    case 404:
      return t('error.notFound');
    case 409:
      return backendMessage || t('error.conflict');
    default:
      if (status >= 500) {
        return t('error.server');
      }
      return backendMessage || t('error.generic', { status });
  }
};

export const isNotFoundError = (error: unknown): boolean => (
  error instanceof Error && /REST request failed: 404(\s|$)/.test(error.message)
);

/** Status code of an SDK error, or undefined when it is not an HTTP failure. */
export const apiErrorStatus = (error: unknown): number | undefined => {
  const message = error instanceof Error ? error.message : String(error);
  const match = /REST request failed: (\d{3})/.exec(message);
  return match ? Number(match[1]) : undefined;
};
