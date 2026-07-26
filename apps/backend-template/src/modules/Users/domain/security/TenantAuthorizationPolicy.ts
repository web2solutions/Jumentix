import {
  EUserRole,
  hasSuperadminRole,
  normalizeRoles,
  shouldRequireOrganization
} from './Rbac';

export const TENANT_AUTHORIZATION_REASONS = {
  organizationRequired: 'Insufficient permission - organization scope is required',
  crossOrganization: 'Insufficient permission - cross organization access is forbidden',
  selfOnly: 'Insufficient permission - user scope is restricted to the authenticated user'
} as const;

export interface ITenantPrincipal {
  id?: string;
  organization?: string;
  roles?: string[];
}

export interface IUserTenantTarget {
  id?: string;
  organization?: string;
}

export type ITenantAuthorizationDecision =
  | { allowed: true; reason?: never }
  | { allowed: false; reason: string };

const allow = (): ITenantAuthorizationDecision => ({ allowed: true });
const deny = (reason: string): ITenantAuthorizationDecision => ({ allowed: false, reason });

const isTenantPrincipal = (principal: ITenantPrincipal): boolean => {
  return shouldRequireOrganization(principal.roles);
};

const isNormalizedUser = (principal: ITenantPrincipal): boolean => {
  const roles = normalizeRoles(principal.roles);
  return roles.includes(EUserRole.user) && !roles.includes(EUserRole.admin);
};

export const decideOrganizationAccess = (
  principal: ITenantPrincipal,
  organizationId: string
): ITenantAuthorizationDecision => {
  if (!isTenantPrincipal(principal) || hasSuperadminRole(principal.roles)) return allow();
  if (!principal.organization) {
    return deny(TENANT_AUTHORIZATION_REASONS.organizationRequired);
  }
  if (principal.organization !== organizationId) {
    return deny(TENANT_AUTHORIZATION_REASONS.crossOrganization);
  }
  return allow();
};

export const decideUserAccess = (
  principal: ITenantPrincipal,
  target: IUserTenantTarget
): ITenantAuthorizationDecision => {
  if (!isTenantPrincipal(principal) || hasSuperadminRole(principal.roles)) return allow();
  if (!principal.organization) {
    return deny(TENANT_AUTHORIZATION_REASONS.organizationRequired);
  }
  if (target.id === principal.id) return allow();
  if (isNormalizedUser(principal)) {
    return deny(TENANT_AUTHORIZATION_REASONS.selfOnly);
  }
  if (target.organization !== principal.organization) {
    return deny(TENANT_AUTHORIZATION_REASONS.crossOrganization);
  }
  return allow();
};

export const resolveUserCreationOrganization = (
  principal: ITenantPrincipal,
  requestedOrganization?: string
): { decision: ITenantAuthorizationDecision; organization?: string } => {
  if (!isTenantPrincipal(principal) || hasSuperadminRole(principal.roles)) {
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

export const resolveUserCollectionScope = (
  principal: ITenantPrincipal
): { decision: ITenantAuthorizationDecision; filters: Record<string, string> } => {
  if (!isTenantPrincipal(principal) || hasSuperadminRole(principal.roles)) {
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
    filters: {
      organization: principal.organization,
      ...(isNormalizedUser(principal) && principal.id ? { id: principal.id } : {})
    }
  };
};

export const resolveOrganizationCollectionScope = (
  principal: ITenantPrincipal
): { decision: ITenantAuthorizationDecision; filters: Record<string, string> } => {
  if (!isTenantPrincipal(principal) || hasSuperadminRole(principal.roles)) {
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
    filters: { id: principal.organization }
  };
};
