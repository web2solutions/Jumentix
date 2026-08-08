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

import { clampZoom } from '../state/designerState.js';
import {
  applyAutoLayout,
  buildEdgePathD,
  buildPreviewEdgePathD,
  computeFitView,
  entityAnchorPoint,
  entityCenterPoint,
  fieldLabel,
  findEntity,
  snapCoordinate
} from '../model/modelQueries.js';

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
export function createCanvas({ dom, state, interaction, actions }) {
  const {
    withPersist,
    render,
    saveState,
    setSelectedDomain,
    setSelectedEntity,
    handleEntityRelationshipPick,
    addRelationshipFromAnchor
  } = actions;

  function renderView() {
    const zoom = clampZoom(state.view.zoom || 1);
    state.view.zoom = zoom;
    if (typeof state.view.snapToGrid !== 'boolean') state.view.snapToGrid = true;
    if (!['curved', 'orthogonal'].includes(state.view.edgeStyle)) state.view.edgeStyle = 'curved';
    if (!['info', 'warn', 'error'].includes(state.view.modelCheckMinSeverity)) state.view.modelCheckMinSeverity = 'info';
    if (typeof state.view.exportBlockCritical !== 'boolean') state.view.exportBlockCritical = true;
    if (typeof state.view.largeCanvasMode !== 'boolean') state.view.largeCanvasMode = false;
    dom.canvasInner.style.transform = `scale(${zoom})`;
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
    saveState();
  }

  function zoomBy(delta) {
    setZoom((state.view.zoom || 1) + delta);
  }

  function fitView() {
    const { zoom, left, top } = computeFitView(state.domains, dom.canvas.clientWidth, dom.canvas.clientHeight);
    state.view.zoom = zoom;
    renderView();
    dom.canvas.scrollTo({ left, top, behavior: 'smooth' });
    saveState();
  }

  function resetView() {
    state.view.zoom = 1;
    renderView();
    dom.canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
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

  function attachDrag(el, onMove) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;

    el.addEventListener('pointerdown', (event) => {
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      el.setPointerCapture(pointerId);
    });

    el.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const zoom = state.view.zoom || 1;
      const dx = (event.clientX - startX) / zoom;
      const dy = (event.clientY - startY) / zoom;
      startX = event.clientX;
      startY = event.clientY;
      onMove(dx, dy);
    });

    const end = (event) => {
      if (pointerId !== event.pointerId) return;
      el.releasePointerCapture(pointerId);
      pointerId = null;
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function renderDomains() {
    dom.canvasInner.querySelectorAll('.domain').forEach((node) => node.remove());

    state.domains.forEach((domain) => {
      const domainEl = document.createElement('section');
      domainEl.className = `domain${state.selectedDomainId === domain.id ? ' selected' : ''}`;
      domainEl.style.left = `${domain.x}px`;
      domainEl.style.top = `${domain.y}px`;
      domainEl.style.setProperty('--domain-color', domain.color);
      domainEl.onmousedown = () => setSelectedDomain(domain.id);

      const headerEl = document.createElement('header');
      headerEl.className = 'domain-header';
      headerEl.innerHTML = `<div class="domain-title">${domain.name}</div><div class="entity-count">${domain.entities.length} entities</div>`;
      domainEl.appendChild(headerEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'domain-body';

      attachDrag(headerEl, (dx, dy) => {
        withPersist(() => {
          domain.x = Math.max(0, snapCoordinate(state.view.snapToGrid, domain.x + dx));
          domain.y = Math.max(0, snapCoordinate(state.view.snapToGrid, domain.y + dy));
          domainEl.style.left = `${domain.x}px`;
          domainEl.style.top = `${domain.y}px`;
          renderEdges();
        });
      });

      domain.entities.forEach((entity) => {
        const entityEl = document.createElement('article');
        const selectedClass = state.selectedEntityId === entity.id ? ' selected' : '';
        entityEl.className = `entity${selectedClass}`;
        entityEl.style.left = `${entity.x}px`;
        entityEl.style.top = `${entity.y}px`;
        entityEl.onclick = (event) => {
          event.stopPropagation();
          setSelectedEntity(entity.id);
          handleEntityRelationshipPick(entity.id);
        };

        const entityHeader = document.createElement('header');
        entityHeader.className = 'entity-header';
        entityHeader.textContent = entity.name;
        if (entity?.meta?.aggregateRoot) {
          const aggregateTag = document.createElement('span');
          aggregateTag.className = 'entity-aggregate-tag';
          aggregateTag.textContent = 'AR';
          entityHeader.appendChild(aggregateTag);
        }
        attachDrag(entityHeader, (dx, dy) => {
          moveEntityInsideDomain(entity, entityEl, dx, dy);
        });

        const fieldsEl = document.createElement('ul');
        fieldsEl.className = 'entity-fields';
        if (!state.view.compactEntities) {
          entity.fields.forEach((field) => {
            const li = document.createElement('li');
            li.textContent = fieldLabel(field);
            fieldsEl.appendChild(li);
          });
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
            addRelationshipFromAnchor(fromEntityId, entity.id, side);
            stopAnchorDrag();
          });
          entityEl.appendChild(anchorBtn);
        });

        entityEl.appendChild(entityHeader);
        entityEl.appendChild(fieldsEl);
        bodyEl.appendChild(entityEl);
      });

      domainEl.appendChild(bodyEl);
      dom.canvasInner.appendChild(domainEl);
    });
  }

  function moveEntityInsideDomain(entity, entityEl, dx, dy) {
    withPersist(() => {
      const maxX = 520 - 200;
      const maxY = 180;
      entity.x = Math.min(maxX, Math.max(8, snapCoordinate(state.view.snapToGrid, entity.x + dx)));
      entity.y = Math.min(maxY, Math.max(8, snapCoordinate(state.view.snapToGrid, entity.y + dy)));
      entityEl.style.left = `${entity.x}px`;
      entityEl.style.top = `${entity.y}px`;
      renderEdges();
    });
  }

  function entityCenterOnCanvas(entityId) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    return entityCenterPoint(found.domain, found.entity);
  }

  function entityAnchorOnCanvas(entityId, side) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    return entityAnchorPoint(found.domain, found.entity, side, state.view.compactEntities);
  }

  function pointerToCanvasPoint(clientX, clientY) {
    const zoom = state.view.zoom || 1;
    const rect = dom.canvas.getBoundingClientRect();
    return {
      x: (dom.canvas.scrollLeft + clientX - rect.left) / zoom,
      y: (dom.canvas.scrollTop + clientY - rect.top) / zoom
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

  function stopAnchorDrag() {
    interaction.relationshipAnchorDragActive = false;
    interaction.relationshipAnchorFromEntityId = null;
    interaction.relationshipAnchorFromSide = null;
    clearAnchorPreviewEdge();
  }

  function startAnchorDrag(entityId, side, event) {
    const fromPoint = entityAnchorOnCanvas(entityId, side);
    if (!fromPoint) return;
    interaction.relationshipAnchorDragActive = true;
    interaction.relationshipAnchorFromEntityId = entityId;
    interaction.relationshipAnchorFromSide = side;
    const pointer = pointerToCanvasPoint(event.clientX, event.clientY);
    renderAnchorPreviewEdge(fromPoint, pointer);
  }

  function renderEdges() {
    dom.edges.innerHTML = '';
    state.relationships.forEach((relationship) => {
      const useCenter = relationship.anchorBehavior === 'center';
      const from = (!useCenter && relationship.fromAnchorSide)
        ? entityAnchorOnCanvas(relationship.fromEntityId, relationship.fromAnchorSide)
        : entityCenterOnCanvas(relationship.fromEntityId);
      const to = (!useCenter && relationship.toAnchorSide)
        ? entityAnchorOnCanvas(relationship.toEntityId, relationship.toAnchorSide)
        : entityCenterOnCanvas(relationship.toEntityId);
      if (!from || !to) return;

      const controlX = Number.isFinite(relationship.bendX) ? relationship.bendX : (from.x + to.x) / 2;
      const controlY = Number.isFinite(relationship.bendY) ? relationship.bendY : (from.y + to.y) / 2;
      const isOrthogonal = state.view.edgeStyle === 'orthogonal';
      const edgePathD = buildEdgePathD(from, to, controlX, controlY, isOrthogonal);
      const labelX = isOrthogonal ? controlX : controlX;
      const labelY = isOrthogonal ? controlY : ((from.y + to.y) / 2);
      const labelOffsetX = Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0;
      const labelOffsetY = Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const activeClass = state.selectedRelationshipId === relationship.id ? ' active' : '';
      path.setAttribute('class', `edge-line${activeClass}`);
      path.setAttribute('d', edgePathD);
      dom.edges.appendChild(path);

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('class', 'edge-hit');
      hit.setAttribute('d', edgePathD);
      hit.addEventListener('click', (event) => {
        event.stopPropagation();
        state.selectedRelationshipId = relationship.id;
        render();
      });
      dom.edges.appendChild(hit);

      if (!state.view.largeCanvasMode) {
        const fromLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fromLabel.setAttribute('class', 'edge-label');
        fromLabel.setAttribute('x', String(from.x + 6));
        fromLabel.setAttribute('y', String(from.y - 6));
        fromLabel.textContent = relationship.fromCardinality;
        dom.edges.appendChild(fromLabel);

        const toLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        toLabel.setAttribute('class', 'edge-label');
        toLabel.setAttribute('x', String(to.x + 6));
        toLabel.setAttribute('y', String(to.y - 6));
        toLabel.textContent = relationship.toCardinality;
        dom.edges.appendChild(toLabel);

        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('class', 'edge-label');
        nameLabel.setAttribute('x', String(labelX + 6 + labelOffsetX));
        nameLabel.setAttribute('y', String(labelY - 6 + labelOffsetY));
        nameLabel.textContent = relationship.name || '';
        dom.edges.appendChild(nameLabel);
      }
    });
  }

  function renderMiniMap() {
    if (!dom.miniMap) return;
    dom.miniMap.innerHTML = '';
    const scale = 0.055;
    state.domains.forEach((domain) => {
      const box = document.createElement('div');
      box.className = 'mini-map-domain';
      box.style.left = `${domain.x * scale}px`;
      box.style.top = `${domain.y * scale}px`;
      box.style.width = `${520 * scale}px`;
      box.style.height = `${280 * scale}px`;
      box.style.borderColor = domain.color || '#64748b';
      if (state.selectedDomainId === domain.id) box.classList.add('active');
      box.title = domain.name;
      box.onclick = () => setSelectedDomain(domain.id);
      dom.miniMap.appendChild(box);
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

    dom.canvas.addEventListener('wheel', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.1 : 0.1;
      zoomBy(direction);
    }, { passive: false });

    dom.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 1 && !interaction.spacePressed) return;
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
      const fromPoint = entityAnchorOnCanvas(
        interaction.relationshipAnchorFromEntityId,
        interaction.relationshipAnchorFromSide
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
  }

  return {
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
