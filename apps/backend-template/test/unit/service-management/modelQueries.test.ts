/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the pure model helpers extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`apps/service-management/src/model/modelQueries.js`).
 *
 * The suite runs with no DOM and no DOM shim — importing and exercising the
 * module here is itself the proof that the helpers the validation engine,
 * exporters, importers and UI layer share are DOM-free.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const model = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'model', 'modelQueries.js'));

function createDomains() {
  return [
    {
      id: 'domain-1',
      name: 'Billing',
      color: '#86efac',
      x: 100,
      y: 50,
      entities: [
        {
          id: 'entity-1', name: 'Invoice', x: 14, y: 14, fields: []
        },
        {
          id: 'entity-2', name: 'Payment Method', x: 220, y: 14, fields: []
        }
      ]
    },
    {
      id: 'domain-2',
      name: 'Users',
      color: '#93c5fd',
      x: 700,
      y: 200,
      entities: [
        {
          id: 'entity-3', name: 'User', x: 14, y: 14, fields: []
        }
      ]
    }
  ];
}

describe('model queries (JUM-469)', () => {
  it('is DOM-free: no document/window references in the new pure modules', () => {
    [
      'src/model/modelQueries.js',
      'src/validation/modelValidation.js',
      'src/exporters/designerExporters.js',
      'src/importers/designerImporters.js'
    ].forEach((modulePath) => {
      const source = fs.readFileSync(
        path.join(repoRoot, 'apps', 'service-management', ...modulePath.split('/')),
        'utf-8'
      );
      // Strip comments so prose about the modules cannot false-positive;
      // what remains must not reach the DOM globals.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      expect(code).not.toMatch(/\bdocument\s*\./);
      expect(code).not.toMatch(/\bwindow\s*\./);
    });
  });

  describe('name helpers', () => {
    it('normalizes names case- and whitespace-insensitively', () => {
      expect(model.normalizedName('  Invoice ')).toBe('invoice');
      expect(model.normalizedName(null)).toBe('');
      expect(model.normalizedName(undefined)).toBe('');
    });

    it('dedupes and trims string lists', () => {
      expect(model.uniqueStrings([' a ', 'b', 'a', ''])).toStrictEqual(['a', 'b']);
      expect(model.uniqueStrings(null)).toStrictEqual([]);
    });

    it('detects taken domain names, ignoring a given id', () => {
      const domains = createDomains();
      expect(model.isDomainNameTaken(domains, 'billing')).toBe(true);
      expect(model.isDomainNameTaken(domains, 'Billing', 'domain-1')).toBe(false);
      expect(model.isDomainNameTaken(domains, 'Catalog')).toBe(false);
    });

    it('detects taken entity names inside one domain, ignoring a given id', () => {
      const [domain] = createDomains();
      expect(model.isEntityNameTaken(domain, 'invoice')).toBe(true);
      expect(model.isEntityNameTaken(domain, 'Invoice', 'entity-1')).toBe(false);
      expect(model.isEntityNameTaken(domain, 'Receipt')).toBe(false);
    });

    it('detects taken field names inside one entity, ignoring the field being renamed', () => {
      const entity = { fields: [{ name: 'total' }, { name: 'status' }] };
      expect(model.isFieldNameTaken(entity, 'TOTAL')).toBe(true);
      expect(model.isFieldNameTaken(entity, 'total', 'total')).toBe(false);
      expect(model.isFieldNameTaken(entity, 'total', null)).toBe(true);
      expect(model.isFieldNameTaken(entity, 'notes')).toBe(false);
    });
  });

  describe('entity lookup', () => {
    it('finds an entity with its domain by id', () => {
      const found = model.findEntity(createDomains(), 'entity-2');
      expect(found.domain.id).toBe('domain-1');
      expect(found.entity.name).toBe('Payment Method');
      expect(model.findEntity(createDomains(), 'missing')).toBeNull();
    });

    it('finds an entity by case-insensitive substring', () => {
      const found = model.findEntityByName(createDomains(), 'payment');
      expect(found.entity.id).toBe('entity-2');
      expect(model.findEntityByName(createDomains(), 'nothing')).toBeNull();
      expect(model.findEntityByName(createDomains(), '   ')).toBeNull();
    });

    it('labels entities as domain/entity, falling back to the raw id', () => {
      expect(model.entityLabel(createDomains(), 'entity-3')).toBe('Users/User');
      expect(model.entityLabel(createDomains(), 'missing')).toBe('missing');
    });
  });

  describe('labels and names', () => {
    it('renders field labels with flags and format', () => {
      expect(model.fieldLabel({
        name: 'id', type: 'uuid', pk: true, unique: true, required: true
      }))
        .toBe('id: uuid [PK, UQ, REQ]');
      expect(model.fieldLabel({
        name: 'email', type: 'string', format: 'email', nullable: true
      }))
        .toBe('email: string(email) [NULL]');
      expect(model.fieldLabel({ name: 'total', type: 'number', fk: true }))
        .toBe('total: number [FK]');
    });

    it('builds relationship names per cardinality pair', () => {
      const domains = createDomains();
      expect(model.buildRelationshipName(domains, 'entity-1', 'entity-2', 'N', '1'))
        .toBe('Billing/Invoice belongs to Billing/Payment Method');
      expect(model.buildRelationshipName(domains, 'entity-1', 'entity-2', '1', 'N'))
        .toBe('Billing/Invoice has many Billing/Payment Method');
      expect(model.buildRelationshipName(domains, 'entity-1', 'entity-2', '1', '1'))
        .toBe('Billing/Invoice is linked to Billing/Payment Method');
      expect(model.buildRelationshipName(domains, 'entity-1', 'entity-2', 'N', 'N'))
        .toBe('Billing/Invoice relates to Billing/Payment Method');
    });

    it('ranks severities with unknown values at the bottom', () => {
      expect(model.severityRank('error')).toBe(3);
      expect(model.severityRank('warn')).toBe(2);
      expect(model.severityRank('info')).toBe(1);
      expect(model.severityRank('bogus')).toBe(1);
    });
  });

  describe('rbac policy', () => {
    it('installs the default policy on entities without meta', () => {
      const entity: Record<string, unknown> = {};
      const policy = model.getEntityRbacPolicy(entity);
      expect(policy.list.roles).toStrictEqual(['superadmin', 'admin']);
      expect(entity.meta).toBeDefined();
    });

    it('keeps an existing policy untouched', () => {
      const custom = { list: { roles: ['user'], tenantScoped: false } };
      const entity = { meta: { rbac: custom } };
      expect(model.getEntityRbacPolicy(entity)).toBe(custom);
    });
  });

  describe('oAS type mapping', () => {
    it('maps designer field types to OAS types', () => {
      expect(model.toOasType('integer')).toStrictEqual({ type: 'integer' });
      expect(model.toOasType('number')).toStrictEqual({ type: 'number' });
      expect(model.toOasType('boolean')).toStrictEqual({ type: 'boolean' });
      expect(model.toOasType('array')).toStrictEqual({ type: 'array' });
      expect(model.toOasType('object')).toStrictEqual({ type: 'object' });
      expect(model.toOasType('date')).toStrictEqual({ type: 'string', format: 'date' });
      expect(model.toOasType('datetime')).toStrictEqual({ type: 'string', format: 'date-time' });
      expect(model.toOasType('uuid')).toStrictEqual({ type: 'string', format: 'uuid' });
      expect(model.toOasType('string')).toStrictEqual({ type: 'string' });
      expect(model.toOasType('anything-else')).toStrictEqual({ type: 'string' });
    });

    it('maps OAS schemas back to designer field types', () => {
      expect(model.fromOasType({ type: 'array' })).toBe('array');
      expect(model.fromOasType({ type: 'object' })).toBe('object');
      expect(model.fromOasType({ type: 'integer' })).toBe('integer');
      expect(model.fromOasType({ type: 'number' })).toBe('number');
      expect(model.fromOasType({ type: 'boolean' })).toBe('boolean');
      expect(model.fromOasType({ type: 'string', format: 'date' })).toBe('date');
      expect(model.fromOasType({ type: 'string', format: 'date-time' })).toBe('datetime');
      expect(model.fromOasType({ type: 'string', format: 'uuid' })).toBe('uuid');
      expect(model.fromOasType({ type: 'string' })).toBe('string');
      expect(model.fromOasType({})).toBe('string');
      expect(model.fromOasType()).toBe('string');
    });

    it('builds field schemas with every supported constraint', () => {
      const schema = model.toOasFieldSchema({
        name: 'status',
        type: 'string',
        format: 'token',
        description: 'Lifecycle status',
        nullable: true,
        enumValues: ['open', 'paid'],
        minLength: 2,
        maxLength: 8,
        minimum: 1,
        maximum: 5,
        pattern: '^[a-z]+$'
      });
      expect(schema).toStrictEqual({
        type: 'string',
        format: 'token',
        description: 'Lifecycle status',
        nullable: true,
        enum: ['open', 'paid'],
        minLength: 2,
        maxLength: 8,
        minimum: 1,
        maximum: 5,
        pattern: '^[a-z]+$'
      });
    });

    it('defaults array items to string and omits absent constraints', () => {
      expect(model.toOasFieldSchema({ name: 'tags', type: 'array' }))
        .toStrictEqual({ type: 'array', items: { type: 'string' } });
      expect(model.toOasFieldSchema({ name: 'tags', type: 'array', itemsType: 'uuid' }))
        .toStrictEqual({ type: 'array', items: { type: 'string', format: 'uuid' } });
      expect(model.toOasFieldSchema({ name: 'total', type: 'number' }))
        .toStrictEqual({ type: 'number' });
    });
  });

  describe('schema and path tokens', () => {
    it('builds schema names with sane fallbacks', () => {
      expect(model.toSchemaName('Billing', 'Invoice')).toBe('Billing_Invoice');
      expect(model.toSchemaName('Payment Method!', 'Line Item')).toBe('Payment_Method_Line_Item');
      expect(model.toSchemaName('', '')).toBe('Domain_Entity');
    });

    it('builds path tokens with sane fallbacks', () => {
      expect(model.toPathToken('Payment Method')).toBe('payment-method');
      expect(model.toPathToken('  --Weird__Name--  ')).toBe('weird-name');
      expect(model.toPathToken('')).toBe('');
    });
  });

  describe('example builders', () => {
    it('builds example values per field type and format', () => {
      expect(model.buildExampleValueForField({ name: 's', enumValues: ['a', 'b'] })).toBe('a');
      expect(model.buildExampleValueForField({ name: 'id', type: 'uuid' })).toBe('00000000-0000-4000-8000-000000000001');
      expect(model.buildExampleValueForField({ name: 'at', type: 'datetime' })).toBe('2026-01-01T00:00:00.000Z');
      expect(model.buildExampleValueForField({ name: 'day', type: 'date' })).toBe('2026-01-01');
      expect(model.buildExampleValueForField({ name: 'n', type: 'integer' })).toBe(1);
      expect(model.buildExampleValueForField({ name: 'n', type: 'number' })).toBe(10.5);
      expect(model.buildExampleValueForField({ name: 'b', type: 'boolean' })).toBe(true);
      expect(model.buildExampleValueForField({ name: 'a', type: 'array' })).toStrictEqual([]);
      expect(model.buildExampleValueForField({ name: 'o', type: 'object' })).toStrictEqual({});
      expect(model.buildExampleValueForField({ name: 'e', type: 'string', format: 'email' })).toBe('user@example.com');
      expect(model.buildExampleValueForField({ name: 'u', type: 'string', format: 'uri' })).toBe('https://example.com/resource');
      expect(model.buildExampleValueForField({ name: 'title', type: 'string' })).toBe('title_example');
      expect(model.buildExampleValueForField({ type: 'string' })).toBe('value_example');
    });

    it('builds create/update request examples with the pre-refactor field rules', () => {
      const entity = {
        fields: [
          {
            name: 'id', type: 'uuid', pk: true, required: true
          },
          { name: 'name', type: 'string', required: true },
          { name: 'organizationId', type: 'uuid', fk: true },
          { name: 'code', type: 'string', unique: true },
          { name: 'notes', type: 'string' }
        ]
      };
      expect(model.buildEntityRequestExample(entity, 'create')).toStrictEqual({
        name: 'name_example',
        organizationId: '00000000-0000-4000-8000-000000000001',
        code: 'code_example',
        notes: 'notes_example'
      });
      expect(model.buildEntityRequestExample(entity, 'update')).toStrictEqual({
        name: 'name_example',
        organizationId: '00000000-0000-4000-8000-000000000001',
        code: 'code_example'
      });
      expect(model.buildEntityRequestExample(entity)).toStrictEqual(model.buildEntityRequestExample(entity, 'create'));
    });

    it('builds a response example with every field', () => {
      expect(model.buildEntityResponseExample({ fields: [{ name: 'id', type: 'uuid' }] }))
        .toStrictEqual({ id: '00000000-0000-4000-8000-000000000001' });
      expect(model.buildEntityResponseExample({})).toStrictEqual({});
    });
  });

  describe('canvas geometry', () => {
    it('snaps coordinates to the 8px grid only when enabled', () => {
      expect(model.snapCoordinate(true, 13)).toBe(16);
      expect(model.snapCoordinate(true, 11)).toBe(8);
      expect(model.snapCoordinate(false, 13)).toBe(13);
    });

    it('computes entity centres and side anchors in canvas coordinates', () => {
      const domain = { x: 100, y: 50 };
      const entity = { x: 14, y: 14 };
      expect(model.entityCenterPoint(domain, entity)).toStrictEqual({ x: 209, y: 96 });
      expect(model.entityAnchorPoint(domain, entity, 'left', false)).toStrictEqual({ x: 114, y: 109 });
      expect(model.entityAnchorPoint(domain, entity, 'right', false)).toStrictEqual({ x: 304, y: 109 });
      expect(model.entityAnchorPoint(domain, entity, 'top', false)).toStrictEqual({ x: 209, y: 64 });
      expect(model.entityAnchorPoint(domain, entity, 'bottom', false)).toStrictEqual({ x: 209, y: 154 });
      expect(model.entityAnchorPoint(domain, entity, 'left', true)).toStrictEqual({ x: 114, y: 92 });
      expect(model.entityAnchorPoint(domain, entity, 'diagonal', false))
        .toStrictEqual(model.entityCenterPoint(domain, entity));
    });

    it('builds edge paths byte-identically for both styles', () => {
      const from = { x: 1, y: 2 };
      const to = { x: 100, y: 200 };
      expect(model.buildEdgePathD(from, to, 50, 100, false)).toBe('M 1 2 C 50 2, 50 200, 100 200');
      expect(model.buildEdgePathD(from, to, 50, 100, true)).toBe('M 1 2 L 50 2 L 50 100 L 50 200 L 100 200');
      expect(model.buildPreviewEdgePathD(from, to, false)).toBe('M 1 2 C 50.5 2, 50.5 200, 100 200');
      expect(model.buildPreviewEdgePathD(from, to, true)).toBe('M 1 2 L 50.5 2 L 50.5 200 L 100 200');
    });

    it('computes fit-view zoom and scroll for the empty and populated canvas', () => {
      expect(model.computeFitView([], 800, 600)).toStrictEqual({ zoom: 1, left: 0, top: 0 });
      const domains = [{ x: 80, y: 80 }];
      const fit = model.computeFitView(domains, 680, 440);
      expect(fit.zoom).toBe(1);
      expect(fit.left).toBe(0);
      expect(fit.top).toBe(0);
      const spread = [{ x: 0, y: 0 }, { x: 5000, y: 4000 }];
      const clamped = model.computeFitView(spread, 800, 600);
      expect(clamped.zoom).toBe(0.5);
      expect(clamped.left).toBe(0);
      expect(clamped.top).toBe(0);
      const tiny = [{ x: 500, y: 400 }];
      const zoomed = model.computeFitView(tiny, 4000, 3000);
      expect(zoomed.zoom).toBe(2);
      expect(zoomed.left).toBe((500 - 80) * 2);
      expect(zoomed.top).toBe((400 - 80) * 2);
    });

    it('lays out domains in a grid and entities in two columns', () => {
      const domains = [
        { x: 0, y: 0, entities: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] },
        { x: 0, y: 0, entities: [] }
      ];
      model.applyAutoLayout(domains);
      expect([domains[0].x, domains[0].y]).toStrictEqual([40, 40]);
      expect([domains[1].x, domains[1].y]).toStrictEqual([630, 40]);
      expect([domains[0].entities[0].x, domains[0].entities[0].y]).toStrictEqual([14, 14]);
      expect([domains[0].entities[1].x, domains[0].entities[1].y]).toStrictEqual([220, 14]);
      expect([domains[0].entities[2].x, domains[0].entities[2].y]).toStrictEqual([14, 132]);
    });
  });
});
