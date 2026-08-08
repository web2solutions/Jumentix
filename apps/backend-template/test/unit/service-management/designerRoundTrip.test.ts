/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Round-trip suite for the designer export/import surface (JUM-471).
 *
 * The designer's value proposition is that a model can leave as a contract
 * artifact and come back, so the property under test is the crossing itself —
 * export → import → deep-equal — not any fixed expected output. Deep-equal
 * catches the exporter-drops-field + importer-ignores-field cancellation that
 * fixed-output tests cancel out.
 *
 * The surface is honest about its asymmetries:
 *
 * - Symmetric: `exportAsJson` → `importStateFromFile` (the mapper is
 *   `buildStateFromSuiteExport` over `normalizeStatePayload`) and
 *   `exportAsPackage` → `importDomainPackage` round-trip deep-equal. Since
 *   JUM-547 the JSON document is the versioned full-suite document: all four
 *   tabs (`domains`/`relationships`, `interfaces`, `serviceConfiguration`,
 *   `deployments`) cross deep-equal, `runtimeEnvironment` crosses as the
 *   environment *selection* only (values never leave the machine), legacy
 *   domain-only documents import with defaults, and unknown sections or a
 *   newer major version fail clearly instead of half-importing.
 * - Lossy by design: `exportAsOas` → `importStateFromOasFile` cannot carry the
 *   whole model (OAS is narrower). The assertion there is idempotence —
 *   export → import → export reaches a fixed point — plus an explicit,
 *   asserted expected-loss list. JUM-478 drove that list to zero: the entity
 *   meta OAS cannot express now crosses as agreed extensions
 *   (`x-aggregate-root`, `x-invariants`, `x-rbac`, `x-message-contracts`,
 *   composition, `x-fieldless`, `x-field-flags`) and relationships cross as
 *   `x-relations` rows keyed by schema name. A field silently joining (or
 *   silently rejoining) the loss list fails this suite.
 * - The canonical target (JUM-478): the repo's own `spec/1.0.0.yml` imports
 *   into a normalized model — no phantom port-object entities, full meta
 *   normalization — and re-exports to a fixed point whose entity schemas keep
 *   the source's structure: same properties, same required sets, same
 *   canonical CRUD operation set.
 * - One-way: Markdown, JSON Schema, AsyncAPI and the boilerplate bundle have
 *   no importer, so they assert structural invariants instead — the test
 *   names say so.
 *
 * Junction auto-generation and id recomputation complete the property list:
 * an N:N relationship materializes its junction entity once (in `script.js`'s
 * DOM-coupled `addRelationship`), and no crossing may duplicate it; imported
 * models get recomputed ids, and re-importing the same file is idempotent.
 *
 * The suite runs under Bun through the mapped runner, which refuses a run
 * that discovers zero tests (ci-cd/run-suite.js) — the "fails on zero
 * discovered tests" acceptance criterion lives in that gate.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  buildAsyncApiFileSet,
  buildAsyncApiTransportDocument
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'asyncApiExporters.js'));
const {
  buildBoilerplateBundleDocument,
  buildDomainPackageDocument,
  buildJsonExportDocument,
  buildJsonSchemaDocument,
  buildMarkdownExport,
  buildOasDocument
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'designerExporters.js'));
const {
  buildDomainFromPackage,
  buildDomainsFromOas,
  buildStateFromSuiteExport
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'importers', 'designerImporters.js'));
const {
  createDefaultView,
  createDesignerState,
  defaultFields,
  getDefaultRbacPolicy,
  normalizeStatePayload
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js'));
const {
  MemoryDesignerStore
} = require(path.join(repoRoot, 'apps', 'backend-template', 'test', 'helpers', 'MemoryDesignerStore.ts'));
const YAML = require('yaml');

type DesignerField = {
  name: string;
  type: string;
  required: boolean;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  nullable: boolean;
  format: string;
  description: string;
  enumValues: string[];
  pattern: string;
  minLength: number | null;
  maxLength: number | null;
  minimum: number | null;
  maximum: number | null;
  itemsType: string;
};

type ModelContract = {
  channel: string;
  type: string;
  name: string;
  payloadSchema: unknown;
};

type ModelEntity = {
  name: string;
  fields: DesignerField[];
  meta: { contracts: ModelContract[] };
};

type ModelDomain = {
  name: string;
  entities: ModelEntity[];
};

/**
 * The reference model: two domains, every field type and facet, message
 * contracts, OAS composition, RBAC defaults, a cross-domain relationship and
 * a non-default view. `Receipt` intentionally has no fields — the
 * `x-fieldless` marker (JUM-478) keeps the empty field set across the OAS
 * crossing. `code` is unique without an `id`-suffixed name, so its flag only
 * crosses through `x-field-flags`.
 */
function createModelState() {
  return normalizeStatePayload({
    domains: [
      {
        id: 'domain-1',
        name: 'Billing',
        color: '#86efac',
        x: 100,
        y: 80,
        context: {
          ubiquitousLanguage: 'en',
          ownerTeam: 'payments',
          upstreamDependencies: ['erp'],
          downstreamDependencies: ['crm'],
          integrationChannel: 'events',
          packageDependencies: ['shared-kernel'],
          sharedValueObjects: ['money']
        },
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            x: 14,
            y: 14,
            fields: [
              {
                name: 'id', type: 'uuid', required: true, pk: true, unique: true
              },
              {
                name: 'total', type: 'number', required: true, minimum: 0, maximum: 10
              },
              {
                name: 'tags', type: 'array', itemsType: 'string', nullable: true
              },
              {
                name: 'status',
                type: 'string',
                enum: ['open', 'paid'],
                pattern: '^[a-z]+$',
                minLength: 2,
                maxLength: 6,
                description: 'State'
              },
              { name: 'issuedOn', type: 'date' },
              { name: 'dueAt', type: 'datetime' },
              { name: 'email', type: 'string', format: 'email' },
              { name: 'code', type: 'string', unique: true },
              {
                name: 'customerId', type: 'uuid', required: true, fk: true
              },
              { name: 'count', type: 'integer' },
              { name: 'active', type: 'boolean' },
              { name: 'meta', type: 'object' }
            ],
            meta: {
              aggregateRoot: true,
              invariants: ['total must be positive'],
              contracts: [{
                id: 'contract-1',
                name: 'issued',
                type: 'event',
                channel: 'billing.issued',
                version: '1.0.0',
                payloadSchema: { type: 'object' }
              }],
              oasComposition: {
                mode: 'oneOf',
                refs: ['Base', 'Audited'],
                externalRefs: ['common.yaml#Money'],
                discriminator: 'kind'
              }
            }
          },
          {
            id: 'entity-2', name: 'Receipt', x: 220, y: 14, fields: []
          }
        ]
      },
      {
        id: 'domain-2',
        name: 'Catalog',
        entities: [{
          id: 'entity-3',
          name: 'Product',
          fields: [{
            name: 'id', type: 'uuid', required: true, pk: true, unique: true
          }]
        }]
      }
    ],
    relationships: [{
      id: 'rel-1',
      fromEntityId: 'entity-1',
      toEntityId: 'entity-3',
      name: 'invoice products',
      fromCardinality: '1',
      toCardinality: 'N'
    }],
    view: {
      zoom: 1.2,
      compactEntities: true,
      snapToGrid: false,
      edgeStyle: 'orthogonal',
      modelCheckMinSeverity: 'warn',
      exportBlockCritical: false,
      largeCanvasMode: true
    }
  });
}

