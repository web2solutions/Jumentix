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
 * shapes, same text — except the boilerplate bundle, which JUM-476 rewrote to
 * emit the hexagonal module layout (with file contents) via
 * `src/codegen/hexagonalCodegen.js`. For the same input the JSON.stringify
 * output of the other builders is byte-identical to the pre-refactor
 * exporters. The two timestamped documents
 * take an injectable `generatedAt`/`exportedAt` so parity is testable; the
 * defaults keep the pre-refactor `new Date().toISOString()` behaviour.
 */

import {
  getDefaultRbacPolicy,
  normalizeContractInput,
  normalizeRbacPolicyInput,
  parseCommaSeparated,
  SUITE_EXPORT_KIND,
  SUITE_EXPORT_VERSION
} from '../state/designerState.js';
import {
  entityLabel,
  getEntityRbacPolicy,
  oasFieldNameFlags,
  toOasFieldSchema,
  toPathToken,
  toSchemaName
} from '../model/modelQueries.js';
import { buildHexagonalBundle } from '../codegen/hexagonalCodegen.js';
import { buildAsyncApiTransportDocument } from './asyncApiExporters.js';
import { parsePackageDependency } from '../packages/packageVersioning.js';

/**
 * The default per-entity RBAC policy, captured once: `buildOasDocument`
 * compares each entity's normalised policy against it and only emits `x-rbac`
 * for policies that diverge — an absent extension normalises back to exactly
 * this policy on import (JUM-478).
 */
const DEFAULT_RBAC_POLICY = getDefaultRbacPolicy();

/**
 * `exportAsJson` payload: the full-suite document (JUM-547, Requirement 126
 * Contract 3). The pre-JUM-547 shape carried `{ domains, relationships, view }`
 * only — a four-tab design exported as one tab. The document now carries all
 * five tabs, schema-versioned (`kind` + `version`, the
 * boilerplate-bundle/domain-package convention), so import can tell a legacy
 * domain-only document (no `kind`/`version`) from the full-suite shape and
 * fail clearly on a document newer than the importer.
 *
 * `runtimeEnvironment` follows the decision recorded in Requirement 126: the
 * bundle carries the environment *selection* (`environment`, `fileName`) but
 * never `values` — those mirror real `.env` contents of the machine the
 * designer runs on (editable and read-only tiers; the never-exposed tier
 * never even enters state), and a bundle containing them could carry
 * configuration off the machine. Selections and `idCounter` stay out of the
 * document, as before.
 */
export function buildJsonExportDocument(state) {
  return {
    kind: SUITE_EXPORT_KIND,
    version: SUITE_EXPORT_VERSION,
    domains: state.domains,
    relationships: state.relationships,
    interfaces: Array.isArray(state.interfaces) ? state.interfaces : [],
    serviceConfiguration: state.serviceConfiguration,
    runtimeEnvironment: {
      environment: String(state.runtimeEnvironment?.environment || '').trim() || 'dev',
      fileName: String(state.runtimeEnvironment?.fileName || '').trim() || '.env.dev'
    },
    codeWorkspace: state.codeWorkspace || { files: {}, activePath: '' },
    deployments: Array.isArray(state.deployments) ? state.deployments : [],
    view: state.view
  };
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
  // Contract shapes come from the JUM-474/475 documents, never re-derived
  // from the model (JUM-476). The codegen module is also what the Code
  // Preview pane renders, so preview and bundle cannot drift apart.
  const bundle = buildHexagonalBundle(state, {
    oasDocument: buildOasDocument(state),
    // Both transports carry the same channel set (JUM-475); the websocket
    // document is the canonical event-channel source for the codegen.
    asyncApiDocument: buildAsyncApiTransportDocument(state, 'websocket')
  });
  const overlays = state?.codeWorkspace?.files || {};
  const applyWorkspaceOverlay = (file) => {
    const overlay = overlays[file.path];
    if (!overlay || !['edited', 'stale'].includes(overlay.state)) return file;
    return {
      ...file,
      content: String(overlay.content ?? file.content),
      workspaceState: overlay.state
    };
  };
  bundle.modules.forEach((module) => {
    Object.keys(module.files || {}).forEach((role) => {
      module.files[role] = applyWorkspaceOverlay(module.files[role]);
    });
    (module.entities || []).forEach((entity) => {
      Object.keys(entity.files || {}).forEach((role) => {
        entity.files[role] = applyWorkspaceOverlay(entity.files[role]);
      });
    });
  });
  return {
    kind: 'boilerplate-bundle',
    version: '2.0.0',
    generatedAt,
    modules: bundle.modules
  };
}

