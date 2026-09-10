import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore, decodeJwtUserId } from '@/stores/auth';

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

  it('decodes the user id from the login JWT payload', async () => {
    expect.assertions(2);
    const payload = btoa(JSON.stringify({ id: 'user-42', username: 'me@mydomain.com' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    responseBody = { Authorization: `Bearer header.${payload}.signature` };
    const auth = useAuthStore();

    await auth.login({ username: 'me@mydomain.com', password: 'secret' });

    expect(auth.userId).toBe('user-42');
    expect(auth.token).toBe(`Bearer header.${payload}.signature`);
  });

  it('returns empty id for malformed tokens (JUM-762)', () => {
    expect.assertions(3);
    expect(decodeJwtUserId('Bearer deadbeef.signature')).toBe('');
    expect(decodeJwtUserId('')).toBe('');
    expect(decodeJwtUserId('a.b.c')).toBe('');
  });

  it('expire clears the session without any HTTP call (JUM-762)', () => {
    expect.assertions(4);
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.username = 'me@mydomain.com';
    auth.userId = 'user-42';

    auth.expire();

    expect(auth.token).toBe('');
    expect(auth.username).toBe('');
    expect(auth.userId).toBe('');
    expect(calls).toHaveLength(0);
  });
});