/**
 * A model holding the junction an N:N relationship materializes. The junction
 * entity and its two N→1 relationships mirror `addRelationship`'s N:N branch
 * in `script.js` exactly (`<From><To>` name, `defaultFields()` plus one FK per
 * side); generation itself is DOM glue and out of this suite's reach — what
 * the crossings must guarantee is that the materialized junction is carried
 * once and never duplicated.
 */
function createJunctionState() {
  return normalizeStatePayload({
    domains: [{
      id: 'domain-1',
      name: 'Billing',
      entities: [
        {
          id: 'entity-1',
          name: 'Invoice',
          fields: [{
            name: 'id', type: 'uuid', required: true, pk: true, unique: true
          }]
        },
        {
          id: 'entity-2',
          name: 'Product',
          fields: [{
            name: 'id', type: 'uuid', required: true, pk: true, unique: true
          }]
        },
        {
          id: 'entity-3',
          name: 'InvoiceProduct',
          fields: [
            ...defaultFields(),
            {
              name: 'invoiceId', type: 'uuid', required: true, pk: false, fk: true, unique: false
            },
            {
              name: 'productId', type: 'uuid', required: true, pk: false, fk: true, unique: false
            }
          ]
        }
      ]
    }],
    relationships: [
      {
        id: 'rel-1',
        fromEntityId: 'entity-3',
        toEntityId: 'entity-1',
        name: 'InvoiceProduct -> Invoice',
        fromCardinality: 'N',
        toCardinality: '1',
        fromAnchorSide: null,
        toAnchorSide: null,
        anchorBehavior: 'auto',
        bendX: null,
        bendY: null,
        labelOffsetX: 0,
        labelOffsetY: 0
      },
      {
        id: 'rel-2',
        fromEntityId: 'entity-3',
        toEntityId: 'entity-2',
        name: 'InvoiceProduct -> Product',
        fromCardinality: 'N',
        toCardinality: '1',
        fromAnchorSide: null,
        toAnchorSide: null,
        anchorBehavior: 'auto',
        bendX: null,
        bendY: null,
        labelOffsetX: 0,
        labelOffsetY: 0
      }
    ],
    view: { zoom: 1 }
  });
}

/**
 * A state designed across all four tabs (JUM-547): the reference model plus
 * interface adapters, a non-default service configuration, a runtime
 * environment selection with local values, and deploy targets — one in the
 * Requirement 059 shape, one in the legacy pre-JUM-481 shape that migrates
 * forward on normalisation.
 */
function createFullSuiteState() {
  const base = createModelState();
  return normalizeStatePayload({
    ...base,
    interfaces: [
      {
        type: 'grpc', framework: 'bun', entrypoint: 'src/grpc.ts', controller: 'BillingGrpcController'
      },
      {
        type: 'http-rest', framework: 'express', entrypoint: 'src/http.ts', controller: 'InvoiceController'
      }
    ],
    serviceConfiguration: {
      serviceKind: 'grpc-rest-api',
      runMode: 'container',
      cloudProvider: 'google',
      staticAssetsPath: 'public',
      ports: { rest: 8080, websocket: 8081, grpc: 8082 }
    },
    runtimeEnvironment: {
      environment: 'staging',
      fileName: '.env.staging',
      values: {
        JUMENTIX_HTTP_FRAMEWORK: 'fastify',
        JUMENTIX_REDIS_URL: 'redis://internal-host:6379'
      }
    },
    deployments: [
      {
        name: 'prod-eu',
        region: 'eu-west-1',
        runtime: 'node22',
        serviceType: 'restapi',
        deployTarget: 'ec2',
        runtimeProtocol: 'http',
        databaseDriver: 'Mongo',
        keyValueDriver: 'redis',
        pm2Profile: 'production'
      },
      {
        name: 'edge', type: 'lambda', region: 'us-east-1', runtime: 'node22'
      }
    ]
  });
}

/**
 * Sorted list of JSON paths on which two documents differ, with an
 * `(added)`/`(removed)` marker when a key exists on one side only. The OAS
 * loss list is asserted through this: a newly lost (or newly preserved)
 * field changes the diff and fails the suite.
 */
