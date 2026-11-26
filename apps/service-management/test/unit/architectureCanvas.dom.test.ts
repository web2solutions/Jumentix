/* eslint-disable @typescript-eslint/no-explicit-any, max-len, no-param-reassign */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
/* eslint-disable jest/require-top-level-describe, jest/require-hook */
/* Shared fake-DOM helpers register beforeEach/afterEach via withBrowser();
 * that pattern trips require-top-level-describe / require-hook even though
 * every call site is inside a describe block. */
/*
 * JUM-816 / JUM-905 — behavioral suite for `createArchitectureCanvas`
 * (`apps/service-management/src/ui/architectureCanvas.js`).
 *
 * The module is browser-targeted plain JavaScript that reaches through the
 * ambient `document` and `window`; it is exercised here against a
 * hand-rolled fake DOM — no jsdom, no shims beyond what the module actually
 * touches — the same convention as `controlHelp.dom.test.ts` /
 * `pwaShell.test.ts`. Every assertion is on an observable effect: rendered
 * DOM nodes, dispatched-event side effects (drag/drop, pointer drag, button
 * clicks) and the state the module mutates through `withPersist`.
 */

import {
  architectureLinkGeometry,
  architectureLinkLabel,
  createArchitectureCanvas
} from '../../src/ui/architectureCanvas.js';

/*
 * Two seams are wrapped (delegating to the real implementation by default) so
 * the defensive branches of the canvas can be driven with states the model
 * normaliser itself never produces: an architecture with no services, links or
 * domain ids that point at nothing, and validator issues of every shape.
 */
jest.mock('@jumentix/designer-core/model/architecture.js', () => {
  const actual = jest.requireActual('@jumentix/designer-core/model/architecture.js');
  return { ...actual, normalizeArchitectureInput: jest.fn(actual.normalizeArchitectureInput) };
});
jest.mock('@jumentix/designer-core/validation/architectureValidation.js', () => {
  const actual = jest.requireActual('@jumentix/designer-core/validation/architectureValidation.js');
  return { ...actual, collectArchitectureIssues: jest.fn(actual.collectArchitectureIssues) };
});

const architectureModelMock: any = jest.requireMock('@jumentix/designer-core/model/architecture.js');
const architectureModelActual: any = jest.requireActual('@jumentix/designer-core/model/architecture.js');
const validationMock: any = jest.requireMock('@jumentix/designer-core/validation/architectureValidation.js');
const validationActual: any = jest.requireActual('@jumentix/designer-core/validation/architectureValidation.js');

describe('architectureLinkLabel — unknown service ids', () => {
  it('falls back to the raw id when a link end has no matching service', () => {
    expect.hasAssertions();
    const core = {
      id: 'core', name: 'Core', x: 80, y: 80, width: 270, height: 190
    };

    expect(architectureLinkLabel({ from: 'core', to: 'ghost-service', protocol: 'rest' }, [core]))
      .toBe('Core —rest→ ghost-service');
  });
});

function createFakeElement(tag: string): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    className: '',
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    draggable: false,
    hidden: false,
    value: '',
    textContent: '',
    selected: false,
    href: '',
    download: '',
    children: [] as any[],
    listeners: new Map<string, Array<(event: any) => void>>(),
    get classList() {
      return {
        add: (name: string) => {
          el.className = el.className ? `${el.className} ${name}` : name;
        },
        remove: (name: string) => {
          el.className = el.className.split(/\s+/u).filter((entry: string) => entry && entry !== name).join(' ');
        },
        toggle: (name: string, force?: boolean) => {
          const on = el.className.split(/\s+/u).filter(Boolean).includes(name);
          const next = force === undefined ? !on : force;
          if (next && !on) el.classList.add(name);
          if (!next && on) el.classList.remove(name);
          return next;
        },
        contains: (name: string) => el.className.split(/\s+/u).filter(Boolean).includes(name)
      };
    },
    setAttribute(name: string, value: string) {
      el[`attr:${name}`] = value;
    },
    getAttribute(name: string) {
      return el[`attr:${name}`] ?? null;
    },
    focus() {
      el.focused = true;
    },
    blur() {
      el.blurred = true;
    },
    get parentElement() {
      return el.parentNode ?? null;
    },
    closest(selector: string) {
      const wanted = selector.replace(/^\./u, '');
      let node: any = el;
      while (node) {
        if (String(node.className).split(/\s+/u).includes(wanted)) return node;
        node = node.parentNode;
      }
      return null;
    },
    appendChild(child: any) {
      el.children.push(child);
      Object.assign(child, { parentNode: el });
      return child;
    },
    addEventListener(type: string, handler: (event: any) => void) {
      const list = el.listeners.get(type) || [];
      list.push(handler);
      el.listeners.set(type, list);
    },
    dispatch(type: string, payload: any = {}) {
      (el.listeners.get(type) || []).slice()
        .forEach((handler: (event: any) => void) => handler(payload));
    },
    click() {
      el.dispatch('click', {});
    },
    getContext() {
      return {
        fillStyle: '', font: '', fillRect: () => {}, fillText: () => {}
      };
    },
    toDataURL() {
      return 'data:image/png;base64,fake';
    },
    set innerHTML(_html: string) {
      el.children = [];
    },
    get innerHTML() {
      return '';
    }
  };
  return el;
}

function createFakeWindow(innerWidth = 1400) {
  const listeners = new Map<string, Array<(event: any) => void>>();
  type TimerFn = () => void;
  const timers = new Map<number, TimerFn>();
  let nextTimer = 1;
  return {
    confirm: () => true,
    innerWidth,
    setTimeout(handler: () => void, _ms?: number) {
      const id = nextTimer;
      nextTimer += 1;
      timers.set(id, handler);
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    flushTimers() {
      [...timers.values()].forEach((handler) => handler());
      timers.clear();
    },
    addEventListener(type: string, handler: (event: any) => void) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type: string, handler: (event: any) => void) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== handler));
    },
    dispatch(type: string, payload: any = {}) {
      (listeners.get(type) || []).slice()
        .forEach((handler: (event: any) => void) => handler(payload));
    },
    listenerCount(type: string) {
      return (listeners.get(type) || []).length;
    }
  };
}

function fakeDataTransfer(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (key: string, value: string) => { store[key] = value; },
    getData: (key: string) => store[key] || ''
  };
}

const FULL_DOM_KEYS = [
  'architectureEmptyState', 'architectureCoach', 'architectureCoachDismissBtn',
  'architectureServiceNameInput', 'architectureServiceNameError', 'architectureAddServiceBtn',
  'architectureServicesHint', 'architectureServiceList',
  'architectureDomainsHint', 'architectureDomainPalette',
  'architectureInspectEmpty', 'architectureInspectBody', 'architectureInspectName',
  'architectureInspectNameError', 'architectureInspectKindBadge',
  'architectureInspectUrl', 'architectureInspectUrlError',
  'architectureInspectDeploy', 'architectureInspectDeployError',
  'architectureOpenDomainsBtn', 'architectureMoveDomainHint',
  'architectureInspectDomainNameInput', 'architectureInspectDomainNameError',
  'architectureInspectAddDomainBtn',
  'architectureDeleteServiceBtn', 'architectureLinksHint', 'architectureLinksConnectBtn',
  'architectureLinkProtocol', 'architectureLinkList',
  'architectureValidateHint', 'architectureIssueList', 'architectureCanvas', 'architectureMiniMap',
  'architectureExportImageBtn', 'architectureConnectBtn', 'architectureCancelConnectBtn',
  'architectureConnectStatus', 'architectureScopePath', 'architectureInspectHint',
  'architectureServiceDomains', 'architectureSidebar', 'architectureToggleSidebarBtn',
  'architectureTabServicesContext', 'architectureTabDomainsContext',
  'architectureTabSelectedContext', 'architectureTabLinksContext',
  'architectureTabValidateContext'
];

function createFullDom(): Record<string, any> {
  const dom: Record<string, any> = {};
  FULL_DOM_KEYS.forEach((key) => { dom[key] = createFakeElement('div'); });
  return dom;
}

function createDomains() {
  // Deliberately no "Users" domain: collectArchitectureIssues then always
  // has at least one warning to render, without extra setup per test.
  return [
    { id: 'domain-billing', name: 'Billing' },
    { id: 'domain-payments', name: 'Payments' }
  ];
}

describe('createArchitectureCanvas — wiring against an absent DOM', () => {
  const savedDocument = (globalThis as any).document;
  const savedWindow = (globalThis as any).window;

  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => createFakeElement(tag),
      createElementNS: (_ns: string, tag: string) => createFakeElement(tag)
    };
    (globalThis as any).window = createFakeWindow();
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
  });

  it('wires and renders without throwing when every optional DOM node is missing', () => {
    expect.hasAssertions();
    const state: any = { domains: createDomains(), architecture: undefined };
    const actions = {
      withPersist: (fn: () => void) => fn(),
      saveState: jest.fn()
    };

    const canvas = createArchitectureCanvas({ dom: {}, state, actions });

    expect(() => canvas.renderArchitecture()).not.toThrow();
  });

  it('renders the empty state as visible when there are no domains yet', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = { domains: [], architecture: undefined };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    createArchitectureCanvas({ dom, state, actions }).renderArchitecture();

    expect(dom.architectureEmptyState.hidden).toBe(false);
  });
});

