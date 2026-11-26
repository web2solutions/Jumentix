/* eslint-disable @typescript-eslint/no-explicit-any, max-len */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * Thin behavioral suite for the Architecture tab chrome Components and the
 * shell helpers that wrap them: ArchitectureTab, ArchitectureCoach,
 * ArchitectureEmptyState, MainNav and createTabs (createTabsCompat).
 * Fake-DOM convention shared with `component.dom.test.ts`: no jsdom.
 */
import { ArchitectureTab, ArchitectureCoach, ArchitectureEmptyState } from '../../src/ui/tabs/architecture/index.js';
import { MainNav } from '../../src/ui/app/MainNav.js';
import { createTabs } from '../../src/ui/app/createTabsCompat.js';

function fakeEl(tag = 'div'): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    className: '',
    hidden: false,
    title: '',
    tabIndex: -1,
    dataset: {} as Record<string, string>,
    attrs: {} as Record<string, string>,
    listeners: new Map<string, Array<(event: any) => void>>(),
    get classList() {
      return {
        add: (name: string) => {
          const parts = el.className.split(/\s+/u).filter(Boolean);
          if (!parts.includes(name)) parts.push(name);
          el.className = parts.join(' ');
        },
        remove: (name: string) => {
          el.className = el.className.split(/\s+/u).filter((entry: string) => entry && entry !== name).join(' ');
        },
        contains: (name: string) => el.className.split(/\s+/u).filter(Boolean).includes(name),
        toggle: (name: string, force?: boolean) => {
          const on = el.classList.contains(name);
          const next = force === undefined ? !on : force;
          if (next) el.classList.add(name);
          else el.classList.remove(name);
          return next;
        }
      };
    },
    setAttribute(name: string, value: string) {
      el.attrs[name] = value;
    },
    getAttribute(name: string) {
      return el.attrs[name];
    },
    addEventListener(type: string, handler: (event: any) => void) {
      const list = el.listeners.get(type) || [];
      list.push(handler);
      el.listeners.set(type, list);
    },
    removeEventListener(type: string, handler: (event: any) => void) {
      el.listeners.set(type, (el.listeners.get(type) || []).filter((entry: any) => entry !== handler));
    },
    click() {
      (el.listeners.get('click') || []).slice().forEach((handler: any) => handler({}));
    },
    listenerCount(type: string) {
      return (el.listeners.get(type) || []).length;
    }
  };
  return el;
}

function fakeStorage(seed: Record<string, string> = {}): any {
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

const throwingStorage: any = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('quota');
  }
};

describe('architectureEmptyState', () => {
  it('shows only while the model is empty', () => {
    expect.hasAssertions();
    const el = fakeEl();
    const empty = new ArchitectureEmptyState({ el });

    empty.setEmpty(true);

    expect(el.hidden).toBe(false);

    empty.setEmpty(false);

    expect(el.hidden).toBe(true);
  });

  it('routes the two call-to-action buttons and stops after destroy', () => {
    expect.hasAssertions();
    const loadSampleBtn = fakeEl('button');
    const openDomainBtn = fakeEl('button');
    const onLoadSample = jest.fn();
    const onOpenDomainDesigner = jest.fn();
    const empty = new ArchitectureEmptyState({
      el: fakeEl(), loadSampleBtn, openDomainBtn, onLoadSample, onOpenDomainDesigner
    }).mount();

    loadSampleBtn.click();
    openDomainBtn.click();

    expect(onLoadSample).toHaveBeenCalledTimes(1);
    expect(onOpenDomainDesigner).toHaveBeenCalledTimes(1);

    empty.destroy();
    loadSampleBtn.click();

    expect(onLoadSample).toHaveBeenCalledTimes(1);
  });

  it('wires nothing when buttons or handlers are missing, and tolerates a missing root', () => {
    expect.hasAssertions();
    const loadSampleBtn = fakeEl('button');
    const openDomainBtn = fakeEl('button');
    const empty = new ArchitectureEmptyState({ el: null, loadSampleBtn, openDomainBtn }).mount();

    expect(loadSampleBtn.listenerCount('click')).toBe(0);
    expect(openDomainBtn.listenerCount('click')).toBe(0);
    expect(() => empty.setEmpty(true)).not.toThrow();
  });
});

