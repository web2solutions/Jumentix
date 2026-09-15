import {
  afterEach, beforeEach, mock
} from 'bun:test';

import { resetSharedApiClient } from '@/contracts/apiClient';
import { closeCana } from '@/data/db';

const originalFetch = globalThis.fetch;

const clearBrowserStorage = (): void => {
  localStorage.clear();
  sessionStorage.clear();
};

beforeEach(() => {
  resetSharedApiClient();
  clearBrowserStorage();
  globalThis.fetch = originalFetch;
});

afterEach(async () => {
  mock.restore();
  resetSharedApiClient();
  await closeCana();
  clearBrowserStorage();
  globalThis.fetch = originalFetch;
  document.body.innerHTML = '';
});
