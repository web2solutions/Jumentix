/**
 * hexagonalCodegen — the hexagonal code generator of the Service Management
 * designer (JUM-476).
 *
 * This module is the single source for both the boilerplate-bundle exporter
 * (`buildBoilerplateBundleDocument` in `src/exporters/designerExporters.js`)
 * and the designer's Code Preview pane (`generateCodePreview` in
 * `script.js`), so the preview can never drift from the emitted bundle.
 *
 * The emitted layout mirrors the fully-migrated Users module
 * (`apps/backend-template/src/modules/Users`, see
 * `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`):
 *
 *   src/modules/<Domain>/
 *     domain/Entity/I<Entity>.ts
 *     domain/Model/<Entity>.ts
 *     domain/security/<Entity>Rbac.ts
 *     application/ports/I<Entity>Repository.ts
 *     application/ports/I<Entity>UseCases.ts
 *     application/use-cases/<Entity>UseCases.ts
 *     adapters/in/http/controllers/<Entity>Controller.ts
 *     adapters/out/persistence/<Entity>DataRepository.ts
 *     composition/compose<Domain>Services.ts
 *     events/contracts/<Domain>EventChannels.ts   (only when contracts exist)
 *
 * Contract shapes are consumed from the JUM-474/475 contract documents, not
 * re-derived from the model: field types come from the OAS 3.1 component
 * schemas, HTTP routes from the OAS paths/operationIds, and event channels
 * from the AsyncAPI 3.0 channels. The caller builds both documents with the
 * existing exporters and passes them in, which keeps this module free of any
 * import cycle with the exporters.
 *
 * Generated files are self-contained TypeScript (relative imports only, no
 * `@src/` aliases) and respect the hexagonal dependency direction — domain
 * imports nothing outward, application depends on domain, adapters depend on
 * application ports, and only the composition root wires adapters to ports —
 * so the output passes `ci-cd/check-hexagonal-boundaries.js` and compiles
 * under `tsc --strict`. Both properties are pinned by
 * `apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts`.
 */

import { getEntityRbacPolicy, toSchemaName } from '../model/modelQueries.js';

const MODULES_ROOT = 'src/modules';

/** Role order of the per-entity file set (emission and preview order). */
export const ENTITY_FILE_ROLES = [
  'entityInterface',
  'model',
  'security',
  'repositoryPort',
  'useCasesPort',
  'useCases',
  'persistenceAdapter',
  'controller'
];

/** Role order of the per-domain file set. */
export const DOMAIN_FILE_ROLES = ['composition', 'eventChannels'];

/**
 * PascalCase identifier token for generated types. Unlike
 * `toSchemaName('', name)` — whose empty-domain fallback leaks a `Domain_`
 * prefix — this never invents a namespace segment.
 */
export function toTypeToken(value, fallback) {
  const token = String(value || '')
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return token || fallback;
}

function toInstanceToken(value, fallback) {
  const token = toTypeToken(value, fallback);
  return token.charAt(0).toLowerCase() + token.slice(1);
}

