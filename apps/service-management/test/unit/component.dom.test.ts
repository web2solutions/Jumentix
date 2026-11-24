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
