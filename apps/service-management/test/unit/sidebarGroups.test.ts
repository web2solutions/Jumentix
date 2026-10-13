/* eslint-disable @typescript-eslint/no-explicit-any, no-param-reassign, object-curly-newline */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/* eslint-disable jest/no-conditional-in-test, max-len */
/**
 * Exclusive horizontal tab bar + Domain⊃Entity gate contracts for the Domain Designer rail.
 * Hand-rolled fake DOM — same convention as controlHelp.dom.test.ts (no jsdom).
 */
import {
  createSidebarGroups,
  normalizeMultiExpanded,
  normalizeExclusiveExpanded,
  resolveGroupKey,
  isExpandedFlag,
  GROUP_KEYS,
  GROUP_HIERARCHY,
  GROUP_TITLES,
  LEGACY_GROUP_MAP
} from '../../src/ui/sidebarGroups.js';

// GROUP_TITLES used in resolve assertions below.

function matchesSimpleSelector(el: any, selector: string): boolean {
  let rest = selector.trim();
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
  if (tag) {
    if (el.tagName !== tag[0].toUpperCase()) return false;
    rest = rest.slice(tag[0].length);
  }
  while (rest.length > 0) {
    if (rest.startsWith('.')) {
      const token = /^\.[\w-]+/.exec(rest);
      if (!token || !el.classList.contains(token[0].slice(1))) return false;
      rest = rest.slice(token[0].length);
    } else if (rest.startsWith('[')) {
      const token = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest);
      if (!token) return false;
      const value = el.getAttribute(token[1]);
      if (value === null || value === undefined) return false;
      if (token[2] !== undefined && value !== token[2]) return false;
      rest = rest.slice(token[0].length);
    } else {
      return false;
    }
  }
  return true;
}

function descendantsOf(el: any, out: any[] = []): any[] {
  (el.children || []).forEach((child: any) => {
    out.push(child);
    descendantsOf(child, out);
  });
  return out;
}

function createFakeElement(doc: any, tagName: string, props: Record<string, any> = {}): any {
  const classNames = new Set<string>();
  const el: any = {
    ownerDocument: doc,
    tagName: tagName.toUpperCase(),
    id: '',
    type: '',
    hidden: false,
    tabIndex: 0,
    textContent: '',
    offsetTop: 0,
    scrollTop: 0,
    dataset: {} as Record<string, string>,
    style: {},
    attributes: new Map<string, string>(),
    children: [] as any[],
    parentNode: null as any,
    listeners: new Map<string, Array<(event: any) => void>>(),
    get classList() {
      return {
        contains: (name: string) => classNames.has(name),
        add: (name: string) => { classNames.add(name); },
        remove: (name: string) => { classNames.delete(name); },
        toggle: (name: string, force?: boolean) => {
          const should = force === undefined ? !classNames.has(name) : Boolean(force);
          if (should) classNames.add(name);
          else classNames.delete(name);
          return should;
        }
      };
    },
    setAttribute(name: string, value: string) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name: string) {
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
        if (this.dataset[key] !== undefined) return this.dataset[key];
      }
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    },
    removeAttribute(name: string) {
      this.attributes.delete(name);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
        delete this.dataset[key];
      }
    },
    appendChild(child: any) {
      Object.assign(child, { parentNode: this });
      this.children.push(child);
      return child;
    },
    querySelector(selector: string) {
      return descendantsOf(this).find((node) => matchesSimpleSelector(node, selector)) || null;
    },
    querySelectorAll(selector: string) {
      return descendantsOf(this).filter((node) => matchesSimpleSelector(node, selector));
    },
    closest(selector: string) {
      if (matchesSimpleSelector(this, selector)) return this;
      if (!this.parentNode) return null;
      return this.parentNode.closest(selector);
    },
    contains(node: any) {
      if (!node) return false;
      if (node === this) return true;
      let current = node;
      while (current) {
        if (current === this) return true;
        current = current.parentNode;
      }
      return false;
    },
    addEventListener(type: string, handler: (event: any) => void) {
      const list = this.listeners.get(type) || [];
      list.push(handler);
      this.listeners.set(type, list);
    },
    dispatch(type: string, event: any = {}) {
      const payload = {
        preventDefault() {}, stopPropagation() {}, ...event, type, target: this, currentTarget: this
      };
      (this.listeners.get(type) || []).forEach((handler: any) => handler(payload));
    },
    focus(options?: { preventScroll?: boolean }) {
      if (this._focusThrowsPreventScroll && options?.preventScroll) {
        throw new Error('preventScroll unsupported');
      }
      doc.activeElement = this;
    },
    blur() {
      if (doc.activeElement === this) doc.activeElement = doc.body;
    },
    scrollIntoView() {
      this._scrolled = true;
    },
    _focusThrowsPreventScroll: false,
    _scrolled: false
  };
  Object.assign(el, props);
  if (props.className) {
    String(props.className).split(/\s+/).filter(Boolean).forEach((name) => classNames.add(name));
  }
  if (props.id) el.id = props.id;
  if (props['data-sidebar-group']) el.setAttribute('data-sidebar-group', props['data-sidebar-group']);
  if (props['data-sidebar-tab']) el.setAttribute('data-sidebar-tab', props['data-sidebar-tab']);
  return el;
}

