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
  computeCenteredFit,
  computeFitView,
  computeLevelFit,
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
 * `setSelectedRelationship(id)`, `setSelectedNote(id)`,
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
    setSelectedField,
    setSelectedRelationship,
    setSelectedNote,
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
  /**
   * Camera 3 — FPS-driven critically-smoothed rig (delta-time exponential
   * decay). Retargetable mid-flight; frame-budget aware; minimap throttled.
   * @type {null | {
   *   raf: number,
   *   lastTs: number,
   *   frame: number,
   *   fpsEma: number,
   *   onComplete: Function | null,
   *   targetZoom: number,
   *   targetCx: number,
   *   targetCy: number,
   *   liveZoom: number,
   *   liveCx: number,
   *   liveCy: number
   * }}
   */
  let camera3 = null;
  /** Pointer/button-driven zoom chase (separate from focus Camera3 framing). */
  let userZoom = null;
  let userZoomSaveTimer = 0;

  const CAMERA3 = {
    TARGET_FPS: 60,
    FRAME_MS: 1000 / 60,
    MAX_DT_MS: 33.333,
    ZOOM_LAMBDA: 10.5,
    PAN_LAMBDA: 9.0,
    ARRIVE_ZOOM: 0.003,
    ARRIVE_PAN: 0.4,
    MINIMAP_EVERY_N: 2,
    FPS_EMA_ALPHA: 0.12,
    /**
     * Hard ceiling for focus/fit Camera3 flights. Under CI WebKit load every
     * rAF can look like a micro-frame, so the chase never advances and
     * data-navigating stays true forever (CircleCI 6575/6581, JUM-930).
     */
    MAX_MS: 3000,
    /** User wheel/button zoom — snappier than focus framing, still 60FPS smooth. */
    USER_ZOOM_LAMBDA: 14.5,
    USER_ZOOM_ARRIVE: 0.0025,
    USER_ZOOM_SAVE_MS: 180,
    /** Hard ceiling so a stalled RAF under CI load cannot leave data-user-zooming stuck (JUM-929). */
    USER_ZOOM_MAX_MS: 2500
  };

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
        run: () => setSelectedRelationship(relationship.id)
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
    if (state.view.canvasStage !== 'focus') state.view.canvasStage = 'overview';
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
    dom.canvas.dataset.canvasStage = state.view.canvasStage === 'focus' ? 'focus' : 'overview';
    dom.zoomIndicator.textContent = `${Math.round(zoom * 100)}%`;
    syncStageChrome();
    // Short labels — pressed state + title carry On/Off; long strings overcrowded the toolbar.
    dom.toggleCompactViewBtn.textContent = state.view.compactEntities ? 'Full' : 'Compact';
    dom.toggleCompactViewBtn.title = state.view.compactEntities
      ? 'Show full entity cards'
      : 'Compact entity cards';
    dom.toggleSnapBtn.textContent = 'Snap';
    dom.toggleSnapBtn.title = state.view.snapToGrid ? 'Snap to grid: On' : 'Snap to grid: Off';
    dom.toggleLargeCanvasBtn.textContent = 'Canvas';
    dom.toggleLargeCanvasBtn.title = state.view.largeCanvasMode
      ? 'Large canvas: On'
      : 'Large canvas: Off';
    // Toggle semantics (JUM-488): the three view switches are aria-pressed
    // toggles; the pressed state mirrors the view flags they flip.
    dom.toggleCompactViewBtn.setAttribute('aria-pressed', String(Boolean(state.view.compactEntities)));
    dom.toggleSnapBtn.setAttribute('aria-pressed', String(Boolean(state.view.snapToGrid)));
    dom.toggleLargeCanvasBtn.setAttribute('aria-pressed', String(Boolean(state.view.largeCanvasMode)));
    dom.edgeStyleSelect.value = state.view.edgeStyle;
    dom.modelCheckMinSeveritySelect.value = state.view.modelCheckMinSeverity;
    dom.exportBlockCriticalCheck.checked = state.view.exportBlockCritical;
  }

  function cancelUserZoom({ commit = true } = {}) {
    if (!userZoom) return;
    cancelAnimationFrame(userZoom.raf);
    if (commit && Number.isFinite(userZoom.liveZoom)) {
      state.view.zoom = clampZoom(userZoom.liveZoom);
      applyAnchoredZoomFrame(
        userZoom.liveZoom,
        userZoom.anchorModelX,
        userZoom.anchorModelY,
        userZoom.localX,
        userZoom.localY,
        { minimap: true }
      );
    }
    userZoom = null;
    if (dom.canvas) {
      delete dom.canvas.dataset.userZooming;
    }
    if (userZoomSaveTimer) {
      clearTimeout(userZoomSaveTimer);
      userZoomSaveTimer = 0;
    }
  }

  function scheduleUserZoomSave() {
    if (userZoomSaveTimer) clearTimeout(userZoomSaveTimer);
    userZoomSaveTimer = setTimeout(() => {
      userZoomSaveTimer = 0;
      saveState();
    }, CAMERA3.USER_ZOOM_SAVE_MS);
  }

  /**
   * Keep a model-space anchor under a fixed canvas-local pointer while zoom changes.
   * This is what makes wheel zoom feel like a camera, not a CSS scale of the page.
   */
  function applyAnchoredZoomFrame(
    zoom,
    anchorModelX,
    anchorModelY,
    localX,
    localY,
    { minimap = true } = {}
  ) {
    const z = clampZoom(zoom);
    state.view.zoom = z;
    if (dom.canvasInner) {
      const depth = 1 + (z - 1) * 0.012;
      dom.canvasInner.style.transform = `scale(${z})`;
      dom.canvasInner.style.setProperty('--cam3-depth', String(depth));
    }
    if (dom.zoomIndicator) dom.zoomIndicator.textContent = `${Math.round(z * 100)}%`;
    if (!dom.canvas) return;
    dom.canvas.scrollLeft = Math.max(0, anchorModelX * z - localX);
    dom.canvas.scrollTop = Math.max(0, anchorModelY * z - localY);
    if (minimap) scheduleMiniMapRender();
  }

  function settleUserZoom(rig) {
    applyAnchoredZoomFrame(
      rig.targetZoom,
      rig.anchorModelX,
      rig.anchorModelY,
      rig.localX,
      rig.localY,
      { minimap: true }
    );
    state.view.zoom = clampZoom(rig.targetZoom);
    userZoom = null;
    if (dom.canvas) {
      delete dom.canvas.dataset.userZooming;
      delete dom.canvas.dataset.zoomDirection;
      // Keep data-camera only if a focus flight still owns it.
      if (!camera3) delete dom.canvas.dataset.camera;
    }
    scheduleUserZoomSave();
  }

  function tickUserZoom(now) {
    if (!userZoom) return;
    const rig = userZoom;
    // Ceiling must run even when every rAF is treated as a micro-frame skip.
    if ((now - (rig.startedAt || now)) >= CAMERA3.USER_ZOOM_MAX_MS) {
      settleUserZoom(rig);
      return;
    }
    let dtMs = now - (rig.lastTs || now);
    rig.lastTs = now;
    if (dtMs > 0 && dtMs < CAMERA3.FRAME_MS * 0.55) {
      rig.raf = requestAnimationFrame(tickUserZoom);
      return;
    }
    dtMs = Math.min(Math.max(dtMs, CAMERA3.FRAME_MS * 0.5), CAMERA3.MAX_DT_MS);
    const dtSec = dtMs / 1000;
    rig.liveZoom = cam3ExpSmooth(
      rig.liveZoom,
      rig.targetZoom,
      CAMERA3.USER_ZOOM_LAMBDA,
      dtSec
    );
    applyAnchoredZoomFrame(
      rig.liveZoom,
      rig.anchorModelX,
      rig.anchorModelY,
      rig.localX,
      rig.localY,
      { minimap: rig.frame % CAMERA3.MINIMAP_EVERY_N === 0 }
    );
    rig.frame += 1;
    if (dom.canvas) {
      const zoomingIn = rig.targetZoom > rig.liveZoom + 0.01;
      const zoomingOut = rig.targetZoom < rig.liveZoom - 0.01;
      dom.canvas.dataset.userZooming = 'true';
      dom.canvas.dataset.zoomDirection = zoomingIn ? 'in' : zoomingOut ? 'out' : 'pan';
      dom.canvas.dataset.camera = '3';
    }
    if (Math.abs(rig.targetZoom - rig.liveZoom) <= CAMERA3.USER_ZOOM_ARRIVE) {
      settleUserZoom(rig);
      return;
    }
    rig.raf = requestAnimationFrame(tickUserZoom);
  }

  /**
   * Start or retarget a fluid user zoom. Anchor is the model point under
   * (localX, localY) at the live zoom so the cursor stays glued to content.
   */
  function beginOrRetargetUserZoom(targetZoom, localX, localY) {
    if (!dom.canvas || !dom.canvasInner) return;
    cancelCameraFlight();
    const nextZoom = clampZoom(targetZoom);
    const liveZoom = userZoom
      ? userZoom.liveZoom
      : clampZoom(state.view.zoom || 1);
    if (!userZoom && Math.abs(nextZoom - liveZoom) <= CAMERA3.USER_ZOOM_ARRIVE) return;

    let anchorModelX = (dom.canvas.scrollLeft + localX) / liveZoom;
    let anchorModelY = (dom.canvas.scrollTop + localY) / liveZoom;

    // Focus-stage zoom-in: blend pointer anchor toward a TIGHT selection point so
    // aggressive wheel-in does not park in empty soft-peer union void.
    // Relationships: endpoint corridor mid (not soft-hull union center).
    if (state.view.canvasStage === 'focus' && nextZoom > liveZoom + 0.02) {
      const zoomAnchor = selectionZoomAnchorPoint();
      if (zoomAnchor) {
        const deep = Math.min(1, Math.max(0, (nextZoom - 0.85) / 1.1));
        const blend = 0.32 + deep * 0.58;
        anchorModelX += (zoomAnchor.x - anchorModelX) * blend;
        anchorModelY += (zoomAnchor.y - anchorModelY) * blend;
      }
    }

    if (userZoom) {
      userZoom.targetZoom = nextZoom;
      userZoom.anchorModelX = anchorModelX;
      userZoom.anchorModelY = anchorModelY;
      userZoom.localX = localX;
      userZoom.localY = localY;
      return;
    }

    userZoom = {
      raf: 0,
      lastTs: performance.now(),
      startedAt: performance.now(),
      frame: 0,
      liveZoom,
      targetZoom: nextZoom,
      anchorModelX,
      anchorModelY,
      localX,
      localY
    };
    if (dom.canvas) {
      dom.canvas.dataset.userZooming = 'true';
      dom.canvas.dataset.camera = '3';
    }
    userZoom.raf = requestAnimationFrame(tickUserZoom);
  }

  function setZoom(zoomValue) {
    cancelUserZoom({ commit: false });
    cancelCameraFlight();
    state.view.zoom = clampZoom(zoomValue);
    renderView();
    scheduleMiniMapRender();
    saveState();
  }

  function zoomBy(delta) {
    // Multiplicative steps feel even across the zoom range; chase is fluid.
    if (!dom.canvas) {
      const current = clampZoom(state.view.zoom || 1);
      const factor = delta >= 0 ? 1.12 : 1 / 1.12;
      setZoom(current * factor);
      return;
    }
    const current = userZoom
      ? userZoom.targetZoom
      : clampZoom(state.view.zoom || 1);
    const factor = delta >= 0 ? 1.12 : 1 / 1.12;
    const localX = dom.canvas.clientWidth / 2;
    const localY = dom.canvas.clientHeight / 2;
    beginOrRetargetUserZoom(current * factor, localX, localY);
  }

  function zoomAtPointer(delta, event) {
    if (!dom.canvas || !event) {
      zoomBy(delta);
      return;
    }
    const rect = dom.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const current = userZoom
      ? userZoom.targetZoom
      : clampZoom(state.view.zoom || 1);
    // Prefer continuous pixel deltas (trackpad); fall back to stepped buttons.
    let factor;
    if (Number.isFinite(event.deltaY) && event.deltaY !== 0) {
      const lineHeight = 16;
      const pageHeight = dom.canvas.clientHeight || 800;
      const pixels = event.deltaMode === 1
        ? event.deltaY * lineHeight
        : event.deltaMode === 2
          ? event.deltaY * pageHeight
          : event.deltaY;
      // Negative deltaY (wheel up / pinch out) → zoom in.
      factor = Math.exp(-pixels * 0.00165);
    } else {
      factor = delta >= 0 ? 1.1 : 1 / 1.1;
    }
    beginOrRetargetUserZoom(current * factor, localX, localY);
  }

  function cancelCameraFlight({ runComplete = false } = {}) {
    // Do not cancel userZoom here — wheel retargets call this to stop focus
    // framing without aborting the in-flight pointer-anchored zoom chase.
    if (!camera3) return;
    cancelAnimationFrame(camera3.raf);
    const { onComplete, liveZoom, liveCx, liveCy } = camera3;
    // Keep the live pose so a mid-flight cancel does not snap back.
    if (Number.isFinite(liveZoom)) {
      state.view.zoom = liveZoom;
      applyCamera3Frame(liveZoom, liveCx, liveCy, { minimap: true });
    }
    camera3 = null;
    if (dom.canvas) {
      dom.canvas.dataset.navigating = 'false';
      delete dom.canvas.dataset.zoomDirection;
      delete dom.canvas.dataset.camFps;
      delete dom.canvas.dataset.camera;
    }
    syncSelectionClasses();
    syncStageChrome();
    if (runComplete && typeof onComplete === 'function') onComplete();
  }

  function viewportModelCenter(zoom = clampZoom(state.view.zoom || 1)) {
    if (!dom.canvas) return { x: 0, y: 0 };
    return {
      x: (dom.canvas.scrollLeft + dom.canvas.clientWidth / 2) / zoom - CANVAS_ORIGIN_X,
      y: (dom.canvas.scrollTop + dom.canvas.clientHeight / 2) / zoom - CANVAS_ORIGIN_Y
    };
  }

  /** Frame-rate independent exponential smooth (Camera 3). */
  function cam3ExpSmooth(current, target, lambda, dtSec) {
    if (dtSec <= 0) return current;
    return current + (target - current) * (1 - Math.exp(-lambda * dtSec));
  }

  function applyCamera3Frame(zoom, centerX, centerY, { minimap = true } = {}) {
    state.view.zoom = zoom;
    if (dom.canvasInner) {
      // Camera 3 depth cue: slight perspective scale without breaking model coords.
      const depth = 1 + (zoom - 1) * 0.012;
      dom.canvasInner.style.transform = `scale(${zoom})`;
      dom.canvasInner.style.setProperty('--cam3-depth', String(depth));
    }
    if (dom.zoomIndicator) dom.zoomIndicator.textContent = `${Math.round(zoom * 100)}%`;
    if (!dom.canvas) return;
    dom.canvas.scrollLeft = Math.max(
      0,
      centerX * zoom + CANVAS_ORIGIN_X * zoom - dom.canvas.clientWidth / 2
    );
    dom.canvas.scrollTop = Math.max(
      0,
      centerY * zoom + CANVAS_ORIGIN_Y * zoom - dom.canvas.clientHeight / 2
    );
    if (minimap) scheduleMiniMapRender();
  }

  function settleCamera3(rig) {
    const { targetZoom, targetCx, targetCy, onComplete } = rig;
    camera3 = null;
    state.view.zoom = targetZoom;
    renderView();
    applyCamera3Frame(targetZoom, targetCx, targetCy, { minimap: true });
    if (dom.canvas) {
      dom.canvas.dataset.navigating = 'false';
      delete dom.canvas.dataset.zoomDirection;
      delete dom.canvas.dataset.camFps;
      delete dom.canvas.dataset.camera;
    }
    if (typeof onComplete === 'function') onComplete();
  }

  /**
   * Camera 3 chase loop — targets 60 FPS, integrates with clamped dt so a
   * hitch does not overshoot, and retargets without restarting from scratch.
   */
  function tickCamera3(now) {
    if (!camera3) return;
    const rig = camera3;
    // Ceiling must run even when every rAF is treated as a micro-frame skip.
    if ((now - (rig.startedAt || now)) >= CAMERA3.MAX_MS) {
      settleCamera3(rig);
      return;
    }
    let dtMs = now - (rig.lastTs || now);
    rig.lastTs = now;
    // Skip micro-frames (display > 60Hz) to keep work near TARGET_FPS budget.
    if (dtMs > 0 && dtMs < CAMERA3.FRAME_MS * 0.55) {
      rig.raf = requestAnimationFrame(tickCamera3);
      return;
    }
    dtMs = Math.min(Math.max(dtMs, CAMERA3.FRAME_MS * 0.5), CAMERA3.MAX_DT_MS);
    const dtSec = dtMs / 1000;
    const instFps = 1000 / dtMs;
    rig.fpsEma += (instFps - rig.fpsEma) * CAMERA3.FPS_EMA_ALPHA;
    rig.frame += 1;

    // Under load, ease chasing so we stay responsive without burning CPU.
    const load = Math.max(0, Math.min(1, (CAMERA3.TARGET_FPS - rig.fpsEma) / CAMERA3.TARGET_FPS));
    const zoomLambda = CAMERA3.ZOOM_LAMBDA * (1 - load * 0.35);
    const panLambda = CAMERA3.PAN_LAMBDA * (1 - load * 0.35);

    rig.liveZoom = cam3ExpSmooth(rig.liveZoom, rig.targetZoom, zoomLambda, dtSec);
    rig.liveCx = cam3ExpSmooth(rig.liveCx, rig.targetCx, panLambda, dtSec);
    rig.liveCy = cam3ExpSmooth(rig.liveCy, rig.targetCy, panLambda, dtSec);

    const paintMinimap = rig.frame % CAMERA3.MINIMAP_EVERY_N === 0;
    applyCamera3Frame(rig.liveZoom, rig.liveCx, rig.liveCy, { minimap: paintMinimap });

    if (dom.canvas) {
      dom.canvas.dataset.camFps = String(Math.round(rig.fpsEma));
      const zoomingIn = rig.targetZoom > rig.liveZoom + 0.015;
      const zoomingOut = rig.targetZoom < rig.liveZoom - 0.015;
      dom.canvas.dataset.zoomDirection = zoomingIn ? 'in' : zoomingOut ? 'out' : 'pan';
    }

    const zoomDone = Math.abs(rig.targetZoom - rig.liveZoom) <= CAMERA3.ARRIVE_ZOOM;
    const panDone = Math.hypot(rig.targetCx - rig.liveCx, rig.targetCy - rig.liveCy)
      <= CAMERA3.ARRIVE_PAN;
    if (zoomDone && panDone) {
      settleCamera3(rig);
      return;
    }
    rig.raf = requestAnimationFrame(tickCamera3);
  }

  /**
   * Camera 3 — set (or retarget) the chase goal. Mid-flight retarget keeps live
   * pose so focus changes feel continuous and interruptible.
   */
  function animateCameraTo(target, { onComplete, duration: _duration } = {}) {
    if (!dom.canvas || !dom.canvasInner) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    // Focus framing owns the camera; commit any live user zoom first.
    cancelUserZoom({ commit: true });
    const toZoom = clampZoom(target.zoom);
    const toCx = Number(target.centerX) || 0;
    const toCy = Number(target.centerY) || 0;

    if (camera3) {
      camera3.targetZoom = toZoom;
      camera3.targetCx = toCx;
      camera3.targetCy = toCy;
      camera3.onComplete = typeof onComplete === 'function' ? onComplete : null;
      // Continuous focus retargets must not inherit the first-gesture ceiling.
      camera3.startedAt = performance.now();
      const zoomingIn = toZoom > camera3.liveZoom + 0.02;
      const zoomingOut = toZoom < camera3.liveZoom - 0.02;
      dom.canvas.dataset.navigating = 'true';
      dom.canvas.dataset.camera = '3';
      dom.canvas.dataset.zoomDirection = zoomingIn ? 'in' : zoomingOut ? 'out' : 'pan';
      return;
    }

    const fromZoom = clampZoom(state.view.zoom || 1);
    const fromCenter = viewportModelCenter(fromZoom);
    dom.canvas.dataset.navigating = 'true';
    dom.canvas.dataset.camera = '3';
    const zoomingIn = toZoom > fromZoom + 0.02;
    const zoomingOut = toZoom < fromZoom - 0.02;
    dom.canvas.dataset.zoomDirection = zoomingIn ? 'in' : zoomingOut ? 'out' : 'pan';

    camera3 = {
      raf: 0,
      lastTs: performance.now(),
      startedAt: performance.now(),
      frame: 0,
      fpsEma: CAMERA3.TARGET_FPS,
      onComplete: typeof onComplete === 'function' ? onComplete : null,
      targetZoom: toZoom,
      targetCx: toCx,
      targetCy: toCy,
      liveZoom: fromZoom,
      liveCx: fromCenter.x,
      liveCy: fromCenter.y
    };
    camera3.raf = requestAnimationFrame(tickCamera3);
  }

  function allDomainsBounds() {
    if (!Array.isArray(state.domains) || state.domains.length === 0) {
      return { x: 0, y: 0, width: 480, height: 320 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    state.domains.forEach((domain) => {
      const box = domainBox(domain);
      minX = Math.min(minX, domain.x);
      minY = Math.min(minY, domain.y);
      maxX = Math.max(maxX, domain.x + box.width);
      maxY = Math.max(maxY, domain.y + box.height);
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(48, maxX - minX),
      height: Math.max(48, maxY - minY)
    };
  }

  function syncStageChrome() {
    const overviewBtn = document.getElementById('canvas-overview-btn');
    const stageFocus = state.view.canvasStage === 'focus' && Boolean(activeSelectionDomainId());
    if (overviewBtn) {
      overviewBtn.hidden = !stageFocus;
      overviewBtn.setAttribute('aria-pressed', String(stageFocus));
    }
    if (dom.canvas) {
      dom.canvas.dataset.canvasStage = stageFocus ? 'focus' : 'overview';
    }
  }

  /**
   * Overview = full diagram navigable. Focus = active domain on stage,
   * peers return from scaled depth tiers to full equal stage.
   * Camera flies first; layout remount waits until the flight finishes.
   */
  function showOverview({ camera = 'fit', persist = true } = {}) {
    if (!dom.canvas) return;
    const finishOverviewLayout = () => {
      state.view.canvasStage = 'overview';
      state.view.focusZoomLevel = 'overview';
      // Always remount. Soft-peer focus filters entities out of the DOM; callers
      // (setSelectedDomain(null) → paintSelectionChrome) clear depth classes and
      // flip canvasStage to overview BEFORE this settles, so a "was focus?" check
      // here is already false and would leave Users stuck at 1 of 5 cards.
      renderDomains();
      renderEdges();
      syncStageChrome();
      if (persist) saveState();
    };

    if (camera === 'reset') {
      animateCameraTo(
        { zoom: 1, centerX: 0, centerY: 0 },
        {
          duration: 320,
          onComplete: () => {
            dom.canvas.scrollTo({ left: CANVAS_ORIGIN_X, top: CANVAS_ORIGIN_Y, behavior: 'auto' });
            finishOverviewLayout();
          }
        }
      );
      return;
    }

    const bounds = allDomainsBounds();
    const fit = computeLevelFit(
      bounds,
      dom.canvas.clientWidth,
      dom.canvas.clientHeight,
      'overview'
    );
    animateCameraTo(
      {
        zoom: fit.zoom,
        centerX: fit.centerX,
        centerY: fit.centerY
      },
      { onComplete: finishOverviewLayout }
    );
  }

  function fitView() {
    // Fit must not destroy focus depth tiers / soft-peer mounts. Only drop to
    // full overview when nothing is selected.
    const hasSelection = Boolean(
      state.selectedDomainId
      || state.selectedEntityId
      || state.selectedRelationshipId
      || state.selectedNoteId
    );
    if (hasSelection) {
      focusSelectionOnCanvas({ persist: true, remountPeers: false });
      return;
    }
    showOverview({ camera: 'fit' });
  }

  function resetView() {
    const hasSelection = Boolean(
      state.selectedDomainId
      || state.selectedEntityId
      || state.selectedRelationshipId
      || state.selectedNoteId
    );
    if (hasSelection) {
      // Snap toward 100% then re-frame the live selection (keep focus stage).
      cancelUserZoom({ commit: true });
      cancelCameraFlight();
      state.view.zoom = 1;
      renderView();
      focusSelectionOnCanvas({ persist: true, remountPeers: false });
      return;
    }
    showOverview({ camera: 'reset' });
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
      try {
        if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      } catch {
        // Drag target may already be detached after a selection re-render.
      }
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
      // Document capture listeners first: selection handlers often remount the
      // canvas and detach `el`, which makes setPointerCapture throw and would
      // otherwise leave the gesture without move/up handlers.
      const ownerDocument = el.ownerDocument || document;
      ownerDocument.addEventListener('pointermove', move, true);
      ownerDocument.addEventListener('pointerup', end, true);
      ownerDocument.addEventListener('pointercancel', end, true);
      try {
        if (el.isConnected && typeof el.setPointerCapture === 'function') {
          el.setPointerCapture(pointerId);
        }
      } catch {
        // Optional: document listeners above still drive the drag.
      }
      if (typeof options.onPointerDown === 'function') options.onPointerDown(event);
    });

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function activeSelectionDomainId() {
    return state.selectedDomainId || state.selection?.domainId || null;
  }

  function isFocusStage() {
    return state.view.canvasStage === 'focus' && Boolean(activeSelectionDomainId());
  }

  function entityDomainId(entityId) {
    return findEntity(state.domains, entityId)?.domain?.id || null;
  }

  function incidentRelationshipIds(entityId) {
    return new Set(
      (state.relationships || [])
        .filter((rel) => rel.fromEntityId === entityId || rel.toEntityId === entityId)
        .map((rel) => rel.id)
    );
  }

  /**
   * Typed near-single focus: what stays on stage for the current selection kind.
   */
  function focusScenarioFor() {
    const kind = state.selection?.kind || 'none';
    const domainId = activeSelectionDomainId();
    const entityId = state.selectedEntityId || state.selection?.entityId || null;
    const fieldName = state.selection?.kind === 'field' ? state.selection.fieldName : null;
    const relationshipId = state.selectedRelationshipId || null;
    const noteId = state.selectedNoteId || null;
    const selectedRel = relationshipId
      ? (state.relationships || []).find((entry) => entry.id === relationshipId)
      : null;

    if (kind === 'none' || !domainId) {
      return {
        kind: 'none',
        keepDomains: null,
        keepEntities: null,
        keepEdges: null,
        keepNotes: null,
        endpointEntities: new Set(),
        fieldName: null
      };
    }

    if (kind === 'domain') {
      // Domain focus: Camera3 frames the home domain at full scale. Cross-linked
      // domains stay as soft peers (scaled background cards with real endpoint
      // entities). True outsiders stay on stage as a quieter/smaller depth tier
      // — still clickable / minimap-reachable, never equal stage competition.
      const homeEntities = new Set(
        (state.domains.find((d) => d.id === domainId)?.entities || []).map((e) => e.id)
      );
      const keepEntities = new Set(homeEntities);
      const keepEdges = new Set();
      const endpointEntities = new Set();
      (state.relationships || []).forEach((rel) => {
        const fromHome = homeEntities.has(rel.fromEntityId);
        const toHome = homeEntities.has(rel.toEntityId);
        if (!fromHome && !toHome) return;
        keepEdges.add(rel.id);
        if (fromHome && toHome) return;
        keepEntities.add(rel.fromEntityId);
        keepEntities.add(rel.toEntityId);
        if (!fromHome) endpointEntities.add(rel.fromEntityId);
        if (!toHome) endpointEntities.add(rel.toEntityId);
      });
      return {
        kind,
        keepDomains: new Set(
          [...keepEntities].map((id) => entityDomainId(id)).filter(Boolean)
        ),
        keepEntities,
        keepEdges,
        keepNotes: new Set(),
        endpointEntities,
        fieldName: null
      };
    }

    if (kind === 'entity') {
      // Focused entity full-scale; same-domain siblings stay on stage as quieter
      // background cards; cross-domain relationship endpoints stay as soft peers.
      const keepEdges = incidentRelationshipIds(entityId);
      const endpointEntities = new Set();
      (state.relationships || []).forEach((rel) => {
        if (!keepEdges.has(rel.id)) return;
        if (rel.fromEntityId !== entityId) endpointEntities.add(rel.fromEntityId);
        if (rel.toEntityId !== entityId) endpointEntities.add(rel.toEntityId);
      });
      const homeDomainId = entityDomainId(entityId);
      const keepEntities = new Set(
        (state.domains.find((entry) => entry.id === homeDomainId)?.entities || [])
          .map((entry) => entry.id)
      );
      endpointEntities.forEach((id) => keepEntities.add(id));
      if (entityId) keepEntities.add(entityId);
      return {
        kind,
        keepDomains: new Set(
          [...keepEntities].map((id) => entityDomainId(id)).filter(Boolean)
        ),
        keepEntities,
        keepEdges,
        keepNotes: new Set(),
        endpointEntities,
        fieldName: null
      };
    }

    if (kind === 'field') {
      // Field focus: edges that bind THIS field; siblings stay as background;
      // field-bound endpoints stay as soft peers (never hide cards off-stage).
      const keepEdges = new Set();
      const endpointEntities = new Set();
      (state.relationships || []).forEach((rel) => {
        if (!entityId) return;
        const fromField = inferRelationshipFieldName(rel, 'from');
        const toField = inferRelationshipFieldName(rel, 'to');
        const touchesField =
          (rel.fromEntityId === entityId && fromField === fieldName)
          || (rel.toEntityId === entityId && toField === fieldName);
        if (!touchesField) return;
        keepEdges.add(rel.id);
        if (rel.fromEntityId !== entityId) endpointEntities.add(rel.fromEntityId);
        if (rel.toEntityId !== entityId) endpointEntities.add(rel.toEntityId);
      });
      const homeDomainId = entityDomainId(entityId);
      const keepEntities = new Set(
        (state.domains.find((entry) => entry.id === homeDomainId)?.entities || [])
          .map((entry) => entry.id)
      );
      endpointEntities.forEach((id) => keepEntities.add(id));
      if (entityId) keepEntities.add(entityId);
      return {
        kind,
        keepDomains: new Set(
          [...keepEntities].map((id) => entityDomainId(id)).filter(Boolean)
        ),
        keepEntities,
        keepEdges,
        keepNotes: new Set(),
        endpointEntities,
        fieldName
      };
    }

    if (kind === 'relationship' && selectedRel) {
      // Selected edge endpoints stay primary; one-hop incident cross-links
      // promote soft peer domains (e.g. Users while framing Task↔Project) so
      // Camera3 does not crop background inventory off-stage.
      const seed = new Set([selectedRel.fromEntityId, selectedRel.toEntityId]);
      const keepEntities = new Set(seed);
      const keepEdges = new Set([selectedRel.id]);
      const endpointEntities = new Set(seed);
      (state.relationships || []).forEach((rel) => {
        const fromSeed = seed.has(rel.fromEntityId);
        const toSeed = seed.has(rel.toEntityId);
        if (!fromSeed && !toSeed) return;
        keepEdges.add(rel.id);
        if (!seed.has(rel.fromEntityId)) {
          keepEntities.add(rel.fromEntityId);
          endpointEntities.add(rel.fromEntityId);
        }
        if (!seed.has(rel.toEntityId)) {
          keepEntities.add(rel.toEntityId);
          endpointEntities.add(rel.toEntityId);
        }
      });
      // Same-domain siblings of the selected pair stay on stage (quiet tier).
      seed.forEach((id) => {
        const homeId = entityDomainId(id);
        (state.domains.find((entry) => entry.id === homeId)?.entities || []).forEach((ent) => {
          keepEntities.add(ent.id);
        });
      });
      return {
        kind,
        keepDomains: new Set(
          [...keepEntities].map((id) => entityDomainId(id)).filter(Boolean)
        ),
        keepEntities,
        keepEdges,
        keepNotes: new Set(),
        endpointEntities,
        fieldName: null
      };
    }

    if (kind === 'note') {
      return {
        kind,
        keepDomains: domainId ? new Set([domainId]) : new Set(),
        keepEntities: new Set(),
        keepEdges: new Set(),
        keepNotes: new Set([noteId].filter(Boolean)),
        endpointEntities: new Set(),
        fieldName: null
      };
    }

    return {
      kind: 'domain',
      keepDomains: new Set([domainId]),
      keepEntities: null,
      keepEdges: null,
      keepNotes: new Set(),
      endpointEntities: new Set(),
      fieldName: null
    };
  }

  function syncSelectionClasses() {
    const scenario = focusScenarioFor();
    const stageFocus = scenario.kind !== 'none';
    const activeDomainId = activeSelectionDomainId();
    const entitySelected = Boolean(state.selectedEntityId || state.selection?.entityId);

    if (dom.canvas) {
      dom.canvas.dataset.focusKind = scenario.kind;
    }

    // Unique focus subject: exactly one primary gets is-focus.
    // Domain focus → domain only. Entity/field → entity only (home domain uses
    // context-active shell, never is-focus). Relationship → from-side primary.
    const domainIsUniqueFocus = stageFocus && scenario.kind === 'domain';
    const nestedEntityFocus = scenario.kind === 'entity' || scenario.kind === 'field';
    const relationshipPrimaryId = scenario.kind === 'relationship'
      ? ((state.relationships || []).find((entry) => entry.id === state.selectedRelationshipId)
        ?.fromEntityId || null)
      : null;

    dom.canvasInner.querySelectorAll('.domain[data-domain-id]').forEach((node) => {
      const id = node.dataset.domainId;
      const keep = !scenario.keepDomains || scenario.keepDomains.has(id);
      const isActive = id === activeDomainId;
      const isSoftPeer = stageFocus && keep && !isActive;
      const isQuietBg = stageFocus && !keep;
      const isFocusDomain = domainIsUniqueFocus && isActive;
      node.classList.toggle('selected', isActive && !entitySelected && scenario.kind === 'domain');
      node.classList.toggle(
        'context-active',
        isActive && (nestedEntityFocus || scenario.kind === 'relationship')
      );
      node.classList.toggle('is-focus', isFocusDomain);
      // Depth tiers stay on stage: soft peers + quieter outsiders (no hide).
      node.classList.toggle('is-quiet', isQuietBg);
      node.classList.toggle('is-staged-away', false);
      node.classList.toggle('is-soft', isSoftPeer);
      if (isFocusDomain) node.dataset.stageDepth = '0';
      else if (isSoftPeer) node.dataset.stageDepth = '1';
      else if (isQuietBg) node.dataset.stageDepth = '2';
      else delete node.dataset.stageDepth;
    });

    dom.canvasInner.querySelectorAll('.entity[data-entity-id]').forEach((node) => {
      const id = node.dataset.entityId;
      const inMulti = Array.isArray(state.selectedEntityIds) && state.selectedEntityIds.includes(id);
      const isSelected = id === state.selectedEntityId || inMulti;
      const isFocusEntity = Boolean(
        (nestedEntityFocus && isSelected)
        || (scenario.kind === 'relationship' && relationshipPrimaryId && id === relationshipPrimaryId)
      );
      const keep = !scenario.keepEntities || scenario.keepEntities.has(id);
      const isEndpoint = scenario.endpointEntities.has(id);
      const entityHomeId = entityDomainId(id);
      // Soft = cross-domain relationship endpoints, OR any card living inside a
      // soft-peer domain. Same-domain siblings of the focus stay quieter so
      // Task focus does not promote Project/Comment to soft-peer scale — but
      // soft-peer inventory must stay readable (quiet-on-soft stacked opacity
      // looked like ghost empty chips in nav-video vision).
      const isCrossDomainEndpoint = Boolean(
        isEndpoint
        && entityHomeId
        && activeDomainId
        && entityHomeId !== activeDomainId
      );
      const inSoftPeerDomain = Boolean(
        stageFocus
        && entityHomeId
        && activeDomainId
        && entityHomeId !== activeDomainId
        && scenario.keepDomains?.has(entityHomeId)
      );
      const isSoft = stageFocus && !isFocusEntity && (
        inSoftPeerDomain
        || (keep && (
          scenario.kind === 'relationship'
            ? isEndpoint
            : isCrossDomainEndpoint
        ))
      );
      const isQuietBg = stageFocus && !isFocusEntity && !isSoft && (
        !keep
        || (nestedEntityFocus && keep)
      );
      node.classList.toggle('selected', isSelected || isFocusEntity);
      node.classList.toggle('is-quiet', isQuietBg);
      node.classList.toggle('is-staged-away', false);
      node.classList.toggle('is-soft', isSoft);
      node.classList.toggle('is-edge-endpoint', isEndpoint && !isFocusEntity);
      node.classList.toggle('is-focus', stageFocus && isFocusEntity);
      if (stageFocus && isFocusEntity) node.dataset.stageDepth = '0';
      else if (isSoft) node.dataset.stageDepth = '1';
      else if (isQuietBg) node.dataset.stageDepth = '2';
      else delete node.dataset.stageDepth;
    });

    dom.canvasInner.querySelectorAll('.entity-field-row[data-field-name]').forEach((node) => {
      const ownerEntityId = node.closest('.entity[data-entity-id]')?.dataset?.entityId;
      const selected = Boolean(
        scenario.fieldName
        && ownerEntityId
        && ownerEntityId === state.selectedEntityId
        && node.dataset.fieldName === scenario.fieldName
      );
      node.classList.toggle('is-selected', selected);
    });

    dom.canvasInner.querySelectorAll('.canvas-note[data-note-id]').forEach((node) => {
      const id = node.dataset.noteId;
      const keep = !scenario.keepNotes || scenario.keepNotes.has(id);
      node.classList.toggle('selected', id === state.selectedNoteId);
      node.classList.toggle('is-quiet', stageFocus && !keep);
      node.classList.toggle('is-staged-away', stageFocus && !keep);
    });

    syncEdgeChrome(scenario);
    syncStageChrome();
  }

  function syncEdgeChrome(scenarioOrDomainId) {
    if (!dom.edges) return;
    const scenario = typeof scenarioOrDomainId === 'object' && scenarioOrDomainId
      ? scenarioOrDomainId
      : focusScenarioFor();
    const selectedId = state.selectedRelationshipId || null;
    const hoverId = dom.edges.dataset.hoverRelationshipId || null;
    const stageFocus = scenario.kind !== 'none';
    dom.edges.querySelectorAll('[data-relationship-id]').forEach((node) => {
      const id = node.dataset.relationshipId;
      const keep = !scenario.keepEdges || scenario.keepEdges.has(id);
      const staged = stageFocus && !keep;
      node.classList.toggle('is-quiet', staged);
      node.classList.toggle('is-staged-away', staged);
      node.classList.toggle('is-soft', false);
      node.classList.toggle('is-hover', id === hoverId && id !== selectedId && keep);
      node.classList.toggle('active', id === selectedId);
    });
  }

  function setEdgeHover(relationshipId) {
    if (!dom.edges) return;
    if (relationshipId) dom.edges.dataset.hoverRelationshipId = relationshipId;
    else delete dom.edges.dataset.hoverRelationshipId;
    syncEdgeChrome(focusScenarioFor());
  }

  /**
   * Tight zoom-in target — primary subject center only (never soft-peer union).
   * Relationship primary = from-side endpoint.
   */
  function selectionZoomAnchorPoint() {
    if (state.selectedRelationshipId) {
      const relationship = (state.relationships || [])
        .find((entry) => entry.id === state.selectedRelationshipId);
      if (relationship) {
        const from = findEntity(state.domains, relationship.fromEntityId);
        if (from) {
          return {
            x: from.domain.x + from.entity.x + entityWidth(from.entity) / 2,
            y: from.domain.y + from.entity.y
              + entityBoxHeight(from.entity, state.view.compactEntities, state.view.largeCanvasMode) / 2
          };
        }
      }
    }
    // Entity / field: lock onto the focused card (or field row), never the
    // soft-peer hull union — that center sits in empty inter-domain void.
    if (state.selectedEntityId) {
      const found = findEntity(state.domains, state.selectedEntityId);
      if (found) {
        const entityBox = {
          x: found.domain.x + found.entity.x,
          y: found.domain.y + found.entity.y,
          width: entityWidth(found.entity),
          height: entityBoxHeight(
            found.entity,
            state.view.compactEntities,
            state.view.largeCanvasMode
          )
        };
        const fieldName = state.selection?.kind === 'field' ? state.selection.fieldName : null;
        if (fieldName && !state.view.compactEntities && !state.view.largeCanvasMode) {
          const rowHeight = entityFieldRowHeight(state.view.largeCanvasMode);
          const fieldIndex = Math.max(
            0,
            (found.entity.fields || []).findIndex((field) => field.name === fieldName)
          );
          return {
            x: entityBox.x + entityBox.width / 2,
            y: entityBox.y + 32 + fieldIndex * rowHeight + rowHeight / 2
          };
        }
        return {
          x: entityBox.x + entityBox.width / 2,
          y: entityBox.y + entityBox.height / 2
        };
      }
    }
    if (state.selectedDomainId) {
      const domain = state.domains.find((entry) => entry.id === state.selectedDomainId);
      if (domain) {
        const box = domainBox(domain);
        return {
          x: domain.x + box.width / 2,
          y: domain.y + box.height / 2
        };
      }
    }
    const bounds = selectionFocusBounds();
    if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) return null;
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }

  /**
   * Model-space box for Camera3 — PRIMARY SUBJECT ONLY (tight pad).
   * Soft peers may sit in the periphery after framing; never expand the frame
   * to fit soft-peer hulls as equal citizens.
   */
  function selectionFocusBounds() {
    const padSubject = (box, pad = 36) => ({
      x: box.x - pad,
      y: box.y - pad,
      width: Math.max(160, box.width + pad * 2),
      height: Math.max(120, box.height + pad * 2)
    });

    if (state.selectedNoteId) {
      const note = (state.notes || []).find((entry) => entry.id === state.selectedNoteId);
      if (note) {
        return padSubject({
          x: note.x,
          y: note.y,
          width: Number.isFinite(note.width) ? note.width : 220,
          height: Number.isFinite(note.height) ? note.height : 120
        }, 28);
      }
    }

    if (state.selectedRelationshipId) {
      const relationship = (state.relationships || [])
        .find((entry) => entry.id === state.selectedRelationshipId);
      if (relationship) {
        const from = findEntity(state.domains, relationship.fromEntityId);
        const to = findEntity(state.domains, relationship.toEntityId);
        if (from) {
          // Primary = from-side endpoint. Frame that card tightly; optionally
          // nudge ~12% toward the to-side if it is nearby — never equal union
          // and never soft-peer domain hull expansion.
          const fromBox = {
            x: from.domain.x + from.entity.x,
            y: from.domain.y + from.entity.y,
            width: entityWidth(from.entity),
            height: entityBoxHeight(
              from.entity,
              state.view.compactEntities,
              state.view.largeCanvasMode
            )
          };
          const framed = padSubject(fromBox, 40);
          if (to) {
            const toCx = to.domain.x + to.entity.x + entityWidth(to.entity) / 2;
            const toCy = to.domain.y + to.entity.y
              + entityBoxHeight(to.entity, state.view.compactEntities, state.view.largeCanvasMode) / 2;
            const fromCx = fromBox.x + fromBox.width / 2;
            const fromCy = fromBox.y + fromBox.height / 2;
            const dx = toCx - fromCx;
            const dy = toCy - fromCy;
            const near = Math.hypot(dx, dy) < Math.max(fromBox.width, fromBox.height) * 3.2;
            if (near) {
              const bias = 0.12;
              return {
                x: framed.x + dx * bias,
                y: framed.y + dy * bias,
                width: framed.width,
                height: framed.height
              };
            }
          }
          return framed;
        }
      }
    }

    const found = state.selectedEntityId
      ? findEntity(state.domains, state.selectedEntityId)
      : null;
    if (found) {
      const fieldName = state.selection?.kind === 'field' ? state.selection.fieldName : null;
      const entityBox = {
        x: found.domain.x + found.entity.x,
        y: found.domain.y + found.entity.y,
        width: entityWidth(found.entity),
        height: entityBoxHeight(
          found.entity,
          state.view.compactEntities,
          state.view.largeCanvasMode
        )
      };
      if (!fieldName) {
        // Entity focus: subject card only — soft peers stay peripheral.
        return padSubject(entityBox, 32);
      }
      // Field focus: owning entity + field row (tight), not peer/domain union.
      const rowHeight = entityFieldRowHeight(state.view.largeCanvasMode);
      const fieldIndex = Math.max(
        0,
        (found.entity.fields || []).findIndex((field) => field.name === fieldName)
      );
      const fieldBox = {
        x: entityBox.x,
        y: entityBox.y + 32 + fieldIndex * rowHeight,
        width: entityBox.width,
        height: Math.max(rowHeight + 8, 36)
      };
      const seed = {
        x: Math.min(entityBox.x, fieldBox.x),
        y: Math.min(entityBox.y, fieldBox.y),
        width: entityBox.width,
        height: Math.max(entityBox.height, fieldBox.y + fieldBox.height - entityBox.y)
      };
      return padSubject(seed, 28);
    }

    const domain = state.domains.find((candidate) => candidate.id === state.selectedDomainId);
    if (!domain) return null;
    const box = domainBox(domain);
    // Domain focus: home hull only — other domains may clip in periphery.
    return padSubject({ x: domain.x, y: domain.y, width: box.width, height: box.height }, 44);
  }

  function selectionZoomLevel() {
    if (state.selectedNoteId) return 'note';
    if (state.selectedRelationshipId) return 'relationship';
    if (state.selection?.kind === 'field' && state.selectedEntityId) return 'field';
    if (state.selectedEntityId) return 'entity';
    if (state.selectedDomainId) return 'domain';
    return 'overview';
  }

  /**
   * Fly the camera onto the selection at the hierarchical zoom level, then
   * settle focus-stage layout. Soft-select during drag calls
   * `syncSelectionClasses` only — not this.
   */
  function focusSelectionOnCanvas({ persist = true, remountPeers = true } = {}) {
    if (!dom.canvas) return;
    const bounds = selectionFocusBounds();
    if (!bounds) {
      state.view.canvasStage = 'overview';
      syncSelectionClasses();
      return;
    }

    const focusDomainId = state.selectedDomainId
      || (state.selectedEntityId
        ? findEntity(state.domains, state.selectedEntityId)?.domain?.id
        : null)
      || null;

    if (focusDomainId && !state.selectedDomainId) {
      state.selectedDomainId = focusDomainId;
    }

    // Soft peers must remount BEFORE Camera3 flight. Deferring remount until
    // settle left Users as an empty chip while cross-domain edges still painted
    // midX gutters (live 7.34.08AM shot). Soft-peer cards need real anchors now.
    const priorLevel = state.view.focusZoomLevel || (
      state.view.canvasStage === 'focus' ? 'domain' : 'overview'
    );
    if (focusDomainId) state.view.canvasStage = 'focus';
    if (remountPeers && focusDomainId) {
      renderDomains();
      renderEdges();
    }
    syncSelectionClasses();
    syncStageChrome();

    const level = selectionZoomLevel();
    const fit = computeLevelFit(
      bounds,
      dom.canvas.clientWidth,
      dom.canvas.clientHeight,
      level
    );

    const LEVEL_RANK = {
      overview: 0,
      domain: 1,
      note: 2,
      relationship: 2,
      entity: 3,
      field: 4
    };
    const currentZoom = clampZoom(state.view.zoom || 1);
    const climbing = (LEVEL_RANK[level] ?? 0) < (LEVEL_RANK[priorLevel] ?? 0);
    // Zoom-out guard ONLY when climbing hierarchy (entity→domain, domain→overview).
    // overview→domain and peer domain switches MUST zoom in to the primary subject
    // — the old blanket domain guard left Users+Tasks as equal citizens at overview
    // framing (tree select painted chrome only; Camera3 never tightened).
    if (climbing && (level === 'domain' || level === 'overview') && fit.zoom > currentZoom + 0.04) {
      fit.zoom = currentZoom;
    }
    // Domain exclusive: when entering/refocusing a domain (not climbing), push
    // Camera3 past the soft overview framing so the primary subject dominates
    // and soft peers fall to the periphery (not equal stage citizens).
    if (level === 'domain' && !climbing) {
      fit.zoom = Math.min(1.85, Math.max(fit.zoom, fit.zoom * 1.22));
    }
    // Zoom-in preference: deeper levels should not land wider than current framing.
    // Bounds are primary-subject-only, so the nudge is safe (no soft-peer union).
    if (
      (level === 'entity' || level === 'field' || level === 'relationship' || level === 'note')
      && fit.zoom < currentZoom - 0.02
      && state.view.canvasStage === 'focus'
    ) {
      const nudge = level === 'field' ? 1.08 : level === 'relationship' ? 1.08 : 1.06;
      const cap = level === 'field' ? 1.65 : 2.2;
      fit.zoom = Math.min(cap, Math.max(fit.zoom, currentZoom * nudge));
    }
    state.view.focusZoomLevel = level;

    animateCameraTo(
      {
        zoom: fit.zoom,
        centerX: fit.centerX,
        centerY: fit.centerY
      },
      {
        onComplete: () => {
          // Soft field hops may skip remountPeers; re-sync chrome after settle.
          if (remountPeers && focusDomainId) {
            renderEdges();
          }
          syncSelectionClasses();
          syncStageChrome();
          if (persist) saveState();
        }
      }
    );
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

    const scenario = focusScenarioFor();
    const stageFocus = isFocusStage();
    const activeDomainId = activeSelectionDomainId();

    state.domains.forEach((domain) => {
      const domainEl = document.createElement('section');
      domainEl.className = `domain${state.selectedDomainId === domain.id ? ' selected' : ''}`;
      domainEl.dataset.domainId = domain.id;
      // Depth hierarchy on the same stage: focus (full), soft peers (mid scale
      // with real endpoint cards), quieter outsiders (smaller scale, collapsed
      // for packing). Never hide domains off-stage or leave empty "0 entities"
      // ghosts while edges still target their model anchors.
      const keepDomain = !scenario.keepDomains || scenario.keepDomains.has(domain.id);
      const quietBg = stageFocus && !keepDomain;
      const softPeer = stageFocus && keepDomain && domain.id !== activeDomainId;
      const collapsed = isDomainCollapsed(domain) || quietBg;
      const chipBox = domainBox({ ...domain, collapsed: true });
      // Soft peers keep the FULL domain hull + inventory on stage (scaled/dimmed
      // via CSS depth tiers). Endpoint-only filtering left empty "1 soft peer"
      // chips that failed the MVP bar — other domains must stay readable, not
      // ghost stubs while Camera3 frames the focus.
      let box;
      if (quietBg) {
        box = { width: Math.min(220, chipBox.width), height: chipBox.height };
      } else {
        box = domainBox(domain);
      }
      domainEl.style.left = `${modelToCanvasX(domain.x)}px`;
      domainEl.style.top = `${modelToCanvasY(domain.y)}px`;
      domainEl.style.width = `${box.width}px`;
      domainEl.style.height = `${box.height}px`;
      domainEl.style.setProperty('--domain-color', domain.color);
      if (stageFocus && domain.id === activeDomainId) {
        domainEl.dataset.stageDepth = '0';
      } else if (softPeer) {
        domainEl.classList.add('is-soft');
        domainEl.dataset.stageDepth = '1';
        domainEl.title = `Soft peer domain "${domain.name}"`;
      } else if (quietBg) {
        domainEl.classList.add('is-quiet');
        domainEl.dataset.stageDepth = '2';
        domainEl.title = `Go to domain "${domain.name}"`;
      }
      // Selection authority: soft on pointerdown (drag), hard settle on click-end.
      // No separate mousedown remount — that fought Camera3 mid-flight.
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
        quietBg
          ? `Focus domain "${domain.name}"`
          : `${collapsed ? 'Expand' : 'Collapse'} domain "${domain.name}"`
      );
      collapseBtn.addEventListener('pointerdown', (event) => event.stopPropagation());
      collapseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (quietBg) {
          setSelectedDomain(domain.id);
          return;
        }
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
      // Soft select during pointerdown: a full render remounts this domain and
      // breaks setPointerCapture / the in-flight drag. Full remount on click end.
      // Track exclusive focus at down so click-end can reverse-nav only on a
      // true re-click — not after soft→hard of a fresh canvas domain pick.
      let domainExclusiveAtPointerDown = false;
      const selectDomainOnPointer = (options) => setSelectedDomain(domain.id, options);
      const persistMovedDomain = {
        onPointerDown: () => {
          domainExclusiveAtPointerDown = Boolean(
            domain.id === state.selectedDomainId
            && !state.selectedEntityId
            && !state.selectedRelationshipId
            && !state.selectedNoteId
            && state.view?.canvasStage === 'focus'
            && state.selection?.kind === 'domain'
          );
          selectDomainOnPointer({ remountCanvas: false });
        },
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
          if (!moved) {
            // Click (no drag): chrome + Camera3 remount. reverseNav only when
            // this domain was already exclusive focus at pointerdown (panel
            // path is single-shot and never hits this soft→hard trap).
            selectDomainOnPointer({
              remountCanvas: true,
              reverseNav: domainExclusiveAtPointerDown
            });
            return;
          }
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
        // Quiet background tier (collapsed for packing) or user-collapsed.
        // Soft peers never take this path — they stay expanded with endpoint
        // cards so corridors anchor to real content, not midX gutters.
        // Quiet chips keep the real model count (never a lying "0 entities"
        // ghost while the domain still exists in the model).
        const quietCountEl = headerEl.querySelector('.entity-count');
        if (quietCountEl && quietBg) {
          quietCountEl.textContent = `${domain.entities.length} in background`;
        }
        domainEl.appendChild(resizeHandleFor(domain, domainEl, collapsed));
        dom.canvasInner.appendChild(domainEl);
        return;
      }

      // Always render the full domain inventory for focus + soft peers. Depth
      // (is-soft / is-quiet / stageDepth) carries visual hierarchy — never strip
      // cards out of the DOM (that produced empty soft chips and dead peers).
      const entitiesToRender = domain.entities;
      const countEl = headerEl.querySelector('.entity-count');
      if (countEl && softPeer) {
        countEl.textContent = `${domain.entities.length} in background`;
      }

      entitiesToRender.forEach((entity) => {
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
          // Pick mode consumes the click; otherwise ensure selection even when the
          // gesture skipped pointerdown (programmatic click / keyboard activation).
          if (interaction.relationshipPickActive) {
            handleEntityRelationshipPick(entity.id);
            return;
          }
          if (state.selectedEntityId !== entity.id) {
            setSelectedEntity(entity.id, { remountCanvas: true });
          }
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
        entityNameEl.addEventListener('click', (event) => {
          event.stopPropagation();
          // Name field must not swallow soft/quiet peer re-focus — select first.
          if (state.selectedEntityId !== entity.id) {
            setSelectedEntity(entity.id, { remountCanvas: true });
          }
        });
        entityNameEl.addEventListener('pointerdown', (event) => {
          event.stopPropagation();
          if (state.selectedEntityId !== entity.id) {
            setSelectedEntity(entity.id, { remountCanvas: true });
          }
        });
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
          onPointerDown: () => setSelectedEntity(entity.id, { remountCanvas: false }),
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
            if (!moved) {
              // Re-focusing a different card (incl. soft/quiet peers) must remount
              // depth tiers; same-card re-click stays soft to avoid Camera3 thrash.
              const changed = state.selectedEntityId !== entity.id
                || state.selection?.kind !== 'entity';
              setSelectedEntity(entity.id, { remountCanvas: changed });
              return;
            }
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
            const fieldSelected = state.selection?.kind === 'field'
              && state.selectedEntityId === entity.id
              && state.selection.fieldName === field.name;
            li.className = [
              'entity-field-row',
              connectedFieldNames.has(field.name) ? 'relationship-field-connected' : '',
              fieldSelected ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            li.dataset.fieldName = field.name;
            if (state.view.largeCanvasMode) {
              li.textContent = fieldLabel(field);
              li.addEventListener('click', (event) => {
                event.stopPropagation();
                if (typeof setSelectedField === 'function') setSelectedField(entity.id, field.name);
                else setSelectedEntity(entity.id);
              });
              fieldsEl.appendChild(li);
              return;
            }
            li.addEventListener('click', (event) => {
              if (event.target.closest('input, select, button, details, summary, a, .field-link-handle, .entity-anchor')) {
                return;
              }
              event.stopPropagation();
              if (typeof setSelectedField === 'function') setSelectedField(entity.id, field.name);
              else setSelectedEntity(entity.id);
            });

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
            nameEl.addEventListener('click', (event) => {
              event.stopPropagation();
              if (typeof setSelectedField === 'function') setSelectedField(entity.id, field.name, { remountCanvas: false });
            });
            nameEl.addEventListener('pointerdown', (event) => event.stopPropagation());
            nameEl.addEventListener('focus', () => {
              if (typeof setSelectedField === 'function') setSelectedField(entity.id, field.name, { remountCanvas: false });
            });
            nameEl.addEventListener('pointerup', () => nameEl.focus());
            nameEl.addEventListener('change', () => {
              const nextName = nameEl.value.trim();
              if (!nextName || nextName === field.name) {
                nameEl.value = field.name;
                return;
              }
              withPersist(() => {
                field.name = nextName;
                if (typeof setSelectedField === 'function') {
                  state.selection = {
                    ...(state.selection || {}),
                    kind: 'field',
                    fieldName: nextName,
                    entityId: entity.id,
                    domainId: state.selectedDomainId
                  };
                }
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
            li.addEventListener('contextmenu', (event) => {
              if (typeof setSelectedField === 'function') setSelectedField(entity.id, field.name, { remountCanvas: false });
              else setSelectedEntity(entity.id);
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
    syncSelectionClasses();
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
      const selected = state.selectedNoteId === note.id;
      noteEl.className = `canvas-note${selected ? ' selected' : ''}`;
      noteEl.dataset.noteId = note.id;
      noteEl.style.left = `${modelToCanvasX(note.x)}px`;
      noteEl.style.top = `${modelToCanvasY(note.y)}px`;
      noteEl.style.background = note.color;

      noteEl.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (event.target.closest('textarea, button, input')) return;
        setSelectedNote(note.id);
      });

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
          setSelectedNote(note.id, { remountCanvas: false });
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
      text.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        setSelectedNote(note.id);
      });
      text.addEventListener('change', () => {
        withPersist(() => {
          note.text = text.value;
        });
      });
      noteEl.appendChild(text);

      noteEl.addEventListener('contextmenu', (event) => {
        setSelectedNote(note.id);
        openElementMenu(event, 'Note', [
          {
            label: 'Edit in inspector',
            run: () => setSelectedNote(note.id)
          },
          {
            label: 'Delete note',
            danger: true,
            run: () => withPersist(() => {
              state.notes = state.notes.filter((candidate) => candidate.id !== note.id);
              if (state.selectedNoteId === note.id) state.selectedNoteId = null;
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
    let createdId = null;
    withPersist(() => {
      const zoom = state.view.zoom || 1;
      const centre = position || {
        x: Math.round((dom.canvas.scrollLeft + dom.canvas.clientWidth / 2) / zoom - CANVAS_ORIGIN_X),
        y: Math.round((dom.canvas.scrollTop + dom.canvas.clientHeight / 2) / zoom - CANVAS_ORIGIN_Y)
      };
      const created = {
        id: `note-${String(Date.now())}`,
        text: '',
        x: centre.x,
        y: centre.y,
        color: '#fde68a'
      };
      createdId = created.id;
      state.notes = [...(state.notes || []), created];
      render();
    });
    if (createdId) setSelectedNote(createdId);
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

  function allEntityBounds(excludeIds = new Set(), pad = 10) {
    const compact = Boolean(state.view.compactEntities);
    const large = Boolean(state.view.largeCanvasMode);
    const inset = Math.max(0, Number(pad) || 0);
    return state.domains.flatMap((domain) => domain.entities
      .filter((entity) => !excludeIds.has(entity.id))
      .map((entity) => ({
        entityId: entity.id,
        x: domain.x + entity.x - inset,
        y: domain.y + entity.y - inset,
        width: entityWidth(entity) + inset * 2,
        height: entityBoxHeight(entity, compact, large) + inset * 2
      })));
  }

  /** Domain hulls as soft obstacles so cross-domain links skirt the cards. */
  function allDomainBounds(excludeDomainIds = new Set()) {
    return state.domains
      .filter((domain) => !excludeDomainIds.has(domain.id))
      .map((domain) => {
        const size = domainBox(domain);
        // Inflated pad keeps corridor strokes off soft-domain borders (edge skim).
        return {
          entityId: `domain:${domain.id}`,
          x: domain.x - 16,
          y: domain.y - 16,
          width: size.width + 32,
          height: size.height + 32
        };
      });
  }

  function routeObstaclesFor(relationship) {
    const from = findEntity(state.domains, relationship.fromEntityId);
    const to = findEntity(state.domains, relationship.toEntityId);
    // Exclude endpoints — stub exits intentionally graze their own hulls. Tight
    // pad so mid-gutters between close cards stay open (Project↔Task golden).
    const exclude = new Set([relationship.fromEntityId, relationship.toEntityId].filter(Boolean));
    const entityObstacles = allEntityBounds(exclude, 8);
    if (!from || !to || from.domain.id === to.domain.id) return entityObstacles;
    // Cross-domain: skirt foreign domain hulls, but never the two endpoints' domains.
    const foreignDomains = allDomainBounds(new Set([from.domain.id, to.domain.id]));
    return entityObstacles.concat(foreignDomains);
  }

  function segmentIntersectsBox(a, b, box) {
    const minX = box.x;
    const maxX = box.x + box.width;
    const minY = box.y;
    const maxY = box.y + box.height;
    // Liang–Barsky: orthogonal and diagonal corridors both count as hits.
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const clips = [
      [-dx, a.x - minX],
      [dx, maxX - a.x],
      [-dy, a.y - minY],
      [dy, maxY - a.y]
    ];
    for (let index = 0; index < clips.length; index += 1) {
      const [p, q] = clips[index];
      if (p === 0) {
        if (q < 0) return false;
        continue;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
    return t0 <= t1;
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

  /**
   * Collisions on the corridor only — skip exit/enter stubs so hull exits
   * are not scored as failures, but a stub→stub shortcut through a box is.
   */
  function routeInteriorCollisionCount(points, obstacles) {
    if (!Array.isArray(points) || points.length < 2 || !obstacles?.length) return 0;
    if (points.length === 2) {
      return obstacles.filter((box) => segmentIntersectsBox(points[0], points[1], box)).length;
    }
    let total = 0;
    for (let index = 1; index < points.length - 2; index += 1) {
      total += obstacles.filter((box) => segmentIntersectsBox(points[index], points[index + 1], box)).length;
    }
    return total;
  }

  function entityBoundById(entityId) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    const compact = Boolean(state.view.compactEntities);
    const large = Boolean(state.view.largeCanvasMode);
    return {
      entityId,
      x: found.domain.x + found.entity.x - 10,
      y: found.domain.y + found.entity.y - 10,
      width: entityWidth(found.entity) + 20,
      height: entityBoxHeight(found.entity, compact, large) + 20
    };
  }

  /**
   * If the route still clips an endpoint hull (or is a 2-point diagonal),
   * force an exterior orthogonal elbow in the clear gutter around both boxes.
   */
  function ensureRouteClearsEndpointHulls(points, relationship, fromSide, toSide) {
    const fromBox = entityBoundById(relationship.fromEntityId);
    const toBox = entityBoundById(relationship.toEntityId);
    const endpointBoxes = [fromBox, toBox].filter(Boolean);
    if (!endpointBoxes.length) return points;
    const otherBoxes = allEntityBounds(new Set([
      relationship.fromEntityId,
      relationship.toEntityId
    ]));
    const interiorHits = routeInteriorCollisionCount(points, endpointBoxes)
      + routeCollisionCount(points, otherBoxes);
    const isDiagonalTwoPoint = points.length === 2
      && points[0].x !== points[1].x
      && points[0].y !== points[1].y;
    if (interiorHits === 0 && !isDiagonalTwoPoint) return points;

    const pad = 44;
    const start = points[0];
    const end = points[points.length - 1];
    const fromStub = pointOffsetBySide(start, fromSide || 'right', pad);
    const toStub = pointOffsetBySide(end, toSide || 'left', pad);
    const left = Math.min(...endpointBoxes.map((box) => box.x)) - pad;
    const right = Math.max(...endpointBoxes.map((box) => box.x + box.width)) + pad;
    const top = Math.min(...endpointBoxes.map((box) => box.y)) - pad;
    const bottom = Math.max(...endpointBoxes.map((box) => box.y + box.height)) + pad;
    const obstacles = allEntityBounds();
    const candidates = [
      [start, fromStub, { x: right, y: fromStub.y }, { x: right, y: toStub.y }, toStub, end],
      [start, fromStub, { x: left, y: fromStub.y }, { x: left, y: toStub.y }, toStub, end],
      [start, fromStub, { x: fromStub.x, y: top }, { x: toStub.x, y: top }, toStub, end],
      [start, fromStub, { x: fromStub.x, y: bottom }, { x: toStub.x, y: bottom }, toStub, end],
      // Mid-gutter elbows between the two boxes.
      [start, fromStub, { x: fromStub.x, y: fromStub.y }, { x: toStub.x, y: fromStub.y }, toStub, end],
      [start, fromStub, { x: fromStub.x, y: toStub.y }, { x: toStub.x, y: toStub.y }, toStub, end]
    ].map(normalizeRoutePoints);
    candidates.sort((leftRoute, rightRoute) => (
      scoreRoute(leftRoute, obstacles, relationship)
      - scoreRoute(rightRoute, obstacles, relationship)
    ));
    const best = candidates[0] || points;
    if (best.length === 2 && best[0].x !== best[1].x && best[0].y !== best[1].y) {
      // Avoid recursion into ensure — pick shortest exterior lane.
      return forceOrthogonalCorridor(best, null, fromSide, toSide);
    }
    return best;
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

  /**
   * Rank every link spanning the same two domains (0..n-1). Used to stack
   * highways just above the strip (rank*lane) so labels never share a Y and the
   * outer ranks do not get shoved into absurd negative canvas Y.
   */
  function crossDomainRouteRank(relationship) {
    const fromDomain = entityDomainId(relationship.fromEntityId);
    const toDomain = entityDomainId(relationship.toEntityId);
    if (!fromDomain || !toDomain || fromDomain === toDomain) return 0;
    const pair = new Set([fromDomain, toDomain]);
    const sorted = [...state.relationships]
      .filter((candidate) => {
        const left = entityDomainId(candidate.fromEntityId);
        const right = entityDomainId(candidate.toEntityId);
        return left && right && left !== right && pair.has(left) && pair.has(right);
      })
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    return Math.max(0, sorted.findIndex((candidate) => candidate.id === relationship.id));
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

  function routeDomainEscapePenalty(points, relationship) {
    const from = findEntity(state.domains, relationship.fromEntityId);
    const to = findEntity(state.domains, relationship.toEntityId);
    if (!from || !to || from.domain.id !== to.domain.id) return 0;
    const size = domainBox(from.domain);
    const pad = 28;
    const minX = from.domain.x - pad;
    const minY = from.domain.y - pad;
    const maxX = from.domain.x + size.width + pad;
    const maxY = from.domain.y + size.height + pad;
    return points.reduce((total, point) => {
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return total + 300000;
      }
      return total;
    }, 0);
  }

  function scoreRoute(points, obstacles, relationship) {
    const endpointIds = new Set([relationship.fromEntityId, relationship.toEntityId]);
    const otherObstacles = obstacles.filter((box) => !endpointIds.has(box.entityId));
    const endpointObstacles = obstacles.filter((box) => endpointIds.has(box.entityId));
    const collisions = routeCollisionCount(points, otherObstacles);
    const endpointInterior = routeInteriorCollisionCount(points, endpointObstacles);
    const labelPoint = routeLabelPoint(points);
    const labelCollisions = obstacles.filter((box) => pointInsideBox(labelPoint, box, 18)).length;
    return collisions * 120000
      + endpointInterior * 200000
      + labelCollisions * 45000
      + routeDomainEscapePenalty(points, relationship)
      + routeExitPenalty(points, relationship)
      + routeSelfCrossPenalty(points)
      + routeLength(points)
      + routeBendCount(points) * 520
      + points.length * 80;
  }

  function forceOrthogonalCorridor(points, relationship = null, fromSide = 'right', toSide = 'left') {
    if (!Array.isArray(points) || points.length !== 2) return points;
    const [from, to] = points;
    if (from.x === to.x || from.y === to.y) return points;
    const span = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    // Short gap between facing stubs: a single elbow is enough.
    if (span < 96) {
      const verticalFirst = Math.abs(to.y - from.y) >= Math.abs(to.x - from.x);
      return normalizeRoutePoints(
        verticalFirst
          ? [from, { x: from.x, y: to.y }, to]
          : [from, { x: to.x, y: from.y }, to]
      );
    }
    // Long diagonal: never invent a through-box elbow — use exterior lanes.
    if (relationship) {
      return ensureRouteClearsEndpointHulls(points, relationship, fromSide, toSide);
    }
    const pad = 48;
    const left = Math.min(from.x, to.x) - pad;
    const right = Math.max(from.x, to.x) + pad;
    const candidates = [
      normalizeRoutePoints([from, { x: right, y: from.y }, { x: right, y: to.y }, to]),
      normalizeRoutePoints([from, { x: left, y: from.y }, { x: left, y: to.y }, to])
    ];
    return candidates.sort((a, b) => routeLength(a) - routeLength(b))[0];
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

  function unionObstacleBounds(obstacles) {
    if (!obstacles?.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    obstacles.forEach((box) => {
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * When two cards sit close side-by-side, stubs must meet in the mid-gutter —
   * never overshoot into the neighbor hull (Project→Task golden failure).
   */
  function clampStubsForTightGutter(from, to, fromSide, toSide, fromBox, toBox, spacing) {
    let fromStub = pointOffsetBySide(from, fromSide, spacing);
    let toStub = pointOffsetBySide(to, toSide, spacing);
    if (!fromBox || !toBox) return { fromStub, toStub };

    const fromRight = fromBox.x + fromBox.width;
    const toRight = toBox.x + toBox.width;
    const fromBottom = fromBox.y + fromBox.height;
    const toBottom = toBox.y + toBox.height;
    // Only collapse stubs into a shared mid lane when the facing gap is actually
    // tight (Project↔Task). Wide cross-domain gaps (Task→User) must NOT snap to
    // midX — that painted floating vertical gutters between Users↔Tasks and
    // drove horizontals through peer cards.
    const maxTightGap = Math.max(48, spacing * 2 + 12);

    if (fromSide === 'right' && toSide === 'left' && fromRight <= toBox.x + 1) {
      const gap = toBox.x - fromRight;
      if (gap <= maxTightGap) {
        const midX = (fromRight + toBox.x) / 2;
        fromStub = { x: midX, y: from.y };
        toStub = { x: midX, y: to.y };
      }
    } else if (fromSide === 'left' && toSide === 'right' && toRight <= fromBox.x + 1) {
      const gap = fromBox.x - toRight;
      if (gap <= maxTightGap) {
        const midX = (toRight + fromBox.x) / 2;
        fromStub = { x: midX, y: from.y };
        toStub = { x: midX, y: to.y };
      }
    } else if (fromSide === 'bottom' && toSide === 'top' && fromBottom <= toBox.y + 1) {
      const gap = toBox.y - fromBottom;
      if (gap <= maxTightGap) {
        const midY = (fromBottom + toBox.y) / 2;
        fromStub = { x: from.x, y: midY };
        toStub = { x: to.x, y: midY };
      }
    } else if (fromSide === 'top' && toSide === 'bottom' && toBottom <= fromBox.y + 1) {
      const gap = fromBox.y - toBottom;
      if (gap <= maxTightGap) {
        const midY = (toBottom + fromBox.y) / 2;
        fromStub = { x: from.x, y: midY };
        toStub = { x: to.x, y: midY };
      }
    }
    return { fromStub, toStub };
  }

  /**
   * Hard-constraint orthogonal corridor between stubs. Local to the endpoint
   * pair — never ring around the world-union of every entity (that produced
   * floating vertical gutters between Users↔Tasks).
   */
  function routeClearOrthogonalPath(
    fromStub,
    toStub,
    obstacles,
    {
      ordinal = 0,
      laneGap = 18,
      fromBox = null,
      toBox = null,
      fromSide = 'right',
      toSide = 'left'
    } = {}
  ) {
    const stagger = ordinal * laneGap;

    const pickClear = (rawCandidates) => {
      const clear = rawCandidates
        .map(normalizeRoutePoints)
        .filter((points) => points.length >= 2 && routeCollisionCount(points, obstacles) === 0);
      if (!clear.length) return null;
      clear.sort((leftRoute, rightRoute) => (
        routeLength(leftRoute) - routeLength(rightRoute)
        + routeBendCount(leftRoute) * 48
        - routeBendCount(rightRoute) * 48
      ));
      return clear[0];
    };

    // Already co-axial (tight-gutter clamp): pure stub corridor.
    if (Math.abs(fromStub.x - toStub.x) <= 1.5) {
      return normalizeRoutePoints([fromStub, toStub]);
    }
    if (Math.abs(fromStub.y - toStub.y) <= 1.5) {
      return normalizeRoutePoints([fromStub, toStub]);
    }

    const midX = Math.round((fromStub.x + toStub.x) / 2 + stagger);
    const midY = Math.round((fromStub.y + toStub.y) / 2 + stagger);
    const spanX = Math.abs(toStub.x - fromStub.x);

    // Local ring around ONLY the two endpoint boxes (not world union).
    const local = (fromBox && toBox)
      ? {
        x: Math.min(fromBox.x, toBox.x),
        y: Math.min(fromBox.y, toBox.y),
        width: Math.max(fromBox.x + fromBox.width, toBox.x + toBox.width)
          - Math.min(fromBox.x, toBox.x),
        height: Math.max(fromBox.y + fromBox.height, toBox.y + toBox.height)
          - Math.min(fromBox.y, toBox.y)
      }
      : {
        x: Math.min(fromStub.x, toStub.x) - 36,
        y: Math.min(fromStub.y, toStub.y) - 36,
        width: Math.abs(toStub.x - fromStub.x) + 72,
        height: Math.abs(toStub.y - fromStub.y) + 72
      };

    // Cross-domain / long spans: prefer SHORT clear orth paths. Never share one
    // exterior side-lane for every edge (that bundled parallel verticals +
    // stacked labels on a top ring). Climb at each stub's own X with spaced
    // highway Y so labels sit on separate horizontals.
    const crossDomain = Boolean(
      fromBox?.entityId
      && toBox?.entityId
      && entityDomainId(fromBox.entityId)
      && entityDomainId(toBox.entityId)
      && entityDomainId(fromBox.entityId) !== entityDomainId(toBox.entityId)
    );
    if (crossDomain || spanX > 140) {
      // No shared midX lane — that recreates the Users↔Tasks gutter corridor.
      const shortClear = pickClear([
        [fromStub, { x: toStub.x, y: fromStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: toStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: midY }, { x: toStub.x, y: midY }, toStub]
      ]);
      if (shortClear) return shortClear;

      const preferBottom = fromSide === 'bottom' || toSide === 'bottom';
      const laneSpread = 28;
      const basePad = 44;
      const highwayY = preferBottom
        ? Math.round(local.y + local.height + basePad + Math.abs(ordinal) * laneSpread)
        : Math.round(Math.min(local.y, fromStub.y, toStub.y) - basePad - Math.abs(ordinal) * laneSpread);
      // Per-stub climb — verticals stay short and at different X (no shared side lane).
      return normalizeRoutePoints([
        fromStub,
        { x: fromStub.x, y: highwayY },
        { x: toStub.x, y: highwayY },
        toStub
      ]);
    }

    const nearCandidates = [
      [fromStub, { x: midX, y: fromStub.y }, { x: midX, y: toStub.y }, toStub],
      [fromStub, { x: fromStub.x, y: midY }, { x: toStub.x, y: midY }, toStub],
      [fromStub, { x: toStub.x, y: fromStub.y }, toStub],
      [fromStub, { x: fromStub.x, y: toStub.y }, toStub]
    ];
    const near = pickClear(nearCandidates);
    if (near) return near;

    // Prefer the exterior side implied by anchors (stacked both-right → right gutter).
    const preferRight = fromSide === 'right' || toSide === 'right';
    const preferLeft = fromSide === 'left' || toSide === 'left';
    const preferTop = fromSide === 'top' || toSide === 'top';
    const preferBottom = fromSide === 'bottom' || toSide === 'bottom';

    for (let expand = 0; expand <= 6; expand += 1) {
      const pad = 28 + Math.abs(stagger) + expand * 22;
      const left = Math.round(local.x - pad);
      const right = Math.round(local.x + local.width + pad);
      const top = Math.round(local.y - pad);
      const bottom = Math.round(local.y + local.height + pad);
      const preferred = [];
      if (preferRight) {
        preferred.push([fromStub, { x: right, y: fromStub.y }, { x: right, y: toStub.y }, toStub]);
      }
      if (preferLeft) {
        preferred.push([fromStub, { x: left, y: fromStub.y }, { x: left, y: toStub.y }, toStub]);
      }
      if (preferTop) {
        preferred.push([fromStub, { x: fromStub.x, y: top }, { x: toStub.x, y: top }, toStub]);
      }
      if (preferBottom) {
        preferred.push([fromStub, { x: fromStub.x, y: bottom }, { x: toStub.x, y: bottom }, toStub]);
      }
      const ring = pickClear([
        ...preferred,
        [fromStub, { x: fromStub.x, y: top }, { x: toStub.x, y: top }, toStub],
        [fromStub, { x: fromStub.x, y: bottom }, { x: toStub.x, y: bottom }, toStub],
        [fromStub, { x: left, y: fromStub.y }, { x: left, y: toStub.y }, toStub],
        [fromStub, { x: right, y: fromStub.y }, { x: right, y: toStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: top }, { x: right, y: top }, { x: right, y: toStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: top }, { x: left, y: top }, { x: left, y: toStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: bottom }, { x: right, y: bottom }, { x: right, y: toStub.y }, toStub],
        [fromStub, { x: fromStub.x, y: bottom }, { x: left, y: bottom }, { x: left, y: toStub.y }, toStub]
      ]);
      if (ring) return ring;
    }

    // Fail-closed: short elbow above the local pair (still reconnects via from/to).
    const escapeY = Math.round(local.y - 64 - Math.abs(stagger));
    return normalizeRoutePoints([
      fromStub,
      { x: fromStub.x, y: escapeY },
      { x: toStub.x, y: escapeY },
      toStub
    ]);
  }

  function routeFullyClear(points, peerObstacles, endpointBoxes) {
    if (routeCollisionCount(points, peerObstacles) !== 0) return false;
    if (routeInteriorCollisionCount(points, endpointBoxes) !== 0) return false;
    // A stub entry/exit must be short. Long first/last segments that traverse an
    // endpoint hull (Email→User crossing through User to the far side) are hits.
    if (points.length >= 2 && endpointBoxes?.length) {
      const first = points[0];
      const second = points[1];
      const last = points[points.length - 1];
      const beforeLast = points[points.length - 2];
      const firstLen = Math.abs(second.x - first.x) + Math.abs(second.y - first.y);
      const lastLen = Math.abs(last.x - beforeLast.x) + Math.abs(last.y - beforeLast.y);
      if (
        firstLen > 40
        && endpointBoxes.some((box) => segmentIntersectsBox(first, second, box))
      ) {
        return false;
      }
      if (
        lastLen > 40
        && endpointBoxes.some((box) => segmentIntersectsBox(beforeLast, last, box))
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * After reconnecting card anchors, long horizontals can still clip peer cards
   * (Task→User through Project) or cross an endpoint hull to reach the wrong
   * side (Comment→User through User). Fail-closed: keep anchor sides and climb
   * to a clear top/bottom/side lane around the local pair.
   */
  function repairRoutePeerClips(
    points,
    obstacles,
    fromBox,
    toBox,
    ordinal = 0,
    fromSide = 'right',
    toSide = 'left'
  ) {
    if (!Array.isArray(points) || points.length < 2) return points;
    const endpointBoxes = [fromBox, toBox].filter(Boolean);
    // Fatter peer pads so grazes through Project/Organization still count.
    const fatPeers = allEntityBounds(
      new Set(endpointBoxes.map((box) => box.entityId).filter(Boolean)),
      14
    );
    const peers = fatPeers.length ? fatPeers : obstacles;
    if (routeFullyClear(points, peers, endpointBoxes)) return points;
    const start = points[0];
    const end = points[points.length - 1];
    const fromExit = pointOffsetBySide(start, fromSide, 28);
    const toEnter = pointOffsetBySide(end, toSide, 28);
    const local = (fromBox && toBox)
      ? {
        x: Math.min(fromBox.x, toBox.x),
        y: Math.min(fromBox.y, toBox.y),
        width: Math.max(fromBox.x + fromBox.width, toBox.x + toBox.width)
          - Math.min(fromBox.x, toBox.x),
        height: Math.max(fromBox.y + fromBox.height, toBox.y + toBox.height)
          - Math.min(fromBox.y, toBox.y)
      }
      : null;
    if (!local) return points;
    const stagger = Math.abs(ordinal) * 14;
    const candidates = [];
    for (let expand = 0; expand <= 8; expand += 1) {
      const pad = 36 + stagger + expand * 24;
      const top = Math.round(local.y - pad);
      const bottom = Math.round(local.y + local.height + pad);
      const left = Math.round(local.x - pad);
      const right = Math.round(local.x + local.width + pad);
      // Always leave via fromSide and enter via toSide — never cross an endpoint.
      candidates.push(
        normalizeRoutePoints([
          start, fromExit,
          { x: fromExit.x, y: top },
          { x: toEnter.x, y: top },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: fromExit.x, y: bottom },
          { x: toEnter.x, y: bottom },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: right, y: fromExit.y },
          { x: right, y: top },
          { x: toEnter.x, y: top },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: left, y: fromExit.y },
          { x: left, y: top },
          { x: toEnter.x, y: top },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: right, y: fromExit.y },
          { x: right, y: bottom },
          { x: toEnter.x, y: bottom },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: left, y: fromExit.y },
          { x: left, y: bottom },
          { x: toEnter.x, y: bottom },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: right, y: fromExit.y },
          { x: right, y: toEnter.y },
          toEnter, end
        ]),
        normalizeRoutePoints([
          start, fromExit,
          { x: left, y: fromExit.y },
          { x: left, y: toEnter.y },
          toEnter, end
        ])
      );
    }
    const clear = candidates.filter((route) => routeFullyClear(route, peers, endpointBoxes));
    if (!clear.length) return points;
    clear.sort((leftRoute, rightRoute) => (
      routeLength(leftRoute) - routeLength(rightRoute)
      + routeBendCount(leftRoute) * 40
      - routeBendCount(rightRoute) * 40
    ));
    return clear[0];
  }

  function edgeRoutePoints(relationship, from, to, controlX, controlY, explicit, obstacles = null) {
    const spacing = 24;
    const fromSide = relationship.fromAnchorSide || 'right';
    const toSide = relationship.toAnchorSide || 'left';
    const fromBox = entityBoundById(relationship.fromEntityId);
    const toBox = entityBoundById(relationship.toEntityId);
    const routeObstacles = obstacles || routeObstaclesFor(relationship);
    const ordinal = relationshipRouteOrdinal(relationship);
    const crossDomain = Boolean(
      fromBox?.entityId
      && toBox?.entityId
      && entityDomainId(fromBox.entityId)
      && entityDomainId(toBox.entityId)
      && entityDomainId(fromBox.entityId) !== entityDomainId(toBox.entityId)
    );

    // Cross-domain: climb at each endpoint's OWN anchor X (never a shared midX /
    // side-lane, and never a facing-side X that tunnels through sibling cards —
    // Comment→User left-exit used to climb through Task). Short top/bottom
    // highways ranked per domain-pair so labels sit on separate horizontals
    // just above the strip (no shared ring, no lift-120 exile).
    if (crossDomain && !explicit && fromBox && toBox && from && to) {
      const endpoints = [fromBox, toBox];
      const fatPeers = allEntityBounds(
        new Set([fromBox.entityId, toBox.entityId].filter(Boolean)),
        12
      );
      const corridorLeft = Math.min(from.x, to.x);
      const corridorRight = Math.max(from.x, to.x);
      const stripPeers = fatPeers.filter((box) => (
        box.x < corridorRight && (box.x + box.width) > corridorLeft
      ));
      const clearanceBoxes = stripPeers.length ? stripPeers : fatPeers;
      // Include endpoint domain tops/bottoms so highways clear soft-domain borders
      // instead of skimming the glowing hull edge.
      const fromFound = findEntity(state.domains, relationship.fromEntityId);
      const toFound = findEntity(state.domains, relationship.toEntityId);
      const fromDomainBox = fromFound ? domainBox(fromFound.domain) : null;
      const toDomainBox = toFound ? domainBox(toFound.domain) : null;
      const domainTop = Math.min(
        fromFound?.domain?.y ?? Infinity,
        toFound?.domain?.y ?? Infinity
      );
      const domainBottom = Math.max(
        fromFound && fromDomainBox ? fromFound.domain.y + fromDomainBox.height : -Infinity,
        toFound && toDomainBox ? toFound.domain.y + toDomainBox.height : -Infinity
      );
      const stripTop = clearanceBoxes.length
        ? Math.min(...clearanceBoxes.map((box) => box.y), fromBox.y, toBox.y, domainTop)
        : Math.min(fromBox.y, toBox.y, domainTop);
      const stripBottom = clearanceBoxes.length
        ? Math.max(
          ...clearanceBoxes.map((box) => box.y + box.height),
          fromBox.y + fromBox.height,
          toBox.y + toBox.height,
          domainBottom
        )
        : Math.max(fromBox.y + fromBox.height, toBox.y + toBox.height, domainBottom);
      const laneSpread = 36;
      const rank = crossDomainRouteRank(relationship);
      // Alternate top/bottom by rank so three Users↔Tasks links do not pile on one
      // ring; within each side, rank/2 keeps label AABBs from stacking.
      const useBottom = rank % 2 === 1;
      const sideRank = Math.floor(rank / 2);
      const rankLift = sideRank * laneSpread;
      // Exit via card top/bottom first so the vertical stays in this card's column.
      const atTopHighway = (highwayY) => normalizeRoutePoints([
        from,
        { x: from.x, y: Math.min(from.y, fromBox.y) - 16 },
        { x: from.x, y: highwayY },
        { x: to.x, y: highwayY },
        { x: to.x, y: Math.min(to.y, toBox.y) - 16 },
        to
      ]);
      const atBottomHighway = (highwayY) => normalizeRoutePoints([
        from,
        { x: from.x, y: Math.max(from.y, fromBox.y + fromBox.height) + 16 },
        { x: from.x, y: highwayY },
        { x: to.x, y: highwayY },
        { x: to.x, y: Math.max(to.y, toBox.y + toBox.height) + 16 },
        to
      ]);
      const preferred = useBottom ? atBottomHighway : atTopHighway;
      const other = useBottom ? atTopHighway : atBottomHighway;
      const preferredYs = [28, 44, 60, 78, 96].map((pad) => (
        useBottom
          ? Math.round(stripBottom + pad + rankLift)
          : Math.round(stripTop - pad - rankLift)
      ));
      const otherYs = [16, 28, 44, 60, 76].map((pad) => (
        useBottom
          ? Math.round(stripTop - pad - rankLift)
          : Math.round(stripBottom + pad + rankLift)
      ));
      const pickShortestClear = (builder, ys) => {
        const clear = ys
          .map((highwayY) => builder(highwayY))
          .filter((path) => routeFullyClear(path, fatPeers, endpoints));
        if (!clear.length) return null;
        clear.sort((left, right) => routeLength(left) - routeLength(right));
        return clear[0];
      };
      const preferredPath = pickShortestClear(preferred, preferredYs);
      if (preferredPath) return preferredPath;
      const otherPath = pickShortestClear(other, otherYs);
      if (otherPath) return otherPath;
      // Fail closed on the preferred side at own X — still rank-spaced, never midX.
      return preferred(preferredYs[1] || preferredYs[0]);
    }

    const clamped = clampStubsForTightGutter(from, to, fromSide, toSide, fromBox, toBox, spacing);
    const fromStub = clamped.fromStub;
    const toStub = clamped.toStub;
    if (explicit) {
      // Explicit bend still must touch both card anchors — never stub-only.
      const explicitPath = normalizeRoutePoints([from, fromStub, { x: controlX, y: controlY }, toStub, to]);
      return repairRoutePeerClips(
        explicitPath, routeObstacles, fromBox, toBox, ordinal, fromSide, toSide
      );
    }
    const corridor = routeClearOrthogonalPath(fromStub, toStub, routeObstacles, {
      ordinal,
      laneGap: 16,
      fromBox,
      toBox,
      fromSide,
      toSide
    });
    // ROOT FIX: reconnect corridor to card anchors. Stub→stub alone painted the
    // floating vertical gutters (midX clamp / exterior lanes) that never touched cards.
    const connected = normalizeRoutePoints([from, ...corridor, to]);
    return repairRoutePeerClips(
      connected, routeObstacles, fromBox, toBox, ordinal, fromSide, toSide
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
    // Prefer the longest horizontal segment so cross-domain labels sit on the
    // highway mid, not piled on a shared vertical corner.
    let best = null;
    let bestLen = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const horizontal = Math.abs(previous.y - point.y) <= 1.5;
      if (!horizontal) continue;
      const length = Math.abs(point.x - previous.x);
      if (length > bestLen) {
        bestLen = length;
        best = {
          x: (previous.x + point.x) / 2,
          y: previous.y
        };
      }
    }
    if (best && bestLen >= 48) return best;

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
    const spread = ordinal * 14;
    const labelPoint = routeLabelPoint(points);
    // Keep the full label AABB (middle-anchored ~96×16) off every entity card.
    // Tight Project↔Task gutters cannot hold the text — lift into clear sky above.
    const blockers = allEntityBounds(new Set(), 2);
    const halfW = 52;
    const halfH = 9;
    const clearAt = (dx, dy) => {
      const samples = [
        { x: labelPoint.x + dx, y: labelPoint.y + dy },
        { x: labelPoint.x + dx - halfW, y: labelPoint.y + dy },
        { x: labelPoint.x + dx + halfW, y: labelPoint.y + dy },
        { x: labelPoint.x + dx - halfW, y: labelPoint.y + dy - halfH },
        { x: labelPoint.x + dx + halfW, y: labelPoint.y + dy - halfH },
        { x: labelPoint.x + dx - halfW, y: labelPoint.y + dy + halfH },
        { x: labelPoint.x + dx + halfW, y: labelPoint.y + dy + halfH }
      ];
      return !samples.some((probe) => blockers.some((box) => pointInsideBox(probe, box, 1)));
    };

    const fromBox = blockers.find((box) => box.entityId === relationship.fromEntityId);
    const toBox = blockers.find((box) => box.entityId === relationship.toEntityId);
    if (fromBox && toBox) {
      const left = fromBox.x + fromBox.width <= toBox.x ? fromBox : toBox;
      const right = left === fromBox ? toBox : fromBox;
      const hasSideGutter = left.x + left.width < right.x - 4;
      const gutterX = hasSideGutter
        ? (left.x + left.width + right.x) / 2
        : (fromBox.x + fromBox.width / 2 + toBox.x + toBox.width / 2) / 2;
      // Prefer sky above both cards — only place works when gutter < label width.
      const skyY = Math.min(fromBox.y, toBox.y) - 12 - Math.abs(spread);
      const skyDx = gutterX - labelPoint.x;
      for (const lift of [0, 10, 20, 32, 48]) {
        const dy = skyY - lift - labelPoint.y;
        if (clearAt(skyDx, dy)) return { x: skyDx, y: dy };
        if (clearAt(0, dy)) return { x: 0, y: dy };
      }
      if (hasSideGutter) {
        const dx = gutterX - labelPoint.x;
        for (const dy of [-28 + spread, -40, -12, 16, 28]) {
          if (clearAt(dx, dy)) return { x: dx, y: dy };
        }
      }
      const top = fromBox.y + fromBox.height <= toBox.y ? fromBox : toBox;
      const bottom = top === fromBox ? toBox : fromBox;
      if (top.y + top.height < bottom.y - 6) {
        const gutterY = (top.y + top.height + bottom.y) / 2;
        const dy = gutterY - labelPoint.y;
        for (const dx of [0, 18 + spread, -(18 + spread), 36, -36]) {
          if (clearAt(dx, dy)) return { x: dx, y: dy };
        }
      }
    }

    const vertical = Math.abs(segment.from.x - segment.to.x) <= 1.5;
    const candidates = [];
    for (const mag of [24, 36, 48, 64, 80, 104, 128]) {
      candidates.push(
        { x: 0, y: -mag + spread },
        { x: mag + Math.abs(spread), y: vertical ? -12 : -14 },
        { x: -(mag + Math.abs(spread)), y: vertical ? -12 : -14 },
        { x: mag, y: -mag },
        { x: -mag, y: -mag }
      );
    }
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      if (clearAt(candidates[attempt].x, candidates[attempt].y)) {
        return candidates[attempt];
      }
    }
    return { x: 0, y: Math.min(fromBox?.y ?? labelPoint.y, toBox?.y ?? labelPoint.y) - 18 - labelPoint.y };
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
    const bounds = selectionFocusBounds();
    if (!bounds || !dom.canvas) return;
    // Keep current zoom; only re-center (search / soft navigate).
    const zoom = clampZoom(state.view.zoom || 1);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    dom.canvas.scrollTo({
      left: Math.max(0, centerX * zoom + CANVAS_ORIGIN_X * zoom - dom.canvas.clientWidth / 2),
      top: Math.max(0, centerY * zoom + CANVAS_ORIGIN_Y * zoom - dom.canvas.clientHeight / 2),
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
   * Visual entity-side anchor via DOM rects — required when soft domains CSS-scale
   * so model-space anchors do not float outside the painted card.
   */
  function domEntityAnchorPoint(entityId, side) {
    if (!side) return null;
    const entityEl = [...dom.canvasInner.querySelectorAll('.entity[data-entity-id]')]
      .find((candidate) => candidate.dataset.entityId === entityId);
    if (!entityEl) return null;
    const zoom = clampZoom(state.view.zoom || 1);
    const canvasRect = dom.canvasInner.getBoundingClientRect();
    const entityRect = entityEl.getBoundingClientRect();
    const midX = entityRect.left + entityRect.width / 2;
    const midY = entityRect.top + entityRect.height / 2;
    let screenX = midX;
    let screenY = midY;
    if (side === 'left') screenX = entityRect.left;
    else if (side === 'right') screenX = entityRect.right;
    else if (side === 'top') screenY = entityRect.top;
    else if (side === 'bottom') screenY = entityRect.bottom;
    return {
      x: (screenX - canvasRect.left) / zoom - CANVAS_ORIGIN_X,
      y: (screenY - canvasRect.top) / zoom - CANVAS_ORIGIN_Y
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
    if (side) {
      return domEntityAnchorPoint(entityId, side) || entityAnchorOnCanvas(entityId, side);
    }
    return entityCenterOnCanvas(entityId);
  }

  function facingAnchorSide(current, other) {
    if (!current || !other) return 'right';
    const dx = other.x - current.x;
    const dy = other.y - current.y;
    // Prefer left/right for field-row anchors unless clearly stacked.
    if (Math.abs(dx) >= Math.abs(dy) * 0.55) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'bottom' : 'top';
  }

  function relationshipSide(entityId, otherEntityId, fallbackSide) {
    if (fallbackSide) return fallbackSide;
    return facingAnchorSide(
      entityCenterOnCanvas(entityId),
      entityCenterOnCanvas(otherEntityId)
    );
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
    // Field rows only expose left/right anchors; when stacked, still pick the
    // facing horizontal side so the corridor runs in the exterior gutter.
    let side;
    if (fieldName && current && other) {
      const dx = other.x - current.x;
      const dy = other.y - current.y;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        // Stacked: both ends use the same exterior side (right gutter by default).
        side = dx >= 0 ? 'right' : 'left';
        if (Math.abs(dx) < 40) side = 'right';
      } else {
        side = dx >= 0 ? 'right' : 'left';
      }
    } else {
      side = relationshipSide(
        entityId,
        otherEntityId,
        end === 'from' ? relationship.fromAnchorSide : relationship.toAnchorSide
      );
    }
    // Top/bottom field anchors fall back to entity side midpoints.
    const pointSide = (side === 'top' || side === 'bottom') && fieldName ? side : side;
    const point = (side === 'top' || side === 'bottom')
      ? edgeEndpoint(entityId, side, null)
      : edgeEndpoint(entityId, pointSide, fieldName);
    return {
      entityId,
      side,
      fieldName: (side === 'top' || side === 'bottom') ? null : fieldName,
      point
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

  /**
   * Pull first/last vertices off the entity hull so the painted stroke and hit
   * path sit in the corridor between boxes — not under/over the boxes.
   */
  function edgeClearedRoutePoints(routePoints, fromEndpoint, toEndpoint, distance = 20) {
    if (!Array.isArray(routePoints) || routePoints.length < 2) return routePoints || [];
    const points = routePoints.map((point) => ({ ...point }));
    const fromSide = fromEndpoint?.side || 'right';
    const toSide = toEndpoint?.side || 'left';
    points[0] = pointOutsideEndpoint(
      routePoints[0],
      fromSide,
      routePoints[1] || routePoints[routePoints.length - 1],
      distance
    );
    points[points.length - 1] = pointOutsideEndpoint(
      routePoints[routePoints.length - 1],
      toSide,
      routePoints[routePoints.length - 2] || routePoints[0],
      distance
    );
    return points;
  }

  function edgeHitRoutePoints(routePoints, fromEndpoint, toEndpoint) {
    return edgeClearedRoutePoints(routePoints, fromEndpoint, toEndpoint, 16);
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

  /**
   * True when an entity's domain is a collapsed chip (or focus outsider) so
   * field-level anchors would collapse into a vertical gutter corridor.
   */
  function entityAnchorUnavailable(entityId) {
    const found = findEntity(state.domains, entityId);
    if (!found) return true;
    if (isDomainCollapsed(found.domain)) return true;
    if (!isFocusStage()) return false;
    const scenario = focusScenarioFor();
    if (scenario.keepDomains && !scenario.keepDomains.has(found.domain.id)) return true;
    if (scenario.keepEntities && !scenario.keepEntities.has(entityId)) return true;
    return false;
  }

  function renderEdges() {
    dom.edges.innerHTML = '';
    // Keep the SVG above domain/entity boxes for hit-testing in corridors.
    if (dom.edges.parentElement === dom.canvasInner) {
      dom.canvasInner.appendChild(dom.edges);
    }
    const edgeScenario = focusScenarioFor();
    state.relationships.forEach((relationship) => {
      // Never paint field-level edges into collapsed/outsider chips — that is
      // exactly the Users↔Tasks floating vertical gutter the live 7.34 shot shows.
      if (
        entityAnchorUnavailable(relationship.fromEntityId)
        || entityAnchorUnavailable(relationship.toEntityId)
      ) {
        return;
      }
      // Background siblings stay mounted, but only keepEdges stay lit — do not
      // paint every incident edge just because the endpoint card is on stage.
      if (
        edgeScenario.keepEdges
        && !edgeScenario.keepEdges.has(relationship.id)
      ) {
        return;
      }
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
      const routePoints = edgeRoutePoints(
        routedRelationship,
        from,
        to,
        controlX,
        controlY,
        control.explicit,
        routeObstaclesFor(routedRelationship)
      );
      // Prefer orthogonal corridors (clear stubs); rounded only as cosmetic joins.
      const edgePathD = state.view.edgeStyle === 'curved' && !control.explicit && routePoints.length > 2
        ? roundedRoutePathD(routePoints)
        : routePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      const routeLabel = routeLabelPoint(routePoints);
      const labelX = routeLabel.x;
      const labelY = routeLabel.y;
      const labelOffsetX = Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0;
      const labelOffsetY = Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'edge-line');
      path.setAttribute('d', edgePathD);
      path.dataset.relationshipId = relationship.id;
      path.dataset.edgeFrom = relationship.fromEntityId;
      path.dataset.edgeTo = relationship.toEntityId;
      dom.edges.appendChild(path);

      const hitPathD = routePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('class', 'edge-hit');
      hit.setAttribute('d', hitPathD);
      hit.dataset.relationshipId = relationship.id;
      hit.dataset.edgeFrom = relationship.fromEntityId;
      hit.dataset.edgeTo = relationship.toEntityId;
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute(
        'aria-label',
        `Relationship ${relationship.name || relationship.id}: ${relationship.fromCardinality}:${relationship.toCardinality}`
      );
      hit.addEventListener('pointerenter', () => setEdgeHover(relationship.id));
      hit.addEventListener('pointerleave', () => setEdgeHover(null));
      hit.addEventListener('focus', () => setEdgeHover(relationship.id));
      hit.addEventListener('blur', () => setEdgeHover(null));
      hit.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedRelationship(relationship.id);
      });
      hit.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        setSelectedRelationship(relationship.id);
      });
      hit.addEventListener('contextmenu', (event) => {
        setSelectedRelationship(relationship.id);
        openElementMenu(
          event,
          relationship.name || 'Relationship',
          relationshipMenuItems(relationship)
        );
      });
      dom.edges.appendChild(hit);

      if (!state.view.largeCanvasMode) {
        const sourceCardinality = cardinalityLabelPoint(routePoints[0], routePoints[routePoints.length - 1]);
        const targetCardinality = cardinalityLabelPoint(
          routePoints[routePoints.length - 1],
          routePoints[0]
        );
        const fromLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fromLabel.setAttribute('class', 'edge-label');
        fromLabel.setAttribute('x', String(sourceCardinality.x));
        fromLabel.setAttribute('y', String(sourceCardinality.y));
        fromLabel.dataset.relationshipId = relationship.id;
        fromLabel.dataset.edgeFrom = relationship.fromEntityId;
        fromLabel.dataset.edgeTo = relationship.toEntityId;
        fromLabel.textContent = relationship.fromCardinality;
        dom.edges.appendChild(fromLabel);

        const toLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        toLabel.setAttribute('class', 'edge-label');
        toLabel.setAttribute('x', String(targetCardinality.x));
        toLabel.setAttribute('y', String(targetCardinality.y));
        toLabel.dataset.relationshipId = relationship.id;
        toLabel.dataset.edgeFrom = relationship.fromEntityId;
        toLabel.dataset.edgeTo = relationship.toEntityId;
        toLabel.textContent = relationship.toCardinality;
        dom.edges.appendChild(toLabel);

        const autoLabelOffset = routeLabelOffset(routedRelationship, routePoints);
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('class', 'edge-label edge-name-label');
        nameLabel.setAttribute('x', String(labelX + autoLabelOffset.x + labelOffsetX));
        nameLabel.setAttribute('y', String(labelY + autoLabelOffset.y + labelOffsetY));
        nameLabel.dataset.relationshipId = relationship.id;
        nameLabel.dataset.edgeFrom = relationship.fromEntityId;
        nameLabel.dataset.edgeTo = relationship.toEntityId;
        const fullLabel = relationshipFieldLabel(relationship, fromEndpoint, toEndpoint);
        nameLabel.textContent = compactRelationshipFieldLabel(relationship, fromEndpoint, toEndpoint);
        nameLabel.dataset.fullLabel = fullLabel;
        nameLabel.setAttribute('tabindex', '0');
        nameLabel.setAttribute('role', 'button');
        nameLabel.setAttribute('aria-label', `Select and move label for ${fullLabel || relationship.name || 'relationship'}`);
        nameLabel.addEventListener('pointerenter', () => setEdgeHover(relationship.id));
        nameLabel.addEventListener('pointerleave', () => setEdgeHover(null));
        nameLabel.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedRelationship(relationship.id);
        });
        attachDrag(nameLabel, (dx, dy) => {
          relationship.labelOffsetX = (Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0) + dx;
          relationship.labelOffsetY = (Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0) + dy;
          renderEdges();
        }, {
          onStart: () => {
            closeSidebarForCanvasWork();
            setSelectedRelationship(relationship.id, { remountCanvas: false });
          },
          onEnd: (_event, moved) => {
            if (!moved) return;
            saveState();
            render();
          }
        });
        dom.edges.appendChild(nameLabel);
      }

      if (state.selectedRelationshipId === relationship.id) {
        const routeStart = routePoints[0];
        const routeEnd = routePoints[routePoints.length - 1];
        const routeMid = routeLabelPoint(routePoints);
        [
          {
            end: 'from',
            point: from,
            handlePoint: routeStart,
            fixedPoint: to,
            label: 'source'
          },
          {
            end: 'to',
            point: to,
            handlePoint: routeEnd,
            fixedPoint: from,
            label: 'target'
          }
        ].forEach((endpoint) => {
          const endHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          endHandle.setAttribute('class', `edge-end-handle edge-end-handle-${endpoint.end}`);
          endHandle.setAttribute('cx', String(endpoint.handlePoint.x));
          endHandle.setAttribute('cy', String(endpoint.handlePoint.y));
          endHandle.setAttribute('r', '3.5');
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
        bendHandle.setAttribute('cx', String(control.explicit ? controlX : routeMid.x));
        bendHandle.setAttribute('cy', String(control.explicit ? controlY : routeMid.y));
        bendHandle.setAttribute('r', '3.75');
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
    syncEdgeChrome(focusScenarioFor());
  }

  /**
   * Relationships in the current nav scope: selected entity's links, else
   * domain of the selected relationship/domain, else the full model list.
   */
  function relationshipsInNavScope() {
    const all = Array.isArray(state.relationships) ? state.relationships : [];
    if (state.selectedEntityId) {
      return all.filter((rel) => (
        rel.fromEntityId === state.selectedEntityId
        || rel.toEntityId === state.selectedEntityId
      ));
    }
    let domainId = state.selectedDomainId || null;
    if (!domainId && state.selectedRelationshipId) {
      const current = all.find((rel) => rel.id === state.selectedRelationshipId);
      if (current) {
        domainId = findEntity(state.domains, current.fromEntityId)?.domain?.id
          || findEntity(state.domains, current.toEntityId)?.domain?.id
          || null;
      }
    }
    if (domainId) {
      const entityIds = new Set(
        (state.domains.find((domain) => domain.id === domainId)?.entities || [])
          .map((entity) => entity.id)
      );
      return all.filter((rel) => entityIds.has(rel.fromEntityId) || entityIds.has(rel.toEntityId));
    }
    return all;
  }

  function cycleSelectedRelationship(delta = 1) {
    const scope = relationshipsInNavScope();
    if (!scope.length) return null;
    const currentId = state.selectedRelationshipId;
    let index = scope.findIndex((rel) => rel.id === currentId);
    if (index < 0) {
      index = delta >= 0 ? -1 : 0;
    }
    const next = scope[(index + delta + scope.length) % scope.length];
    if (!next) return null;
    setSelectedRelationship(next.id);
    return next.id;
  }

  function renderMiniMap() {
    if (!dom.miniMap) return;
    dom.miniMap.innerHTML = '';
    const canvasWidth = dom.canvasInner.offsetWidth || VIRTUAL_CANVAS_WIDTH;
    const canvasHeight = dom.canvasInner.offsetHeight || VIRTUAL_CANVAS_HEIGHT;
    const mapWidth = dom.miniMap.clientWidth || 180;
    const mapHeight = dom.miniMap.clientHeight || 130;
    const scale = Math.min(mapWidth / canvasWidth, mapHeight / canvasHeight);
    const stageFocus = isFocusStage();
    const activeDomainId = activeSelectionDomainId();
    const scenario = focusScenarioFor();
    state.domains.forEach((domain) => {
      const box = document.createElement('div');
      box.className = 'mini-map-domain';
      box.dataset.domainId = domain.id;
      box.style.left = `${modelToCanvasX(domain.x) * scale}px`;
      box.style.top = `${modelToCanvasY(domain.y) * scale}px`;
      const domainSize = domainBox(domain);
      box.style.width = `${Math.max(4, domainSize.width * scale)}px`;
      box.style.height = `${Math.max(4, domainSize.height * scale)}px`;
      box.style.borderColor = domain.color || '#64748b';
      const keepDomain = !scenario.keepDomains || scenario.keepDomains.has(domain.id);
      if (domain.id === activeDomainId) box.classList.add('active');
      else if (stageFocus && keepDomain) box.classList.add('is-soft');
      else if (stageFocus) box.classList.add('is-quiet');
      box.title = stageFocus && domain.id !== activeDomainId
        ? `Go to ${domain.name}`
        : domain.name;
      box.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedDomain(domain.id);
      });
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
   * Canvas-level event wiring: background click reverses to overview (all
   * domains), ctrl/cmd-wheel zooms, middle-button/space pans, and window-level
   * pointer tracking drives the anchor-drag preview. The keyboard map stays in
   * `script.js` because it reaches far beyond the canvas (undo/redo, pick mode,
   * deletion, Escape hierarchy).
   */
  function wireCanvasEvents() {
    let suppressBackgroundClick = false;
    let panMoved = false;

    function isCanvasBackground(target) {
      return target === dom.canvas
        || target === dom.canvasInner
        || target === dom.edges;
    }

    dom.canvas.addEventListener('click', (event) => {
      if (!isCanvasBackground(event.target)) return;
      if (suppressBackgroundClick) {
        suppressBackgroundClick = false;
        return;
      }
      // Reverse nav: empty canvas = parent of every domain → show all domains.
      setSelectedDomain(null);
    });

    dom.canvas.addEventListener('contextmenu', (event) => {
      const onBackground = isCanvasBackground(event.target);
      if (!onBackground) return;
      openElementMenu(event, 'Canvas', canvasMenuItems(event));
    });

    dom.canvas.addEventListener('wheel', (event) => {
      // Wheel / trackpad / ctrl-pinch (macOS) all zoom the diagram. Shift+wheel
      // still scrolls for large-model pan. Capture + preventDefault so Brave /
      // Chrome page-zoom does not steal the gesture.
      if (event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
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
      const onBackground = isCanvasBackground(event.target);
      const primaryDragOnBackground = event.button === 0 && onBackground;
      panMoved = false;
      if (primaryDragOnBackground && event.shiftKey) {
        closeSidebarForCanvasWork();
        event.preventDefault();
        beginMarquee(event);
        return;
      }
      if (event.button !== 1 && !interaction.spacePressed && !primaryDragOnBackground) return;
      cancelUserZoom({ commit: true });
      cancelCameraFlight();
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
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panMoved = true;
      dom.canvas.scrollLeft = interaction.scrollStartLeft - dx;
      dom.canvas.scrollTop = interaction.scrollStartTop - dy;
    });

    const stopPan = () => {
      if (interaction.panning && panMoved) suppressBackgroundClick = true;
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
    focusSelectionOnCanvas,
    showOverview,
    scrollSelectionIntoView,
    syncSelectionClasses,
    relationshipsInNavScope,
    cycleSelectedRelationship,
    renderNotes,
    clearAlignmentGuides,
    renderView,
    zoomBy,
    zoomAtPointer,
    setZoom,
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
