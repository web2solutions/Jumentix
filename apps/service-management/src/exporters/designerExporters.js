/**
 * designerExporters — the export builders of the Service Management
 * designer, extracted from `script.js` by JUM-469.
 *
 * Six builders live here (JSON, Markdown, JSON Schema, boilerplate bundle,
 * domain package, OAS 3.1); the AsyncAPI 3.0 per-transport and gRPC proto
 * builders live in `asyncApiExporters.js` (JUM-475), which targets the
 * canonical `spec/asyncapi/` conventions.
 *
 * Every builder is a pure function over the state object: state in, document
 * (or markdown text) out. No `document`, no `window`, no `Blob` — the
 * download glue (`canExportModel`, `Blob`/`URL.createObjectURL`/`<a
 * download>`) stays in `script.js`, so this module imports and runs under
 * Bun/Node with no DOM shim. That is the foundation the JUM-471 round-trip
 * suite and the contract-parity lane (JUM-474/475/476/478) build on.
 *
 * Document construction is verbatim from the monolith: same key order, same
 * shapes, same text. For the same input the JSON.stringify output is
 * byte-identical to the pre-refactor exporters. The two timestamped documents
 * take an injectable `generatedAt`/`exportedAt` so parity is testable; the
 * defaults keep the pre-refactor `new Date().toISOString()` behaviour.
 */

import {
  normalizeContractInput,
  parseCommaSeparated
} from '../state/designerState.js';
import {
  entityLabel,
  getEntityRbacPolicy,
  toOasFieldSchema,
  toPathToken,
  toSchemaName
} from '../model/modelQueries.js';

/** `exportAsJson` payload: `{ domains, relationships, view }`. */
export function buildJsonExportDocument(state) {
  return { domains: state.domains, relationships: state.relationships, view: state.view };
}

/** `exportAsMarkdown` document text (the full markdown, newline-joined). */
export function buildMarkdownExport(state) {
  const lines = [];
  lines.push('# Domain Designer Model');
  lines.push('');
  state.domains.forEach((domain) => {
    lines.push(`## Domain: ${domain.name}`);
    lines.push('');
    if (domain?.context) {
      lines.push(`- Ubiquitous Language: ${domain.context.ubiquitousLanguage || '-'}`);
      lines.push(`- Owner Team: ${domain.context.ownerTeam || '-'}`);
      lines.push(`- Upstream: ${(domain.context.upstreamDependencies || []).join(', ') || '-'}`);
      lines.push(`- Downstream: ${(domain.context.downstreamDependencies || []).join(', ') || '-'}`);
      lines.push(`- Integration Channel: ${domain.context.integrationChannel || '-'}`);
      lines.push(`- Package Dependencies: ${(domain.context.packageDependencies || []).join(', ') || '-'}`);
      lines.push(`- Shared Value Objects: ${(domain.context.sharedValueObjects || []).join(', ') || '-'}`);
      lines.push('');
    }
    domain.entities.forEach((entity) => {
      lines.push(`### Entity: ${entity.name}`);
      lines.push('');
      lines.push(`- Aggregate Root: ${Boolean(entity?.meta?.aggregateRoot)}`);
      lines.push(`- Invariants: ${(entity?.meta?.invariants || []).join('; ') || '-'}`);
      lines.push('');
      lines.push('| Field | Type | Required | PK | FK | Unique | Nullable |');
      lines.push('|---|---|---:|---:|---:|---:|---:|');
      entity.fields.forEach((field) => {
        lines.push(`| ${field.name} | ${field.type}${field.format ? `(${field.format})` : ''} | ${Boolean(field.required)} | ${Boolean(field.pk)} | ${Boolean(field.fk)} | ${Boolean(field.unique)} | ${Boolean(field.nullable)} |`);
      });
      lines.push('');
      lines.push('RBAC:');
      const policy = getEntityRbacPolicy(entity);
      ['list', 'getById', 'create', 'update', 'delete'].forEach((action) => {
        const rule = policy[action] || { roles: [], tenantScoped: true };
        lines.push(`- ${action}: [${(rule.roles || []).join(', ')}], tenantScoped=${Boolean(rule.tenantScoped)}`);
      });
      lines.push('');
      lines.push('Message Contracts:');
      const contracts = Array.isArray(entity?.meta?.contracts) ? entity.meta.contracts : [];
      if (!contracts.length) {
        lines.push('- none');
      } else {
        contracts.forEach((contract) => {
          lines.push(`- ${contract.type}:${contract.name} | channel=${contract.channel || '-'} | version=${contract.version}`);
        });
      }
      lines.push('');
    });
  });
  if (state.relationships.length) {
    lines.push('## Relationships');
    lines.push('');
    state.relationships.forEach((relationship) => {
      lines.push(`- ${relationship.name || relationship.id}: ${entityLabel(state.domains, relationship.fromEntityId)} (${relationship.fromCardinality}) -> (${relationship.toCardinality}) ${entityLabel(state.domains, relationship.toEntityId)}`);
    });
  }
  return lines.join('\n');
}

