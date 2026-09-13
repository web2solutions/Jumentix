import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

import nav from '@/_nav';
import { can } from '@/contracts/rbac';
import { requireScopeRedirect } from '@/router/guards';
import { useProfileStore } from '@/stores/profile';

const routeTo = (path: string, operationId?: string): RouteLocationNormalized => ({
  path,
  meta: operationId ? { operationId } : {}
}) as RouteLocationNormalized;

const setRoles = (roles: string[]): void => {
  const profile = useProfileStore();
  profile.record = {
    id: 'u1',
    firstName: 'T',
    username: 't@x.dev',
    roles,
    emails: [],
    documents: [],
    phones: []
  };
};

/** JUM-772: scope guard + nav filtering driven by the OAS x-rbac matrix. */
describe('router scope guard (JUM-772)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('passes routes without operationId', async () => {
    expect.assertions(1);
    await expect(requireScopeRedirect(routeTo('/dashboard'))).resolves.toBeNull();
  });

  it('admin reaches /users but not organization management', async () => {
    expect.assertions(3);
    setRoles(['admin']);
    await expect(requireScopeRedirect(routeTo('/users', 'getAll'))).resolves.toBeNull();
    await expect(requireScopeRedirect(routeTo('/organizations', 'getAllOrganizations'))).resolves.toBeNull();
    expect(can(['admin'], 'createOrganization')).toBe(false);
  });

  it('user role is redirected from /organizations (no read_organization)', async () => {
    expect.assertions(1);
    setRoles(['user']);
    await expect(requireScopeRedirect(routeTo('/organizations', 'getAllOrganizations'))).resolves.toBe('/dashboard');
  });

  it('superadmin reaches everything', async () => {
    expect.assertions(2);
    setRoles(['superadmin']);
    await expect(requireScopeRedirect(routeTo('/users', 'getAll'))).resolves.toBeNull();
    await expect(requireScopeRedirect(routeTo('/organizations', 'getAllOrganizations'))).resolves.toBeNull();
  });

  it('nav group renders only items the roles can read', () => {
    expect.assertions(3);
    const group = nav.find((item) => item.name === 'nav.usersDomain');
    expect(group?.items?.length).toBe(2);
    const visibleFor = (roles: string[]) => (group?.items ?? [])
      .filter((item) => !item.operationId || can(roles, item.operationId))
      .map((item) => item.name);
    expect(visibleFor(['user'])).toStrictEqual(['nav.users']);
    expect(visibleFor(['admin'])).toStrictEqual(['nav.users', 'nav.organizations']);
  });

  it('nav filtering is correct once roles load late (shell loads the profile record)', () => {
    expect.assertions(2);
    const group = nav.find((item) => item.name === 'nav.usersDomain');
    const visibleFor = (roles: string[]) => (group?.items ?? [])
      .filter((item) => !item.operationId || can(roles, item.operationId))
      .map((item) => item.name);
    // Before the profile record lands (dashboard landing), nothing shows…
    expect(visibleFor([])).toStrictEqual([]);
    // …after the shell-level load (DefaultLayout onMounted), it does.
    setRoles(['superadmin']);
    expect(visibleFor(useProfileStore().record?.roles ?? [])).toStrictEqual(['nav.users', 'nav.organizations']);
  });
});
