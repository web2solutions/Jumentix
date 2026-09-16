import { describe, expect, it } from 'bun:test';

import {
  can, effectiveScopes, hasSuperadmin, requiredScopes, rbacRoleNames
} from '@/contracts/rbac';

/** JUM-772: the UI reads RBAC from the bundled OAS — never from backend code. */
describe('rbac contract (JUM-772)', () => {
  it('exposes the role matrix declared in the OAS x-rbac extension', () => {
    expect.assertions(4);
    expect(rbacRoleNames()).toStrictEqual(['superadmin', 'admin', 'user']);
    expect(effectiveScopes(['superadmin'])).toStrictEqual(['*']);
    // Only superadmins manage multiple organizations.
    expect(effectiveScopes(['admin'])).not.toContain('create_organization');
    expect(effectiveScopes(['user'])).toStrictEqual(['access_allow', 'read_user']);
  });

  it('passes legacy scopes carried loose in the roles array', () => {
    expect.assertions(2);
    expect(effectiveScopes(['access_allow', 'create_transaction'])).toContain('create_transaction');
    expect(can(['access_allow', 'create_transaction'], 'getAll')).toBe(false); // lacks read_user
  });

  it('reads required scopes from each operation security block', () => {
    expect.assertions(4);
    expect(requiredScopes('getAll')).toStrictEqual(['read_user']);
    expect(requiredScopes('deleteOrganization')).toStrictEqual(['delete_organization']);
    expect(requiredScopes('login')).toStrictEqual([]); // public
    expect(requiredScopes('nonExistentOperation')).toStrictEqual([]);
  });

  it('can() grants by role matrix, star and exact scope — failing closed', () => {
    expect.assertions(8);
    expect(can(['superadmin'], 'deleteOrganization')).toBe(true);
    expect(can(['admin'], 'create')).toBe(true); // create_user
    expect(can(['admin'], 'createOrganization')).toBe(false); // superadmin only (JUM-772)
    expect(can(['admin'], 'deleteOrganization')).toBe(false);
    expect(can(['admin'], 'updateOrganization')).toBe(true);
    expect(can(['user'], 'getAll')).toBe(true); // read_user
    expect(can(['user'], 'create')).toBe(false);
    expect(can([], 'getAll')).toBe(false);
  });

  it('hasSuperadmin detects the star scope', () => {
    expect.assertions(2);
    expect(hasSuperadmin(['superadmin'])).toBe(true);
    expect(hasSuperadmin(['admin'])).toBe(false);
  });
});
