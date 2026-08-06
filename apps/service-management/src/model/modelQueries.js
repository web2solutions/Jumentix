/**
 * modelQueries — pure, DOM-free helpers over the designer model, extracted
 * from `script.js` by JUM-469.
 *
 * Everything here is a pure function over the state object (or parts of it):
 * no `document`, no `window`, no storage. Functions that closed over the
 * module-level `state` in the monolith now take the relevant slice as their
 * first parameter; the logic is verbatim, so behaviour is identical.
 *
 * This module is the shared vocabulary of the validation engine
 * (`src/validation/modelValidation.js`), the exporters
 * (`src/exporters/designerExporters.js`), the importers
 * (`src/importers/designerImporters.js`) and the DOM layer (`src/ui/`). It
 * imports the JUM-468 normalisers from `src/state/designerState.js` and is
 * itself imported by them — the module graph stays acyclic:
 *
 *   state/designerState.js  <-  model/modelQueries.js  <-  validation/*
 *                                                       <-  exporters/*
 *                                                       <-  importers/*
 *                                                       <-  codegen/*
 *                                                       <-  ui/*
 */

import {
  clampZoom,
  getDefaultRbacPolicy
} from '../state/designerState.js';

export function normalizedName(value) {
  return String(value || '').trim().toLowerCase();
}

export function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((item) => String(item).trim()).filter(Boolean)));
}

export function isDomainNameTaken(domains, name, ignoredDomainId = null) {
  const value = normalizedName(name);
  return domains.some((domain) => domain.id !== ignoredDomainId && normalizedName(domain.name) === value);
}

export function isEntityNameTaken(domain, name, ignoredEntityId = null) {
  const value = normalizedName(name);
  return domain.entities.some((entity) => entity.id !== ignoredEntityId && normalizedName(entity.name) === value);
}

export function isFieldNameTaken(entity, name, ignoredFieldName = null) {
  const value = normalizedName(name);
  return entity.fields.some(
    (field) => normalizedName(field.name) !== normalizedName(ignoredFieldName) && normalizedName(field.name) === value
  );
}

export function findEntity(domains, entityId) {
  for (const domain of domains) {
    const entity = domain.entities.find((candidate) => candidate.id === entityId);
    if (entity) return { domain, entity };
  }
  return null;
}

export function findEntityByName(domains, name) {
  const normalized = normalizedName(name);
  if (!normalized) return null;
  for (const domain of domains) {
    const entity = domain.entities.find((candidate) => normalizedName(candidate.name).includes(normalized));
    if (entity) return { domain, entity };
  }
  return null;
}

export function entityLabel(domains, entityId) {
  const found = findEntity(domains, entityId);
  return found ? `${found.domain.name}/${found.entity.name}` : entityId;
}

