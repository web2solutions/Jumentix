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
  normalizeField
} from '@jumentix/designer-core/state/designerState.js';
import {
  applyAutoLayout,
  minimumDomainSize,
  buildEdgePathD,
  buildPreviewEdgePathD,
  alignmentGuidesFor,
  clampEntityPosition,
  computeFitView,
  entitiesInMarquee,
  entityFieldAnchorPoint,
  facingSide,
  isDomainCollapsed,
  domainBox,
  entityAnchorPoint,
  entityCenterPoint,
  fieldLabel,
  findEntity,
  resizeDomainBox,
  relationshipControlPoint,
  snapCoordinate
} from '@jumentix/designer-core/model/modelQueries.js';

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
export function createCanvas({ dom, state, interaction, actions, contextMenu }) {
  const {
    withPersist,
    render,
    saveState,
    setSelectedDomain,
    setSelectedEntity,
    handleEntityRelationshipPick,
    addRelationshipFromAnchor,
    addEntity,
    deleteEntity,
    deleteDomain,
    deleteRelationship,
    confirmAction
  } = actions;
  let edgeRenderFrame = 0;
  let miniMapRenderFrame = 0;
  let pendingAlignmentGuides = null;

  function nextAnimationFrame(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16);
  }

  function scheduleEdgesRender(guides = null) {
    pendingAlignmentGuides = guides;
    if (edgeRenderFrame) return;
    edgeRenderFrame = nextAnimationFrame(() => {
      edgeRenderFrame = 0;
      renderEdges();
      if (pendingAlignmentGuides?.length) {
        renderAlignmentGuides(pendingAlignmentGuides);
      }
      pendingAlignmentGuides = null;
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

  function attachDrag(el, onMove, options = {}) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let started = false;

    el.addEventListener('pointerdown', (event) => {
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      started = false;
      el.setPointerCapture(pointerId);
    });

    el.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const zoom = state.view.zoom || 1;
      const dx = (event.clientX - startX) / zoom;
      const dy = (event.clientY - startY) / zoom;
      startX = event.clientX;
      startY = event.clientY;
      if (dx !== 0 || dy !== 0) moved = true;
      if (moved && !started && typeof options.onStart === 'function') {
        started = true;
        options.onStart(event);
      }
      onMove(dx, dy);
    });

    const end = (event) => {
      if (pointerId !== event.pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      pointerId = null;
      if (typeof options.onEnd === 'function') options.onEnd(event, moved);
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function renderDomains() {
    dom.canvasInner.querySelectorAll('.domain').forEach((node) => node.remove());

    state.domains.forEach((domain) => {
      const domainEl = document.createElement('section');
      domainEl.className = `domain${state.selectedDomainId === domain.id ? ' selected' : ''}`;
      const box = domainBox(domain);
      domainEl.style.left = `${domain.x}px`;
      domainEl.style.top = `${domain.y}px`;
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
      headerEl.innerHTML = `<div class="domain-title">${domain.name}</div><div class="entity-count">${domain.entities.length} entities</div>`;
      domainEl.appendChild(headerEl);

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

      attachDrag(headerEl, (dx, dy) => {
        domain.x = Math.max(0, snapCoordinate(state.view.snapToGrid, domain.x + dx));
        domain.y = Math.max(0, snapCoordinate(state.view.snapToGrid, domain.y + dy));
        domainEl.style.left = `${domain.x}px`;
        domainEl.style.top = `${domain.y}px`;
        scheduleEdgesRender();
        scheduleMiniMapRender();
      }, {
        onStart: () => withPersist(() => {}),
        onEnd: (_event, moved) => {
          if (!moved) return;
          saveState();
          render();
        }
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
        const entityEl = document.createElement('article');
        const inMultiSelection = Array.isArray(state.selectedEntityIds)
          && state.selectedEntityIds.includes(entity.id);
        const selectedClass = (state.selectedEntityId === entity.id || inMultiSelection)
          ? ' selected'
          : '';
        entityEl.className = `entity${selectedClass}`;
        entityEl.style.left = `${entity.x}px`;
        entityEl.style.top = `${entity.y}px`;
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
        const entityNameEl = document.createElement('input');
        entityNameEl.className = 'entity-name-input';
        entityNameEl.value = entity.name;
        entityNameEl.setAttribute('aria-label', `Name of entity "${entity.name}"`);
        entityNameEl.addEventListener('click', (event) => event.stopPropagation());
        entityNameEl.addEventListener('pointerdown', (event) => event.stopPropagation());
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
        attachDrag(entityHeader, (dx, dy) => {
          moveEntityInsideDomain(entity, entityEl, dx, dy);
        }, {
          onStart: () => withPersist(() => {}),
          onEnd: (_event, moved) => {
            clearAlignmentGuides();
            if (!moved) return;
            saveState();
            render();
          }
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
            li.className = 'entity-field-row';
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
            typeEl.addEventListener('change', () => {
              withPersist(() => {
                field.type = typeEl.value;
                render();
              });
            });
            li.appendChild(typeEl);

            [
              { key: 'required', label: 'REQ', title: 'required' },
              { key: 'unique', label: 'UQ', title: 'unique' }
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

            li.dataset.fieldIndex = String(fieldIndex);
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
              event.stopPropagation();
              withPersist(() => {
                entity.fields.push(normalizeField(
                  { name: `field_${entity.fields.length + 1}`, type: 'string' },
                  entity.fields.length
                ));
                render();
              });
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
    attachDrag(resizeHandle, (dx, dy) => {
      const current = domainBox(domain);
      const resized = resizeDomainBox(
        domain,
        snapCoordinate(state.view.snapToGrid, current.width + dx),
        snapCoordinate(state.view.snapToGrid, current.height + dy)
      );
      domain.width = resized.width;
      domain.height = resized.height;
      domainEl.style.width = `${resized.width}px`;
      domainEl.style.height = `${resized.height}px`;
      scheduleEdgesRender();
      scheduleMiniMapRender();
    }, {
      onStart: () => withPersist(() => {}),
      onEnd: (_event, moved) => {
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

  function moveEntityInsideDomain(entity, entityEl, dx, dy) {
    // JUM-729 follow-up: the limits come from the domain's own box, so an entity can
    // use the room a resize just added.
    const owner = state.domains.find(
      (candidate) => candidate.entities.some((member) => member.id === entity.id)
    );
    const clamped = clampEntityPosition(
      owner,
      snapCoordinate(state.view.snapToGrid, entity.x + dx),
      snapCoordinate(state.view.snapToGrid, entity.y + dy)
    );
    // JUM-729 follow-up: grid snapping keeps positions tidy without making anything
    // line up — two entities can both sit on the grid four pixels apart,
    // which is exactly the misalignment a reader notices. This pulls the
    // dragged entity onto a sibling's edge or centre when it comes close,
    // and draws what it snapped to.
    const aligned = alignmentGuidesFor(owner, entity, clamped.x, clamped.y, {
      compactEntities: state.view.compactEntities,
      largeCanvasMode: state.view.largeCanvasMode
    });
    entity.x = aligned.x;
    entity.y = aligned.y;
    entityEl.style.left = `${entity.x}px`;
    entityEl.style.top = `${entity.y}px`;
    scheduleEdgesRender(aligned.guides);
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
        line.setAttribute('y2', '2200');
      } else {
        line.setAttribute('x1', '0');
        line.setAttribute('x2', '3200');
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
      noteEl.style.left = `${note.x}px`;
      noteEl.style.top = `${note.y}px`;
      noteEl.style.background = note.color;

      const grip = document.createElement('div');
      grip.className = 'canvas-note-grip';
      grip.title = 'Drag to move this note';
      attachDrag(grip, (dx, dy) => {
        note.x = Math.max(0, snapCoordinate(state.view.snapToGrid, note.x + dx));
        note.y = Math.max(0, snapCoordinate(state.view.snapToGrid, note.y + dy));
        noteEl.style.left = `${note.x}px`;
        noteEl.style.top = `${note.y}px`;
      }, {
        onStart: () => withPersist(() => {}),
        onEnd: (_event, moved) => {
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

  /** Drop a note at the centre of what is currently on screen. */
  function addNote() {
    withPersist(() => {
      const zoom = state.view.zoom || 1;
      const centre = {
        x: Math.round((dom.canvas.scrollLeft + dom.canvas.clientWidth / 2) / zoom),
        y: Math.round((dom.canvas.scrollTop + dom.canvas.clientHeight / 2) / zoom)
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
    return end === 'from'
      ? edgeEndpoint(
        relationship.fromEntityId, relationship.fromAnchorSide, relationship.fromField
      )
      : edgeEndpoint(relationship.toEntityId, relationship.toAnchorSide, relationship.toField);
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

  /**
   * The point an edge end attaches to: the named field's row when the link
   * declares one, the entity side otherwise (JUM-729 follow-up).
   */
  function edgeEndpoint(entityId, side, fieldName) {
    const found = findEntity(state.domains, entityId);
    if (!found) return null;
    if (fieldName) {
      const fieldPoint = entityFieldAnchorPoint(
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
    interaction.relationshipAnchorFromField = null;
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
    const pointer = pointerToCanvasPoint(event.clientX, event.clientY);
    renderAnchorPreviewEdge(fromPoint, pointer);
  }

  function renderEdges() {
    dom.edges.innerHTML = '';
    state.relationships.forEach((relationship) => {
      const useCenter = relationship.anchorBehavior === 'center';
      const from = useCenter
        ? entityCenterOnCanvas(relationship.fromEntityId)
        : edgeEndpoint(
          relationship.fromEntityId, relationship.fromAnchorSide, relationship.fromField
        );
      const to = useCenter
        ? entityCenterOnCanvas(relationship.toEntityId)
        : edgeEndpoint(relationship.toEntityId, relationship.toAnchorSide, relationship.toField);
      if (!from || !to) return;

      const control = relationshipControlPoint(relationship, from, to);
      const controlX = control.x;
      const controlY = control.y;
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
        nameLabel.setAttribute('class', 'edge-label edge-name-label');
        nameLabel.setAttribute('x', String(labelX + 6 + labelOffsetX));
        nameLabel.setAttribute('y', String(labelY - 6 + labelOffsetY));
        nameLabel.textContent = relationship.name || '';
        nameLabel.setAttribute('tabindex', '0');
        nameLabel.setAttribute('role', 'button');
        nameLabel.setAttribute('aria-label', `Move label for ${relationship.name || 'relationship'}`);
        attachDrag(nameLabel, (dx, dy) => {
          relationship.labelOffsetX = (Number.isFinite(relationship.labelOffsetX) ? relationship.labelOffsetX : 0) + dx;
          relationship.labelOffsetY = (Number.isFinite(relationship.labelOffsetY) ? relationship.labelOffsetY : 0) + dy;
          renderEdges();
        }, {
          onStart: () => withPersist(() => {}),
          onEnd: (_event, moved) => {
            if (!moved) return;
            saveState();
            render();
          }
        });
        dom.edges.appendChild(nameLabel);
      }

      if (state.selectedRelationshipId === relationship.id) {
        const bendHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bendHandle.setAttribute('class', `edge-bend-handle${control.explicit ? ' explicit' : ''}`);
        bendHandle.setAttribute('cx', String(controlX));
        bendHandle.setAttribute('cy', String(controlY));
        bendHandle.setAttribute('r', '7');
        bendHandle.setAttribute('tabindex', '0');
        bendHandle.setAttribute('role', 'slider');
        bendHandle.setAttribute('aria-label', `Move route handle for ${relationship.name || 'relationship'}`);
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
          onStart: () => withPersist(() => {}),
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
    const scale = 0.055;
    state.domains.forEach((domain) => {
      const box = document.createElement('div');
      box.className = 'mini-map-domain';
      box.style.left = `${domain.x * scale}px`;
      box.style.top = `${domain.y * scale}px`;
      const domainSize = domainBox(domain);
      box.style.width = `${domainSize.width * scale}px`;
      box.style.height = `${domainSize.height * scale}px`;
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
      // JUM-729 follow-up: the wheel zooms on its own. It used to demand ctrl/cmd, which
      // is the browser's page-zoom gesture, not a canvas one — the plain wheel
      // scrolled the canvas and the diagram never changed size. Shift+wheel
      // still scrolls, for anyone who wants to pan a large model.
      if (event.shiftKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.1 : 0.1;
      zoomBy(direction);
    }, { passive: false });

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
        event.preventDefault();
        beginMarquee(event);
        return;
      }
      if (event.button !== 1 && !interaction.spacePressed && !primaryDragOnBackground) return;
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