describe('architectureCoach', () => {
  const flags = { hasDomains: true, onlyCore: true, noLinks: true };

  it('shows the coach only when domains exist but only Core and no links do', () => {
    expect.hasAssertions();
    const el = fakeEl();
    const coach = new ArchitectureCoach({ el, storage: fakeStorage() });

    coach.sync(flags);

    expect(el.hidden).toBe(false);

    coach.sync({ ...flags, hasDomains: false });

    expect(el.hidden).toBe(true);

    coach.sync({ ...flags, onlyCore: false });

    expect(el.hidden).toBe(true);

    coach.sync({ ...flags, noLinks: false });

    expect(el.hidden).toBe(true);
  });

  it('persists dismissal through the button and stays hidden on the next visit', () => {
    expect.hasAssertions();
    const el = fakeEl();
    const dismissBtn = fakeEl('button');
    const storage = fakeStorage();
    new ArchitectureCoach({ el, dismissBtn, storage }).mount();

    dismissBtn.click();

    expect(el.hidden).toBe(true);
    expect(storage.store['jumentix.architecture.coachDismissed']).toBe('1');

    const revisit = fakeEl();
    new ArchitectureCoach({ el: revisit, storage }).sync(flags);

    expect(revisit.hidden).toBe(true);
  });

  it('survives storage that throws on read and write', () => {
    expect.hasAssertions();
    const el = fakeEl();
    const coach = new ArchitectureCoach({ el, storage: throwingStorage });

    coach.sync(flags);

    expect(el.hidden).toBe(false);

    coach.dismiss();

    expect(el.hidden).toBe(true);
  });

  it('falls back to ambient localStorage and tolerates a missing root', () => {
    expect.hasAssertions();
    const saved = (globalThis as any).localStorage;
    (globalThis as any).localStorage = fakeStorage({ 'jumentix.architecture.coachDismissed': '1' });
    try {
      const coach = new ArchitectureCoach({ el: null });

      expect(coach.dismissed).toBe(true);
      expect(() => coach.sync(flags)).not.toThrow();
    } finally {
      (globalThis as any).localStorage = saved;
    }
  });
});

describe('chrome components without ambient storage or host', () => {
  const savedLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    (globalThis as any).localStorage = undefined;
  });

  afterEach(() => {
    (globalThis as any).localStorage = savedLocalStorage;
  });

  it('keeps the coach visible-capable and attaches it to a host Component', () => {
    expect.hasAssertions();
    const host = new ArchitectureEmptyState({ el: fakeEl() });
    const el = fakeEl();
    const coach = new ArchitectureCoach({ el, host } as any);

    coach.sync({ hasDomains: true, onlyCore: true, noLinks: true });
    coach.dismiss();

    expect(coach.host).toBe(host);
    expect(coach.storage).toBeNull();
    expect(el.hidden).toBe(true);
  });

  it('opens the main nav by default and attaches it to a host Component', () => {
    expect.hasAssertions();
    const host = new ArchitectureEmptyState({ el: fakeEl() });
    const nav = new MainNav({ shell: fakeEl(), host } as any);

    expect(nav.open).toBe(true);
    expect(nav.host).toBe(host);
    expect(nav.storage).toBeNull();
  });

  it('attaches the empty state to a host Component', () => {
    expect.hasAssertions();
    const host = new ArchitectureCoach({ el: fakeEl() });

    expect(new ArchitectureEmptyState({ el: fakeEl(), host } as any).host).toBe(host);
  });
});

describe('mainNav', () => {
  function build(storage: any, extra: Record<string, any> = {}) {
    const shell = fakeEl();
    const toggleBtn = fakeEl('button');
    const nav = new MainNav({
      shell,
      toggleBtn,
      storage,
      ...extra
    });
    return { shell, toggleBtn, nav };
  }

  it('starts open, paints the shell and toggles with the hamburger, persisting the choice', () => {
    expect.hasAssertions();
    const storage = fakeStorage();
    const { shell, toggleBtn, nav } = build(storage);
    nav.mount();

    expect(nav.open).toBe(true);
    expect(shell.dataset.mainNav).toBe('open');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn.title).toBe('Collapse menu labels');

    toggleBtn.click();

    expect(nav.open).toBe(false);
    expect(shell.dataset.mainNav).toBe('closed');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(toggleBtn.title).toBe('Expand menu labels');
    expect(storage.store['jumentix.serviceManagement.mainNav']).toBe('closed');

    nav.setOpen(true);

    expect(storage.store['jumentix.serviceManagement.mainNav']).toBe('open');
  });

  it('restores the stored closed/open preference', () => {
    expect.hasAssertions();
    expect(build(fakeStorage({ 'jumentix.serviceManagement.mainNav': 'closed' })).nav.open).toBe(false);
    expect(build(fakeStorage({ 'jumentix.serviceManagement.mainNav': 'open' })).nav.open).toBe(true);
    expect(build(fakeStorage({ 'jumentix.serviceManagement.mainNav': 'garbage' })).nav.open).toBe(true);
  });

  it('stays usable when storage throws and when no toggle button or dataset exists', () => {
    expect.hasAssertions();
    const { nav } = build(throwingStorage);

    expect(nav.open).toBe(true);
    expect(() => nav.setOpen(false)).not.toThrow();
    expect(nav.open).toBe(false);

    const bare = new MainNav({ shell: {} as any, storage: fakeStorage() }).mount();

    expect(() => bare.toggle()).not.toThrow();
    expect(bare.open).toBe(false);
  });

  it('falls back to ambient localStorage', () => {
    expect.hasAssertions();
    const saved = (globalThis as any).localStorage;
    (globalThis as any).localStorage = fakeStorage({ 'jumentix.serviceManagement.mainNav': 'closed' });
    try {
      expect(new MainNav({ shell: fakeEl() }).open).toBe(false);
    } finally {
      (globalThis as any).localStorage = saved;
    }
  });
});

