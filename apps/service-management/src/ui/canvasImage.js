/**
 * canvasImage — the diagram as a PNG (JUM-729 follow-up).
 *
 * Drawn from the model onto a 2D canvas rather than by rasterising the DOM.
 * The usual DOM route (`foreignObject` in an SVG, then `drawImage`) taints the
 * canvas in WebKit and refuses to export at all, and it drags every stylesheet
 * and web font into the output; here the drawing is the same geometry the
 * canvas renderer uses, so the picture cannot disagree with the diagram about
 * where anything is.
 *
 * What it deliberately does not draw: the editable controls. A field row in
 * the export is `name: type [PK, REQ]` — the reading form, not the editing
 * form — because the picture is for someone who is not in the tool.
 */

import {
  domainBox,
  entityHeight,
  fieldLabel,
  isDomainCollapsed
} from '@jumentix/designer-core/model/modelQueries.js';

const PADDING = 40;
const ENTITY_WIDTH = 340;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 22;

/** The bounding box of everything drawn, in canvas coordinates. */
export function modelBounds(state) {
  const bounds = {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity
  };
  const grow = (x, y, width, height) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x + width);
    bounds.maxY = Math.max(bounds.maxY, y + height);
  };

  (state.domains || []).forEach((domain) => {
    const box = domainBox(domain);
    grow(domain.x, domain.y, box.width, box.height);
  });
  (state.notes || []).forEach((note) => grow(note.x, note.y, 200, 120));

  if (!Number.isFinite(bounds.minX)) return { x: 0, y: 0, width: 800, height: 600 };
  return {
    x: bounds.minX - PADDING,
    y: bounds.minY - PADDING,
    width: bounds.maxX - bounds.minX + PADDING * 2,
    height: bounds.maxY - bounds.minY + PADDING * 2
  };
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawEntity(context, domain, entity, compactEntities) {
  const x = domain.x + entity.x;
  const y = domain.y + entity.y;
  const height = entityHeight(entity, compactEntities, false);

  context.fillStyle = '#ffffff';
  context.strokeStyle = '#cbd5e1';
  drawRoundedRect(context, x, y, ENTITY_WIDTH, height, 6);
  context.fill();
  context.stroke();

  context.fillStyle = '#0f172a';
  context.font = '600 12px system-ui, sans-serif';
  context.fillText(entity.name, x + 8, y + 20);
  if (entity?.meta?.aggregateRoot) {
    context.fillStyle = '#2563eb';
    context.font = '700 9px system-ui, sans-serif';
    context.fillText('AR', x + ENTITY_WIDTH - 22, y + 20);
  }

  if (compactEntities) return;
  context.font = '11px system-ui, sans-serif';
  context.fillStyle = '#334155';
  (entity.fields || []).forEach((field, index) => {
    const label = fieldLabel(field);
    context.fillText(label, x + 8, y + HEADER_HEIGHT + index * ROW_HEIGHT + 15, ENTITY_WIDTH - 16);
  });
}

function drawDomain(context, domain, compactEntities) {
  const box = domainBox(domain);
  context.fillStyle = `${domain.color || '#60a5fa'}22`;
  context.strokeStyle = domain.color || '#60a5fa';
  drawRoundedRect(context, domain.x, domain.y, box.width, box.height, 10);
  context.fill();
  context.stroke();

  context.fillStyle = '#0f172a';
  context.font = '600 13px system-ui, sans-serif';
  context.fillText(domain.name, domain.x + 10, domain.y + 22);
  context.fillStyle = '#64748b';
  context.font = '11px system-ui, sans-serif';
  const count = (domain.entities || []).length;
  context.fillText(
    `${String(count)} ${count === 1 ? 'entity' : 'entities'}`,
    domain.x + box.width - 74,
    domain.y + 22
  );

  if (isDomainCollapsed(domain)) return;
  (domain.entities || []).forEach((entity) => drawEntity(context, domain, entity, compactEntities));
}

/**
 * Render the model into `canvasElement` and return it.
 *
 * `endpointFor(relationship, end)` is supplied by the caller — the live canvas
 * already knows how to resolve an edge end (field row, side anchor or centre),
 * and duplicating that here would give the export a second opinion about where
 * a line starts.
 */
export function drawModel(canvasElement, state, endpointFor, options = {}) {
  const scale = options.scale ?? 2;
  const bounds = modelBounds(state);
  const context = canvasElement.getContext('2d');

  canvasElement.width = Math.ceil(bounds.width * scale);
  canvasElement.height = Math.ceil(bounds.height * scale);
  context.scale(scale, scale);
  context.translate(-bounds.x, -bounds.y);

  context.fillStyle = options.background || '#ffffff';
  context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  context.lineWidth = 1.5;
  context.strokeStyle = '#94a3b8';
  (state.relationships || []).forEach((relationship) => {
    const from = endpointFor(relationship, 'from');
    const to = endpointFor(relationship, 'to');
    if (!from || !to) return;
    context.beginPath();
    context.moveTo(from.x, from.y);
    const controlX = Number.isFinite(relationship.bendX) ? relationship.bendX : (from.x + to.x) / 2;
    context.bezierCurveTo(controlX, from.y, controlX, to.y, to.x, to.y);
    context.stroke();

    context.fillStyle = '#475569';
    context.font = '10px system-ui, sans-serif';
    context.fillText(relationship.fromCardinality || '', from.x + 6, from.y - 6);
    context.fillText(relationship.toCardinality || '', to.x + 6, to.y - 6);
  });

  context.lineWidth = 1;
  (state.domains || []).forEach((domain) => {
    drawDomain(context, domain, Boolean(state.view?.compactEntities));
  });

  (state.notes || []).forEach((note) => {
    context.fillStyle = note.color || '#fde68a';
    context.strokeStyle = '#d1d5db';
    drawRoundedRect(context, note.x, note.y, 200, 120, 6);
    context.fill();
    context.stroke();
    context.fillStyle = '#0f172a';
    context.font = '11px system-ui, sans-serif';
    String(note.text || '').split('\n').slice(0, 7).forEach((line, index) => {
      context.fillText(line, note.x + 10, note.y + 24 + index * 15, 180);
    });
  });

  return canvasElement;
}
