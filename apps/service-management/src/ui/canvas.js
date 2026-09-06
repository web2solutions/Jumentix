/**
 * canvas — the domain-designer canvas of the Service Management app,
 * extracted from `script.js` by JUM-469.
 *
 * Owns every canvas concern: zoom/pan/snap, domain and entity rendering with
 * drag, relationship edges and the anchor-drag preview, mini-map, fit/reset
 * view and auto-layout. The unit-testable geometry lives in the DOM-free
 * `src/model/modelQueries.js` (`computeFitView`, `applyAutoLayout`,
 * `entityAnchorPoint`, `buildEdgePathD`, ...); what remains here is the DOM
 * glue, which the WebKit integration smoke exercises end to end.
 *
 * The explicit interface is the factory below: elements, shared state and
 * interaction objects in; callbacks for everything the monolith used to
 * reach in the closure (`withPersist`, `render`, selection setters,
 * relationship creation). Nothing here touches modules `script.js` owns.
 * Behaviour — event handlers, class names, inline styles, SVG shapes — is
 * verbatim from the monolith.
 */

import {
  clampZoom,
  FIELD_TYPES,
  normalizeField,
  normalizeOptionalNumber
} from '@jumentix/designer-core/state/designerState.js';
import {
  applyAutoLayout,
  minimumDomainSize,
  buildPreviewEdgePathD,
  alignmentGuidesFor,
  clampEntityPosition,
  computeFitView,
  entitiesInMarquee,
  entityBoxHeight,
  entityFieldRowHeight,
  entityFieldAnchorPoint,
  entityWidth,
  facingSide,
  isDomainCollapsed,
  domainBox,
  entityAnchorPoint,
  entityCenterPoint,
  fieldLabel,
  findEntity,
  resizeDomainBox,
  resizeEntityBox,
  relationshipControlPoint,
  snapCoordinate
} from '@jumentix/designer-core/model/modelQueries.js';

const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 2200;
const CANVAS_ORIGIN_X = CANVAS_WIDTH;
const CANVAS_ORIGIN_Y = CANVAS_HEIGHT;
const VIRTUAL_CANVAS_WIDTH = CANVAS_WIDTH + CANVAS_ORIGIN_X * 2;
const VIRTUAL_CANVAS_HEIGHT = CANVAS_HEIGHT + CANVAS_ORIGIN_Y * 2;

/**
 * @param {Object} options
 * @param {Object} options.dom - resolved element map from `script.js`.
 * @param {Object} options.state - shared designer state (mutated in place).
 * @param {Object} options.interaction - shared interaction flags (pan, pick,
 * anchor drag), mutated in place as the monolith did.
 * @param {Object} options.actions - callbacks into the orchestrator:
 * `withPersist(action)`, `render()`, `saveState()`,
 * `setSelectedDomain(id)`, `setSelectedEntity(id)`,
 * `handleEntityRelationshipPick(id)`,
 * `addRelationshipFromAnchor(fromEntityId, toEntityId, toSide)`.
 */
