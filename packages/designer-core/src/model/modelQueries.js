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
  DOMAIN_DEFAULT_HEIGHT,
  DOMAIN_DEFAULT_WIDTH,
  DOMAIN_HEADER_HEIGHT,
  DOMAIN_MIN_HEIGHT,
  DOMAIN_MIN_WIDTH,
  ENTITY_MAX_HEIGHT,
  ENTITY_MAX_WIDTH,
  ENTITY_MIN_HEIGHT,
  ENTITY_MIN_WIDTH,
  ENTITY_WIDTH,
  getDefaultRbacPolicy
} from '../state/designerState.js';


/**
 * Where an entity may sit inside its domain.
 *
 * The canvas clamped drags against `520 - 200` and `180` written out by hand,
 * in two files that had to be edited together. Derived from the box instead,
 * so a resized domain immediately gives its entities the room it gained.
 */
export function entityWidth(entity) {
  return Number.isFinite(entity?.width)
    ? Math.min(ENTITY_MAX_WIDTH, Math.max(ENTITY_MIN_WIDTH, entity.width))
    : ENTITY_WIDTH;
}

export function entityMinHeight(entity, compactEntities, largeCanvasMode) {
  return Math.max(ENTITY_MIN_HEIGHT, entityHeight(entity, compactEntities, largeCanvasMode));
}

export function entityBoxHeight(entity, compactEntities, largeCanvasMode) {
  return Number.isFinite(entity?.height)
    ? Math.min(ENTITY_MAX_HEIGHT, Math.max(entityMinHeight(entity, compactEntities, largeCanvasMode), entity.height))
    : entityHeight(entity, compactEntities, largeCanvasMode);
}

export function resizeEntityBox(entity, width, height, compactEntities = false, largeCanvasMode = false) {
  return {
    width: Math.min(ENTITY_MAX_WIDTH, Math.max(ENTITY_MIN_WIDTH, width)),
    height: Math.min(ENTITY_MAX_HEIGHT, Math.max(entityMinHeight(entity, compactEntities, largeCanvasMode), height))
  };
}

export function clampEntityPosition(domain, x, y, entity = null, compactEntities = false, largeCanvasMode = false) {
  void domain;
  void entity;
  void compactEntities;
  void largeCanvasMode;
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  };
}

/**
 * How tall an entity is drawn (JUM-729 follow-up).
 *
 * The edge geometry used to assume one of two fixed heights — 32 + 24 compact,
 * 32 + 58 otherwise — which was already wrong for an entity with four fields
 * and is further off now that each field is an editable row with its own
 * controls. Every edge that anchored to `bottom` therefore started somewhere
 * inside the card instead of on its border, and the further down the field
 * list the border was, the worse the miss.
 *
 * Derived from what the CSS draws: a header, one row per field, and the "Add
 * field" row that is only rendered in the full view.
 */
export function entityHeight(entity, compactEntities, largeCanvasMode) {
  const headerHeight = 32;
  if (compactEntities) return headerHeight + 8;
  const fields = Array.isArray(entity?.fields) ? entity.fields.length : 0;
  const rowHeight = largeCanvasMode ? 16 : 22;
  const addRow = largeCanvasMode ? 0 : 26;
  return headerHeight + fields * rowHeight + addRow + 8;
}

/**
 * The smallest box that still holds every entity currently inside the domain.
 *
 * Shrinking below it would strand entities outside their own container, which
 * the canvas cannot render and the user cannot undo by dragging them back.
 */
export function minimumDomainSize(domain) {
  const entities = Array.isArray(domain?.entities) ? domain.entities : [];
  const minEntityX = entities.reduce(
    (leftmost, entity) => Math.min(leftmost, Number(entity?.x) || 0),
    0
  );
  const minEntityY = entities.reduce(
    (topmost, entity) => Math.min(topmost, Number(entity?.y) || 0),
    0
  );
  const neededWidth = entities.reduce(
    (widest, entity) => Math.max(
      widest,
      (Number(entity?.x) || 0) - minEntityX + entityWidth(entity) + 16
    ),
    DOMAIN_MIN_WIDTH
  );
  const neededHeight = entities.reduce(
    (tallest, entity) => Math.max(
      tallest,
      (Number(entity?.y) || 0) - minEntityY + entityBoxHeight(entity, false, false) + 24
    ),
    DOMAIN_MIN_HEIGHT
  );
  return { width: neededWidth, height: neededHeight };
}

/**
 * The box a domain occupies, defaulted for models saved before it was
 * resizable (JUM-729 follow-up).
 *
 * Never smaller than its contents. The CSS used to let the box grow on its own
 * (`min-height`), so a domain whose entities ran past 280px simply got taller;
 * with an explicit height that growth has to be computed, or those entities
 * render outside the container they belong to.
 */
