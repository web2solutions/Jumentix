/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * OAS export compliance suite (JUM-474).
 *
 * The designer's OAS export is only useful if the boilerplate accepts it, and
 * the boilerplate's bar is objective: Requirement 036, enforced by
 * `ci-cd/check-oas-route-resolution.js`. This suite applies the checker's own
 * port-object validation — imported from the real script, not a copy — to a
 * document exported from a UI-style model, so the export cannot drift from
 * the gate without failing here.
 *
 * The checker's other half (controller/handler file resolution against
 * `apps/backend-template`) is intentionally out of reach: those files are
 * what the codegen lane (JUM-476) generates FROM this document. What must
 * hold today is everything Requirement 036 legislates: unique operationIds on
 * the canonical verb scheme, `$ref`ed request bodies and 2xx responses, and
 * descriptions on every referenced schema.
 *
 * All document-walking logic lives in module-scope helpers: the repo lints
 * test bodies with `jest/no-conditional-in-test`, so conditionals stay out of
 * the `it` callbacks.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const { buildOasDocument } = require(
  '@jumentix/designer-core/exporters/designerExporters.js'
);
const { buildDomainsFromOas } = require(
  '@jumentix/designer-core/importers/designerImporters.js'
);
const { collectModelIssues } = require(
  '@jumentix/designer-core/validation/modelValidation.js'
);
const { normalizeStatePayload } = require(
  '@jumentix/designer-core/state/designerState.js'
);

const {
  resolveSchemaByRef,
  validatePortObjectContracts
} = require(path.join(repoRoot, 'ci-cd', 'check-oas-route-resolution.js'));

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

/** A UI-built model: two domains, composition, message contracts, a relationship. */
function createUiModelState() {
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
                name: 'id', type: 'uuid', required: true, pk: true, unique: true
              },
              {
                name: 'total', type: 'number', required: true, minimum: 0
              },
              {
                name: 'tags', type: 'array', itemsType: 'string', nullable: true
              }
            ],
            meta: {
              contracts: [{
                id: 'contract-1', name: 'issued', type: 'event', channel: 'billing.issued', version: '1.0.0'
              }],
              oasComposition: {
                mode: 'oneOf', refs: ['Base', 'Audited'], externalRefs: [], discriminator: 'kind'
              }
            }
          },
          {
            id: 'entity-2',
            name: 'Receipt',
            fields: [{
              name: 'id', type: 'uuid', required: true, pk: true, unique: true
            }]
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
    }]
  });
}

/** Every [routePath, method, operation] triple of a document. */
function operationsOf(document: any) {
  const operations: Array<{ routePath: string; method: string; operation: any }> = [];
  Object.entries(document.paths || {}).forEach(([routePath, methods]: [string, any]) => {
    Object.entries(methods || {}).forEach(([method, operation]) => {
      if (HTTP_METHODS.includes(method.toLowerCase())) {
        operations.push({ routePath, method, operation });
      }
    });
  });
  return operations;
}

/** Run the repository's own Req 036 validator over every operation. */
function validateDocumentOperations(document: any): string[] {
  const errors: string[] = [];
  operationsOf(document).forEach(({ routePath, method, operation }) => {
    validatePortObjectContracts('domain-designer-oas-3.1.json', document, routePath, method, operation, errors);
  });
  return errors;
}

/** Every request-body and 2xx-response content schema `$ref` in the document. */
function collectPortSchemaRefs(document: any): string[] {
  const refs: string[] = [];
  operationsOf(document).forEach(({ operation }) => {
    Object.values(operation.requestBody?.content || {}).forEach((content: any) => {
      refs.push(content?.schema?.$ref);
    });
    Object.entries(operation.responses || {}).forEach(([statusCode, response]: [string, any]) => {
      if (!statusCode.startsWith('2')) return;
      Object.values(response?.content || {}).forEach((content: any) => {
        refs.push(content?.schema?.$ref);
      });
    });
  });
  return refs;
}

/** Resolve every port `$ref` to `{ ref, description }` (empty string when missing). */
function resolvePortSchemaRefs(document: any, refs: string[]) {
  return refs.map((ref) => {
    const resolved = typeof ref === 'string' ? resolveSchemaByRef(document, ref) : null;
    return { ref, description: String(resolved?.schema?.description || '').trim() };
  });
}

/** Every non-2xx response as `{ statusCode, description }`. */
function collectErrorResponses(document: any) {
  const errors: Array<{ statusCode: string; description: string }> = [];
  operationsOf(document).forEach(({ operation }) => {
    Object.entries(operation.responses || {}).forEach(([statusCode, response]: [string, any]) => {
      if (statusCode.startsWith('2')) return;
      errors.push({ statusCode, description: String(response?.description || '') });
    });
  });
  return errors;
}

/** Names of the component schemas marked as derived port objects. */
function portObjectSchemaNames(document: any): string[] {
  return Object.entries(document.components.schemas)
    .filter(([, schema]: [string, any]) => schema['x-port-object'] === true)
    .map(([name]) => name)
    .sort();
}

