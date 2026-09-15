import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';

import { resetSharedApiClient, getSharedApiClient } from '@/contracts/apiClient';
import { installSessionGuard } from '@/contracts/sessionGuard';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore, type UserRecord } from '@/stores/profile';

const recordFixture: UserRecord = {
  id: 'user-1',
  firstName: 'Abraham',
  username: 'me@mydomain.com',
  roles: ['admin'],
  emails: [{
    id: 'e1', type: 'work', email: 'me@mydomain.com', isPrimary: true
  }],
  documents: [],
  phones: []
};

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', component: { template: '<div />' }, meta: { public: true } },
    { path: '/dashboard', component: { template: '<div />' } }
  ]
});

/** installSessionGuard (JUM-776): a 401 on any page expires and redirects. */
describe('installSessionGuard (JUM-776)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    resetSharedApiClient();
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'user-1';
    auth.username = 'me@mydomain.com';
    useProfileStore().record = recordFixture;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('expires the session, resets the profile and lands on /login after a 401', async () => {
    expect.hasAssertions();
    const router = makeRouter();
    await router.push('/dashboard');
    installSessionGuard(router);
    globalThis.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('Unauthorized')
    } as unknown as Response));

    await expect(getSharedApiClient().request({ operationId: 'getOneById', pathParams: { id: 'user-1' } }))
      .rejects.toThrow();

    const auth = useAuthStore();
    expect(auth.token).toBe('');
    expect(useProfileStore().record).toBeNull();
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('ignores non-401 failures and keeps the session', async () => {
    expect.hasAssertions();
    const router = makeRouter();
    await router.push('/dashboard');
    installSessionGuard(router);
    globalThis.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('boom')
    } as unknown as Response));

    await expect(getSharedApiClient().request({ operationId: 'getOneById', pathParams: { id: 'user-1' } }))
      .rejects.toThrow();

    expect(useAuthStore().token).toBe('Bearer session-token');
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('does not redirect while on a public route', async () => {
    expect.hasAssertions();
    const router = makeRouter();
    await router.push('/login');
    installSessionGuard(router);
    globalThis.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('Unauthorized')
    } as unknown as Response));

    await expect(getSharedApiClient().request({ operationId: 'getOneById', pathParams: { id: 'user-1' } }))
      .rejects.toThrow();

    expect(useAuthStore().token).toBe('');
    expect(router.currentRoute.value.path).toBe('/login');
  });
});
