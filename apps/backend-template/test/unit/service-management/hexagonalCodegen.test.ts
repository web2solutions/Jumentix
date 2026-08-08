/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Structural suite for the hexagonal code generator (JUM-476,
 * `apps/service-management/src/codegen/hexagonalCodegen.js`).
 *
 * Snapshot-free by design: the assertions pin structure — file paths, layer
 * directories, contract wiring — not generated text, so a wording tweak in a
 * template does not break the suite while a layout regression does.
 *
 * The properties under test are the issue's acceptance criteria:
 *
 * - Layout: a generated module carries the Users hexagonal layout
 *   (domain/{Entity,Model,security}, application/{ports,use-cases},
 *   adapters/in/http/controllers, adapters/out/persistence, composition/),
 *   with events/contracts only when message contracts exist.
 * - Contracts consumed, not re-derived: field types come from the OAS 3.1
 *   component schemas (JUM-474), routes from its operationIds, event channels
 *   from the AsyncAPI channels (JUM-475).
 * - Architecture bar: every generated controller passes
 *   `ci-cd/check-hexagonal-boundaries.js`'s `validateControllerFile`, and the
 *   generated import graph only ever points inward (domain ← application ←
 *   adapters ← composition).
 * - Deliverable code: the emitted file set compiles under `tsc --strict`.
 * - Preview parity: the Code Preview renderer shows exactly what the bundle
 *   export emits — same builder, same files.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  buildHexagonalBundle,
  flattenBundleFiles,
  renderBundlePreview,
  toTypeToken,
  tsTypeFromOasSchema
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'codegen', 'hexagonalCodegen.js'));
const {
  buildBoilerplateBundleDocument,
  buildOasDocument
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'designerExporters.js'));
const { buildAsyncApiTransportDocument } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'asyncApiExporters.js')
);
const { normalizeStatePayload } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js')
);
const { validateControllerFile } = require(
  path.join(repoRoot, 'ci-cd', 'check-hexagonal-boundaries.js')
);

const ENTITY_ROLES = [
  'entityInterface',
  'model',
  'security',
  'repositoryPort',
  'useCasesPort',
  'useCases',
  'persistenceAdapter',
  'controller'
];

type GeneratedFile = { path: string; content: string };
type GeneratedEntity = { entity: string; files: Record<string, GeneratedFile> };
type GeneratedModule = {
  module: string;
  path: string;
  files: Record<string, GeneratedFile>;
  entities: GeneratedEntity[];
};

function importsOf(file: GeneratedFile) {
  return [...file.content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function createState() {
  return normalizeStatePayload({
    domains: [
      {
        id: 'domain-1',
        name: 'Billing',
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            fields: [
              {
                name: 'id', type: 'uuid', required: true, pk: true
              },
              { name: 'issuedOn', type: 'date', required: true },
              { name: 'dueAt', type: 'datetime' },
              { name: 'total', type: 'number', required: true },
              { name: 'count', type: 'integer' },
              { name: 'active', type: 'boolean' },
              {
                name: 'tags', type: 'array', itemsType: 'string', nullable: true
              },
              { name: 'meta', type: 'object' }
            ],
            meta: {
              contracts: [
                {
                  name: 'issued', type: 'event', channel: 'billing.issued', version: '1.0.0', payloadSchema: { type: 'object' }
                },
                {
                  name: 'settled', type: 'response', channel: '', version: '1.0.0', payloadSchema: {}
                }
              ]
            }
          },
          {
            id: 'entity-2',
            name: 'Receipt',
            fields: [],
            meta: { rbac: { list: { roles: ['admin'], tenantScoped: false } } }
          }
        ]
      },
      {
        id: 'domain-2',
        name: 'Catalog',
        entities: [{ id: 'entity-3', name: 'Product', fields: [{ name: 'id', type: 'uuid', required: true }] }]
      }
    ],
    relationships: []
  });
}

function buildBundle(state: ReturnType<typeof createState>) {
  return buildHexagonalBundle(state, {
    oasDocument: buildOasDocument(state),
    asyncApiDocument: buildAsyncApiTransportDocument(state, 'websocket')
  });
}

