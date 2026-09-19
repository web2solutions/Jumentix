import {
  TENANT_AUTHORIZATION_REASONS,
  decideOrganizationAccess,
  decideUserAccess,
  resolveOrganizationCollectionScope,
  resolveUserCollectionScope,
  resolveUserCreationOrganization
} from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';

describe('tenant authorization policy', () => {
  const superadmin = { id: 'super', roles: ['superadmin'] };
  const admin = { id: 'admin', roles: ['admin'], organization: 'org-1' };
  const user = { id: 'user', roles: ['user'], organization: 'org-1' };
  const legacy = { id: 'legacy', roles: ['read_user'], organization: 'org-1' };

  it('reserves global tenant bypass for superadmin', () => {
    expect.hasAssertions();
    expect(decideOrganizationAccess(superadmin, 'org-2').allowed).toBe(true);
    expect(resolveUserCollectionScope(superadmin).filters).toStrictEqual({});
  });

  it('allows same-tenant access and rejects cross-tenant access', () => {
    expect.hasAssertions();
    expect(decideOrganizationAccess(admin, 'org-1').allowed).toBe(true);
    expect(decideOrganizationAccess(admin, 'org-2')).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.crossOrganization
    });
    expect(decideUserAccess(admin, { id: 'other', organization: 'org-1' }).allowed).toBe(true);
    expect(decideUserAccess(admin, { id: 'other', organization: 'org-2' }).allowed).toBe(false);
  });

  it('restricts normalized users to their own user record', () => {
    expect.hasAssertions();
    expect(decideUserAccess(user, { id: 'user', organization: 'org-1' }).allowed).toBe(true);
    expect(decideUserAccess(user, { id: 'other', organization: 'org-1' })).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.selfOnly
    });
    expect(resolveUserCollectionScope(user).filters).toStrictEqual({
      organization: 'org-1',
      id: 'user'
    });
  });

  it('binds tenant-created users and preserves superadmin choice', () => {
    expect.hasAssertions();
    expect(resolveUserCreationOrganization(admin)).toStrictEqual({
      decision: { allowed: true },
      organization: 'org-1'
    });
    expect(resolveUserCreationOrganization(admin, 'org-2').decision.allowed).toBe(false);
    expect(resolveUserCreationOrganization(superadmin).organization).toBeUndefined();
  });

  it('preserves domain-defined global behavior for legacy direct scopes', () => {
    expect.hasAssertions();
    const unboundLegacy = { id: 'legacy', roles: ['read_user'] };
    expect(decideUserAccess(unboundLegacy, {
      id: 'other',
      organization: 'org-2'
    }).allowed).toBe(true);
    expect(resolveUserCollectionScope(legacy).filters).toStrictEqual({});
    expect(resolveOrganizationCollectionScope(unboundLegacy).filters).toStrictEqual({});
  });

  it('fails closed when a tenant principal has no organization', () => {
    expect.hasAssertions();
    const unboundAdmin = { id: 'admin', roles: ['admin'] };
    expect(decideUserAccess(unboundAdmin, { id: 'target' }).reason)
      .toBe(TENANT_AUTHORIZATION_REASONS.organizationRequired);
    expect(resolveUserCollectionScope(unboundAdmin).decision.allowed).toBe(false);
    expect(resolveOrganizationCollectionScope(unboundAdmin).decision.allowed).toBe(false);
  });

  it('scopes a user collection to the organization alone when the principal has no id', () => {
    expect.hasAssertions();
    // An admin (not a normalized user) without an id still gets the
    // organization filter, but the id filter is not fabricated.
    const orgAdmin = { roles: ['admin'], organization: 'org-1' };
    expect(resolveUserCollectionScope(orgAdmin)).toStrictEqual({
      decision: { allowed: true },
      filters: { organization: 'org-1' }
    });
  });
});
