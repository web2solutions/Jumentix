import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

import { requireAuthRedirect, requireSyncRedirect } from '@/router/guards';
import { useAuthStore } from '@/stores/auth';

const routeTo = (path: string, isPublic = false): RouteLocationNormalized => ({
  path,
  meta: isPublic ? { public: true } : {}
}) as RouteLocationNormalized;

describe('router auth guard (JUM-760)', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
    setActivePinia(createPinia());
  });

  it('redirects unauthenticated users from protected routes to /login', () => {
    expect.assertions(1);
    expect(requireAuthRedirect(routeTo('/dashboard'))).toBe('/login');
  });

  it('lets unauthenticated users reach public routes', () => {
    expect.assertions(2);
    expect(requireAuthRedirect(routeTo('/login', true))).toBeNull();
    expect(requireAuthRedirect(routeTo('/register', true))).toBeNull();
  });

  it('lets authenticated users reach protected routes', () => {
    expect.assertions(1);
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';

    expect(requireAuthRedirect(routeTo('/dashboard'))).toBeNull();
  });

  it('does not send authenticated users to /sync when Cana is closed', async () => {
    expect.assertions(1);
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    expect(await requireSyncRedirect(routeTo('/dashboard'))).toBeNull();
  });
});