/** `exportAsPackage` payload (single-domain package). */
export function buildDomainPackageDocument(domain, exportedAt = new Date().toISOString()) {
  // JUM-492 (Requirement 126 Contract 3): the v2 document declares the
  // package identity — name, semantic version and dependency ranges — so the
  // import flow can resolve the dependency graph and classify conflicts.
  // The identity falls back to the domain name and 1.0.0 for a domain that
  // was never imported or stamped; the document stays additive over the v1
  // shape (kind/version/exportedAt/domain), which the importer still reads.
  const context = domain?.context || {};
  return {
    kind: 'domain-package',
    version: '2.0.0',
    exportedAt,
    package: {
      name: String(context.packageName || domain?.name || '').trim() || 'package',
      version: String(context.packageVersion || '').trim() || '1.0.0',
      dependencies: (Array.isArray(context.packageDependencies) ? context.packageDependencies : [])
        .map(parsePackageDependency)
        .filter(Boolean)
    },
    domain
  };
}

/**
 * `exportAsOas` payload (OpenAPI 3.1.0 with x- extensions).
 *
 * JUM-474 made the document compliant with Requirement 036 and the
 * route-resolution check (`ci-cd/check-oas-route-resolution.js`), following
 * the conventions `spec/1.0.0.yml` already uses:
 *
 * - Every operation carries an `operationId` on the canonical verb scheme
 *   (`getAll*` / `create*` / `get*ById` / `update*` / `delete*`), qualified by
 *   the schema name so ids stay unique across domains.
 * - Request bodies reference `RequestCreate<Schema>` / `RequestUpdate<Schema>`
 *   port input objects via `$ref`; 2xx responses reference the entity schema,
 *   its `<Schema>ArrayOf` wrapper, or `ResourceDeleteResponse` — never an
 *   inline schema. Every referenced schema carries a non-empty description.
 * - Port input/output wrappers are marked `'x-port-object': true` so the OAS
 *   importer skips them (they are derived from the entity schemas, not model
 *   content — re-importing them would fabricate phantom entities).
 * - Error responses use the canonical `ERROR-CONTRACTS-AND-RESPONSES` status
 *   codes and descriptions (400/401/403/404/409).
 * - Composition (`oneOf`/`allOf`/`anyOf`/`discriminator`) serialises as
 *   native OAS 3.1 constructs.
 * - JUM-478 (lossless round-trip): the entity meta OAS cannot express crosses
 *   as agreed extensions the importer normalises back — `x-aggregate-root`,
 *   `x-invariants`, `x-rbac` (only when the policy diverges from the default),
 *   `x-fieldless` (empty field set survives instead of gaining the importer's
 *   default fields) and per-field `x-field-flags` (only when PK/FK/unique
 *   diverge from the importer's name heuristic). `x-relations` entries carry
 *   schema names, not model ids, so relationships survive the crossing without
 *   leaking recomputed ids into the document.
 */
