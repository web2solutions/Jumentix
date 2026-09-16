import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

import { META_STORE, SESSION_META_ID } from '@/data/canaSchema';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import { requireAuthRedirect, requireScopeRedirect, requireSyncRedirect } from '@/router/guards';
import { useAuthStore } from '@/stores/auth';

const DB = 'jumentix-frontend-test-guards';

const makeJwt = (expSeconds: number): string => {
  const payload = Buffer.from(JSON.stringify({ id: 'u1', username: 'a@b.c', exp: expSeconds }))
    .toString('base64url');
  return `x.${payload}.y`;
};

const routeTo = (
  path: string,
  extra: Partial<RouteLocationNormalized> = {}
): RouteLocationNormalized => ({
  path,
  meta: {},
  ...extra
}) as RouteLocationNormalized;

/** Router guards beyond the auth-only paths (JUM-760/772/802). */
describe('router guards with session state and Cana (JUM-760/772/802)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.localStorage?.clear();
    setActivePinia(createPinia());
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('redirects to /login when the stored JWT is already expired', () => {
    expect.hasAssertions();
    const auth = useAuthStore();
    auth.token = `Bearer ${makeJwt(Math.floor(Date.now() / 1000) - 60)}`;
    expect(requireAuthRedirect(routeTo('/dashboard'))).toBe('/login');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('sends an authenticated but unsynced session to /sync and a synced one onward', async () => {
    expect.hasAssertions();
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    await openCana(DB);
    await wipeCanaDatabase();

    expect(await requireSyncRedirect(routeTo('/dashboard'))).toBe('/sync');
    expect(await requireSyncRedirect(routeTo('/sync', { name: 'Sync' }))).toBeNull();

    await getCanaClient().table(META_STORE).put({
      id: SESSION_META_ID,
      username: 'a@b.c',
      userId: 'u1',
      lastSyncAt: '2026-01-01T00:00:00.000Z'
    });
    expect(await requireSyncRedirect(routeTo('/dashboard'))).toBeNull();
    expect(await requireSyncRedirect(routeTo('/sync', { name: 'Sync' }))).toBe('/dashboard');
  });

  it('redirects to /dashboard when the profile cannot be loaded for the scope check', async () => {
    expect.hasAssertions();
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
      text: async () => '{}'
    })) as unknown as typeof fetch;

    const target = routeTo('/users', { meta: { operationId: 'getAll' } });
    await expect(requireScopeRedirect(target)).resolves.toBe('/dashboard');
  });
});
