import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';

import { createApiClient } from '@/contracts/apiClient';

/** apiClient base URL resolution (requirement 136): env override, window origin, fallback. */
describe('apiClient base URL resolution', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.VITE_API_BASE_URL;

  beforeEach(() => {
    globalThis.fetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ Authorization: 'Bearer t' }),
      text: () => Promise.resolve('{}')
    } as unknown as Response));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = originalEnv;
  });

  it('honours VITE_API_BASE_URL when set', async () => {
    expect.assertions(1);
    process.env.VITE_API_BASE_URL = 'http://env.example/api/1.0.0';
    const calls: string[] = [];
    globalThis.fetch = mock((url: string) => {
      calls.push(String(url));
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ Authorization: 'Bearer t' }),
        text: () => Promise.resolve('{}')
      } as unknown as Response);
    });
    const client = createApiClient();
    await client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x'.repeat(8) } });
    expect(calls[0]).toBe('http://env.example/api/1.0.0/auth/login');
  });

  it('derives the base from the window origin in the browser', async () => {
    expect.assertions(1);
    delete process.env.VITE_API_BASE_URL;
    const calls: string[] = [];
    globalThis.fetch = mock((url: string) => {
      calls.push(String(url));
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ Authorization: 'Bearer t' }),
        text: () => Promise.resolve('{}')
      } as unknown as Response);
    });
    const client = createApiClient();
    await client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x'.repeat(8) } });
    expect(calls[0]).toBe('http://localhost:3001/api/1.0.0/auth/login');
  });

  it('falls back to localhost when there is no window', async () => {
    expect.assertions(1);
    delete process.env.VITE_API_BASE_URL;
    const windowBackup = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).window;
    try {
      const client = createApiClient();
      const calls: string[] = [];
      globalThis.fetch = mock((url: string) => {
        calls.push(String(url));
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ Authorization: 'Bearer t' }),
          text: () => Promise.resolve('{}')
        } as unknown as Response);
      });
      await client.request({ operationId: 'login', body: { username: 'a@b.c', password: 'x'.repeat(8) } });
      expect(calls[0]).toBe('http://localhost:3001/api/1.0.0/auth/login');
    } finally {
      globalThis.window = windowBackup;
    }
  });
});
