import openApi from './openapi.json';

/**
 * RBAC for OAS-driven UIs (JUM-772): the role→scope matrix lives in the spec
 * (`info.x-rbac`, enforced server-side) and each operation declares its scopes
 * in `security`. The frontend derives everything from the bundled contract —
 * it never reads backend code (requirement 136).
 */

interface RbacOperation {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
}

interface RbacSpec {
  info?: { 'x-rbac'?: { roles?: Record<string, string[]> } };
  paths?: Record<string, Record<string, RbacOperation>>;
}

const spec = openApi as RbacSpec;

/** Role names declared in the OAS matrix (e.g. superadmin, admin, user). */
export const rbacRoleNames = (): string[] => Object.keys(spec.info?.['x-rbac']?.roles ?? {});

/**
 * Expands roles into effective scopes using the OAS matrix. Entries that are
 * not matrix roles (legacy scopes carried loose in the roles array) pass
 * through as scopes themselves.
 */
export const effectiveScopes = (roles: string[] = []): string[] => {
  const matrix = spec.info?.['x-rbac']?.roles ?? {};
  const granted = new Set<string>();
  for (const role of roles) {
    const mapped = matrix[role];
    if (mapped) {
      mapped.forEach((scope) => granted.add(scope));
    } else {
      granted.add(role);
    }
  }
  return [...granted];
};

const operationScopesMap = (): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  for (const pathItem of Object.values(spec.paths ?? {})) {
    Object.values(pathItem)
      .filter((operation) => Boolean(operation?.operationId))
      .forEach((operation) => {
        // Our spec declares a single bearerAuth requirement per operation; the
        // scope list inside it is ANDed. Multiple alternatives (OR) are folded.
        const requirements = (operation.security ?? [])
          .flatMap((requirement) => Object.values(requirement).flat());
        map[(operation as { operationId?: string }).operationId as string] = requirements;
      });
  }
  return map;
};

const scopesByOperation = operationScopesMap();

/** Scopes an operation requires per the OAS (empty = public operation). */
export const requiredScopes = (operationId: string): string[] => (
  scopesByOperation[operationId] ?? []
);

/**
 * True when the roles satisfy every scope the operation requires. Operations
 * absent from the contract fail closed (unknown surface is not granted).
 */
export const can = (roles: string[] | undefined, operationId: string): boolean => {
  const required = scopesByOperation[operationId];
  if (!required) return false;
  if (required.length === 0) return true;
  const scopes = effectiveScopes(roles ?? []);
  if (scopes.includes('*')) return true;
  return required.every((scope) => scopes.includes(scope));
};

/** True for superadmin roles (matrix `*`). */
export const hasSuperadmin = (roles: string[] | undefined): boolean => (
  effectiveScopes(roles ?? []).includes('*')
);
