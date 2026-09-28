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

function createFakeWindow() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  return {
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
  'architectureEmptyState', 'architectureServiceNameInput', 'architectureAddServiceBtn',
  'architectureServiceList', 'architectureDomainPalette', 'architectureInspectName',
  'architectureInspectKind', 'architectureInspectUrl', 'architectureInspectDeploy',
  'architectureInspectDomain', 'architectureMoveDomainBtn', 'architectureSaveServiceBtn',
  'architectureDeleteServiceBtn', 'architectureLinkFrom', 'architectureLinkTo',
  'architectureLinkProtocol', 'architectureAddLinkBtn', 'architectureLinkList',
  'architectureIssueList', 'architectureCanvas', 'architectureMiniMap',
  'architectureExportImageBtn'
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
    expect(dom.architectureDomainPalette.children[0].textContent).toBe('Billing');
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
    expect(newButton.textContent).toBe('Payments API (domain)');
    expect(dom.architectureServiceNameInput.value).toBe('');

    newButton.dispatch('click', {});

    // Selecting a service re-renders the list from scratch, so the live
    // "active" class lands on the freshly built buttons, not the stale ones.
    const [rerenderedCore, rerenderedNew] = dom.architectureServiceList.children
      .map((item: any) => item.children[0]);
    expect(rerenderedNew.className).toBe('active');
    expect(rerenderedCore.className).toBe('');
  });

  it('falls back to a default service name when the name input is blank', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = '';

    dom.architectureAddServiceBtn.dispatch('click', {});

    const labels = dom.architectureServiceList.children
      .map((item: any) => item.children[0].textContent);
    expect(labels).toContain('Service (domain)');
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
      .map((item: any) => item.children[0].textContent);
    expect(labels).toContain('Service (domain)');
  });

  it('ignores a save click before any service is selected', () => {
    expect.hasAssertions();
    const { dom, state } = setup();
    dom.architectureInspectName.value = 'Should not apply';

    // No render has run yet, so `state.selectedArchitectureServiceId` matches
    // no service: the handler's own `architecture()` lookup still normalizes
    // `state.architecture` as a side effect, but the guard must stop it short
    // of writing the inspector's values onto any service.
    dom.architectureSaveServiceBtn.dispatch('click', {});

    expect(state.architecture.services.map((service: any) => service.name)).not.toContain('Should not apply');
  });

  it('falls back to the id when a fillSelect item has no name', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = {
      domains: [{ id: 'domain-unnamed' }],
      architecture: undefined
    };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    createArchitectureCanvas({ dom, state, actions }).renderArchitecture();

    const options = dom.architectureInspectDomain.children;
    expect(options[0].value).toBe('domain-unnamed');
    expect(options[0].textContent).toBe('domain-unnamed');
  });

  it('tolerates an undefined domains list throughout render', () => {
    expect.hasAssertions();
    const dom = createFullDom();
    const state: any = { domains: undefined, architecture: undefined };
    const actions = { withPersist: (fn: () => void) => fn(), saveState: jest.fn() };

    const canvas = createArchitectureCanvas({ dom, state, actions });
    expect(() => canvas.renderArchitecture()).not.toThrow();
    expect(dom.architectureDomainPalette.children).toHaveLength(0);
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

  it('edits and saves the selected service through the inspector, both kind branches', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();

    dom.architectureInspectName.value = 'Renamed Core';
    dom.architectureInspectKind.value = 'core';
    dom.architectureInspectUrl.value = 'http://localhost:9000/api/1.0.0';
    dom.architectureInspectDeploy.value = 'deploy-1';
    dom.architectureSaveServiceBtn.dispatch('click', {});

    let selected = state.architecture.services.find(
      (service: any) => service.id === state.selectedArchitectureServiceId
    );
    expect(selected.name).toBe('Renamed Core');
    expect(selected.kind).toBe('core');
    expect(selected.deployTargetId).toBe('deploy-1');

    // Blank inputs fall back to the existing value instead of erasing it,
    // and a non-"core" kind clears back to "domain".
    dom.architectureInspectName.value = '';
    dom.architectureInspectKind.value = 'domain';
    dom.architectureInspectUrl.value = '';
    dom.architectureInspectDeploy.value = '';
    dom.architectureSaveServiceBtn.dispatch('click', {});

    selected = state.architecture.services.find(
      (service: any) => service.id === state.selectedArchitectureServiceId
    );
    expect(selected.name).toBe('Renamed Core');
    expect(selected.kind).toBe('domain');
    expect(selected.deployTargetId).toBe('');
  });

  it('ignores a move-domain click with nothing selected, then moves a domain to a service', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();

    dom.architectureMoveDomainBtn.dispatch('click', {});
    expect(state.architecture).toBeUndefined();

    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Billing Service';
    dom.architectureAddServiceBtn.dispatch('click', {});
    const billingButton = dom.architectureServiceList.children[1].children[0];
    billingButton.dispatch('click', {});

    // Each click re-renders (fresh service objects), so the service is
    // looked up again after every action rather than reused by reference.
    dom.architectureInspectDomain.value = '';
    dom.architectureMoveDomainBtn.dispatch('click', {});
    let billingService = state.architecture.services.find((service: any) => service.name === 'Billing Service');
    expect(billingService.domains).toHaveLength(0);

    dom.architectureInspectDomain.value = 'domain-billing';
    dom.architectureMoveDomainBtn.dispatch('click', {});
    billingService = state.architecture.services.find((service: any) => service.name === 'Billing Service');
    expect(billingService.domains).toContain('domain-billing');
  });

  it('adds a link with a valid protocol, falls back to rest for an invalid one, then removes it', () => {
    expect.hasAssertions();
    const { dom, state, canvas } = setup();
    canvas.renderArchitecture();
    dom.architectureServiceNameInput.value = 'Second Service';
    dom.architectureAddServiceBtn.dispatch('click', {});
    const [core, second] = state.architecture.services;

    dom.architectureLinkFrom.value = core.id;
    dom.architectureLinkTo.value = second.id;
    dom.architectureLinkProtocol.value = 'grpc';
    dom.architectureAddLinkBtn.dispatch('click', {});
    expect(state.architecture.links[0].protocol).toBe('grpc');

    dom.architectureLinkProtocol.value = 'not-a-protocol';
    dom.architectureAddLinkBtn.dispatch('click', {});
    expect(state.architecture.links[1].protocol).toBe('rest');

    expect(dom.architectureLinkList.children).toHaveLength(2);
    expect(dom.architectureLinkList.children[0].textContent).toBe('Core —grpc→ Second Service');

    const removeButton = dom.architectureLinkList.children[0].children[0];
    removeButton.dispatch('click', {});
    expect(state.architecture.links).toHaveLength(1);
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
    targetBox.dispatch('click', {});

    expect(state.selectedArchitectureServiceId).toBe(targetBox.dataset.serviceId);
  });

  it('exports the canvas as a PNG download without throwing', () => {
    expect.hasAssertions();
    const { dom, canvas } = setup();
    canvas.renderArchitecture();

    expect(() => dom.architectureExportImageBtn.dispatch('click', {})).not.toThrow();
  });
});
