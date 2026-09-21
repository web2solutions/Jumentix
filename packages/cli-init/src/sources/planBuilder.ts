/* eslint-disable no-continue */
import {
  ALLOWED_DB,
  ALLOWED_HTTP,
  ALLOWED_MODES,
  ALLOWED_REALTIME,
  type DbChoice,
  type GenerationMode,
  type GenerationPlan,
  type HttpInterface,
  type PlanDomain,
  type PlanEntity,
  type PlanService,
  type RealtimeInterface,
  SourceResolutionError
} from './types';
import { SOURCE_MESSAGES } from './messages';

export type InterfaceDefaults = {
  http: HttpInterface;
  realtime: RealtimeInterface;
  db: DbChoice;
  mode?: string;
  frontend?: boolean;
  offline?: boolean;
};

type DesignerCore = typeof import('@jumentix/designer-core');

let designerCorePromise: Promise<DesignerCore> | undefined;

export async function loadDesignerCore(): Promise<DesignerCore> {
  if (!designerCorePromise) {
    designerCorePromise = import('@jumentix/designer-core');
  }
  return designerCorePromise;
}

export function parseHttp(raw: string | undefined, fallback: HttpInterface = 'express'): HttpInterface {
  const value = (raw || fallback).toLowerCase() as HttpInterface;
  if (!ALLOWED_HTTP.includes(value)) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.UNSUPPORTED_INTERFACE('defaults', 'http', String(raw))
    );
  }
  return value;
}

export function parseRealtime(
  raw: string | undefined,
  fallback: RealtimeInterface = 'none'
): RealtimeInterface {
  const value = (raw || fallback).toLowerCase() as RealtimeInterface;
  if (!ALLOWED_REALTIME.includes(value)) {
    throw new SourceResolutionError(
      SOURCE_MESSAGES.UNSUPPORTED_INTERFACE('defaults', 'realtime', String(raw))
    );
  }
  return value;
}

export function parseDb(raw: string | undefined, fallback: DbChoice = 'sqlite'): DbChoice {
  const value = (raw || fallback).toLowerCase() as DbChoice;
  if (!ALLOWED_DB.includes(value)) {
    throw new SourceResolutionError(
      `Source resolution failed: unsupported --db="${raw}".`
    );
  }
  return value;
}

export function inferMode(
  serviceCount: number,
  requested: string | undefined,
  frontend?: boolean
): GenerationMode {
  if (requested) {
    const mode = requested.toLowerCase() as GenerationMode;
    if (!ALLOWED_MODES.includes(mode)) {
      throw new SourceResolutionError(SOURCE_MESSAGES.UNSUPPORTED_MODE(requested));
    }
    return mode;
  }
  if (frontend) return 'hybrid';
  return serviceCount <= 1 ? 'monolith' : 'services';
}

function isPortObjectSchema(schemaKey: string, schemaValue: Record<string, unknown>): boolean {
  if (schemaValue['x-port-object'] === true) return true;
  if (/^Request(Create|Update)/.test(schemaKey)) return true;
  if (/^Response/.test(schemaKey)) return true;
  return false;
}

function primaryKeyFromSchema(
  schemaValue: Record<string, unknown>,
  fields: Array<{ name: string; pk?: boolean }>
): string {
  const explicit = schemaValue['x-primary-key'];
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const pkField = fields.find((field) => field.pk);
  if (pkField) return pkField.name;
  const props = schemaValue.properties && typeof schemaValue.properties === 'object'
    ? schemaValue.properties as Record<string, unknown>
    : {};
  if (props.id) return 'id';
  return '';
}

function relationsFromSchema(
  entityName: string,
  schemaValue: Record<string, unknown>
): PlanEntity['relations'] {
  const relations: PlanEntity['relations'] = [];
  const props = schemaValue.properties && typeof schemaValue.properties === 'object'
    ? schemaValue.properties as Record<string, Record<string, unknown>>
    : {};
  for (const [fieldName, fieldSchema] of Object.entries(props)) {
    const rel = fieldSchema?.['x-relation'];
    if (!rel || typeof rel !== 'object' || Array.isArray(rel)) continue;
    const target = String((rel as { entity?: string }).entity || '').trim();
    if (!target) continue;
    relations.push({
      name: `${entityName}.${fieldName}`,
      entity: target,
      match: String((rel as { match?: string }).match || '').trim() || undefined,
      display: String((rel as { display?: string }).display || '').trim() || undefined,
      kind: String((rel as { kind?: string }).kind || '').trim() || undefined,
      field: fieldName
    });
  }
  return relations;
}

