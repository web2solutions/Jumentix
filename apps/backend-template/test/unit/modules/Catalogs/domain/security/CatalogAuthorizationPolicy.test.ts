/* eslint-disable jest/max-expects */
import {
  decideCatalogAccess,
  resolveCatalogCollectionScope,
  resolveCatalogCreationOrganization
} from '@src/modules/Catalogs/domain/security/CatalogAuthorizationPolicy';
import { TENANT_AUTHORIZATION_REASONS } from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';

/**
 * Unit suite for the catalog TENANT-RBAC policy (JUM-491): the catalog is
 * shared exactly inside one organization. The matrix mirrors the contract —
 * superadmin global, admin/user bound to their organization with the fixed
 * denial messages, legacy-scope principals denied by the scope matrix before
 * this policy is ever consulted.
 */
describe('catalogAuthorizationPolicy', () => {
  const orgRecord = { organization: 'org-1' };

  it('allows superadmin globally, even without an organization', () => {
    expect.hasAssertions();
    expect(decideCatalogAccess({ roles: ['superadmin'] }, orgRecord)).toStrictEqual({ allowed: true });
    expect(resolveCatalogCollectionScope({ roles: ['superadmin'] }))
      .toStrictEqual({ decision: { allowed: true }, filters: {} });
  });

  it('allows an admin inside its own organization', () => {
    expect.hasAssertions();
    const principal = { id: 'u1', organization: 'org-1', roles: ['admin'] };
    expect(decideCatalogAccess(principal, orgRecord)).toStrictEqual({ allowed: true });
  });

  it('allows a user inside its own organization — the catalog is shared with the team', () => {
    expect.hasAssertions();
    const principal = { id: 'u2', organization: 'org-1', roles: ['user'] };
    expect(decideCatalogAccess(principal, orgRecord)).toStrictEqual({ allowed: true });
  });

  it('denies cross-organization access with the contract message', () => {
    expect.hasAssertions();
    const principal = { id: 'u3', organization: 'org-2', roles: ['user'] };
    expect(decideCatalogAccess(principal, orgRecord)).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.crossOrganization
    });
  });

  it('denies a tenant principal without an organization', () => {
    expect.hasAssertions();
    const principal = { id: 'u4', roles: ['admin'] };
    expect(decideCatalogAccess(principal, orgRecord)).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.organizationRequired
    });
  });

  it('scopes the collection to the principal organization', () => {
    expect.hasAssertions();
    const principal = { id: 'u5', organization: 'org-1', roles: ['user'] };
    expect(resolveCatalogCollectionScope(principal)).toStrictEqual({
      decision: { allowed: true },
      filters: { organization: 'org-1' }
    });
  });

  it('binds creation to the principal organization when none is requested', () => {
    expect.hasAssertions();
    const principal = { id: 'u6', organization: 'org-1', roles: ['admin'] };
    expect(resolveCatalogCreationOrganization(principal, undefined)).toStrictEqual({
      decision: { allowed: true },
      organization: 'org-1'
    });
  });

  it('denies creation for another organization', () => {
    expect.hasAssertions();
    const principal = { id: 'u7', organization: 'org-1', roles: ['admin'] };
    const { decision } = resolveCatalogCreationOrganization(principal, 'org-2');
    expect(decision).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.crossOrganization
    });
  });

  it('denies the collection scope for a tenant principal without an organization', () => {
    expect.hasAssertions();
    expect(resolveCatalogCollectionScope({ id: 'u8', roles: ['user'] })).toStrictEqual({
      decision: {
        allowed: false,
        reason: TENANT_AUTHORIZATION_REASONS.organizationRequired
      },
      filters: {}
    });
  });

  it('denies creation for a tenant principal without an organization', () => {
    expect.hasAssertions();
    const { decision, organization } = resolveCatalogCreationOrganization({ id: 'u9', roles: ['admin'] }, 'org-1');
    expect(decision).toStrictEqual({
      allowed: false,
      reason: TENANT_AUTHORIZATION_REASONS.organizationRequired
    });
    expect(organization).toBeUndefined();
  });

  it('lets superadmin choose the record organization explicitly', () => {
    expect.hasAssertions();
    expect(resolveCatalogCreationOrganization({ roles: ['superadmin'] }, 'org-9')).toStrictEqual({
      decision: { allowed: true },
      organization: 'org-9'
    });
  });
});