describe('createArchitectureCanvas — full render and interaction surface', () => {
  const savedDocument = (globalThis as any).document;
  const savedWindow = (globalThis as any).window;
  let fakeWindow: ReturnType<typeof createFakeWindow>;

  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => createFakeElement(tag),
      createElementNS: (_ns: string, tag: string) => createFakeElement(tag)
    };
    fakeWindow = createFakeWindow();
    (globalThis as any).window = fakeWindow;
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
  });

  function setup() {
    const dom = createFullDom();
    const state: any = { domains: createDomains(), architecture: undefined };
    const saveState = jest.fn();
    const actions = {
      withPersist: (fn: () => void) => { fn(); saveState(); },
      saveState
    };
    const canvas = createArchitectureCanvas({ dom, state, actions });
    return {
      dom, state, saveState, canvas
    };
  }

  it('renders the palette and a Users-domain warning once services exist', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();

    canvas.renderArchitecture();

    expect(dom.architectureEmptyState.hidden).toBe(true);
    expect(dom.architectureDomainPalette.children).toHaveLength(2);
    const firstDomain = dom.architectureDomainPalette.children[0];
    expect(firstDomain.children[0].children[0].textContent).toBe('Billing');
    expect(firstDomain.children[0].children[1].textContent).toBe('on Core');
    expect(dom.architectureIssueList.children.length).toBeGreaterThan(0);
    expect(dom.architectureIssueList.children[0].className).toContain('architecture-issue-warn');
  });

  it('starts a domain-chip drag with the domain id on the palette item', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();

    const transfer = fakeDataTransfer();
    dom.architectureDomainPalette.children[0].dispatch('dragstart', { dataTransfer: transfer });

    expect(transfer.getData('text/plain')).toBe('domain-billing');
    expect(transfer.effectAllowed).toBe('move');
  });

  it('starts a drag from an already-assigned domain chip on a service card', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();

    // The monolith preset assigns every domain to Core, so its card already
    // renders one chip per domain.
    const box = dom.architectureCanvas.children.find((node: any) => node.tagName === 'ARTICLE');
    const chips = box.children.find((node: any) => node.className === 'architecture-domain-chips');
    const transfer = fakeDataTransfer();

    chips.children[0].dispatch('dragstart', { dataTransfer: transfer });

    expect(transfer.getData('text/plain')).toBe('domain-billing');
  });

  it('selects a service from the service list and marks it active', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Payments API';
    dom.architectureAddServiceBtn.dispatch('click', {});

    expect(dom.architectureServiceList.children).toHaveLength(2);
    const [, newButton] = dom.architectureServiceList.children.map((item: any) => item.children[0]);
    expect(newButton.dataset.summary).toBe('Payments API · Split-out · 0 domains');
    expect(dom.architectureServiceNameInput.value).toBe('');

    newButton.dispatch('click', {});

    // Selecting a service re-renders the list from scratch, so the live
    // "active" class lands on the freshly built buttons, not the stale ones.
    const [rerenderedCore, rerenderedNew] = dom.architectureServiceList.children
      .map((item: any) => item.children[0]);
    expect(rerenderedNew.className).toContain('active');
    expect(rerenderedCore.className).not.toContain('active');
  });

  it('falls back to a default service name when the name input is blank', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = '';

    dom.architectureAddServiceBtn.dispatch('click', {});

    const labels = dom.architectureServiceList.children
      .map((item: any) => item.children[0].dataset.summary);
    expect(labels.some((label: string) => label.startsWith('Service · Split-out'))).toBe(true);
  });

  it('adds a default-named service and skips clearing the input when it is absent', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    delete dom.architectureServiceNameInput;
    const state: any = { domains: createDomains(), architecture: undefined };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };
    const canvas = createArchitectureCanvas({ dom, state, actions });
    canvas.renderArchitecture();

    expect(() => dom.architectureAddServiceBtn.dispatch('click', {})).not.toThrow();

    const labels = dom.architectureServiceList.children
      .map((item: any) => item.children[0].dataset.summary);
    expect(labels.some((label: string) => label.startsWith('Service · Split-out'))).toBe(true);
  });

  it('ignores inspector autosave before any service is selected', () => {
    expect.hasAssertions();
    const { dom, state } = setup();
    dom.architectureInspectName.value = 'Should not apply';
    dom.architectureInspectName.dispatch('change', {});

    expect(state.architecture.services.map((service: any) => service.name)).not.toContain('Should not apply');
  });

  it('tolerates an undefined domains list throughout render', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = { domains: undefined, architecture: undefined };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    const canvas = createArchitectureCanvas({ dom, state, actions });
    expect(() => canvas.renderArchitecture()).not.toThrow();
    expect(dom.architectureDomainPalette.children).toHaveLength(1);
    expect(dom.architectureDomainPalette.children[0].className).toContain('architecture-rail-empty');
  });

  it('skips the mini-map overlay when it is absent from the DOM', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    delete dom.architectureMiniMap;
    const state: any = { domains: createDomains(), architecture: undefined };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    const canvas = createArchitectureCanvas({ dom, state, actions });
    expect(() => canvas.renderArchitecture()).not.toThrow();
  });

  it('ignores a delete click before any service is selected, then deletes the selected one', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();

    // Before the first render, selectedArchitectureServiceId is unset:
    // the guard clause must no-op rather than throw.
    dom.architectureDeleteServiceBtn.dispatch('click', {});
    expect(state.architecture).toBeUndefined();

    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Removable';
    dom.architectureAddServiceBtn.dispatch('click', {});
    const removableButton = dom.architectureServiceList.children[1].children[0];
    removableButton.dispatch('click', {});

    dom.architectureDeleteServiceBtn.dispatch('click', {});

    expect(state.architecture.services.map((service: any) => service.name)).not.toContain('Removable');
  });

  it('autosaves the selected service name, url and deploy target from the inspector', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();

    expect(dom.architectureInspectKindBadge.textContent).toBe('Core');
    expect(dom.architectureInspectKindBadge.dataset.kind).toBe('core');

    dom.architectureInspectName.value = 'Renamed Core';
    dom.architectureInspectName.dispatch('change', {});
    dom.architectureInspectUrl.value = 'http://localhost:9000/api/1.0.0';
    dom.architectureInspectUrl.dispatch('change', {});
    dom.architectureInspectDeploy.value = 'deploy-1';
    dom.architectureInspectDeploy.dispatch('change', {});

    let selected = state.architecture.services.find(
      (service: any) => service.id === state.selectedArchitectureServiceId
    );
    expect(selected.name).toBe('Renamed Core');
    expect(selected.kind).toBe('core');
    expect(selected.url).toBe('http://localhost:9000/api/1.0.0');
    expect(selected.deployTargetId).toBe('deploy-1');

    // Blank name is invalid (keeps prior); blank url keeps prior; deploy may clear.
    dom.architectureInspectName.value = '';
    dom.architectureInspectName.dispatch('change', {});
    expect(dom.architectureInspectNameError.hidden).toBe(false);
    expect(dom.architectureInspectName.classList.contains('is-invalid')).toBe(true);

    dom.architectureInspectUrl.value = '';
    dom.architectureInspectUrl.dispatch('change', {});
    dom.architectureInspectUrl.value = 'not-a-url';
    dom.architectureInspectUrl.dispatch('change', {});
    expect(dom.architectureInspectUrlError.hidden).toBe(false);

    dom.architectureInspectDeploy.value = '';
    dom.architectureInspectDeploy.dispatch('change', {});

    selected = state.architecture.services.find(
      (service: any) => service.id === state.selectedArchitectureServiceId
    );
    expect(selected.name).toBe('Renamed Core');
    expect(selected.url).toBe('http://localhost:9000/api/1.0.0');
    expect(selected.deployTargetId).toBe('');
  });

  it('rejects a duplicate split-out name with an inline field error', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Billing';
    dom.architectureAddServiceBtn.dispatch('click', {});
    expect(state.architecture.services.some((service: any) => service.name === 'Billing')).toBe(true);

    dom.architectureServiceNameInput.value = 'Billing';
    dom.architectureAddServiceBtn.dispatch('click', {});
    expect(dom.architectureServiceNameError.hidden).toBe(false);
    expect(dom.architectureServiceNameError.textContent).toContain('already exists');
    expect(state.architecture.services.filter((service: any) => service.name === 'Billing')).toHaveLength(1);
  });

  it('moves a domain onto the selected service via Domains palette click', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Billing Service';
    dom.architectureAddServiceBtn.dispatch('click', {});
    const billingButton = dom.architectureServiceList.children[1].children[0];
    billingButton.dispatch('click', {});

    let billingService = state.architecture.services.find((service: any) => service.name === 'Billing Service');
    expect(billingService.domains).toHaveLength(0);

    const billingChip = dom.architectureDomainPalette.children.find(
      (item: any) => item.dataset.domainId === 'domain-billing'
    );
    expect(billingChip).toBeTruthy();
    billingChip.dispatch('click', {});

    billingService = state.architecture.services.find((service: any) => service.name === 'Billing Service');
    expect(billingService.domains).toContain('domain-billing');
  });

  it('adds a link via Connect on the canvas, then removes it from the Links list', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Second Service';
    dom.architectureAddServiceBtn.dispatch('click', {});
    canvas.renderArchitecture();
    const [core, second] = state.architecture.services;

    dom.architectureLinkProtocol.value = 'grpc';
    dom.architectureConnectBtn.dispatch('click', {});
    const coreBox = dom.architectureCanvas.children.find(
      (node: any) => node.tagName === 'ARTICLE' && node.dataset.serviceId === core.id
    );
    const secondBox = dom.architectureCanvas.children.find(
      (node: any) => node.tagName === 'ARTICLE' && node.dataset.serviceId === second.id
    );
    coreBox.dispatch('click', {});
    secondBox.dispatch('click', {});

    expect(state.architecture.links).toHaveLength(1);
    expect(state.architecture.links[0].protocol).toBe('grpc');
    const linkRow = dom.architectureLinkList.children[0];
    expect(linkRow.children[0].children[1].textContent).toBe('Core —grpc→ Second Service');

    const removeButton = linkRow.children[linkRow.children.length - 1];
    removeButton.dispatch('click', {});
    expect(state.architecture.links).toHaveLength(0);
  });

  it('assigns a dropped domain to a service card and ignores a drop with no payload', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Drop Target';
    dom.architectureAddServiceBtn.dispatch('click', {});
    canvas.renderArchitecture();

    const dropTargetBox = dom.architectureCanvas.children.find(
      (node: any) => node.tagName === 'ARTICLE' && node.dataset.serviceId !== 'core'
    );

    const emptyTransfer = fakeDataTransfer();
    let prevented = false;
    dropTargetBox.dispatch('drop', { preventDefault: () => { prevented = true; }, dataTransfer: emptyTransfer });
    expect(prevented).toBe(true);
    expect(dropTargetBox.dataset.serviceId).toBeTruthy();

    const dragoverEvent = { preventDefault: () => {}, dataTransfer: fakeDataTransfer() };
    dropTargetBox.dispatch('dragover', dragoverEvent);
    expect(dragoverEvent.dataTransfer.dropEffect).toBe('move');

    const transfer = fakeDataTransfer({ 'text/plain': 'domain-payments' });
    dropTargetBox.dispatch('drop', { preventDefault: () => {}, dataTransfer: transfer });

    const dropTargetId = dropTargetBox.dataset.serviceId;
    const dropTargetService = state.architecture.services
      .find((service: any) => service.id === dropTargetId);
    expect(dropTargetService.domains).toContain('domain-payments');
  });

  it('drags a service card by its header, moving it and persisting on pointer up', () => {
    expect.hasAssertions();
    const { dom, saveState, canvas } = setup();
    canvas.renderArchitecture();

    const box = dom.architectureCanvas.children.find((node: any) => node.tagName === 'ARTICLE');
    const header = box.children[0];
    const originX = parseInt(String(box.style.left), 10);
    const originY = parseInt(String(box.style.top), 10);

    header.dispatch('pointerdown', { clientX: 100, clientY: 100 });
    fakeWindow.dispatch('pointermove', { clientX: 140, clientY: 70 });

    // Pointer-move repositions the card live, before the drag ends. This is
    // read from `box.style` rather than the model: `renderCanvas` re-derives
    // fresh service objects on every render, so the drag closure's own
    // service (captured mid-render) is a different instance from whatever
    // `state.architecture.services` holds by the time the assertion runs.
    expect(box.style.left).toBe(`${originX + 40}px`);
    expect(box.style.top).toBe(`${originY - 30}px`);

    fakeWindow.dispatch('pointerup', {});

    expect(saveState).toHaveBeenCalledWith();
    expect(fakeWindow.listenerCount('pointermove')).toBe(0);
  });

  it('selects a service by clicking its canvas card', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Card Target';
    dom.architectureAddServiceBtn.dispatch('click', {});
    canvas.renderArchitecture();

    const targetBox = dom.architectureCanvas.children.find(
      (node: any) => node.tagName === 'ARTICLE' && node.dataset.serviceId !== 'core'
    );
    targetBox.dispatch('click', { stopPropagation() {} });

    expect(state.selectedArchitectureServiceId).toBe(targetBox.dataset.serviceId);
  });

  it('exports the canvas as a PNG download without throwing', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();

    expect(() => dom.architectureExportImageBtn.dispatch('click', {})).not.toThrow();
  });

  it('creates a domain on Core via + Domain and hosts it in architecture', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = { domains: [], architecture: undefined };
    const saveState = jest.fn();
    let nextDomain = 1;
    const actions = {
      withPersist: (fn: () => void) => { fn(); saveState(); },
      saveState,
      createDomain: (name: string) => {
        const domain = {
          id: `domain-${nextDomain}`,
          name,
          color: '#336699',
          x: 120,
          y: 90,
          context: {},
          entities: []
        };
        nextDomain += 1;
        state.domains.push(domain);
        return domain;
      }
    };
    const canvas = createArchitectureCanvas({ dom, state, actions });
    canvas.renderArchitecture();
    // Core is auto-selected after normalize; create from the Service panel.
    expect(state.selectedArchitectureServiceId).toBeTruthy();

    dom.architectureInspectDomainNameInput.value = 'Billing';
    dom.architectureInspectAddDomainBtn.dispatch('click', {});

    expect(state.domains).toHaveLength(1);
    expect(state.domains[0].name).toBe('Billing');
    const core = state.architecture.services.find((service: any) => service.kind === 'core');
    expect(core.domains).toContain(state.domains[0].id);
    expect(saveState).toHaveBeenCalledWith();
  });

  it('creates a domain on the selected split-out service from the Service panel', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = { domains: createDomains(), architecture: undefined };
    let seq = 100;
    const actions = {
      withPersist: (fn: () => void) => fn(),
      saveState: jest.fn(),
      createDomain: (name: string) => {
        const domain = {
          id: `domain-new-${seq}`,
          name,
          color: '#112233',
          x: 10,
          y: 10,
          context: {},
          entities: []
        };
        seq += 1;
        state.domains.push(domain);
        return domain;
      }
    };
    const canvas = createArchitectureCanvas({ dom, state, actions });
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Payments API';
    dom.architectureAddServiceBtn.dispatch('click', {});
    canvas.renderArchitecture();
    const splitId = state.architecture.services.find((service: any) => service.kind === 'domain')?.id;
    expect(splitId).toBeTruthy();
    state.selectedArchitectureServiceId = splitId;

    dom.architectureInspectDomainNameInput.value = 'Checkout';
    dom.architectureInspectAddDomainBtn.dispatch('click', {});

    const checkout = state.domains.find((domain: any) => domain.name === 'Checkout');
    expect(checkout).toBeTruthy();
    const split = state.architecture.services.find((service: any) => service.id === splitId);
    expect(split.domains).toContain(checkout.id);
  });

  it('starts with the rail contracted and expands only via Panels / Hide', () => {
    expect.hasAssertions();
    const { dom } = setup();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(dom.architectureToggleSidebarBtn.textContent).toBe('Panels');

    dom.architectureToggleSidebarBtn.dispatch('click', {});
    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
    expect(dom.architectureToggleSidebarBtn.textContent).toBe('Hide');

    dom.architectureToggleSidebarBtn.dispatch('click', {});
    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(dom.architectureToggleSidebarBtn.textContent).toBe('Panels');

    (fakeWindow as any).innerWidth = 900;
    fakeWindow.dispatch('resize', {});
    (fakeWindow as any).flushTimers();
    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);

    dom.architectureToggleSidebarBtn.dispatch('click', {});
    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
  });
});

