/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
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
 *   `normalizeStatePayload`) and `exportAsPackage` → `importDomainPackage`
 *   round-trip deep-equal.
 * - Lossy by design: `exportAsOas` → `importStateFromOasFile` cannot carry the
 *   whole model (OAS is narrower). The assertion there is idempotence —
 *   export → import → export reaches a fixed point — plus an explicit,
 *   asserted expected-loss list. That list is the baseline JUM-478 (lossless
 *   `spec/1.0.0.yml` round-trip) is committed to shrink: a field silently
 *   joining the list fails this suite.
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
  buildDomainsFromOas
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'importers', 'designerImporters.js'));
const {
  createDesignerState,
  defaultFields,
  normalizeStatePayload
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js'));
const {
  LocalStorageDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'LocalStorageDesignerStore.js'));

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
 * contracts, OAS composition, a cross-domain relationship and a non-default
 * view. `Receipt` intentionally has no fields — the OAS importer's
 * default-fields fallback is part of the documented loss list.
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
 * The documented OAS field-facet loss, expressed as the transformation the
 * crossing applies to a normalized field: `pk`/`fk`/`unique` are not part of
 * OAS at all and are recomputed from the field name on import, and typed
 * fields (`uuid`/`date`/`datetime`) come back carrying the format the
 * exporter derived from their type. Everything else crosses verbatim.
 */