describe('oas export compliance with Req 036 and the route-resolution check (JUM-474)', () => {
  it('passes the repository port-object contract validation for every exported operation', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    expect(validateDocumentOperations(document)).toStrictEqual([]);
  });

  it('gives every operation a unique operationId on the canonical verb scheme', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    const operations = operationsOf(document);
    // Five CRUD operations per entity, three entities.
    expect(operations).toHaveLength(15);
    const operationIds = operations.map(({ operation }) => operation.operationId);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    operationIds.forEach((operationId: string) => {
      // The canonical scheme (spec/1.0.0.yml): getAll*, create*, get*ById,
      // update*, delete* — camelCase, qualified so ids stay unique.
      expect(operationId).toMatch(/^(getAll[A-Z]|create[A-Z]|get[A-Z].*ById$|update[A-Z]|delete[A-Z])/);
    });
  });

  it('never inlines a request or 2xx response schema, and every referenced schema is described', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    const resolvedRefs = resolvePortSchemaRefs(document, collectPortSchemaRefs(document));
    expect(resolvedRefs.length).toBeGreaterThan(0);
    resolvedRefs.forEach(({ ref, description }) => {
      expect(typeof ref).toBe('string');
      // A $ref that resolves to nothing yields an empty description from the
      // helper, so the same assertion catches unresolved and undescribed.
      expect(description).not.toBe('');
    });
  });

  it('emits error responses consistent with ERROR-CONTRACTS-AND-RESPONSES', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    const canonicalErrorCodes = ['400', '401', '403', '404', '409'];
    const errorResponses = collectErrorResponses(document);
    expect(errorResponses.length).toBeGreaterThan(0);
    errorResponses.forEach(({ statusCode, description }) => {
      expect(canonicalErrorCodes).toContain(statusCode);
      expect(description.trim()).not.toBe('');
    });
    // Create and update conflict; item operations report not-found.
    const collection = document.paths['/billing/invoice'];
    const item = document.paths['/billing/invoice/{id}'];
    expect(Object.keys(collection.post.responses)).toContain('409');
    expect(Object.keys(item.put.responses)).toContain('409');
    expect(Object.keys(item.put.responses)).toContain('404');
    expect(Object.keys(item.delete.responses)).toContain('404');
  });

  it('serialises composition as native OAS 3.1 constructs', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    const invoice = document.components.schemas.Billing_Invoice;
    expect(invoice.oneOf).toStrictEqual([
      { $ref: '#/components/schemas/Base' },
      { $ref: '#/components/schemas/Audited' }
    ]);
    expect(invoice.discriminator).toStrictEqual({
      propertyName: 'kind',
      mapping: {
        Base: '#/components/schemas/Base',
        Audited: '#/components/schemas/Audited'
      }
    });
  });

  it('marks port input/output wrappers so a re-import creates no phantom entities', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createUiModelState());
    expect(portObjectSchemaNames(document)).toStrictEqual([
      'Billing_InvoiceArrayOf',
      'Billing_ReceiptArrayOf',
      'Catalog_ProductArrayOf',
      'RequestCreateBilling_Invoice',
      'RequestCreateBilling_Receipt',
      'RequestCreateCatalog_Product',
      'RequestUpdateBilling_Invoice',
      'RequestUpdateBilling_Receipt',
      'RequestUpdateCatalog_Product',
      'ResourceDeleteResponse'
    ]);
    const imported = buildDomainsFromOas(JSON.parse(JSON.stringify(document)));
    expect(imported.ok).toBe(true);
    expect(imported.domains.map((domain: { name: string }) => domain.name))
      .toStrictEqual(['Billing', 'Catalog']);
    expect(
      imported.domains.flatMap((domain: { entities: Array<{ name: string }> }) => domain.entities)
        .map((entity: { name: string }) => entity.name)
    ).toStrictEqual(['Invoice', 'Receipt', 'Product']);
  });

  it('fails the export quality gate for a model whose export would lose operations', () => {
    expect.hasAssertions();
    // Distinct names that collapse to the same OAS tokens would silently
    // overwrite each other's path/schema in the document — the gate must
    // block the export instead of emitting a document that fails downstream.
    const state = normalizeStatePayload({
      domains: [
        { id: 'domain-1', name: 'Foo Bar', entities: [{ id: 'entity-1', name: 'Baz', fields: [] }] },
        { id: 'domain-2', name: 'Foo-Bar', entities: [{ id: 'entity-2', name: 'Baz', fields: [] }] }
      ],
      relationships: []
    });
    const issues = collectModelIssues(state);
    const critical = issues.filter((issue: { severity: string }) => issue.severity === 'error');
    expect(critical.length).toBeGreaterThan(0);
    expect(critical.some((issue: { message: string }) => issue.message.includes('same OAS route path'))).toBe(true);
    expect(critical.some((issue: { message: string }) => issue.message.includes('same OAS schema name'))).toBe(true);
  });
});