function buildDocument() {
  const doc: any = {
    body: null as any,
    activeElement: null as any,
    getElementById(id: string) {
      return descendantsOf(this.body).find((node) => node.id === id) || null;
    },
    querySelector(selector: string) {
      return descendantsOf(this.body).find((node) => matchesSimpleSelector(node, selector)) || null;
    },
    querySelectorAll(selector: string) {
      return descendantsOf(this.body).filter((node) => matchesSimpleSelector(node, selector));
    }
  };
  const body = createFakeElement(doc, 'div');
  doc.body = body;

  const toggleBtn = createFakeElement(doc, 'button', { id: 'toggle-sidebar-btn' });
  const drawer = createFakeElement(doc, 'aside', { id: 'designer-sidebar', className: 'sidebar' });
  const tabList = createFakeElement(doc, 'div', { id: 'sidebar-panel-tabs', className: 'sidebar-panel-tabs' });
  const stack = createFakeElement(doc, 'div', { id: 'sidebar-accordion-stack', className: 'sidebar-accordion-stack' });
  const modelContext = createFakeElement(doc, 'span', { id: 'sidebar-group-model-context' });
  const modelScopePath = createFakeElement(doc, 'span', { id: 'model-scope-path' });
  const canvasScopePath = createFakeElement(doc, 'span', { id: 'canvas-scope-path' });
  const pickDomainCta = createFakeElement(doc, 'button', { id: 'pick-domain-cta' });
  const domainList = createFakeElement(doc, 'div', { id: 'domain-list' });
  const workspace = createFakeElement(doc, 'section', { id: 'entities-workspace', className: 'entities-workspace' });
  const gate = createFakeElement(doc, 'div', { id: 'entities-workspace-gate' });
  const workspaceBody = createFakeElement(doc, 'div', { id: 'entities-workspace-body' });
  workspace.appendChild(gate);
  workspace.appendChild(workspaceBody);

  GROUP_KEYS.forEach((key) => {
    const tab = createFakeElement(doc, 'button', {
      className: 'sidebar-panel-tab sidebar-accordion-toggle',
      'data-sidebar-tab': key,
      id: `sidebar-group-${key}-btn`
    });
    tab.setAttribute('data-sidebar-tab', key);
    tab.setAttribute('role', 'tab');
    tab.appendChild(createFakeElement(doc, 'span', {
      className: 'sidebar-panel-tab-label',
      textContent: GROUP_TITLES[key as keyof typeof GROUP_TITLES]
    }));
    if (key === 'model') tab.appendChild(modelContext);
    tabList.appendChild(tab);

    const cell = createFakeElement(doc, 'section', {
      className: 'sidebar-accordion-cell',
      'data-sidebar-group': key,
      id: `sidebar-group-${key}`
    });
    cell.setAttribute('data-sidebar-group', key);
    const bodyEl = createFakeElement(doc, 'div', {
      className: 'sidebar-accordion-body',
      id: `body-${key}`
    });
    bodyEl.hidden = true;
    const panel = createFakeElement(doc, 'section', {
      className: 'panel',
      id: key === 'model' ? 'domain-inspector-panel' : `${key}-panel`,
      'data-sidebar-group': key
    });
    panel.setAttribute('data-sidebar-group', key);
    if (key === 'model') {
      bodyEl.appendChild(workspace);
      const entityPanel = createFakeElement(doc, 'section', {
        id: 'entity-inspector-panel',
        'data-sidebar-group': 'model'
      });
      entityPanel.setAttribute('data-sidebar-group', 'model');
      const relationshipPanel = createFakeElement(doc, 'section', {
        id: 'relationship-inspector-panel',
        'data-sidebar-group': 'model'
      });
      relationshipPanel.setAttribute('data-sidebar-group', 'model');
      const notePanel = createFakeElement(doc, 'section', {
        id: 'note-inspector-panel',
        'data-sidebar-group': 'model'
      });
      notePanel.setAttribute('data-sidebar-group', 'model');
      workspaceBody.appendChild(entityPanel);
      workspaceBody.appendChild(relationshipPanel);
      workspaceBody.appendChild(notePanel);
      workspaceBody.appendChild(domainList);
    }
    bodyEl.appendChild(panel);
    cell.appendChild(bodyEl);
    stack.appendChild(cell);
  });

  drawer.appendChild(tabList);
  drawer.appendChild(stack);
  drawer.appendChild(pickDomainCta);
  drawer.appendChild(modelScopePath);
  body.appendChild(toggleBtn);
  body.appendChild(drawer);
  body.appendChild(canvasScopePath);
  doc.activeElement = body;
  return doc;
}