export function fieldLabel(field) {
  const flags = [];
  if (field.pk) flags.push('PK');
  if (field.fk) flags.push('FK');
  if (field.unique) flags.push('UQ');
  if (field.required) flags.push('REQ');
  if (field.nullable) flags.push('NULL');
  return `${field.name}: ${field.type}${field.format ? `(${field.format})` : ''}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
}

export function buildRelationshipName(domains, fromEntityId, toEntityId, fromCardinality, toCardinality) {
  const from = entityLabel(domains, fromEntityId);
  const to = entityLabel(domains, toEntityId);
  if (fromCardinality === 'N' && toCardinality === '1') return `${from} belongs to ${to}`;
  if (fromCardinality === '1' && toCardinality === 'N') return `${from} has many ${to}`;
  if (fromCardinality === '1' && toCardinality === '1') return `${from} is linked to ${to}`;
  return `${from} relates to ${to}`;
}

export function severityRank(severity) {
  if (severity === 'error') return 3;
  if (severity === 'warn') return 2;
  return 1;
}

export function getEntityRbacPolicy(entity) {
  if (!entity.meta) entity.meta = {};
  if (!entity.meta.rbac) entity.meta.rbac = getDefaultRbacPolicy();
  return entity.meta.rbac;
}

export function toOasType(fieldType) {
  if (fieldType === 'integer') return { type: 'integer' };
  if (fieldType === 'number') return { type: 'number' };
  if (fieldType === 'boolean') return { type: 'boolean' };
  if (fieldType === 'array') return { type: 'array' };
  if (fieldType === 'object') return { type: 'object' };
  if (fieldType === 'date') return { type: 'string', format: 'date' };
  if (fieldType === 'datetime') return { type: 'string', format: 'date-time' };
  if (fieldType === 'uuid') return { type: 'string', format: 'uuid' };
  return { type: 'string' };
}

export function toOasFieldSchema(field) {
  const schema = {
    ...toOasType(field.type)
  };
  if (field.type === 'array') {
    schema.items = toOasType(field.itemsType || 'string');
  }
  if (field.format) schema.format = field.format;
  if (field.description) schema.description = field.description;
  if (field.nullable) schema.nullable = true;
  if (field.enumValues?.length) schema.enum = [...field.enumValues];
  if (typeof field.minLength === 'number') schema.minLength = field.minLength;
  if (typeof field.maxLength === 'number') schema.maxLength = field.maxLength;
  if (typeof field.minimum === 'number') schema.minimum = field.minimum;
  if (typeof field.maximum === 'number') schema.maximum = field.maximum;
  if (field.pattern) schema.pattern = field.pattern;
  return schema;
}

export function fromOasType(schema = {}) {
  const type = schema.type;
  const format = schema.format;
  if (type === 'array') return 'array';
  if (type === 'object') return 'object';
  if (type === 'integer') return 'integer';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'string' && format === 'date') return 'date';
  if (type === 'string' && format === 'date-time') return 'datetime';
  if (type === 'string' && format === 'uuid') return 'uuid';
  return 'string';
}

export function toSchemaName(domainName, entityName) {
  const normalize = (value) => String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const domainToken = normalize(domainName) || 'Domain';
  const entityToken = normalize(entityName) || 'Entity';
  return `${domainToken}_${entityToken}`;
}

export function toPathToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildExampleValueForField(field) {
  if (field.enumValues?.length) return field.enumValues[0];
  if (field.type === 'uuid') return '00000000-0000-4000-8000-000000000001';
  if (field.type === 'datetime') return '2026-01-01T00:00:00.000Z';
  if (field.type === 'date') return '2026-01-01';
  if (field.type === 'integer') return 1;
  if (field.type === 'number') return 10.5;
  if (field.type === 'boolean') return true;
  if (field.type === 'array') return [];
  if (field.type === 'object') return {};
  if (field.format === 'email') return 'user@example.com';
  if (field.format === 'uri') return 'https://example.com/resource';
  return `${field.name || 'value'}_example`;
}

export function buildEntityRequestExample(entity, mode = 'create') {
  const payload = {};
  (entity.fields || []).forEach((field) => {
    if (mode === 'create' && field.pk) return;
    if (mode === 'update' && field.pk) return;
    if (mode === 'update' && !field.required && !field.fk && !field.unique) return;
    payload[field.name] = buildExampleValueForField(field);
  });
  return payload;
}

export function buildEntityResponseExample(entity) {
  const payload = {};
  (entity.fields || []).forEach((field) => {
    payload[field.name] = buildExampleValueForField(field);
  });
  return payload;
}

/**
 * Snap a canvas coordinate to the 8px grid when snapping is enabled. The
 * monolith read `state.view.snapToGrid` from the closure; the flag is now an
 * explicit parameter.
 */
export function snapCoordinate(snapToGrid, value) {
  if (!snapToGrid) return value;
  const GRID = 8;
  return Math.round(value / GRID) * GRID;
}

/** Entity centre in canvas coordinates (the +95/+32 offsets are unchanged). */
export function entityCenterPoint(domain, entity) {
  return {
    x: domain.x + entity.x + 95,
    y: domain.y + entity.y + 32
  };
}

/**
 * Anchor point of an entity side in canvas coordinates. Unknown/absent sides
 * fall back to the centre, exactly as `entityAnchorOnCanvas` did.
 */
export function entityAnchorPoint(domain, entity, side, compactEntities) {
  const originX = domain.x + entity.x;
  const originY = domain.y + entity.y;
  const width = 190;
  const headerHeight = 32;
  const bodyHeight = compactEntities ? 24 : 58;
  const height = headerHeight + bodyHeight;
  if (side === 'left') return { x: originX, y: originY + height / 2 };
  if (side === 'right') return { x: originX + width, y: originY + height / 2 };
  if (side === 'top') return { x: originX + width / 2, y: originY };
  if (side === 'bottom') return { x: originX + width / 2, y: originY + height };
  return entityCenterPoint(domain, entity);
}

/**
 * SVG path for a relationship edge. Curved and orthogonal shapes are
 * byte-identical to the strings `renderEdges` built inline.
 */
export function buildEdgePathD(from, to, controlX, controlY, orthogonal) {
  return orthogonal
    ? `M ${from.x} ${from.y} L ${controlX} ${from.y} L ${controlX} ${controlY} L ${controlX} ${to.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} C ${controlX} ${from.y}, ${controlX} ${to.y}, ${to.x} ${to.y}`;
}

/**
 * SVG path for the anchor-drag preview edge. Note this is NOT
 * `buildEdgePathD` with midpoint controls: the preview's orthogonal shape has
 * no bend vertex (`L cx fy L cx ty L tx ty`), preserved as it was.
 */
export function buildPreviewEdgePathD(from, to, orthogonal) {
  const controlX = (from.x + to.x) / 2;
  return orthogonal
    ? `M ${from.x} ${from.y} L ${controlX} ${from.y} L ${controlX} ${to.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} C ${controlX} ${from.y}, ${controlX} ${to.y}, ${to.x} ${to.y}`;
}

/**
 * Pure geometry of `fitView`: zoom and scroll target that frame every domain.
 * The DOM caller applies them (`renderView`, `scrollTo`, `saveState`).
 */
export function computeFitView(domains, viewportWidth, viewportHeight) {
  if (!domains.length) {
    return { zoom: 1, left: 0, top: 0 };
  }

  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: 0,
    maxY: 0
  };

  domains.forEach((domain) => {
    bounds.minX = Math.min(bounds.minX, domain.x);
    bounds.minY = Math.min(bounds.minY, domain.y);
    bounds.maxX = Math.max(bounds.maxX, domain.x + 520);
    bounds.maxY = Math.max(bounds.maxY, domain.y + 280);
  });

  const padding = 80;
  const contentWidth = Math.max(300, bounds.maxX - bounds.minX + padding * 2);
  const contentHeight = Math.max(220, bounds.maxY - bounds.minY + padding * 2);
  const zoomX = viewportWidth / contentWidth;
  const zoomY = viewportHeight / contentHeight;
  const zoom = clampZoom(Math.min(zoomX, zoomY));

  const left = Math.max(0, (bounds.minX - padding) * zoom);
  const top = Math.max(0, (bounds.minY - padding) * zoom);
  return { zoom, left, top };
}

/**
 * Pure geometry of `autoLayout`: reposition every domain (grid) and every
 * entity (two columns) in place. The DOM caller wraps this in `withPersist`
 * and re-renders, as before.
 */
export function applyAutoLayout(domains) {
  const domainWidth = 520;
  const domainHeight = 300;
  const gapX = 70;
  const gapY = 70;
  const columns = Math.max(1, Math.floor((3200 - 120) / (domainWidth + gapX)));

  domains.forEach((domain, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    domain.x = 40 + column * (domainWidth + gapX);
    domain.y = 40 + row * (domainHeight + gapY);

    domain.entities.forEach((entity, entityIndex) => {
      const entityColumn = entityIndex % 2;
      const entityRow = Math.floor(entityIndex / 2);
      entity.x = 14 + entityColumn * 206;
      entity.y = 14 + entityRow * 118;
    });
  });
}