function applyDocumentedOasFieldLoss(field: DesignerField): DesignerField {
  const typedFormats: Record<string, string> = { uuid: 'uuid', date: 'date', datetime: 'date-time' };
  return {
    ...field,
    format: field.format || typedFormats[field.type] || '',
    pk: field.name === 'id',
    fk: /id$/i.test(field.name) && field.name !== 'id',
    unique: field.name === 'id'
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
  const store = new LocalStorageDesignerStore({
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

    it('documents the export boundary: selections and idCounter are not part of the JSON document', () => {
      const state = createModelState();
      const document = buildJsonExportDocument(state);
      expect(Object.keys(document)).toStrictEqual(['domains', 'relationships', 'view']);
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
      // The name is the only intended difference: everything else crosses.
      expect({ ...second.domain, name: first.domain.name }).toStrictEqual(first.domain);
    });

    it('pins the pre-refactor id behaviour: package ids cross verbatim, so a twice-imported package shares ids', () => {
      // DOCUMENTED GAP (candidate defect, reported under JUM-471; not fixed
      // here — this suite tests what exists): `importDomainPackage` keeps the
      // file's ids verbatim, so importing the same package twice yields two
      // domains that share domain/entity ids. `recomputeIdCounter` and the
      // name suffix absorb the collision in the UI, but id-uniqueness across
      // the model is NOT guaranteed by the package crossing.
      const state = createModelState();
      const wire = JSON.parse(JSON.stringify(
        buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z')
      ));
      const first = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), []);
      const second = buildDomainFromPackage(JSON.parse(JSON.stringify(wire)), [first.domain]);
      expect(second.domain.id).toBe(first.domain.id);
      expect(second.domain.entities.map((entity: { id: string }) => entity.id))
        .toStrictEqual(first.domain.entities.map((entity: { id: string }) => entity.id));
    });
  });

  describe('oas export → importStateFromOasFile mapping (lossy by design)', () => {
    it('is idempotent: export → import → export reaches a fixed point', () => {
      const first = buildOasDocument(createModelState());
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      expect(firstImport.ok).toBe(true);
      const second = buildOasDocument({ domains: firstImport.domains, relationships: [] });
      const secondImport = buildDomainsFromOas(JSON.parse(JSON.stringify(second)));
      expect(secondImport.ok).toBe(true);
      const third = buildOasDocument({ domains: secondImport.domains, relationships: [] });
      expect(third).toStrictEqual(second);
    });

    it('loses exactly the documented field list in the first crossing (the JUM-478 baseline)', () => {
      // EXPECTED-LOSS CONTRACT. Every entry is a design gap of the OAS
      // crossing, not an accident: composition extensions and message
      // contracts have no OAS import mapping, relationships are reset by the
      // import glue, and a fieldless entity comes back with the importer's
      // default fields. A field silently joining (or leaving) this list is
      // the regression this assertion catches — update it only together with
      // JUM-478's lossless-round-trip work.
      const EXPECTED_FIRST_CROSSING_DIFF = [
        // OAS composition extensions are exported but never imported.
        '.components.schemas.Billing_Invoice.discriminator (removed)',
        '.components.schemas.Billing_Invoice.oneOf (removed)',
        '.components.schemas.Billing_Invoice.x-external-refs (removed)',
        // Message contracts are exported (per schema and top-level) but never imported.
        '.components.schemas.Billing_Invoice.x-message-contracts.0 (removed)',
        '.x-message-contracts.0 (removed)',
        // Relationships are exported in x-relations but reset on import.
        '.x-relations.0 (removed)',
        // The fieldless Receipt comes back with the importer's default fields.
        '.components.schemas.Billing_Receipt.properties.createdAt (added)',
        '.components.schemas.Billing_Receipt.properties.id (added)',
        '.components.schemas.Billing_Receipt.properties.updatedAt (added)',
        '.components.schemas.Billing_Receipt.required.0 (added)',
        '.components.schemas.Billing_Receipt.required.1 (added)',
        '.components.schemas.Billing_Receipt.required.2 (added)'
      ].sort();
      const first = buildOasDocument(createModelState());
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const second = buildOasDocument({ domains: firstImport.domains, relationships: [] });
      expect(diffPaths(first, second).sort()).toStrictEqual(EXPECTED_FIRST_CROSSING_DIFF);
    });

    it('restores every field facet except the documented name-heuristic and format gaps', () => {
      const state = createModelState();
      const first = buildOasDocument(state);
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const importedInvoice = firstImport.domains[0].entities[0];
      const expectedFields = state.domains[0].entities[0].fields.map(
        (field: DesignerField) => applyDocumentedOasFieldLoss(field)
      );
      expect(importedInvoice.fields).toStrictEqual(expectedFields);
      // The name heuristic is visible in the fixture: `code` was unique in the
      // model and is not after the crossing, while `customerId` keeps its FK
      // because the name ends in `Id`.
      const byName = Object.fromEntries(
        importedInvoice.fields.map((field: DesignerField) => [field.name, field])
      ) as Record<string, DesignerField>;
      expect(byName.code.unique).toBe(false);
      expect(byName.customerId.fk).toBe(true);
      // The fieldless Receipt comes back with the default id/createdAt/updatedAt.
      expect(firstImport.domains[0].entities[1].fields).toStrictEqual(defaultFields());
    });

    it('drops domain context, entity meta and canvas positions at the model level', () => {
      const state = createModelState();
      const first = buildOasDocument(state);
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      const [billing, catalog] = firstImport.domains;
      // Names survive; everything else about the domain is recomputed.
      expect(billing.name).toBe('Billing');
      expect(catalog.name).toBe('Catalog');
      expect(Object.keys(billing)).toStrictEqual(['id', 'name', 'color', 'x', 'y', 'entities']);
      expect(billing.color).not.toBe(state.domains[0].color);
      expect(Object.keys(billing.entities[0])).toStrictEqual(['id', 'name', 'x', 'y', 'fields']);
      expect(billing.entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['Invoice', 'Receipt']);
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

    it('oas export keeps the junction as a plain schema and loses its relationships on import', () => {
      const state = createJunctionState();
      const document = buildOasDocument(state);
      expect(Object.keys(document.components.schemas)).toContain('Billing_InvoiceProduct');
      expect(document['x-relations']).toStrictEqual([
        {
          name: 'InvoiceProduct -> Invoice',
          fromEntityId: 'entity-3',
          toEntityId: 'entity-1',
          fromSchema: 'Billing_InvoiceProduct',
          toSchema: 'Billing_Invoice',
          fromCardinality: 'N',
          toCardinality: '1'
        },
        {
          name: 'InvoiceProduct -> Product',
          fromEntityId: 'entity-3',
          toEntityId: 'entity-2',
          fromSchema: 'Billing_InvoiceProduct',
          toSchema: 'Billing_Product',
          fromCardinality: 'N',
          toCardinality: '1'
        }
      ]);
      // The junction entity survives the OAS crossing as a plain entity; the
      // relationships do not (the import glue resets them) — so a re-imported
      // junction is inert data, never a duplicated generated junction.
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(document)));
      expect(firstImport.domains[0].entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['Invoice', 'Product', 'InvoiceProduct']);
      expect(firstImport.domains[0]).not.toHaveProperty('relationships');
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

    it('boilerplate bundle emits code, not a model: pins one module per entity with the hexagonal file set', () => {
      const state = createModelState();
      const document = buildBoilerplateBundleDocument(state, '2026-08-05T00:00:00.000Z');
      expect(document.kind).toBe('boilerplate-bundle');
      expect(document.version).toBe('1.0.0');
      const expectedModules = state.domains.flatMap(
        (domain: ModelDomain) => (
          domain.entities.map((entity) => `${domain.name}/${entity.name}`)
        )
      );
      expect(document.modules.map((module: { module: string }) => module.module))
        .toStrictEqual(expectedModules);
      document.modules.forEach((module: { module: string; files: Record<string, string> }) => {
        const [domainName, entityName] = module.module.split('/');
        expect(Object.keys(module.files).sort())
          .toStrictEqual(['controller', 'handler', 'model', 'repository', 'useCase']);
        Object.values(module.files).forEach((filePath) => {
          expect(filePath).toContain(`src/modules/${domainName}/`);
          expect(filePath).toContain(entityName);
        });
      });
    });
  });
});