describe('createTabs (createTabsCompat)', () => {
  const keys = [
    ['architecture', 'tabArchitecture'],
    ['domain-designer', 'tabDomainDesigner'],
    ['interface-designer', 'tabInterfaceDesigner'],
    ['service-config', 'tabServiceConfig'],
    ['deploy-management', 'tabDeployManagement'],
    ['monitoring', 'tabMonitoring'],
    ['openapi', 'tabOpenapi'],
    ['code-workspace', 'tabCodeWorkspace']
  ];

  function buildDom(skip: string[] = []) {
    const dom: Record<string, any> = {};
    keys.forEach(([, base]) => {
      if (skip.includes(base)) return;
      dom[base] = fakeEl('section');
      dom[`${base}Btn`] = fakeEl('button');
    });
    return dom;
  }

  it('registers the eight tabs and activates the chosen one through the compat surface', () => {
    expect.hasAssertions();
    const dom = buildDom();
    const state: any = { activeTab: 'domain-designer' };
    const saveState = jest.fn();
    const afterTabChange = jest.fn();
    const tabs = createTabs({
      dom, state, saveState, afterTabChange
    });

    expect(tabs._host.keys()).toStrictEqual(keys.map(([key]) => key));

    tabs.setActiveTab('monitoring');

    expect(state.activeTab).toBe('monitoring');
    expect(dom.tabMonitoring.classList.contains('active')).toBe(true);
    expect(dom.tabArchitecture.classList.contains('active')).toBe(false);
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(afterTabChange).toHaveBeenCalledWith('domain-designer', 'monitoring');

    tabs.renderTabs();

    expect(dom.tabMonitoringBtn.getAttribute('aria-selected')).toBe('true');
  });

  it('reads the hash tab and applies it without persisting by default', () => {
    expect.hasAssertions();
    const savedLocation = (globalThis as any).location;
    const savedHistory = (globalThis as any).history;
    (globalThis as any).location = { hash: '#openapi', pathname: '/app', search: '' };
    (globalThis as any).history = { replaceState: jest.fn() };
    try {
      const state: any = { activeTab: 'domain-designer' };
      const saveState = jest.fn();
      const tabs = createTabs({ dom: buildDom(), state, saveState });

      expect(tabs.tabKeyFromHash()).toBe('openapi');
      expect(tabs.applyHashTab({})).toBe(true);
      expect(state.activeTab).toBe('openapi');
      expect(saveState).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).location = savedLocation;
      (globalThis as any).history = savedHistory;
    }
  });

  it('tolerates a DOM where some tab sections and buttons are missing', () => {
    expect.hasAssertions();
    const dom = buildDom(['tabCodeWorkspace', 'tabOpenapi']);
    const state: any = { activeTab: 'code-workspace' };
    const tabs = createTabs({ dom, state, saveState: jest.fn() });

    expect(() => tabs.setActiveTab('architecture')).not.toThrow();
    expect(dom.tabArchitecture.classList.contains('active')).toBe(true);
    expect(tabs._host.keys()).toContain('code-workspace');
  });
});

