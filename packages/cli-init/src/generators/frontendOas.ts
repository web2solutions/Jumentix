import type { GenerationPlan } from '../sources/types';

export type JsonObject = Record<string, unknown>;

/**
 * Deep-merge per-service OAS documents into one frontend contract document
 * (paths + components.schemas). First-write wins for conflicting path keys.
 */
export function mergeServiceOas(
  oasPerService: GenerationPlan['contracts']['oasPerService']
): JsonObject {
  const merged: JsonObject = {
    openapi: '3.1.0',
    info: { title: 'Generated API', version: '1.0.0' },
    paths: {},
    components: { schemas: {} }
  };
  const paths = merged.paths as JsonObject;
  const schemas = (merged.components as JsonObject).schemas as JsonObject;

  for (const doc of Object.values(oasPerService || {})) {
    if (!doc || typeof doc !== 'object') {
      // skip empty / non-object entries
    } else {
      if (typeof doc.openapi === 'string') merged.openapi = doc.openapi;
      if (doc.info && typeof doc.info === 'object') merged.info = doc.info;
      if (Array.isArray(doc.servers)) merged.servers = doc.servers;
      if (Array.isArray(doc['x-services'])) merged['x-services'] = doc['x-services'];

      const docPaths = doc.paths && typeof doc.paths === 'object'
        ? doc.paths as JsonObject
        : {};
      for (const [pathKey, pathItem] of Object.entries(docPaths)) {
        if (!paths[pathKey]) {
          paths[pathKey] = pathItem;
        }
      }

      const docSchemas = doc.components
        && typeof doc.components === 'object'
        && (doc.components as JsonObject).schemas
        && typeof (doc.components as JsonObject).schemas === 'object'
        ? (doc.components as JsonObject).schemas as JsonObject
        : {};
      for (const [schemaKey, schema] of Object.entries(docSchemas)) {
        if (!schemas[schemaKey]) {
          schemas[schemaKey] = schema;
        }
      }
    }
  }

  return merged;
}

/** Count path keys on an OAS document. */
export function oasPathCount(doc: JsonObject | undefined): number {
  if (!doc || typeof doc !== 'object') return 0;
  const { paths } = doc;
  if (!paths || typeof paths !== 'object') return 0;
  return Object.keys(paths).length;
}

type RawOperation = {
  operationId?: string;
  tags?: unknown;
  summary?: string;
  'x-list-capabilities'?: { searchable?: string[] };
  requestBody?: unknown;
  responses?: unknown;
};

export type OasOperationRef = {
  method: string;
  path: string;
  operationId: string;
  operation: RawOperation;
};

/** Flatten OAS paths into operation refs. */
export function listOasOperations(oas: JsonObject): OasOperationRef[] {
  const paths = oas.paths && typeof oas.paths === 'object'
    ? oas.paths as Record<string, Record<string, RawOperation>>
    : {};
  const out: OasOperationRef[] = [];
  for (const [pathKey, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!operation || typeof operation !== 'object') {
        // skip non-operation path keys (parameters, summary, …)
      } else if (operation.operationId) {
        out.push({
          method: method.toUpperCase(),
          path: pathKey,
          operationId: String(operation.operationId),
          operation
        });
      }
    }
  }
  return out;
}

function operationMentionsEntity(ref: OasOperationRef, entityName: string): boolean {
  const needle = `#/components/schemas/${entityName}`;
  const blob = JSON.stringify(ref.operation);
  if (blob.includes(needle)) return true;
  const tags = Array.isArray(ref.operation.tags) ? ref.operation.tags : [];
  return tags.some((tag) => String(tag).toLowerCase() === entityName.toLowerCase());
}

function pathHasItemParam(pathKey: string): boolean {
  return /\{[^}]+\}/.test(pathKey);
}

export type ResolvedCrudOperations = {
  list: string;
  create: string;
  update: string;
  delete: string;
};

/**
 * Resolve list/create/update/delete operationIds for an entity from the OAS.
 * Falls back to conventional ids when the document is incomplete.
 */
