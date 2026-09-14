import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

import { can } from '@/contracts/rbac';
import '@/modules/index';
import { findModule, visibleEntityTabs } from '@/modules/manifest';
import { navFromModules } from '@/modules/nav';
import { requireScopeRedirect } from '@/router/guards';
import { useProfileStore } from '@/stores/profile';

const routeTo = (
  path: string,
  operationId?: string,
  extra: Partial<RouteLocationNormalized> = {}
): RouteLocationNormalized => ({
  path,
  meta: operationId ? { operationId } : {},
  ...extra
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

/** JUM-772/797: scope guard + module nav/tabs driven by the OAS x-rbac matrix. */
describe('router scope guard (JUM-772)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('passes routes without operationId', async () => {
    expect.assertions(1);
    await expect(requireScopeRedirect(routeTo('/dashboard'))).resolves.toBeNull();
  });

  it('admin reaches /users but cannot create organizations', async () => {
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

  it('blocks the organizations tab on the module route for the user role', async () => {
    expect.assertions(1);
    setRoles(['user']);
    await expect(requireScopeRedirect(routeTo('/m/users/organizations', undefined, {
      name: 'Module',
      params: { moduleId: 'users', tab: 'organizations' }
    }))).resolves.toBe('/dashboard');
  });

  it('superadmin reaches everything', async () => {
    expect.assertions(2);
    setRoles(['superadmin']);
    await expect(requireScopeRedirect(routeTo('/users', 'getAll'))).resolves.toBeNull();
    await expect(requireScopeRedirect(routeTo('/organizations', 'getAllOrganizations'))).resolves.toBeNull();
  });

  it('nav lists modules the role may open; entity tabs stay inside the module', () => {
    expect.assertions(4);
    const users = findModule('users');
    expect(navFromModules(['user']).map((item) => item.name)).toStrictEqual(['module.users']);
    expect(navFromModules(['admin']).map((item) => item.name)).toStrictEqual(['module.users']);
    expect(visibleEntityTabs(users!, ['user']).map((item) => item.id)).toStrictEqual(['users']);
    expect(visibleEntityTabs(users!, ['admin']).map((item) => item.id)).toStrictEqual(['users', 'organizations']);
  });

  it('hides every module until roles load', () => {
    expect.assertions(2);
    expect(navFromModules([])).toStrictEqual([]);
    setRoles(['superadmin']);
    expect(navFromModules(useProfileStore().record?.roles ?? []).map((item) => item.name))
      .toStrictEqual(['module.users']);
  });
});