describe('createArchitectureCanvas — rail preference', () => {
  const savedDocument = (globalThis as any).document;
  const savedWindow = (globalThis as any).window;
  const savedLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => createFakeElement(tag),
      createElementNS: (_ns: string, tag: string) => createFakeElement(tag)
    };
    (globalThis as any).window = createFakeWindow(1400);
    (globalThis as any).localStorage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = String(value);
      }
    };
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
    (globalThis as any).localStorage = savedLocalStorage;
  });

  it('starts closed by default and reopens only when preference is stored open', () => {
    expect.hasAssertions();
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    const closedDom = createFullDom();
    createArchitectureCanvas({
      dom: closedDom,
      state: { domains: createDomains(), architecture: undefined },
      actions
    });
    expect(closedDom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(closedDom.architectureToggleSidebarBtn.textContent).toBe('Panels');

    (globalThis as any).localStorage.store['jumentix.architecture.railOpen'] = '1';
    const openDom = createFullDom();
    createArchitectureCanvas({
      dom: openDom,
      state: { domains: createDomains(), architecture: undefined },
      actions
    });
    expect(openDom.architectureSidebar.classList.contains('open')).toBe(true);
    expect(openDom.architectureToggleSidebarBtn.textContent).toBe('Hide');
  });
});

/* ------------------------------------------------------------------ *
 * Extended surface: rail / panel chrome, validation, connect mode,    *
 * domain creation, issue navigation and defensive model states.       *
 * ------------------------------------------------------------------ */

const RAIL_KEY = 'jumentix.architecture.railOpen';
const COACH_KEY = 'jumentix.architecture.coachDismissed';

const EXTRA_DOM_KEYS = [
  'architectureAddDomainBtn', 'architectureDomainNameInput', 'architectureDomainNameError',
  'architectureLinkProtocolPanel'
];

function createExtendedDom(): Record<string, any> {
  const dom = createFullDom();
  EXTRA_DOM_KEYS.forEach((key) => { dom[key] = createFakeElement('div'); });
  return dom;
}