export function resolveEntityOperations(
  oas: JsonObject,
  entityName: string
): ResolvedCrudOperations {
  const refs = listOasOperations(oas).filter((ref) => operationMentionsEntity(ref, entityName));
  const fallback = {
    list: `list${entityName}s`,
    create: `create${entityName}`,
    update: `update${entityName}`,
    delete: `delete${entityName}`
  };

  let list = '';
  let create = '';
  let update = '';
  let deleteOp = '';

  for (const ref of refs) {
    const id = ref.operationId;
    const idLower = id.toLowerCase();
    const isMetricsPath = /\/metrics\/?$/i.test(ref.path);
    if (ref.method === 'GET' && !pathHasItemParam(ref.path) && !isMetricsPath) {
      if (!list || /^(getall|list)/i.test(id)) list = id;
    } else if (ref.method === 'POST' && !pathHasItemParam(ref.path)) {
      if (!create || /^create/i.test(id)) create = id;
    } else if ((ref.method === 'PUT' || ref.method === 'PATCH') && pathHasItemParam(ref.path)) {
      const nested = /\/(update|create|delete)(email|phone|document|address|password)/i.test(ref.path)
        || /email|phone|document|address|password/i.test(idLower);
      if (!nested && (!update || /^update/i.test(id))) update = id;
    } else if (ref.method === 'DELETE' && pathHasItemParam(ref.path)) {
      const nested = /email|phone|document|address/i.test(idLower);
      if (!nested && (!deleteOp || /^delete/i.test(id))) deleteOp = id;
    } else if (!list && /^(getall|list)/i.test(idLower)) {
      list = id;
    } else if (!create && /^create/i.test(idLower) && !/email|phone|document|address/i.test(idLower)) {
      create = id;
    } else if (!update && /^update/i.test(idLower) && !/password|email|phone|document|address/i.test(idLower)) {
      update = id;
    } else if (!deleteOp && /^delete/i.test(idLower) && !/email|phone|document|address/i.test(idLower)) {
      deleteOp = id;
    }
  }

  return {
    list: list || fallback.list,
    create: create || fallback.create,
    update: update || fallback.update,
    delete: deleteOp || fallback.delete
  };
}

/** Read `x-list-capabilities.searchable` for a list operationId. */
export function searchableFieldsForOperation(
  oas: JsonObject,
  listOperationId: string
): string[] {
  const refs = listOasOperations(oas);
  const match = refs.find((ref) => ref.operationId === listOperationId);
  const caps = match?.operation['x-list-capabilities'];
  if (caps && Array.isArray(caps.searchable) && caps.searchable.length > 0) {
    return caps.searchable.map(String);
  }
  return [];
}

/** Prefer RequestCreate/Update{Entity} schema names when present. */
export function resolveRequestSchemas(
  oas: JsonObject,
  entityName: string
): { create: string; update: string } {
  const schemas = oas.components
    && typeof oas.components === 'object'
    && (oas.components as JsonObject).schemas
    && typeof (oas.components as JsonObject).schemas === 'object'
    ? (oas.components as JsonObject).schemas as JsonObject
    : {};
  const createKey = `RequestCreate${entityName}`;
  const updateKey = `RequestUpdate${entityName}`;
  return {
    create: schemas[createKey] ? createKey : entityName,
    update: schemas[updateKey] ? updateKey : entityName
  };
}

export type LocalizedTitle = { en: string; 'pt-BR': string };

/** Title from schema `x-label` or a humanized entity name. */
export function entityTitleFromOas(
  oas: JsonObject,
  entityName: string
): LocalizedTitle {
  const schemas = oas.components
    && typeof oas.components === 'object'
    && (oas.components as JsonObject).schemas
    && typeof (oas.components as JsonObject).schemas === 'object'
    ? (oas.components as JsonObject).schemas as JsonObject
    : {};
  const schema = schemas[entityName];
  if (schema && typeof schema === 'object') {
    const label = (schema as JsonObject)['x-label'];
    if (label && typeof label === 'object' && !Array.isArray(label)) {
      const en = String((label as JsonObject).en || entityName);
      const pt = String((label as JsonObject)['pt-BR'] || en);
      return { en, 'pt-BR': pt };
    }
  }
  return { en: entityName, 'pt-BR': entityName };
}

/** Fallback searchable fields from string-ish entity properties (skip id). */
export function fallbackSearchFields(
  entitySchema: Record<string, unknown> | undefined
): string[] {
  const props = entitySchema?.properties && typeof entitySchema.properties === 'object'
    ? entitySchema.properties as Record<string, { type?: string }>
    : {};
  const fields: string[] = [];
  for (const [name, prop] of Object.entries(props)) {
    if (name === 'id') {
      // skip primary key
    } else if (!prop || typeof prop !== 'object') {
      // skip
    } else if (prop.type === 'string' || !prop.type) {
      fields.push(name);
    }
  }
  return fields.slice(0, 5);
}