function operationsForEntity(
  oas: Record<string, unknown>,
  entityName: string,
  schemaKey: string
): PlanEntity['operations'] {
  const operations: PlanEntity['operations'] = [];
  const paths = (oas.paths && typeof oas.paths === 'object')
    ? oas.paths as Record<string, Record<string, Record<string, unknown>>>
    : {};
  const needle = `#/components/schemas/${schemaKey}`;
  for (const [pathKey, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!operation || typeof operation !== 'object') continue;
      const blob = JSON.stringify(operation);
      const tagMatch = Array.isArray(operation.tags)
        && operation.tags.some((tag) => String(tag).toLowerCase() === entityName.toLowerCase());
      if (!blob.includes(needle) && !tagMatch) continue;
      operations.push({
        operationId: String(operation.operationId || `${method}_${pathKey}`),
        method: method.toUpperCase(),
        path: pathKey,
        summary: typeof operation.summary === 'string' ? operation.summary : undefined
      });
    }
  }
  return operations;
}

function schemaKeyForEntity(
  schemas: Record<string, Record<string, unknown>>,
  entityName: string,
  domainName?: string
): string | undefined {
  for (const [key, value] of Object.entries(schemas)) {
    if (isPortObjectSchema(key, value)) continue;
    const xEntity = String(value['x-entity'] || '').trim();
    const xDomain = String(value['x-domain'] || '').trim();
    if (xEntity === entityName && (!domainName || !xDomain || xDomain === domainName)) {
      return key;
    }
  }
  if (schemas[entityName] && !isPortObjectSchema(entityName, schemas[entityName])) {
    return entityName;
  }
  return undefined;
}

/**
 * Build a GenerationPlan from a parsed OAS document (+ optional designer domain model).
 */
export async function buildPlanFromOasDocument(
  oas: Record<string, unknown>,
  defaults: InterfaceDefaults,
  imported?: {
    domains: Array<{
      id: string;
      name: string;
      entities: Array<{
        id: string;
        name: string;
        fields: Array<{ name: string; pk?: boolean }>;
      }>;
    }>;
    architecture?: {
      services: Array<{
        id: string;
        kind: string;
        url?: string;
        domains: string[];
      }>;
    };
  }
): Promise<GenerationPlan> {
  const { filterOasDocumentForService, buildDomainsFromOas } = await loadDesignerCore();
  const openapi = String(oas.openapi || '');
  if (!openapi.startsWith('3.') || !oas.components || typeof oas.components !== 'object') {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_OAS);
  }

  type ImportedModel = {
    domains: Array<{
      id: string;
      name: string;
      entities: Array<{
        id: string;
        name: string;
        fields: Array<{ name: string; pk?: boolean }>;
      }>;
    }>;
    architecture?: {
      services: Array<{
        id: string;
        kind: string;
        url?: string;
        domains: string[];
      }>;
    };
  };

  const fromImporter: ImportedModel = imported || (() => {
    const result = buildDomainsFromOas(oas) as {
      ok: boolean;
      domains?: ImportedModel['domains'];
      architecture?: ImportedModel['architecture'];
      reason?: string;
    };
    if (!result.ok || !result.domains) {
      throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_OAS);
    }
    return {
      domains: result.domains,
      architecture: result.architecture
    };
  })();

  type SchemaMap = Record<string, Record<string, unknown>>;
  const components = oas.components as { schemas?: SchemaMap };
  const schemas: SchemaMap = components.schemas || {};

  const domains: PlanDomain[] = fromImporter.domains.map((domain) => {
    const entities: PlanEntity[] = domain.entities.map((entity) => {
      const schemaKey = schemaKeyForEntity(schemas, entity.name, domain.name) || entity.name;
      const schemaValue = schemas[schemaKey] || {
        type: 'object',
        'x-entity': entity.name,
        'x-domain': domain.name
      };
      const primaryKey = primaryKeyFromSchema(schemaValue, entity.fields || []);
      return {
        name: entity.name,
        schema: schemaValue,
        primaryKey,
        relations: relationsFromSchema(entity.name, schemaValue),
        operations: operationsForEntity(oas, entity.name, schemaKey)
      };
    });
    return {
      id: domain.id,
      name: domain.name,
      entities
    };
  });

  const architectureServices = fromImporter.architecture?.services || [];
  let services: PlanService[];
  if (architectureServices.length) {
    services = architectureServices.map((service) => ({
      id: service.id,
      kind: service.kind === 'core' ? 'core' : 'domain',
      url: service.url,
      domains: Array.isArray(service.domains) ? [...service.domains] : [],
      interfaces: {
        http: defaults.http,
        realtime: defaults.realtime
      },
      db: defaults.db
    }));
  } else {
    services = [{
      id: 'core',
      kind: 'core',
      url: 'http://localhost:3000/api/1.0.0',
      domains: domains.map((domain) => domain.id),
      interfaces: { http: defaults.http, realtime: defaults.realtime },
      db: defaults.db
    }];
  }

  if (services.length === 1 && services[0].domains.length === 0) {
    services[0].domains = domains.map((domain) => domain.id);
  }

  const mode = inferMode(services.length, defaults.mode, defaults.frontend);
  const oasPerService: Record<string, Record<string, unknown>> = {};
  for (const service of services) {
    const filtered = filterOasDocumentForService(oas, service.id);
    oasPerService[service.id] = filtered as Record<string, unknown>;
  }
  if (Object.keys(oasPerService).length === 0) {
    oasPerService.core = oas;
  }

  const plan: GenerationPlan = {
    mode,
    services,
    domains,
    contracts: { oasPerService }
  };

  if (defaults.frontend || mode === 'hybrid' || mode === 'frontend') {
    plan.frontend = {
      modules: domains.map((domain) => domain.name || domain.id),
      offline: Boolean(defaults.offline)
    };
  }

  return plan;
}

