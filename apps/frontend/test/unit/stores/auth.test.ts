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
    localStorage.removeItem('jumentix-frontend-auth');
  });

  it('passes the collected OAS body through to register unchanged', async () => {
    expect.assertions(1);
    responseStatus = 201;
    responseBody = { id: 'user-1' };
    const auth = useAuthStore();
    // Field-level validation moved to the OAS-driven form layer (JUM-766):
    // the store is transport + session, and never re-shapes the contract body.
    await auth.register({ firstName: 'Abraham', username: 'me@mydomain.com', password: 'StrongPass#123' });
    expect(calls.some((url) => url.endsWith('/auth/register'))).toBe(true);
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

  it('drops persisted sessions without a username (JUM-761 follow-up)', () => {
    expect.assertions(2);
    localStorage.setItem('jumentix-frontend-auth', JSON.stringify({ token: 'Bearer orphan' }));
    setActivePinia(createPinia());
    const auth = useAuthStore();
    expect(auth.token).toBe('');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('drops a corrupt persisted session', () => {
    expect.assertions(2);
    localStorage.setItem('jumentix-frontend-auth', '{not json');
    setActivePinia(createPinia());
    const auth = useAuthStore();
    expect(auth.token).toBe('');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('drops a persisted session whose user id cannot be recovered', () => {
    expect.assertions(2);
    localStorage.setItem('jumentix-frontend-auth', JSON.stringify({
      token: 'Bearer deadbeef',
      username: 'me@mydomain.com'
    }));
    setActivePinia(createPinia());
    const auth = useAuthStore();
    expect(auth.userId).toBe('');
    expect(localStorage.getItem('jumentix-frontend-auth')).toBeNull();
  });

  it('survives an environment without localStorage', () => {
    expect.assertions(3);
    const backup = globalThis.localStorage;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).localStorage;
    try {
      setActivePinia(createPinia());
      const auth = useAuthStore();
      expect(auth.token).toBe('');
      auth.expire();
      expect(auth.token).toBe('');
      expect(calls).toHaveLength(0);
    } finally {
      globalThis.localStorage = backup;
    }
  });
});
