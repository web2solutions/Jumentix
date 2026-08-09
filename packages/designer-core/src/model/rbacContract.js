/**
 * rbacContract — the designer-side mirror of the tenant RBAC authorization
 * contract, added by JUM-477.
 *
 * The authoritative sources are the contract document
 * (`documentation/md/TENANT-RBAC-AUTHORIZATION-CONTRACT.md`) and the Users
 * domain implementation it derives from
 * (`apps/backend-template/src/modules/Users/domain/security/Rbac.ts` and
 * `TenantAuthorizationPolicy.ts`). This module encodes exactly what the
 * runtime can enforce, so the per-entity RBAC editor can constrain itself to
 * the enforceable set instead of offering configurations the boilerplate
 * would silently not honour.
 *
 * The two facts that shape the editor:
 *
 * 1. The principal vocabulary is closed: the normalized tenant roles
 *    (`superadmin`, `admin`, `user` — `EUserRole`) plus the legacy direct
 *    scopes (`LEGACY_ROLE_SCOPES` in `Rbac.ts`). Anything else is not a role
 *    the runtime can resolve, so it is rejected at edit time and flagged as
 *    an error by model validation (which blocks export through the quality
 *    gate) rather than accepted and dropped.
 *
 * 2. Tenant scoping is NOT an independent flag in the runtime. It is derived
 *    from the role set: `shouldRequireOrganization` in `Rbac.ts` constrains a
 *    principal to its organization exactly when its roles are normalized and
 *    include `admin` or `user`; `superadmin` and legacy direct scopes keep a
 *    global boundary. The editor therefore derives `tenantScoped` from the
 *    selected roles (`deriveTenantScoped`) instead of persisting a free
 *    checkbox value that no runtime knob could honour.
 *
 * Everything here is pure JavaScript — no `document`, no `window` — so the
 * state normalisers, the validation engine, the exporters and the DOM layer
 * can all share it, and it imports and runs under Bun/Node with no DOM shim.
 */

/** The five per-entity actions the designer edits, in inspector order. */
export const RBAC_ACTIONS = ['list', 'getById', 'create', 'update', 'delete'];

/** Normalized tenant roles — mirrors `EUserRole` in `Rbac.ts`. */
export const NORMALIZED_ROLES = ['superadmin', 'admin', 'user'];

/** Legacy direct scopes — mirrors `LEGACY_ROLE_SCOPES` in `Rbac.ts`. */
export const LEGACY_DIRECT_SCOPES = [
  'access_allow',
  'create_account',
  'read_account',
  'update_account',
  'delete_account',
  'create_transaction',
  'delete_transaction',
  'read_transaction',
  'create_user',
  'read_user',
  'update_user',
  'delete_user',
  'create_organization',
  'read_organization',
  'update_organization',
  'delete_organization'
];

export function isNormalizedRole(role) {
  return NORMALIZED_ROLES.includes(role);
}

/** A role the contract can express: normalized tenant role or legacy scope. */
export function isContractRole(role) {
  return isNormalizedRole(role) || LEGACY_DIRECT_SCOPES.includes(role);
}

/**
 * Derive the tenant-scoped boundary for a role set, mirroring
 * `shouldRequireOrganization` in `Rbac.ts`: scoping applies exactly when the
 * set contains normalized roles and one of them is `admin` or `user`.
 * `superadmin`-only and legacy-scope-only sets keep the global boundary.
 */
export function deriveTenantScoped(roles = []) {
  const set = new Set(Array.isArray(roles) ? roles : []);
  if (!NORMALIZED_ROLES.some((role) => set.has(role))) return false;
  return set.has('admin') || set.has('user');
}

/**
 * Normalize one action rule against the contract. Roles are trimmed, deduped
 * strings; unknown roles are KEPT (never silently dropped) so validation can
 * reject them with an actionable message. `tenantScoped` is always derived
 * from the resulting roles — a stored flag is runtime-meaningless and is
 * recomputed on load (compatible extension under Requirement 126 Contract 2:
 * the stored shape `{ roles, tenantScoped }` is unchanged).
 *
 * @param {*} rule - the stored/edited rule (`{ roles, tenantScoped }`).
 * @param {Object} fallback - rule to inherit roles from when `rule.roles` is
 * not an array (typically the default policy's rule for the action).
 */
export function normalizeRbacRule(rule, fallback = { roles: [] }) {
  const roles = Array.isArray(rule?.roles)
    ? [...new Set(rule.roles.map((role) => String(role).trim()).filter(Boolean))]
    : [...(Array.isArray(fallback?.roles) ? fallback.roles : [])];
  return { roles, tenantScoped: deriveTenantScoped(roles) };
}

/**
 * Edit-time validation for one action rule. Returns `{ ok: true }` when every
 * role is contract-expressible, otherwise `{ ok: false, reason }` with an
 * actionable message naming the offending role and the accepted vocabulary —
 * the caller surfaces the reason and persists nothing.
 */
export function validateRbacRule(rule) {
  const roles = Array.isArray(rule?.roles) ? rule.roles : [];
  const unknown = roles.filter((role) => !isContractRole(role));
  if (unknown.length) {
    return {
      ok: false,
      reason: `RBAC role "${unknown[0]}" is not enforceable: the tenant authorization contract only knows the normalized roles (${NORMALIZED_ROLES.join(', ')}) and the legacy direct scopes. Remove "${unknown[0]}" or replace it with a contract role.`
    };
  }
  return { ok: true };
}