function diffPaths(a: unknown, b: unknown, base = ''): string[] {
  if (Object.is(a, b)) return [];
  const aIsObject = a !== null && typeof a === 'object';
  const bIsObject = b !== null && typeof b === 'object';
  if (!aIsObject || !bIsObject || Array.isArray(a) !== Array.isArray(b)) {
    return [base || '(root)'];
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const paths: string[] = [];
  const keys = [...new Set([...Object.keys(aRecord), ...Object.keys(bRecord)])].sort();
  keys.forEach((key) => {
    if (!(key in aRecord)) paths.push(`${base}.${key} (added)`);
    else if (!(key in bRecord)) paths.push(`${base}.${key} (removed)`);
    else paths.push(...diffPaths(aRecord[key], bRecord[key], `${base}.${key}`));
  });
  return paths;
}

/**
 * The documented OAS field-format normalization, expressed as the
 * transformation the crossing applies to a normalized field: typed fields
 * (`uuid`/`date`/`datetime`) come back carrying the canonical format the
 * exporter derived from their type. Everything else — including PK/FK/unique,
 * which JUM-478 carries through `x-field-flags` whenever the flags diverge
 * from the importer's name heuristic — crosses verbatim.
 */
function applyDocumentedOasFormatNormalization(field: DesignerField): DesignerField {
  const typedFormats: Record<string, string> = { uuid: 'uuid', date: 'date', datetime: 'date-time' };
  return {
    ...field,
    format: field.format || typedFormats[field.type] || ''
  };
}

/** Ids the OAS importer recomputes, without the random fallback suffix. */
function stripImportIds(domains: Array<{ entities: Array<{ id: string }> }>) {
  return domains.map((domain) => ({
    ...domain,
    id: '<recomputed>',
    entities: domain.entities.map((entity) => ({ ...entity, id: '<recomputed>' }))
  }));
}

/** The six contract schemas of the canonical `spec/1.0.0.yml`, in declaration order. */
const SPEC_ENTITY_NAMES = ['Document', 'Email', 'Address', 'Phone', 'User', 'Organization'];

/** The canonical OAS fixture, parsed once per suite run. */
function loadCanonicalSpec() {
  return YAML.parse(fs.readFileSync(path.join(repoRoot, 'spec', '1.0.0.yml'), 'utf8'));
}

/** Total `operationId` count across all paths of a document. */
function countOperationIds(document: {
  paths?: Record<string, Record<string, { operationId?: string }>>;
}) {
  return Object.values(document.paths || {}).reduce(
    (total, methods) => total + Object.values(methods).filter((op) => op?.operationId).length,
    0
  );
}

/**
 * Facets the designer field model has no slot for. They are the named
 * remaining losses of a foreign-document import: the exporter never emits
 * them, so designer-exported documents are unaffected, but the canonical
 * spec carries them and they do not cross.
 */
const UNSUPPORTED_SOURCE_FACETS = ['example', 'default', 'minItems', 'maxItems'];

/**
 * Project a source schema's property set onto the facet surface the designer
 * model can express: the unsupported facets dropped, and array item `$ref`s
 * flattened to the `itemsType` vocabulary (the designer cannot represent a
 * value-object reference as an item type — a named remaining loss).
 */
function projectSourceProperties(properties: Record<string, Record<string, any>>) {
  return Object.fromEntries(Object.entries(properties).map(([fieldName, schema]) => {
    const projected = Object.fromEntries(
      Object.entries(schema || {}).filter(([key]) => !UNSUPPORTED_SOURCE_FACETS.includes(key))
    );
    if (projected.items?.$ref) {
      projected.items = { type: 'string' };
    }
    return [fieldName, projected];
  }));
}

/** First entity with the given name across the imported domains. */
function entityByName(
  domains: Array<{ entities: Array<{ name: string }> }>,
  entityName: string
): any {
  return domains.flatMap((domain) => domain.entities).find((entity) => entity.name === entityName);
}

/** An entity's fields indexed by field name. */
function fieldsByName(entity: { fields: DesignerField[] }) {
  const entries = entity.fields.map((field) => [field.name, field]);
  return Object.fromEntries(entries) as Record<string, DesignerField>;
}

/** Relationships without their recomputed ids, for cross-import comparison. */
function stripRelationshipIds(relationships: Array<Record<string, unknown>>) {
  return relationships.map((relationship) => {
    const stripped = { ...relationship };
    delete stripped.id;
    delete stripped.fromEntityId;
    delete stripped.toEntityId;
    return stripped;
  });
}

/** The channel derivation of the AsyncAPI export, kept conditional-free for the test body. */
function contractChannelName(domainName: string, entityName: string, contract: ModelContract) {
  return contract.channel || `${domainName.toLowerCase()}/${entityName.toLowerCase()}/${contract.type}`;
}

/** The exporter's action mapping: responses are received, every other type is sent. */
function contractAction(contract: ModelContract) {
  return contract.type === 'response' ? 'receive' : 'send';
}

/** The exporter's payload fallback for schema-less contracts. */
function contractPayloadSchema(contract: ModelContract) {
  return contract.payloadSchema || {};
}

/** The exporter's message component name for a contract. */
function contractMessageName(domainName: string, entityName: string, contract: ModelContract) {
  const pascal = (value: string) => value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
  return `${domainName}_${entityName}_${pascal(contract.name)}`;
}

function createCore() {
  const storage = new Map<string, string>();
  const store = new MemoryDesignerStore({
    storage: {
      getItem: (key: string) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key: string, value: string) => { storage.set(key, String(value)); },
      removeItem: (key: string) => { storage.delete(key); }
    }
  });
  return createDesignerState({ store, seed: () => {}, render: () => {} });
}