function createStorage(seed: Record<string, string> = {}): any {
  return {
    store: { ...seed } as Record<string, string>,
    getItem(key: string) {
      return this.store[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.store[key] = String(value);
    }
  };
}

/** Installs fake `document` / `window` / `localStorage` and restores them (and the mocked seams) after each test. */
function withBrowser(): any {
  const ctx: any = {};
  const saved: any = {};
  beforeEach(() => {
    saved.document = (globalThis as any).document;
    saved.window = (globalThis as any).window;
    saved.localStorage = (globalThis as any).localStorage;
    ctx.window = createFakeWindow();
    ctx.storage = createStorage();
    ctx.document = {
      createElement: (tag: string) => createFakeElement(tag),
      createElementNS: (_ns: string, tag: string) => createFakeElement(tag)
    };
    (globalThis as any).document = ctx.document;
    (globalThis as any).window = ctx.window;
    (globalThis as any).localStorage = ctx.storage;
  });

  afterEach(() => {
    (globalThis as any).document = saved.document;
    (globalThis as any).window = saved.window;
    (globalThis as any).localStorage = saved.localStorage;
    architectureModelMock.normalizeArchitectureInput
      .mockImplementation(architectureModelActual.normalizeArchitectureInput);
    validationMock.collectArchitectureIssues
      .mockImplementation(validationActual.collectArchitectureIssues);
  });

  return ctx;
}

function createDomainAction(state: any) {
  let seq = 1;
  return (name: string) => {
    const domain = {
      id: `domain-new-${seq}`, name, color: '#336699', x: 10, y: 10, context: {}, entities: []
    };
    seq += 1;
    state.domains = [...(state.domains || []), domain];
    return domain;
  };
}

function mount(options: any = {}) {
  const dom = options.dom ?? createExtendedDom();
  const state: any = options.state ?? { domains: createDomains(), architecture: undefined };
  const saveState = jest.fn();
  const actions = options.actions ?? {
    withPersist: (fn: () => void) => { fn(); saveState(); },
    saveState,
    createDomain: createDomainAction(state)
  };
  const canvas = createArchitectureCanvas({
    dom, state, actions, chrome: options.chrome
  });
  return {
    dom, state, saveState, canvas
  };
}

function addService(dom: any, name: string) {
  dom.architectureServiceNameInput.value = name;
  dom.architectureAddServiceBtn.dispatch('click', {});
}

function cards(dom: any): any[] {
  return dom.architectureCanvas.children.filter((node: any) => node.tagName === 'ARTICLE');
}

function cardOf(dom: any, serviceId: string): any {
  return cards(dom).find((node: any) => node.dataset.serviceId === serviceId);
}

function serviceNamed(state: any, name: string): any {
  return state.architecture.services.find((service: any) => service.name === name);
}

function paletteRow(dom: any, domainId: string): any {
  return dom.architectureDomainPalette.children.find((item: any) => item.dataset.domainId === domainId);
}

function mountInShell(dom: any, stageWidth: number) {
  const stage = createFakeElement('div');
  stage.className = 'service-management-stage';
  stage.clientWidth = stageWidth;
  const shell = createFakeElement('div');
  shell.className = 'architecture-shell';
  stage.appendChild(shell);
  shell.appendChild(dom.architectureSidebar);
  return { stage, shell };
}

function installPanels(ctx: any) {
  const keys = ['services', 'domains', 'selected', 'links', 'validate'];
  const cells: Record<string, any> = {};
  const tabs: Record<string, any> = {};
  const bodies: Record<string, any> = {};
  keys.forEach((key) => {
    const cell = createFakeElement('section');
    const body = createFakeElement('div');
    bodies[key] = body;
    cell.querySelector = (selector: string) => (selector === '.sidebar-accordion-body' && key !== 'selected' ? body : null);
    cells[key] = cell;
    const tab = createFakeElement('button');
    tab.setAttribute('data-architecture-tab', key);
    tabs[key] = tab;
  });
  // Deliberately sparse: a panel with no cell, a cell with no dataset, a panel with no tab.
  delete cells.links;
  delete cells.validate.dataset;
  const stray = createFakeElement('button');
  const hidden = { ...tabs };
  delete (hidden as any).validate;
  ctx.document.querySelector = (selector: string) => {
    const match = /\[data-architecture-(group|tab)="([a-z]+)"\]/u.exec(selector);
    if (!match) return null;
    return (match[1] === 'group' ? cells : hidden)[match[2]] ?? null;
  };
  ctx.document.querySelectorAll = (selector: string) => (
    selector === '[data-architecture-tab]' ? [...Object.values(tabs), stray] : []
  );
  return {
    cells, tabs, bodies, stray
  };
}

describe('architectureLinkGeometry', () => {
  it('joins the facing edges at mid-height regardless of argument order', () => {
    expect.hasAssertions();
    const left = {
      x: 0, y: 50, width: 100, height: 200
    };
    const right = {
      x: 400, y: 100, width: 200, height: 100
    };
    const expected = {
      x1: 100, y1: 150, x2: 400, y2: 150
    };

    expect(architectureLinkGeometry(left, right)).toStrictEqual(expected);
    expect(architectureLinkGeometry(right, left)).toStrictEqual(expected);
  });
});

describe('createArchitectureCanvas — rail preference and stage width', () => {
  const ctx = withBrowser();

  it('persists open and closed as the user toggles Panels / Hide', () => {
    expect.hasAssertions();
    ctx.storage.store[RAIL_KEY] = '0';
    const { dom } = mount();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);

    dom.architectureToggleSidebarBtn.dispatch('click', {});

    expect(ctx.storage.store[RAIL_KEY]).toBe('1');
    expect(dom.architectureToggleSidebarBtn['attr:aria-expanded']).toBe('true');
    expect(dom.architectureToggleSidebarBtn.title).toBe('Hide panels');

    dom.architectureToggleSidebarBtn.dispatch('click', {});

    expect(ctx.storage.store[RAIL_KEY]).toBe('0');
    expect(dom.architectureToggleSidebarBtn['attr:aria-expanded']).toBe('false');
    expect(dom.architectureToggleSidebarBtn.title).toBe('Show panels (P)');
  });

  it('keeps toggling when browser storage refuses reads and writes', () => {
    expect.hasAssertions();
    ctx.storage.getItem = () => { throw new Error('denied'); };
    ctx.storage.setItem = () => { throw new Error('quota'); };
    const { dom } = mount();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(() => dom.architectureToggleSidebarBtn.dispatch('click', {})).not.toThrow();
    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
  });

  it('works when no localStorage exists at all', () => {
    expect.hasAssertions();
    (globalThis as any).localStorage = undefined;
    const { dom, canvas } = mount();

    canvas.renderArchitecture();
    dom.architectureToggleSidebarBtn.dispatch('click', {});

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
    expect(dom.architectureCoach.hidden).toBe(false);
  });

  it('closes an open rail on a narrow stage after resize but never reopens it', () => {
    expect.hasAssertions();
    ctx.storage.store[RAIL_KEY] = '1';
    const dom = createExtendedDom();
    const { stage, shell } = mountInShell(dom, 1400);
    mount({ dom });

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
    expect(shell.classList.contains('architecture-rail-open')).toBe(true);

    ctx.window.dispatch('resize', {});
    ctx.window.flushTimers();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);

    stage.clientWidth = 900;
    ctx.window.dispatch('resize', {});
    ctx.window.dispatch('resize', {});
    ctx.window.flushTimers();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(shell.classList.contains('architecture-rail-open')).toBe(false);
    expect(ctx.storage.store[RAIL_KEY]).toBe('1');

    stage.clientWidth = 1400;
    ctx.window.dispatch('resize', {});
    ctx.window.flushTimers();

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
  });

  it('measures a shell without a stage through its parent, then falls back to the viewport', () => {
    expect.hasAssertions();
    ctx.storage.store[RAIL_KEY] = '1';
    const narrowDom = createExtendedDom();
    const parent = createFakeElement('div');
    parent.clientWidth = 1000;
    const shell = createFakeElement('div');
    shell.className = 'architecture-shell';
    parent.appendChild(shell);
    shell.appendChild(narrowDom.architectureSidebar);
    mount({ dom: narrowDom });

    expect(narrowDom.architectureSidebar.classList.contains('open')).toBe(false);

    const widthlessDom = createExtendedDom();
    ctx.window.innerWidth = undefined;
    mount({ dom: widthlessDom });

    expect(widthlessDom.architectureSidebar.classList.contains('open')).toBe(true);

    const shellOnlyDom = createExtendedDom();
    const bareShell = createFakeElement('div');
    bareShell.className = 'architecture-shell';
    bareShell.clientWidth = 800;
    bareShell.appendChild(shellOnlyDom.architectureSidebar);
    mount({ dom: shellOnlyDom });

    expect(shellOnlyDom.architectureSidebar.classList.contains('open')).toBe(false);
  });
});

describe('createArchitectureCanvas — accordion panels', () => {
  const ctx = withBrowser();

  it('reveals one panel at a time, tolerating sparse markup and unknown keys', () => {
    expect.hasAssertions();
    const {
      cells, tabs, bodies, stray
    } = installPanels(ctx);
    const { dom, canvas } = mount();

    tabs.domains.dispatch('click', {});

    expect(cells.domains.hidden).toBe(false);
    expect(cells.domains.dataset.accordionExpanded).toBe('true');
    expect(cells.services.hidden).toBe(true);
    expect(cells.services.dataset.accordionExpanded).toBe('false');
    expect(bodies.domains.hidden).toBe(false);
    expect(bodies.services.hidden).toBe(true);
    expect(tabs.domains['attr:aria-selected']).toBe('true');
    expect(tabs.domains.classList.contains('active')).toBe(true);
    expect(tabs.services['attr:aria-selected']).toBe('false');
    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);

    canvas.revealArchitecturePanel('validate');

    expect(cells.validate.hidden).toBe(false);
    expect(cells.domains.hidden).toBe(true);

    canvas.revealArchitecturePanel('links');
    canvas.revealArchitecturePanel('selected');

    expect(cells.selected.hidden).toBe(false);

    canvas.revealArchitecturePanel('not-a-panel');
    stray.dispatch('click', {});

    expect(cells.selected.hidden).toBe(false);
    expect(cells.domains.hidden).toBe(true);
  });

  it('re-asserts the active panel when the rail is reopened with Panels', () => {
    expect.hasAssertions();
    const { cells, tabs } = installPanels(ctx);
    const { dom } = mount();

    tabs.domains.dispatch('click', {});
    dom.architectureToggleSidebarBtn.dispatch('click', {});

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);

    cells.domains.hidden = true;
    dom.architectureToggleSidebarBtn.dispatch('click', {});

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
    expect(cells.domains.hidden).toBe(false);
  });

  it('opens the Domains panel from the inspector Pull button', () => {
    expect.hasAssertions();
    const { cells } = installPanels(ctx);
    const { dom, canvas } = mount();
    canvas.renderArchitecture();

    dom.architectureOpenDomainsBtn.dispatch('click', {});

    expect(cells.domains.hidden).toBe(false);
    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
  });
});

describe('createArchitectureCanvas — onboarding chrome', () => {
  const ctx = withBrowser();

  it('shows the coach for a lone Core with domains, and remembers a dismissal', () => {
    expect.hasAssertions();
    const { dom, canvas } = mount();
    dom.architectureCoach.hidden = true;

    canvas.renderArchitecture();

    expect(dom.architectureCoach.hidden).toBe(false);

    dom.architectureCoachDismissBtn.dispatch('click', {});

    expect(dom.architectureCoach.hidden).toBe(true);
    expect(ctx.storage.store[COACH_KEY]).toBe('1');

    const reopened = mount();
    reopened.canvas.renderArchitecture();

    expect(reopened.dom.architectureCoach.hidden).toBe(true);
  });

  it('hides the coach once a second service exists', () => {
    expect.hasAssertions();
    const { dom, canvas } = mount();
    canvas.renderArchitecture();

    expect(dom.architectureCoach.hidden).toBe(false);

    addService(dom, 'Payments API');

    expect(dom.architectureCoach.hidden).toBe(true);
  });

  it('still hides the coach when the dismissal cannot be persisted', () => {
    expect.hasAssertions();
    ctx.storage.setItem = () => { throw new Error('quota'); };
    const { dom, canvas } = mount();
    canvas.renderArchitecture();

    expect(() => dom.architectureCoachDismissBtn.dispatch('click', {})).not.toThrow();
    expect(dom.architectureCoach.hidden).toBe(true);
  });

  it('treats unreadable storage as "not dismissed"', () => {
    expect.hasAssertions();
    ctx.storage.getItem = () => { throw new Error('denied'); };
    const { dom, canvas } = mount();
    canvas.renderArchitecture();

    expect(dom.architectureCoach.hidden).toBe(false);
  });

  it('leaves empty-state and coach writes to the tab when it owns them', () => {
    expect.hasAssertions();
    const dom = createExtendedDom();
    dom.architectureEmptyState.hidden = false;
    dom.architectureCoach.hidden = true;
    const { canvas } = mount({ dom, chrome: { ownEmptyState: true, ownCoach: true } });

    canvas.renderArchitecture();

    expect(dom.architectureEmptyState.hidden).toBe(false);
    expect(dom.architectureCoach.hidden).toBe(true);
    expect(dom.architectureCoachDismissBtn.listeners.get('click')).toBeUndefined();
  });

  it('reports a chrome snapshot for the tab-owned empty state and coach', () => {
    expect.hasAssertions();
    const empty = mount({ state: { domains: [], architecture: undefined } });
    const missing = mount({ state: { domains: undefined, architecture: undefined } });
    const lonely = mount();
    const busy = mount();
    addService(busy.dom, 'Payments API');
    const [core, payments] = busy.state.architecture.services;
    busy.state.architecture = architectureModelActual.addArchitectureLink(
      busy.state.architecture,
      { from: core.id, to: payments.id, protocol: 'rest' },
      busy.state.domains
    );

    expect(empty.canvas.chromeSnapshot()).toStrictEqual({
      empty: true, hasDomains: false, onlyCore: true, noLinks: true
    });
    expect(missing.canvas.chromeSnapshot().empty).toBe(true);
    expect(lonely.canvas.chromeSnapshot()).toStrictEqual({
      empty: false, hasDomains: true, onlyCore: true, noLinks: true
    });
    expect(busy.canvas.chromeSnapshot()).toStrictEqual({
      empty: false, hasDomains: true, onlyCore: false, noLinks: false
    });
  });
});

