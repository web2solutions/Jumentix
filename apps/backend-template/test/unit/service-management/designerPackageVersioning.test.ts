/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */

/**
 * Unit suite for the domain-package versioning core (JUM-492,
 * `packages/designer-core/src/packages/packageVersioning.js`) and its wiring
 * into the package import mapper (`buildDomainFromPackage`).
 *
 * The pins mirror Requirement 126 Contract 3: semantic-version
 * parsing/ordering and range satisfaction; the dependency graph (transitive
 * resolution, missing/incompatible reporting, cycle detection — cycles are
 * reported, never entered); provenance stamping; and the deterministic
 * conflict policy — idempotent re-import, same-version-conflict and
 * downgrade refusals, auto-merge vs requires-decision classes (RBAC and
 * invariants never auto-merge).
 *
 * Everything is exercised as pure functions over plain objects — no DOM, no
 * FileReader — matching the JUM-471 suite's discipline.
 */

const {
  AUTO_MERGE_CLASSES,
  REQUIRES_DECISION_CLASSES,
  buildPackageMerge,
  buildPackageRegistry,
  buildProvenance,
  buildSameVersionConflictPreview,
  comparePackageVersions,
  normalizePackageIdentity,
  packageContentsEqual,
  parsePackageDependency,
  parsePackageVersion,
  resolvePackageGraph,
  satisfiesPackageRange
} = require('@jumentix/designer-core/packages/packageVersioning.js');
const { buildDomainFromPackage } = require(
  '@jumentix/designer-core/importers/designerImporters.js'
);
const { buildDomainPackageDocument } = require(
  '@jumentix/designer-core/exporters/designerExporters.js'
);
const { getDefaultRbacPolicy, normalizeDomainInput } = require(
  '@jumentix/designer-core/state/designerState.js'
);

type TestDomain = {
  id?: string;
  name: string;
  context?: Record<string, unknown>;
  entities?: Array<Record<string, unknown>>;
};

/** A normalized domain with provenance, as an import would have stamped it. */
function installedDomain(name: string, version: string, overrides: Record<string, unknown> = {}) {
  const domain = normalizeDomainInput({ name, entities: [], ...overrides }, 0);
  domain.context.packageName = name;
  domain.context.packageVersion = version;
  domain.context.provenance = { package: name, version };
  return domain;
}