export function createCanvas({ dom, state, interaction, actions, contextMenu, sidebarGroups }) {
  const {
    withPersist,
    render,
    saveState,
    setSelectedDomain,
    setSelectedEntity,
    handleEntityRelationshipPick,
    addRelationshipFromAnchor,
    addDomain,
    addEntity,
    deleteEntity,
    deleteDomain,
    deleteRelationship,
    confirmAction
  } = actions;
  let edgeRenderFrame = 0;
  let miniMapRenderFrame = 0;
  let pendingAlignmentGuides = null;
  let canvasOriginInitialized = false;

  function modelToCanvasX(x) {
    return x + CANVAS_ORIGIN_X;
  }

  function modelToCanvasY(y) {
    return y + CANVAS_ORIGIN_Y;
  }

  function nextAnimationFrame(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16);
  }

  function scheduleEdgesRender(guides = null, options = {}) {
    pendingAlignmentGuides = guides;
    if (edgeRenderFrame) return;
    const paintEdges = () => {
      edgeRenderFrame = 0;
      renderEdges();
      if (pendingAlignmentGuides?.length) {
        renderAlignmentGuides(pendingAlignmentGuides);
      }
      pendingAlignmentGuides = null;
    };
    edgeRenderFrame = nextAnimationFrame(() => {
      if (options.afterPaint) {
        nextAnimationFrame(paintEdges);
        return;
      }
      paintEdges();
    });
  }

  function scheduleMiniMapRender() {
    if (miniMapRenderFrame) return;
    miniMapRenderFrame = nextAnimationFrame(() => {
      miniMapRenderFrame = 0;
      renderMiniMap();
    });
  }

  /**
   * Right-click management for the element under the pointer (JUM-729 follow-up).
   *
   * Every item here acts on the model and re-renders; nothing opens a form.
   * The menu itself is `src/ui/contextMenu.js` — this decides what each kind
   * of element can do, which is knowledge about the model and belongs here.
   */
  function openElementMenu(event, title, items) {
    if (!contextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    contextMenu.open(event, title, items);
  }

  function canvasMenuItems(event) {
    const point = pointerToCanvasPoint(event.clientX, event.clientY);
    const selectedDomain = state.domains.find((domain) => domain.id === state.selectedDomainId);
    const nextDomainName = (() => {
      const names = new Set(state.domains.map((domain) => String(domain.name || '').toLowerCase()));
      for (let index = 1; index < 1000; index += 1) {
        const candidate = `Domain ${index}`;
        if (!names.has(candidate.toLowerCase())) return candidate;
      }
      return `Domain ${Date.now()}`;
    })();
    return [
      {
        label: 'Add domain here',
        run: () => {
          if (!addDomain) return;
          const domain = addDomain(nextDomainName, {
            x: snapCoordinate(state.view.snapToGrid, point.x - 240),
            y: snapCoordinate(state.view.snapToGrid, point.y - 80)
          });
          if (domain) render();
        }
      },
      {
        label: selectedDomain ? `Add entity to ${selectedDomain.name}` : 'Add entity to selected domain',
        disabled: !selectedDomain,
        run: () => {
          if (!selectedDomain) return;
          addEntity(selectedDomain.id, `Entity_${selectedDomain.entities.length + 1}`);
        }
      },
      {
        label: 'Add note here',
        run: () => addNote({
          x: snapCoordinate(state.view.snapToGrid, point.x),
          y: snapCoordinate(state.view.snapToGrid, point.y)
        })
      },
      { separator: true },
      { label: 'Auto layout', run: () => autoLayout() },
      { label: 'Fit view', run: () => fitView() },
      { label: 'Reset view', run: () => resetView() },
      { separator: true },
      { label: state.view.compactEntities ? 'Show full entities' : 'Compact entities', run: () => toggleCompactView() },
      {
        label: state.view.largeCanvasMode ? 'Show editable fields' : 'Optimize large canvas',
        run: () => {
          state.view.largeCanvasMode = !state.view.largeCanvasMode;
          render();
          saveState();
        }
      }
    ];
  }

  function domainMenuItems(domain) {
    return [
      {
        label: 'Add entity',
        run: () => {
          setSelectedDomain(domain.id);
          addEntity(domain.id, `Entity_${domain.entities.length + 1}`);
        }
      },
      {
        label: 'Fit box to contents',
        run: () => withPersist(() => {
          // The smallest box that still holds every entity — the same floor a
          // resize drag cannot go below.
          const fitted = minimumDomainSize(domain);
          domain.width = fitted.width;
          domain.height = fitted.height;
          render();
        })
      },
      {
        label: 'Reset box size',
        run: () => withPersist(() => {
          delete domain.width;
          delete domain.height;
          render();
        })
      },
      { separator: true },
      {
        label: 'Delete domain',
        danger: true,
        run: () => {
          if (!confirmAction(`Delete domain "${domain.name}" and everything in it?`)) return;
          deleteDomain(domain.id);
        }
      }
    ];
  }

  function entityMenuItems(domain, entity) {
    return [
      {
        label: 'Add field',
        run: () => withPersist(() => {
          entity.fields.push(normalizeField(
            { name: `field_${entity.fields.length + 1}`, type: 'string' },
            entity.fields.length
          ));
          render();
        })
      },
      {
        label: 'Aggregate root',
        checked: Boolean(entity?.meta?.aggregateRoot),
        run: () => withPersist(() => {
          entity.meta = entity.meta || {};
          entity.meta.aggregateRoot = !entity.meta.aggregateRoot;
          render();
        })
      },
      {
        label: 'Start a relationship from here',
        run: () => {
          setSelectedEntity(entity.id);
          handleEntityRelationshipPick(entity.id);
        }
      },
      { separator: true },
      {
        label: 'Delete entity',
        danger: true,
        run: () => {
          if (!confirmAction(`Delete entity "${entity.name}" and related links?`)) return;
          deleteEntity(entity.id);
        }
      }
    ];
  }

  function fieldMenuItems(entity, field, fieldIndex) {
    const move = (offset) => withPersist(() => {
      const target = fieldIndex + offset;
      if (target < 0 || target >= entity.fields.length) return;
      const [moved] = entity.fields.splice(fieldIndex, 1);
      entity.fields.splice(target, 0, moved);
      render();
    });
    const toggle = (key) => withPersist(() => {
      field[key] = !field[key];
      render();
    });

    return [
      { label: 'Primary key', checked: Boolean(field.pk), run: () => toggle('pk') },
      { label: 'Foreign key', checked: Boolean(field.fk), run: () => toggle('fk') },
      { label: 'Required', checked: Boolean(field.required), run: () => toggle('required') },
      { label: 'Unique', checked: Boolean(field.unique), run: () => toggle('unique') },
      { label: 'Indexed', checked: Boolean(field.indexed), run: () => toggle('indexed') },
      { label: 'Nullable', checked: Boolean(field.nullable), run: () => toggle('nullable') },
      { separator: true },
      { label: 'Move up', disabled: fieldIndex === 0, run: () => move(-1) },
      {
        label: 'Move down',
        disabled: fieldIndex === entity.fields.length - 1,
        run: () => move(1)
      },
      { separator: true },
      {
        label: 'Delete field',
        danger: true,
        // The last field cannot go: an entity with no fields exports an empty
        // schema and fails model validation on the primary key rule anyway.
        disabled: entity.fields.length <= 1,
        run: () => withPersist(() => {
          entity.fields.splice(fieldIndex, 1);
          render();
        })
      }
    ];
  }

  function stopCanvasInteraction(event) {
    event.stopPropagation();
  }

  function createFieldSchemaInput(field, label, key, options = {}) {
    const wrapper = document.createElement('label');
    wrapper.className = 'field-schema-control';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    const input = document.createElement('input');
    input.type = options.type || 'text';
    input.placeholder = options.placeholder || '';
    input.value = options.serialize ? options.serialize(field[key]) : String(field[key] ?? '');
    input.addEventListener('click', stopCanvasInteraction);
    input.addEventListener('pointerdown', stopCanvasInteraction);
    input.addEventListener('change', () => {
      withPersist(() => {
        field[key] = options.parse ? options.parse(input.value) : input.value.trim();
        render();
      });
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  function createFieldSchemaSelect(field, label, key, options) {
    const wrapper = document.createElement('label');
    wrapper.className = 'field-schema-control';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    const select = document.createElement('select');
    options.forEach((optionValue) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue || 'none';
      if (optionValue === (field[key] || '')) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('click', stopCanvasInteraction);
    select.addEventListener('pointerdown', stopCanvasInteraction);
    select.addEventListener('change', () => {
      withPersist(() => {
        field[key] = select.value;
        render();
      });
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  function createFieldSchemaEditor(field) {
    const details = document.createElement('details');
    details.className = 'field-schema-editor';
    details.addEventListener('click', stopCanvasInteraction);
    details.addEventListener('pointerdown', stopCanvasInteraction);
    const summary = document.createElement('summary');
    summary.textContent = 'OAS';
    summary.title = 'Edit OpenAPI schema attributes for this field';
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'field-schema-grid';
    grid.appendChild(createFieldSchemaSelect(field, 'format', 'format', [
      '',
      'uuid',
      'date',
      'date-time',
      'email',
      'uri',
      'int32',
      'int64',
      'float',
      'double'
    ]));
    grid.appendChild(createFieldSchemaInput(field, 'mask', 'pattern', { placeholder: 'regex pattern' }));
    grid.appendChild(createFieldSchemaInput(field, 'enum', 'enumValues', {
      placeholder: 'a,b,c',
      serialize: (value) => (Array.isArray(value) ? value.join(', ') : ''),
      parse: (value) => value.split(',').map((item) => item.trim()).filter(Boolean)
    }));
    grid.appendChild(createFieldSchemaSelect(field, 'items', 'itemsType', ['', ...FIELD_TYPES]));
    grid.appendChild(createFieldSchemaInput(field, 'min len', 'minLength', {
      type: 'number',
      parse: normalizeOptionalNumber
    }));
    grid.appendChild(createFieldSchemaInput(field, 'max len', 'maxLength', {
      type: 'number',
      parse: normalizeOptionalNumber
    }));
    grid.appendChild(createFieldSchemaInput(field, 'min', 'minimum', {
      type: 'number',
      parse: normalizeOptionalNumber
    }));
    grid.appendChild(createFieldSchemaInput(field, 'max', 'maximum', {
      type: 'number',
      parse: normalizeOptionalNumber
    }));
    const nullableLabel = document.createElement('label');
    nullableLabel.className = 'field-schema-check';
    const nullable = document.createElement('input');
    nullable.type = 'checkbox';
    nullable.checked = Boolean(field.nullable);
    nullable.addEventListener('click', stopCanvasInteraction);
    nullable.addEventListener('pointerdown', stopCanvasInteraction);
    nullable.addEventListener('change', () => {
      withPersist(() => {
        field.nullable = nullable.checked;
        render();
      });
    });
    nullableLabel.appendChild(nullable);
    nullableLabel.append(' nullable');
    grid.appendChild(nullableLabel);
    const indexedLabel = document.createElement('label');
    indexedLabel.className = 'field-schema-check';
    const indexed = document.createElement('input');
    indexed.type = 'checkbox';
    indexed.checked = Boolean(field.indexed);
    indexed.addEventListener('click', stopCanvasInteraction);
    indexed.addEventListener('pointerdown', stopCanvasInteraction);
    indexed.addEventListener('change', () => {
      withPersist(() => {
        field.indexed = indexed.checked;
        render();
      });
    });
    indexedLabel.appendChild(indexed);
    indexedLabel.append(' indexed');
    grid.appendChild(indexedLabel);
    details.appendChild(grid);
    return details;
  }

  function relationshipMenuItems(relationship) {
    const setCardinality = (from, to) => withPersist(() => {
      relationship.fromCardinality = from;
      relationship.toCardinality = to;
      render();
    });

    return [
      {
        label: 'Edit in inspector',
        run: () => {
          state.selectedRelationshipId = relationship.id;
          render();
        }
      },
      { separator: true },
      {
        label: '1 : 1',
        checked: relationship.fromCardinality === '1' && relationship.toCardinality === '1',
        run: () => setCardinality('1', '1')
      },
      {
        label: '1 : N',
        checked: relationship.fromCardinality === '1' && relationship.toCardinality === 'N',
        run: () => setCardinality('1', 'N')
      },
      {
        label: 'N : 1',
        checked: relationship.fromCardinality === 'N' && relationship.toCardinality === '1',
        run: () => setCardinality('N', '1')
      },
      {
        label: 'N : N',
        checked: relationship.fromCardinality === 'N' && relationship.toCardinality === 'N',
        run: () => setCardinality('N', 'N')
      },
      { separator: true },
      {
        label: 'Reverse direction',
        run: () => withPersist(() => {
          const fromEntityId = relationship.fromEntityId;
          const fromSide = relationship.fromAnchorSide;
          const fromCardinality = relationship.fromCardinality;
          relationship.fromEntityId = relationship.toEntityId;
          relationship.fromAnchorSide = relationship.toAnchorSide;
          relationship.fromCardinality = relationship.toCardinality;
          relationship.toEntityId = fromEntityId;
          relationship.toAnchorSide = fromSide;
          relationship.toCardinality = fromCardinality;
          render();
        })
      },
      {
        label: 'Straighten',
        // Clearing the bend returns the edge to the midpoint the renderer
        // computes, which is how it was drawn before anyone dragged it.
        run: () => withPersist(() => {
          delete relationship.bendX;
          delete relationship.bendY;
          render();
        })
      },
      { separator: true },
      {
        label: 'Delete relationship',
        danger: true,
        run: () => deleteRelationship(relationship.id)
      }
    ];
  }

  function renderView() {
    const zoom = clampZoom(state.view.zoom || 1);
    state.view.zoom = zoom;
    if (typeof state.view.snapToGrid !== 'boolean') state.view.snapToGrid = true;
    if (!['curved', 'orthogonal'].includes(state.view.edgeStyle)) state.view.edgeStyle = 'curved';
    if (!['info', 'warn', 'error'].includes(state.view.modelCheckMinSeverity)) state.view.modelCheckMinSeverity = 'info';
    if (typeof state.view.exportBlockCritical !== 'boolean') state.view.exportBlockCritical = true;
    if (typeof state.view.largeCanvasMode !== 'boolean') state.view.largeCanvasMode = false;
    dom.canvasInner.style.transform = `scale(${zoom})`;
    dom.canvasInner.style.width = `${VIRTUAL_CANVAS_WIDTH}px`;
    dom.canvasInner.style.height = `${VIRTUAL_CANVAS_HEIGHT}px`;
    dom.edges.style.left = `${CANVAS_ORIGIN_X}px`;
    dom.edges.style.top = `${CANVAS_ORIGIN_Y}px`;
    dom.edges.style.width = `${CANVAS_WIDTH}px`;
    dom.edges.style.height = `${CANVAS_HEIGHT}px`;
    if (!canvasOriginInitialized && dom.canvas.scrollLeft === 0 && dom.canvas.scrollTop === 0) {
      canvasOriginInitialized = true;
      dom.canvas.scrollLeft = CANVAS_ORIGIN_X * zoom;
      dom.canvas.scrollTop = CANVAS_ORIGIN_Y * zoom;
    }
    dom.canvas.classList.toggle('large-canvas-mode', Boolean(state.view.largeCanvasMode));
    dom.zoomIndicator.textContent = `${Math.round(zoom * 100)}%`;
    dom.toggleCompactViewBtn.textContent = state.view.compactEntities ? 'Full View' : 'Compact View';
    dom.toggleSnapBtn.textContent = state.view.snapToGrid ? 'Snap: On' : 'Snap: Off';
    dom.toggleLargeCanvasBtn.textContent = state.view.largeCanvasMode ? 'Large Canvas: On' : 'Large Canvas: Off';
    // Toggle semantics (JUM-488): the three view switches are aria-pressed
    // toggles; the pressed state mirrors the view flags they flip.
    dom.toggleCompactViewBtn.setAttribute('aria-pressed', String(Boolean(state.view.compactEntities)));
    dom.toggleSnapBtn.setAttribute('aria-pressed', String(Boolean(state.view.snapToGrid)));
    dom.toggleLargeCanvasBtn.setAttribute('aria-pressed', String(Boolean(state.view.largeCanvasMode)));
    dom.edgeStyleSelect.value = state.view.edgeStyle;
    dom.modelCheckMinSeveritySelect.value = state.view.modelCheckMinSeverity;
    dom.exportBlockCriticalCheck.checked = state.view.exportBlockCritical;
  }

  function setZoom(zoomValue) {
    state.view.zoom = clampZoom(zoomValue);
    renderView();
    scheduleMiniMapRender();
    saveState();
  }

  function zoomBy(delta) {
    setZoom((state.view.zoom || 1) + delta);
  }

  function zoomAtPointer(delta, event) {
    const previousZoom = clampZoom(state.view.zoom || 1);
    const nextZoom = clampZoom(previousZoom + delta);
    if (nextZoom === previousZoom) return;
    const rect = dom.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const modelX = (dom.canvas.scrollLeft + localX) / previousZoom;
    const modelY = (dom.canvas.scrollTop + localY) / previousZoom;
    state.view.zoom = nextZoom;
    renderView();
    dom.canvas.scrollLeft = modelX * nextZoom - localX;
    dom.canvas.scrollTop = modelY * nextZoom - localY;
    scheduleMiniMapRender();
    saveState();
  }

  function fitView() {
    const { zoom, left, top } = computeFitView(state.domains, dom.canvas.clientWidth, dom.canvas.clientHeight);
    state.view.zoom = zoom;
    renderView();
    dom.canvas.scrollTo({
      left: left + CANVAS_ORIGIN_X * zoom,
      top: top + CANVAS_ORIGIN_Y * zoom,
      behavior: 'smooth'
    });
    saveState();
  }

  function resetView() {
    state.view.zoom = 1;
    renderView();
    dom.canvas.scrollTo({ left: CANVAS_ORIGIN_X, top: CANVAS_ORIGIN_Y, behavior: 'smooth' });
    saveState();
  }

  function toggleCompactView() {
    state.view.compactEntities = !state.view.compactEntities;
    render();
    saveState();
  }

  function autoLayout() {
    withPersist(() => {
      applyAutoLayout(state.domains);
      render();
    });

    fitView();
  }

  function attachDrag(el, onMove, options = {}) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let totalDx = 0;
    let totalDy = 0;
    let moved = false;
    let started = false;
    let lastMoveEvent = null;

    const move = (event) => {
      if (pointerId !== event.pointerId) return;
      if (lastMoveEvent === event) return;
      lastMoveEvent = event;
      event.preventDefault();
      const zoom = state.view.zoom || 1;
      const dx = (event.clientX - startX) / zoom;
      const dy = (event.clientY - startY) / zoom;
      startX = event.clientX;
      startY = event.clientY;
      totalDx += dx;
      totalDy += dy;
      if (dx !== 0 || dy !== 0) moved = true;
      if (moved && !started && typeof options.onStart === 'function') {
        started = true;
        options.onStart(event);
      }
      onMove(dx, dy, event, { totalDx, totalDy });
    };

    const end = (event) => {
      if (pointerId !== event.pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      const ownerDocument = el.ownerDocument || document;
      ownerDocument.removeEventListener('pointermove', move, true);
      ownerDocument.removeEventListener('pointerup', end, true);
      ownerDocument.removeEventListener('pointercancel', end, true);
      pointerId = null;
      lastMoveEvent = null;
      if (typeof options.onEnd === 'function') options.onEnd(event, moved);
    };

    el.addEventListener('pointerdown', (event) => {
      if (typeof options.shouldStart === 'function' && !options.shouldStart(event)) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      totalDx = 0;
      totalDy = 0;
      moved = false;
      started = false;
      if (typeof options.onPointerDown === 'function') options.onPointerDown(event);
      el.setPointerCapture(pointerId);
      const ownerDocument = el.ownerDocument || document;
      ownerDocument.addEventListener('pointermove', move, true);
      ownerDocument.addEventListener('pointerup', end, true);
      ownerDocument.addEventListener('pointercancel', end, true);
    });

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function isDragInteractiveTarget(target) {
    return Boolean(target?.closest?.(
      'button, input, select, textarea, a, .entity-anchor, .field-link-handle, .domain-resize-handle, .edge-end-handle, .edge-bend-handle, .edge-hit'
    ));
  }

  function closeSidebarForCanvasWork() {
    if (sidebarGroups?.isOpen?.()) sidebarGroups.setDrawerOpen(false);
  }

  function relationshipFieldNamesForEntity(entityId) {
    return new Set(state.relationships.flatMap((relationship) => {
      const names = [];
      if (relationship.fromEntityId === entityId) {
        const fieldName = inferRelationshipFieldName(relationship, 'from');
        if (fieldName) names.push(fieldName);
      }
      if (relationship.toEntityId === entityId) {
        const fieldName = inferRelationshipFieldName(relationship, 'to');
        if (fieldName) names.push(fieldName);
      }
      return names;
    }));
  }

  function renderDomains() {
    dom.canvasInner.querySelectorAll('.domain').forEach((node) => node.remove());

    state.domains.forEach((domain) => {
      const domainEl = document.createElement('section');
      domainEl.className = `domain${state.selectedDomainId === domain.id ? ' selected' : ''}`;
      const box = domainBox(domain);
      domainEl.style.left = `${modelToCanvasX(domain.x)}px`;
      domainEl.style.top = `${modelToCanvasY(domain.y)}px`;
      domainEl.style.width = `${box.width}px`;
      domainEl.style.height = `${box.height}px`;
      domainEl.style.setProperty('--domain-color', domain.color);
      domainEl.onmousedown = () => setSelectedDomain(domain.id);
      domainEl.addEventListener('contextmenu', (event) => {
        // Only when the domain itself is the target: an entity or a field row
        // inside it owns its own menu, and this would otherwise swallow both.
        if (event.target !== domainEl && !event.target.classList.contains('domain-body')
          && !event.target.closest('.domain-header')) return;
        setSelectedDomain(domain.id);
        openElementMenu(event, `Domain "${domain.name}"`, domainMenuItems(domain));
      });

      const headerEl = document.createElement('header');
      headerEl.className = 'domain-header';
      headerEl.innerHTML = `<button class="domain-drag-grip" type="button" aria-label="Move domain ${domain.name}" title="Drag to move domain">::::</button><div class="domain-title">${domain.name}</div><div class="entity-count">${domain.entities.length} entities</div>`;
      domainEl.appendChild(headerEl);
      const domainDragGrip = headerEl.querySelector('.domain-drag-grip');

      const collapsed = isDomainCollapsed(domain);
      if (collapsed) domainEl.classList.add('collapsed');

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'domain-collapse-btn';
      collapseBtn.textContent = collapsed ? '▸' : '▾';
      collapseBtn.setAttribute(
        'aria-expanded', String(!collapsed)
      );
      collapseBtn.setAttribute(
        'aria-label',
        `${collapsed ? 'Expand' : 'Collapse'} domain "${domain.name}"`
      );
      collapseBtn.addEventListener('pointerdown', (event) => event.stopPropagation());
      collapseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        withPersist(() => {
          domain.collapsed = !domain.collapsed;
          render();
        });
      });
      headerEl.insertBefore(collapseBtn, headerEl.firstChild);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'domain-body';

      let domainDragOrigin = null;
      const moveDomain = (_dx, _dy, _event, drag) => {
        const origin = domainDragOrigin || { x: domain.x, y: domain.y };
        domain.x = origin.x + drag.totalDx;
        domain.y = origin.y + drag.totalDy;
        domainEl.style.left = `${modelToCanvasX(domain.x)}px`;
        domainEl.style.top = `${modelToCanvasY(domain.y)}px`;
        scheduleEdgesRender();
        scheduleMiniMapRender();
      };
      const persistMovedDomain = {
        onStart: () => {
          closeSidebarForCanvasWork();
          domainEl.classList.add('dragging');
          domainDragOrigin = { x: domain.x, y: domain.y };
        },
        onEnd: (_event, moved) => {
          domainEl.classList.remove('dragging');
          if (domainDragOrigin) {
            domain.x = snapCoordinate(state.view.snapToGrid, domain.x);
            domain.y = snapCoordinate(state.view.snapToGrid, domain.y);
            domainEl.style.left = `${modelToCanvasX(domain.x)}px`;
            domainEl.style.top = `${modelToCanvasY(domain.y)}px`;
            domainDragOrigin = null;
          }
          if (!moved) return;
          saveState();
          render();
        }
      };
      attachDrag(headerEl, moveDomain, {
        ...persistMovedDomain,
        shouldStart: (event) => event.button === 0 && !isDragInteractiveTarget(event.target)
      });
      attachDrag(domainDragGrip, moveDomain, persistMovedDomain);

      attachDrag(bodyEl, moveDomain, {
        ...persistMovedDomain,
        shouldStart: (event) => event.button === 0
          && !event.target.closest('.entity')
          && !isDragInteractiveTarget(event.target)
      });

      if (collapsed) {
        // Its entities are still in the model and still the ends of their
        // relationships; they just have no box on screen. `renderEdges` falls
        // back to the domain box for an entity it cannot place.
        domainEl.appendChild(resizeHandleFor(domain, domainEl, collapsed));
        dom.canvasInner.appendChild(domainEl);
        return;
      }

      domain.entities.forEach((entity) => {
        const connectedFieldNames = relationshipFieldNamesForEntity(entity.id);
        const entityEl = document.createElement('article');
        const inMultiSelection = Array.isArray(state.selectedEntityIds)
          && state.selectedEntityIds.includes(entity.id);
        const selectedClass = (state.selectedEntityId === entity.id || inMultiSelection)
          ? ' selected'
          : '';
        entityEl.className = `entity${selectedClass}`;
        entityEl.dataset.entityId = entity.id;
        entityEl.style.left = `${entity.x}px`;
        entityEl.style.top = `${entity.y}px`;
        entityEl.style.width = `${entityWidth(entity)}px`;
        entityEl.style.minHeight = `${entityBoxHeight(entity, state.view.compactEntities, state.view.largeCanvasMode)}px`;
        entityEl.addEventListener('pointerup', (event) => {
          // JUM-729 follow-up: the whole card is a drop target, not only its four dots.
          // Dropping had to hit an 8px anchor button, which is why creating a
          // link so often ended with the preview simply disappearing.
          if (!interaction.relationshipAnchorDragActive) return;
          const fromEntityId = interaction.relationshipAnchorFromEntityId;
          if (!fromEntityId || fromEntityId === entity.id) {
            stopAnchorDrag();
            return;
          }
          event.stopPropagation();
          const fromPoint = edgeEndpoint(
            fromEntityId,
            interaction.relationshipAnchorFromSide,
            interaction.relationshipAnchorFromField
          );
          const targetRow = event.target.closest('.entity-field-row');
          const targetIndex = targetRow ? Number(targetRow.dataset.fieldIndex) : -1;
          const targetField = entity.fields[targetIndex];
          const side = facingSide(fromPoint ? fromPoint.x : 0, domain.x + entity.x);
          addRelationshipFromAnchor(fromEntityId, entity.id, side, {
            fromField: interaction.relationshipAnchorFromField || null,
            toField: targetField ? targetField.name : null
          });
          stopAnchorDrag();
        });
        entityEl.addEventListener('contextmenu', (event) => {
          if (event.target.closest('.entity-field-row')) return;
          setSelectedEntity(entity.id);
          openElementMenu(event, `Entity "${entity.name}"`, entityMenuItems(domain, entity));
        });
        entityEl.onclick = (event) => {
          event.stopPropagation();
          setSelectedEntity(entity.id);
          handleEntityRelationshipPick(entity.id);
        };

        const entityHeader = document.createElement('header');
        entityHeader.className = 'entity-header';
        const entityDragGrip = document.createElement('button');
        entityDragGrip.type = 'button';
        entityDragGrip.className = 'entity-drag-grip';
        entityDragGrip.textContent = '::::';
        entityDragGrip.setAttribute('aria-label', `Move entity "${entity.name}"`);
        entityDragGrip.title = `Drag to move entity "${entity.name}"`;
        entityHeader.appendChild(entityDragGrip);
        const entityNameEl = document.createElement('input');
        entityNameEl.className = 'entity-name-input';
        entityNameEl.value = entity.name;
        entityNameEl.setAttribute('aria-label', `Name of entity "${entity.name}"`);
        entityNameEl.addEventListener('click', (event) => event.stopPropagation());
        entityNameEl.addEventListener('pointerdown', (event) => event.stopPropagation());
        entityNameEl.addEventListener('pointerup', () => {
          if (!entityDragOrigin) entityNameEl.focus();
        });
        entityNameEl.addEventListener('change', () => {
          const nextName = entityNameEl.value.trim();
          if (!nextName || nextName === entity.name) {
            entityNameEl.value = entity.name;
            return;
          }
          withPersist(() => {
            entity.name = nextName;
            render();
          });
        });
        entityHeader.appendChild(entityNameEl);
        if (entity?.meta?.aggregateRoot) {
          const aggregateTag = document.createElement('span');
          aggregateTag.className = 'entity-aggregate-tag';
          aggregateTag.textContent = 'AR';
          entityHeader.appendChild(aggregateTag);
        }
        let entityDragOrigin = null;
        const moveEntity = (_dx, _dy, _event, drag) => {
          const origin = entityDragOrigin || { x: entity.x, y: entity.y };
          moveEntityInsideDomain(entity, entityEl, {
            x: origin.x + drag.totalDx,
            y: origin.y + drag.totalDy,
            snap: false,
            align: false,
            liveTransformOrigin: origin
          });
        };
        const persistMovedEntity = {
          onStart: () => {
            closeSidebarForCanvasWork();
            domainEl.classList.add('dragging');
            entityEl.classList.add('dragging');
            entityDragOrigin = { x: entity.x, y: entity.y };
          },
          onEnd: (_event, moved) => {
            clearAlignmentGuides();
            domainEl.classList.remove('dragging');
            entityEl.classList.remove('dragging');
            if (entityDragOrigin) {
              moveEntityInsideDomain(entity, entityEl, {
                x: entity.x,
                y: entity.y,
                snap: true,
                align: true
              });
              entityDragOrigin = null;
            }
            if (!moved) return;
            saveState();
            render();
          }
        };
        attachDrag(entityHeader, moveEntity, {
          ...persistMovedEntity,
          shouldStart: (event) => event.button === 0
            && !event.target.closest('button, select, textarea, a, .field-link-handle, .entity-anchor')
        });
        attachDrag(entityDragGrip, moveEntity, persistMovedEntity);
        attachDrag(entityEl, moveEntity, {
          ...persistMovedEntity,
          shouldStart: (event) => event.button === 0
            && !event.target.closest('.entity-header')
            && !isDragInteractiveTarget(event.target)
        });

        const fieldsEl = document.createElement('ul');
        fieldsEl.className = 'entity-fields';
        if (!state.view.compactEntities) {
          // JUM-729 follow-up: the field rows are editable in place. They used to be a
          // line of text per field, so every change — a rename, a type, a
          // required flag — meant selecting the entity, finding the field in
          // the sidebar inspector and editing it there, while the thing being
          // edited was on the canvas.
          //
          // Large-canvas mode keeps the read-only line: it exists to make a
          // big model cheap to draw, and a row of controls per field is the
          // opposite of that.
          entity.fields.forEach((field, fieldIndex) => {
            const li = document.createElement('li');
            li.className = `entity-field-row${connectedFieldNames.has(field.name) ? ' relationship-field-connected' : ''}`;
            if (state.view.largeCanvasMode) {
              li.textContent = fieldLabel(field);
              fieldsEl.appendChild(li);
              return;
            }

            const keyBtn = document.createElement('button');
            keyBtn.type = 'button';
            keyBtn.className = `field-flag field-pk${field.pk ? ' on' : ''}`;
            keyBtn.textContent = 'PK';
            keyBtn.setAttribute(
              'aria-label',
              `${field.pk ? 'Unset' : 'Set'} primary key on field "${field.name}"`
            );
            keyBtn.addEventListener('click', (event) => {
              event.stopPropagation();
              withPersist(() => {
                field.pk = !field.pk;
                render();
              });
            });
            li.appendChild(keyBtn);

            const nameEl = document.createElement('input');
            nameEl.className = 'field-name-input';
            nameEl.value = field.name;
            nameEl.setAttribute('aria-label', `Name of field "${field.name}"`);
            nameEl.addEventListener('click', (event) => event.stopPropagation());
            nameEl.addEventListener('pointerdown', (event) => event.stopPropagation());
            nameEl.addEventListener('pointerup', () => nameEl.focus());
            nameEl.addEventListener('change', () => {
              const nextName = nameEl.value.trim();
              if (!nextName || nextName === field.name) {
                nameEl.value = field.name;
                return;
              }
              withPersist(() => {
                field.name = nextName;
                render();
              });
            });
            li.appendChild(nameEl);

            const typeEl = document.createElement('select');
            typeEl.className = 'field-type-select';
            typeEl.setAttribute('aria-label', `Type of field "${field.name}"`);
            FIELD_TYPES.forEach((type) => {
              const option = document.createElement('option');
              option.value = type;
              option.textContent = type;
              if (type === field.type) option.selected = true;
              typeEl.appendChild(option);
            });
            typeEl.addEventListener('click', (event) => event.stopPropagation());
            typeEl.addEventListener('pointerdown', (event) => event.stopPropagation());
            typeEl.addEventListener('pointerup', () => typeEl.focus());
            typeEl.addEventListener('change', () => {
              withPersist(() => {
                field.type = typeEl.value;
                if (field.type !== 'array') field.itemsType = '';
                if (field.type === 'array' && !field.itemsType) field.itemsType = 'string';
                render();
              });
            });
            li.appendChild(typeEl);

            [
              { key: 'required', label: 'REQ', title: 'required' },
              { key: 'unique', label: 'UQ', title: 'unique' },
              { key: 'indexed', label: 'IDX', title: 'indexed' }
            ].forEach((flag) => {
              const flagBtn = document.createElement('button');
              flagBtn.type = 'button';
              flagBtn.className = `field-flag${field[flag.key] ? ' on' : ''}`;
              flagBtn.textContent = flag.label;
              flagBtn.setAttribute(
                'aria-label',
                `${field[flag.key] ? 'Clear' : 'Set'} ${flag.title} on field "${field.name}"`
              );
              flagBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                withPersist(() => {
                  field[flag.key] = !field[flag.key];
                  render();
                });
              });
              li.appendChild(flagBtn);
            });

            const linkBtn = document.createElement('button');
            linkBtn.type = 'button';
            linkBtn.className = 'field-link-handle';
            linkBtn.setAttribute(
              'aria-label',
              `Drag from field "${field.name}" to another entity to create a relationship`
            );
            linkBtn.title = 'Drag to another entity to relate';
            linkBtn.addEventListener('pointerdown', (event) => {
              event.stopPropagation();
              startAnchorDrag(entity.id, 'right', event, field.name);
            });
            li.appendChild(linkBtn);
            li.appendChild(createFieldSchemaEditor(field));

            li.dataset.fieldIndex = String(fieldIndex);
            li.dataset.fieldName = field.name;
            li.addEventListener('contextmenu', (event) => {
              setSelectedEntity(entity.id);
              openElementMenu(
                event,
                `Field "${field.name}"`,
                fieldMenuItems(entity, field, fieldIndex)
              );
            });
            fieldsEl.appendChild(li);
          });

          if (!state.view.largeCanvasMode) {
            const addFieldItem = document.createElement('li');
            addFieldItem.className = 'entity-field-add';
            const addFieldBtn = document.createElement('button');
            addFieldBtn.type = 'button';
            addFieldBtn.textContent = 'Add field';
            addFieldBtn.setAttribute('aria-label', `Add field to entity "${entity.name}"`);
            addFieldBtn.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              withPersist(() => {
                entity.fields.push(normalizeField(
                  { name: `field_${entity.fields.length + 1}`, type: 'string' },
                  entity.fields.length
                ));
                render();
              });
            });
            addFieldBtn.addEventListener('pointerdown', (event) => {
              event.preventDefault();
              event.stopPropagation();
              addFieldBtn.focus();
            });
            addFieldBtn.addEventListener('pointerup', (event) => {
              event.preventDefault();
              event.stopPropagation();
              addFieldBtn.focus();
            });
            addFieldItem.appendChild(addFieldBtn);
            fieldsEl.appendChild(addFieldItem);
          }
        }

        const anchorSides = ['top', 'right', 'bottom', 'left'];
        anchorSides.forEach((side) => {
          const anchorBtn = document.createElement('button');
          anchorBtn.type = 'button';
          anchorBtn.className = `entity-anchor entity-anchor-${side}`;
          anchorBtn.title = `Drag from ${entity.name} (${side}) to create relationship`;
          anchorBtn.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            startAnchorDrag(entity.id, side, event);
          });
          anchorBtn.addEventListener('pointerup', (event) => {
            if (!interaction.relationshipAnchorDragActive) return;
            event.stopPropagation();
            const fromEntityId = interaction.relationshipAnchorFromEntityId;
            if (!fromEntityId || fromEntityId === entity.id) {
              stopAnchorDrag();
              return;
            }
            addRelationshipFromAnchor(fromEntityId, entity.id, side, {
              fromField: interaction.relationshipAnchorFromField || null,
              toField: null
            });
            stopAnchorDrag();
          });
          entityEl.appendChild(anchorBtn);
        });

        entityEl.appendChild(entityHeader);
        entityEl.appendChild(fieldsEl);
        entityEl.appendChild(resizeHandleForEntity(domain, entity, entityEl));
        bodyEl.appendChild(entityEl);
      });

      domainEl.appendChild(bodyEl);

      domainEl.appendChild(resizeHandleFor(domain, domainEl, false));

      dom.canvasInner.appendChild(domainEl);
    });
  }

  /**
   * The bottom-right resize grip (JUM-729 follow-up).
   *
   * A button rather than a bare div so it is reachable by keyboard and carries
   * an accessible name naming the domain it resizes (JUM-732's rule).
   */
  function resizeHandleFor(domain, domainEl, collapsed) {
    const resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'domain-resize-handle';
    resizeHandle.setAttribute('aria-label', `Resize domain "${domain.name}"`);
    resizeHandle.title = `Resize domain "${domain.name}"`;
    let resizeOrigin = null;
    attachDrag(resizeHandle, (_dx, _dy, _event, drag) => {
      const current = resizeOrigin || domainBox(domain);
      const resized = resizeDomainBox(
        domain,
        current.width + drag.totalDx,
        current.height + drag.totalDy
      );
      domain.width = resized.width;
      domain.height = resized.height;
      domainEl.style.width = `${resized.width}px`;
      domainEl.style.height = `${resized.height}px`;
      scheduleEdgesRender();
      scheduleMiniMapRender();
    }, {
      onStart: () => {
        closeSidebarForCanvasWork();
        resizeOrigin = domainBox(domain);
      },
      onEnd: (_event, moved) => {
        if (resizeOrigin) {
          const resized = resizeDomainBox(
            domain,
            snapCoordinate(state.view.snapToGrid, domain.width),
            snapCoordinate(state.view.snapToGrid, domain.height)
          );
          domain.width = resized.width;
          domain.height = resized.height;
          domainEl.style.width = `${resized.width}px`;
          domainEl.style.height = `${resized.height}px`;
          resizeOrigin = null;
        }
        if (!moved) return;
        saveState();
        render();
      }
    });
    resizeHandle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 40 : 16;
      const deltas = {
        ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step]
      };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();
      withPersist(() => {
        const current = domainBox(domain);
        const resized = resizeDomainBox(domain, current.width + delta[0], current.height + delta[1]);
        domain.width = resized.width;
        domain.height = resized.height;
        render();
      });
    });
    // A collapsed domain has no height of its own to drag.
    resizeHandle.hidden = Boolean(collapsed);
    return resizeHandle;
  }

  function resizeHandleForEntity(domain, entity, entityEl) {
    const resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'entity-resize-handle';
    resizeHandle.setAttribute('aria-label', `Resize entity "${entity.name}"`);
    resizeHandle.title = `Resize entity "${entity.name}"`;
    let resizeOrigin = null;
    attachDrag(resizeHandle, (_dx, _dy, _event, drag) => {
      const current = resizeOrigin || {
        width: entityWidth(entity),
        height: entityBoxHeight(entity, state.view.compactEntities, state.view.largeCanvasMode)
      };
      const resized = resizeEntityBox(
        entity,
        current.width + drag.totalDx,
        current.height + drag.totalDy,
        state.view.compactEntities,
        state.view.largeCanvasMode
      );
      const maxWidth = Math.max(220, domainBox(domain).width - entity.x - 8);
      const maxHeight = Math.max(96, domainBox(domain).height - entity.y - 8);
      entity.width = Math.min(maxWidth, resized.width);
      entity.height = Math.min(maxHeight, resized.height);
      entityEl.style.width = `${entity.width}px`;
      entityEl.style.minHeight = `${entity.height}px`;
      scheduleEdgesRender();
      scheduleMiniMapRender();
    }, {
      onStart: () => {
        closeSidebarForCanvasWork();
        resizeOrigin = {
          width: entityWidth(entity),
          height: entityBoxHeight(entity, state.view.compactEntities, state.view.largeCanvasMode)
        };
        entityEl.classList.add('resizing');
      },
      onEnd: (_event, moved) => {
        entityEl.classList.remove('resizing');
        if (resizeOrigin) {
          const resized = resizeEntityBox(
            entity,
            snapCoordinate(state.view.snapToGrid, entityWidth(entity)),
            snapCoordinate(state.view.snapToGrid, entityBoxHeight(entity, state.view.compactEntities, state.view.largeCanvasMode)),
            state.view.compactEntities,
            state.view.largeCanvasMode
          );
          entity.width = resized.width;
          entity.height = resized.height;
          entityEl.style.width = `${resized.width}px`;
          entityEl.style.minHeight = `${resized.height}px`;
          resizeOrigin = null;
        }
        if (!moved) return;
        saveState();
        render();
      }
    });
    return resizeHandle;
  }

  function moveEntityInsideDomain(entity, entityEl, target) {
    // JUM-729 follow-up: the limits come from the domain's own box, so an entity can
    // use the room a resize just added.
    const owner = state.domains.find(
      (candidate) => candidate.entities.some((member) => member.id === entity.id)
    );
    const clamped = clampEntityPosition(
      owner,
      target.snap ? snapCoordinate(state.view.snapToGrid, target.x) : target.x,
      target.snap ? snapCoordinate(state.view.snapToGrid, target.y) : target.y,
      entity,
      state.view.compactEntities,
      state.view.largeCanvasMode
    );
    // JUM-729 follow-up: grid snapping keeps positions tidy without making anything
    // line up — two entities can both sit on the grid four pixels apart,
    // which is exactly the misalignment a reader notices. This pulls the
    // dragged entity onto a sibling's edge or centre when it comes close,
    // and draws what it snapped to.
    const aligned = target.align
      ? alignmentGuidesFor(owner, entity, clamped.x, clamped.y, {
        compactEntities: state.view.compactEntities,
        largeCanvasMode: state.view.largeCanvasMode
      })
      : { x: clamped.x, y: clamped.y, guides: [] };
    entity.x = aligned.x;
    entity.y = aligned.y;
    if (target.liveTransformOrigin) {
      const dx = entity.x - target.liveTransformOrigin.x;
      const dy = entity.y - target.liveTransformOrigin.y;
      entityEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    } else {
      entityEl.style.left = `${entity.x}px`;
      entityEl.style.top = `${entity.y}px`;
      entityEl.style.transform = '';
    }
    scheduleEdgesRender(aligned.guides, { afterPaint: Boolean(target.liveTransformOrigin) });
  }

  /**
   * Draw the alignment guides for the drag in progress (JUM-729 follow-up).
   *
   * They live in the edge SVG, which already spans the whole canvas in canvas
   * coordinates, and are cleared on the next move or when the drag ends — a
   * guide left behind claims an alignment that is no longer true.
   */
  function renderAlignmentGuides(guides) {
    clearAlignmentGuides();
    (guides || []).forEach((guide) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'alignment-guide');
      if (guide.axis === 'x') {
        line.setAttribute('x1', String(guide.at));
        line.setAttribute('x2', String(guide.at));
        line.setAttribute('y1', '0');
        line.setAttribute('y2', String(CANVAS_HEIGHT));
      } else {
        line.setAttribute('x1', '0');
        line.setAttribute('x2', String(CANVAS_WIDTH));
        line.setAttribute('y1', String(guide.at));
        line.setAttribute('y2', String(guide.at));
      }
      dom.edges.appendChild(line);
    });
  }

  function clearAlignmentGuides() {
    dom.edges.querySelectorAll('.alignment-guide').forEach((node) => node.remove());
  }

  /**
   * Sticky notes on the canvas (JUM-729 follow-up).
   *
   * The model records what the system is; a note records what the people
   * modelling it need to remember while they work — an open question, a
   * decision and its reason. It sits next to the thing it is about and stays
   * out of the OAS export and the generator: it is not part of the contract.
   */
  function renderNotes() {
    dom.canvasInner.querySelectorAll('.canvas-note').forEach((node) => node.remove());

    (state.notes || []).forEach((note) => {
      const noteEl = document.createElement('div');
      noteEl.className = 'canvas-note';
      noteEl.style.left = `${modelToCanvasX(note.x)}px`;
      noteEl.style.top = `${modelToCanvasY(note.y)}px`;
      noteEl.style.background = note.color;

      const grip = document.createElement('div');
      grip.className = 'canvas-note-grip';
      grip.title = 'Drag to move this note';
      let noteDragOrigin = null;
      attachDrag(grip, (_dx, _dy, _event, drag) => {
        const origin = noteDragOrigin || { x: note.x, y: note.y };
        note.x = origin.x + drag.totalDx;
        note.y = origin.y + drag.totalDy;
        noteEl.style.left = `${modelToCanvasX(note.x)}px`;
        noteEl.style.top = `${modelToCanvasY(note.y)}px`;
      }, {
        onStart: () => {
          noteDragOrigin = { x: note.x, y: note.y };
          withPersist(() => {});
        },
        onEnd: (_event, moved) => {
          if (noteDragOrigin) {
            note.x = snapCoordinate(state.view.snapToGrid, note.x);
            note.y = snapCoordinate(state.view.snapToGrid, note.y);
            noteEl.style.left = `${modelToCanvasX(note.x)}px`;
            noteEl.style.top = `${modelToCanvasY(note.y)}px`;
            noteDragOrigin = null;
          }
          if (moved) saveState();
        }
      });
      noteEl.appendChild(grip);

      const text = document.createElement('textarea');
      text.className = 'canvas-note-text';
      text.value = note.text;
      text.placeholder = 'Note…';
      text.setAttribute('aria-label', 'Canvas note');
      text.addEventListener('pointerdown', (event) => event.stopPropagation());
      text.addEventListener('change', () => {
        withPersist(() => {
          note.text = text.value;
        });
      });
      noteEl.appendChild(text);

      noteEl.addEventListener('contextmenu', (event) => {
        openElementMenu(event, 'Note', [
          {
            label: 'Delete note',
            danger: true,
            run: () => withPersist(() => {
              state.notes = state.notes.filter((candidate) => candidate.id !== note.id);
              render();
            })
          }
        ]);
      });

      dom.canvasInner.appendChild(noteEl);
    });
  }

  /** Drop a note at a point or at the centre of what is currently on screen. */
  function addNote(position = null) {
    withPersist(() => {
      const zoom = state.view.zoom || 1;
      const centre = position || {
        x: Math.round((dom.canvas.scrollLeft + dom.canvas.clientWidth / 2) / zoom - CANVAS_ORIGIN_X),
        y: Math.round((dom.canvas.scrollTop + dom.canvas.clientHeight / 2) / zoom - CANVAS_ORIGIN_Y)
      };
      state.notes = [...(state.notes || []), {
        id: `note-${String(Date.now())}`,
        text: '',
        x: centre.x,
        y: centre.y,
        color: '#fde68a'
      }];
      render();
    });
  }

  function pointOffsetBySide(point, side, distance) {
    if (side === 'left') return { x: point.x - distance, y: point.y };
    if (side === 'right') return { x: point.x + distance, y: point.y };
    if (side === 'top') return { x: point.x, y: point.y - distance };
    if (side === 'bottom') return { x: point.x, y: point.y + distance };
    return point;
  }

  function normalizeRoutePoints(points) {
    const unique = points.filter((point, index) => {
      const previous = points[index - 1];
      return !previous || previous.x !== point.x || previous.y !== point.y;
    });
    const simplified = [];
    unique.forEach((point) => {
      simplified.push(point);
      while (simplified.length >= 3) {
        const end = simplified[simplified.length - 1];
        const middle = simplified[simplified.length - 2];
        const start = simplified[simplified.length - 3];
        const collinear = (start.x === middle.x && middle.x === end.x)
          || (start.y === middle.y && middle.y === end.y);
        const tinyDogleg = Math.abs(end.x - middle.x) + Math.abs(end.y - middle.y) < 8
          || Math.abs(middle.x - start.x) + Math.abs(middle.y - start.y) < 8;
        const remainsOrthogonal = start.x === end.x || start.y === end.y;
        if (!collinear && (!tinyDogleg || !remainsOrthogonal)) break;
        simplified.splice(simplified.length - 2, 1);
      }
    });
    return simplified;
  }

  function allEntityBounds(excludeIds = new Set()) {
    const compact = Boolean(state.view.compactEntities);
    const large = Boolean(state.view.largeCanvasMode);
    return state.domains.flatMap((domain) => domain.entities
      .filter((entity) => !excludeIds.has(entity.id))
      .map((entity) => ({
        entityId: entity.id,
        x: domain.x + entity.x - 14,
        y: domain.y + entity.y - 14,
        width: entityWidth(entity) + 28,
        height: entityBoxHeight(entity, compact, large) + 28
      })));
  }

  function segmentIntersectsBox(a, b, box) {
    if (a.x === b.x) {
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      return a.x >= box.x
        && a.x <= box.x + box.width
        && maxY >= box.y
        && minY <= box.y + box.height;
    }
    if (a.y === b.y) {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      return a.y >= box.y
        && a.y <= box.y + box.height
        && maxX >= box.x
        && minX <= box.x + box.width;
    }
    return false;
  }

  function routeLength(points) {
    return points.slice(1).reduce((total, point, index) => {
      const previous = points[index];
      return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
    }, 0);
  }

  function routeCollisionCount(points, obstacles) {
    return points.slice(1).reduce((total, point, index) => {
      const previous = points[index];
      return total + obstacles.filter((box) => segmentIntersectsBox(previous, point, box)).length;
    }, 0);
  }

  function sideDirection(side) {
    if (side === 'left') return { x: -1, y: 0 };
    if (side === 'right') return { x: 1, y: 0 };
    if (side === 'top') return { x: 0, y: -1 };
    if (side === 'bottom') return { x: 0, y: 1 };
    return { x: 0, y: 0 };
  }

  function pointInsideBox(point, box, padding = 0) {
    return point.x >= box.x - padding
      && point.x <= box.x + box.width + padding
      && point.y >= box.y - padding
      && point.y <= box.y + box.height + padding;
  }

  function routeBendCount(points) {
    return points.slice(2).reduce((total, point, index) => {
      const previous = points[index + 1];
      const beforePrevious = points[index];
      const previousHorizontal = beforePrevious.y === previous.y;
      const currentHorizontal = previous.y === point.y;
      return total + (previousHorizontal === currentHorizontal ? 0 : 1);
    }, 0);
  }

  function relationshipRouteOrdinal(relationship) {
    const sorted = [...state.relationships]
      .filter((candidate) => {
        const sameDirection = candidate.fromEntityId === relationship.fromEntityId
          && candidate.toEntityId === relationship.toEntityId;
        const oppositeDirection = candidate.fromEntityId === relationship.toEntityId
          && candidate.toEntityId === relationship.fromEntityId;
        return sameDirection || oppositeDirection;
      })
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const index = Math.max(0, sorted.findIndex((candidate) => candidate.id === relationship.id));
    return index - (sorted.length - 1) / 2;
  }

  function routeExitPenalty(points, relationship) {
    const fromDirection = sideDirection(relationship.fromAnchorSide);
    const toDirection = sideDirection(relationship.toAnchorSide);
    const first = points[1] || points[0];
    const second = points[2] || first;
    const beforeLast = points[points.length - 3] || points[points.length - 2];
    const lastStub = points[points.length - 2] || points[points.length - 1];
    const sourceBacktracks =
      (fromDirection.x && Math.sign(second.x - first.x || fromDirection.x) !== fromDirection.x)
      || (fromDirection.y && Math.sign(second.y - first.y || fromDirection.y) !== fromDirection.y);
    const targetBacktracks =
      (toDirection.x && Math.sign(beforeLast.x - lastStub.x || -toDirection.x) !== -toDirection.x)
      || (toDirection.y && Math.sign(beforeLast.y - lastStub.y || -toDirection.y) !== -toDirection.y);
    return (sourceBacktracks ? 18000 : 0) + (targetBacktracks ? 18000 : 0);
  }

  function routeSelfCrossPenalty(points) {
    return points.slice(2).reduce((total, point, index) => {
      const beforePrevious = points[index];
      const previous = points[index + 1];
      const sameXTurnback = beforePrevious.x === previous.x && previous.x === point.x
        && Math.sign(previous.y - beforePrevious.y) !== Math.sign(point.y - previous.y);
      const sameYTurnback = beforePrevious.y === previous.y && previous.y === point.y
        && Math.sign(previous.x - beforePrevious.x) !== Math.sign(point.x - previous.x);
      return total + (sameXTurnback || sameYTurnback ? 9000 : 0);
    }, 0);
  }

  function scoreRoute(points, obstacles, relationship) {
    const collisions = routeCollisionCount(points, obstacles);
    const labelPoint = routeLabelPoint(points);
    const labelCollisions = obstacles.filter((box) => pointInsideBox(labelPoint, box, 18)).length;
    return collisions * 120000
      + labelCollisions * 45000
      + routeExitPenalty(points, relationship)
      + routeSelfCrossPenalty(points)
      + routeLength(points)
      + routeBendCount(points) * 520
      + points.length * 80;
  }

  function laneDirection(anchorSide, fallback) {
    const direction = sideDirection(anchorSide);
    return {
      x: direction.x || fallback.x,
      y: direction.y || fallback.y
    };
  }

  function automaticEdgeRoutePoints(relationship, from, to, fromStub, toStub, obstacles) {
    const minX = Math.min(from.x, to.x, fromStub.x, toStub.x);
    const maxX = Math.max(from.x, to.x, fromStub.x, toStub.x);
    const minY = Math.min(from.y, to.y, fromStub.y, toStub.y);
    const maxY = Math.max(from.y, to.y, fromStub.y, toStub.y);
    const ordinal = relationshipRouteOrdinal(relationship);
    const stagger = ordinal * 20;
    const midX = Math.round((fromStub.x + toStub.x) / 2 + stagger);
    const midY = Math.round((fromStub.y + toStub.y) / 2 + stagger);
    const nearLane = 34 + Math.abs(stagger);
    const farLane = 72 + Math.abs(stagger);
    const fallback = {
      x: fromStub.x <= toStub.x ? 1 : -1,
      y: fromStub.y <= toStub.y ? 1 : -1
    };
    const fromDirection = laneDirection(relationship.fromAnchorSide, fallback);
    const toDirection = laneDirection(relationship.toAnchorSide, { x: -fallback.x, y: -fallback.y });
    const xLanes = [
      midX,
      fromStub.x + fromDirection.x * nearLane,
      fromStub.x + fromDirection.x * farLane,
      toStub.x + toDirection.x * nearLane,
      toStub.x + toDirection.x * farLane,
      minX - farLane,
      maxX + farLane
    ];
    const yLanes = [
      midY,
      fromStub.y + fromDirection.y * nearLane,
      fromStub.y + fromDirection.y * farLane,
      toStub.y + toDirection.y * nearLane,
      toStub.y + toDirection.y * farLane,
      minY - farLane,
      maxY + farLane
    ];
    const candidates = [
      [from, fromStub, { x: midX, y: fromStub.y }, { x: midX, y: toStub.y }, toStub, to],
      [from, fromStub, { x: fromStub.x, y: midY }, { x: toStub.x, y: midY }, toStub, to],
      [from, fromStub, { x: fromStub.x + nearLane, y: fromStub.y }, { x: fromStub.x + nearLane, y: toStub.y }, toStub, to],
      [from, fromStub, { x: fromStub.x - nearLane, y: fromStub.y }, { x: fromStub.x - nearLane, y: toStub.y }, toStub, to],
      [from, fromStub, { x: fromStub.x, y: fromStub.y + nearLane }, { x: toStub.x, y: fromStub.y + nearLane }, toStub, to],
      [from, fromStub, { x: fromStub.x, y: fromStub.y - nearLane }, { x: toStub.x, y: fromStub.y - nearLane }, toStub, to],
      [from, fromStub, { x: minX - farLane, y: fromStub.y }, { x: minX - farLane, y: toStub.y }, toStub, to],
      [from, fromStub, { x: maxX + farLane, y: fromStub.y }, { x: maxX + farLane, y: toStub.y }, toStub, to],
      [from, fromStub, { x: fromStub.x, y: minY - farLane }, { x: toStub.x, y: minY - farLane }, toStub, to],
      [from, fromStub, { x: fromStub.x, y: maxY + farLane }, { x: toStub.x, y: maxY + farLane }, toStub, to]
    ];
    xLanes.forEach((xLane) => {
      yLanes.forEach((yLane) => {
        candidates.push(
          [from, fromStub, { x: xLane, y: fromStub.y }, { x: xLane, y: yLane }, { x: toStub.x, y: yLane }, toStub, to],
          [from, fromStub, { x: fromStub.x, y: yLane }, { x: xLane, y: yLane }, { x: xLane, y: toStub.y }, toStub, to]
        );
      });
    });
    const normalizedCandidates = candidates.map(normalizeRoutePoints);
    normalizedCandidates.sort((left, right) => {
      return scoreRoute(left, obstacles, relationship) - scoreRoute(right, obstacles, relationship);
    });
    return normalizedCandidates[0];
  }

  function edgeRoutePoints(relationship, from, to, controlX, controlY, explicit, obstacles = null) {
    const spacing = explicit ? 28 : 44;
    const fromStub = pointOffsetBySide(from, relationship.fromAnchorSide, spacing);
    const toStub = pointOffsetBySide(to, relationship.toAnchorSide, spacing);
    if (explicit) {
      return normalizeRoutePoints([from, fromStub, { x: controlX, y: controlY }, toStub, to]);
    }
    return automaticEdgeRoutePoints(
      relationship,
      from,
      to,
      fromStub,
      toStub,
      obstacles || allEntityBounds(new Set([relationship.fromEntityId, relationship.toEntityId]))
    );
  }

  function roundedRoutePathD(points) {
    if (points.length <= 2) {
      const [from, to] = points;
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }
    const commands = [`M ${points[0].x} ${points[0].y}`];
    const radius = 14;
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const next = points[index + 1];
      const beforeLength = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      const afterLength = Math.abs(next.x - point.x) + Math.abs(next.y - point.y);
      const before = Math.min(radius, beforeLength / 2);
      const after = Math.min(radius, afterLength / 2);
      const start = {
        x: point.x + Math.sign(previous.x - point.x) * before,
        y: point.y + Math.sign(previous.y - point.y) * before
      };
      const end = {
        x: point.x + Math.sign(next.x - point.x) * after,
        y: point.y + Math.sign(next.y - point.y) * after
      };
      commands.push(`L ${start.x} ${start.y}`);
      commands.push(`Q ${point.x} ${point.y} ${end.x} ${end.y}`);
    }
    const last = points[points.length - 1];
    commands.push(`L ${last.x} ${last.y}`);
    return commands.join(' ');
  }

  function routeLabelPoint(points) {
    const total = routeLength(points);
    let remaining = total / 2;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const length = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (remaining <= length) {
        const ratio = length ? remaining / length : 0;
        return {
          x: previous.x + (point.x - previous.x) * ratio,
          y: previous.y + (point.y - previous.y) * ratio
        };
      }
      remaining -= length;
    }
    return points[Math.floor(points.length / 2)];
  }

  function routeMiddleSegment(points) {
    const total = routeLength(points);
    let remaining = total / 2;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const length = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (remaining <= length) return { from: previous, to: point };
      remaining -= length;
    }
    return { from: points[0], to: points[points.length - 1] };
  }

  function routeLabelOffset(relationship, points) {
    const segment = routeMiddleSegment(points);
    const ordinal = relationshipRouteOrdinal(relationship);
    const spread = ordinal * 16;
    if (segment.from.y === segment.to.y) {
      return { x: 0, y: -8 + spread };
    }
    return { x: 8 + spread, y: -4 };
  }

  function buildRoutedEdgePathD(relationship, from, to, controlX, controlY, orthogonal, explicit) {
    const points = edgeRoutePoints(relationship, from, to, controlX, controlY, explicit);
    if (orthogonal || explicit) {
      return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    }
    return roundedRoutePathD(points);
  }

  /**
   * Rubber-band selection (JUM-729 follow-up).
   *
   * Shift and drag on empty canvas: plain dragging pans, which is the more
   * frequent gesture, so the marquee takes the modifier. Everything the band
   * touches is selected — a band that only takes what it fully encloses drops
   * the entity nearest the edge, which is usually the one being aimed at.
   */
  function beginMarquee(event) {
    const origin = pointerToCanvasPoint(event.clientX, event.clientY);
    const bandEl = document.createElement('div');
    bandEl.className = 'marquee';
    dom.canvasInner.appendChild(bandEl);

    const draw = (point) => {
      bandEl.style.left = `${Math.min(origin.x, point.x)}px`;
      bandEl.style.top = `${Math.min(origin.y, point.y)}px`;
      bandEl.style.width = `${Math.abs(point.x - origin.x)}px`;
      bandEl.style.height = `${Math.abs(point.y - origin.y)}px`;
    };

    const onMove = (moveEvent) => {
      draw(pointerToCanvasPoint(moveEvent.clientX, moveEvent.clientY));
    };

    const onUp = (upEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const end = pointerToCanvasPoint(upEvent.clientX, upEvent.clientY);
      bandEl.remove();
      const hits = entitiesInMarquee(
        state.domains,
        { x1: origin.x, y1: origin.y, x2: end.x, y2: end.y },
        state.view.compactEntities,
        state.view.largeCanvasMode
      );
      state.selectedEntityIds = hits;
      // The single selection stays the anchor for every panel that reads it,
      // so a marquee of one behaves exactly like a click.
      setSelectedEntity(hits.length === 1 ? hits[0] : state.selectedEntityId);
      render();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /**
   * Where an edge end sits, for a caller outside the canvas (JUM-729 follow-up).
   *
   * The PNG export needs the same answer the renderer uses — field row, side
   * anchor or centre — and computing it a second time is how an export ends up
   * drawing lines the diagram does not have.
   */
  function endpointForExport(relationship, end) {
    if (relationship.anchorBehavior === 'center') {
      return entityCenterOnCanvas(
        end === 'from' ? relationship.fromEntityId : relationship.toEntityId
      );
    }
    return relationshipEndpoint(relationship, end).point;
  }

  /**
   * Scroll the selected entity (or domain) into view (JUM-729 follow-up).
   *
   * A search result that selects something off screen has answered a question
   * the user cannot see the answer to.
   */
  function scrollSelectionIntoView() {
    const found = state.selectedEntityId ? findEntity(state.domains, state.selectedEntityId) : null;
    const domain = found
      ? found.domain
      : state.domains.find((candidate) => candidate.id === state.selectedDomainId);
    if (!domain) return;
    const zoom = state.view.zoom || 1;
    const targetX = (domain.x + (found ? found.entity.x : 0)) * zoom;
    const targetY = (domain.y + (found ? found.entity.y : 0)) * zoom;
    dom.canvas.scrollTo({
      left: Math.max(0, targetX - dom.canvas.clientWidth / 2),
      top: Math.max(0, targetY - dom.canvas.clientHeight / 2),
      behavior: 'smooth'
    });
  }

  function entityCenterOnCanvas(entityId) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    return entityCenterPoint(
      found.domain, found.entity, state.view.compactEntities, state.view.largeCanvasMode
    );
  }

  function domFieldAnchorPoint(entityId, fieldName, side) {
    if (!fieldName || state.view.compactEntities || state.view.largeCanvasMode) return null;
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    const entityEl = [...dom.canvasInner.querySelectorAll('.entity[data-entity-id]')]
      .find((candidate) => candidate.dataset.entityId === entityId);
    if (!entityEl) return null;
    const row = [...entityEl.querySelectorAll('.entity-field-row[data-field-name]')]
      .find((candidate) => candidate.dataset.fieldName === fieldName);
    if (!row) return null;
    const zoom = clampZoom(state.view.zoom || 1);
    const canvasRect = dom.canvasInner.getBoundingClientRect();
    const entityRect = entityEl.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const edgeX = side === 'left' ? entityRect.left : entityRect.right;
    return {
      x: (edgeX - canvasRect.left) / zoom - CANVAS_ORIGIN_X,
      y: (rowRect.top + rowRect.height / 2 - canvasRect.top) / zoom - CANVAS_ORIGIN_Y
    };
  }

  /**
   * The point an edge end attaches to: the named field's row when the link
   * declares one, the entity side otherwise (JUM-729 follow-up).
   */
  function edgeEndpoint(entityId, side, fieldName) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    if (fieldName) {
      const fieldPoint = domFieldAnchorPoint(entityId, fieldName, side)
        || entityFieldAnchorPoint(
        found.domain,
        found.entity,
        fieldName,
        side || 'right',
        state.view.compactEntities,
        state.view.largeCanvasMode
      );
      if (fieldPoint) return fieldPoint;
    }
    return side
      ? entityAnchorOnCanvas(entityId, side)
      : entityCenterOnCanvas(entityId);
  }

  function relationshipSide(entityId, otherEntityId, fallbackSide) {
    if (fallbackSide) return fallbackSide;
    const current = entityCenterOnCanvas(entityId);
    const other = entityCenterOnCanvas(otherEntityId);
    if (!current || !other) return 'right';
    if (Math.abs(current.x - other.x) >= Math.abs(current.y - other.y)) {
      return current.x <= other.x ? 'right' : 'left';
    }
    return current.y <= other.y ? 'bottom' : 'top';
  }

  function inferRelationshipFieldName(relationship, end) {
    const explicit = end === 'from' ? relationship.fromField : relationship.toField;
    if (explicit) return explicit;
    const entityId = end === 'from' ? relationship.fromEntityId : relationship.toEntityId;
    const otherEntityId = end === 'from' ? relationship.toEntityId : relationship.fromEntityId;
    const found = findEntity(state.domains, entityId);
    const other = findEntity(state.domains, otherEntityId);
    const fields = found?.entity?.fields || [];
    if (!fields.length) return null;
    if (end === 'to') {
      return fields.find((field) => field.pk)?.name
        || fields.find((field) => field.name === 'id')?.name
        || null;
    }
    const otherToken = String(other?.entity?.name || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    const candidates = [
      `${otherToken}id`,
      `${otherToken}_id`,
      `${otherToken}-id`
    ];
    return fields.find((field) => candidates.includes(String(field.name || '').toLowerCase()))?.name
      || fields.find((field) => field.fk)?.name
      || null;
  }

  function relationshipEndpoint(relationship, end) {
    const entityId = end === 'from' ? relationship.fromEntityId : relationship.toEntityId;
    const otherEntityId = end === 'from' ? relationship.toEntityId : relationship.fromEntityId;
    const fieldName = inferRelationshipFieldName(relationship, end);
    const current = entityCenterOnCanvas(entityId);
    const other = entityCenterOnCanvas(otherEntityId);
    const side = fieldName && current && other
      ? (current.x <= other.x ? 'right' : 'left')
      : relationshipSide(
        entityId,
        otherEntityId,
        end === 'from' ? relationship.fromAnchorSide : relationship.toAnchorSide
      );
    return {
      entityId,
      side,
      fieldName,
      point: edgeEndpoint(entityId, side, fieldName)
    };
  }

  function relationshipFieldLabel(relationship, fromEndpoint, toEndpoint) {
    const from = findEntity(state.domains, relationship.fromEntityId)?.entity?.name || relationship.fromEntityId;
    const to = findEntity(state.domains, relationship.toEntityId)?.entity?.name || relationship.toEntityId;
    if (fromEndpoint.fieldName || toEndpoint.fieldName) {
      return `${from}.${fromEndpoint.fieldName || '?'} -> ${to}.${toEndpoint.fieldName || '?'}`;
    }
    return relationship.name || '';
  }

  function compactRelationshipFieldLabel(relationship, fromEndpoint, toEndpoint) {
    const fullLabel = relationshipFieldLabel(relationship, fromEndpoint, toEndpoint);
    if (!fromEndpoint.fieldName && !toEndpoint.fieldName) return fullLabel;
    const from = findEntity(state.domains, relationship.fromEntityId)?.entity?.name || relationship.fromEntityId;
    const to = findEntity(state.domains, relationship.toEntityId)?.entity?.name || relationship.toEntityId;
    const sameEntityNames = from === to;
    const source = sameEntityNames ? fromEndpoint.fieldName : `${fromEndpoint.fieldName || '?'}`;
    const target = sameEntityNames ? toEndpoint.fieldName : `${toEndpoint.fieldName || '?'}`;
    const compact = `${source} -> ${target}`;
    return compact.length <= 34 ? compact : fullLabel;
  }

  function cardinalityLabelPoint(endpoint, otherPoint) {
    const deltaX = endpoint.x - otherPoint.x;
    const deltaY = endpoint.y - otherPoint.y;
    const axisX = Math.abs(deltaX) >= Math.abs(deltaY);
    return {
      x: Math.round(endpoint.x + (axisX ? Math.sign(deltaX || 1) * 12 : 6)),
      y: Math.round(endpoint.y + (axisX ? -7 : Math.sign(deltaY || -1) * 13))
    };
  }

  function pointOutsideEndpoint(point, side, otherPoint, distance = 14) {
    const direction = sideDirection(side);
    const fallbackX = Math.sign(point.x - otherPoint.x || 1);
    const fallbackY = Math.sign(point.y - otherPoint.y || 1);
    return {
      x: Math.round(point.x + (direction.x || fallbackX) * distance),
      y: Math.round(point.y + (direction.y || fallbackY) * distance)
    };
  }

  function edgeHitRoutePoints(routePoints, fromEndpoint, toEndpoint) {
    if (routePoints.length < 2) return routePoints;
    const points = routePoints.map((point) => ({ ...point }));
    points[0] = pointOutsideEndpoint(
      routePoints[0],
      fromEndpoint.side,
      routePoints[1] || routePoints[routePoints.length - 1],
      10
    );
    points[points.length - 1] = pointOutsideEndpoint(
      routePoints[routePoints.length - 1],
      toEndpoint.side,
      routePoints[routePoints.length - 2] || routePoints[0],
      10
    );
    return points;
  }

  function entityAnchorOnCanvas(entityId, side) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    return entityAnchorPoint(
      found.domain, found.entity, side, state.view.compactEntities, state.view.largeCanvasMode
    );
  }

  function pointerToCanvasPoint(clientX, clientY) {
    const zoom = state.view.zoom || 1;
    const rect = dom.canvas.getBoundingClientRect();
    return {
      x: (dom.canvas.scrollLeft + clientX - rect.left) / zoom - CANVAS_ORIGIN_X,
      y: (dom.canvas.scrollTop + clientY - rect.top) / zoom - CANVAS_ORIGIN_Y
    };
  }

  function clearAnchorPreviewEdge() {
    const preview = dom.edges.querySelector('.edge-preview');
    if (preview) preview.remove();
  }

  function renderAnchorPreviewEdge(fromPoint, toPoint) {
    clearAnchorPreviewEdge();
    if (!fromPoint || !toPoint) return;
    const pathD = buildPreviewEdgePathD(fromPoint, toPoint, state.view.edgeStyle === 'orthogonal');
    const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    previewPath.setAttribute('class', 'edge-preview');
    previewPath.setAttribute('d', pathD);
    dom.edges.appendChild(previewPath);
  }

  function nearestRelationshipEndpointTarget(point) {
    const searchRadius = 34;
    const candidates = [];
    state.domains.forEach((domain) => {
      if (isDomainCollapsed(domain)) return;
      (domain.entities || []).forEach((entity) => {
        const left = domain.x + entity.x;
        const top = domain.y + entity.y;
        const height = entityBoxHeight(entity, state.view.compactEntities, state.view.largeCanvasMode);
        const right = left + entityWidth(entity);
        const bottom = top + height;
        const inside =
          point.x >= left - searchRadius
          && point.x <= right + searchRadius
          && point.y >= top - searchRadius
          && point.y <= bottom + searchRadius;
        if (!inside) return;

        const sideDistances = [
          { side: 'left', distance: Math.abs(point.x - left) },
          { side: 'right', distance: Math.abs(point.x - right) },
          { side: 'top', distance: Math.abs(point.y - top) },
          { side: 'bottom', distance: Math.abs(point.y - bottom) }
        ].sort((a, b) => a.distance - b.distance);
        const side = sideDistances[0].side;
        const sidePoint = edgeEndpoint(entity.id, side, null);
        if (sidePoint) {
          candidates.push({
            entityId: entity.id,
            side,
            fieldName: null,
            score: Math.hypot(point.x - sidePoint.x, point.y - sidePoint.y)
          });
        }

        if (!state.view.compactEntities) {
          const rowHeight = entityFieldRowHeight(state.view.largeCanvasMode);
          const rowIndex = Math.floor((point.y - top - 32) / rowHeight);
          const field = entity.fields?.[rowIndex];
          if (field) {
            const fieldSide = Math.abs(point.x - left) <= Math.abs(point.x - right) ? 'left' : 'right';
            const fieldPoint = edgeEndpoint(entity.id, fieldSide, field.name);
            if (fieldPoint) {
              candidates.push({
                entityId: entity.id,
                side: fieldSide,
                fieldName: field.name,
                score: Math.hypot(point.x - fieldPoint.x, point.y - fieldPoint.y) - 8
              });
            }
          }
        }
      });
    });
    return candidates.sort((a, b) => a.score - b.score)[0] || null;
  }

  function applyRelationshipEndpointTarget(relationship, end, target) {
    if (!target) return false;
    if (end === 'from') {
      if (target.entityId === relationship.toEntityId) return false;
      relationship.fromEntityId = target.entityId;
      relationship.fromAnchorSide = target.side;
      relationship.fromField = target.fieldName;
      return true;
    }
    if (target.entityId === relationship.fromEntityId) return false;
    relationship.toEntityId = target.entityId;
    relationship.toAnchorSide = target.side;
    relationship.toField = target.fieldName;
    return true;
  }

  function attachRelationshipEndpointDrag(handle, relationship, end, fixedPoint) {
    attachDrag(handle, (_dx, _dy, event) => {
      const pointer = pointerToCanvasPoint(event.clientX, event.clientY);
      if (end === 'from') {
        renderAnchorPreviewEdge(pointer, fixedPoint);
      } else {
        renderAnchorPreviewEdge(fixedPoint, pointer);
      }
    }, {
      onStart: () => {
        closeSidebarForCanvasWork();
        dom.canvas.classList.add('relationship-routing');
      },
      onEnd: (event, moved) => {
        dom.canvas.classList.remove('relationship-routing');
        clearAnchorPreviewEdge();
        if (!moved) return;
        const target = nearestRelationshipEndpointTarget(
          pointerToCanvasPoint(event.clientX, event.clientY)
        );
        const changed = applyRelationshipEndpointTarget(relationship, end, target);
        if (!changed) {
          render();
          return;
        }
        saveState();
        render();
      }
    });
  }

  function stopAnchorDrag() {
    interaction.relationshipAnchorDragActive = false;
    interaction.relationshipAnchorFromEntityId = null;
    interaction.relationshipAnchorFromSide = null;
    interaction.relationshipAnchorFromField = null;
    dom.canvas.classList.remove('relationship-dragging');
    clearAnchorPreviewEdge();
  }

  function startAnchorDrag(entityId, side, event, fieldName) {
    // JUM-729 follow-up: a drag that starts on a field row carries that field, so the
    // link it creates lands on the row rather than on the middle of the card.
    const fromPoint = edgeEndpoint(entityId, side, fieldName);
    if (!fromPoint) return;
    interaction.relationshipAnchorDragActive = true;
    interaction.relationshipAnchorFromEntityId = entityId;
    interaction.relationshipAnchorFromSide = side;
    interaction.relationshipAnchorFromField = fieldName || null;
    dom.canvas.classList.add('relationship-dragging');
    const pointer = pointerToCanvasPoint(event.clientX, event.clientY);
    renderAnchorPreviewEdge(fromPoint, pointer);
  }

  function renderEdges() {
    dom.edges.innerHTML = '';
    const entityBounds = allEntityBounds();
    state.relationships.forEach((relationship) => {
      const useCenter = relationship.anchorBehavior === 'center';
      const fromEndpoint = relationshipEndpoint(relationship, 'from');
      const toEndpoint = relationshipEndpoint(relationship, 'to');
      const from = useCenter ? entityCenterOnCanvas(relationship.fromEntityId) : fromEndpoint.point;
      const to = useCenter ? entityCenterOnCanvas(relationship.toEntityId) : toEndpoint.point;
      if (!from || !to) return;

      const control = relationshipControlPoint(relationship, from, to);
      const controlX = control.x;
      const controlY = control.y;
      const routedRelationship = useCenter
        ? relationship
        : {
          ...relationship,
          fromAnchorSide: fromEndpoint.side,
          toAnchorSide: toEndpoint.side,
          fromField: fromEndpoint.fieldName,
          toField: toEndpoint.fieldName
        };
      const routeObstacles = entityBounds.filter((box) => box.entityId !== relationship.fromEntityId
        && box.entityId !== relationship.toEntityId);
      const routePoints = edgeRoutePoints(
        routedRelationship,
        from,
        to,
        controlX,
        controlY,
        control.explicit,
        routeObstacles
      );
      const edgePathD = state.view.edgeStyle === 'orthogonal' || control.explicit
        ? routePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
        : roundedRoutePathD(routePoints);
      const routeLabel = routeLabelPoint(routePoints);
      const labelX = routeLabel.x;
      const labelY = routeLabel.y;
      const labelOffsetX = Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0;
      const labelOffsetY = Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0;
      const activeClass = state.selectedRelationshipId === relationship.id ? ' active' : '';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', `edge-line${activeClass}`);
      path.setAttribute('d', edgePathD);
      dom.edges.appendChild(path);

      const hitRoutePoints = useCenter ? routePoints : edgeHitRoutePoints(routePoints, fromEndpoint, toEndpoint);
      const hitPathD = state.view.edgeStyle === 'orthogonal' || control.explicit
        ? hitRoutePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
        : roundedRoutePathD(hitRoutePoints);
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('class', 'edge-hit');
      hit.setAttribute('d', hitPathD);
      hit.addEventListener('click', (event) => {
        event.stopPropagation();
        state.selectedRelationshipId = relationship.id;
        render();
      });
      hit.addEventListener('contextmenu', (event) => {
        state.selectedRelationshipId = relationship.id;
        openElementMenu(
          event,
          relationship.name || 'Relationship',
          relationshipMenuItems(relationship)
        );
      });
      dom.edges.appendChild(hit);

      if (!state.view.largeCanvasMode) {
        const sourceCardinality = cardinalityLabelPoint(from, to);
        const targetCardinality = cardinalityLabelPoint(to, from);
        const fromLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fromLabel.setAttribute('class', 'edge-label');
        fromLabel.setAttribute('x', String(sourceCardinality.x));
        fromLabel.setAttribute('y', String(sourceCardinality.y));
        fromLabel.textContent = relationship.fromCardinality;
        dom.edges.appendChild(fromLabel);

        const toLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        toLabel.setAttribute('class', 'edge-label');
        toLabel.setAttribute('x', String(targetCardinality.x));
        toLabel.setAttribute('y', String(targetCardinality.y));
        toLabel.textContent = relationship.toCardinality;
        dom.edges.appendChild(toLabel);

        const autoLabelOffset = routeLabelOffset(routedRelationship, routePoints);
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('class', 'edge-label edge-name-label');
        nameLabel.setAttribute('x', String(labelX + autoLabelOffset.x + labelOffsetX));
        nameLabel.setAttribute('y', String(labelY + autoLabelOffset.y + labelOffsetY));
        const fullLabel = relationshipFieldLabel(relationship, fromEndpoint, toEndpoint);
        nameLabel.textContent = compactRelationshipFieldLabel(relationship, fromEndpoint, toEndpoint);
        nameLabel.dataset.fullLabel = fullLabel;
        nameLabel.setAttribute('tabindex', '0');
        nameLabel.setAttribute('role', 'button');
        nameLabel.setAttribute('aria-label', `Move label for ${fullLabel || relationship.name || 'relationship'}`);
        attachDrag(nameLabel, (dx, dy) => {
          relationship.labelOffsetX = (Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0) + dx;
          relationship.labelOffsetY = (Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0) + dy;
          renderEdges();
        }, {
          onStart: () => closeSidebarForCanvasWork(),
          onEnd: (_event, moved) => {
            if (!moved) return;
            saveState();
            render();
          }
        });
        dom.edges.appendChild(nameLabel);
      }

      if (state.selectedRelationshipId === relationship.id) {
        [
          {
            end: 'from',
            point: from,
            handlePoint: useCenter ? from : pointOutsideEndpoint(from, fromEndpoint.side, to),
            fixedPoint: to,
            label: 'source'
          },
          {
            end: 'to',
            point: to,
            handlePoint: useCenter ? to : pointOutsideEndpoint(to, toEndpoint.side, from),
            fixedPoint: from,
            label: 'target'
          }
        ].forEach((endpoint) => {
          const endHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          endHandle.setAttribute('class', `edge-end-handle edge-end-handle-${endpoint.end}`);
          endHandle.setAttribute('cx', String(endpoint.handlePoint.x));
          endHandle.setAttribute('cy', String(endpoint.handlePoint.y));
          endHandle.setAttribute('r', '5');
          endHandle.setAttribute('tabindex', '0');
          endHandle.setAttribute('role', 'button');
          endHandle.setAttribute(
            'aria-label',
            `Drag ${endpoint.label} endpoint for ${relationship.name || 'relationship'}`
          );
          attachRelationshipEndpointDrag(endHandle, relationship, endpoint.end, endpoint.fixedPoint);
          dom.edges.appendChild(endHandle);
        });

        const bendHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bendHandle.setAttribute('class', `edge-bend-handle${control.explicit ? ' explicit' : ''}`);
        bendHandle.setAttribute('cx', String(controlX));
        bendHandle.setAttribute('cy', String(controlY));
        bendHandle.setAttribute('r', '5.5');
        bendHandle.setAttribute('tabindex', '0');
        bendHandle.setAttribute('role', 'slider');
        bendHandle.setAttribute('aria-label', `Move route handle for ${relationship.name || 'relationship'}`);
        bendHandle.addEventListener('dblclick', (event) => {
          event.stopPropagation();
          withPersist(() => {
            delete relationship.bendX;
            delete relationship.bendY;
            render();
          });
        });
        attachDrag(bendHandle, (dx, dy) => {
          relationship.bendX = snapCoordinate(
            state.view.snapToGrid,
            (Number.isFinite(relationship.bendX) ? relationship.bendX : controlX) + dx
          );
          relationship.bendY = snapCoordinate(
            state.view.snapToGrid,
            (Number.isFinite(relationship.bendY) ? relationship.bendY : controlY) + dy
          );
          renderEdges();
        }, {
          onStart: () => closeSidebarForCanvasWork(),
          onEnd: (_event, moved) => {
            if (!moved) return;
            saveState();
            render();
          }
        });
        dom.edges.appendChild(bendHandle);
      }
    });
  }

  function renderMiniMap() {
    if (!dom.miniMap) return;
    dom.miniMap.innerHTML = '';
    const canvasWidth = dom.canvasInner.offsetWidth || VIRTUAL_CANVAS_WIDTH;
    const canvasHeight = dom.canvasInner.offsetHeight || VIRTUAL_CANVAS_HEIGHT;
    const mapWidth = dom.miniMap.clientWidth || 180;
    const mapHeight = dom.miniMap.clientHeight || 130;
    const scale = Math.min(mapWidth / canvasWidth, mapHeight / canvasHeight);
    state.domains.forEach((domain) => {
      const box = document.createElement('div');
      box.className = 'mini-map-domain';
      box.style.left = `${modelToCanvasX(domain.x) * scale}px`;
      box.style.top = `${modelToCanvasY(domain.y) * scale}px`;
      const domainSize = domainBox(domain);
      box.style.width = `${domainSize.width * scale}px`;
      box.style.height = `${domainSize.height * scale}px`;
      box.style.borderColor = domain.color || '#64748b';
      if (state.selectedDomainId === domain.id) box.classList.add('active');
      box.title = domain.name;
      dom.miniMap.appendChild(box);
    });
    const zoom = clampZoom(state.view.zoom || 1);
    const viewport = document.createElement('div');
    viewport.className = 'mini-map-viewport';
    viewport.style.left = `${(dom.canvas.scrollLeft / zoom) * scale}px`;
    viewport.style.top = `${(dom.canvas.scrollTop / zoom) * scale}px`;
    viewport.style.width = `${(dom.canvas.clientWidth / zoom) * scale}px`;
    viewport.style.height = `${(dom.canvas.clientHeight / zoom) * scale}px`;
    dom.miniMap.appendChild(viewport);
  }

  function centerCanvasFromMiniMapPointer(event) {
    if (!dom.miniMap) return;
    const rect = dom.miniMap.getBoundingClientRect();
    const canvasWidth = dom.canvasInner.offsetWidth || VIRTUAL_CANVAS_WIDTH;
    const canvasHeight = dom.canvasInner.offsetHeight || VIRTUAL_CANVAS_HEIGHT;
    const mapWidth = dom.miniMap.clientWidth || rect.width || 180;
    const mapHeight = dom.miniMap.clientHeight || rect.height || 130;
    const scale = Math.min(mapWidth / canvasWidth, mapHeight / canvasHeight);
    const zoom = clampZoom(state.view.zoom || 1);
    const canvasX = Math.max(0, Math.min(canvasWidth, (event.clientX - rect.left) / scale));
    const canvasY = Math.max(0, Math.min(canvasHeight, (event.clientY - rect.top) / scale));
    dom.canvas.scrollTo({
      left: Math.max(0, canvasX * zoom - dom.canvas.clientWidth / 2),
      top: Math.max(0, canvasY * zoom - dom.canvas.clientHeight / 2),
      behavior: 'auto'
    });
    scheduleMiniMapRender();
  }

  function wireMiniMapEvents() {
    if (!dom.miniMap) return;
    dom.miniMap.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeSidebarForCanvasWork();
      centerCanvasFromMiniMapPointer(event);
      dom.miniMap.classList.add('mini-map-dragging');
      const pointerId = event.pointerId;
      if (typeof dom.miniMap.setPointerCapture === 'function') {
        dom.miniMap.setPointerCapture(pointerId);
      }
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        centerCanvasFromMiniMapPointer(moveEvent);
      };
      const end = (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        dom.miniMap.classList.remove('mini-map-dragging');
        if (typeof dom.miniMap.releasePointerCapture === 'function') {
          try {
            dom.miniMap.releasePointerCapture(pointerId);
          } catch (_error) {
            // The pointer may already have been released by the browser.
          }
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
  }

  /**
   * Canvas-level event wiring: background click deselects, ctrl/cmd-wheel
   * zooms, middle-button/space pans, and window-level pointer tracking drives
   * the anchor-drag preview. The keyboard map stays in `script.js` because it
   * reaches far beyond the canvas (undo/redo, pick mode, deletion).
   */
  function wireCanvasEvents() {
    dom.canvas.addEventListener('click', (event) => {
      if (event.target !== dom.canvas && event.target !== dom.edges && event.target !== dom.canvasInner) return;
      state.selectedRelationshipId = null;
      render();
    });

    dom.canvas.addEventListener('contextmenu', (event) => {
      const onBackground = event.target === dom.canvas
        || event.target === dom.canvasInner
        || event.target === dom.edges;
      if (!onBackground) return;
      openElementMenu(event, 'Canvas', canvasMenuItems(event));
    });

    dom.canvas.addEventListener('wheel', (event) => {
      // JUM-729 follow-up: the wheel zooms on its own. It used to demand ctrl/cmd, which
      // is the browser's page-zoom gesture, not a canvas one — the plain wheel
      // scrolled the canvas and the diagram never changed size. Shift+wheel
      // still scrolls, for anyone who wants to pan a large model.
      if (event.shiftKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.1 : 0.1;
      zoomAtPointer(direction, event);
    }, { passive: false, capture: true });

    dom.canvas.addEventListener('scroll', () => {
      scheduleMiniMapRender();
    }, { passive: true });

    dom.canvas.addEventListener('pointerdown', (event) => {
      // JUM-729 follow-up: dragging the empty canvas moves the whole document, the way
      // every diagram tool behaves. Panning used to demand the middle button
      // or a held Space, so with a normal mouse the model could only be
      // reached through the scrollbars.
      //
      // "Empty" is the test: the background, its grid layer and the edge SVG.
      // A drag that starts on a domain, an entity, an anchor or the resize
      // handle belongs to that element, and stealing it would make them
      // immovable.
      const onBackground = event.target === dom.canvas
        || event.target === dom.canvasInner
        || event.target === dom.edges;
      const primaryDragOnBackground = event.button === 0 && onBackground;
      if (primaryDragOnBackground && event.shiftKey) {
        closeSidebarForCanvasWork();
        event.preventDefault();
        beginMarquee(event);
        return;
      }
      if (event.button !== 1 && !interaction.spacePressed && !primaryDragOnBackground) return;
      closeSidebarForCanvasWork();
      interaction.panning = true;
      interaction.panStartX = event.clientX;
      interaction.panStartY = event.clientY;
      interaction.scrollStartLeft = dom.canvas.scrollLeft;
      interaction.scrollStartTop = dom.canvas.scrollTop;
      dom.canvas.classList.add('panning');
      event.preventDefault();
    });

    dom.canvas.addEventListener('pointermove', (event) => {
      if (!interaction.panning) return;
      const dx = event.clientX - interaction.panStartX;
      const dy = event.clientY - interaction.panStartY;
      dom.canvas.scrollLeft = interaction.scrollStartLeft - dx;
      dom.canvas.scrollTop = interaction.scrollStartTop - dy;
    });

    const stopPan = () => {
      interaction.panning = false;
      dom.canvas.classList.remove('panning');
    };
    dom.canvas.addEventListener('pointerup', stopPan);
    dom.canvas.addEventListener('pointercancel', stopPan);
    dom.canvas.addEventListener('pointerleave', stopPan);

    window.addEventListener('pointermove', (event) => {
      if (!interaction.relationshipAnchorDragActive) return;
      const fromPoint = edgeEndpoint(
        interaction.relationshipAnchorFromEntityId,
        interaction.relationshipAnchorFromSide,
        interaction.relationshipAnchorFromField
      );
      if (!fromPoint) {
        stopAnchorDrag();
        return;
      }
      const pointer = pointerToCanvasPoint(event.clientX, event.clientY);
      renderAnchorPreviewEdge(fromPoint, pointer);
    });

    window.addEventListener('pointerup', () => {
      if (!interaction.relationshipAnchorDragActive) return;
      stopAnchorDrag();
    });

    wireMiniMapEvents();
  }

  return {
    addNote,
    endpointForExport,
    scrollSelectionIntoView,
    renderNotes,
    clearAlignmentGuides,
    renderView,
    zoomBy,
    fitView,
    resetView,
    toggleCompactView,
    autoLayout,
    renderDomains,
    renderEdges,
    renderMiniMap,
    stopAnchorDrag,
    wireCanvasEvents
  };
}