describe('createArchitectureCanvas — service and domain forms', () => {
  withBrowser();

  it('validates new service names inline and clears the error as the user types', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();

    addService(dom, 'A');

    expect(dom.architectureServiceNameError.textContent).toBe('Use at least 2 characters.');
    expect(dom.architectureServiceNameInput.focused).toBe(true);

    dom.architectureServiceNameInput.dispatch('input', {});

    expect(dom.architectureServiceNameError.hidden).toBe(true);

    addService(dom, 'x'.repeat(65));

    expect(dom.architectureServiceNameError.textContent).toBe('Keep the name under 64 characters.');
    expect(state.architecture.services).toHaveLength(1);
  });

  it('adds a service on Enter only', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Orders API';
    const prevent = jest.fn();

    dom.architectureServiceNameInput.dispatch('keydown', { key: 'a', preventDefault: prevent });

    expect(state.architecture.services).toHaveLength(1);

    dom.architectureServiceNameInput.dispatch('keydown', { key: 'Enter', preventDefault: prevent });

    expect(prevent).toHaveBeenCalledTimes(1);
    expect(state.architecture.services.map((service: any) => service.name)).toContain('Orders API');
  });

  it('creates a domain from the Domains panel on the selected service', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount({ state: { domains: [], architecture: undefined } });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Orders';

    dom.architectureAddDomainBtn.dispatch('click', {});

    const orders = state.domains.find((domain: any) => domain.name === 'Orders');
    expect(orders).toBeTruthy();
    expect(state.architecture.services[0].domains).toContain(orders.id);
    expect(dom.architectureDomainNameInput.value).toBe('');
  });

  it('creates a domain on Enter in the Domains panel and ignores other keys', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Shipping';

    dom.architectureDomainNameInput.dispatch('keydown', { key: 'x', preventDefault: () => {} });

    expect(state.domains).toHaveLength(2);

    dom.architectureDomainNameInput.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });

    expect(state.domains.map((domain: any) => domain.name)).toContain('Shipping');
  });

  it('rejects empty, short, long and duplicate domain names with specific messages', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    const attempt = (value: string) => {
      dom.architectureDomainNameInput.value = value;
      dom.architectureAddDomainBtn.dispatch('click', {});
      return dom.architectureDomainNameError.textContent;
    };

    expect(attempt('')).toBe('Domain name is required.');
    expect(dom.architectureDomainNameInput.focused).toBe(true);
    expect(attempt('Z')).toBe('Use at least 2 characters.');
    expect(attempt('y'.repeat(65))).toBe('Keep the name under 64 characters.');
    expect(attempt('billing')).toBe('Domain “billing” already exists.');
    expect(state.domains).toHaveLength(2);
  });

  it('surfaces a shell-side duplicate when createDomain refuses the name', () => {
    expect.hasAssertions();
    const state: any = { domains: createDomains(), architecture: undefined };
    const saveState = jest.fn();
    const { dom, canvas } = mount({
      state,
      actions: { withPersist: (fn: () => void) => fn(), saveState, createDomain: () => null }
    });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Fresh';

    dom.architectureAddDomainBtn.dispatch('click', {});

    expect(dom.architectureDomainNameError.textContent).toBe('Domain “Fresh” already exists.');
    expect(dom.architectureDomainNameInput.value).toBe('Fresh');
  });

  it('does nothing when the shell offers no createDomain action', () => {
    expect.hasAssertions();
    const state: any = { domains: createDomains(), architecture: undefined };
    const { dom, canvas } = mount({
      state,
      actions: { withPersist: (fn: () => void) => fn(), saveState: jest.fn() }
    });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Fresh';

    dom.architectureAddDomainBtn.dispatch('click', {});

    expect(state.domains).toHaveLength(2);
    expect(dom.architectureDomainNameError.hidden).toBe(false);
    expect(dom.architectureDomainNameInput.value).toBe('Fresh');
  });

  it('creates the first domain even when the shell started with no domain list', () => {
    expect.hasAssertions();
    const state: any = { domains: undefined, architecture: undefined };
    const { dom, canvas } = mount({ state });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Orders';

    dom.architectureAddDomainBtn.dispatch('click', {});

    expect(state.domains.map((domain: any) => domain.name)).toStrictEqual(['Orders']);
  });

  it('reports field errors without an error element and without an input element', () => {
    expect.hasAssertions();
    const dom = createExtendedDom();
    delete dom.architectureDomainNameError;
    const { canvas } = mount({ dom });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Q';

    expect(() => dom.architectureAddDomainBtn.dispatch('click', {})).not.toThrow();
    expect(dom.architectureDomainNameInput.classList.contains('is-invalid')).toBe(true);

    const bare = createExtendedDom();
    delete bare.architectureDomainNameInput;
    const second = mount({ dom: bare });
    second.canvas.renderArchitecture();

    expect(() => bare.architectureAddDomainBtn.dispatch('click', {})).not.toThrow();
    expect(bare.architectureDomainNameError.textContent).toBe('Domain name is required.');
  });

  it('asks for a service before creating a domain from the Service panel', () => {
    expect.hasAssertions();
    const { dom, state } = mount();
    dom.architectureInspectDomainNameInput.value = 'Orders';

    dom.architectureInspectAddDomainBtn.dispatch('click', {});

    expect(dom.architectureInspectDomainNameError.textContent).toBe('Select a service first.');
    expect(state.domains).toHaveLength(2);
  });

  it('creates a domain on Enter in the Service panel and clears its error while typing', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    dom.architectureInspectDomainNameInput.value = '';
    dom.architectureInspectAddDomainBtn.dispatch('click', {});

    expect(dom.architectureInspectDomainNameError.textContent).toBe('Domain name is required.');

    dom.architectureInspectDomainNameInput.dispatch('input', {});

    expect(dom.architectureInspectDomainNameError.hidden).toBe(true);

    dom.architectureInspectDomainNameInput.value = 'Ledger';
    dom.architectureInspectDomainNameInput.dispatch('keydown', { key: 'Tab', preventDefault: () => {} });

    expect(state.domains).toHaveLength(2);

    dom.architectureInspectDomainNameInput.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });

    expect(state.domains.map((domain: any) => domain.name)).toContain('Ledger');
  });
});

describe('createArchitectureCanvas — inspector autosave validation', () => {
  withBrowser();

  function selectedOf(state: any) {
    return state.architecture.services.find(
      (service: any) => service.id === state.selectedArchitectureServiceId
    );
  }

  it('rejects too-short and duplicate names, then accepts an unchanged own name', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    addService(dom, 'Payments API');
    state.selectedArchitectureServiceId = state.architecture.services[0].id;
    canvas.renderArchitecture();

    dom.architectureInspectName.value = 'P';
    dom.architectureInspectName.dispatch('change', {});

    expect(dom.architectureInspectNameError.textContent).toBe('Use at least 2 characters.');

    dom.architectureInspectName.value = 'x'.repeat(65);
    dom.architectureInspectName.dispatch('change', {});

    expect(dom.architectureInspectNameError.textContent).toBe('Keep the name under 64 characters.');

    dom.architectureInspectName.value = 'payments api';
    dom.architectureInspectName.dispatch('change', {});

    expect(dom.architectureInspectNameError.textContent).toBe('“payments api” already exists.');

    dom.architectureInspectName.value = selectedOf(state).name;
    dom.architectureInspectName.dispatch('change', {});

    expect(dom.architectureInspectNameError.hidden).toBe(true);
  });

  it('clears an invalid mark when the user edits and commits on Enter', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    dom.architectureInspectName.value = '';
    dom.architectureInspectName.dispatch('change', {});

    expect(dom.architectureInspectName.classList.contains('is-invalid')).toBe(true);

    dom.architectureInspectName.dispatch('input', {});

    expect(dom.architectureInspectName.classList.contains('is-invalid')).toBe(false);

    dom.architectureInspectName.dispatch('input', {});
    dom.architectureInspectName.value = 'Platform Core';
    dom.architectureInspectName.dispatch('keydown', { key: 'a', preventDefault: () => {} });

    expect(selectedOf(state).name).not.toBe('Platform Core');

    dom.architectureInspectName.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });

    expect(dom.architectureInspectName.blurred).toBe(true);
    expect(selectedOf(state).name).toBe('Platform Core');
  });

  it('accepts https URLs and rejects other schemes and malformed deploy ids', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();

    dom.architectureInspectUrl.value = 'ftp://files.example.com';
    dom.architectureInspectUrl.dispatch('change', {});

    expect(dom.architectureInspectUrlError.textContent).toBe('URL must start with http:// or https://.');

    dom.architectureInspectUrl.value = 'https://api.example.com/v1';
    dom.architectureInspectUrl.dispatch('change', {});

    expect(selectedOf(state).url).toBe('https://api.example.com/v1');
    expect(dom.architectureInspectUrlError.hidden).toBe(true);

    dom.architectureInspectDeploy.value = 'bad id!';
    dom.architectureInspectDeploy.dispatch('change', {});

    expect(dom.architectureInspectDeployError.textContent).toBe('Use letters, numbers, and . _ : - (max 64).');
    expect(selectedOf(state).deployTargetId || '').not.toBe('bad id!');
  });
});

