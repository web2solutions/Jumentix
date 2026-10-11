/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
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
    addEventListener(type: string, handler: (event: any) => void) {
      const list = this.listeners.get(type) || [];
      list.push(handler);
      this.listeners.set(type, list);
    },
    dispatch(type: string, event: any = {}) {
      const payload = {
        preventDefault() {}, stopPropagation() {}, ...event, type, target: this
      };
      (this.listeners.get(type) || []).forEach((handler: any) => handler(payload));
    },
    focus() {},
    blur() {},
    scrollIntoView() {}
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
      workspaceBody.appendChild(entityPanel);
    }
    bodyEl.appendChild(panel);
    cell.appendChild(bodyEl);
    stack.appendChild(cell);
  });

  drawer.appendChild(tabList);
  drawer.appendChild(stack);
  body.appendChild(toggleBtn);
  body.appendChild(drawer);
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