function openKeys(sidebar: { expandedMap: () => Record<string, boolean> }) {
  return GROUP_KEYS.filter((key) => sidebar.expandedMap()[key]);
}

describe('sidebarGroups exclusive horizontal tab rail', () => {
  it('resolves legacy group ids onto canonical cells', () => {
    expect.hasAssertions();
    expect(resolveGroupKey('quality')).toBe('validate');
    expect(resolveGroupKey('share')).toBe('export');
    expect(resolveGroupKey('entities')).toBe('model');
    expect(resolveGroupKey('diff')).toBe('validate');
    expect(resolveGroupKey('import')).toBe('import');
    expect(LEGACY_GROUP_MAP.inspector).toBe('model');
    expect(GROUP_KEYS).toStrictEqual(['model', 'history', 'validate', 'export', 'import']);
    expect(GROUP_HIERARCHY.model.parent).toBeNull();
    expect(GROUP_TITLES.model).toBe('Model');
  });

  it('collapses multi-open maps to a single exclusive tab', () => {
    expect.hasAssertions();
    const exclusive = normalizeExclusiveExpanded({ model: true, validate: true, entities: true }, 'validate');
    expect(GROUP_KEYS.filter((key) => exclusive[key])).toStrictEqual(['validate']);
    expect(normalizeMultiExpanded({ export: true }, null).export).toBe(true);
    expect(normalizeExclusiveExpanded({ import: true }, null).import).toBe(true);
    expect(isExpandedFlag('1')).toBe(true);
  });

  it('opens Domains and closes Validate (exclusive tabs)', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [] }],
      selectedDomainId: 'd1',
      view: { sidebarOpen: true, sidebarExpanded: { validate: true }, sidebarGroup: 'validate' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    sidebar.setExpanded('model', true);
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(doc.getElementById('sidebar-panel-tabs').getAttribute('role')).toBe('tablist');
    expect(doc.getElementById('sidebar-accordion-stack').getAttribute('aria-multiselectable')).toBeNull();
  });

  it('tab click switches exclusively and re-click keeps active', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [] }],
      selectedDomainId: 'd1',
      view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    const exportToggle = doc.querySelector('[data-sidebar-tab="export"]');
    exportToggle.dispatch('click');
    expect(openKeys(sidebar)).toStrictEqual(['export']);
    exportToggle.dispatch('click');
    expect(openKeys(sidebar)).toStrictEqual(['export']);
  });

  it('gates entity create toolbar until a domain is selected', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const structureBar = createFakeElement(doc, 'div', { id: 'structure-create-toolbar' });
    const domainCreate = createFakeElement(doc, 'div', { id: 'domain-create-toolbar' });
    const createBar = createFakeElement(doc, 'div', { id: 'entity-create-toolbar' });
    const entityInput = createFakeElement(doc, 'input', { id: 'entity-name-input' });
    const addEntity = createFakeElement(doc, 'button', { id: 'add-entity-btn' });
    createBar.appendChild(entityInput);
    createBar.appendChild(addEntity);
    structureBar.appendChild(domainCreate);
    structureBar.appendChild(createBar);
    doc.getElementById('designer-sidebar').appendChild(structureBar);
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [] }],
      selectedDomainId: null,
      view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    const workspace = doc.getElementById('entities-workspace');
    expect(workspace.classList.contains('is-gate-blocked')).toBe(true);
    expect(createBar.getAttribute('data-gate-ready')).toBe('false');
    expect(entityInput.disabled).toBe(true);
    expect(domainCreate.hidden).toBe(false);
    expect(createBar.hidden).toBe(true);
    expect(domainCreate.classList.contains('is-create-inactive')).toBe(false);
    expect(createBar.classList.contains('is-create-inactive')).toBe(true);
    expect(structureBar.dataset.createScope).toBe('domain');

    state.selectedDomainId = 'd1';
    sidebar.syncHierarchyContext();
    expect(workspace.classList.contains('is-gate-blocked')).toBe(false);
    expect(createBar.getAttribute('data-gate-ready')).toBe('true');
    expect(entityInput.disabled).toBe(false);
    expect(domainCreate.hidden).toBe(true);
    expect(createBar.hidden).toBe(false);
    expect(domainCreate.classList.contains('is-create-inactive')).toBe(true);
    expect(createBar.classList.contains('is-create-inactive')).toBe(false);
    expect(domainCreate.style.display).toBe('none');
    expect(createBar.style.display).toBe('');
    expect(structureBar.dataset.createScope).toBe('entity');
    expect(doc.getElementById('sidebar-group-model-context').textContent).toBe('Users');
  });

  it('hides Structure create when an entity is selected', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const structureBar = createFakeElement(doc, 'div', { id: 'structure-create-toolbar' });
    const domainCreate = createFakeElement(doc, 'div', { id: 'domain-create-toolbar' });
    const entityCreate = createFakeElement(doc, 'div', { id: 'entity-create-toolbar' });
    structureBar.appendChild(domainCreate);
    structureBar.appendChild(entityCreate);
    doc.getElementById('designer-sidebar').appendChild(structureBar);
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [{ id: 'e1', name: 'Account', domainId: 'd1' }] }],
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    expect(domainCreate.hidden).toBe(true);
    expect(entityCreate.hidden).toBe(true);
    expect(structureBar.hidden).toBe(true);
    expect(structureBar.dataset.createScope).toBe('none');
  });

  it('revealGroupFor entity panel switches to Domains exclusively', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [{ id: 'e1', name: 'Account', domainId: 'd1' }] }],
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      view: { sidebarOpen: true, sidebarExpanded: { validate: true }, sidebarGroup: 'validate' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    sidebar.revealGroupFor('entity-inspector-panel', { scroll: false });
    expect(openKeys(sidebar)).toStrictEqual(['model']);
  });

  it('maps legacy inspector/selection keys onto Domains shell', () => {
    expect.hasAssertions();
    expect(resolveGroupKey('inspector')).toBe('model');
    expect(resolveGroupKey('selection')).toBe('model');
    const mapped = normalizeExclusiveExpanded({ inspector: true, entities: true }, null);
    expect(GROUP_KEYS.filter((key) => mapped[key])).toStrictEqual(['model']);
  });

  it('scopes Domains subtitle under the selected entity path', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const state: any = {
      domains: [{ id: 'd1', name: 'Users', entities: [{ id: 'e1', name: 'Account', domainId: 'd1' }] }],
      selectedDomainId: 'd1',
      selectedEntityId: 'e1',
      view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    expect(sidebar.selectionPath()).toMatchObject({ kind: 'entity', domainName: 'Users' });
    expect(doc.getElementById('sidebar-group-model-context').textContent).toBe('Users → Account');
  });
});