describe('domain package versioning (JUM-492)', () => {
  describe('parsePackageVersion / comparePackageVersions', () => {
    it('parses strict major.minor.patch versions and rejects everything else', () => {
      expect.hasAssertions();
      expect(parsePackageVersion('1.2.3')).toStrictEqual({ major: 1, minor: 2, patch: 3 });
      expect(parsePackageVersion('v2.0.0')).toStrictEqual({ major: 2, minor: 0, patch: 0 });
      expect(parsePackageVersion('0.0.0')).toStrictEqual({ major: 0, minor: 0, patch: 0 });
      ['', '1', '1.2', '1.2.3.4', 'banana', '1.2.x', '1.2.3-rc.1', null, undefined].forEach((version) => {
        expect(parsePackageVersion(version as string)).toBeNull();
      });
    });

    it('orders by major, then minor, then patch', () => {
      expect.hasAssertions();
      expect(comparePackageVersions('1.0.0', '1.0.0')).toBe(0);
      expect(comparePackageVersions('2.0.0', '10.0.0')).toBe(-1);
      expect(comparePackageVersions('1.10.0', '1.9.0')).toBe(1);
      expect(comparePackageVersions('1.0.1', '1.0.0')).toBe(1);
      expect(comparePackageVersions('1.0.0', '2.0.0')).toBe(-1);
      // Invalid sorts low, so an unparseable "installed" version never wins.
      expect(comparePackageVersions('banana', '1.0.0')).toBe(-1);
      expect(comparePackageVersions('1.0.0', 'banana')).toBe(1);
    });
  });

  describe('parsePackageDependency', () => {
    it('splits name and range on the last @, with a bare name meaning any version', () => {
      expect.hasAssertions();
      expect(parsePackageDependency('shared-kernel@^1.2.0'))
        .toStrictEqual({ name: 'shared-kernel', range: '^1.2.0' });
      expect(parsePackageDependency('shared-kernel'))
        .toStrictEqual({ name: 'shared-kernel', range: '*' });
      expect(parsePackageDependency('shared-kernel@')).toStrictEqual({ name: 'shared-kernel', range: '*' });
      expect(parsePackageDependency('')).toBeNull();
      expect(parsePackageDependency(null)).toBeNull();
    });
  });

  describe('satisfiesPackageRange', () => {
    it('accepts any version for empty or wildcard ranges', () => {
      expect.hasAssertions();
      expect(satisfiesPackageRange('0.0.1', '*')).toBe(true);
      expect(satisfiesPackageRange('9.9.9', '')).toBe(true);
    });

    it('matches exact versions only', () => {
      expect.hasAssertions();
      expect(satisfiesPackageRange('1.2.3', '1.2.3')).toBe(true);
      expect(satisfiesPackageRange('1.2.4', '1.2.3')).toBe(false);
      expect(satisfiesPackageRange('1.2.3', '=1.2.3')).toBe(true);
    });

    it('caret keeps the major (npm convention, including the 0.x rules)', () => {
      expect.hasAssertions();
      expect(satisfiesPackageRange('1.9.9', '^1.2.0')).toBe(true);
      expect(satisfiesPackageRange('2.0.0', '^1.2.0')).toBe(false);
      expect(satisfiesPackageRange('1.1.9', '^1.2.0')).toBe(false);
      expect(satisfiesPackageRange('0.2.9', '^0.2.3')).toBe(true);
      expect(satisfiesPackageRange('0.3.0', '^0.2.3')).toBe(false);
      expect(satisfiesPackageRange('0.0.3', '^0.0.3')).toBe(true);
      expect(satisfiesPackageRange('0.0.4', '^0.0.3')).toBe(false);
    });

    it('tilde keeps major.minor', () => {
      expect.hasAssertions();
      expect(satisfiesPackageRange('1.2.9', '~1.2.0')).toBe(true);
      expect(satisfiesPackageRange('1.3.0', '~1.2.0')).toBe(false);
      expect(satisfiesPackageRange('2.0.0', '~1.2.0')).toBe(false);
    });

    it('an invalid range satisfies nothing (reported, never silently accepted)', () => {
      expect.hasAssertions();
      expect(satisfiesPackageRange('1.2.3', 'latest')).toBe(false);
      expect(satisfiesPackageRange('1.2.3', '^banana')).toBe(false);
      expect(satisfiesPackageRange('banana', '*')).toBe(false);
    });
  });

  describe('buildPackageRegistry', () => {
    it('derives the installed packages from provenance only', () => {
      expect.hasAssertions();
      const installed = installedDomain('billing', '1.2.0', {
        context: { packageDependencies: ['shared-kernel@^1.0.0'] }
      });
      const handBuilt = normalizeDomainInput({ name: 'billing', entities: [] }, 1);
      const registry = buildPackageRegistry([installed, handBuilt]);
      expect([...registry.keys()]).toStrictEqual(['billing']);
      expect(registry.get('billing').version).toBe('1.2.0');
      expect(registry.get('billing').dependencies)
        .toStrictEqual([{ name: 'shared-kernel', range: '^1.0.0' }]);
    });

    it('keeps the highest version when legacy state carries two domains from one package', () => {
      expect.hasAssertions();
      const older = installedDomain('billing', '1.0.0');
      const newer = installedDomain('billing', '1.3.0');
      expect(buildPackageRegistry([older, newer]).get('billing').version).toBe('1.3.0');
      expect(buildPackageRegistry([newer, older]).get('billing').version).toBe('1.3.0');
    });
  });

  describe('resolvePackageGraph', () => {
    function registryOf(entries: Array<[string, string, string[]]>) {
      const domains = entries.map(([name, version, deps]) => installedDomain(name, version, {
        context: { packageDependencies: deps }
      }));
      return buildPackageRegistry(domains);
    }

    it('orders transitively, dependencies before dependents', () => {
      expect.hasAssertions();
      const registry = registryOf([
        ['app', '1.0.0', ['billing@^1.0.0']],
        ['billing', '1.2.0', ['shared-kernel@*']],
        ['shared-kernel', '1.0.0', []]
      ]);
      const graph = resolvePackageGraph(registry);
      expect(graph.order).toStrictEqual(['shared-kernel', 'billing', 'app']);
      expect(graph.missing).toStrictEqual([]);
      expect(graph.incompatible).toStrictEqual([]);
      expect(graph.cycles).toStrictEqual([]);
    });

    it('reports missing dependencies with the requiring package', () => {
      expect.hasAssertions();
      const registry = registryOf([['billing', '1.0.0', ['ghost@^1.0.0']]]);
      const graph = resolvePackageGraph(registry);
      expect(graph.missing).toStrictEqual([{ name: 'ghost', range: '^1.0.0', requiredBy: 'billing' }]);
    });

    it('reports installed versions outside the declared range', () => {
      expect.hasAssertions();
      const registry = registryOf([
        ['billing', '1.0.0', ['shared-kernel@^2.0.0']],
        ['shared-kernel', '1.4.0', []]
      ]);
      const graph = resolvePackageGraph(registry);
      expect(graph.incompatible).toStrictEqual([{
        name: 'shared-kernel', range: '^2.0.0', requiredBy: 'billing', installed: '1.4.0'
      }]);
    });

    it('detects cycles and reports them by name chain instead of entering them', () => {
      expect.hasAssertions();
      const registry = registryOf([
        ['a', '1.0.0', ['b@*']],
        ['b', '1.0.0', ['a@*']],
        ['c', '1.0.0', []]
      ]);
      const graph = resolvePackageGraph(registry);
      expect(graph.order).toStrictEqual(['c']);
      expect(graph.cycles).toHaveLength(1);
      expect(graph.cycles[0]).toContain('a');
      expect(graph.cycles[0]).toContain('b');
    });

    it('overlays the incoming package on the registry before resolving', () => {
      expect.hasAssertions();
      const registry = registryOf([['shared-kernel', '1.0.0', []]]);
      const graph = resolvePackageGraph(registry, {
        name: 'billing',
        version: '2.0.0',
        dependencies: [{ name: 'shared-kernel', range: '^2.0.0' }]
      });
      expect(graph.incompatible).toStrictEqual([{
        name: 'shared-kernel', range: '^2.0.0', requiredBy: 'billing', installed: '1.0.0'
      }]);
      expect(graph.order).toStrictEqual(['shared-kernel', 'billing']);
    });
  });

  describe('normalizePackageIdentity', () => {
    it('synthesizes the legacy v1 identity from the domain name', () => {
      expect.hasAssertions();
      const result = normalizePackageIdentity(
        { kind: 'domain-package', version: '1.0.0', domain: { name: 'Billing' } },
        { name: 'Billing' }
      );
      expect(result).toStrictEqual({
        ok: true,
        package: { name: 'Billing', version: '1.0.0', dependencies: [] }
      });
    });

    it('reads the v2 package block and normalizes its dependencies', () => {
      expect.hasAssertions();
      const result = normalizePackageIdentity({
        kind: 'domain-package',
        version: '2.0.0',
        package: {
          name: 'billing',
          version: '2.1.0',
          dependencies: [{ name: 'shared-kernel' }, 'other@~1.0.0', { name: '' }]
        }
      }, { name: 'Billing' });
      expect(result.ok).toBe(true);
      expect(result.package).toStrictEqual({
        name: 'billing',
        version: '2.1.0',
        dependencies: [
          { name: 'shared-kernel', range: '*' },
          { name: 'other', range: '~1.0.0' }
        ]
      });
    });

    it('rejects an unparseable package version and a newer document major', () => {
      expect.hasAssertions();
      expect(normalizePackageIdentity({
        package: { name: 'billing', version: 'soon' }
      }, { name: 'Billing' })).toStrictEqual({ ok: false, reason: 'invalid-package-version', version: 'soon' });
      expect(normalizePackageIdentity({ version: '3.0.0', domain: {} }, {}).reason).toBe('unsupported-version');
      expect(normalizePackageIdentity({ kind: 'service-management-suite', domain: {} }, {}))
        .toStrictEqual({ ok: false, reason: 'wrong-document-kind', kind: 'service-management-suite' });
    });
  });

  describe('packageContentsEqual', () => {
    it('ignores ids, provenance, layout, colour and the domain name', () => {
      expect.hasAssertions();
      const a = normalizeDomainInput({
        id: 'domain-1',
        name: 'Billing',
        color: '#86efac',
        x: 100,
        y: 80,
        entities: [{
          id: 'entity-1', name: 'Invoice', x: 14, y: 14, fields: [{ name: 'id', type: 'uuid', pk: true }]
        }]
      }, 0);
      a.context.provenance = { package: 'billing', version: '1.0.0' };
      const b = normalizeDomainInput({
        id: 'domain-9',
        name: 'Billing_2',
        color: '#111111',
        x: 500,
        y: 400,
        entities: [{
          id: 'entity-9', name: 'Invoice', x: 1, y: 2, fields: [{ name: 'id', type: 'uuid', pk: true }]
        }]
      }, 1);
      b.context.provenance = { package: 'billing', version: '2.0.0' };
      expect(packageContentsEqual(a, b)).toBe(true);
      b.entities[0].fields[0].type = 'string';
      expect(packageContentsEqual(a, b)).toBe(false);
    });
  });

  describe('buildPackageMerge conflict classes', () => {
    function baseInstalled() {
      const domain = normalizeDomainInput({
        name: 'Billing',
        entities: [{
          name: 'Invoice',
          fields: [
            {
              name: 'id', type: 'uuid', required: true, pk: true, unique: true
            },
            {
              name: 'total', type: 'number', required: true, minimum: 0
            },
            {
              name: 'note', type: 'string', required: false, description: 'old'
            }
          ],
          meta: {
            aggregateRoot: true,
            invariants: ['total must be positive'],
            contracts: [{
              name: 'issued', type: 'event', channel: 'billing.issued', version: '1.0.0'
            }]
          }
        }, {
          name: 'Legacy',
          fields: [{ name: 'id', type: 'uuid', pk: true }]
        }],
        context: { ubiquitousLanguage: 'en', ownerTeam: 'payments' }
      }, 0);
      domain.context.provenance = { package: 'billing', version: '1.0.0' };
      return domain;
    }

    function incomingWith(
      entityOverrides: Record<string, unknown>,
      domainOverrides: Record<string, unknown> = {}
    ) {
      return normalizeDomainInput({
        name: 'Billing',
        entities: [entityOverrides],
        ...domainOverrides
      }, 0);
    }

    const packageInfo = { name: 'billing', version: '2.0.0' };

    it('auto-merges additive and metadata changes; class membership stays disjoint and complete', () => {
      expect.hasAssertions();
      AUTO_MERGE_CLASSES.forEach((conflictClass: string) => {
        expect(REQUIRES_DECISION_CLASSES.has(conflictClass)).toBe(false);
      });
      const existing = baseInstalled();
      const incoming = incomingWith({
        name: 'Invoice',
        fields: [
          {
            name: 'id', type: 'uuid', required: true, pk: true, unique: true
          },
          {
            name: 'total', type: 'number', required: false, minimum: 0, description: 'Amount due'
          },
          {
            name: 'note', type: 'string', required: false, description: 'new'
          },
          { name: 'discount', type: 'number' }
        ],
        meta: {
          aggregateRoot: true,
          invariants: ['total must be positive'],
          contracts: [
            {
              name: 'issued', type: 'event', channel: 'billing.issued', version: '1.0.0'
            },
            {
              name: 'paid', type: 'event', channel: 'billing.paid', version: '1.0.0'
            }
          ]
        }
      });
      const merge = buildPackageMerge(existing, incoming, packageInfo);
      const classes = merge.preview.map((item: { class: string }) => item.class);
      expect(classes).toStrictEqual([
        'field-required-loosened',
        'field-metadata-changed',
        'field-metadata-changed',
        'field-added',
        'contract-added',
        'entity-removed',
        'context-changed'
      ]);
      expect(merge.autoCount).toBe(6);
      expect(merge.requiresDecision).toBe(1);
      const invoice = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Invoice');
      expect(invoice.fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'total', 'note', 'discount']);
      expect(invoice.fields[1].required).toBe(false);
      expect(invoice.fields[1].description).toBe('Amount due');
      expect(invoice.fields[2].description).toBe('new');
      expect(invoice.meta.contracts.map((contract: { name: string }) => contract.name))
        .toStrictEqual(['issued', 'paid']);
      // Auto-merged content advances provenance to the incoming version.
      expect(invoice.meta.provenance).toStrictEqual(buildProvenance(packageInfo));
      expect(merge.domain.context.provenance).toStrictEqual(buildProvenance(packageInfo));
      expect(merge.domain.context.packageVersion).toBe('2.0.0');
      // The entity the package dropped is kept (decision) with its own provenance.
      const legacy = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Legacy');
      expect(legacy).toBeDefined();
      expect(legacy.meta.provenance).toBeUndefined();
      expect(merge.preview.find((item: { class: string }) => item.class === 'entity-removed').resolution)
        .toBe('kept-existing-requires-decision');
      // The existing domain object is not mutated.
      expect(existing.entities).toHaveLength(2);
      expect(existing.entities[0].fields).toHaveLength(3);
    });

    it('never auto-merges RBAC, invariants, aggregate, type, flag, tightening or contract removals', () => {
      expect.hasAssertions();
      const existing = baseInstalled();
      const rbac = getDefaultRbacPolicy();
      rbac.list = { roles: ['superadmin'], tenantScoped: false };
      const incoming = incomingWith({
        name: 'Invoice',
        fields: [
          {
            name: 'id', type: 'string', required: true, pk: false, unique: false
          },
          {
            name: 'note', type: 'string', required: true, description: 'old'
          }
        ],
        meta: {
          aggregateRoot: false,
          invariants: ['total must be non-negative'],
          rbac,
          contracts: []
        }
      }, {
        context: { ubiquitousLanguage: 'en', ownerTeam: 'payments' }
      });
      const merge = buildPackageMerge(existing, incoming, packageInfo);
      const classes = merge.preview.map((item: { class: string }) => item.class).sort();
      expect(classes).toStrictEqual([
        'aggregate-root-changed',
        'contract-removed',
        'entity-removed',
        'field-flags-changed',
        'field-removed',
        'field-required-tightened',
        'field-type-changed',
        'invariants-changed',
        'rbac-changed'
      ]);
      classes.forEach((conflictClass: string) => {
        expect(REQUIRES_DECISION_CLASSES.has(conflictClass)).toBe(true);
      });
      expect(merge.autoCount).toBe(0);
      expect(merge.requiresDecision).toBe(9);
      const invoice = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Invoice');
      // Every requires-decision aspect kept the existing designer content.
      expect(invoice.fields[0]).toMatchObject({
        type: 'uuid', pk: true, unique: true, required: true
      });
      expect(invoice.fields.map((field: { name: string }) => field.name)).toStrictEqual(['id', 'total', 'note']);
      expect(invoice.fields[2].required).toBe(false);
      expect(invoice.meta.rbac).toStrictEqual(getDefaultRbacPolicy());
      expect(invoice.meta.invariants).toStrictEqual(['total must be positive']);
      expect(invoice.meta.aggregateRoot).toBe(true);
      expect(invoice.meta.contracts).toHaveLength(1);
      merge.preview.forEach((item: { resolution: string }) => {
        expect(item.resolution).toBe('kept-existing-requires-decision');
      });
    });

    it('gives new entities collision-free ids through the uniqueId callback', () => {
      expect.hasAssertions();
      const existing = baseInstalled();
      const incoming = normalizeDomainInput({
        name: 'Billing',
        entities: [
          { name: 'Invoice', fields: existing.entities[0].fields },
          { id: 'entity-1', name: 'Receipt', fields: [] }
        ]
      }, 0);
      const taken = new Set(['entity-1']);
      const merge = buildPackageMerge(existing, incoming, packageInfo, {
        uniqueId: (id: string, prefix: string, seed: number) => {
          if (id && !taken.has(id)) return id;
          let candidate = `${prefix}-new-${seed}`;
          while (taken.has(candidate)) candidate += 'x';
          taken.add(candidate);
          return candidate;
        }
      });
      const receipt = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Receipt');
      expect(receipt.id).not.toBe('entity-1');
      expect(receipt.meta.provenance).toStrictEqual(buildProvenance(packageInfo));
      expect(merge.preview.some((item: { class: string }) => item.class === 'entity-added')).toBe(true);
    });

    it('copies newly added contracts from their source metadata object', () => {
      expect.hasAssertions();
      const existing = baseInstalled();
      const incoming = incomingWith({
        name: 'Invoice',
        fields: existing.entities[0].fields,
        meta: {
          ...existing.entities[0].meta,
          contracts: [
            existing.entities[0].meta.contracts[0],
            {
              name: 'settled',
              type: 'event',
              channel: 'billing.settled',
              version: '1.0.0',
              description: 'Copied from source metadata'
            }
          ]
        }
      });

      const merge = buildPackageMerge(existing, incoming, packageInfo);
      const invoice = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Invoice');

      expect(invoice.meta.contracts).toContainEqual(expect.objectContaining({
        name: 'settled',
        channel: 'billing.settled',
        payloadSchema: {}
      }));
      expect(merge.preview.some((item: { class: string }) => item.class === 'contract-added')).toBe(true);
    });
  });

  describe('buildSameVersionConflictPreview', () => {
    it('marks every diverging aspect as refused', () => {
      expect.hasAssertions();
      const existing = installedDomain('billing', '1.0.0', {
        entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'uuid', pk: true }] }]
      });
      const incoming = normalizeDomainInput({
        name: 'Billing',
        entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'uuid', pk: true }, { name: 'total', type: 'number' }] }]
      }, 0);
      const preview = buildSameVersionConflictPreview(existing, incoming, { name: 'billing', version: '1.0.0' });
      expect(preview.length).toBeGreaterThan(0);
      preview.forEach((item: { severity: string; resolution: string }) => {
        expect(item.severity).toBe('error');
        expect(item.resolution).toBe('refused-same-version-conflict');
      });
    });
  });

  describe('buildDomainFromPackage versioning flow', () => {
    function packageWire(domain: TestDomain, packageBlock?: Record<string, unknown>) {
      const normalized = normalizeDomainInput(domain, 0);
      return JSON.parse(JSON.stringify({
        kind: 'domain-package',
        version: '2.0.0',
        exportedAt: '2026-08-08T00:00:00.000Z',
        ...(packageBlock ? { package: packageBlock } : {}),
        domain: normalized
      }));
    }

    it('stamps provenance on the domain and every imported entity', () => {
      expect.hasAssertions();
      const wire = packageWire(
        { name: 'Billing', entities: [{ name: 'Invoice', fields: [] }] },
        { name: 'billing', version: '1.4.2', dependencies: [] }
      );
      const result = buildDomainFromPackage(wire, []);
      expect(result.ok).toBe(true);
      expect(result.domain.context.packageName).toBe('billing');
      expect(result.domain.context.packageVersion).toBe('1.4.2');
      expect(result.domain.context.provenance).toStrictEqual({ package: 'billing', version: '1.4.2' });
      expect(result.domain.entities[0].meta.provenance).toStrictEqual({ package: 'billing', version: '1.4.2' });
    });

    it('is idempotent: re-importing the same package version changes nothing (noop)', () => {
      expect.hasAssertions();
      const wire = packageWire({ name: 'Billing', entities: [{ name: 'Invoice', fields: [] }] });
      const first = buildDomainFromPackage(wire, []);
      const second = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), [first.domain]);
      expect(second).toStrictEqual({
        ok: true,
        noop: true,
        package: { name: 'Billing', version: '1.0.0', dependencies: [] },
        domain: first.domain
      });
    });

    it('refuses the same version with different content, listing the divergence', () => {
      expect.hasAssertions();
      const wire = packageWire({ name: 'Billing', entities: [{ name: 'Invoice', fields: [] }] });
      const first = buildDomainFromPackage(wire, []);
      const altered = JSON.parse(JSON.stringify(wire));
      altered.domain.entities.push({ name: 'Receipt', fields: [] });
      const result = buildDomainFromPackage(altered, [first.domain]);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('same-version-conflict');
      expect(result.preview.length).toBeGreaterThan(0);
    });

    it('refuses a downgrade naming the installed version', () => {
      expect.hasAssertions();
      const first = buildDomainFromPackage(
        packageWire({ name: 'Billing', entities: [] }, { name: 'billing', version: '2.0.0', dependencies: [] }),
        []
      );
      const result = buildDomainFromPackage(
        packageWire({ name: 'Billing', entities: [] }, { name: 'billing', version: '1.0.0', dependencies: [] }),
        [first.domain]
      );
      expect(result).toStrictEqual({
        ok: false,
        reason: 'downgrade-rejected',
        package: { name: 'billing', version: '1.0.0', dependencies: [] },
        installed: '2.0.0'
      });
    });

    it('refuses an import that would close a dependency cycle through the incoming package', () => {
      expect.hasAssertions();
      const kernel = buildDomainFromPackage(
        packageWire(
          { name: 'Kernel', entities: [], context: { packageDependencies: [] } },
          { name: 'kernel', version: '1.0.0', dependencies: [] }
        ),
        []
      );
      expect(kernel.ok).toBe(true);
      const result = buildDomainFromPackage(
        packageWire(
          { name: 'Billing', entities: [], context: { packageDependencies: ['kernel@*'] } },
          { name: 'kernel', version: '2.0.0', dependencies: [{ name: 'kernel', range: '*' }] }
        ),
        [kernel.domain]
      );
      // A self-dependency is the minimal cycle: kernel@2.0.0 depends on kernel.
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('dependency-cycle');
      expect(result.cycle).toContain('kernel');
    });

    it('reports a true two-package cycle by name chain and refuses the import that closes it', () => {
      expect.hasAssertions();
      const pkgB = buildDomainFromPackage(
        packageWire(
          { name: 'B', entities: [], context: { packageDependencies: [] } },
          { name: 'b', version: '1.0.0', dependencies: [] }
        ),
        []
      );
      // b@2.0.0 (incoming) depends on a; then a@1.0.0 arrives depending on b:
      // importing a closes a -> b -> a.
      const b2 = buildDomainFromPackage(
        packageWire(
          { name: 'B', entities: [], context: { packageDependencies: ['a@*'] } },
          { name: 'b', version: '2.0.0', dependencies: [{ name: 'a', range: '*' }] }
        ),
        [pkgB.domain]
      );
      expect(b2.ok).toBe(true);
      expect(b2.merged).toBe(true);
      const closing = buildDomainFromPackage(
        packageWire(
          { name: 'A', entities: [], context: { packageDependencies: ['b@*'] } },
          { name: 'a', version: '1.0.0', dependencies: [{ name: 'b', range: '*' }] }
        ),
        [b2.domain]
      );
      expect(closing.ok).toBe(false);
      expect(closing.reason).toBe('dependency-cycle');
      expect(closing.cycle).toContain('a');
      expect(closing.cycle).toContain('b');
    });

    it('warns on missing and incompatible dependencies without blocking the import', () => {
      expect.hasAssertions();
      const kernel = buildDomainFromPackage(
        packageWire(
          { name: 'Kernel', entities: [] },
          { name: 'kernel', version: '1.0.0', dependencies: [] }
        ),
        []
      );
      const result = buildDomainFromPackage(
        packageWire(
          { name: 'Billing', entities: [] },
          {
            name: 'billing',
            version: '1.0.0',
            dependencies: [{ name: 'kernel', range: '^2.0.0' }, { name: 'ghost', range: '*' }]
          }
        ),
        [kernel.domain]
      );
      expect(result.ok).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('\'ghost@*\'');
      expect(result.warnings[1]).toContain('\'kernel@^2.0.0\'');
      expect(result.warnings[1]).toContain('\'kernel@1.0.0\'');
    });

    it('appends a package named like a hand-built domain instead of merging into it', () => {
      expect.hasAssertions();
      const handBuilt = normalizeDomainInput({ id: 'domain-1', name: 'Billing', entities: [] }, 0);
      const wire = packageWire({ id: 'domain-1', name: 'Billing', entities: [] });
      const result = buildDomainFromPackage(wire, [handBuilt]);
      expect(result.ok).toBe(true);
      expect(result.merged).toBeUndefined();
      expect(result.domain.name).toBe('Billing_2');
      // JUM-617: the colliding domain id is recomputed.
      expect(result.domain.id).not.toBe('domain-1');
    });

    it('a newer version merges in place and the preview matches the summary counts', () => {
      expect.hasAssertions();
      const first = buildDomainFromPackage(packageWire({
        name: 'Billing',
        entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'uuid', pk: true }] }]
      }), []);
      const wire = packageWire({
        name: 'Billing',
        entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'uuid', pk: true }, { name: 'total', type: 'number' }] }]
      }, { name: 'Billing', version: '1.1.0', dependencies: [] });
      const result = buildDomainFromPackage(wire, [first.domain]);
      expect(result.ok).toBe(true);
      expect(result.merged).toBe(true);
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.domain.id).toBe(first.domain.id);
      expect(result.autoCount).toBe(1);
      expect(result.requiresDecision).toBe(0);
      expect(result.preview).toHaveLength(1);
      expect(result.domain.entities[0].fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'total']);
    });
  });

  describe('buildDomainPackageDocument package block', () => {
    it('derives the identity from the domain context with name/1.0.0 fallbacks', () => {
      expect.hasAssertions();
      const plain = normalizeDomainInput({
        name: 'Billing',
        entities: [],
        context: { packageDependencies: ['shared-kernel@^1.0.0', 'money'] }
      }, 0);
      const document = buildDomainPackageDocument(plain, '2026-08-08T00:00:00.000Z');
      expect(document.package).toStrictEqual({
        name: 'Billing',
        version: '1.0.0',
        dependencies: [
          { name: 'shared-kernel', range: '^1.0.0' },
          { name: 'money', range: '*' }
        ]
      });
      const stamped = installedDomain('billing', '2.3.1');
      stamped.name = 'Billing_2';
      const republished = buildDomainPackageDocument(stamped, '2026-08-08T00:00:00.000Z');
      expect(republished.package.name).toBe('billing');
      expect(republished.package.version).toBe('2.3.1');
    });
  });
});