describe('architectureTab', () => {
  const savedLocalStorage = (globalThis as any).localStorage;
  const savedDocument = (globalThis as any).document;
  const savedWindow = (globalThis as any).window;

  beforeEach(() => {
    (globalThis as any).localStorage = fakeStorage();
    (globalThis as any).document = {
      createElement: (tag: string) => fakeEl(tag),
      createElementNS: (_ns: string, tag: string) => fakeEl(tag),
      querySelectorAll: () => [],
      querySelector: () => null
    };
    (globalThis as any).window = fakeEl('window');
    (globalThis as any).window.innerWidth = 1400;
  });

  afterEach(() => {
    (globalThis as any).localStorage = savedLocalStorage;
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
  });

  function build(domainList: any[] = [], extra: Record<string, any> = {}) {
    const dom: Record<string, any> = {
      architectureEmptyState: fakeEl(),
      architectureEmptyLoadSampleBtn: fakeEl('button'),
      architectureEmptyOpenDomainBtn: fakeEl('button'),
      architectureCoach: fakeEl(),
      architectureCoachDismissBtn: fakeEl('button'),
      architectureSidebar: fakeEl()
    };
    const state: any = { domains: domainList, architecture: undefined };
    const tab = new ArchitectureTab({
      el: fakeEl('section'),
      button: fakeEl('button'),
      ctx: {
        state,
        dom,
        actions: { withPersist: (fn: () => void) => fn(), saveState: jest.fn() }
      },
      ...extra
    } as any);
    return { dom, state, tab };
  }

  it('owns its chrome Components and a canvas controller after mount', () => {
    expect.hasAssertions();
    const { tab } = build();

    tab.mount();

    expect(tab.key).toBe('architecture');
    expect(tab.emptyState).toBeInstanceOf(ArchitectureEmptyState);
    expect(tab.coach).toBeInstanceOf(ArchitectureCoach);
    expect(tab.controller).not.toBeNull();
    expect(tab.children).toHaveLength(2);
  });

  it('shows the empty state and hides the coach when there are no domains', () => {
    expect.hasAssertions();
    const { dom, tab } = build([]);
    tab.mount();

    tab.activate();

    expect(tab.active).toBe(true);
    expect(dom.architectureEmptyState.hidden).toBe(false);
    expect(dom.architectureCoach.hidden).toBe(true);
  });

  it('hides the empty state and coaches a Core-only model until dismissed', () => {
    expect.hasAssertions();
    const { dom, tab } = build([{ id: 'domain-a', name: 'Alpha' }]);
    tab.mount();

    tab.activate();

    expect(dom.architectureEmptyState.hidden).toBe(true);
    expect(dom.architectureCoach.hidden).toBe(false);

    dom.architectureCoachDismissBtn.click();
    tab.render();

    expect(dom.architectureCoach.hidden).toBe(true);
  });

  it('forwards empty-state clicks to the shell callbacks when present, and ignores them when absent', () => {
    expect.hasAssertions();
    const onLoadSample = jest.fn();
    const onOpenDomainDesigner = jest.fn();
    const wired = build([], { onLoadSample, onOpenDomainDesigner });
    wired.tab.mount();

    wired.dom.architectureEmptyLoadSampleBtn.click();
    wired.dom.architectureEmptyOpenDomainBtn.click();

    expect(onLoadSample).toHaveBeenCalledTimes(1);
    expect(onOpenDomainDesigner).toHaveBeenCalledTimes(1);

    const bare = build([]);
    bare.tab.mount();
    // Handlers are bound at mount; swap them to non-functions to cover the guard.
    bare.tab.onLoadSample = undefined;
    bare.tab.onOpenDomainDesigner = undefined;

    expect(() => bare.dom.architectureEmptyLoadSampleBtn.click()).not.toThrow();
    expect(() => bare.dom.architectureEmptyOpenDomainBtn.click()).not.toThrow();
  });

  it('reveals a rail panel through the controller and is a no-op before mount', () => {
    expect.hasAssertions();
    const { dom, tab } = build([{ id: 'domain-a', name: 'Alpha' }]);

    expect(() => tab.revealPanel('domains')).not.toThrow();
    expect(dom.architectureSidebar.classList.contains('open')).toBe(false);

    tab.mount();
    tab.revealPanel('domains');

    expect(dom.architectureSidebar.classList.contains('open')).toBe(true);
  });

  it('derives chrome flags from state when the controller has no snapshot', () => {
    expect.hasAssertions();
    const { dom, tab } = build([{ id: 'domain-a', name: 'Alpha' }]);
    tab.mount();
    tab.controller = null;

    tab.render();

    expect(dom.architectureEmptyState.hidden).toBe(true);
    expect(dom.architectureCoach.hidden).toBe(true);

    (tab.state as any).domains = [];
    tab.render();

    expect(dom.architectureEmptyState.hidden).toBe(false);
  });

  it('mounts and renders when the shell supplied no chrome elements at all', () => {
    expect.hasAssertions();
    const tab = new ArchitectureTab({
      ctx: {
        state: { domains: [], architecture: undefined },
        dom: {},
        actions: { withPersist: (fn: () => void) => fn(), saveState: jest.fn() }
      }
    } as any);

    expect(() => tab.mount().activate()).not.toThrow();
    expect(tab.active).toBe(true);
  });

  it('renders without chrome Components before they exist', () => {
    expect.hasAssertions();
    const { tab } = build([]);

    expect(() => tab.render()).not.toThrow();
  });
});
