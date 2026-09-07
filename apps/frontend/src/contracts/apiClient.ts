import { RestApiClient } from '@jumentix/sdk-rest-client';

import openApi from './openapi.json';

/**
 * The OAS document is the only backend reference this app knows
 * (requirement 136): bundled at build time by scripts/sync-contracts.mjs
 * and injected into the SDK, whose default loader reads the spec from disk
 * and therefore cannot run in the browser.
 *
 * The SDK parses URLs with `new URL(...)`, so the base must be absolute:
 * same-origin in the browser (vite proxies /api to the standalone backend
 * in dev), an explicit http URL everywhere else (tests, SSR).
 */
const defaultBaseUrl = (): string => {
  const fromEnv = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/1.0.0`;
  }
  return 'http://localhost:3001/api/1.0.0';
};

export const createApiClient = (baseUrl: string = defaultBaseUrl()): RestApiClient => {
  const injectBundledSpec = () => ({ openApi: openApi as Record<string, unknown> });
  return new RestApiClient(baseUrl, injectBundledSpec);
};