export function buildOasDocument(state) {
  const schemas = {};
  const paths = {};
  const entitySchemaIndex = {};
  let hasEntities = false;

  const jsonContent = (schema) => ({ 'application/json': { schema } });

  state.domains.forEach((domain) => {
    domain.entities.forEach((entity) => {
      hasEntities = true;
      const properties = {};
      const required = [];
      entity.fields.forEach((field) => {
        const fieldSchema = toOasFieldSchema(field);
        // JUM-478: PK/FK/unique are designer flags OAS cannot express. Fields
        // that match the importer's name heuristic cross silently; a divergent
        // field carries its flags explicitly so the crossing stays lossless.
        const flags = { pk: Boolean(field.pk), fk: Boolean(field.fk), unique: Boolean(field.unique) };
        const heuristic = oasFieldNameFlags(field.name);
        if (flags.pk !== heuristic.pk || flags.fk !== heuristic.fk || flags.unique !== heuristic.unique) {
          fieldSchema['x-field-flags'] = flags;
        }
        properties[field.name] = fieldSchema;
        if (field.required) required.push(field.name);
      });
      const schemaName = toSchemaName(domain.name, entity.name);
      entitySchemaIndex[entity.id] = schemaName;
      const entityRef = { $ref: `#/components/schemas/${schemaName}` };
      const entitySchema = {
        type: 'object',
        description: `Port output object for ${entity.name} resource.`,
        properties,
        required,
        'x-domain': domain.name,
        'x-entity': entity.name,
        'x-message-contracts': Array.isArray(entity?.meta?.contracts)
          ? entity.meta.contracts.map((contract, index) => normalizeContractInput(contract, index))
          : []
      };
      // JUM-478: the rest of `entity.meta` crosses as agreed extensions, so
      // the importer can normalise the full meta surface back (aggregate
      // declaration, invariants, RBAC policy, composition) instead of dropping
      // everything OAS cannot express natively.
      if (entity?.meta?.aggregateRoot === true) {
        entitySchema['x-aggregate-root'] = true;
      }
      const invariants = (Array.isArray(entity?.meta?.invariants) ? entity.meta.invariants : [])
        .map((invariant) => String(invariant).trim())
        .filter(Boolean);
      if (invariants.length) {
        entitySchema['x-invariants'] = invariants;
      }
      // The default policy is what the importer normalises an absent `x-rbac`
      // to, so only a policy that diverges from it needs carriage.
      const rbac = normalizeRbacPolicyInput(entity?.meta?.rbac);
      if (JSON.stringify(rbac) !== JSON.stringify(DEFAULT_RBAC_POLICY)) {
        entitySchema['x-rbac'] = rbac;
      }
      // A fieldless entity would otherwise come back with the importer's
      // default fields — the marker keeps the empty field set intact.
      if (!entity.fields.length) {
        entitySchema['x-fieldless'] = true;
      }
      const composition = entity?.meta?.oasComposition || {};
      const mode = ['oneOf', 'allOf', 'anyOf'].includes(composition.mode) ? composition.mode : '';
      const refs = parseCommaSeparated(composition.refs || []);
      if (mode && refs.length) {
        entitySchema[mode] = refs.map((ref) => ({ $ref: `#/components/schemas/${ref}` }));
      }
      const externalRefs = parseCommaSeparated(composition.externalRefs || []);
      if (externalRefs.length) {
        entitySchema['x-external-refs'] = externalRefs;
      }
      const discriminator = String(composition.discriminator || '').trim();
      if (discriminator) {
        const mapping = {};
        refs.forEach((refName) => {
          mapping[refName] = `#/components/schemas/${refName}`;
        });
        entitySchema.discriminator = {
          propertyName: discriminator,
          mapping
        };
      }
      schemas[schemaName] = entitySchema;

      // Port input objects (canonical `RequestCreate*` / `RequestUpdate*`
      // naming): creation requires every model-required field except the
      // server-managed primary key; update requires the primary key only.
      const pkFieldNames = entity.fields.filter((field) => field.pk).map((field) => field.name);
      schemas[`RequestCreate${schemaName}`] = {
        type: 'object',
        description: `Port input object for ${entity.name} creation endpoint.`,
        properties,
        required: required.filter((fieldName) => !pkFieldNames.includes(fieldName)),
        'x-port-object': true
      };
      schemas[`RequestUpdate${schemaName}`] = {
        type: 'object',
        description: `Port input object for ${entity.name} update endpoint.`,
        properties,
        required: pkFieldNames,
        'x-port-object': true
      };
      schemas[`${schemaName}ArrayOf`] = {
        type: 'array',
        description: `Port output array of ${entity.name} records.`,
        items: entityRef,
        'x-port-object': true
      };

      const domainPath = toPathToken(domain.name);
      const entityPath = toPathToken(entity.name);
      const collectionPath = `/${domainPath}/${entityPath}`;
      const itemPath = `${collectionPath}/{id}`;
      const idParam = [{
        name: 'id',
        in: 'path',
        description: `ID of ${entity.name}`,
        required: true,
        schema: { type: 'string' }
      }];

      paths[collectionPath] = {
        get: {
          operationId: `getAll${schemaName}`,
          responses: {
            200: {
              description: 'successful operation',
              content: jsonContent({ $ref: `#/components/schemas/${schemaName}ArrayOf` })
            },
            400: { description: 'Invalid request' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' }
          }
        },
        post: {
          operationId: `create${schemaName}`,
          requestBody: {
            description: `Create a new ${entity.name}`,
            content: jsonContent({ $ref: `#/components/schemas/RequestCreate${schemaName}` }),
            required: true
          },
          responses: {
            201: {
              description: `${entity.name} created successfully`,
              content: jsonContent(entityRef)
            },
            400: { description: 'Invalid request' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            409: { description: 'Conflict' }
          }
        }
      };

      paths[itemPath] = {
        get: {
          operationId: `get${schemaName}ById`,
          parameters: idParam,
          responses: {
            200: {
              description: 'successful operation',
              content: jsonContent(entityRef)
            },
            400: { description: 'Invalid ID supplied' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: `${entity.name} not found` }
          }
        },
        put: {
          operationId: `update${schemaName}`,
          parameters: idParam,
          requestBody: {
            description: `Update an existing ${entity.name}`,
            content: jsonContent({ $ref: `#/components/schemas/RequestUpdate${schemaName}` }),
            required: true
          },
          responses: {
            200: {
              description: 'successful operation',
              content: jsonContent(entityRef)
            },
            400: { description: 'Invalid ID supplied' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: `${entity.name} not found` },
            409: { description: 'Conflict' }
          }
        },
        delete: {
          operationId: `delete${schemaName}`,
          parameters: idParam,
          responses: {
            200: {
              description: 'successful operation',
              content: jsonContent({ $ref: '#/components/schemas/ResourceDeleteResponse' })
            },
            400: { description: 'Invalid ID supplied' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: `${entity.name} not found` }
          }
        }
      };
    });
  });

  if (hasEntities) {
    // The canonical shared delete port output object (`spec/1.0.0.yml`).
    schemas.ResourceDeleteResponse = {
      description: 'Port output object for delete operations.',
      required: ['data'],
      type: 'object',
      properties: {
        data: {
          type: 'boolean',
          default: false,
          description: 'Result of request to delete resource'
        }
      },
      'x-port-object': true
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Domain Designer Export',
      description: 'REST API designed with the Jumentix Domain Designer',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3000/api/1.0.0' }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' }
      }
    },
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
      // JUM-478: relationships cross by schema name, not by model id — the
      // importer recomputes entity ids, so carrying them would make every
      // re-export differ from its source and break the fixed point.
      name: relationship.name,
      fromSchema: entitySchemaIndex[relationship.fromEntityId] || null,
      toSchema: entitySchemaIndex[relationship.toEntityId] || null,
      fromCardinality: relationship.fromCardinality,
      toCardinality: relationship.toCardinality
    }))
  };
}
