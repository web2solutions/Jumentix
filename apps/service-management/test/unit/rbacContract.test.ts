/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

import path from 'path';

/**
 * Req 126 path pin: resolve the runtime Rbac source by configured path, never
 * via `@src` / workspace-crossing module import (JUM-828 / Req 137).
 */
const {
  EUserRole,
  resolveRoleScopes,
  shouldRequireOrganization
} = require(
  path.resolve(
    process.cwd(),
    'apps/backend-template/src/modules/Users/domain/security/Rbac.ts'
  )
);

/**
 * Unit suite for the tenant RBAC contract mirror added by JUM-477
 * (`packages/designer-core/src/model/rbacContract.js`) and its consumers in
 * the designer: the state normalisers (`designerState.js`), the model
 * validation rule that rejects unenforceable roles, and the `entity.meta`
 * round-trip through the JSON and domain-package export/import paths.
 *
 * The mirror is pinned against the runtime source of truth itself
 * (`Rbac.ts`): if the domain vocabulary drifts, this suite fails instead of
 * the designer silently offering roles the boilerplate cannot enforce.
 */

const {
  LEGACY_DIRECT_SCOPES,
  NORMALIZED_ROLES,
  RBAC_ACTIONS,
  deriveTenantScoped,
  isContractRole,
  isNormalizedRole,
  normalizeRbacRule,
  validateRbacRule
} = require(
  '@jumentix/designer-core/model/rbacContract.js'
);
const {
  getDefaultRbacPolicy,
  normalizeRbacPolicyInput,
  normalizeStatePayload
} = require(
  '@jumentix/designer-core/state/designerState.js'
);
const { collectModelIssues } = require(
  '@jumentix/designer-core/validation/modelValidation.js'
);
const { buildDomainPackageDocument, buildJsonExportDocument } = require(
  '@jumentix/designer-core/exporters/designerExporters.js'
);
const { buildDomainFromPackage } = require(
  '@jumentix/designer-core/importers/designerImporters.js'
);

function createEntity(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'entity-1',
    name: 'Invoice',
    x: 14,
    y: 14,
    fields: [{
      name: 'id', type: 'uuid', required: true, pk: true, fk: false, unique: true
    }],
    meta: {
      aggregateRoot: false,
      invariants: [],
      rbac: getDefaultRbacPolicy(),
      contracts: [],
      oasComposition: {
        mode: '', refs: [], externalRefs: [], discriminator: ''
      }
    },
    ...overrides
  };
}

function createState(entityOverrides: Record<string, unknown> = {}) {
  return {
    domains: [{
      id: 'domain-1',
      name: 'Billing',
      color: '#60a5fa',
      x: 120,
      y: 90,
      context: {},
      entities: [createEntity(entityOverrides)]
    }],
    relationships: [],
    view: { zoom: 1 }
  };
}

