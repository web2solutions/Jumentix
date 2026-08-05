/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the import mappers extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`apps/service-management/src/importers/designerImporters.js`).
 *
 * Both mappers are exercised as pure functions over parsed JSON — no
 * FileReader, no DOM. The OAS round-trip test pins the export→import mapping
 * that JUM-471 (round-trip suite) and JUM-478 (lossless round-trip) build
 * on.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const { buildDomainFromPackage, buildDomainsFromOas } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'importers', 'designerImporters.js')
);
const { buildOasDocument } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'designerExporters.js')
);
const { normalizeStatePayload } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js')
);

describe('designer importers (JUM-469)', () => {
  describe('buildDomainFromPackage', () => {
    it('rejects documents without a domain entity list', () => {
      expect(buildDomainFromPackage(null, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
      expect(buildDomainFromPackage({}, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
      expect(buildDomainFromPackage({ domain: { name: 'X' } }, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
    });

    it('normalizes a valid package into a positioned domain', () => {
      const result = buildDomainFromPackage({
        domain: {
          name: 'Catalog',
          entities: [{
            name: 'Product',
            fields: [{
              name: 'id', type: 'uuid', pk: true, required: true
            }]
          }],
          context: {
            packageDependencies: ['shared', 'shared', 'kernel'],
            sharedValueObjects: ['money', 'money']
          }
        }
      }, []);
      expect(result.ok).toBe(true);
      expect(result.domain.name).toBe('Catalog');
      expect(result.domain.color).toBe('#60a5fa');
      expect([result.domain.x, result.domain.y]).toStrictEqual([120, 90]);
      expect(result.domain.context.packageDependencies).toStrictEqual(['shared', 'kernel']);
      expect(result.domain.context.sharedValueObjects).toStrictEqual(['money']);
      expect(result.domain.entities).toHaveLength(1);
      expect(result.domain.entities[0].fields[0].pk).toBe(true);
    });

    it('suffixes the domain name until it stops colliding', () => {
      const existing = [
        {
          id: 'd1', name: 'Catalog', context: {}, entities: []
        },
        {
          id: 'd2', name: 'Catalog_2', context: {}, entities: []
        }
      ];
      const result = buildDomainFromPackage({
        domain: { name: 'Catalog', entities: [] }
      }, existing);
      expect(result.ok).toBe(true);
      expect(result.domain.name).toBe('Catalog_3');
    });

    it('keeps incoming package dependencies that no existing domain declares', () => {
      const existing = [
        { id: 'd0', name: 'Other', entities: [] },
        {
          id: 'd1',
          name: 'Billing',
          context: { packageDependencies: ['shared'] },
          entities: []
        }
      ];
      const result = buildDomainFromPackage({
        domain: {
          name: 'Catalog',
          entities: [],
          context: { packageDependencies: ['shared', 'new-dep', 'new-dep'] }
        }
      }, existing);
      expect(result.domain.context.packageDependencies).toStrictEqual(['shared', 'new-dep']);
    });

    it('handles a missing context on the incoming domain', () => {
      const result = buildDomainFromPackage({ domain: { name: 'Bare', entities: [] } }, []);
      expect(result.ok).toBe(true);
      expect(result.domain.context.packageDependencies).toStrictEqual([]);
      expect(result.domain.context.sharedValueObjects).toStrictEqual([]);
    });
  });

  describe('buildDomainsFromOas', () => {
    it('rejects documents without components.schemas', () => {
      expect(buildDomainsFromOas(null)).toStrictEqual({ ok: false, reason: 'invalid-oas' });
      expect(buildDomainsFromOas({})).toStrictEqual({ ok: false, reason: 'invalid-oas' });
      expect(buildDomainsFromOas({ components: { schemas: 'nope' } })).toStrictEqual({ ok: false, reason: 'invalid-oas' });
    });

    it('rejects documents whose schemas hold no usable entry', () => {
      expect(buildDomainsFromOas({ components: { schemas: {} } })).toStrictEqual({ ok: false, reason: 'no-schemas' });
      expect(buildDomainsFromOas({ components: { schemas: { Broken: null } } }))
        .toStrictEqual({ ok: false, reason: 'no-schemas' });
    });

    it('groups schemas by x-domain and maps fields back through fromOasType', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Billing_Invoice: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Invoice',
              required: ['id', 'total'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                organizationId: { type: 'string', format: 'uuid' },
                total: { type: 'number', minimum: 0, maximum: 10 },
                day: { type: 'string', format: 'date' },
                at: { type: 'string', format: 'date-time' },
                active: { type: 'boolean' },
                count: { type: 'integer' },
                tags: { type: 'array', items: { type: 'string', format: 'uuid' }, nullable: true },
                meta: { type: 'object' },
                status: {
                  type: 'string', enum: ['open'], pattern: '^[a-z]+$', minLength: 2, maxLength: 6, description: 'State'
                }
              }
            },
            Billing_Receipt: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Receipt',
              properties: {}
            },
            Plain: {
              type: 'object'
            }
          }
        }
      });
      expect(result.ok).toBe(true);
      expect(result.domains).toHaveLength(2);

      const [billing, imported] = result.domains;
      expect(billing.name).toBe('Billing');
      expect(billing.entities).toHaveLength(2);

      const invoice = billing.entities[0];
      expect(invoice.name).toBe('Invoice');
      expect([invoice.x, invoice.y]).toStrictEqual([14, 14]);
      const byName = Object.fromEntries(
        invoice.fields.map((field: { name: string }) => [field.name, field])
      );
      expect(byName.id).toMatchObject({
        type: 'uuid', required: true, pk: true, unique: true, fk: false
      });
      expect(byName.organizationId).toMatchObject({
        type: 'uuid', required: false, pk: false, fk: true, unique: false
      });
      expect(byName.total).toMatchObject({
        type: 'number', required: true, minimum: 0, maximum: 10
      });
      expect(byName.day.type).toBe('date');
      expect(byName.at.type).toBe('datetime');
      expect(byName.active.type).toBe('boolean');
      expect(byName.count.type).toBe('integer');
      expect(byName.tags).toMatchObject({ type: 'array', itemsType: 'uuid', nullable: true });
      expect(byName.meta.type).toBe('object');
      expect(byName.status).toMatchObject({
        type: 'string',
        enumValues: ['open'],
        pattern: '^[a-z]+$',
        minLength: 2,
        maxLength: 6,
        description: 'State'
      });

      // Empty properties fall back to the default id/createdAt/updatedAt fields.
      const receipt = billing.entities[1];
      expect([receipt.x, receipt.y]).toStrictEqual([220, 14]);
      expect(receipt.fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'createdAt', 'updatedAt']);

      // Without x-domain/x-entity the schema key and the Imported domain are used.
      expect(imported.name).toBe('Imported');
      expect(imported.entities[0].name).toBe('Plain');
      expect(imported.color).toBe('#34d399');
    });

    it('falls back to the Imported domain and schema key for blank markers, tolerating null field schemas', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Legacy: {
              type: 'object',
              'x-domain': '   ',
              'x-entity': ' ',
              properties: {
                ghost: null
              }
            }
          }
        }
      });
      expect(result.ok).toBe(true);
      expect(result.domains[0].name).toBe('Imported');
      expect(result.domains[0].entities[0].name).toBe('Legacy');
      expect(result.domains[0].entities[0].fields[0]).toMatchObject({ name: 'ghost', type: 'string' });
    });

    it('round-trips an exported OAS document back to equivalent fields', () => {
      const state = normalizeStatePayload({
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          entities: [{
            id: 'entity-1',
            name: 'Invoice',
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
                name: 'status', type: 'string', enum: ['open', 'paid'], pattern: '^[a-z]+$'
              }
            ]
          }]
        }],
        relationships: []
      });
      const oas = buildOasDocument(state);
      const result = buildDomainsFromOas(oas);
      expect(result.ok).toBe(true);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0].name).toBe('Billing');
      expect(result.domains[0].entities).toHaveLength(1);
      // The OAS mapping preserves every field facet the exporter emitted —
      // except `format`: typed fields carry it in OAS (string+format=uuid)
      // and the importer restores it verbatim, so `id` comes back with
      // format 'uuid' where the designer original kept ''. This pins the
      // pre-refactor round-trip asymmetry exactly as it was.
      const expectedFields = state.domains[0].entities[0].fields.map(
        (field: { name: string; format: string }) => ({ ...field })
      );
      expectedFields[0].format = 'uuid';
      expect(result.domains[0].entities[0].fields).toStrictEqual(expectedFields);
    });
  });
});
