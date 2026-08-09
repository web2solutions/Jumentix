import {
  hasSuperadminRole,
  shouldRequireOrganization
} from '@src/modules/Users/domain/security/Rbac';
import type {
  ITenantAuthorizationDecision,
  ITenantPrincipal
} from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';
import {
  TENANT_AUTHORIZATION_REASONS
} from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';

/**
 * CatalogAuthorizationPolicy — the TENANT-RBAC contract applied to the shared
 * catalog (JUM-491). The catalog is shared exactly inside one organization:
 *
 * - superadmin keeps the global boundary (consistent with the contract);
 * - admin/user principals REQUIRE an organization and can only reach catalog
 *   records of their own organization — cross-organization access is denied;
 * - principals outside the normalized tenant roles (legacy direct scopes)
 *   hold no catalog scope at all, so the scope matrix denies them before this
 *   policy is consulted.
 *
 * The decision functions are pure, mirroring `TenantAuthorizationPolicy` for
 * the Users domain, so controllers get a reviewable allow/deny with the
 * contract's fixed denial messages.
 */
export interface ICatalogTenantTarget {
  organization?: string;
}

const allow = (): ITenantAuthorizationDecision => ({ allowed: true });
const deny = (reason: string): ITenantAuthorizationDecision => ({ allowed: false, reason });

export const decideCatalogAccess = (
  principal: ITenantPrincipal,
  target: ICatalogTenantTarget
): ITenantAuthorizationDecision => {
  if (!shouldRequireOrganization(principal.roles) || hasSuperadminRole(principal.roles)) {
    return allow();
  }
  if (!principal.organization) {
    return deny(TENANT_AUTHORIZATION_REASONS.organizationRequired);
  }
  if (target.organization !== principal.organization) {
    return deny(TENANT_AUTHORIZATION_REASONS.crossOrganization);
  }
  return allow();
};

export const resolveCatalogCreationOrganization = (
  principal: ITenantPrincipal,
  requestedOrganization?: string
): { decision: ITenantAuthorizationDecision; organization?: string } => {
  if (!shouldRequireOrganization(principal.roles) || hasSuperadminRole(principal.roles)) {
    return { decision: allow(), organization: requestedOrganization };
  }
  if (!principal.organization) {
    return { decision: deny(TENANT_AUTHORIZATION_REASONS.organizationRequired) };
  }
  if (requestedOrganization && requestedOrganization !== principal.organization) {
    return { decision: deny(TENANT_AUTHORIZATION_REASONS.crossOrganization) };
  }
  return { decision: allow(), organization: principal.organization };
};

export const resolveCatalogCollectionScope = (
  principal: ITenantPrincipal
): { decision: ITenantAuthorizationDecision; filters: Record<string, string> } => {
  if (!shouldRequireOrganization(principal.roles) || hasSuperadminRole(principal.roles)) {
    return { decision: allow(), filters: {} };
  }
  if (!principal.organization) {
    return {
      decision: deny(TENANT_AUTHORIZATION_REASONS.organizationRequired),
      filters: {}
    };
  }
  return {
    decision: allow(),
    filters: { organization: principal.organization }
  };
};