/**
 * Build a GenerationPlan from a designer suite export / normalised designer state.
 */
export async function buildPlanFromDesignerState(
  state: {
    domains: Array<{
      id: string;
      name: string;
      entities: Array<{
        id: string;
        name: string;
        fields: Array<{ name: string; pk?: boolean; type?: string }>;
        meta?: Record<string, unknown>;
      }>;
    }>;
    relationships?: Array<{
      id?: string;
      name?: string;
      fromEntityId: string;
      toEntityId: string;
    }>;
    architecture?: {
      services: Array<{
        id: string;
        kind: string;
        url?: string;
        domains: string[];
      }>;
    };
    interfaces?: Array<{ type?: string; framework?: string }>;
  },
  defaults: InterfaceDefaults
): Promise<GenerationPlan> {
  const { buildOasDocumentSet } = await loadDesignerCore();
  const { merged, services: oasServices } = buildOasDocumentSet(state);
  const plan = await buildPlanFromOasDocument(
    merged as Record<string, unknown>,
    defaults,
    {
      domains: state.domains,
      architecture: state.architecture || {
        services: Object.keys(oasServices || {}).map((id) => ({
          id,
          kind: id === 'core' ? 'core' : 'domain',
          domains: []
        }))
      }
    }
  );

  const entityById = new Map<string, { domainId: string; entity: PlanEntity }>();
  for (const domain of plan.domains) {
    const sourceDomain = state.domains.find((entry) => entry.id === domain.id);
    for (const entity of domain.entities) {
      const sourceEntity = sourceDomain?.entities.find((entry) => entry.name === entity.name);
      if (sourceEntity?.id) {
        entityById.set(sourceEntity.id, { domainId: domain.id, entity });
      }
      if (!entity.primaryKey) {
        const pk = (sourceEntity?.fields || []).find((field) => field.pk);
        entity.primaryKey = pk?.name || '';
      }
    }
  }

  for (const relationship of state.relationships || []) {
    const from = entityById.get(relationship.fromEntityId);
    const to = entityById.get(relationship.toEntityId);
    if (!from || !to) continue;
    const already = from.entity.relations.some((rel) => rel.entity === to.entity.name);
    if (already) continue;
    from.entity.relations.push({
      name: relationship.name || `${from.entity.name}->${to.entity.name}`,
      entity: to.entity.name,
      kind: 'references'
    });
  }

  if (oasServices && typeof oasServices === 'object') {
    plan.contracts.oasPerService = oasServices as Record<string, Record<string, unknown>>;
  }

  return plan;
}
