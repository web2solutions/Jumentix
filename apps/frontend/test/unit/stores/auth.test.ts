import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/auth';

const calls: string[] = [];
let responseStatus = 200;
let responseBody: unknown = {};

describe('auth store (JUM-760)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    calls.length = 0;
    responseStatus = 200;
    responseBody = { Authorization: 'Bearer token-abc' };
    setActivePinia(createPinia());
    // mock() lives inside the hook (jest/require-hook under the monorepo lint).
    globalThis.fetch = mock((url: string) => {
      calls.push(String(url));
      return Promise.resolve({
        ok: responseStatus >= 200 && responseStatus < 300,
        status: responseStatus,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(responseBody),
        text: () => Promise.resolve('Unauthorized')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects register with a password shorter than the OAS minimum before any HTTP call', async () => {
    expect.assertions(2);
    const auth = useAuthStore();

    await expect(
      auth.register({ firstName: 'Abraham', username: 'me@mydomain.com', password: 'short' })
    ).rejects.toThrow('Password must be at least 8 characters.');
    expect(calls).toHaveLength(0);
  });

  it('rejects register without first name before any HTTP call', async () => {
    expect.assertions(2);
    const auth = useAuthStore();

    await expect(
      auth.register({ firstName: ' ', username: 'me@mydomain.com', password: 'StrongPass#123' })
    ).rejects.toThrow('First name is required.');
    expect(calls).toHaveLength(0);
  });

  it('stores the bearer token on a successful login', async () => {
    expect.assertions(3);
    const auth = useAuthStore();

    await auth.login({ username: 'me@mydomain.com', password: 'secret' });

    expect(auth.token).toBe('Bearer token-abc');
    expect(auth.username).toBe('me@mydomain.com');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('keeps the session empty when the backend rejects the login', async () => {
    expect.assertions(3);
    responseStatus = 401;
    responseBody = {};
    const auth = useAuthStore();

    await expect(auth.login({ username: 'me@mydomain.com', password: 'wrong' })).rejects.toThrow();
    expect(auth.token).toBe('');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears the session on logout', async () => {
    expect.assertions(3);
    const auth = useAuthStore();

    await auth.login({ username: 'me@mydomain.com', password: 'secret' });
    await auth.logout();

    expect(auth.token).toBe('');
    expect(auth.username).toBe('');
    expect(calls.some((url) => url.endsWith('/auth/logout'))).toBe(true);
  });
});
