/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, max-len */
import { ServiceManagementApp } from '../../src/ui/app/index.js';
import { LegacyTabApplication } from '../../src/ui/app/LegacyTabApplication.js';
import { ArchitectureTab } from '../../src/ui/tabs/architecture/index.js';

function fakeEl(): any {
  const el: any = {
    className: '',
    textContent: '',
    tabIndex: -1,
    hidden: false,
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    attrs: {} as Record<string, string>,
    listeners: new Map<string, Array<(event: any) => void>>(),
    children: [] as any[],
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
      const next = (el.listeners.get(type) || [])
        .filter((entry: any) => entry !== handler);
      el.listeners.set(type, next);
    },
    appendChild(child: any) {
      el.children.push(child);
      return child;
    },
    focus() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    set() {
      el.children = [];
    },
    get() {
      return '';
    },
    configurable: true
  });
  return el;
}

describe('service management app + tab host', () => {
  const savedDocument = (globalThis as any).document;
  const savedWindow = (globalThis as any).window;
  const savedLocation = (globalThis as any).location;
  const savedHistory = (globalThis as any).history;

  beforeEach(() => {
    try {
      (globalThis as any).localStorage?.removeItem?.('jumentix.serviceManagement.mainNav');
    } catch {
      /* ignore */
    }
    (globalThis as any).document = {
      createElement: (tag: string) => {
        const node = fakeEl();
        node.tagName = String(tag).toUpperCase();
        node.dataset = {};
        node.style = {};
        node.children = [];
        node.appendChild = (child: any) => {
          node.children.push(child);
          return child;
        };
        node.addEventListener = (type: string, handler: (event: any) => void) => {
          const list = node.listeners.get(type) || [];
          list.push(handler);
          node.listeners.set(type, list);
        };
        Object.defineProperty(node, 'innerHTML', {
          set() {
            node.children = [];
          },
          get() {
            return '';
          },
          configurable: true
        });
        return node;
      },
      createElementNS: (_ns: string, tag: string) => (
        (globalThis as any).document.createElement(tag)
      ),
      querySelectorAll: () => []
    };
    (globalThis as any).window = {
      addEventListener() {},
      removeEventListener() {},
      confirm: () => true
    };
    let hash = '';
    (globalThis as any).location = {
      get hash() {
        return hash;
      },
      set hash(value: string) {
        hash = value;
      },
      pathname: '/',
      search: ''
    };
    (globalThis as any).history = {
      replaceState(_state: unknown, _title: string, url: string) {
        const idx = String(url).indexOf('#');
        hash = idx >= 0 ? String(url).slice(idx) : '';
      }
    };
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
    (globalThis as any).location = savedLocation;
    (globalThis as any).history = savedHistory;
  });

  it('registers tabs, switches active tab, syncs the hash, and toggles the hamburger nav', () => {
    expect.hasAssertions();
    const state: any = { activeTab: 'domain-designer', domains: [], architecture: undefined };
    const saveState = jest.fn();
    const afterTabChange = jest.fn();
    const shell = fakeEl();
    shell.dataset = { mainNav: 'open' };
    const toggleBtn = fakeEl();
    const app = new ServiceManagementApp({
      el: shell,
      mainNavToggle: toggleBtn,
      state,
      dom: {},
      actions: { withPersist: (fn: () => void) => fn(), saveState },
      saveState,
      afterTabChange,
      windowRef: (globalThis as any).window
    });

    const archBtn = fakeEl();
    archBtn.textContent = 'Architecture';
    const archEl = fakeEl();
    const ddBtn = fakeEl();
    ddBtn.textContent = 'Domain Designer';
    const ddEl = fakeEl();

    app.registerTab(new LegacyTabApplication({
      key: 'architecture',
      el: archEl,
      button: archBtn,
      ctx: app.ctx
    }));
    app.registerTab(new LegacyTabApplication({
      key: 'domain-designer',
      el: ddEl,
      button: ddBtn,
      ctx: app.ctx
    }));
    app.mount();
    app.renderTabs();

    expect(ddEl.classList.contains('active')).toBe(true);
    expect((globalThis as any).location.hash).toBe('#domain-designer');
    expect(shell.dataset.mainNav).toBe('open');

    app.mainNav.toggle();
    expect(shell.dataset.mainNav).toBe('closed');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    app.setActiveTab('architecture');
    expect(state.activeTab).toBe('architecture');
    expect(archEl.classList.contains('active')).toBe(true);
    expect(ddEl.classList.contains('active')).toBe(false);
    expect(saveState).toHaveBeenCalledWith();
    expect(afterTabChange).toHaveBeenCalledWith('domain-designer', 'architecture');
    expect((globalThis as any).location.hash).toBe('#architecture');
  });

  it('architecture tab mounts without throwing when chrome DOM is sparse', () => {
    expect.hasAssertions();
    const state: any = { domains: [], architecture: undefined };
    const app = new ServiceManagementApp({
      state,
      dom: {
        architectureEmptyState: fakeEl(),
        architectureCoach: fakeEl(),
        architectureCanvas: fakeEl(),
        architectureMiniMap: fakeEl()
      },
      actions: { withPersist: (fn: () => void) => fn(), saveState: jest.fn() },
      saveState: jest.fn()
    });
    const tab = app.registerTab(new ArchitectureTab({
      key: 'architecture',
      el: fakeEl(),
      button: fakeEl(),
      ctx: app.ctx
    }));
    expect(() => app.mount()).not.toThrow();
    expect(() => tab.render()).not.toThrow();
    expect(app.getTab('architecture')).toBe(tab);
  });
});