export function domainBox(domain) {
  if (isDomainCollapsed(domain)) {
    const width = Number.isFinite(domain?.width) ? domain.width : DOMAIN_DEFAULT_WIDTH;
    return { width, height: DOMAIN_HEADER_HEIGHT };
  }
  const floor = minimumDomainSize(domain);
  const width = Number.isFinite(domain?.width) ? domain.width : DOMAIN_DEFAULT_WIDTH;
  const height = Number.isFinite(domain?.height) ? domain.height : DOMAIN_DEFAULT_HEIGHT;
  return {
    width: Math.max(floor.width, width),
    height: Math.max(floor.height, height)
  };
}

/**
 * A collapsed domain is its header and nothing else (JUM-729 follow-up).
 *
 * A model outgrows the screen long before it outgrows the design: at fifteen
 * domains the canvas is a wall of cards and the one being worked on is
 * somewhere inside it. Collapsing is how a domain stays on the diagram —
 * present, positioned, still the target of its relationships — without
 * spending the space its contents need.
 */
export function isDomainCollapsed(domain) {
  return Boolean(domain?.collapsed);
}

/**
 * Everything in the model that matches `query`, in the order a reader scans
 * the tree: domain, then its entities, then their fields (JUM-729 follow-up).
 *
 * Case-insensitive substring. Not fuzzy: the names here are identifiers people
 * type from memory, and a fuzzy match on `id` hits every entity in the model,
 * which is the same as no search at all.
 */
export function searchModel(domains, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  const matches = (value) => String(value || '').toLowerCase().includes(needle);
  const results = [];

  (domains || []).forEach((domain) => {
    if (matches(domain.name)) {
      results.push({ kind: 'domain', domainId: domain.id, label: domain.name });
    }
    (domain.entities || []).forEach((entity) => {
      if (matches(entity.name)) {
        results.push({
          kind: 'entity',
          domainId: domain.id,
          entityId: entity.id,
          label: `${domain.name} / ${entity.name}`
        });
      }
      (entity.fields || []).forEach((field) => {
        if (!matches(field.name) && !matches(field.type)) return;
        results.push({
          kind: 'field',
          domainId: domain.id,
          entityId: entity.id,
          fieldName: field.name,
          label: `${domain.name} / ${entity.name}.${field.name}: ${field.type}`
        });
      });
    });
  });

  return results;
}

/**
 * Every entity whose box overlaps the marquee rectangle (JUM-729 follow-up).
 *
 * Overlap, not containment: a rubber band that only takes what it fully
 * encloses forces the user to start the drag off-canvas to catch an entity
 * near the edge, and it silently drops the one element they were aiming at.
 *
 * `rect` is in canvas coordinates, the same space the entities are placed in.
 */
export function entitiesInMarquee(domains, rect, compactEntities, largeCanvasMode) {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  const hits = [];

  (domains || []).forEach((domain) => {
    if (isDomainCollapsed(domain)) return;
    (domain.entities || []).forEach((entity) => {
      const boxLeft = domain.x + entity.x;
      const boxTop = domain.y + entity.y;
      const boxRight = boxLeft + entityWidth(entity);
      const boxBottom = boxTop + entityBoxHeight(entity, compactEntities, largeCanvasMode);
      const overlaps = boxLeft < right && boxRight > left && boxTop < bottom && boxBottom > top;
      if (overlaps) hits.push(entity.id);
    });
  });

  return hits;
}

/**
 * Where a dragged entity lines up with its siblings, and the position that
 * snaps it there (JUM-729 follow-up).
 *
 * Grid snapping keeps positions tidy without making anything line up: two
 * entities can both sit on the grid and still be four pixels apart, which is
 * exactly the misalignment a diagram reader notices. This compares the moving
 * entity's left, centre and right against every sibling's, and the same for
 * the vertical edges, and returns the first match inside `tolerance`.
 *
 * Returns the adjusted position plus the guide lines to draw, in canvas
 * coordinates, so the caller can show what it snapped to.
 */