describe('designer export/import round-trip (JUM-471)', () => {
  describe('json state export → importStateFromFile mapping (symmetric)', () => {
    it('round-trips domains, relationships and view deep-equal through the JSON crossing', () => {
      const state = createModelState();
      const document = buildJsonExportDocument(state);
      // The crossing includes the wire step: JSON.stringify/parse, as the
      // downloaded file would.
      const imported = normalizeStatePayload(JSON.parse(JSON.stringify(document)));
      expect(imported.domains).toStrictEqual(state.domains);
      expect(imported.relationships).toStrictEqual(state.relationships);
      expect(imported.view).toStrictEqual(state.view);
    });

    it('is idempotent: a second export of the imported state is deep-equal to the first', () => {
      const first = buildJsonExportDocument(createModelState());
      const imported = normalizeStatePayload(JSON.parse(JSON.stringify(first)));
      const second = buildJsonExportDocument(imported);
      expect(second).toStrictEqual(first);
    });

    it('documents the export boundary: versioned full-suite document; selections, idCounter and env values are not part of it', () => {
      const state = createModelState();
      const document = buildJsonExportDocument(state);
      expect(Object.keys(document)).toStrictEqual([
        'kind',
        'version',
        'domains',
        'relationships',
        'interfaces',
        'serviceConfiguration',
        'runtimeEnvironment',
        'deployments',
        'view'
      ]);
      expect(document.kind).toBe('service-management-suite');
      expect(document.version).toBe('2.0.0');
      // JUM-547 decision: the environment selection crosses; values never do.
      expect(document.runtimeEnvironment).toStrictEqual({ environment: 'dev', fileName: '.env.dev' });
      const imported = normalizeStatePayload(JSON.parse(JSON.stringify(document)));
      expect(imported.idCounter).toBe(1);
      expect(imported.selectedDomainId).toBe(state.domains[0].id);
      expect(imported.selectedEntityId).toBeNull();
      expect(imported.selectedRelationshipId).toBeNull();
    });

    it('re-importing the same file twice produces the identical state, not duplicates', () => {
      const wire = JSON.parse(JSON.stringify(buildJsonExportDocument(createModelState())));
      const firstImport = normalizeStatePayload(JSON.parse(JSON.stringify(wire)));
      const secondImport = normalizeStatePayload(JSON.parse(JSON.stringify(wire)));
      expect(secondImport).toStrictEqual(firstImport);
      const entityCount = (imported: { domains: Array<{ entities: unknown[] }> }) => (
        imported.domains.reduce((total, domain) => total + domain.entities.length, 0)
      );
      expect(entityCount(secondImport)).toBe(3);
      expect(secondImport.relationships).toHaveLength(1);
    });
  });

  describe('full-suite export/import (JUM-547)', () => {
    it('round-trips all four tabs deep-equal through the suite crossing', () => {
      const state = createFullSuiteState();
      const document = buildJsonExportDocument(state);
      // The crossing includes the wire step: JSON.stringify/parse, as the
      // downloaded file would.
      const result = buildStateFromSuiteExport(JSON.parse(JSON.stringify(document)), state);
      expect(result.ok).toBe(true);
      expect(result.state.domains).toStrictEqual(state.domains);
      expect(result.state.relationships).toStrictEqual(state.relationships);
      expect(result.state.view).toStrictEqual(state.view);
      expect(result.state.interfaces).toStrictEqual(state.interfaces);
      expect(result.state.serviceConfiguration).toStrictEqual(state.serviceConfiguration);
      expect(result.state.deployments).toStrictEqual(state.deployments);
      // The environment selection crosses; the local machine's values (here
      // the source state's own) are preserved, so the section is deep-equal.
      expect(result.state.runtimeEnvironment).toStrictEqual(state.runtimeEnvironment);
    });

    it('is idempotent at document level: a second export of the imported state is deep-equal to the first', () => {
      const first = buildJsonExportDocument(createFullSuiteState());
      const result = buildStateFromSuiteExport(
        JSON.parse(JSON.stringify(first)),
        createFullSuiteState()
      );
      expect(result.ok).toBe(true);
      const second = buildJsonExportDocument(result.state);
      expect(second).toStrictEqual(first);
    });

    it('never carries runtime environment values in the bundle — the selection only', () => {
      const state = createFullSuiteState();
      const document = buildJsonExportDocument(state);
      expect(Object.keys(document.runtimeEnvironment).sort()).toStrictEqual(['environment', 'fileName']);
      // A value that names an internal endpoint must not appear anywhere in
      // the wire document — the bundle cannot carry configuration (or a
      // secret) off the machine.
      const wireText = JSON.stringify(document);
      expect(wireText).not.toContain('redis://internal-host:6379');
      expect(wireText).not.toContain('JUMENTIX_REDIS_URL');
      // The import targets a different machine with its own local values:
      // the selection is restored, the local values survive the crossing.
      const localState = {
        runtimeEnvironment: {
          environment: 'dev',
          fileName: '.env.dev',
          values: { JUMENTIX_DATABASE_DRIVER: 'InMemory' }
        }
      };
      const result = buildStateFromSuiteExport(JSON.parse(wireText), localState);
      expect(result.ok).toBe(true);
      expect(result.state.runtimeEnvironment).toStrictEqual({
        environment: 'staging',
        fileName: '.env.staging',
        values: { JUMENTIX_DATABASE_DRIVER: 'InMemory' }
      });
    });

    it('imports a pre-JUM-547 domain-only document cleanly, defaulting the missing sections', () => {
      // Backward compatibility: the shape `exportAsJson` produced before the
      // full-suite change — no `kind`, no `version`, no suite sections.
      const legacy = {
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          entities: [{ id: 'entity-1', name: 'Invoice', fields: [] }]
        }],
        relationships: [],
        view: { zoom: 1.5, edgeStyle: 'orthogonal' }
      };
      const result = buildStateFromSuiteExport(JSON.parse(JSON.stringify(legacy)));
      expect(result.ok).toBe(true);
      expect(result.state.domains[0].name).toBe('Billing');
      expect(result.state.view).toStrictEqual({
        ...createDefaultView(),
        zoom: 1.5,
        edgeStyle: 'orthogonal'
      });
      expect(result.state.interfaces).toStrictEqual([]);
      expect(result.state.serviceConfiguration).toStrictEqual({
        serviceKind: 'rest-api',
        runMode: 'dedicated-server',
        cloudProvider: 'aws',
        staticAssetsPath: '',
        ports: { rest: 3000, websocket: 3001, grpc: 3002 }
      });
      expect(result.state.runtimeEnvironment).toStrictEqual({
        environment: 'dev', fileName: '.env.dev', values: {}
      });
      expect(result.state.deployments).toStrictEqual([]);
    });

    it('refuses a document with unknown sections instead of discarding them silently', () => {
      const document = {
        ...buildJsonExportDocument(createModelState()),
        futureSection: { anything: true }
      };
      const result = buildStateFromSuiteExport(JSON.parse(JSON.stringify(document)));
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown-sections');
      expect(result.sections).toStrictEqual(['futureSection']);
    });

    it('accepts same-major versions and refuses a newer major instead of half-importing', () => {
      const wire = JSON.parse(JSON.stringify(buildJsonExportDocument(createModelState())));
      const sameMajor = buildStateFromSuiteExport({ ...wire, version: '2.7.1' });
      expect(sameMajor.ok).toBe(true);
      const newerMajor = buildStateFromSuiteExport({ ...wire, version: '3.0.0' });
      expect(newerMajor.ok).toBe(false);
      expect(newerMajor.reason).toBe('unsupported-version');
      expect(newerMajor.version).toBe('3.0.0');
      const garbage = buildStateFromSuiteExport({ ...wire, version: 'banana' });
      expect(garbage.ok).toBe(false);
      expect(garbage.reason).toBe('unsupported-version');
    });

    it('refuses a different export kind fed to the suite import instead of "succeeding" as an empty model', () => {
      const state = createModelState();
      const packageDocument = buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z');
      const result = buildStateFromSuiteExport(JSON.parse(JSON.stringify(packageDocument)));
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('wrong-document-kind');
      expect(result.kind).toBe('domain-package');
    });

    it('refuses a non-object document', () => {
      expect(buildStateFromSuiteExport(null)).toStrictEqual({ ok: false, reason: 'invalid-document' });
      expect(buildStateFromSuiteExport([1, 2, 3]).reason).toBe('invalid-document');
      expect(buildStateFromSuiteExport('text').reason).toBe('invalid-document');
    });
  });

  describe('domain package export → importDomainPackage mapping (symmetric)', () => {
    it('round-trips a domain package deep-equal into an empty model', () => {
      const state = createModelState();
      const document = buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z');
      const result = buildDomainFromPackage(JSON.parse(JSON.stringify(document)), []);
      expect(result.ok).toBe(true);
      expect(result.domain).toStrictEqual(state.domains[0]);
    });

    it('suffixes the domain name on re-import instead of colliding or duplicating', () => {
      const state = createModelState();
      const wire = JSON.parse(JSON.stringify(
        buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z')
      ));
      const first = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), []);
      const second = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), [first.domain]);
      const third = buildDomainFromPackage(
        JSON.parse(JSON.stringify(wire)),
        [first.domain, second.domain]
      );
      expect(second.domain.name).toBe('Billing_2');
      expect(third.domain.name).toBe('Billing_3');
      // Name and recomputed ids (JUM-617) aside, everything else crosses.
      const stripIds = (domain: { id: string; name: string; entities: Array<{ id: string }> }) => ({
        ...domain,
        id: '<id>',
        entities: domain.entities.map((entity) => ({ ...entity, id: '<id>' }))
      });
      expect({ ...stripIds(second.domain), name: first.domain.name })
        .toStrictEqual(stripIds(first.domain));
    });

    it('recomputes colliding package ids on re-import, so re-imported domains never share domain/entity ids (JUM-617)', () => {
      // JUM-617 closed the gap this suite previously pinned as a candidate
      // defect (found under JUM-471): `importDomainPackage` used to keep the
      // file's ids verbatim, so importing the same package twice yielded two
      // domains sharing domain/entity ids. The importer now keeps ids that
      // are free and recomputes colliding ones on the OAS fallback-id
      // convention, so id uniqueness across the model holds after any number
      // of re-imports.
      const state = createModelState();
      const wire = JSON.parse(JSON.stringify(
        buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z')
      ));
      const first = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), []);
      const second = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), [first.domain]);
      // Ids that do not collide still cross verbatim (first import into an
      // empty model) — the round-trip deep-equal above depends on it.
      expect(first.domain.id).toBe(state.domains[0].id);
      expect(second.domain.id).not.toBe(first.domain.id);
      const firstEntityIds = first.domain.entities.map((entity: { id: string }) => entity.id);
      const secondEntityIds = second.domain.entities.map((entity: { id: string }) => entity.id);
      expect(secondEntityIds).toHaveLength(firstEntityIds.length);
      secondEntityIds.forEach((id: string) => {
        expect(firstEntityIds).not.toContain(id);
      });
    });
  });

  describe('oas export → importStateFromOasFile mapping (lossy by design)', () => {
    it('is idempotent: export → import → export reaches a fixed point', () => {
      const first = buildOasDocument(createModelState());
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      expect(firstImport.ok).toBe(true);
      const second = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      const secondImport = buildDomainsFromOas(JSON.parse(JSON.stringify(second)));
      expect(secondImport.ok).toBe(true);
      const third = buildOasDocument({
        domains: secondImport.domains,
        relationships: secondImport.relationships
      });
      expect(third).toStrictEqual(second);
    });

    it('loses exactly the documented field list in the first crossing (JUM-478: the list is empty)', () => {
      // EXPECTED-LOSS CONTRACT. JUM-478 drove the JUM-471 baseline (21 paths)
      // to zero: composition extensions, message contracts, `x-relations`,
      // the fieldless-entity marker and entity meta (aggregate, invariants,
      // RBAC) all cross as agreed extensions, and PK/FK/unique cross through
      // `x-field-flags`. The port-object wrappers stay skipped by design —
      // they are derived artifacts, not model state — and with the model
      // lossless their propagation diffs vanish too. A path silently joining
      // this list is the regression this assertion catches.
      const EXPECTED_FIRST_CROSSING_DIFF: string[] = [];
      const first = buildOasDocument(createModelState());
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const second = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      expect(diffPaths(first, second).sort()).toStrictEqual(EXPECTED_FIRST_CROSSING_DIFF);
    });

    it('restores every field facet except the documented typed-format normalization', () => {
      const state = createModelState();
      const first = buildOasDocument(state);
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const importedInvoice = firstImport.domains[0].entities[0];
      const expectedFields = state.domains[0].entities[0].fields.map(
        (field: DesignerField) => applyDocumentedOasFormatNormalization(field)
      );
      expect(importedInvoice.fields).toStrictEqual(expectedFields);
      // PK/FK/unique cross through `x-field-flags` (JUM-478): `code` stays
      // unique even though the name heuristic alone would drop the flag.
      const byName = Object.fromEntries(
        importedInvoice.fields.map((field: DesignerField) => [field.name, field])
      ) as Record<string, DesignerField>;
      expect(byName.code.unique).toBe(true);
      expect(byName.customerId.fk).toBe(true);
      // The fieldless Receipt keeps its empty field set via `x-fieldless`.
      expect(firstImport.domains[0].entities[1].fields).toStrictEqual([]);
    });

    it('drops domain context and canvas positions but restores entity meta and relationships', () => {
      const state = createModelState();
      const first = buildOasDocument(state);
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const [billing, catalog] = firstImport.domains;
      // Names survive; the bounded-context block and canvas layout are
      // recomputed (they have no extension carriage — named remaining loss).
      expect(billing.name).toBe('Billing');
      expect(catalog.name).toBe('Catalog');
      expect(Object.keys(billing)).toStrictEqual(['id', 'name', 'color', 'x', 'y', 'entities']);
      expect(billing.color).not.toBe(state.domains[0].color);
      expect(Object.keys(billing.entities[0])).toStrictEqual(['id', 'name', 'x', 'y', 'fields', 'meta']);
      expect(billing.entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['Invoice', 'Receipt']);
      // Entity meta crosses normalized: aggregate declaration, invariants,
      // contracts, composition — and the RBAC policy (the default here).
      expect(billing.entities[0].meta).toStrictEqual({
        aggregateRoot: true,
        invariants: ['total must be positive'],
        rbac: getDefaultRbacPolicy(),
        contracts: [{
          id: 'contract-1',
          name: 'issued',
          type: 'event',
          channel: 'billing.issued',
          version: '1.0.0',
          payloadSchema: { type: 'object' }
        }],
        oasComposition: {
          mode: 'oneOf',
          refs: ['Base', 'Audited'],
          externalRefs: ['common.yaml#Money'],
          discriminator: 'kind'
        }
      });
      expect(billing.entities[1].meta).toStrictEqual({
        aggregateRoot: false,
        invariants: [],
        rbac: getDefaultRbacPolicy(),
        contracts: [],
        oasComposition: {
          mode: '', refs: [], externalRefs: [], discriminator: ''
        }
      });
      // Relationships cross via `x-relations`, re-keyed to the imported ids.
      expect(firstImport.relationships).toHaveLength(1);
      expect(firstImport.relationships[0]).toMatchObject({
        name: 'invoice products',
        fromEntityId: billing.entities[0].id,
        toEntityId: catalog.entities[0].id,
        fromCardinality: '1',
        toCardinality: 'N'
      });
    });

    it('recomputes import ids with the fallback pattern, unique across repeated imports', () => {
      const wire = JSON.parse(JSON.stringify(buildOasDocument(createModelState())));
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(wire)));
      const secondImport = buildDomainsFromOas(JSON.parse(JSON.stringify(wire)));
      const collectIds = (domains: Array<{ id: string; entities: Array<{ id: string }> }>) => (
        domains.flatMap((domain) => [domain.id, ...domain.entities.map((entity) => entity.id)])
      );
      const firstIds = collectIds(firstImport.domains);
      const secondIds = collectIds(secondImport.domains);
      [...firstIds, ...secondIds].forEach((id) => {
        expect(id).toMatch(/^(domain|entity)-import-\d+-[a-z0-9]{6}$/);
      });
      // No collision within or across imports — re-importing never reuses an id.
      const allIds = [...firstIds, ...secondIds];
      expect(new Set(allIds).size).toBe(allIds.length);
      // Modulo the recomputed ids, both imports of the same file are identical.
      expect(stripImportIds(secondImport.domains))
        .toStrictEqual(stripImportIds(firstImport.domains));
      // Relationships are idempotent too: same rows, recomputed ids.
      expect(stripRelationshipIds(secondImport.relationships))
        .toStrictEqual(stripRelationshipIds(firstImport.relationships));
    });
  });

  describe('junction auto-generation across the crossings', () => {
    it('json export carries the generated junction and re-import keeps exactly one', () => {
      const state = createJunctionState();
      const wire = JSON.parse(JSON.stringify(buildJsonExportDocument(state)));
      const firstImport = normalizeStatePayload(JSON.parse(JSON.stringify(wire)));
      expect(firstImport.domains[0].entities).toHaveLength(3);
      expect(
        firstImport.domains[0].entities.filter((entity: { name: string }) => entity.name === 'InvoiceProduct')
      ).toHaveLength(1);
      expect(firstImport.relationships).toHaveLength(2);
      expect(firstImport.domains).toStrictEqual(state.domains);
      expect(firstImport.relationships).toStrictEqual(state.relationships);
      // Re-importing the same file does not generate a second junction.
      const secondImport = normalizeStatePayload(JSON.parse(JSON.stringify(wire)));
      expect(secondImport).toStrictEqual(firstImport);
    });

    it('oas export keeps the junction as a plain schema and crosses its relationships by schema name', () => {
      const state = createJunctionState();
      const document = buildOasDocument(state);
      expect(Object.keys(document.components.schemas)).toContain('Billing_InvoiceProduct');
      // JUM-478: x-relations rows key on schema names, not model ids — the
      // importer recomputes ids, so ids in the document would break the
      // export → import → export fixed point.
      expect(document['x-relations']).toStrictEqual([
        {
          name: 'InvoiceProduct -> Invoice',
          fromSchema: 'Billing_InvoiceProduct',
          toSchema: 'Billing_Invoice',
          fromCardinality: 'N',
          toCardinality: '1'
        },
        {
          name: 'InvoiceProduct -> Product',
          fromSchema: 'Billing_InvoiceProduct',
          toSchema: 'Billing_Product',
          fromCardinality: 'N',
          toCardinality: '1'
        }
      ]);
      // The junction entity survives the OAS crossing as a plain entity and
      // its two relationships come back re-keyed to the imported ids — inert
      // data, never a duplicated generated junction.
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(document)));
      expect(firstImport.domains[0].entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['Invoice', 'Product', 'InvoiceProduct']);
      expect(firstImport.relationships).toHaveLength(2);
      const idByName = Object.fromEntries(
        firstImport.domains[0].entities.map(
          (entity: { id: string; name: string }) => [entity.name, entity.id]
        )
      );
      expect(
        firstImport.relationships.map(
          (relationship: { fromEntityId: string; toEntityId: string }) => [
            relationship.fromEntityId,
            relationship.toEntityId
          ]
        )
      ).toStrictEqual([
        [idByName.InvoiceProduct, idByName.Invoice],
        [idByName.InvoiceProduct, idByName.Product]
      ]);
    });
  });

  describe('id recomputation', () => {
    it('advances the idCounter past the highest numeric id suffix on JSON import', () => {
      // The importStateFromFile glue applies the normalized payload to the
      // core and calls recomputeIdCounter — exercised here against the real
      // core and the real storage port, exactly as the glue does.
      const imported = normalizeStatePayload({
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          entities: [
            { id: 'entity-12', name: 'Invoice', fields: [] },
            { id: 'entity-import-3-x7k2p9', name: 'Legacy', fields: [] }
          ]
        }],
        relationships: [{
          id: 'rel-7', fromEntityId: 'entity-12', toEntityId: 'entity-import-3-x7k2p9'
        }]
      });
      const core = createCore();
      core.state.domains = imported.domains;
      core.state.relationships = imported.relationships;
      core.recomputeIdCounter();
      // entity-12 wins; the random suffix of entity-import-3-x7k2p9 is not numeric.
      expect(core.state.idCounter).toBe(13);
    });

    it('recomputes the same idCounter when the same file is imported twice', () => {
      const wire = JSON.parse(JSON.stringify(buildJsonExportDocument(createJunctionState())));
      const importIntoFreshCore = () => {
        const core = createCore();
        const imported = normalizeStatePayload(JSON.parse(JSON.stringify(wire)));
        core.state.domains = imported.domains;
        core.state.relationships = imported.relationships;
        core.recomputeIdCounter();
        return core;
      };
      const firstCore = importIntoFreshCore();
      const secondCore = importIntoFreshCore();
      expect(firstCore.state.idCounter).toBe(secondCore.state.idCounter);
      expect(firstCore.state.idCounter).toBe(4);
    });
  });

  describe('canonical spec/1.0.0.yml round-trip (JUM-478)', () => {
    const specDocument = loadCanonicalSpec();

    it('pins the canonical fixture: openapi 3.1.0 with 33 operationIds', () => {
      expect(specDocument.openapi).toBe('3.1.0');
      expect(countOperationIds(specDocument)).toBe(33);
    });

    it('imports the six contract schemas with full meta normalization and no phantom port objects', () => {
      // The canonical spec carries no designer markers at all: the importer
      // recognizes the port-object conventions (Request*/ArrayOf/
      // ResourceDeleteResponse names, "Port input/output object" descriptions,
      // non-object contracts) and keeps exactly the six contract schemas.
      const result = buildDomainsFromOas(specDocument);
      expect(result.ok).toBe(true);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0].name).toBe('Imported');
      expect(result.domains[0].entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(SPEC_ENTITY_NAMES);
      expect(result.relationships).toStrictEqual([]);
      const user = entityByName(result.domains, 'User');
      // Full meta normalization: with no extension carriage in the source,
      // every meta slot normalizes to its designer default.
      expect(user.meta).toStrictEqual({
        aggregateRoot: false,
        invariants: [],
        rbac: getDefaultRbacPolicy(),
        contracts: [],
        oasComposition: {
          mode: '', refs: [], externalRefs: [], discriminator: ''
        }
      });
      const userFields = fieldsByName(user);
      expect(userFields.id).toMatchObject({
        type: 'string', required: true, pk: true, unique: true
      });
      expect(userFields.password).toMatchObject({
        type: 'string', format: 'password', minLength: 8, required: true
      });
      expect(userFields.organization).toMatchObject({ type: 'uuid', nullable: true, fk: false });
      expect(userFields.lastName).toMatchObject({ type: 'string', nullable: true });
      expect(userFields.createdAt).toMatchObject({ type: 'datetime', format: 'date-time', required: true });
      // Array item `$ref`s flatten into the designer's itemsType vocabulary —
      // a named remaining loss: the Email value-object linkage does not cross.
      expect(userFields.emails).toMatchObject({ type: 'array', itemsType: 'string', required: true });
      const documentEntity = entityByName(result.domains, 'Document');
      expect(fieldsByName(documentEntity).type.enumValues).toStrictEqual(['CPF', 'RG', 'SSN', 'passport']);
    });

    it('is idempotent: importing the spec twice yields the same model modulo recomputed ids', () => {
      const firstImport = buildDomainsFromOas(specDocument);
      const secondImport = buildDomainsFromOas(specDocument);
      expect(stripImportIds(secondImport.domains))
        .toStrictEqual(stripImportIds(firstImport.domains));
      expect(secondImport.relationships).toStrictEqual(firstImport.relationships);
    });

    it('re-exports to a fixed point: a second crossing is identical at model and document level', () => {
      const firstImport = buildDomainsFromOas(specDocument);
      const second = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      const secondImport = buildDomainsFromOas(JSON.parse(JSON.stringify(second)));
      expect(secondImport.ok).toBe(true);
      expect(stripImportIds(secondImport.domains))
        .toStrictEqual(stripImportIds(firstImport.domains));
      const third = buildOasDocument({
        domains: secondImport.domains,
        relationships: secondImport.relationships
      });
      expect(third).toStrictEqual(second);
    });

    it('preserves the Users and Organization schema structure across the crossing', () => {
      const firstImport = buildDomainsFromOas(specDocument);
      const exported = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      SPEC_ENTITY_NAMES.forEach((entityName) => {
        const sourceSchema = specDocument.components.schemas[entityName];
        const exportedSchema = exported.components.schemas[`Imported_${entityName}`];
        expect(exportedSchema.properties)
          .toStrictEqual(projectSourceProperties(sourceSchema.properties));
        expect([...exportedSchema.required].sort())
          .toStrictEqual([...sourceSchema.required].sort());
      });
    });

    it('maps every imported contract schema to the five canonical CRUD operations', () => {
      // The source's legacy operationIds (`getAll`, `create`, `deleteOne`,
      // ...) do not cross: the export follows the Req 036 canonical verb
      // scheme (JUM-474), qualified by schema name so ids stay unique across
      // domains. "Same operations" is asserted as the full CRUD set per
      // imported resource.
      const firstImport = buildDomainsFromOas(specDocument);
      const exported = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      const operationIds = Object.values(exported.paths).flatMap(
        (methods) => Object.values(methods as Record<string, { operationId: string }>)
          .map((operation) => operation.operationId)
      );
      const expected = SPEC_ENTITY_NAMES.flatMap((entityName) => [
        `getAllImported_${entityName}`,
        `createImported_${entityName}`,
        `getImported_${entityName}ById`,
        `updateImported_${entityName}`,
        `deleteImported_${entityName}`
      ]);
      expect(operationIds).toStrictEqual(expected);
    });
  });

  describe('one-way exporters (no importer exists — structural invariants instead of round-trip)', () => {
    it('markdown has no importer: pins that every domain, entity, field and relationship is rendered', () => {
      const state = createModelState();
      const markdown = buildMarkdownExport(state);
      expect(markdown.startsWith('# Domain Designer Model\n')).toBe(true);
      state.domains.forEach((domain: ModelDomain) => {
        expect(markdown).toContain(`## Domain: ${domain.name}`);
        domain.entities.forEach((entity) => {
          expect(markdown).toContain(`### Entity: ${entity.name}`);
          entity.fields.forEach((field) => {
            expect(markdown).toContain(`| ${field.name} | `);
          });
        });
      });
      expect(markdown).toContain('## Relationships');
      expect(markdown).toContain('- invoice products: Billing/Invoice (1) -> (N) Catalog/Product');
    });

    it('json schema has no importer: pins one definition per entity with required ⊆ properties', () => {
      const state = createModelState();
      const document = buildJsonSchemaDocument(state);
      expect(document.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      const expectedNames = state.domains.flatMap(
        (domain: ModelDomain) => (
          domain.entities.map((entity) => `${domain.name}_${entity.name}`)
        )
      );
      expect(Object.keys(document.definitions).sort()).toStrictEqual(expectedNames.sort());
      type JsonSchemaDefinition = {
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties: boolean;
      };
      Object.values(document.definitions).forEach((definition) => {
        const schema = definition as JsonSchemaDefinition;
        schema.required.forEach((requiredName) => {
          expect(Object.keys(schema.properties)).toContain(requiredName);
        });
        expect(schema.additionalProperties).toBe(false);
      });
    });

    it('asyncapi has no importer: pins one 3.0 operation per contract per transport with shared payload refs', () => {
      const state = createModelState();
      const fileSet = buildAsyncApiFileSet(state);
      // The canonical naming: one <version>.<transport>.yml file per transport.
      expect(fileSet.files.map((file: { fileName: string }) => file.fileName))
        .toStrictEqual(['1.0.0.websocket.yml', '1.0.0.grpc.yml']);
      ['websocket', 'grpc'].forEach((transport) => {
        const document = buildAsyncApiTransportDocument(state, transport);
        expect(document.asyncapi).toBe('3.0.0');
        state.domains.forEach((domain: ModelDomain) => {
          domain.entities.forEach((entity) => {
            entity.meta.contracts.forEach((contract) => {
              const messageName = contractMessageName(domain.name, entity.name, contract);
              const operation = document.operations[`${contract.type}_${messageName}`];
              expect(operation).toBeDefined();
              // Responses are received; every other contract type is sent.
              expect(operation.action).toBe(contractAction(contract));
              expect(operation.channel.$ref)
                .toBe(`#/channels/${contractChannelName(domain.name, entity.name, contract)}`);
              // Payloads are shared component refs, never inline duplicates.
              const payloadRef = document.components.messages[messageName].payload.$ref;
              expect(payloadRef.startsWith('#/components/schemas/')).toBe(true);
              const schemaName = payloadRef.slice('#/components/schemas/'.length);
              expect(document.components.schemas[schemaName])
                .toStrictEqual(contractPayloadSchema(contract));
            });
          });
        });
      });
    });

    it('boilerplate bundle emits code, not a model: pins one module per domain with the hexagonal file set', () => {
      const state = createModelState();
      const document = buildBoilerplateBundleDocument(state, '2026-08-05T00:00:00.000Z');
      expect(document.kind).toBe('boilerplate-bundle');
      expect(document.version).toBe('2.0.0');
      expect(document.modules.map((module: { module: string }) => module.module))
        .toStrictEqual(state.domains.map((domain: ModelDomain) => domain.name));
      const entityRoles = [
        'controller',
        'entityInterface',
        'model',
        'persistenceAdapter',
        'repositoryPort',
        'security',
        'useCases',
        'useCasesPort'
      ];
      document.modules.forEach((module: {
        module: string;
        path: string;
        files: Record<string, { path: string; content: string }>;
        entities: { entity: string; files: Record<string, { path: string; content: string }> }[];
      }) => {
        expect(module.path).toBe(`src/modules/${module.module}`);
        expect(module.files.composition.path)
          .toBe(`${module.path}/composition/compose${module.module}Services.ts`);
        const domain = state.domains.find(
          (candidate: ModelDomain) => candidate.name === module.module
        );
        expect(module.entities.map((entity) => entity.entity))
          .toStrictEqual(domain.entities.map((entity: ModelEntity) => entity.name));
        module.entities.forEach((entity) => {
          expect(Object.keys(entity.files).sort()).toStrictEqual(entityRoles);
          Object.values(entity.files).forEach((file) => {
            expect(file.path.startsWith(`${module.path}/`)).toBe(true);
            expect(file.path).toContain(entity.entity);
            expect(file.content.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });
});