describe('createArchitectureCanvas — deleting services', () => {
  const ctx = withBrowser();

  it('never deletes Core, even when the handler is reached', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();

    dom.architectureDeleteServiceBtn.dispatch('click', {});

    expect(state.architecture.services).toHaveLength(1);
    expect(state.architecture.services[0].kind).toBe('core');
  });

  it('keeps the service when the user declines the confirmation', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    addService(dom, 'Keep Me');
    jest.spyOn(ctx.window, 'confirm').mockImplementation(() => false);

    dom.architectureDeleteServiceBtn.dispatch('click', {});

    expect(ctx.window.confirm).toHaveBeenCalledWith(expect.stringContaining('Keep Me'));
    expect(state.architecture.services.map((service: any) => service.name)).toContain('Keep Me');
  });

  it('names an unknown selection by id in the confirmation and keeps everything on decline', () => {
    expect.hasAssertions();
    const { dom, state } = mount();
    state.selectedArchitectureServiceId = 'ghost-service';
    jest.spyOn(ctx.window, 'confirm').mockImplementation(() => false);

    dom.architectureDeleteServiceBtn.dispatch('click', {});

    expect(ctx.window.confirm).toHaveBeenCalledWith(expect.stringContaining('ghost-service'));
  });
});

describe('createArchitectureCanvas — connect mode', () => {
  const ctx = withBrowser();

  function twoServices() {
    const mounted = mount();
    mounted.canvas.renderArchitecture();
    addService(mounted.dom, 'Second Service');
    const [core, second] = mounted.state.architecture.services;
    return { ...mounted, core, second };
  }

  it('walks Step 1/2 and Step 2/2, then toggles off from the same button', () => {
    expect.hasAssertions();
    const { dom, core } = twoServices();

    dom.architectureConnectBtn.dispatch('click', {});

    expect(dom.architectureConnectBtn['attr:aria-pressed']).toBe('true');
    expect(dom.architectureConnectBtn.textContent).toBe('Connecting…');
    expect(dom.architectureCancelConnectBtn.hidden).toBe(false);
    expect(dom.architectureCanvas.classList.contains('is-connecting')).toBe(true);
    expect(dom.architectureConnectStatus.textContent).toBe('Step 1/2: click the source service card.');

    cardOf(dom, core.id).dispatch('click', {});

    expect(dom.architectureConnectStatus.textContent).toContain('Step 2/2');
    expect(dom.architectureConnectStatus.textContent).toContain('from “Core”');

    cardOf(dom, core.id).dispatch('click', {});

    expect(dom.architectureConnectStatus.textContent).toBe('Pick a different service as the target.');

    dom.architectureConnectBtn.dispatch('click', {});

    expect(dom.architectureConnectBtn.textContent).toBe('Connect');
    expect(dom.architectureCancelConnectBtn.hidden).toBe(true);
    expect(dom.architectureConnectStatus.textContent).toBe(
      'Tip: Connect → click source card → click target. Esc cancels.'
    );
  });

  it('cancels from the Cancel button and from Escape only while connecting', () => {
    expect.hasAssertions();
    const { dom } = twoServices();
    const prevent = jest.fn();

    dom.architectureConnectBtn.dispatch('click', {});
    dom.architectureCancelConnectBtn.dispatch('click', {});

    expect(dom.architectureConnectBtn.textContent).toBe('Connect');

    ctx.window.dispatch('keydown', { key: 'Escape', preventDefault: prevent });

    expect(prevent).not.toHaveBeenCalled();

    dom.architectureConnectBtn.dispatch('click', {});
    ctx.window.dispatch('keydown', { key: 'a', preventDefault: prevent });

    expect(dom.architectureConnectBtn.textContent).toBe('Connecting…');

    ctx.window.dispatch('keydown', { key: 'Escape', preventDefault: prevent });

    expect(prevent).toHaveBeenCalledTimes(1);
    expect(dom.architectureConnectBtn.textContent).toBe('Connect');
  });

  it('does not start a card drag while connecting, and ignores non-primary buttons', () => {
    expect.hasAssertions();
    const { dom, core } = twoServices();
    const header = cardOf(dom, core.id).children[0];

    header.dispatch('pointerdown', { clientX: 1, clientY: 1, button: 2 });

    expect(ctx.window.listenerCount('pointermove')).toBe(0);

    header.dispatch('pointerdown', { clientX: 1, clientY: 1, button: 0 });

    expect(ctx.window.listenerCount('pointermove')).toBe(1);
    ctx.window.dispatch('pointerup', {});

    dom.architectureConnectBtn.dispatch('click', {});
    cardOf(dom, core.id).children[0].dispatch('pointerdown', { clientX: 1, clientY: 1, button: 0 });

    expect(ctx.window.listenerCount('pointermove')).toBe(0);
  });

  it('keeps the two protocol selects in step and falls back to rest for unknown values', () => {
    expect.hasAssertions();
    const { dom, core, second } = twoServices();

    dom.architectureLinkProtocol.value = 'grpc';
    dom.architectureLinkProtocol.dispatch('change', {});

    expect(dom.architectureLinkProtocolPanel.value).toBe('grpc');

    dom.architectureLinkProtocolPanel.value = 'message';
    dom.architectureLinkProtocolPanel.dispatch('change', {});

    expect(dom.architectureLinkProtocol.value).toBe('message');

    dom.architectureLinkProtocol.value = 'carrier-pigeon';
    dom.architectureLinkProtocolPanel.value = 'carrier-pigeon';
    dom.architectureConnectBtn.dispatch('click', {});
    cardOf(dom, core.id).dispatch('click', {});

    expect(dom.architectureConnectStatus.textContent).toContain('Protocol = rest');

    cardOf(dom, second.id).dispatch('click', {});

    expect(dom.architectureLinkList.children[0].children[1].textContent).toBe('rest');
  });

  it('reads the protocol from the panel select when the toolbar select is absent', () => {
    expect.hasAssertions();
    const dom = createExtendedDom();
    delete dom.architectureLinkProtocol;
    const mounted = mount({ dom });
    mounted.canvas.renderArchitecture();
    addService(dom, 'Second Service');
    dom.architectureLinkProtocolPanel.value = 'websocket';
    dom.architectureLinkProtocolPanel.dispatch('change', {});
    const [core, second] = mounted.state.architecture.services;

    dom.architectureConnectBtn.dispatch('click', {});
    cardOf(dom, core.id).dispatch('click', {});
    cardOf(dom, second.id).dispatch('click', {});

    expect(mounted.state.architecture.links[0].protocol).toBe('websocket');
  });

  it('starts connecting from the Links panel, which also closes the rail', () => {
    expect.hasAssertions();
    const { dom, canvas, second } = twoServices();
    canvas.setArchitectureSidebarOpen(true);

    dom.architectureLinksConnectBtn.dispatch('click', {});

    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);
    expect(dom.architectureConnectBtn.textContent).toBe('Connecting…');

    // A re-render while connecting shows the live state in the Links panel.
    const transfer = fakeDataTransfer({ 'text/plain': 'domain-billing' });
    cardOf(dom, second.id).dispatch('drop', { preventDefault: () => {}, dataTransfer: transfer });

    expect(dom.architectureLinksConnectBtn.textContent).toBe('Connecting…');
    expect(dom.architectureLinksConnectBtn['attr:aria-pressed']).toBe('true');
  });

  it('shows the raw service id in Step 2/2 when the source service disappears', () => {
    expect.hasAssertions();
    const { dom, state, second } = twoServices();
    ctx.window.confirm = () => true;

    dom.architectureConnectBtn.dispatch('click', {});
    cardOf(dom, second.id).dispatch('click', {});
    state.selectedArchitectureServiceId = second.id;
    dom.architectureDeleteServiceBtn.dispatch('click', {});

    expect(state.architecture.services).toHaveLength(1);
    expect(dom.architectureConnectStatus.textContent).toContain(`from “${second.id}”`);
  });
});

describe('createArchitectureCanvas — links on the canvas and in the list', () => {
  const ctx = withBrowser();

  function linked() {
    const mounted = mount();
    mounted.canvas.renderArchitecture();
    addService(mounted.dom, 'Payments Settlement Service');
    addService(mounted.dom, 'Notifications');
    const { services } = mounted.state.architecture;
    let { architecture } = mounted.state;
    architecture = architectureModelActual.addArchitectureLink(architecture, { from: services[0].id, to: services[1].id, protocol: 'rest' }, mounted.state.domains);
    mounted.state.architecture = architecture;
    mounted.canvas.renderArchitecture();
    return { ...mounted, services };
  }

  function linkGroups(dom: any): any[] {
    const svg = dom.architectureCanvas.children.find((node: any) => node.tagName === 'SVG');
    return svg.children;
  }

  it('pluralises connection counts and truncates long service names in the list', () => {
    expect.hasAssertions();
    const {
      dom, state, services, canvas
    } = linked();

    expect(dom.architectureLinksHint.textContent).toBe('1 connection · Remove here');
    expect(dom.architectureLinkList.children[0].children[0].children[0].textContent)
      .toBe('Core → Payments Settleme…');

    state.architecture = architectureModelActual.addArchitectureLink(state.architecture, { from: services[0].id, to: services[2].id, protocol: 'grpc' }, state.domains);
    canvas.renderArchitecture();

    expect(dom.architectureLinksHint.textContent).toBe('2 connections · Remove here');
  });

  it('removes a link from its canvas hit-target only after confirmation', () => {
    expect.hasAssertions();
    const { dom, state } = linked();
    const [group] = linkGroups(dom);
    jest.spyOn(ctx.window, 'confirm').mockImplementation(() => false);

    group.children[0].dispatch('click', { stopPropagation() {} });

    expect(ctx.window.confirm).toHaveBeenCalledWith(expect.stringContaining('Core —rest→ Payments Settlement Service'));
    expect(state.architecture.links).toHaveLength(1);

    jest.spyOn(ctx.window, 'confirm').mockImplementation(() => true);
    linkGroups(dom)[0].children[0].dispatch('click', {});

    expect(state.architecture.links).toHaveLength(0);
  });

  it('draws a labelled line for the link at the facing edges of both cards', () => {
    expect.hasAssertions();
    const { dom } = linked();
    const [group] = linkGroups(dom);

    expect(group.dataset.protocol).toBe('rest');
    expect(group.children[2].textContent).toBe('rest');
    expect(group.children[1]['attr:stroke']).toBe('currentColor');
  });
});