export function alignmentGuidesFor(domain, entity, x, y, options = {}) {
  const tolerance = options.tolerance ?? 6;
  const compactEntities = options.compactEntities ?? false;
  const largeCanvasMode = options.largeCanvasMode ?? false;
  const width = entityWidth(entity);
  const height = entityBoxHeight(entity, compactEntities, largeCanvasMode);
  const siblings = (domain?.entities || []).filter((candidate) => candidate.id !== entity.id);

  const verticalEdges = [x, x + width / 2, x + width];
  const horizontalEdges = [y, y + height / 2, y + height];
  const guides = [];
  let snappedX = x;
  let snappedY = y;

  siblings.forEach((sibling) => {
    const siblingHeight = entityHeight(sibling, compactEntities, largeCanvasMode);
    const siblingWidth = entityWidth(sibling);
    const siblingVertical = [
      sibling.x, sibling.x + siblingWidth / 2, sibling.x + siblingWidth
    ];
    const siblingHorizontal = [
      sibling.y, sibling.y + siblingHeight / 2, sibling.y + siblingHeight
    ];

    verticalEdges.forEach((edge, edgeIndex) => {
      siblingVertical.forEach((siblingEdge) => {
        if (Math.abs(edge - siblingEdge) > tolerance) return;
        if (guides.some((guide) => guide.axis === 'x')) return;
        snappedX = siblingEdge - (width / 2) * edgeIndex;
        guides.push({ axis: 'x', at: domain.x + siblingEdge });
      });
    });

    horizontalEdges.forEach((edge, edgeIndex) => {
      siblingHorizontal.forEach((siblingEdge) => {
        if (Math.abs(edge - siblingEdge) > tolerance) return;
        if (guides.some((guide) => guide.axis === 'y')) return;
        snappedY = siblingEdge - (height / 2) * edgeIndex;
        guides.push({ axis: 'y', at: domain.y + siblingEdge });
      });
    });
  });

  return { x: snappedX, y: snappedY, guides };
}

/** Resize a domain box, never below its minimum or its contents. */
export function resizeDomainBox(domain, width, height) {
  const floor = minimumDomainSize(domain);
  return {
    width: Math.max(floor.width, Math.round(width)),
    height: Math.max(floor.height, Math.round(height))
  };
}

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
  if (field.indexed) flags.push('IDX');
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

/**
 * The OAS importer's name-based PK/FK/unique heuristic, factored out so the
 * exporter can detect divergence: a field whose flags differ from the
 * heuristic gets them carried explicitly in `x-field-flags` (JUM-478), and
 * every other field crosses with no per-field extension at all.
 */