describe('rbacContract module (JUM-477)', () => {
  describe('role vocabulary mirrors the runtime source of truth (Rbac.ts)', () => {
    it('pins the normalized roles to EUserRole exactly', () => {
      expect.hasAssertions();
      expect(NORMALIZED_ROLES).toStrictEqual(Object.values(EUserRole));
    });

    it('pins the five designer actions', () => {
      expect.hasAssertions();
      expect(RBAC_ACTIONS).toStrictEqual(['list', 'getById', 'create', 'update', 'delete']);
    });

    it('offers only legacy scopes the runtime actually resolves', () => {
      expect.hasAssertions();
      LEGACY_DIRECT_SCOPES.forEach((scope: string) => {
        expect(resolveRoleScopes([scope])).toStrictEqual([scope]);
      });
      expect(LEGACY_DIRECT_SCOPES).toHaveLength(16);
    });

    it('classifies normalized roles, legacy scopes and unknown strings', () => {
      expect.hasAssertions();
      expect(isNormalizedRole('admin')).toBe(true);
      expect(isNormalizedRole('read_user')).toBe(false);
      expect(isContractRole('superadmin')).toBe(true);
      expect(isContractRole('create_organization')).toBe(true);
      expect(isContractRole('owner')).toBe(false);
      expect(resolveRoleScopes(['owner'])).toStrictEqual([]);
    });
  });

  describe('deriveTenantScoped mirrors shouldRequireOrganization', () => {
    const roleSets: string[][] = [
      [],
      ['superadmin'],
      ['admin'],
      ['user'],
      ['superadmin', 'admin'],
      ['superadmin', 'user'],
      ['admin', 'user'],
      ['superadmin', 'admin', 'user'],
      ['read_user'],
      ['create_organization'],
      ['read_user', 'admin']
    ];

    it('agrees with the runtime for every role-set shape', () => {
      expect.hasAssertions();
      roleSets.forEach((roles) => {
        expect(deriveTenantScoped(roles)).toBe(shouldRequireOrganization(roles));
      });
    });

    it('treats a non-array input as an empty role set', () => {
      expect.hasAssertions();
      expect(deriveTenantScoped(undefined as unknown as string[])).toBe(false);
      expect(deriveTenantScoped('admin' as unknown as string[])).toBe(false);
    });
  });

  describe('normalizeRbacRule', () => {
    it('trims, dedupes and derives tenantScoped from the roles', () => {
      expect.hasAssertions();
      expect(normalizeRbacRule({ roles: [' admin ', 'admin', '', 'user'], tenantScoped: false }))
        .toStrictEqual({ roles: ['admin', 'user'], tenantScoped: true });
    });

    it('repairs a stored tenantScoped flag the runtime could not honour', () => {
      expect.hasAssertions();
      // superadmin-only is a global boundary: a stored `true` had no runtime meaning.
      expect(normalizeRbacRule({ roles: ['superadmin'], tenantScoped: true }))
        .toStrictEqual({ roles: ['superadmin'], tenantScoped: false });
    });

    it('keeps unknown roles for validation to reject instead of dropping them', () => {
      expect.hasAssertions();
      expect(normalizeRbacRule({ roles: ['admin', 'owner'] }))
        .toStrictEqual({ roles: ['admin', 'owner'], tenantScoped: true });
    });

    it('inherits roles from the fallback when the stored roles are not an array', () => {
      expect.hasAssertions();
      expect(normalizeRbacRule({ roles: 'nope' }, { roles: ['superadmin', 'admin'] }))
        .toStrictEqual({ roles: ['superadmin', 'admin'], tenantScoped: true });
    });

    it('defaults to empty roles without a fallback or with a roleless fallback', () => {
      expect.hasAssertions();
      expect(normalizeRbacRule({})).toStrictEqual({ roles: [], tenantScoped: false });
      expect(normalizeRbacRule({ roles: null }, { tenantScoped: true }))
        .toStrictEqual({ roles: [], tenantScoped: false });
    });
  });

  describe('validateRbacRule (edit-time gate)', () => {
    it('accepts normalized roles and legacy direct scopes', () => {
      expect.hasAssertions();
      expect(validateRbacRule({ roles: ['superadmin', 'admin', 'user'] })).toStrictEqual({ ok: true });
      expect(validateRbacRule({ roles: ['read_user', 'delete_organization'] })).toStrictEqual({ ok: true });
      expect(validateRbacRule({ roles: [] })).toStrictEqual({ ok: true });
      expect(validateRbacRule({})).toStrictEqual({ ok: true });
    });

    it('rejects an unenforceable role with an actionable reason', () => {
      expect.hasAssertions();
      expect(validateRbacRule({ roles: ['create_invoice', 'read_user'] }).ok).toBe(false);
      const verdict = validateRbacRule({ roles: ['admin', 'owner'] });
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toContain('"owner"');
      expect(verdict.reason).toContain('superadmin, admin, user');
      expect(verdict.reason).toContain('Remove "owner"');
    });
  });

  describe('designer defaults and load-time normalisation', () => {
    it('pins the default policy: contract roles only, tenantScoped derived', () => {
      expect.hasAssertions();
      const policy = getDefaultRbacPolicy();
      expect(Object.keys(policy).sort()).toStrictEqual([...RBAC_ACTIONS].sort());
      expect(policy).toStrictEqual({
        list: { roles: ['superadmin', 'admin'], tenantScoped: true },
        getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
        create: { roles: ['superadmin', 'admin'], tenantScoped: true },
        update: { roles: ['superadmin', 'admin'], tenantScoped: true },
        delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
      });
      RBAC_ACTIONS.forEach((action: string) => {
        expect(policy[action].tenantScoped).toBe(deriveTenantScoped(policy[action].roles));
        policy[action].roles.forEach((role: string) => expect(isContractRole(role)).toBe(true));
      });
    });

    it('normalizeRbacPolicyInput returns the defaults for an empty source', () => {
      expect.hasAssertions();
      expect(normalizeRbacPolicyInput(undefined)).toStrictEqual(getDefaultRbacPolicy());
      expect(normalizeRbacPolicyInput({})).toStrictEqual(getDefaultRbacPolicy());
    });

    it('normalizeRbacPolicyInput merges stored rules over the defaults and re-derives tenantScoped', () => {
      expect.hasAssertions();
      const policy = normalizeRbacPolicyInput({
        list: { roles: ['superadmin'], tenantScoped: true },
        delete: { roles: ['admin'], tenantScoped: false }
      });
      expect(policy.list).toStrictEqual({ roles: ['superadmin'], tenantScoped: false });
      expect(policy.delete).toStrictEqual({ roles: ['admin'], tenantScoped: true });
      expect(policy.getById).toStrictEqual(getDefaultRbacPolicy().getById);
    });
  });

  describe('model validation rejects what the contract cannot enforce', () => {
    it('reports an error for an unknown role so the export gate blocks it', () => {
      expect.hasAssertions();
      const entity = createEntity();
      entity.meta.rbac = {
        ...getDefaultRbacPolicy(),
        create: { roles: ['admin', 'owner'], tenantScoped: true }
      };
      const issues = collectModelIssues({
        domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }],
        relationships: []
      });
      expect(issues).toStrictEqual([{
        message: 'Entity Billing/Invoice RBAC action "create" references role "owner", which the tenant authorization contract cannot enforce.',
        entityId: 'entity-1',
        severity: 'error'
      }]);
    });

    it('accepts legacy direct scopes as contract-expressible roles', () => {
      expect.hasAssertions();
      const entity = createEntity();
      entity.meta.rbac = {
        ...getDefaultRbacPolicy(),
        list: { roles: ['read_user'], tenantScoped: false }
      };
      const issues = collectModelIssues({
        domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }],
        relationships: []
      });
      expect(issues).toStrictEqual([]);
    });
  });

  describe('entity.meta round-trip: RBAC survives export/import', () => {
    it('round-trips the policy through the JSON export and normalizeStatePayload', () => {
      expect.hasAssertions();
      const custom = normalizeRbacPolicyInput({
        create: { roles: ['superadmin'], tenantScoped: true },
        list: { roles: ['admin', 'user'], tenantScoped: false }
      });
      const state = createState();
      state.domains[0].entities[0].meta.rbac = custom;
      const exported = JSON.parse(JSON.stringify(buildJsonExportDocument(state)));
      const restored = normalizeStatePayload(exported);
      expect(restored.domains[0].entities[0].meta.rbac).toStrictEqual(custom);
      expect(restored.domains[0].entities[0].meta.rbac.create)
        .toStrictEqual({ roles: ['superadmin'], tenantScoped: false });
    });

    it('round-trips the policy through the domain-package export and import', () => {
      expect.hasAssertions();
      const custom = normalizeRbacPolicyInput({
        delete: { roles: ['user'], tenantScoped: false }
      });
      const state = createState();
      state.domains[0].entities[0].meta.rbac = custom;
      const exported = JSON.parse(JSON.stringify(buildDomainPackageDocument(state.domains[0])));
      const result = buildDomainFromPackage(exported, []);
      expect(result.ok).toBe(true);
      expect(result.domain.entities[0].meta.rbac).toStrictEqual(custom);
      expect(result.domain.entities[0].meta.rbac.delete)
        .toStrictEqual({ roles: ['user'], tenantScoped: true });
    });
  });
});
