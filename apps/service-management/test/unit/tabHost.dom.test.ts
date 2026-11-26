/* eslint-disable @typescript-eslint/no-explicit-any, max-len */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import { TabApplication } from '../../src/ui/component/index.js';
import { TabHost } from '../../src/ui/app/TabHost.js';

function fakeEl(tag = 'div'): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    className: '',
    tabIndex: -1,
    attrs: {} as Record<string, string>,
    listeners: new Map<string, Array<(event: any) => void>>(),
    focused: 0,
    get classList() {
      return {
        add: (name: string) => {
          const parts = el.className.split(/\s+/u).filter(Boolean);
          if (!parts.includes(name)) parts.push(name);
          el.className = parts.join(' ');
        },
        remove: (name: string) => {
          el.className = el.className
            .split(/\s+/u)
            .filter((entry: string) => entry && entry !== name)
            .join(' ');
        },
        contains: (name: string) => el.className.split(/\s+/u).filter(Boolean).includes(name)
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
      el.listeners.set(
        type,
        (el.listeners.get(type) || []).filter((entry: any) => entry !== handler)
      );
    },
    focus() {
      el.focused += 1;
    },
    fire(type: string, event: any = {}) {
      (el.listeners.get(type) || []).forEach((handler: any) => handler(event));
    }
  };
  return el;
}

function makeTab(key: string, withButton = true): any {
  const el = fakeEl('section');
  const button = withButton ? fakeEl('button') : null;
  return new TabApplication({
    key,
    el,
    button,
    ctx: { state: {}, dom: {}, actions: {} }
  } as any);
}

function makeRefs(hash = '', pathname = '/app', search = '?q=1') {
  const calls: any[][] = [];
  return {
    calls,
    locationRef: { hash, pathname, search } as any,
    historyRef: {
      replaceState: (...args: any[]) => calls.push(args)
    } as any,
    windowRef: fakeEl('window')
  };
}

function makeHost(overrides: Record<string, any> = {}) {
  const refs = makeRefs(overrides.hash);
  const state: any = overrides.state || { activeTab: 'a' };
  const host = new TabHost({
    state,
    saveState: overrides.saveState,
    beforeTabChange: overrides.beforeTabChange,
    afterTabChange: overrides.afterTabChange,
    windowRef: 'windowRef' in overrides ? overrides.windowRef : refs.windowRef,
    locationRef: 'locationRef' in overrides ? overrides.locationRef : refs.locationRef,
    historyRef: 'historyRef' in overrides ? overrides.historyRef : refs.historyRef
  } as any);
  return { host: host as any, refs, state };
}

describe('tabHost constructor', () => {
  it('defaults refs to null when no globals exist and host to null', () => {
    expect.hasAssertions();
    const state = {};
    const host = new TabHost({ state, saveState: () => {} } as any);
    expect(host.windowRef).toBeNull();
    expect(host.locationRef).toBeNull();
    expect(host.historyRef).toBeNull();
    expect(host.host).toBeNull();
    expect(host.tabs).toStrictEqual([]);
    expect(host.state).toBe(state);
  });

  it('falls back to global window/location/history when present', () => {
    expect.hasAssertions();
    const g: any = globalThis;
    const fakeWindow = fakeEl('window');
    const fakeLocation = { hash: '' };
    const fakeHistory = { replaceState: () => {} };
    g.window = fakeWindow;
    g.location = fakeLocation;
    g.history = fakeHistory;
    try {
      const host = new TabHost({ state: {} } as any);
      expect(host.windowRef).toBe(fakeWindow);
      expect(host.locationRef).toBe(fakeLocation);
      expect(host.historyRef).toBe(fakeHistory);
    } finally {
      delete g.window;
      delete g.location;
      delete g.history;
    }
  });

  it('accepts a parent host component', () => {
    expect.hasAssertions();
    const parent = new TabHost({ state: {} } as any);
    const child = new TabHost({ state: {}, host: parent } as any);
    expect(child.host).toBe(parent);
  });
});