export function oasFieldNameFlags(fieldName) {
  return {
    pk: fieldName === 'id',
    fk: /id$/i.test(fieldName) && fieldName !== 'id',
    unique: fieldName === 'id'
  };
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
export function entityCenterPoint(domain, entity, compactEntities, largeCanvasMode) {
  // JUM-729 follow-up: the real centre. `+95` was half of the old 190px card and `+32`
  // was its header, so a centre-anchored edge pointed at the top-left of a
  // taller entity rather than at its middle.
  return {
    x: domain.x + entity.x + entityWidth(entity) / 2,
    y: domain.y + entity.y + entityBoxHeight(entity, compactEntities, largeCanvasMode) / 2
  };
}

/** Row height of one field inside an entity card, as the CSS draws it. */
export function entityFieldRowHeight(largeCanvasMode) {
  return largeCanvasMode ? 16 : 22;
}

/**
 * Where a relationship touches a specific field (JUM-729 follow-up).
 *
 * Edges used to land on the middle of an entity's side, so a link that means
 * "orders.customer_id references customers.id" pointed at two cards and said
 * nothing about which columns it joined — the reader had to guess, and with
 * three links between the same pair of entities there was nothing to guess
 * from. This returns the point on the entity's left or right border level with
 * that field's row.
 *
 * A field that is no longer there (renamed, deleted, or the entity collapsed
 * into compact view) has no row to point at, and the caller falls back to the
 * side anchor rather than drawing a line to a row that is not on screen.
 */
export function entityFieldAnchorPoint(domain, entity, fieldName, side, compactEntities, largeCanvasMode) {
  if (compactEntities) return null;
  const fields = Array.isArray(entity?.fields) ? entity.fields : [];
  const fieldIndex = fields.findIndex((field) => field.name === fieldName);
  if (fieldIndex < 0) return null;

  const headerHeight = 32;
  const rowHeight = entityFieldRowHeight(largeCanvasMode);
  const originX = domain.x + entity.x;
  const originY = domain.y + entity.y;
  const y = originY + headerHeight + fieldIndex * rowHeight + rowHeight / 2;
  return {
    x: side === 'left' ? originX : originX + entityWidth(entity),
    y
  };
}

/**
 * Which side of `target` faces `origin`.
 *
 * Used when a link is dropped on an entity rather than on one of its four
 * anchor dots: the edge should leave and arrive on the sides that face each
 * other, which is what a person dragging between two cards means.
 */
export function facingSide(originX, targetX) {
  return targetX >= originX ? 'left' : 'right';
}

/**
 * Anchor point of an entity side in canvas coordinates. Unknown/absent sides
 * fall back to the centre, exactly as `entityAnchorOnCanvas` did.
 */
export function entityAnchorPoint(domain, entity, side, compactEntities, largeCanvasMode) {
  const originX = domain.x + entity.x;
  const originY = domain.y + entity.y;
  const width = entityWidth(entity);
  const height = entityBoxHeight(entity, compactEntities, largeCanvasMode);
  if (side === 'left') return { x: originX, y: originY + height / 2 };
  if (side === 'right') return { x: originX + width, y: originY + height / 2 };
  if (side === 'top') return { x: originX + width / 2, y: originY };
  if (side === 'bottom') return { x: originX + width / 2, y: originY + height };
  return entityCenterPoint(domain, entity, compactEntities, largeCanvasMode);
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
 * Editable relationship route point.
 *
 * Without a stored bend, the route follows the midpoint between its current
 * endpoints. Once the user drags the handle, the explicit point is persisted
 * until Straighten clears it.
 */
export function relationshipControlPoint(relationship, from, to) {
  const hasBend = Number.isFinite(relationship?.bendX) && Number.isFinite(relationship?.bendY);
  return {
    x: hasBend ? relationship.bendX : (from.x + to.x) / 2,
    y: hasBend ? relationship.bendY : (from.y + to.y) / 2,
    explicit: hasBend
  };
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
    const box = domainBox(domain);
    bounds.maxX = Math.max(bounds.maxX, domain.x + box.width);
    bounds.maxY = Math.max(bounds.maxY, domain.y + box.height);
  });

  const padding = domains.length >= 10 ? 32 : 80;
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
  const denseOverview = domains.length >= 10;
  const padding = denseOverview ? 18 : 24;
  const entityGapX = denseOverview ? 18 : 28;
  const entityGapY = denseOverview ? 18 : 26;
  const domainGapX = denseOverview ? 26 : 72;
  const domainGapY = denseOverview ? 26 : 72;
  const origin = denseOverview ? 24 : 40;
  const maxCanvasWidth = 3200 - (denseOverview ? 80 : 120);
  const plannedDomainWidths = domains.map((domain) => {
    const entityCount = Math.max(1, domain.entities.length);
    const entityColumns = Math.max(1, Math.min(entityCount, Math.ceil(Math.sqrt(entityCount))));
    const widestEntity = Math.max(ENTITY_WIDTH, ...domain.entities.map((entity) => entityWidth(entity)));
    return padding * 2 + entityColumns * widestEntity + (entityColumns - 1) * entityGapX;
  });
  const widestDomain = Math.max(DOMAIN_MIN_WIDTH, ...plannedDomainWidths);
  const columns = Math.max(1, Math.floor(maxCanvasWidth / (widestDomain + domainGapX)));
  const rowHeights = [];

  domains.forEach((domain, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const entityCount = domain.entities.length;
    const entityColumns = entityCount > 0
      ? Math.max(1, Math.min(entityCount, Math.ceil(Math.sqrt(entityCount))))
      : 1;
    const rowTops = [];
    let nextTop = DOMAIN_HEADER_HEIGHT + padding;
    domain.entities.forEach((entity, entityIndex) => {
      const entityRow = Math.floor(entityIndex / entityColumns);
      if (rowTops[entityRow] === undefined) {
        rowTops[entityRow] = nextTop;
        const rowEntities = domain.entities.slice(
          entityRow * entityColumns,
          entityRow * entityColumns + entityColumns
        );
        const rowHeight = rowEntities.reduce(
          (tallest, member) => Math.max(tallest, entityBoxHeight(member, false, false)),
          0
        );
        nextTop += rowHeight + entityGapY;
      }
      const columnIndex = entityIndex % entityColumns;
      const widestEntity = Math.max(ENTITY_WIDTH, ...domain.entities.map((member) => entityWidth(member)));
      entity.x = padding + columnIndex * (widestEntity + entityGapX);
      entity.y = rowTops[entityRow];
    });

    if (domain.entities.length > 0) nextTop -= entityGapY;
    const domainWidth = Math.max(DOMAIN_MIN_WIDTH, plannedDomainWidths[index]);
    const domainHeight = Math.max(DOMAIN_MIN_HEIGHT, nextTop + padding);
    rowHeights[row] = Math.max(rowHeights[row] || 0, domainHeight);
    domain.x = origin + column * (widestDomain + domainGapX);
    domain.y = origin + rowHeights.slice(0, row).reduce((top, height) => top + height + domainGapY, 0);
    domain.width = domainWidth;
    domain.height = domainHeight;
  });
}