/** `exportAsJsonSchema` payload (JSON Schema draft 2020-12 definitions). */
export function buildJsonSchemaDocument(state) {
  const definitions = {};
  state.domains.forEach((domain) => {
    domain.entities.forEach((entity) => {
      const schemaName = toSchemaName(domain.name, entity.name);
      const properties = {};
      const required = [];
      (entity.fields || []).forEach((field) => {
        properties[field.name] = toOasFieldSchema(field);
        if (field.required) required.push(field.name);
      });
      definitions[schemaName] = {
        $id: schemaName,
        type: 'object',
        properties,
        required,
        additionalProperties: false
      };
    });
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Domain Designer JSON Schemas',
    type: 'object',
    definitions
  };
}

/** `exportBoilerplateBundle` payload (hexagonal file layout per module). */
export function buildBoilerplateBundleDocument(state, generatedAt = new Date().toISOString()) {
  const modules = state.domains.flatMap((domain) => domain.entities.map((entity) => ({
    module: `${domain.name}/${entity.name}`,
    files: {
      model: `src/modules/${domain.name}/domain/Model/${entity.name}.ts`,
      repository: `src/modules/${domain.name}/application/ports/${entity.name}Repository.ts`,
      useCase: `src/modules/${domain.name}/application/useCases/Create${entity.name}.ts`,
      controller: `src/modules/${domain.name}/interface/controller/${entity.name}Controller.ts`,
      handler: `src/modules/${domain.name}/interface/restapi/frameworks/express/handlers/create${entity.name}.ts`
    }
  })));
  return {
    kind: 'boilerplate-bundle',
    version: '1.0.0',
    generatedAt,
    modules
  };
}

/** `exportAsPackage` payload (single-domain package). */
export function buildDomainPackageDocument(domain, exportedAt = new Date().toISOString()) {
  return {
    kind: 'domain-package',
    version: '1.0.0',
    exportedAt,
    domain
  };
}

/** `exportAsOas` payload (OpenAPI 3.1.0 with x- extensions). */
export function buildOasDocument(state) {
  const schemas = {};
  const paths = {};
  const entitySchemaIndex = {};
  state.domains.forEach((domain) => {
    domain.entities.forEach((entity) => {
      const properties = {};
      const required = [];
      entity.fields.forEach((field) => {
        properties[field.name] = toOasFieldSchema(field);
        if (field.required) required.push(field.name);
      });
      const schemaName = toSchemaName(domain.name, entity.name);
      entitySchemaIndex[entity.id] = schemaName;
      schemas[schemaName] = {
        type: 'object',
        properties,
        required,
        'x-domain': domain.name,
        'x-entity': entity.name,
        'x-message-contracts': Array.isArray(entity?.meta?.contracts)
          ? entity.meta.contracts.map((contract, index) => normalizeContractInput(contract, index))
          : []
      };
      const composition = entity?.meta?.oasComposition || {};
      const mode = ['oneOf', 'allOf', 'anyOf'].includes(composition.mode) ? composition.mode : '';
      const refs = parseCommaSeparated(composition.refs || []);
      if (mode && refs.length) {
        schemas[schemaName][mode] = refs.map((ref) => ({ $ref: `#/components/schemas/${ref}` }));
      }
      const externalRefs = parseCommaSeparated(composition.externalRefs || []);
      if (externalRefs.length) {
        schemas[schemaName]['x-external-refs'] = externalRefs;
      }
      const discriminator = String(composition.discriminator || '').trim();
      if (discriminator) {
        const mapping = {};
        refs.forEach((refName) => {
          mapping[refName] = `#/components/schemas/${refName}`;
        });
        schemas[schemaName].discriminator = {
          propertyName: discriminator,
          mapping
        };
      }

      const domainPath = toPathToken(domain.name);
      const entityPath = toPathToken(entity.name);
      const collectionPath = `/${domainPath}/${entityPath}`;
      const itemPath = `${collectionPath}/{id}`;
      const idParam = [{
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      }];

      paths[collectionPath] = {
        get: {
          operationId: `list${schemaName}`,
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: `#/components/schemas/${schemaName}` }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: `create${schemaName}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${schemaName}` }
              }
            }
          },
          responses: {
            201: {
              description: 'Created',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${schemaName}` }
                }
              }
            }
          }
        }
      };

      paths[itemPath] = {
        get: {
          operationId: `get${schemaName}ById`,
          parameters: idParam,
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${schemaName}` }
                }
              }
            },
            404: { description: 'Not found' }
          }
        },
        patch: {
          operationId: `update${schemaName}`,
          parameters: idParam,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${schemaName}` }
              }
            }
          },
          responses: {
            200: {
              description: 'Updated',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${schemaName}` }
                }
              }
            },
            404: { description: 'Not found' }
          }
        },
        delete: {
          operationId: `delete${schemaName}`,
          parameters: idParam,
          responses: {
            204: { description: 'Deleted' },
            404: { description: 'Not found' }
          }
        }
      };
    });
  });

  return {
    openapi: '3.1.0',
    info: { title: 'Domain Designer Export', version: '1.0.0' },
    paths,
    components: { schemas },
    'x-message-contracts': state.domains.flatMap((domain) => (
      domain.entities.flatMap((entity) => (
        (Array.isArray(entity?.meta?.contracts) ? entity.meta.contracts : []).map((contract, index) => ({
          ...normalizeContractInput(contract, index),
          domain: domain.name,
          entity: entity.name
        }))
      ))
    )),
    'x-relations': state.relationships.map((relationship) => ({
      name: relationship.name,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      fromSchema: entitySchemaIndex[relationship.fromEntityId] || null,
      toSchema: entitySchemaIndex[relationship.toEntityId] || null,
      fromCardinality: relationship.fromCardinality,
      toCardinality: relationship.toCardinality
    }))
  };
}
