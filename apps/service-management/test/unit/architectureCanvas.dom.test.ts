/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
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

import { architectureLinkLabel, createArchitectureCanvas } from '../../src/ui/architectureCanvas.js';

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