/** Object-literal/property key: bare when a valid identifier, quoted otherwise. */
function toPropertyKey(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** Map an OAS schema (from the JUM-474 export) to a TypeScript type. */
export function tsTypeFromOasSchema(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  let base;
  if (schema.type === 'integer' || schema.type === 'number') {
    base = 'number';
  } else if (schema.type === 'boolean') {
    base = 'boolean';
  } else if (schema.type === 'array') {
    base = `${tsTypeFromOasSchema(schema.items)}[]`;
  } else if (schema.type === 'object') {
    base = 'Record<string, unknown>';
  } else if (schema.format === 'date' || schema.format === 'date-time') {
    base = 'Date';
  } else {
    base = 'string';
  }
  return schema.nullable ? `${base} | null` : base;
}

/** Find the OAS component schema the JUM-474 export produced for an entity. */
function findEntitySchema(oasDocument, domainName, entityName) {
  const schemas = (oasDocument && oasDocument.components && oasDocument.components.schemas) || {};
  return Object.values(schemas).find(
    (schema) => schema['x-domain'] === domainName && schema['x-entity'] === entityName
  ) || null;
}

/** Flatten the OAS paths of the JUM-474 export into method/path/operationId rows. */
function flattenOasOperations(oasDocument) {
  const paths = (oasDocument && oasDocument.paths) || {};
  const operations = [];
  Object.keys(paths).forEach((pathName) => {
    Object.keys(paths[pathName]).forEach((method) => {
      operations.push({
        method: method.toUpperCase(),
        path: pathName,
        operationId: paths[pathName][method].operationId
      });
    });
  });
  return operations;
}

/**
 * The entity's HTTP route table, consumed from the OAS export by matching the
 * five canonical CRUD operationIds — never re-derived from the model.
 */
function findEntityRoutes(oasDocument, schemaName) {
  const operations = flattenOasOperations(oasDocument);
  const expected = {
    list: `list${schemaName}`,
    create: `create${schemaName}`,
    getById: `get${schemaName}ById`,
    update: `update${schemaName}`,
    delete: `delete${schemaName}`
  };
  const routes = [];
  Object.keys(expected).forEach((action) => {
    const hit = operations.find((operation) => operation.operationId === expected[action]);
    if (hit) {
      routes.push({
        action, method: hit.method, path: hit.path, operationId: hit.operationId
      });
    }
  });
  return routes;
}

/**
 * The domain's event channels: OAS `x-message-contracts` rows (which carry
 * domain/entity attribution) resolved against the AsyncAPI export's channel
 * buckets by operationId, so channel names and publish/subscribe direction
 * come from the JUM-475 contract rather than from re-walking the model.
 */
function findDomainEventChannels(oasDocument, asyncApiDocument, domainName) {
  const contracts = ((oasDocument && oasDocument['x-message-contracts']) || [])
    .filter((contract) => contract.domain === domainName);
  const channels = (asyncApiDocument && asyncApiDocument.channels) || {};
  const events = [];
  contracts.forEach((contract) => {
    Object.keys(channels).forEach((channelName) => {
      ['publish', 'subscribe'].forEach((operation) => {
        const bucket = channels[channelName][operation];
        if (bucket && bucket.operationId === `${contract.type}_${toSchemaName(contract.domain, contract.entity)}_${contract.name}`) {
          events.push({
            name: contract.name,
            type: contract.type,
            channel: channelName,
            operation,
            operationId: bucket.operationId
          });
        }
      });
    });
  });
  return events;
}

function entityFiles(domain, entity, oasDocument) {
  const domainToken = toTypeToken(domain.name, 'Domain');
  const entityToken = toTypeToken(entity.name, 'Entity');
  const schemaName = toSchemaName(domain.name, entity.name);
  const schema = findEntitySchema(oasDocument, domain.name, entity.name);
  const properties = (schema && schema.properties) || {};
  const required = (schema && schema.required) || [];
  const routes = findEntityRoutes(oasDocument, schemaName);
  const rbac = getEntityRbacPolicy(entity);
  const modulePath = `${MODULES_ROOT}/${domainToken}`;

  const fieldDeclarations = Object.keys(properties).map((fieldName) => {
    const optional = required.includes(fieldName) ? '' : '?';
    return `  ${toPropertyKey(fieldName)}${optional}: ${tsTypeFromOasSchema(properties[fieldName])};`;
  });
  const modelDeclarations = Object.keys(properties).map((fieldName) => {
    const optional = required.includes(fieldName) ? '' : '?';
    const definite = optional ? '' : '!';
    return `  public ${toPropertyKey(fieldName)}${optional}${definite}: ${tsTypeFromOasSchema(properties[fieldName])};`;
  });

  const entityInterface = [
    '/**',
    ` * Entity contract for ${domainToken}/${entityToken}.`,
    ` * Mirrors modules/Users/domain/Entity/IUser.ts; the shape is consumed`,
    ' * from the designer OAS 3.1 export, not re-derived from the model.',
    ' */',
    `export interface I${entityToken} {`,
    ...fieldDeclarations,
    '}',
    ''
  ].join('\n');

  const model = [
    `import type { I${entityToken} } from '../Entity/I${entityToken}';`,
    '',
    '/**',
    ` * Domain model for ${entityToken} — mirrors modules/Users/domain/Model/User.ts.`,
    ' */',
    `export class ${entityToken} implements I${entityToken} {`,
    ...modelDeclarations,
    '',
    `  public constructor(data: I${entityToken}) {`,
    '    Object.assign(this, data);',
    '  }',
    '}',
    ''
  ].join('\n');

  const rbacLines = ['list', 'getById', 'create', 'update', 'delete'].map((action) => {
    const rule = rbac[action] || { roles: [], tenantScoped: true };
    const roles = (rule.roles || []).map((role) => JSON.stringify(role)).join(', ');
    return `  ${action}: { roles: [${roles}], tenantScoped: ${Boolean(rule.tenantScoped)} }`;
  });
  const security = [
    '/**',
    ` * RBAC policy for ${entityToken} — mirrors modules/Users/domain/security/Rbac.ts.`,
    ' * Roles per action plus the tenant-scope flag the HTTP adapter enforces.',
    ' */',
    `export const ${entityToken}RBAC_ACTIONS = ['list', 'getById', 'create', 'update', 'delete'] as const;`,
    '',
    `export type ${entityToken}RbacAction = (typeof ${entityToken}RBAC_ACTIONS)[number];`,
    '',
    `export const ${entityToken}RBAC_POLICY: Record<`,
    `  ${entityToken}RbacAction,`,
    '  { roles: string[]; tenantScoped: boolean }',
    '> = {',
    ...rbacLines.map((line, index) => (index < rbacLines.length - 1 ? `${line},` : line)),
    '};',
    ''
  ].join('\n');

  const repositoryPort = [
    `import type { I${entityToken} } from '../../domain/Entity/I${entityToken}';`,
    '',
    '/**',
    ` * Outbound persistence port for ${entityToken}.`,
    ' * The application layer owns this contract; adapters/out implements it.',
    ' */',
    `export interface I${entityToken}Repository {`,
    `  create(data: I${entityToken}): Promise<I${entityToken}>;`,
    `  getById(id: string): Promise<I${entityToken} | null>;`,
    `  update(id: string, data: Partial<I${entityToken}>): Promise<I${entityToken} | null>;`,
    '  delete(id: string): Promise<boolean>;',
    `  list(): Promise<I${entityToken}[]>;`,
    '}',
    ''
  ].join('\n');

  const useCasesPort = [
    `import type { I${entityToken} } from '../../domain/Entity/I${entityToken}';`,
    '',
    '/**',
    ` * Inbound use-case contract for ${entityToken} — mirrors`,
    ' * modules/Users/application/ports/IUserUseCases.ts. HTTP-in adapters',
    ' * depend on this port, never on the use-case implementation.',
    ' */',
    `export interface I${entityToken}UseCases {`,
    `  create(data: I${entityToken}): Promise<I${entityToken}>;`,
    `  getById(id: string): Promise<I${entityToken} | null>;`,
    `  update(id: string, data: Partial<I${entityToken}>): Promise<I${entityToken} | null>;`,
    '  delete(id: string): Promise<boolean>;',
    `  list(): Promise<I${entityToken}[]>;`,
    '}',
    ''
  ].join('\n');

  const useCases = [
    `import type { I${entityToken} } from '../../domain/Entity/I${entityToken}';`,
    `import type { I${entityToken}Repository } from '../ports/I${entityToken}Repository';`,
    `import type { I${entityToken}UseCases } from '../ports/I${entityToken}UseCases';`,
    '',
    '/**',
    ` * Use cases for ${entityToken} — mirrors`,
    ' * modules/Users/application/use-cases/UserUseCases.ts. Resolved through',
    ' * the repository port; wired by the composition root.',
    ' */',
    `export class ${entityToken}UseCases implements I${entityToken}UseCases {`,
    `  private readonly repository: I${entityToken}Repository;`,
    '',
    `  private constructor(repository: I${entityToken}Repository) {`,
    '    this.repository = repository;',
    '  }',
    '',
    `  public static compile(repository: I${entityToken}Repository): ${entityToken}UseCases {`,
    `    return new ${entityToken}UseCases(repository);`,
    '  }',
    '',
    `  public create(data: I${entityToken}): Promise<I${entityToken}> {`,
    '    return this.repository.create(data);',
    '  }',
    '',
    `  public getById(id: string): Promise<I${entityToken} | null> {`,
    '    return this.repository.getById(id);',
    '  }',
    '',
    `  public update(id: string, data: Partial<I${entityToken}>): Promise<I${entityToken} | null> {`,
    '    return this.repository.update(id, data);',
    '  }',
    '',
    '  public delete(id: string): Promise<boolean> {',
    '    return this.repository.delete(id);',
    '  }',
    '',
    `  public list(): Promise<I${entityToken}[]> {`,
    '    return this.repository.list();',
    '  }',
    '}',
    ''
  ].join('\n');

  const persistenceAdapter = [
    `import type { I${entityToken} } from '../../../domain/Entity/I${entityToken}';`,
    `import type { I${entityToken}Repository } from '../../../application/ports/I${entityToken}Repository';`,
    '',
    '/**',
    ` * In-memory outbound persistence adapter for ${entityToken} — mirrors`,
    ' * modules/Users/adapters/out/persistence/UserDataRepository.ts. Swap the',
    ' * Map for the real store client when wiring the module into a service.',
    ' */',
    `export class ${entityToken}DataRepository implements I${entityToken}Repository {`,
    `  private readonly records = new Map<string, I${entityToken}>();`,
    '',
    '  private constructor() {}',
    '',
    `  public static compile(): ${entityToken}DataRepository {`,
    `    return new ${entityToken}DataRepository();`,
    '  }',
    '',
    `  public async create(data: I${entityToken}): Promise<I${entityToken}> {`,
    '    this.records.set(JSON.stringify(data), data);',
    '    return data;',
    '  }',
    '',
    `  public async getById(id: string): Promise<I${entityToken} | null> {`,
    '    return this.records.get(id) ?? null;',
    '  }',
    '',
    `  public async update(id: string, data: Partial<I${entityToken}>): Promise<I${entityToken} | null> {`,
    '    const current = this.records.get(id);',
    '    if (!current) return null;',
    '    const next = { ...current, ...data };',
    '    this.records.set(id, next);',
    '    return next;',
    '  }',
    '',
    '  public async delete(id: string): Promise<boolean> {',
    '    return this.records.delete(id);',
    '  }',
    '',
    `  public async list(): Promise<I${entityToken}[]> {`,
    '    return Array.from(this.records.values());',
    '  }',
    '}',
    ''
  ].join('\n');

  const routeLines = routes.map((route) => (
    `    { action: '${route.action}', method: '${route.method}', path: '${route.path}', operationId: '${route.operationId}' }`
  ));
  const controller = [
    `import type { I${entityToken} } from '../../../../domain/Entity/I${entityToken}';`,
    `import type { I${entityToken}UseCases } from '../../../../application/ports/I${entityToken}UseCases';`,
    '',
    '/**',
    ` * HTTP-in adapter for ${entityToken} — mirrors`,
    ' * modules/Users/adapters/in/http/controllers/UserController.ts. The route',
    ' * table is consumed from the designer OAS 3.1 export (operationIds), so',
    ' * regeneration tracks the contract instead of re-deriving it.',
    ' */',
    `export class ${entityToken}Controller {`,
    '  public static readonly routes = [',
    ...routeLines.map((line, index) => (index < routeLines.length - 1 ? `${line},` : line)),
    '  ] as const;',
    '',
    `  private readonly useCases: I${entityToken}UseCases;`,
    '',
    `  private constructor(useCases: I${entityToken}UseCases) {`,
    '    this.useCases = useCases;',
    '  }',
    '',
    `  public static compile(useCases: I${entityToken}UseCases): ${entityToken}Controller {`,
    `    return new ${entityToken}Controller(useCases);`,
    '  }',
    '',
    `  public async list(): Promise<I${entityToken}[]> {`,
    '    return this.useCases.list();',
    '  }',
    '',
    `  public async create(data: I${entityToken}): Promise<I${entityToken}> {`,
    '    return this.useCases.create(data);',
    '  }',
    '',
    `  public async getById(id: string): Promise<I${entityToken} | null> {`,
    '    return this.useCases.getById(id);',
    '  }',
    '',
    `  public async update(id: string, data: Partial<I${entityToken}>): Promise<I${entityToken} | null> {`,
    '    return this.useCases.update(id, data);',
    '  }',
    '',
    '  public async delete(id: string): Promise<boolean> {',
    '    return this.useCases.delete(id);',
    '  }',
    '}',
    ''
  ].join('\n');

  return {
    entity: entity.name,
    files: {
      entityInterface: {
        path: `${modulePath}/domain/Entity/I${entityToken}.ts`,
        content: entityInterface
      },
      model: {
        path: `${modulePath}/domain/Model/${entityToken}.ts`,
        content: model
      },
      security: {
        path: `${modulePath}/domain/security/${entityToken}Rbac.ts`,
        content: security
      },
      repositoryPort: {
        path: `${modulePath}/application/ports/I${entityToken}Repository.ts`,
        content: repositoryPort
      },
      useCasesPort: {
        path: `${modulePath}/application/ports/I${entityToken}UseCases.ts`,
        content: useCasesPort
      },
      useCases: {
        path: `${modulePath}/application/use-cases/${entityToken}UseCases.ts`,
        content: useCases
      },
      persistenceAdapter: {
        path: `${modulePath}/adapters/out/persistence/${entityToken}DataRepository.ts`,
        content: persistenceAdapter
      },
      controller: {
        path: `${modulePath}/adapters/in/http/controllers/${entityToken}Controller.ts`,
        content: controller
      }
    }
  };
}

function compositionFile(domain, entityModules) {
  const domainToken = toTypeToken(domain.name, 'Domain');
  const modulePath = `${MODULES_ROOT}/${domainToken}`;
  const imports = [];
  entityModules.forEach(({ entityToken, instanceToken }) => {
    imports.push(`import { ${entityToken}DataRepository } from '../adapters/out/persistence/${entityToken}DataRepository';`);
    imports.push(`import { ${entityToken}UseCases } from '../application/use-cases/${entityToken}UseCases';`);
    imports.push(`import { ${entityToken}Controller } from '../adapters/in/http/controllers/${entityToken}Controller';`);
    imports.push(`import type { I${entityToken}Repository } from '../application/ports/I${entityToken}Repository';`);
    imports.push(`import type { I${entityToken}UseCases } from '../application/ports/I${entityToken}UseCases';`);
  });
  const compositionFields = entityModules.map(({ entityToken, instanceToken }) => (
    `  ${instanceToken}Repository: I${entityToken}Repository;\n`
    + `  ${instanceToken}UseCases: I${entityToken}UseCases;\n`
    + `  ${instanceToken}Controller: ${entityToken}Controller;`
  ));
  const wiring = entityModules.map(({ entityToken, instanceToken }) => (
    `  const ${instanceToken}Repository = ${entityToken}DataRepository.compile();\n`
    + `  const ${instanceToken}UseCases = ${entityToken}UseCases.compile(${instanceToken}Repository);\n`
    + `  const ${instanceToken}Controller = ${entityToken}Controller.compile(${instanceToken}UseCases);`
  ));
  const returns = entityModules.flatMap(({ instanceToken }) => [
    `    ${instanceToken}Repository,`,
    `    ${instanceToken}UseCases,`,
    `    ${instanceToken}Controller,`
  ]);
  // Drop the trailing comma on the last return line.
  if (returns.length) {
    returns[returns.length - 1] = returns[returns.length - 1].replace(/,$/, '');
  }
  const content = [
    ...imports,
    '',
    '/**',
    ` * Composition root for the ${domainToken} module — mirrors`,
    ' * modules/Users/composition/composeUsersAuthServices.ts: outbound adapters',
    ' * are built first, use cases resolve them through the application ports,',
    ' * and HTTP controllers receive the use-case contracts. This file is the',
    ' * only place where implementations are wired to ports.',
    ' */',
    `export interface I${domainToken}Composition {`,
    ...compositionFields,
    '}',
    '',
    `export const compose${domainToken}Services = (): I${domainToken}Composition => {`,
    ...wiring,
    '  return {',
    ...returns,
    '  };',
    '};',
    ''
  ].join('\n');
  return {
    path: `${modulePath}/composition/compose${domainToken}Services.ts`,
    content
  };
}

function eventChannelsFile(domain, events) {
  const domainToken = toTypeToken(domain.name, 'Domain');
  const modulePath = `${MODULES_ROOT}/${domainToken}`;
  const lines = events.map((event) => (
    '    {'
    + ` name: ${JSON.stringify(event.name)},`
    + ` type: ${JSON.stringify(event.type)},`
    + ` channel: ${JSON.stringify(event.channel)},`
    + ` operation: '${event.operation}',`
    + ` operationId: '${event.operationId}'`
    + ' }'
  ));
  const content = [
    '/**',
    ` * Message contract channels for the ${domainToken} module — consumed from`,
    ' * the designer AsyncAPI 3.0 export (channel names and publish/subscribe',
    ' * direction), so regeneration tracks the contract instead of re-deriving',
    ' * it. Mirrors modules/Users/events/contracts/IUserEventListeners.ts.',
    ' */',
    `export const ${domainToken}EventChannels = [`,
    ...lines.map((line, index) => (index < lines.length - 1 ? `${line},` : line)),
    '] as const;',
    '',
    `export type ${domainToken}EventChannel = (typeof ${domainToken}EventChannels)[number]['channel'];`,
    ''
  ].join('\n');
  return {
    path: `${modulePath}/events/contracts/${domainToken}EventChannels.ts`,
    content
  };
}

/**
 * Build the hexagonal module set for a designer state. Pure: same inputs,
 * same output. `contracts.oasDocument` and `contracts.asyncApiDocument` are
 * the JUM-474/475 contract documents, built by the caller with
 * `buildOasDocument(state)` / `buildAsyncApiDocument(state)`.
 *
 * Returns `{ modules }` where each module is one domain:
 * `{ module, path, files: { composition, eventChannels? }, entities: [...] }`
 * and every file is `{ path, content }`.
 */
export function buildHexagonalBundle(state, contracts = {}) {
  const oasDocument = contracts.oasDocument || null;
  const asyncApiDocument = contracts.asyncApiDocument || null;
  const modules = (state.domains || []).map((domain) => {
    const domainToken = toTypeToken(domain.name, 'Domain');
    const entities = (domain.entities || []).map((entity) => entityFiles(domain, entity, oasDocument));
    const entityModules = entities.map(({ entity }) => ({
      entityToken: toTypeToken(entity, 'Entity'),
      instanceToken: toInstanceToken(entity, 'entity')
    }));
    const files = {
      composition: compositionFile(domain, entityModules)
    };
    const events = findDomainEventChannels(oasDocument, asyncApiDocument, domain.name);
    if (events.length) {
      files.eventChannels = eventChannelsFile(domain, events);
    }
    return {
      module: domain.name,
      path: `${MODULES_ROOT}/${domainToken}`,
      files,
      entities
    };
  });
  return { modules };
}

/** Flatten a built bundle into an ordered `{ path, content }` file list. */
export function flattenBundleFiles(bundle) {
  const files = [];
  bundle.modules.forEach((module) => {
    DOMAIN_FILE_ROLES.forEach((role) => {
      if (module.files[role]) files.push(module.files[role]);
    });
    module.entities.forEach((entity) => {
      ENTITY_FILE_ROLES.forEach((role) => {
        files.push(entity.files[role]);
      });
    });
  });
  return files;
}

/**
 * Render a built bundle as the Code Preview text: a tree of the emitted
 * layout followed by every file's content, in emission order. The preview
 * pane renders exactly what the bundle export emits — same builder, same
 * structure.
 */
export function renderBundlePreview(bundle) {
  const files = flattenBundleFiles(bundle);
  if (!files.length) return '';
  const header = [
    '// Hexagonal boilerplate layout (matches the boilerplate bundle export)',
    ...bundle.modules.map((module) => {
      const entityNames = module.entities.map((entity) => entity.entity).join(', ');
      return `// ${module.path}/ — ${entityNames}`;
    })
  ].join('\n');
  const chunks = files.map((file) => `/* ${file.path} */\n${file.content.trimEnd()}`);
  return `${header}\n\n${chunks.join('\n\n/* ---------------------------------------- */\n\n')}`;
}
