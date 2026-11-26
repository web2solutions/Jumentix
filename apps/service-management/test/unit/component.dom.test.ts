/* eslint-disable max-classes-per-file, class-methods-use-this, max-len */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import { Component, TabApplication } from '../../src/ui/component/index.js';

function fakeEl(tag = 'div'): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    className: '',
    tabIndex: -1,
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
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  return el;
}

describe('component base', () => {
  it('mounts once, wires, renders, and destroys listeners and children', () => {
    expect.hasAssertions();
    const el = fakeEl();
    const childEl = fakeEl();
    let wired = 0;
    let rendered = 0;
    let childDestroyed = false;

    class Parent extends Component {
      wire() {
        wired += 1;
        this.on(el, 'click', () => {});
      }

      render() {
        rendered += 1;
      }
    }

    class Child extends Component {
      destroy() {
        childDestroyed = true;
        super.destroy();
      }
    }

    const parent = new Parent({ el });
    const child = parent.addChild(new Child({ el: childEl }));
    parent.mount();
    parent.mount();

    expect(parent.mounted).toBe(true);
    expect(child.mounted).toBe(true);
    expect(wired).toBe(1);
    expect(rendered).toBe(1);
    expect(el.listeners.get('click')).toHaveLength(1);

    parent.destroy();
    expect(parent.destroyed).toBe(true);
    expect(childDestroyed).toBe(true);
    expect(el.listeners.get('click')).toHaveLength(0);
  });
});

describe('component edges', () => {
  it('defaults el/host/documentRef to null and honors injected documentRef', () => {
    expect.hasAssertions();
    const bare = new Component();
    expect(bare.el).toBeNull();
    expect(bare.host).toBeNull();
    expect(bare.documentRef).toBeNull();
    const doc = { marker: 1 } as any;
    expect(new Component({ documentRef: doc }).documentRef).toBe(doc);
  });

  it('falls back to global document when present', () => {
    expect.hasAssertions();
    const g: any = globalThis;
    const doc = { marker: 'global' };
    g.document = doc;
    try {
      expect(new Component().documentRef).toBe(doc);
    } finally {
      delete g.document;
    }
  });

  it('addChild returns falsy children and ignores additions once destroyed', () => {
    expect.hasAssertions();
    const parent = new Component();
    expect(parent.addChild(null as any)).toBeNull();
    parent.destroy();
    const child = new Component();
    expect(parent.addChild(child)).toBe(child);
    expect(parent.children).toHaveLength(0);
    expect(child.host).toBeNull();
  });

  it('addChild does not remount an already-mounted child', () => {
    expect.hasAssertions();
    const parent = new Component();
    parent.mount();
    const child = new Component();
    child.mount();
    const spy = jest.spyOn(child, 'mount');
    parent.addChild(child);
    expect(spy).not.toHaveBeenCalled();
    expect(child.host).toBe(parent);
  });

  it('addChild leaves child unmounted while parent is unmounted; mount cascades once', () => {
    expect.hasAssertions();
    const parent = new Component();
    const child = new Component();
    parent.addChild(child);
    expect(child.mounted).toBe(false);
    const premounted = new Component();
    premounted.mount();
    parent.addChild(premounted);
    parent.mount();
    expect(child.mounted).toBe(true);
  });

  it('removeChild ignores unknown children and skips destroy for unmounted ones', () => {
    expect.hasAssertions();
    const parent = new Component();
    const stranger = new Component();
    stranger.host = 'x' as any;
    parent.removeChild(stranger);
    expect(stranger.host).toBe('x');

    const child = parent.addChild(new Component());
    parent.removeChild(child);
    expect(child.destroyed).toBe(false);
    expect(child.host).toBeNull();
    expect(parent.children).toHaveLength(0);
  });

  it('removeChild destroys mounted children', () => {
    expect.hasAssertions();
    const parent = new Component();
    parent.mount();
    const child = parent.addChild(new Component());
    parent.removeChild(child);
    expect(child.destroyed).toBe(true);
  });

  it('on() ignores null targets and targets without addEventListener', () => {
    expect.hasAssertions();
    const comp = new Component();
    comp.on(null, 'click', () => {});
    comp.on(undefined, 'click', () => {});
    comp.on({} as any, 'click', () => {});
    expect(comp._listeners).toHaveLength(0);
  });

  it('query/queryAll return empty without root or root methods', () => {
    expect.hasAssertions();
    const comp = new Component();
    expect(comp.query('.x')).toBeNull();
    expect(comp.queryAll('.x')).toStrictEqual([]);
    expect(comp.query('.x', {} as any)).toBeNull();
    expect(comp.queryAll('.x', {} as any)).toStrictEqual([]);
    expect(comp.query('.x', null)).toBeNull();
    expect(comp.queryAll('.x', null)).toStrictEqual([]);
  });

  it('query/queryAll delegate to root element', () => {
    expect.hasAssertions();
    const hit = fakeEl();
    const el = fakeEl();
    el.querySelector = () => hit;
    el.querySelectorAll = () => [hit, hit];
    const comp = new Component({ el });
    expect(comp.query('.x')).toBe(hit);
    expect(comp.queryAll('.x')).toStrictEqual([hit, hit]);
    const other = fakeEl();
    expect(comp.query('.x', other)).toBeNull();
  });

  it('destroy is idempotent and tolerates listener targets without removeEventListener', () => {
    expect.hasAssertions();
    const comp = new Component();
    const target = { addEventListener: jest.fn() } as any;
    comp.on(target, 'click', () => {});
    expect(() => comp.destroy()).not.toThrow();
    expect(comp.destroyed).toBe(true);
    expect(() => comp.destroy()).not.toThrow();
  });

  it('mount after destroy is a noop', () => {
    expect.hasAssertions();
    const comp = new Component();
    comp.destroy();
    expect(comp.mount()).toBe(comp);
    expect(comp.mounted).toBe(false);
  });
});

describe('tab application', () => {
  it('requires key and ctx', () => {
    expect.hasAssertions();
    expect(() => new TabApplication({} as any)).toThrow(/key/);
    expect(() => new TabApplication({ key: 'x' } as any)).toThrow(/ctx/);
  });

  it('activates and deactivates panel + button ARIA chrome', () => {
    expect.hasAssertions();
    const el = fakeEl('section');
    const button = fakeEl('button');
    const ctx = { state: { activeTab: 'architecture' }, dom: {}, actions: {} };
    const tab = new TabApplication({
      key: 'architecture', el, button, ctx
    });
    tab.mount();
    tab.activate();

    expect(tab.active).toBe(true);
    expect(el.classList.contains('active')).toBe(true);
    expect(button.classList.contains('active')).toBe(true);
    expect(button.getAttribute('aria-selected')).toBe('true');
    expect(button.tabIndex).toBe(0);

    tab.deactivate();
    expect(tab.active).toBe(false);
    expect(el.classList.contains('active')).toBe(false);
    expect(button.getAttribute('aria-selected')).toBe('false');
    expect(button.tabIndex).toBe(-1);
  });
});