describe('createArchitectureCanvas — domains moving between services', () => {
  withBrowser();

  function usersOnSplit() {
    const state: any = {
      domains: [{ id: 'domain-users', name: 'Users' }, { id: 'domain-billing', name: 'Billing' }],
      architecture: undefined
    };
    const mounted = mount({ state });
    mounted.canvas.renderArchitecture();
    addService(mounted.dom, 'Payments API');
    return mounted;
  }

  it('moves a domain onto the selected service, then back to Core from the service list', () => {
    expect.hasAssertions();
    const { dom, state } = usersOnSplit();

    paletteRow(dom, 'domain-billing').children[1].click();

    expect(serviceNamed(state, 'Payments API').domains).toStrictEqual(['domain-billing']);
    expect(dom.architectureScopePath.textContent).toBe('Payments API · Split-out · 1 domain');
    expect(dom.architectureInspectHint.textContent).toBe('Split-out · 1 domain');
    expect(dom.architectureMoveDomainHint.textContent).toBe(
      '1 domain live elsewhere — Pull from Domains or drag onto this card.'
    );

    const row = dom.architectureServiceDomains.children[0];
    expect(row.children[0].children[0].textContent).toBe('Billing');
    expect(row.children[1].hidden).toBe(false);
    row.children[1].click();

    expect(state.architecture.services.find((service: any) => service.kind === 'core').domains)
      .toContain('domain-billing');
    expect(serviceNamed(state, 'Payments API').domains).toHaveLength(0);
  });

  it('hides "To Core" on the Core service and leaves palette rows inert when already hosted', () => {
    expect.hasAssertions();
    const { dom, state } = usersOnSplit();
    const core = state.architecture.services.find((service: any) => service.kind === 'core');
    state.selectedArchitectureServiceId = core.id;
    dom.architectureServiceList.children[0].children[0].dispatch('click', {});

    const row = dom.architectureServiceDomains.children[0];
    expect(row.children[1].hidden).toBe(true);
    expect(row.children[1].disabled).toBe(true);

    const hosted = paletteRow(dom, 'domain-billing');
    expect(hosted.children[1].textContent).toBe('Here');
    expect(hosted.children[1].disabled).toBe(true);

    hosted.dispatch('click', { target: hosted.children[0] });

    expect(serviceNamed(state, 'Core').domains).toContain('domain-billing');
  });

  it('moves a domain once when a row click lands on the row body, not twice via the button', () => {
    expect.hasAssertions();
    const { dom, state } = usersOnSplit();
    const row = paletteRow(dom, 'domain-billing');
    const action = row.children[1];
    const moves = jest.spyOn(action, 'click');

    row.dispatch('click', { target: action });

    expect(moves).not.toHaveBeenCalled();
    expect(serviceNamed(state, 'Payments API').domains).toHaveLength(0);

    row.dispatch('click', { target: row.children[0] });

    expect(moves).toHaveBeenCalledTimes(1);
    expect(serviceNamed(state, 'Payments API').domains).toStrictEqual(['domain-billing']);
  });

  it('shows a dragover highlight that dragleave removes', () => {
    expect.hasAssertions();
    const { dom, state } = usersOnSplit();
    const box = cardOf(dom, serviceNamed(state, 'Payments API').id);

    box.dispatch('dragover', { preventDefault: () => {}, dataTransfer: fakeDataTransfer() });

    expect(box.classList.contains('is-drop-target')).toBe(true);

    box.dispatch('dragleave', {});

    expect(box.classList.contains('is-drop-target')).toBe(false);
  });

  it('flags the Users domain leaving Core as an error and jumps to its host service', () => {
    expect.hasAssertions();
    const { dom, state } = usersOnSplit();
    const core = state.architecture.services.find((service: any) => service.kind === 'core');

    paletteRow(dom, 'domain-users').children[1].click();
    dom.architectureServiceList.children[0].children[0].dispatch('click', {});

    expect(state.selectedArchitectureServiceId).toBe(core.id);
    expect(dom.architectureValidateHint.textContent).toBe('1 error · 0 warnings · click to jump');
    expect(dom.architectureTabValidateContext.dataset.severity).toBe('error');
    expect(dom.architectureTabValidateContext.textContent).toBe('1');

    const issueRow = dom.architectureIssueList.children[0];
    expect(issueRow.children[0].children[1].textContent).toBe('The Core service must contain the Users domain.');

    issueRow.children[1].dispatch('click', {});

    expect(state.selectedArchitectureServiceId).toBe(serviceNamed(state, 'Payments API').id);
  });

  it('abbreviates a long selected-service name in the tab badge but keeps it in the title', () => {
    expect.hasAssertions();
    const { dom } = usersOnSplit();
    addService(dom, 'Customer Relations Service');

    expect(dom.architectureTabSelectedContext.textContent).toBe('Customer …');
    expect(dom.architectureTabSelectedContext.title).toBe('Customer Relations Service');
  });
});

describe('createArchitectureCanvas — issue list and navigation', () => {
  withBrowser();

  it('orders issues by severity (unknown last) and jumps to service ids but ignores unknown ids', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    addService(dom, 'Payments API');
    const payments = serviceNamed(state, 'Payments API');
    const core = state.architecture.services.find((service: any) => service.kind === 'core');
    validationMock.collectArchitectureIssues.mockImplementation(() => [
      { message: 'odd', entityId: null, severity: 'bogus' },
      { message: 'service issue', entityId: payments.id, severity: 'warn' },
      { message: 'ghost issue', entityId: 'nothing-here', severity: 'error' },
      { message: 'second warn', entityId: null, severity: 'warn' },
      { message: 'odd too', entityId: null, severity: 'strange' }
    ]);
    canvas.renderArchitecture();

    const titles = dom.architectureIssueList.children
      .map((row: any) => row.children[0].children[1].textContent);
    expect(titles.slice(0, 3)).toStrictEqual(['ghost issue', 'service issue', 'second warn']);
    expect(titles.slice(3).sort()).toStrictEqual(['odd', 'odd too']);
    expect(dom.architectureValidateHint.textContent).toBe('1 error · 2 warnings · click to jump');

    state.selectedArchitectureServiceId = core.id;
    dom.architectureIssueList.children[0].children[1].dispatch('click', {});

    expect(state.selectedArchitectureServiceId).toBe(core.id);

    dom.architectureIssueList.children[1].children[1].dispatch('click', {});

    expect(state.selectedArchitectureServiceId).toBe(payments.id);
    expect(dom.architectureIssueList.children[3].children).toHaveLength(1);
  });

  it('badges the validate tab "warn" for warnings only and "ok" when nothing is reported', () => {
    expect.hasAssertions();
    const { dom, canvas } = mount();
    canvas.renderArchitecture();

    expect(dom.architectureTabValidateContext.dataset.severity).toBe('warn');

    validationMock.collectArchitectureIssues.mockImplementation(() => []);
    canvas.renderArchitecture();

    expect(dom.architectureTabValidateContext.dataset.severity).toBe('ok');
    expect(dom.architectureValidateHint.textContent).toBe('Clean — no architecture issues');
  });
});

