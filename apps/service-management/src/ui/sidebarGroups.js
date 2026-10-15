/**
 * sidebarGroups — Domain Designer right rail.
 *
 * Nature keys (exclusive horizontal tabs):
 *   model    — Structure: Domain ⊃ Entity ⊃ Field browse + edit
 *   history  — Temporal: undo/redo
 *   validate — Assure: model checks + nested Diff
 *   export   — Emit: artifacts + block-critical policy
 *   import   — Ingest: load sources + nested Reset/legend
 *
 * Tab contract:
 * - Exactly one pane is active at a time.
 * - Tab click switches; re-click on active keeps it open.
 * - revealGroupFor switches to the target pane.
 * - Entity create tools gate on selectedDomainId (hierarchy).
 * - Legacy keys (entities/diff/quality/share/…) map on hydrate.
 * - `import` is canonical (no longer folded into export).
 */

export const GROUP_KEYS = [
  'model',
  'history',
  'validate',
  'export',
  'import'
];

export const GROUP_TITLES = {
  model: 'Model',
  history: 'History',
  validate: 'Validate',
  export: 'Export',
  import: 'Import'
};

export const GROUP_HIERARCHY = {
  model: { band: 'structure', depth: 0, parent: null },
  history: { band: 'temporal', depth: 0, parent: null },
  validate: { band: 'assure', depth: 0, parent: null },
  export: { band: 'emit', depth: 0, parent: null },
  import: { band: 'ingest', depth: 0, parent: null }
};

export const BAND_LABELS = {
  structure: 'Structure',
  temporal: 'History',
  assure: 'Assure',
  emit: 'Export',
  ingest: 'Import'
};

export const LEGACY_GROUP_MAP = {
  quality: 'validate',
  share: 'export',
  inspector: 'model',
  selection: 'model',
  entities: 'model',
  diff: 'validate',
  domains: 'model'
};

const DEFAULT_EXPANDED = Object.fromEntries(GROUP_KEYS.map((key) => [key, false]));

export function isExpandedFlag(value) {
  return value === true || value === 1 || value === 'true' || value === '1';
}

export function resolveGroupKey(value) {
  if (typeof value !== 'string' || !value) return null;
  const mapped = LEGACY_GROUP_MAP[value] || value;
  return GROUP_KEYS.includes(mapped) ? mapped : null;
}

/**
 * Fold legacy keys into a multi map (internal).
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<string, boolean>}
 */
function foldExpandedFlags(raw) {
  const next = { ...DEFAULT_EXPANDED };
  if (!raw || typeof raw !== 'object') return next;
  for (const key of GROUP_KEYS) {
    if (isExpandedFlag(raw[key])) next[key] = true;
  }
  if (isExpandedFlag(raw.quality) || isExpandedFlag(raw.diff)) next.validate = true;
  if (isExpandedFlag(raw.share)) next.export = true;
  if (isExpandedFlag(raw.import)) next.import = true;
  if (
    isExpandedFlag(raw.inspector)
    || isExpandedFlag(raw.selection)
    || isExpandedFlag(raw.entities)
    || isExpandedFlag(raw.domains)
  ) {
    next.model = true;
  }
  return next;
}

/**
 * Exclusive tab map — at most one cell true.
 * @param {Record<string, unknown> | null | undefined} raw
 * @param {string | null | undefined} preferred
 * @returns {Record<string, boolean>}
 */
export function normalizeExclusiveExpanded(raw, preferred) {
  const multi = foldExpandedFlags(raw);
  const preferredKey = resolveGroupKey(preferred);
  const openKeys = GROUP_KEYS.filter((key) => multi[key]);
  let active = null;
  if (preferredKey && openKeys.includes(preferredKey)) active = preferredKey;
  else if (openKeys.length) active = openKeys[0];
  return Object.fromEntries(GROUP_KEYS.map((key) => [key, key === active]));
}

/** @deprecated Alias — exclusive horizontal tabs. */
export function normalizeMultiExpanded(raw, preferred) {
  return normalizeExclusiveExpanded(raw, preferred);
}

/**
 * @param {Object} options
 * @param {Document} options.documentRef
 * @param {Object} options.state
 * @param {Function} options.saveState
 */