describe('sidebarGroups coverage gaps (JUM-922)', () => {
  function makeSidebar(overrides: Record<string, any> = {}) {
    const doc = buildDocument();
    const state: any = {
      domains: [{
        id: 'd1',
        name: 'Users',
        entities: [{
          id: 'e1', name: 'Account', domainId: 'd1', fields: [{ name: 'email', type: 'string' }]
        }]
      }],
      selectedDomainId: 'd1',
      selectedEntityId: null,
      selectedRelationshipId: null,
      selectedNoteId: null,
      selection: { kind: 'domain', domainId: 'd1' },
      view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' },
      ...overrides
    };
    if (overrides.view) {
      state.view = { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model', ...overrides.view };
    }
    const saved: number[] = [];
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => { saved.push(1); }
    });
    return { doc, state, sidebar, saved };
  }

  it('folds quality/share/diff/domains/import aliases into exclusive tabs', () => {
    expect.hasAssertions();
    expect(resolveGroupKey('domains')).toBe('model');
    expect(resolveGroupKey('')).toBeNull();
    expect(resolveGroupKey(null as any)).toBeNull();
    expect(resolveGroupKey('nope')).toBeNull();
    expect(isExpandedFlag(true)).toBe(true);
    expect(isExpandedFlag(1)).toBe(true);
    expect(isExpandedFlag('true')).toBe(true);
    expect(isExpandedFlag(0)).toBe(false);
    expect(isExpandedFlag('false')).toBe(false);

    const fromQuality = normalizeExclusiveExpanded({ quality: true }, null);
    expect(GROUP_KEYS.filter((key) => fromQuality[key])).toStrictEqual(['validate']);
    const fromDiff = normalizeExclusiveExpanded({ diff: '1' }, null);
    expect(fromDiff.validate).toBe(true);
    const fromShare = normalizeExclusiveExpanded({ share: 1 }, 'export');
    expect(fromShare.export).toBe(true);
    const fromDomains = normalizeExclusiveExpanded({ domains: true }, null);
    expect(fromDomains.model).toBe(true);
    const fromImport = normalizeExclusiveExpanded({ import: true, model: true }, 'import');
    expect(GROUP_KEYS.filter((key) => fromImport[key])).toStrictEqual(['import']);
    expect(normalizeExclusiveExpanded(null, null)).toStrictEqual({
      model: false, history: false, validate: false, export: false, import: false
    });
    expect(normalizeExclusiveExpanded({ model: true, history: true }, 'bogus').model).toBe(true);
  });

  it('navigates tabs with Arrow/Home/End and activates via Enter/Space', () => {
    expect.hasAssertions();
    const { doc, sidebar } = makeSidebar();
    sidebar.renderSidebarGroups();
    const modelTab = doc.querySelector('[data-sidebar-tab="model"]');
    const historyTab = doc.querySelector('[data-sidebar-tab="history"]');
    const importTab = doc.querySelector('[data-sidebar-tab="import"]');

    modelTab.dispatch('keydown', { key: 'ArrowRight' });
    expect(doc.activeElement).toBe(historyTab);

    historyTab.dispatch('keydown', { key: 'ArrowLeft' });
    expect(doc.activeElement).toBe(modelTab);

    modelTab.dispatch('keydown', { key: 'ArrowDown' });
    expect(doc.activeElement).toBe(historyTab);

    historyTab.dispatch('keydown', { key: 'ArrowUp' });
    expect(doc.activeElement).toBe(modelTab);

    modelTab.dispatch('keydown', { key: 'End' });
    expect(doc.activeElement).toBe(importTab);

    importTab.dispatch('keydown', { key: 'Home' });
    expect(doc.activeElement).toBe(modelTab);

    historyTab.dispatch('keydown', { key: 'Enter' });
    expect(openKeys(sidebar)).toStrictEqual(['history']);

    const validateTab = doc.querySelector('[data-sidebar-tab="validate"]');
    validateTab.dispatch('keydown', { key: ' ' });
    expect(openKeys(sidebar)).toStrictEqual(['validate']);
  });

  it('toggles drawer open/closed and opens model when drawer opens empty', () => {
    expect.hasAssertions();
    const { doc, sidebar, state, saved } = makeSidebar({
      view: { sidebarOpen: false, sidebarExpanded: {}, sidebarGroup: null }
    });
    expect(sidebar.isOpen()).toBe(false);
    doc.getElementById('toggle-sidebar-btn').dispatch('click');
    expect(sidebar.isOpen()).toBe(true);
    expect(state.view.sidebarOpen).toBe(true);
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(saved.length).toBeGreaterThan(0);

    sidebar.toggleDrawer();
    expect(sidebar.isOpen()).toBe(false);
    expect(doc.getElementById('designer-sidebar').classList.contains('open')).toBe(false);
    expect(doc.getElementById('toggle-sidebar-btn').getAttribute('aria-expanded')).toBe('false');

    sidebar.setDrawerOpen(true);
    expect(sidebar.isOpen()).toBe(true);
    expect(doc.getElementById('toggle-sidebar-btn').title).toContain('Hide');
  });

  it('revealGroupFor switches model for note/relationship/domain/workspace panels', () => {
    expect.hasAssertions();
    const { doc, sidebar } = makeSidebar({
      view: { sidebarOpen: false, sidebarExpanded: { history: true }, sidebarGroup: 'history' }
    });
    sidebar.renderSidebarGroups();

    sidebar.revealGroupFor('note-inspector-panel');
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(sidebar.isOpen()).toBe(true);
    expect(doc.getElementById('note-inspector-panel').hidden).toBe(false);

    sidebar.setExpanded('export', true);
    sidebar.revealGroupFor('relationship-inspector-panel', { scroll: true });
    expect(openKeys(sidebar)).toStrictEqual(['model']);

    sidebar.setExpanded('validate', true);
    sidebar.revealGroupFor('domain-inspector-panel', { scroll: false });
    expect(openKeys(sidebar)).toStrictEqual(['model']);

    sidebar.setExpanded('import', true);
    sidebar.revealGroupFor('entities-workspace');
    expect(openKeys(sidebar)).toStrictEqual(['model']);

    sidebar.revealGroupFor('missing-panel-id');
    expect(openKeys(sidebar)).toStrictEqual(['model']);
  });

  it('selectionPath covers note, relationship, field, orphan entity, domain, empty', () => {
    expect.hasAssertions();
    const { doc, sidebar, state } = makeSidebar();

    state.selection = { kind: 'note', noteId: 'n1', domainId: 'd1' };
    state.selectedNoteId = 'n1';
    sidebar.syncHierarchyContext();
    expect(sidebar.selectionPath()).toMatchObject({ kind: 'note', label: 'Note' });
    expect(doc.getElementById('model-scope-path').textContent).toBe('Note');
    expect(doc.getElementById('canvas-scope-path').textContent).toBe('Note');

    state.selectedNoteId = null;
    state.selection = { kind: 'relationship', relationshipId: 'r1', domainId: 'd1' };
    state.selectedRelationshipId = 'r1';
    sidebar.syncHierarchyContext();
    expect(sidebar.selectionPath()).toMatchObject({ kind: 'relationship', label: 'Relationship' });

    state.selectedRelationshipId = null;
    state.selection = { kind: 'field', domainId: 'd1', entityId: 'e1', fieldName: 'email' };
    state.selectedEntityId = 'e1';
    sidebar.syncHierarchyContext();
    expect(sidebar.selectionPath()).toMatchObject({
      kind: 'field',
      fieldName: 'email',
      domainName: 'Users',
      entityName: 'Account'
    });
    // Context chrome keeps domain name for field focus; path label carries the field.
    expect(doc.getElementById('sidebar-group-model-context').textContent).toBe('Users');
    expect(doc.getElementById('model-scope-path').textContent).toContain('email');

    state.selection = { kind: 'entity', domainId: 'd1', entityId: 'ghost' };
    state.selectedEntityId = 'ghost';
    expect(sidebar.selectionPath()).toMatchObject({ kind: 'entity', label: 'Entity' });

    state.selectedEntityId = null;
    state.selection = { kind: 'domain', domainId: 'd1' };
    state.selectedDomainId = 'd1';
    expect(sidebar.selectionPath()).toMatchObject({ kind: 'domain', domainName: 'Users' });

    state.selectedDomainId = null;
    state.selection = { kind: 'none' };
    sidebar.syncHierarchyContext();
    expect(sidebar.selectionPath()).toMatchObject({ kind: null, label: 'Nothing selected' });
    expect(doc.getElementById('sidebar-group-model-context').textContent).toBe('1');
    expect(doc.getElementById('sidebar-accordion-stack').dataset.selectionKind).toBe('none');
  });

  it('releaseFocusFromCollapsed moves focus off a collapsed panel body', () => {
    expect.hasAssertions();
    const { doc, sidebar } = makeSidebar({
      view: { sidebarOpen: true, sidebarExpanded: { history: true }, sidebarGroup: 'history' }
    });
    sidebar.renderSidebarGroups();

    const modelBody = doc.getElementById('body-model');
    const input = createFakeElement(doc, 'input', { id: 'stale-focus-input' });
    modelBody.appendChild(input);
    doc.activeElement = input;

    // history is open; model cell is collapsed — focus should leave the model body.
    sidebar.renderSidebarGroups();
    expect(doc.activeElement).not.toBe(input);
    expect(
      doc.activeElement === doc.querySelector('[data-sidebar-tab="history"]')
      || doc.activeElement === doc.getElementById('toggle-sidebar-btn')
    ).toBe(true);

    // Outside drawer: leave focus alone.
    const outside = createFakeElement(doc, 'button', { id: 'outside-btn' });
    doc.body.appendChild(outside);
    doc.activeElement = outside;
    sidebar.renderSidebarGroups();
    expect(doc.activeElement).toBe(outside);

    // preventScroll focus throw falls back to plain focus.
    const historyTab = doc.querySelector('[data-sidebar-tab="history"]');
    historyTab._focusThrowsPreventScroll = true;
    const modelCellBody = doc.getElementById('body-model');
    const trapped = createFakeElement(doc, 'button', { id: 'trapped' });
    modelCellBody.appendChild(trapped);
    doc.activeElement = trapped;
    sidebar.setExpanded('validate', true);
    sidebar.renderSidebarGroups();
    expect(doc.activeElement === doc.querySelector('[data-sidebar-tab="validate"]')
      || doc.activeElement === doc.getElementById('toggle-sidebar-btn')).toBe(true);
  });

  it('pick-domain-cta activates model and focuses domain list', () => {
    expect.hasAssertions();
    const { doc, sidebar } = makeSidebar({
      view: { sidebarOpen: true, sidebarExpanded: { export: true }, sidebarGroup: 'export' }
    });
    sidebar.renderSidebarGroups();
    const cta = doc.getElementById('pick-domain-cta');
    expect(cta.dataset.sidebarWired).toBe('true');
    cta.dispatch('click');
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(doc.activeElement).toBe(doc.getElementById('domain-list'));

    // Re-create should not double-wire.
    createSidebarGroups({
      documentRef: doc,
      state: {
        domains: [],
        view: { sidebarOpen: true, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
      },
      saveState: () => {}
    });
    expect(cta.dataset.sidebarWired).toBe('true');
  });

  it('setExpanded(false) collapses active tab back to model', () => {
    expect.hasAssertions();
    const { sidebar, saved } = makeSidebar({
      view: { sidebarOpen: true, sidebarExpanded: { validate: true }, sidebarGroup: 'validate' }
    });
    sidebar.renderSidebarGroups();
    expect(sidebar.getOpenKey()).toBe('validate');
    sidebar.setExpanded('validate', false);
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(sidebar.getOpenKey()).toBe('model');

    // Collapsing a non-open tab is a no-op for exclusivity.
    const before = saved.length;
    sidebar.setExpanded('history', false);
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(saved.length).toBeGreaterThan(before);

    sidebar.setExpanded('not-a-group', true);
    expect(openKeys(sidebar)).toStrictEqual(['model']);

    sidebar.setActiveGroup('import');
    expect(openKeys(sidebar)).toStrictEqual(['import']);
    sidebar.toggleExpanded('export');
    expect(openKeys(sidebar)).toStrictEqual(['export']);
  });

  it('hydrateFromState remaps legacy sidebarGroup and empty view', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const state: any = {
      domains: [],
      view: {
        sidebarOpen: true,
        sidebarExpanded: { quality: true, share: true },
        sidebarGroup: 'quality'
      }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    expect(state.view.sidebarGroup).toBe('validate');
    expect(openKeys(sidebar)).toStrictEqual(['validate']);

    state.view.sidebarGroup = 'unknown-legacy';
    state.view.sidebarExpanded = { model: true };
    sidebar.hydrateFromState();
    expect(state.view.sidebarGroup).toBe('model');

    delete state.view;
    sidebar.hydrateFromState();
    expect(state.view).toBeDefined();
    sidebar.renderSidebarGroups();
    expect(sidebar.openKeysFrom()).toBeInstanceOf(Array);
  });

  it('pick-domain-cta focus falls back when preventScroll throws', () => {
    expect.hasAssertions();
    const { doc, sidebar } = makeSidebar({
      view: { sidebarOpen: true, sidebarExpanded: { history: true }, sidebarGroup: 'history' }
    });
    const list = doc.getElementById('domain-list');
    list._focusThrowsPreventScroll = true;
    sidebar.renderSidebarGroups();
    doc.getElementById('pick-domain-cta').dispatch('click');
    expect(openKeys(sidebar)).toStrictEqual(['model']);
    expect(doc.activeElement).toBe(list);
  });

  it('handles missing chrome, rAF fallback, and focus/blur edge paths', () => {
    expect.hasAssertions();
    const bareDoc: any = {
      body: null as any,
      activeElement: { id: 'orphan' },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
    bareDoc.body = createFakeElement(bareDoc, 'div');
    const bareState: any = { view: { sidebarOpen: true, sidebarExpanded: {}, sidebarGroup: 'zzz' } };
    const bare = createSidebarGroups({
      documentRef: bareDoc,
      state: bareState,
      saveState: () => {}
    });
    bare.renderSidebarGroups();
    bare.setExpanded('model', true, { scroll: true, persist: false });
    bare.toggleExpanded('nope');
    bare.revealGroupFor('ghost-panel');
    expect(bareState.view.sidebarGroup).toBe('model');

    const { doc, sidebar, state } = makeSidebar({
      view: { sidebarOpen: false, sidebarExpanded: { model: true }, sidebarGroup: 'model' }
    });
    // Tabs without role=tab get role stamped on render.
    const historyTab = doc.querySelector('[data-sidebar-tab="history"]');
    historyTab.removeAttribute('role');
    // Domains null → context count branch.
    state.domains = null;
    state.selectedDomainId = null;
    state.selection = { kind: 'none' };
    const prevRaf = (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).requestAnimationFrame;
    sidebar.setDrawerOpen(true);
    sidebar.setExpanded('history', true, { scroll: true });
    expect(doc.getElementById('sidebar-group-history')._scrolled).toBe(true);
    (globalThis as any).requestAnimationFrame = prevRaf;

    // Active element without closest → early return.
    doc.activeElement = { id: 'no-closest' };
    sidebar.renderSidebarGroups();

    // Focus inside the open history cell → keep focus (expanded host early return).
    const historyBody = doc.getElementById('body-history');
    const nested = createFakeElement(doc, 'button', { id: 'nested-in-open' });
    historyBody.appendChild(nested);
    doc.activeElement = nested;
    sidebar.renderSidebarGroups();
    expect(doc.activeElement).toBe(nested);

    // Blur fallback when no tab target and no drawer toggle.
    const toggle = doc.getElementById('toggle-sidebar-btn');
    toggle.parentNode.children = toggle.parentNode.children.filter((child: any) => child !== toggle);
    // Force empty exclusive map via chosenExpanded + render with active in collapsed cell.
    const modelBody = doc.getElementById('body-model');
    const trapped = createFakeElement(doc, 'button', { id: 'blur-me' });
    trapped.blur = () => { doc.activeElement = doc.body; };
    modelBody.appendChild(trapped);
    doc.activeElement = trapped;
    sidebar.setExpanded('validate', true);
    // Remove open validate tab so releaseFocus falls through to blur.
    GROUP_KEYS.forEach((key) => {
      const tab = doc.querySelector(`[data-sidebar-tab="${key}"]`);
      if (tab?.parentNode) {
        tab.parentNode.children = tab.parentNode.children.filter((child: any) => child !== tab);
      }
    });
    sidebar.renderSidebarGroups();

    // Field path with empty fieldName + domain without entities array.
    state.domains = [{ id: 'd1', name: 'Users' }];
    state.selection = { kind: 'field', domainId: 'd1', entityId: 'e1', fieldName: '' };
    state.selectedEntityId = 'e1';
    expect(sidebar.selectionPath().kind).toBe('entity');

    // revealGroupFor history panel uses cell scroll path (else branch).
    sidebar.revealGroupFor('history-panel', { scroll: true });
    expect(openKeys(sidebar)).toStrictEqual(['history']);

    // Workspace without scrollIntoView is a no-op.
    const workspace = doc.getElementById('entities-workspace');
    delete workspace.scrollIntoView;
    sidebar.revealGroupFor('entities-workspace', { scroll: true });
    expect(openKeys(sidebar)).toStrictEqual(['model']);
  });

  it('covers unknown hierarchy keys, keyless tabs, and missing reveal cells', () => {
    expect.hasAssertions();
    const doc = buildDocument();
    const rogueCell = createFakeElement(doc, 'section', {
      className: 'sidebar-accordion-cell',
      id: 'sidebar-group-rogue'
    });
    rogueCell.setAttribute('data-sidebar-group', 'rogue-band');
    rogueCell.appendChild(createFakeElement(doc, 'div', { className: 'sidebar-accordion-body' }));
    doc.getElementById('sidebar-accordion-stack').appendChild(rogueCell);

    const keylessTab = createFakeElement(doc, 'button', {
      className: 'sidebar-panel-tab',
      id: 'keyless-tab'
    });
    doc.getElementById('sidebar-panel-tabs').appendChild(keylessTab);

    const datasetOnlyTab = createFakeElement(doc, 'button', {
      className: 'sidebar-panel-tab',
      id: 'dataset-tab'
    });
    datasetOnlyTab.dataset.sidebarTab = 'history';
    datasetOnlyTab.getAttribute = () => null;
    doc.getElementById('sidebar-panel-tabs').appendChild(datasetOnlyTab);

    const state: any = {
      domains: [{ id: 'ghost-domain', name: 'Ghost', entities: null }],
      selectedDomainId: 'missing-domain',
      selection: { kind: 'domain', domainId: 'missing-domain' },
      view: {
        sidebarOpen: true,
        sidebarExpanded: {},
        sidebarGroup: 'not-a-group'
      }
    };
    const sidebar = createSidebarGroups({
      documentRef: doc,
      state,
      saveState: () => {}
    });
    sidebar.renderSidebarGroups();
    expect(rogueCell.dataset.hierarchyBand).toBe('');
    expect(sidebar.selectionPath()).toMatchObject({ kind: null, label: 'Nothing selected' });
    expect(state.view.sidebarGroup).toBe('model');

    const modelCell = doc.getElementById('sidebar-group-model');
    modelCell.parentNode.children = modelCell.parentNode.children.filter(
      (child: any) => child !== modelCell
    );
    sidebar.revealGroupFor('domain-inspector-panel', { scroll: false });
    expect(openKeys(sidebar)).toStrictEqual(['model']);

    GROUP_KEYS.forEach((key) => {
      const tab = doc.querySelector(`[data-sidebar-tab="${key}"]`);
      if (tab?.parentNode) {
        tab.parentNode.children = tab.parentNode.children.filter((child: any) => child !== tab);
      }
    });
    datasetOnlyTab.dispatch('keydown', { key: 'ArrowRight' });
    keylessTab.dispatch('click');
  });
});