describe('tabHost register / keys', () => {
  it('ignores falsy tabs and duplicate keys', () => {
    expect.hasAssertions();
    const { host } = makeHost();
    const tab = makeTab('a');
    expect(host.register(null as any)).toBeNull();
    expect(host.register(tab)).toBe(tab);
    const dup = makeTab('a');
    expect(host.register(dup)).toBe(dup);
    expect(host.keys()).toStrictEqual(['a']);
    expect(host.tabs).toHaveLength(1);
  });

  it('does not mount tabs when host is not mounted', () => {
    expect.hasAssertions();
    const { host } = makeHost();
    const tab = makeTab('a');
    host.register(tab);
    expect(tab.mounted).toBe(false);
  });

  it('mounts newly registered tabs when host is mounted, but skips already-mounted tabs', () => {
    expect.hasAssertions();
    const { host } = makeHost();
    host.mount();
    const fresh = makeTab('a');
    const premounted = makeTab('b');
    premounted.mount();
    const mountSpy = jest.spyOn(premounted, 'mount');
    host.register(fresh);
    host.register(premounted);
    expect(fresh.mounted).toBe(true);
    expect(mountSpy).not.toHaveBeenCalled();
  });

  it('registers tabs without a button without wiring listeners', () => {
    expect.hasAssertions();
    const { host } = makeHost();
    const tab = makeTab('a', false);
    host.register(tab);
    expect(host.keys()).toStrictEqual(['a']);
    expect(host._listeners).toHaveLength(0);
  });

  it('wires click and keydown on tab buttons', () => {
    expect.hasAssertions();
    const { host, state } = makeHost();
    const a = makeTab('a');
    const b = makeTab('b');
    host.register(a);
    host.register(b);
    b.button.fire('click');
    expect(state.activeTab).toBe('b');
    const event = { key: 'ArrowRight', preventDefault: jest.fn(), stopPropagation: jest.fn() };
    b.button.fire('keydown', event);
    expect(state.activeTab).toBe('a');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe('tabHost hash handling', () => {
  it('tabKeyFromHash handles no location, empty, invalid, and valid hashes', () => {
    expect.hasAssertions();
    const noLoc = makeHost({ locationRef: null });
    noLoc.host.register(makeTab('a'));
    expect(noLoc.host.tabKeyFromHash()).toBeNull();

    const { host, refs } = makeHost();
    host.register(makeTab('a'));
    host.register(makeTab('b'));
    refs.locationRef.hash = '';
    expect(host.tabKeyFromHash()).toBeNull();
    refs.locationRef.hash = undefined;
    expect(host.tabKeyFromHash()).toBeNull();
    refs.locationRef.hash = '#nope';
    expect(host.tabKeyFromHash()).toBeNull();
    refs.locationRef.hash = '#b';
    expect(host.tabKeyFromHash()).toBe('b');
  });

  it('syncHash is a noop without history/location or when hash matches', () => {
    expect.hasAssertions();
    const noHistory = makeHost({ historyRef: null });
    noHistory.host.syncHash('a');
    expect(noHistory.refs.calls).toHaveLength(0);

    const noLocation = makeHost({ locationRef: null });
    noLocation.host.syncHash('a');
    expect(noLocation.refs.calls).toHaveLength(0);

    const same = makeHost({ hash: '#a' });
    same.host.syncHash('a');
    expect(same.refs.calls).toHaveLength(0);
  });

  it('syncHash replaces state with path + search + hash', () => {
    expect.hasAssertions();
    const { host, refs } = makeHost();
    host.syncHash('b');
    expect(refs.calls).toStrictEqual([[null, '', '/app?q=1#b']]);
  });

  it('syncHash tolerates missing pathname and search', () => {
    expect.hasAssertions();
    const refs = makeRefs();
    refs.locationRef = { hash: '' };
    const { host } = makeHost({ locationRef: refs.locationRef, historyRef: refs.historyRef });
    host.syncHash('x');
    expect(refs.calls).toStrictEqual([[null, '', '#x']]);
  });

  it('applyHashTab returns false for missing hash or same tab', () => {
    expect.hasAssertions();
    const { host, refs } = makeHost();
    host.register(makeTab('a'));
    host.register(makeTab('b'));
    expect(host.applyHashTab()).toBe(false);
    refs.locationRef.hash = '#a';
    expect(host.applyHashTab({ persist: true })).toBe(false);
  });

  it('applyHashTab without persist renders but does not save', () => {
    expect.hasAssertions();
    const saveState = jest.fn();
    const { host, refs, state } = makeHost({ saveState });
    const a = makeTab('a');
    const b = makeTab('b');
    host.register(a);
    host.register(b);
    refs.locationRef.hash = '#b';
    expect(host.applyHashTab()).toBe(true);
    expect(state.activeTab).toBe('b');
    expect(b.active).toBe(true);
    expect(a.active).toBe(false);
    expect(saveState).not.toHaveBeenCalled();
  });

  it('applyHashTab with persist goes through setActiveTab', () => {
    expect.hasAssertions();
    const saveState = jest.fn();
    const { host, refs, state } = makeHost({ saveState });
    host.register(makeTab('a'));
    host.register(makeTab('b'));
    refs.locationRef.hash = '#b';
    expect(host.applyHashTab({ persist: true })).toBe(true);
    expect(state.activeTab).toBe('b');
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('wire binds hashchange on window and applies hash with persist', () => {
    expect.hasAssertions();
    const saveState = jest.fn();
    const { host, refs, state } = makeHost({ saveState });
    host.register(makeTab('a'));
    host.register(makeTab('b'));
    host.wire();
    refs.locationRef.hash = '#b';
    refs.windowRef.fire('hashchange');
    expect(state.activeTab).toBe('b');
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('wire is a noop without a window', () => {
    expect.hasAssertions();
    const { host } = makeHost({ windowRef: null });
    host.wire();
    expect(host._listeners).toHaveLength(0);
  });
});

describe('tabHost setActiveTab / renderTabs', () => {
  it('invokes before/after hooks with previous and next, then saves', () => {
    expect.hasAssertions();
    const order: string[] = [];
    const { host, state } = makeHost({
      beforeTabChange: (prev: string, next: string) => order.push(`before:${prev}>${next}`),
      saveState: () => order.push('save'),
      afterTabChange: (prev: string, next: string) => order.push(`after:${prev}>${next}`)
    });
    host.register(makeTab('a'));
    host.register(makeTab('b'));
    host.setActiveTab('b');
    expect(state.activeTab).toBe('b');
    expect(order).toStrictEqual(['before:a>b', 'save', 'after:a>b']);
  });

  it('works without hooks and defaults previous tab to domain-designer', () => {
    expect.hasAssertions();
    const seen: string[] = [];
    const { host, state } = makeHost({
      state: {},
      afterTabChange: (prev: string) => seen.push(prev)
    });
    host.register(makeTab('domain-designer'));
    host.register(makeTab('b'));
    host.setActiveTab('b');
    expect(seen).toStrictEqual(['domain-designer']);
    expect(state.activeTab).toBe('b');
  });

  it('ignores non-function hooks', () => {
    expect.hasAssertions();
    const { host, state } = makeHost({
      beforeTabChange: 'x',
      saveState: 'y',
      afterTabChange: 'z'
    });
    host.register(makeTab('a'));
    host.setActiveTab('a');
    expect(state.activeTab).toBe('a');
  });

  it('renderTabs activates the active tab, deactivates others, and syncs hash', () => {
    expect.hasAssertions();
    const { host, refs } = makeHost();
    const a = makeTab('a');
    const b = makeTab('b');
    host.register(a);
    host.register(b);
    host.renderTabs();
    expect(a.active).toBe(true);
    expect(b.active).toBe(false);
    expect(refs.calls[0][2]).toBe('/app?q=1#a');
  });

  it('renderTabs defaults to domain-designer when state has no activeTab', () => {
    expect.hasAssertions();
    const { host } = makeHost({ state: {} });
    const dd = makeTab('domain-designer');
    host.register(dd);
    host.renderTabs();
    expect(dd.active).toBe(true);
  });
});

describe('tabHost keyboard navigation', () => {
  function setup() {
    const ctx = makeHost();
    const tabs = ['a', 'b', 'c'].map((key) => makeTab(key));
    tabs.forEach((tab) => ctx.host.register(tab));
    const press = (tab: any, key: string) => {
      const event = { key, preventDefault: jest.fn(), stopPropagation: jest.fn() };
      ctx.host._onTabKeydown(event, tab);
      return event;
    };
    return { ...ctx, tabs, press };
  }

  it('arrowRight / ArrowDown move forward and wrap', () => {
    expect.hasAssertions();
    const {
      tabs, press, state
    } = setup();
    press(tabs[0], 'ArrowRight');
    expect(state.activeTab).toBe('b');
    expect(tabs[1].button.focused).toBe(1);
    press(tabs[2], 'ArrowDown');
    expect(state.activeTab).toBe('a');
  });

  it('arrowLeft / ArrowUp move backward and wrap', () => {
    expect.hasAssertions();
    const {
      tabs, press, state
    } = setup();
    press(tabs[0], 'ArrowLeft');
    expect(state.activeTab).toBe('c');
    press(tabs[2], 'ArrowUp');
    expect(state.activeTab).toBe('b');
  });

  it('home and End jump to first and last', () => {
    expect.hasAssertions();
    const {
      tabs, press, state
    } = setup();
    press(tabs[1], 'End');
    expect(state.activeTab).toBe('c');
    press(tabs[1], 'Home');
    expect(state.activeTab).toBe('a');
  });

  it('prevents default and stops propagation on handled keys', () => {
    expect.hasAssertions();
    const { tabs, press } = setup();
    const event = press(tabs[0], 'End');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    expect.hasAssertions();
    const {
      tabs, press, state
    } = setup();
    const event = press(tabs[0], 'Enter');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(state.activeTab).toBe('a');
  });

  it('ignores tabs without buttons (not in the wired list)', () => {
    expect.hasAssertions();
    const { host, state } = makeHost();
    const orphan = makeTab('orphan', false);
    host.register(orphan);
    const event = { key: 'End', preventDefault: jest.fn(), stopPropagation: jest.fn() };
    host._onTabKeydown(event, orphan);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(state.activeTab).toBe('a');
  });

  it('skips focus when the target button has no focus function', () => {
    expect.hasAssertions();
    const { host, state } = makeHost();
    const a = makeTab('a');
    const b = makeTab('b');
    host.register(a);
    host.register(b);
    b.button.focus = undefined;
    host._onTabKeydown({ key: 'ArrowRight', preventDefault: jest.fn(), stopPropagation: jest.fn() }, a);
    expect(state.activeTab).toBe('b');
  });

  it('skips focus when the target tab button was cleared after registration', () => {
    expect.hasAssertions();
    const { host } = makeHost();
    const a = makeTab('a');
    const b = makeTab('b');
    host.register(a);
    host.register(b);
    // filter() snapshot happens before setActiveTab; clear button inside before hook.
    host.beforeTabChange = () => {
      b.button = null;
    };
    expect(() => host._onTabKeydown({ key: 'ArrowRight', preventDefault: jest.fn(), stopPropagation: jest.fn() }, a)).not.toThrow();
  });
});