export function createSidebarGroups({ documentRef, state, saveState }) {
  const cells = Array.from(documentRef.querySelectorAll('.sidebar-accordion-cell[data-sidebar-group]'));
  const tabList = documentRef.getElementById('sidebar-panel-tabs');
  const tabs = tabList
    ? Array.from(tabList.querySelectorAll('[data-sidebar-tab]'))
    : Array.from(documentRef.querySelectorAll('[data-sidebar-tab]'));
  const drawer = documentRef.getElementById('designer-sidebar');
  const drawerToggle = documentRef.getElementById('toggle-sidebar-btn');
  const stack = documentRef.getElementById('sidebar-accordion-stack');

  let chosenOpen = null;
  let chosenExpanded = null;

  if (tabList) {
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'Domain Designer panels');
  }
  if (stack) {
    stack.setAttribute('role', 'presentation');
    stack.removeAttribute('aria-multiselectable');
  }

  function ensureView() {
    if (!state.view || typeof state.view !== 'object') state.view = {};
    return state.view;
  }

  function isOpen() {
    return chosenOpen === null ? Boolean(state?.view?.sidebarOpen) : chosenOpen;
  }

  function expandedMap() {
    if (chosenExpanded && typeof chosenExpanded === 'object') {
      return normalizeExclusiveExpanded(chosenExpanded, ensureView().sidebarGroup);
    }
    return normalizeExclusiveExpanded(state?.view?.sidebarExpanded, state?.view?.sidebarGroup);
  }

  function openKeyFrom(map) {
    return GROUP_KEYS.find((key) => map[key]) || null;
  }

  function openKeysFrom(map) {
    return GROUP_KEYS.filter((key) => map[key]);
  }

  function exclusiveMap(activeKey) {
    const resolved = resolveGroupKey(activeKey);
    return Object.fromEntries(GROUP_KEYS.map((key) => [key, key === resolved]));
  }

  function persistExpanded(next) {
    const exclusive = normalizeExclusiveExpanded(next, null);
    const active = openKeyFrom(exclusive);
    chosenExpanded = { ...exclusive };
    const view = ensureView();
    view.sidebarExpanded = { ...exclusive };
    view.sidebarGroup = active || resolveGroupKey(view.sidebarGroup) || 'model';
    return exclusive;
  }

  function hydrateFromState() {
    const view = ensureView();
    const preferred = resolveGroupKey(view.sidebarGroup);
    if (preferred) view.sidebarGroup = preferred;
    else if (view.sidebarGroup) view.sidebarGroup = 'model';

    const exclusive = normalizeExclusiveExpanded(view.sidebarExpanded, view.sidebarGroup);
    chosenExpanded = { ...exclusive };
    view.sidebarExpanded = { ...exclusive };
    const active = openKeyFrom(exclusive);
    if (active) view.sidebarGroup = active;
  }

  function releaseFocusFromCollapsed() {
    const active = documentRef.activeElement;
    if (!active || typeof active.closest !== 'function') return;
    if (drawer && !drawer.contains(active)) return;

    const hostCell = active.closest('.sidebar-accordion-cell');
    if (!hostCell) return;
    const hostKey = hostCell.dataset?.sidebarGroup;
    const expanded = expandedMap();
    if (hostKey && expanded[hostKey]) return;

    const openKey = openKeyFrom(expanded);
    const target =
      (openKey && documentRef.querySelector(`[data-sidebar-tab="${openKey}"]`))
      || drawerToggle;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      return;
    }
    if (typeof active.blur === 'function') active.blur();
  }

  function selectedDomain() {
    const id = state?.selection?.domainId || state?.selectedDomainId;
    if (!id || !Array.isArray(state?.domains)) return null;
    return state.domains.find((domain) => domain.id === id) || null;
  }

  function selectionPath() {
    if (state?.selection?.kind === 'note' || state?.selectedNoteId) {
      return { kind: 'note', label: 'Note' };
    }
    if (state?.selection?.kind === 'relationship' || state?.selectedRelationshipId) {
      return { kind: 'relationship', label: 'Relationship' };
    }
    const entityId = state?.selection?.entityId || state?.selectedEntityId;
    const fieldName = state?.selection?.kind === 'field'
      ? String(state.selection.fieldName || '').trim() || null
      : null;
    if (entityId && Array.isArray(state?.domains)) {
      for (const domain of state.domains) {
        const entity = (domain.entities || []).find((entry) => entry.id === entityId);
        if (entity) {
          if (fieldName) {
            return {
              kind: 'field',
              label: `Field · ${domain.name} → ${entity.name} → ${fieldName}`,
              domainName: domain.name,
              entityName: entity.name,
              fieldName
            };
          }
          return {
            kind: 'entity',
            label: `${domain.name} · ${entity.name}`,
            domainName: domain.name,
            entityName: entity.name
          };
        }
      }
      return { kind: 'entity', label: 'Entity' };
    }
    const domain = selectedDomain();
    if (domain) return { kind: 'domain', label: `Domain · ${domain.name}`, domainName: domain.name };
    return { kind: null, label: 'Nothing selected' };
  }

  function syncEntitiesWorkspaceGate() {
    const workspace = documentRef.getElementById('entities-workspace');
    const domain = selectedDomain();
    const ready = Boolean(domain);
    if (workspace) {
      workspace.dataset.gate = 'domain';
      workspace.dataset.gateReady = String(ready);
      workspace.classList.toggle('is-gate-blocked', !ready);
      workspace.setAttribute('aria-disabled', String(!ready));
      const gate = documentRef.getElementById('entities-workspace-gate');
      if (gate) gate.hidden = true;
    }
    // Structure create exclusivity — path none→Domain, domain→Entity, else none.
    // Full sync also runs from inspectors.updateShellChrome; keep hydrate consistent.
    const path = selectionPath();
    const kind = path.kind || null;
    const domainCreate = documentRef.getElementById('domain-create-toolbar');
    const entityCreate = documentRef.getElementById('entity-create-toolbar');
    const showDomainCreate = !kind;
    const showEntityCreate = kind === 'domain' && ready;
    const applyCreateVisibility = (el, show) => {
      if (!el) return;
      el.hidden = !show;
      el.classList.toggle('is-create-inactive', !show);
      el.setAttribute('aria-hidden', String(!show));
      el.style.display = show ? '' : 'none';
    };
    applyCreateVisibility(domainCreate, showDomainCreate);
    applyCreateVisibility(entityCreate, showEntityCreate);
    if (entityCreate) {
      entityCreate.dataset.gateReady = String(showEntityCreate);
      entityCreate.setAttribute('aria-disabled', String(!showEntityCreate));
      ['input', 'button', 'select'].forEach((tag) => {
        entityCreate.querySelectorAll(tag).forEach((control) => {
          control.disabled = !showEntityCreate;
        });
      });
    }
    const structureToolbar = documentRef.getElementById('structure-create-toolbar');
    if (structureToolbar) {
      const showStrip = showDomainCreate || showEntityCreate;
      applyCreateVisibility(structureToolbar, showStrip);
      structureToolbar.dataset.createScope = showEntityCreate ? 'entity' : showDomainCreate ? 'domain' : 'none';
    }
  }

  function syncHierarchyContext() {
    const domain = selectedDomain();
    const path = selectionPath();

    cells.forEach((cell) => {
      const key = cell.dataset.sidebarGroup;
      const meta = GROUP_HIERARCHY[key] || { band: '', depth: 0, parent: null };
      cell.dataset.hierarchyBand = meta.band || '';
      cell.dataset.hierarchyDepth = String(meta.depth || 0);
      cell.removeAttribute('data-hierarchy-parent');
      cell.dataset.hierarchyReady = 'true';
      cell.classList.remove('is-hierarchy-blocked');
    });

    tabs.forEach((tab) => {
      const key = tab.getAttribute?.('data-sidebar-tab') || tab.dataset?.sidebarTab;
      const meta = GROUP_HIERARCHY[key] || { band: '', depth: 0 };
      tab.setAttribute('aria-description', `${BAND_LABELS[meta.band] || 'Panel'}`);
    });

    const domainsContext = documentRef.getElementById('sidebar-group-model-context');
    if (domainsContext) {
      const count = Array.isArray(state?.domains) ? state.domains.length : 0;
      if (path.kind === 'entity' && path.domainName && path.entityName) {
        domainsContext.textContent = `${path.domainName} → ${path.entityName}`;
      } else if (domain) {
        domainsContext.textContent = domain.name;
      } else {
        domainsContext.textContent = String(count);
      }
      domainsContext.hidden = false;
    }

    const modelChromePath = documentRef.getElementById('model-scope-path');
    if (modelChromePath) {
      modelChromePath.textContent = path.label;
    }
    const canvasScopePath = documentRef.getElementById('canvas-scope-path');
    if (canvasScopePath) {
      canvasScopePath.textContent = path.label;
    }

    syncEntitiesWorkspaceGate();

    if (stack) {
      stack.dataset.activeDomain = domain?.id || '';
      stack.dataset.selectionKind = path.kind || 'none';
    }
  }

  function renderSidebarGroups() {
    const expanded = expandedMap();
    const openKeys = openKeysFrom(expanded);
    const activeKey = openKeys[0] || null;
    if (drawer) {
      drawer.classList.toggle('open', isOpen());
      drawer.classList.add('sidebar-accordion');
      drawer.classList.add('sidebar-panel-tabs-mode');
      drawer.setAttribute('aria-hidden', String(!isOpen()));
    }
    if (drawerToggle) {
      drawerToggle.setAttribute('aria-expanded', String(isOpen()));
      drawerToggle.title = isOpen() ? 'Hide panels (P)' : 'Show panels (P)';
    }
    if (stack) {
      stack.dataset.openGroup = activeKey || '';
      stack.dataset.openCount = String(openKeys.length);
    }
    if (tabList) {
      tabList.dataset.activeTab = activeKey || '';
    }

    tabs.forEach((tab) => {
      const key = tab.getAttribute?.('data-sidebar-tab') || tab.dataset?.sidebarTab;
      const isActive = Boolean(key && expanded[key]);
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('aria-expanded', String(isActive));
      tab.classList.toggle('active', isActive);
      tab.tabIndex = isActive || !activeKey ? 0 : -1;
      if (tab.getAttribute('role') !== 'tab') tab.setAttribute('role', 'tab');
    });

    cells.forEach((cell) => {
      const key = cell.dataset.sidebarGroup;
      const isExpanded = Boolean(expanded[key]);
      cell.dataset.accordionExpanded = String(isExpanded);
      cell.hidden = !isExpanded;
      cell.setAttribute('role', 'tabpanel');
      const body = cell.querySelector('.sidebar-accordion-body');
      if (body) {
        body.hidden = !isExpanded;
        body.setAttribute('aria-hidden', String(!isExpanded));
        if (!isExpanded) body.setAttribute('inert', '');
        else body.removeAttribute('inert');
      }
    });
    syncHierarchyContext();
    releaseFocusFromCollapsed();
  }

  function scrollCellIntoView(key) {
    const cell = documentRef.querySelector(`.sidebar-accordion-cell[data-sidebar-group="${key}"]`);
    if (!cell) return;
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => cb();
    frame(() => {
      if (typeof cell.scrollIntoView === 'function') {
        cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function scrollEntitiesWorkspace() {
    const workspace = documentRef.getElementById('entities-workspace');
    if (!workspace || typeof workspace.scrollIntoView !== 'function') return;
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => cb();
    frame(() => workspace.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  /**
   * @param {string} key
   * @param {boolean} open
   * @param {{ scroll?: boolean, persist?: boolean }} [options]
   */
  function setExpanded(key, open, { scroll = true, persist = true } = {}) {
    const resolved = resolveGroupKey(key);
    if (!resolved) return;

    let next;
    if (open) {
      next = exclusiveMap(resolved);
    } else {
      const current = expandedMap();
      if (!current[resolved]) {
        next = { ...current };
      } else {
        next = exclusiveMap('model');
      }
    }
    persistExpanded(next);
    renderSidebarGroups();
    if (persist) saveState();
    if (open && scroll && isOpen()) scrollCellIntoView(resolved);
  }

  function toggleExpanded(key) {
    const resolved = resolveGroupKey(key);
    if (!resolved) return;
    setExpanded(resolved, true);
  }

  function setActiveGroup(key) {
    setExpanded(key, true);
  }

  function getOpenKey() {
    return openKeyFrom(expandedMap());
  }

  function setDrawerOpen(open) {
    chosenOpen = Boolean(open);
    ensureView().sidebarOpen = Boolean(open);
    if (open && !openKeyFrom(expandedMap())) {
      persistExpanded(exclusiveMap('model'));
    }
    renderSidebarGroups();
    saveState();
  }

  function toggleDrawer() {
    setDrawerOpen(!isOpen());
  }

  /**
   * @param {string} panelId
   * @param {{ scroll?: boolean }} [options]
   */
  function revealGroupFor(panelId, { scroll = true } = {}) {
    const panel = documentRef.getElementById(panelId);
    let group = resolveGroupKey(
      panel?.dataset?.sidebarGroup
      || panel?.closest('[data-sidebar-group]')?.dataset?.sidebarGroup
    );
    if (
      panelId === 'entity-inspector-panel'
      || panelId === 'relationship-inspector-panel'
      || panelId === 'note-inspector-panel'
      || panelId === 'entities-workspace'
      || panelId === 'domain-inspector-panel'
    ) {
      group = 'model';
    }
    if (!group) return;

    chosenOpen = true;
    ensureView().sidebarOpen = true;
    setExpanded(group, true, { scroll: false, persist: true });

    const cell = documentRef.querySelector(`.sidebar-accordion-cell[data-sidebar-group="${group}"]`);
    if (!cell) return;
    cell.classList.remove('is-deferred');
    cell.hidden = false;
    if (panel) {
      panel.classList.remove('is-deferred');
      panel.hidden = false;
    }
    if (scroll && isOpen()) {
      if (
        panelId === 'entity-inspector-panel'
        || panelId === 'relationship-inspector-panel'
        || panelId === 'note-inspector-panel'
        || panelId === 'entities-workspace'
      ) {
        scrollEntitiesWorkspace();
      } else {
        scrollCellIntoView(group);
      }
    }
  }

  function focusTab(index) {
    const ordered = GROUP_KEYS
      .map((key) => documentRef.querySelector(`[data-sidebar-tab="${key}"]`))
      .filter(Boolean);
    if (!ordered.length) return;
    const next = ((index % ordered.length) + ordered.length) % ordered.length;
    ordered[next].focus();
  }

  tabs.forEach((tab) => {
    const key = tab.getAttribute?.('data-sidebar-tab') || tab.dataset?.sidebarTab;
    if (!tab || !key) return;

    tab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleExpanded(key);
    });

    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        toggleExpanded(key);
        return;
      }
      const index = GROUP_KEYS.indexOf(key);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusTab(index + 1);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusTab(index - 1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        focusTab(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        focusTab(GROUP_KEYS.length - 1);
      }
    });
  });

  if (drawerToggle) drawerToggle.addEventListener('click', toggleDrawer);

  const pickDomainCta = documentRef.getElementById('pick-domain-cta');
  if (pickDomainCta && pickDomainCta.dataset.sidebarWired !== 'true') {
    pickDomainCta.dataset.sidebarWired = 'true';
    pickDomainCta.addEventListener('click', () => {
      setActiveGroup('model');
      const list = documentRef.getElementById('domain-list');
      if (list && typeof list.focus === 'function') {
        try { list.focus({ preventScroll: true }); } catch { list.focus(); }
      }
    });
  }

  hydrateFromState();

  return {
    renderSidebarGroups,
    setActiveGroup,
    setExpanded,
    toggleExpanded,
    setDrawerOpen,
    toggleDrawer,
    isOpen,
    getOpenKey,
    revealGroupFor,
    hydrateFromState,
    syncHierarchyContext,
    selectionPath,
    expandedMap,
    openKeysFrom: () => openKeysFrom(expandedMap()),
    GROUP_KEYS,
    GROUP_TITLES,
    GROUP_HIERARCHY,
    BAND_LABELS
  };
}