describe('hexagonal codegen (JUM-476)', () => {
  describe('layout', () => {
    it('emits one module per domain with the Users hexagonal layer directories', () => {
      const bundle = buildBundle(createState());
      expect(bundle.modules.map((module: GeneratedModule) => module.module))
        .toStrictEqual(['Billing', 'Catalog']);
      const [billing] = bundle.modules;
      expect(billing.path).toBe('src/modules/Billing');
      const directories = new Set(
        flattenBundleFiles(bundle)
          .filter((file: GeneratedFile) => file.path.startsWith(`${billing.path}/`))
          .map((file: GeneratedFile) => path.posix.dirname(
            file.path.slice(billing.path.length + 1)
          ))
      );
      expect([...directories].sort()).toStrictEqual([
        'adapters/in/http/controllers',
        'adapters/out/persistence',
        'application/ports',
        'application/use-cases',
        'composition',
        'domain/Entity',
        'domain/Model',
        'domain/security',
        'events/contracts'
      ]);
    });

    it('emits the pinned per-entity file set at the canonical paths', () => {
      const bundle = buildBundle(createState());
      const [billing] = bundle.modules;
      const invoice = billing.entities.find((entity: GeneratedEntity) => entity.entity === 'Invoice');
      expect(Object.keys(invoice.files)).toStrictEqual(ENTITY_ROLES);
      expect(invoice.files.entityInterface.path)
        .toBe('src/modules/Billing/domain/Entity/IInvoice.ts');
      expect(invoice.files.model.path).toBe('src/modules/Billing/domain/Model/Invoice.ts');
      expect(invoice.files.security.path).toBe('src/modules/Billing/domain/security/InvoiceRbac.ts');
      expect(invoice.files.repositoryPort.path)
        .toBe('src/modules/Billing/application/ports/IInvoiceRepository.ts');
      expect(invoice.files.useCasesPort.path)
        .toBe('src/modules/Billing/application/ports/IInvoiceUseCases.ts');
      expect(invoice.files.useCases.path)
        .toBe('src/modules/Billing/application/use-cases/InvoiceUseCases.ts');
      expect(invoice.files.persistenceAdapter.path)
        .toBe('src/modules/Billing/adapters/out/persistence/InvoiceDataRepository.ts');
      expect(invoice.files.controller.path)
        .toBe('src/modules/Billing/adapters/in/http/controllers/InvoiceController.ts');
      expect(billing.files.composition.path)
        .toBe('src/modules/Billing/composition/composeBillingServices.ts');
      expect(billing.files.eventChannels.path)
        .toBe('src/modules/Billing/events/contracts/BillingEventChannels.ts');
    });

    it('emits events/contracts only for domains with message contracts', () => {
      const bundle = buildBundle(createState());
      const catalog = bundle.modules.find((module: GeneratedModule) => module.module === 'Catalog');
      expect(Object.keys(catalog.files)).toStrictEqual(['composition']);
      expect(catalog.files.eventChannels).toBeUndefined();
    });

    it('sanitizes type identifiers without leaking the toSchemaName empty-domain fallback', () => {
      expect(toTypeToken('Billing', 'Domain')).toBe('Billing');
      expect(toTypeToken('invoice item', 'Entity')).toBe('InvoiceItem');
      expect(toTypeToken('', 'Entity')).toBe('Entity');
      expect(toTypeToken('!!!', 'Entity')).toBe('Entity');
      const bundle = buildBundle(normalizeStatePayload({
        domains: [{ id: 'd', name: 'billing core', entities: [{ id: 'e', name: 'line item', fields: [] }] }],
        relationships: []
      }));
      expect(bundle.modules[0].path).toBe('src/modules/BillingCore');
      expect(bundle.modules[0].entities[0].files.entityInterface.path)
        .toBe('src/modules/BillingCore/domain/Entity/ILineItem.ts');
    });
  });

  describe('contract consumption', () => {
    it('derives entity field types from the OAS component schema, not the model', () => {
      const bundle = buildBundle(createState());
      const [billing] = bundle.modules;
      const invoice = billing.entities.find((entity: GeneratedEntity) => entity.entity === 'Invoice');
      const contract = invoice.files.entityInterface.content;
      expect(contract).toContain('id: string;');
      expect(contract).toContain('issuedOn: Date;');
      expect(contract).toContain('dueAt?: Date;');
      expect(contract).toContain('total: number;');
      expect(contract).toContain('count?: number;');
      expect(contract).toContain('active?: boolean;');
      expect(contract).toContain('tags?: string[] | null;');
      expect(contract).toContain('meta?: Record<string, unknown>;');
    });

    it('quotes property names that are not identifiers', () => {
      const bundle = buildBundle(normalizeStatePayload({
        domains: [{
          id: 'd',
          name: 'Billing',
          entities: [{
            id: 'e',
            name: 'Invoice',
            fields: [{ name: 'weird name!', type: 'string', required: true }]
          }]
        }],
        relationships: []
      }));
      const contract = bundle.modules[0].entities[0].files.entityInterface.content;
      expect(contract).toContain('"weird name!": string;');
    });

    it('builds the controller route table from the OAS paths and operationIds', () => {
      const state = createState();
      const oas = buildOasDocument(state);
      const bundle = buildBundle(state);
      const [billing] = bundle.modules;
      const invoice = billing.entities.find((entity: GeneratedEntity) => entity.entity === 'Invoice');
      const controller = invoice.files.controller.content;
      expect(controller).toContain('\'GET\', path: \'/billing/invoice\', operationId: \'getAllBilling_Invoice\'');
      expect(controller).toContain('\'POST\', path: \'/billing/invoice\', operationId: \'createBilling_Invoice\'');
      expect(controller).toContain('\'GET\', path: \'/billing/invoice/{id}\', operationId: \'getBilling_InvoiceById\'');
      expect(controller).toContain('\'PUT\', path: \'/billing/invoice/{id}\', operationId: \'updateBilling_Invoice\'');
      expect(controller).toContain('\'DELETE\', path: \'/billing/invoice/{id}\', operationId: \'deleteBilling_Invoice\'');
      // Every route row names an operationId the OAS export actually carries.
      const pathItems = oas.paths as Record<string, Record<string, { operationId: string }>>;
      const operationIds = Object.values(pathItems).flatMap((pathItem) => (
        Object.values(pathItem).map((operation) => operation.operationId)
      ));
      const routeOperationIds = [...controller.matchAll(/operationId: '([^']+)'/g)].map((match) => match[1]);
      routeOperationIds.forEach((operationId) => {
        expect(operationIds).toContain(operationId);
      });
    });

    it('resolves event channels against the AsyncAPI channels by operationId', () => {
      const bundle = buildBundle(createState());
      const [billing] = bundle.modules;
      const events = billing.files.eventChannels.content;
      // Explicit channel stays explicit; the channel-less response contract
      // resolves to the AsyncAPI fallback bucket as a subscribe operation.
      expect(events).toContain('"billing.issued"');
      expect(events).toContain('operation: \'publish\'');
      expect(events).toContain('operationId: \'event_Billing_Invoice_Issued\'');
      expect(events).toContain('"billing/invoice/response"');
      expect(events).toContain('operation: \'subscribe\'');
      expect(events).toContain('operationId: \'response_Billing_Invoice_Settled\'');
    });

    it('carries the entity RBAC policy into domain/security', () => {
      const bundle = buildBundle(createState());
      const [billing] = bundle.modules;
      const receipt = billing.entities.find((entity: GeneratedEntity) => entity.entity === 'Receipt');
      const security = receipt.files.security.content;
      expect(security).toContain('list: { roles: ["admin"], tenantScoped: true }');
      // Actions without an explicit rule keep the normalized default policy.
      expect(security).toContain('getById: { roles: ["superadmin", "admin", "user"], tenantScoped: true }');
    });

    it('falls back to empty roles and the default rule for sparse RBAC meta', () => {
      // Raw (non-normalized) state: rbac meta with a rule missing `roles`,
      // and actions with no rule at all.
      const bundle = buildHexagonalBundle({
        domains: [{
          name: 'Billing',
          entities: [{
            name: 'Invoice',
            fields: [],
            meta: { rbac: { list: { tenantScoped: false } } }
          }]
        }],
        relationships: []
      }, {
        oasDocument: { paths: {}, components: { schemas: {} } },
        asyncApiDocument: { channels: {} }
      });
      const security = bundle.modules[0].entities[0].files.security.content;
      expect(security).toContain('list: { roles: [], tenantScoped: false }');
      expect(security).toContain('getById: { roles: [], tenantScoped: true }');
    });

    it('tolerates contract documents that carry nothing for the model', () => {
      // Hand-built minimal contracts: no schemas, no paths, no channels. The
      // generator must still emit a consistent skeleton — empty interface,
      // empty route table, no events file.
      const state = normalizeStatePayload({
        domains: [{
          id: 'd',
          name: 'Billing',
          entities: [{
            id: 'e',
            name: 'Invoice',
            fields: [{ name: 'id', type: 'uuid', required: true }],
            meta: {
              contracts: [{
                name: 'issued', type: 'event', channel: '', version: '1.0.0'
              }]
            }
          }]
        }],
        relationships: []
      });
      const bundle = buildHexagonalBundle(state, {
        oasDocument: {
          paths: {}, components: { schemas: {} }, 'x-message-contracts': []
        },
        asyncApiDocument: { channels: {} }
      });
      const [billing] = bundle.modules;
      expect(Object.keys(billing.files)).toStrictEqual(['composition']);
      const invoice = billing.entities[0];
      expect(invoice.files.entityInterface.content).toContain('export interface IInvoice {');
      expect(invoice.files.entityInterface.content).not.toContain('id:');
      expect(invoice.files.controller.content).toContain('routes = [\n  ] as const;');
    });
  });

  describe('wiring and architecture', () => {
    it('wires adapters to ports in the composition root like Users/composition does', () => {
      const bundle = buildBundle(createState());
      const [billing] = bundle.modules;
      const composition = billing.files.composition.content;
      ['Invoice', 'Receipt'].forEach((entityToken) => {
        const instance = entityToken.charAt(0).toLowerCase() + entityToken.slice(1);
        expect(composition).toContain(`const ${instance}Repository = ${entityToken}DataRepository.compile();`);
        expect(composition).toContain(
          `const ${instance}UseCases = ${entityToken}UseCases.compile(${instance}Repository);`
        );
        expect(composition).toContain(
          `const ${instance}Controller = ${entityToken}Controller.compile(${instance}UseCases);`
        );
        expect(composition).toContain(`${instance}Repository: I${entityToken}Repository;`);
        expect(composition).toContain(`${instance}UseCases: I${entityToken}UseCases;`);
      });
    });

    it('emits controllers that pass the repository hexagonal boundary check', () => {
      const bundle = buildBundle(createState());
      bundle.modules.forEach((module: GeneratedModule) => {
        module.entities.forEach((entity: GeneratedEntity) => {
          const file = entity.files.controller;
          const violations = validateControllerFile(file.content, importsOf(file), file.path);
          expect(violations).toStrictEqual([]);
        });
      });
    });

    it('keeps the generated import graph pointed inward, self-contained per module', () => {
      const bundle = buildBundle(createState());
      const files = flattenBundleFiles(bundle);
      const emittedPaths = new Set(files.map((file: GeneratedFile) => file.path));
      // Two-segment layer names for the composite roots (application/ports,
      // adapters/in, ...), single segment otherwise — expressed as a lookup
      // so the test body stays free of conditionals
      // (jest/no-conditional-in-test).
      const layerOf = (relative: string) => {
        const segments = relative.split('/');
        const composite = ['application', 'adapters']
          .map((root) => `${root}/${segments[1]}`)
          .filter((prefix) => relative.startsWith(`${prefix}/`));
        return [...composite, segments[0]][0];
      };
      // domain imports nothing outward; use cases reach domain + ports;
      // adapters reach domain + ports (never use-case implementations);
      // only the composition root wires implementations to ports.
      const allowed: Record<string, string[]> = {
        domain: ['domain'],
        'application/ports': ['domain'],
        'application/use-cases': ['domain', 'application/ports'],
        'adapters/in': ['domain', 'application/ports'],
        'adapters/out': ['domain', 'application/ports'],
        events: ['domain', 'application/ports'],
        composition: [
          'domain',
          'application/ports',
          'application/use-cases',
          'adapters/in',
          'adapters/out',
          'events'
        ]
      };
      flattenBundleFiles(bundle).forEach((file: GeneratedFile) => {
        const modulePrefix = file.path.split('/').slice(0, 3).join('/');
        const fileDir = path.posix.dirname(file.path);
        const fileLayer = layerOf(file.path.slice(modulePrefix.length + 1));
        importsOf(file).forEach((importPath) => {
          // Self-contained: relative imports only, no @src/ aliases.
          expect(importPath.startsWith('.')).toBe(true);
          const resolved = path.posix.normalize(path.posix.join(fileDir, importPath));
          expect(resolved.startsWith(`${modulePrefix}/`)).toBe(true);
          expect(emittedPaths.has(`${resolved}.ts`)).toBe(true);
          const targetLayer = layerOf(resolved.slice(modulePrefix.length + 1));
          expect(allowed[fileLayer]).toContain(targetLayer);
        });
      });
    });
  });

  describe('tsc deliverability', () => {
    it('emits a module set that compiles under tsc --strict', () => {
      const bundle = buildBundle(createState());
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jum476-codegen-'));
      const files = flattenBundleFiles(bundle);
      files.forEach((file: GeneratedFile) => {
        const target = path.join(directory, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content);
      });
      const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
      const run = () => execFileSync(process.execPath, [
        tsc,
        '--noEmit',
        '--strict',
        '--target', 'es2020',
        '--module', 'commonjs',
        '--moduleResolution', 'node',
        ...files.map((file: GeneratedFile) => path.join(directory, file.path))
      ], { stdio: 'pipe' });
      expect(run).not.toThrow();
      fs.rmSync(directory, { recursive: true, force: true });
    }, 180000);
  });

  describe('preview parity', () => {
    it('renders exactly the files the bundle export emits', () => {
      const state = createState();
      const bundle = buildBundle(state);
      const preview = renderBundlePreview(bundle);
      flattenBundleFiles(bundle).forEach((file: GeneratedFile) => {
        expect(preview).toContain(`/* ${file.path} */`);
        expect(preview).toContain(file.content.trimEnd());
      });
      // The exporter envelope and the direct bundle render identically — the
      // preview pane cannot drift from the emitted bundle.
      const document = buildBoilerplateBundleDocument(state);
      expect(renderBundlePreview(document)).toBe(preview);
    });

    it('renders an empty string for an empty model', () => {
      expect(renderBundlePreview(buildHexagonalBundle({ domains: [] }))).toBe('');
      expect(buildHexagonalBundle({})).toStrictEqual({ modules: [] });
    });
  });

  describe('tsTypeFromOasSchema', () => {
    it('maps the OAS types to TypeScript and defaults to unknown', () => {
      expect(tsTypeFromOasSchema(null)).toBe('unknown');
      expect(tsTypeFromOasSchema('string')).toBe('unknown');
      expect(tsTypeFromOasSchema({ type: 'integer' })).toBe('number');
      expect(tsTypeFromOasSchema({ type: 'number' })).toBe('number');
      expect(tsTypeFromOasSchema({ type: 'boolean' })).toBe('boolean');
      expect(tsTypeFromOasSchema({ type: 'array', items: { type: 'integer' } })).toBe('number[]');
      expect(tsTypeFromOasSchema({ type: 'array' })).toBe('unknown[]');
      expect(tsTypeFromOasSchema({ type: 'object' })).toBe('Record<string, unknown>');
      expect(tsTypeFromOasSchema({ type: 'string', format: 'date' })).toBe('Date');
      expect(tsTypeFromOasSchema({ type: 'string', format: 'date-time' })).toBe('Date');
      expect(tsTypeFromOasSchema({ type: 'string', format: 'uuid' })).toBe('string');
      expect(tsTypeFromOasSchema({ type: 'string' })).toBe('string');
      expect(tsTypeFromOasSchema({ nullable: true })).toBe('string | null');
    });
  });
});