describe('defensive projection, identity and merge fallbacks (JUM-493)', () => {
  it('treats two unparseable versions as equal and orders by patch', () => {
    expect.hasAssertions();
    expect(comparePackageVersions('junk', 'also-junk')).toBe(0);
    expect(comparePackageVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('builds an empty registry from a non-array domain list', () => {
    expect.hasAssertions();
    expect(buildPackageRegistry(null).size).toBe(0);
  });

  it('defaults the provenance version and a non-array dependency list in the registry', () => {
    expect.hasAssertions();
    const registry = buildPackageRegistry([
      { id: 'd1', name: 'D', context: { provenance: { package: 'p' }, packageDependencies: 'oops' } }
    ]);
    expect(registry.get('p').version).toBe('1.0.0');
    expect(registry.get('p').dependencies).toStrictEqual([]);
  });

  it('overlays an incoming package without a dependency list', () => {
    expect.hasAssertions();
    const graph = resolvePackageGraph(buildPackageRegistry([]), { name: 'n', version: '1.0.0' });
    expect(graph).toMatchObject({ missing: [], incompatible: [], cycles: [] });
  });

  it('synthesizes the legacy identity when the document has no package block', () => {
    expect.hasAssertions();
    expect(normalizePackageIdentity({}, {}).package)
      .toStrictEqual({ name: 'package', version: '1.0.0', dependencies: [] });
    expect(normalizePackageIdentity({}, { name: 'Orders' }).package.name).toBe('Orders');
  });

  it('rejects a blank package name and defaults a missing or blank version', () => {
    expect.hasAssertions();
    expect(normalizePackageIdentity({ package: { name: ' ' } }, { name: 'D' }))
      .toStrictEqual({ ok: false, reason: 'invalid-package' });
    expect(normalizePackageIdentity({ package: { name: 0 } }, { name: 'D' }))
      .toStrictEqual({ ok: false, reason: 'invalid-package' });
    expect(normalizePackageIdentity({ package: { name: 'p' } }, { name: 'D' }).package.version).toBe('1.0.0');
    expect(normalizePackageIdentity({ package: { name: 'p', version: ' ' } }, { name: 'D' }).package.version)
      .toBe('1.0.0');
  });

  it('drops a non-array dependency block in the identity', () => {
    expect.hasAssertions();
    const identity = normalizePackageIdentity(
      { package: { name: 'p', version: '1.0.0', dependencies: 'oops' } },
      { name: 'D' }
    );
    expect(identity.package.dependencies).toStrictEqual([]);
  });

  it('normalizes sparse object dependencies through the documented fallbacks', () => {
    expect.hasAssertions();

    const identity = normalizePackageIdentity(
      {
        package: {
          name: 'p',
          version: '1.0.0',
          dependencies: [
            { name: '  shared  ', range: '  ' },
            { name: 'kernel', range: '^1.2.0' },
            undefined,
            7
          ]
        }
      },
      { name: 'D' }
    );

    expect(identity.package.dependencies).toStrictEqual([
      { name: 'shared', range: '*' },
      { name: 'kernel', range: '^1.2.0' },
      { name: '7', range: '*' }
    ]);
  });

  it('rejects newer documents whose major is not numeric', () => {
    expect.hasAssertions();

    expect(normalizePackageIdentity({ version: 'beta', domain: {} }, {}))
      .toStrictEqual({ ok: false, reason: 'unsupported-version', version: 'beta' });
  });

  it('projects sparse content deterministically for comparison', () => {
    expect.hasAssertions();
    const sparse = { name: 'D' };
    const withFieldlessEntity = { name: 'D', entities: [{ name: 'E' }] };
    const withSparseEntity = {
      name: 'D',
      entities: [{
        name: 'E',
        fields: [{ name: 'f', type: 'string' }],
        meta: { contracts: [{ name: 'c', type: 'event' }] }
      }]
    };
    expect(packageContentsEqual(sparse, sparse)).toBe(true);
    expect(packageContentsEqual(withFieldlessEntity, withFieldlessEntity)).toBe(true);
    expect(packageContentsEqual(sparse, withSparseEntity)).toBe(false);
    expect(packageContentsEqual(withSparseEntity, withSparseEntity)).toBe(true);
  });

  it('projects optional field, contract and context data as package content', () => {
    expect.hasAssertions();

    const a = {
      name: 'D',
      context: {
        ubiquitousLanguage: 'orders',
        ownerTeam: 'platform',
        upstreamDependencies: ['b', 'a'],
        downstreamDependencies: ['client'],
        integrationChannel: 'events',
        packageDependencies: ['money@^1.0.0'],
        sharedValueObjects: ['Currency']
      },
      entities: [{
        name: 'Invoice',
        fields: [{
          name: 'amount',
          type: 'array',
          required: true,
          fk: true,
          unique: true,
          nullable: true,
          format: 'decimal',
          description: 'Money amount',
          enumValues: ['low', 'high'],
          pattern: '^\\d+$',
          minLength: 1,
          maxLength: 12,
          minimum: 0,
          maximum: 1000,
          itemsType: 'number'
        }],
        meta: {
          aggregateRoot: true,
          invariants: ['amount >= 0'],
          rbac: { roles: ['finance'] },
          contracts: [{
            name: 'paid',
            type: 'event',
            channel: 'invoice.paid',
            version: '1.0.0',
            payloadSchema: { type: 'object' }
          }],
          oasComposition: {
            mode: 'allOf',
            refs: ['B', 'A'],
            externalRefs: ['https://example.test/spec.yml'],
            discriminator: 'kind'
          }
        }
      }]
    };
    const b = JSON.parse(JSON.stringify(a));

    expect(packageContentsEqual(a, b)).toBe(true);
    b.entities[0].meta.contracts[0].payloadSchema.required = ['id'];
    expect(packageContentsEqual(a, b)).toBe(false);
  });

  it('merges domains with missing entity lists and no context', () => {
    expect.hasAssertions();
    const merge = buildPackageMerge({ name: 'D' }, { name: 'D' }, { name: 'p', version: '2.0.0' });
    expect(merge.domain.name).toBe('D');
    expect(merge.autoCount).toBe(0);
    expect(merge.requiresDecision).toBe(0);
  });

  it('keeps sparse matching entities stable when both sides omit fields and meta', () => {
    expect.hasAssertions();

    const merge = buildPackageMerge(
      { name: 'D', entities: [{ name: 'Invoice' }] },
      { name: 'D', entities: [{ name: 'Invoice' }] },
      { name: 'p', version: '2.0.0' }
    );

    expect(merge.domain.entities).toHaveLength(1);
    expect(merge.domain.entities[0]).toMatchObject({
      name: 'Invoice',
      meta: expect.objectContaining({
        contracts: [],
        provenance: { package: 'p', version: '2.0.0' }
      })
    });
    expect(merge.preview).toStrictEqual([]);
  });

  it('keeps existing array item types when package updates a field array shape', () => {
    expect.hasAssertions();

    const merge = buildPackageMerge(
      {
        name: 'D',
        entities: [{
          name: 'Invoice',
          fields: [{ name: 'tags', type: 'array', itemsType: 'string' }]
        }]
      },
      {
        name: 'D',
        entities: [{
          name: 'Invoice',
          fields: [{ name: 'tags', type: 'array', itemsType: 'number' }]
        }]
      },
      { name: 'p', version: '2.0.0' }
    );

    expect(merge.preview).toStrictEqual(expect.arrayContaining([
      expect.objectContaining({
        class: 'field-type-changed',
        message: expect.stringContaining('array(string) to array(number)')
      })
    ]));
    expect(merge.domain.entities[0].fields[0].itemsType).toBe('string');
  });

  it('clears OAS composition hints when the incoming package omits them', () => {
    expect.hasAssertions();

    const merge = buildPackageMerge(
      {
        name: 'D',
        entities: [{
          name: 'Invoice',
          fields: [],
          meta: {
            oasComposition: {
              mode: 'oneOf', refs: ['A'], externalRefs: [], discriminator: 'kind'
            }
          }
        }]
      },
      {
        name: 'D',
        entities: [{
          name: 'Invoice',
          fields: [],
          meta: {}
        }]
      },
      { name: 'p', version: '2.0.0' }
    );

    expect(merge.domain.entities[0].meta.oasComposition).toStrictEqual({});
    expect(merge.preview.map((item: { class: string }) => item.class)).toContain('composition-changed');
  });

  it('keeps existing on contract and composition changes and appends a meta-less entity', () => {
    expect.hasAssertions();
    const existing = {
      name: 'D',
      context: { ubiquitousLanguage: 'orders' },
      entities: [
        {
          name: 'E',
          fields: [{ name: 'f', type: 'string' }],
          meta: {
            contracts: [{
              name: 'c', type: 'event', channel: 'old', version: '1.0.0', payloadSchema: {}
            }],
            oasComposition: {
              mode: '', refs: [], externalRefs: [], discriminator: ''
            }
          }
        },
        { name: 'F' }
      ]
    };
    const incoming = {
      name: 'D',
      entities: [
        {
          name: 'E',
          fields: [{ name: 'f', type: 'integer', description: 'now documented' }],
          meta: {
            contracts: [{
              name: 'c', type: 'event', channel: 'new', version: '1.0.0', payloadSchema: {}
            }],
            oasComposition: {
              mode: 'oneOf', refs: ['A'], externalRefs: [], discriminator: 'kind'
            }
          }
        },
        { name: 'New' }
      ]
    };
    const merge = buildPackageMerge(existing, incoming, { name: 'p', version: '2.0.0' });
    const classes = merge.preview.map((item: { class: string }) => item.class);
    expect(classes).toContain('entity-removed');
    expect(classes).toContain('field-type-changed');
    expect(classes).toContain('contract-changed');
    expect(classes).toContain('composition-changed');
    expect(classes).toContain('entity-added');
    const appended = merge.domain.entities.find((entity: { name: string }) => entity.name === 'New');
    expect(appended.meta.provenance).toStrictEqual({ package: 'p', version: '2.0.0' });
  });

  it('uses identity id generation and source contract fallback when the importer provides no helpers', () => {
    expect.hasAssertions();

    const incomingContract = {
      name: 'paid',
      type: 'event',
      channel: 'invoice.paid',
      version: '1.0.0',
      payloadSchema: { type: 'object' }
    };
    const existing = {
      name: 'D',
      context: {},
      entities: [{
        name: 'Invoice',
        fields: [{ name: 'id', type: 'uuid' }],
        meta: {}
      }]
    };
    const incoming = {
      name: 'D',
      context: {
        upstreamDependencies: ['ledger'],
        downstreamDependencies: ['portal'],
        packageDependencies: ['money@*'],
        sharedValueObjects: ['Currency']
      },
      entities: [
        {
          name: 'Invoice',
          fields: [
            { name: 'id', type: 'uuid' },
            { name: 'total', type: 'number' }
          ],
          meta: { contracts: [incomingContract] }
        },
        { id: 'entity-new', name: 'Receipt', fields: [] }
      ]
    };

    const merge = buildPackageMerge(existing, incoming, { name: 'p', version: '2.0.0' });

    const invoice = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Invoice');
    const receipt = merge.domain.entities.find((entity: { name: string }) => entity.name === 'Receipt');
    expect(invoice.meta.contracts).toStrictEqual([incomingContract]);
    expect(receipt.id).toBe('entity-new');
    expect(merge.domain.context.upstreamDependencies).toStrictEqual(['ledger']);
    expect(merge.domain.context.downstreamDependencies).toStrictEqual(['portal']);
    expect(merge.domain.context.packageDependencies).toStrictEqual(['money@*']);
    expect(merge.domain.context.sharedValueObjects).toStrictEqual(['Currency']);
    expect(merge.preview.map((item: { class: string }) => item.class))
      .toStrictEqual(expect.arrayContaining([
        'field-added',
        'contract-added',
        'entity-added',
        'context-changed'
      ]));
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