describe('createArchitectureCanvas — states the normaliser never produces', () => {
  const ctx = withBrowser();

  const ghostArchitecture = () => ({
    services: [{
      id: 'core',
      name: 'Core',
      kind: 'core',
      url: 'http://localhost:3000/api',
      x: 40,
      y: 40,
      width: 260,
      height: 180,
      domains: ['ghost-domain'],
      deployTargetId: ''
    }],
    links: [
      {
        id: 'link-dangling', from: 'core', to: 'vanished-service', protocol: 'rest'
      },
      {
        id: 'link-inbound', from: 'lost-service', to: 'core', protocol: 'grpc'
      }
    ]
  });

  it('shows raw ids for domains and services that no longer resolve, and draws no dangling link', () => {
    expect.hasAssertions();
    const { cells } = installPanels(ctx);
    architectureModelMock.normalizeArchitectureInput.mockImplementation(ghostArchitecture);
    const state: any = { domains: [{ id: 'domain-orphan', name: 'Orphan' }], architecture: undefined };
    const { dom, canvas } = mount({ state });

    canvas.renderArchitecture();

    const orphanRow = paletteRow(dom, 'domain-orphan');
    expect(orphanRow.children[0].children[1].textContent).toBe('unassigned');
    expect(orphanRow.children[1].textContent).toBe('Drag');
    expect(orphanRow.children[1].disabled).toBe(true);
    expect(orphanRow.title).toBe('Drag “Orphan” onto another service card');

    const chips = cardOf(dom, 'core').children.find((node: any) => node.className === 'architecture-domain-chips');
    expect(chips.children[0].textContent).toBe('ghost-domain');
    expect(chips.children[0].title).toBe('Drag to another service to move “ghost-domain”');
    expect(dom.architectureServiceDomains.children[0].children[1]['attr:aria-label'])
      .toBe('Move domain ghost-domain to Core');

    const svg = dom.architectureCanvas.children.find((node: any) => node.tagName === 'SVG');
    expect(svg.children).toHaveLength(0);
    expect(dom.architectureLinkList.children[0].children[0].children[0].textContent).toBe('Core → vanished-service');
    expect(dom.architectureLinkList.children[1].children[0].children[0].textContent).toBe('lost-service → Core');

    const issue = dom.architectureIssueList.children
      .find((row: any) => row.children[0].children[1].textContent.includes('Orphan'));
    issue.children[1].dispatch('click', {});

    expect(cells.domains.hidden).toBe(false);
  });

  it('labels ghost domains by id even when the shell has no domain list at all', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(ghostArchitecture);
    const { dom, canvas } = mount({ state: { domains: undefined, architecture: undefined } });

    canvas.renderArchitecture();

    expect(dom.architectureServiceDomains.children[0].children[0].children[0].textContent).toBe('ghost-domain');
  });

  it('exports an inventory that names ghost domains, empty services and links', () => {
    expect.hasAssertions();
    const written: string[] = [];
    const downloads: any[] = [];
    ctx.document.createElement = (tag: string) => {
      const el = createFakeElement(tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          fillStyle: '', font: '', fillRect: () => {}, fillText: (text: string) => { written.push(text); }
        });
      }
      if (tag === 'a') downloads.push(el);
      return el;
    };
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    addService(dom, 'Empty Split');
    const [core, empty] = state.architecture.services;
    state.architecture = architectureModelActual.addArchitectureLink(state.architecture, { from: core.id, to: empty.id, protocol: 'rest' }, state.domains);
    canvas.renderArchitecture();

    dom.architectureExportImageBtn.dispatch('click', {});

    expect(written).toContain('Core (core) — Billing, Payments');
    expect(written).toContain('Empty Split (domain) — no domains');
    expect(written).toContain('Core —rest→ Empty Split');
    expect(downloads[0].download).toBe('architecture-inventory.png');
    expect(downloads[0].href).toBe('data:image/png;base64,fake');
  });

  it('exports ghost domain ids when a service lists a domain the shell does not know', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(ghostArchitecture);
    const written: string[] = [];
    const originalCreate = ctx.document.createElement;
    ctx.document.createElement = (tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          fillStyle: '', font: '', fillRect: () => {}, fillText: (text: string) => { written.push(text); }
        });
      }
      return el;
    };
    const { dom } = mount();

    dom.architectureExportImageBtn.dispatch('click', {});

    expect(written).toContain('Core (core) — ghost-domain');
    expect(written).toContain('Core —rest→ vanished-service');
    expect(written).toContain('lost-service —grpc→ Core');
  });

  it('renders calm empty prompts when the architecture has no services at all', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(() => ({ services: [], links: [] }));
    const state: any = { domains: createDomains(), architecture: undefined };
    const { dom, canvas } = mount({ state });

    canvas.renderArchitecture();

    expect(state.selectedArchitectureServiceId).toBeUndefined();
    expect(dom.architectureScopePath.textContent).toBe('Nothing selected — click a card');
    expect(dom.architectureInspectEmpty.hidden).toBe(false);
    expect(dom.architectureInspectBody.hidden).toBe(true);
    expect(dom.architectureInspectHint.textContent).toBe('Select a service on the canvas');
    expect(dom.architectureMoveDomainHint.hidden).toBe(true);
    expect(dom.architectureOpenDomainsBtn.hidden).toBe(true);
    expect(dom.architectureDeleteServiceBtn.hidden).toBe(true);
    expect(dom.architectureDeleteServiceBtn.disabled).toBe(true);
    expect(dom.architectureServiceList.children[0].className).toContain('architecture-service-empty');
    expect(dom.architectureTabSelectedContext.textContent).toBe('—');
    expect(dom.architectureTabSelectedContext.title).toBe('No service selected');
    expect(dom.architectureDomainsHint.textContent).toBe('Select a service to enable Move · or drag onto a card');
  });

  it('creates a domain without hosting it when there is no service to host it', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(() => ({ services: [], links: [] }));
    const state: any = { domains: [], architecture: undefined };
    const { dom, canvas } = mount({ state });
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Orders';

    dom.architectureAddDomainBtn.dispatch('click', {});

    expect(state.domains.map((domain: any) => domain.name)).toStrictEqual(['Orders']);
    expect(state.selectedArchitectureServiceId).toBeUndefined();
  });

  it('falls back to the first service when the selected id no longer exists', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    state.selectedArchitectureServiceId = 'removed-service';

    canvas.renderArchitecture();

    expect(state.selectedArchitectureServiceId).toBe(state.architecture.services[0].id);
    expect(dom.architectureScopePath.textContent).toContain('Core · Core');
  });
});

describe('createArchitectureCanvas — optional chrome is optional', () => {
  withBrowser();

  it('renders lists and canvas when hints, badges and toolbar buttons are all absent', () => {
    expect.hasAssertions();
    const dom = createExtendedDom();
    [
      'architectureServicesHint', 'architectureLinksHint', 'architectureLinksConnectBtn',
      'architectureValidateHint', 'architectureDomainsHint', 'architectureInspectHint',
      'architectureInspectKindBadge', 'architectureInspectName', 'architectureInspectUrl',
      'architectureInspectDeploy', 'architectureMoveDomainHint', 'architectureOpenDomainsBtn',
      'architectureDeleteServiceBtn', 'architectureConnectBtn', 'architectureCancelConnectBtn',
      'architectureConnectStatus', 'architectureScopePath', 'architectureSidebar',
      'architectureToggleSidebarBtn', 'architectureExportImageBtn', 'architectureLinkProtocol',
      'architectureLinkProtocolPanel', 'architectureTabServicesContext', 'architectureTabDomainsContext',
      'architectureTabSelectedContext', 'architectureTabLinksContext', 'architectureTabValidateContext',
      'architectureServiceDomains', 'architectureInspectEmpty', 'architectureInspectBody',
      'architectureCoach', 'architectureCoachDismissBtn', 'architectureEmptyState'
    ].forEach((key) => { delete dom[key]; });
    const { canvas } = mount({ dom });

    expect(() => canvas.renderArchitecture()).not.toThrow();
    expect(dom.architectureServiceList.children).toHaveLength(1);
    expect(dom.architectureIssueList.children.length).toBeGreaterThan(0);
    expect(dom.architectureLinkList.children[0].className).toContain('architecture-link-empty');
    expect(cards(dom)).toHaveLength(1);
  });

  it('skips inspector chrome that is absent when nothing is selected', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(() => ({ services: [], links: [] }));
    const dom = createExtendedDom();
    [
      'architectureInspectHint', 'architectureMoveDomainHint', 'architectureOpenDomainsBtn',
      'architectureDeleteServiceBtn'
    ].forEach((key) => { delete dom[key]; });
    const { canvas } = mount({ dom });

    expect(() => canvas.renderArchitecture()).not.toThrow();
    expect(dom.architectureInspectBody.hidden).toBe(true);
  });

  it('wires and renders without a window object', () => {
    expect.hasAssertions();
    (globalThis as any).window = undefined;
    const { dom, canvas } = mount();

    expect(() => canvas.renderArchitecture()).not.toThrow();
    expect(cards(dom)).toHaveLength(1);
  });

  it('refuses a Service-panel domain with no name input element present', () => {
    expect.hasAssertions();
    const dom = createExtendedDom();
    delete dom.architectureInspectDomainNameInput;
    delete dom.architectureInspectDomainNameError;
    const { state, canvas } = mount({ dom });
    canvas.renderArchitecture();

    expect(() => dom.architectureInspectAddDomainBtn.dispatch('click', {})).not.toThrow();
    expect(state.domains).toHaveLength(2);
  });

  it('opens the Domains panel on request when there is no document query API', () => {
    expect.hasAssertions();
    const { dom, canvas } = mount();

    canvas.revealArchitecturePanel('domains');

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
  });
});

describe('createArchitectureCanvas — model drift between render and click', () => {
  withBrowser();

  const emptyModel = () => ({ services: [], links: [] });

  const splitOnly = () => ({
    services: [{
      id: 'split-only',
      name: 'Split Only',
      kind: 'domain',
      url: 'http://localhost:3001/api',
      x: 40,
      y: 40,
      width: 260,
      height: 180,
      domains: ['ghost-domain'],
      deployTargetId: ''
    }],
    links: []
  });

  it('sends a domain back to the first service when the model has no Core service', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(splitOnly);
    const { dom, saveState, canvas } = mount({ state: { domains: [], architecture: undefined } });
    canvas.renderArchitecture();
    saveState.mockClear();

    dom.architectureServiceDomains.children[0].children[1].dispatch('click', {});

    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the model lost every service before "To Core" is clicked', () => {
    expect.hasAssertions();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(splitOnly);
    const { dom, saveState, canvas } = mount({ state: { domains: [], architecture: undefined } });
    canvas.renderArchitecture();
    saveState.mockClear();
    architectureModelMock.normalizeArchitectureInput.mockImplementation(emptyModel);

    dom.architectureServiceDomains.children[0].children[1].dispatch('click', {});

    expect(saveState).not.toHaveBeenCalled();
  });

  it('hosts a new domain on Core when the first selection lookup finds no service', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    dom.architectureDomainNameInput.value = 'Orders';
    architectureModelMock.normalizeArchitectureInput
      .mockImplementationOnce(emptyModel);

    dom.architectureAddDomainBtn.dispatch('click', {});

    const core = state.architecture.services.find((service: any) => service.kind === 'core');
    const orders = state.domains.find((domain: any) => domain.name === 'Orders');
    expect(core.domains).toContain(orders.id);
  });

  it('keeps the previous selection when a freshly added service vanishes from the model', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = mount();
    canvas.renderArchitecture();
    const before = state.selectedArchitectureServiceId;
    architectureModelMock.normalizeArchitectureInput.mockImplementation(emptyModel);

    addService(dom, 'Vanishing Split');

    expect(state.selectedArchitectureServiceId).toBe(before);
  });

  it('renders the inspector without a document object, overwriting inputs unconditionally', () => {
    expect.hasAssertions();
    const full = createExtendedDom();
    const dom: Record<string, any> = {};
    [
      'architectureInspectBody', 'architectureInspectEmpty', 'architectureInspectName',
      'architectureInspectUrl', 'architectureInspectDeploy'
    ].forEach((key) => { dom[key] = full[key]; });
    const { state, canvas } = mount({ dom });
    (globalThis as any).document = undefined;

    canvas.renderArchitecture();

    expect(dom.architectureInspectName.value).toBe(state.architecture.services[0].name);
  });
});
