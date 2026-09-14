/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-733 / JUM-821 — behavioral suite for the control-help installer
 * (`apps/service-management/src/ui/controlHelp.js`).
 *
 * The module is browser-targeted plain JavaScript; it is exercised here
 * against a hand-rolled fake DOM — no jsdom, no DOM shims beyond what the
 * module actually touches — the same convention as `pwaShell.test.ts`.
 * Every assertion is on an observable effect: installed descriptions,
 * `aria-describedby` wiring, popover content/geometry and rescan behavior.
 */

import { describeControlHelp, installControlHelp } from '../../src/ui/controlHelp.js';

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
    } else if (rest.startsWith(':not(')) {
      const close = rest.indexOf(')');
      if (matchesSimpleSelector(el, rest.slice(5, close))) return false;
      rest = rest.slice(close + 1);
    } else {
      return false;
    }
  }
  return true;
}

function matchesSelector(el: any, selector: string): boolean {
  return selector.split(',').some((part) => matchesSimpleSelector(el, part));
}

function descendantsOf(el: any, out: any[] = []): any[] {
  el.children.forEach((child: any) => {
    out.push(child);
    descendantsOf(child, out);
  });
  return out;
}

function createFakeElement(doc: any, tagName: string, props: Record<string, any> = {}): any {
  const el: any = {
    ownerDocument: doc,
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    type: '',
    hidden: false,
    textContent: '',
    dataset: {},
    style: {},
    attributes: new Map<string, string>(),
    children: [] as any[],
    parentNode: null as any,
    listeners: new Map<string, Array<(event: any) => void>>(),
    rect: {
      left: 0, top: 0, width: 0, height: 0
    },
    get classList() {
      return {
        contains: (name: string) => el.className.split(/\s+/u).filter(Boolean).includes(name)
      };
    },
    getAttribute(name: string) {
      if (name === 'id') return el.id || null;
      if (name === 'class') return el.className || null;
      return el.attributes.has(name) ? el.attributes.get(name) : null;
    },
    setAttribute(name: string, value: string) {
      if (name === 'id') { el.id = value; return; }
      if (name === 'class') { el.className = value; return; }
      el.attributes.set(name, value);
    },
    removeAttribute(name: string) {
      el.attributes.delete(name);
    },
    closest(selector: string) {
      let node = el;
      while (node) {
        if (node.tagName && matchesSelector(node, selector)) return node;
        node = node.parentNode;
      }
      return null;
    },
    querySelectorAll(selector: string) {
      return descendantsOf(el).filter((node) => matchesSelector(node, selector));
    },
    querySelector(selector: string) {
      return el.querySelectorAll(selector)[0] || null;
    },
    getElementById(id: string) {
      return descendantsOf(el).find((node) => node.id === id) || null;
    },
    appendChild(child: any) {
      const node = child;
      node.parentNode = el;
      el.children.push(node);
      return node;
    },
    insertAdjacentElement(position: string, child: any) {
      const node = child;
      const parent = el.parentNode;
      if (position === 'afterend' && parent) {
        parent.children.splice(parent.children.indexOf(el) + 1, 0, node);
        node.parentNode = parent;
      }
      return node;
    },
    addEventListener(type: string, handler: (event: any) => void) {
      const list = el.listeners.get(type) || [];
      list.push(handler);
      el.listeners.set(type, list);
    },
    dispatch(type: string, event: any = {}) {
      (el.listeners.get(type) || []).forEach((handler: (fakeEvent: any) => void) => handler(event));
    },
    getBoundingClientRect() {
      const {
        left, top, width, height
      } = el.rect;
      return {
        left, top, width, height, right: left + width, bottom: top + height
      };
    },
    click() {
      el.dispatch('click', {
        target: el,
        preventDefault: () => { el.clickDefaultPrevented = true; },
        stopPropagation: () => { el.clickPropagationStopped = true; }
      });
    },
    set innerHTML(html: string) {
      el.children = [];
      Array.from(html.matchAll(/<(\w+)>/g)).forEach((match) => {
        el.appendChild(createFakeElement(doc, match[1]));
      });
    },
    get innerHTML() {
      return el.children.map((child: any) => `<${child.tagName.toLowerCase()}></>`).join('');
    }
  };
  Object.assign(el, props);
  return el;
}

function createFakeView({ raf = true } = {}) {
  const listeners = new Map<string, Array<() => void>>();
  const rafQueue: Array<() => void> = [];
  const view: any = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener(type: string, handler: () => void) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type: string) {
      (listeners.get(type) || []).forEach((handler) => handler());
    },
    pendingAnimationFrames: () => rafQueue.length,
    flushAnimationFrames() {
      rafQueue.splice(0, rafQueue.length).forEach((callback) => callback());
    }
  };
  if (raf) view.requestAnimationFrame = (callback: () => void) => { rafQueue.push(callback); };
  return view;
}

function createFakeDocument({ withView = true, raf = true } = {}) {
  const doc: any = {
    defaultView: withView ? createFakeView({ raf }) : undefined,
    createElement: (tag: string) => createFakeElement(doc, tag),
    getElementById(id: string) {
      return doc.body.getElementById(id);
    }
  };
  doc.body = createFakeElement(doc, 'body');
  return doc;
}

function addControl(
  doc: any,
  tag: string,
  props: Record<string, any> = {},
  parent: any = null
): any {
  const control = createFakeElement(doc, tag, props);
  (parent || doc.body).appendChild(control);
  return control;
}

class FakeMutationObserver {
  static instances: any[] = [];

  callback: () => void;

  observed: Array<{ region: any; options: any }> = [];

  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(region: any, options: any) {
    this.observed.push({ region, options });
  }

  trigger() {
    this.callback();
  }
}

function installMutationObserverGlobal() {
  Object.defineProperty(globalThis, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: FakeMutationObserver
  });
}

const savedMutationObserver = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function restoreAmbientGlobals() {
  FakeMutationObserver.instances = [];
  if (savedMutationObserver) {
    Object.defineProperty(globalThis, 'MutationObserver', savedMutationObserver);
  } else {
    delete (globalThis as any).MutationObserver;
  }
  if (savedDocument) {
    Object.defineProperty(globalThis, 'document', savedDocument);
  } else {
    delete (globalThis as any).document;
  }
}

describe('describeControlHelp fallback text', () => {
  afterEach(restoreAmbientGlobals);

  it('returns the curated title and body for catalogued controls', () => {
    expect.hasAssertions();
    expect(describeControlHelp({ id: 'add-domain-btn' })).toStrictEqual({
      title: 'Add Domain',
      body: 'Creates a new bounded context on the canvas.'
    });
    expect(describeControlHelp({ id: 'tab-monitoring-btn' }).title).toBe('Monitoring');
  });

  it('derives role-specific fallback bodies for selects, textareas, checkboxes and buttons', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();

    const select = createFakeElement(doc, 'select', { id: 'custom-select' });
    select.setAttribute('aria-label', 'Runtime Mode');
    expect(describeControlHelp(select)).toStrictEqual({
      title: 'Runtime Mode',
      body: 'Choose the value used by this Service Management workflow.'
    });

    const textarea = createFakeElement(doc, 'textarea', { id: 'notes-area' });
    textarea.setAttribute('aria-label', 'Notes');
    expect(describeControlHelp(textarea).body)
      .toBe('Edit the multi-line value used by this Service Management workflow.');

    const checkbox = createFakeElement(doc, 'input', { id: 'flag-check', type: 'checkbox' });
    checkbox.setAttribute('aria-label', 'Flag');
    expect(describeControlHelp(checkbox).body).toBe('Toggle this option for the current workflow.');

    const button = createFakeElement(doc, 'button', { id: 'do-thing', textContent: '  Do Thing  ' });
    expect(describeControlHelp(button)).toStrictEqual({
      title: 'Do Thing',
      body: 'Runs this action for the current Service Management workflow.'
    });

    const input = createFakeElement(doc, 'input', { id: 'custom-field' });
    input.setAttribute('placeholder', 'Type a value');
    expect(describeControlHelp(input)).toStrictEqual({
      title: 'Type a value',
      body: 'Edit the value used by this Service Management workflow.'
    });
  });

  it('resolves aria-labelledby text before any other fallback', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const labelA = addControl(doc, 'span', { id: 'lbl-a', textContent: ' Alpha ' });
    const labelB = addControl(doc, 'span', { id: 'lbl-b', textContent: 'Beta' });
    expect(labelA.parentNode).toBe(doc.body);
    expect(labelB.parentNode).toBe(doc.body);

    const control = addControl(doc, 'input', { id: 'labelled-input' });
    control.setAttribute('aria-labelledby', 'lbl-a lbl-b');
    control.setAttribute('aria-label', 'Should Not Win');
    expect(describeControlHelp(control).title).toBe('Alpha Beta');
  });

  it('ignores aria-labelledby references that resolve to no text', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    addControl(doc, 'span', { id: 'lbl-empty', textContent: '   ' });
    const control = addControl(doc, 'input', { id: 'half-labelled-input' });
    control.setAttribute('aria-labelledby', 'lbl-empty lbl-missing');
    control.setAttribute('title', 'Title Wins');
    expect(describeControlHelp(control).title).toBe('Title Wins');
  });

  it('humanizes the control id when no semantic text exists at all', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const widget = createFakeElement(doc, 'input', { id: 'custom-metric-widget-input' });
    expect(describeControlHelp(widget).title).toBe('Custom Metric Widget');

    const anonymous = createFakeElement(doc, 'input', { id: '' });
    expect(describeControlHelp(anonymous).title).toBe('');
  });
});

describe('installControlHelp installation rules', () => {
  afterEach(restoreAmbientGlobals);

  it('installs an accessible description and a visual help button after each control, once', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const control = addControl(doc, 'button', { id: 'add-domain-btn', textContent: 'Add' });

    installControlHelp(doc);

    const description = doc.getElementById('control-help-add-domain-btn');
    expect(description).not.toBeNull();
    expect(description.className).toBe('control-help-description');
    expect(description.textContent).toBe('Add Domain. Creates a new bounded context on the canvas.');
    expect(control.getAttribute('aria-describedby')).toBe('control-help-add-domain-btn');

    const button = doc.getElementById('control-help-add-domain-btn-btn');
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(button.className).toBe('control-help-btn');
    expect(button.textContent).toBe('?');
    expect(button.getAttribute('aria-label')).toBe('Help: Add Domain');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('control-help-popover');
    expect(button.getAttribute('aria-describedby')).toBe('control-help-add-domain-btn');
    // Inserted immediately after the control it describes.
    expect(doc.body.children.indexOf(button)).toBe(doc.body.children.indexOf(control) + 1);

    // A second pass is idempotent: no duplicate description, button or wiring.
    installControlHelp(doc);
    expect(doc.body.querySelectorAll('.control-help-description')).toHaveLength(1);
    expect(doc.body.querySelectorAll('.control-help-btn')).toHaveLength(1);
    expect(control.getAttribute('aria-describedby')).toBe('control-help-add-domain-btn');
    expect(doc.body.listeners.get('keydown')).toHaveLength(1);
    expect(doc.body.listeners.get('click')).toHaveLength(1);
  });

  it('merges a pre-existing aria-describedby instead of overwriting it', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const control = addControl(doc, 'input', { id: 'domain-name-input' });
    control.setAttribute('aria-describedby', 'domain-name-hint');

    installControlHelp(doc);

    expect(control.getAttribute('aria-describedby'))
      .toBe('domain-name-hint control-help-domain-name-input');
  });

  it('never decorates exempt, hidden, opted-out or blocklist-nested controls', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    addControl(doc, 'input', { id: 'import-json-input', type: 'file' });
    addControl(doc, 'input', { id: 'hidden-by-flag', hidden: true });
    addControl(doc, 'input', { id: 'hidden-by-type', type: 'hidden' });
    const optedOut = addControl(doc, 'button', { id: 'opted-out-btn' });
    optedOut.dataset.controlHelp = 'false';
    const preExisting = addControl(doc, 'button', {
      id: 'already-help-btn',
      className: 'control-help-btn'
    });
    expect(preExisting.classList.contains('control-help-btn')).toBe(true);
    const entityHost = addControl(doc, 'div', { className: 'entity' });
    addControl(doc, 'button', { id: 'entity-inner-btn' }, entityHost);

    installControlHelp(doc);

    [
      'import-json-input',
      'hidden-by-flag',
      'hidden-by-type',
      'opted-out-btn',
      'already-help-btn',
      'entity-inner-btn'
    ].forEach((id) => {
      expect(doc.getElementById(`control-help-${id}`)).toBeNull();
      expect(doc.getElementById(`control-help-${id}-btn`)).toBeNull();
    });
  });

  it('adds the accessible description but no visual button in dense hosts and the editor host', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const row = addControl(doc, 'div', { className: 'row' });
    addControl(doc, 'button', { id: 'zoom-in-btn' }, row);
    const tablist = addControl(doc, 'div', {});
    tablist.setAttribute('role', 'tablist');
    addControl(doc, 'button', { id: 'tab-monitoring-btn' }, tablist);
    addControl(doc, 'textarea', { id: 'code-workspace-editor' });

    installControlHelp(doc);

    ['zoom-in-btn', 'tab-monitoring-btn', 'code-workspace-editor'].forEach((id) => {
      expect(doc.getElementById(`control-help-${id}`)).not.toBeNull();
      expect(doc.getElementById(`control-help-${id}-btn`)).toBeNull();
    });
  });

  it('places the visual button after the wrapping label.check for checkbox controls', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const label = addControl(doc, 'label', { className: 'check' });
    const checkbox = addControl(doc, 'input', {
      id: 'relationship-auto-fk-check',
      type: 'checkbox'
    }, label);

    installControlHelp(doc);

    const button = doc.getElementById('control-help-relationship-auto-fk-check-btn');
    expect(button).not.toBeNull();
    expect(doc.body.children.indexOf(button)).toBe(doc.body.children.indexOf(label) + 1);
    expect(label.children).not.toContain(button);
    expect(checkbox.parentNode).toBe(label);
  });

  it('falls back to inserting after the control when its label.check is detached', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const checkbox = addControl(doc, 'input', { id: 'entity-pk-check', type: 'checkbox' });
    const detachedLabel = createFakeElement(doc, 'label', { className: 'check' });
    // Simulate a label wrapper that is not attached to the document tree.
    checkbox.parentNode = detachedLabel;
    detachedLabel.children.push(checkbox);

    installControlHelp(doc);

    const button = detachedLabel.getElementById('control-help-entity-pk-check-btn');
    expect(button).not.toBeNull();
    expect(detachedLabel.children.indexOf(button))
      .toBe(detachedLabel.children.indexOf(checkbox) + 1);
  });
});

describe('control-help popover behavior', () => {
  afterEach(restoreAmbientGlobals);

  function installedButton(doc: any, id = 'add-domain-btn') {
    addControl(doc, 'button', { id, textContent: 'Add' });
    installControlHelp(doc);
    return doc.getElementById(`control-help-${id}-btn`);
  }

  it('opens with the curated content on click and toggles closed on a second click', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const button = installedButton(doc);

    button.click();
    expect(button.clickDefaultPrevented).toBe(true);
    expect(button.clickPropagationStopped).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    const popover = doc.getElementById('control-help-popover');
    expect(popover.getAttribute('hidden')).toBeNull();
    expect(popover.getAttribute('role')).toBe('tooltip');
    expect(popover.querySelector('strong').textContent).toBe('Add Domain');
    expect(popover.querySelector('span').textContent)
      .toBe('Creates a new bounded context on the canvas.');
    // Default geometry: clamped to the margin, directly below the button.
    expect(popover.style.left).toBe('10px');
    expect(popover.style.top).toBe('8px');

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(popover.getAttribute('hidden')).toBe('');

    // Re-opening reuses the same document-level popover element.
    button.click();
    expect(doc.getElementById('control-help-popover')).toBe(popover);
    expect(popover.getAttribute('hidden')).toBeNull();
  });

  it('closes on Escape, on an outside click and on viewport resize or scroll', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const button = installedButton(doc);
    const popover = () => doc.getElementById('control-help-popover');

    const unrelated = addControl(doc, 'div', { id: 'elsewhere' });

    // A non-Escape key does not close an open popover.
    button.click();
    doc.body.dispatch('keydown', { key: 'Enter' });
    expect(popover().getAttribute('hidden')).toBeNull();

    doc.body.dispatch('keydown', { key: 'Escape' });
    expect(popover().getAttribute('hidden')).toBe('');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // A click whose target lives inside a help button does not close it…
    button.click();
    doc.body.dispatch('click', { target: button });
    expect(popover().getAttribute('hidden')).toBeNull();
    // …but any other click target does, even a targetless event.
    doc.body.dispatch('click', { target: unrelated });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    doc.body.dispatch('click', {});
    expect(popover().getAttribute('hidden')).toBe('');

    button.click();
    doc.defaultView.dispatch('resize');
    expect(popover().getAttribute('hidden')).toBe('');

    button.click();
    doc.defaultView.dispatch('scroll');
    expect(popover().getAttribute('hidden')).toBe('');
  });

  it('opens above the button and clamps to the margin when there is no room below', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    const control = addControl(doc, 'button', { id: 'add-domain-btn', textContent: 'Add' });
    installControlHelp(doc);
    const button = doc.getElementById('control-help-add-domain-btn-btn');

    // Seed the popover by opening once, then control its measured size.
    button.click();
    const popover = doc.getElementById('control-help-popover');
    popover.rect = {
      left: 0, top: 0, width: 100, height: 50
    };

    // No room below (viewport 600 tall): flips above the button.
    control.rect = {
      left: 100, top: 560, width: 20, height: 10
    };
    button.rect = control.rect;
    button.click(); // close
    button.click(); // reopen with new geometry
    expect(popover.style.top).toBe('502px');
    expect(popover.style.left).toBe('60px');

    // No room below AND above: top clamps to the viewport margin.
    doc.defaultView.innerHeight = 60;
    button.rect = {
      left: 0, top: 20, width: 10, height: 10
    };
    button.click();
    button.click();
    expect(popover.style.top).toBe('10px');
    // Centering would push past the left edge: left clamps to the margin.
    expect(popover.style.left).toBe('10px');

    // Near the right edge: left clamps to the right margin.
    doc.defaultView.innerHeight = 600;
    button.rect = {
      left: 780, top: 20, width: 20, height: 10
    };
    button.click();
    button.click();
    expect(popover.style.left).toBe('690px');
  });

  it('keeps the popover hidden when the document has no viewport to measure against', () => {
    expect.hasAssertions();
    const doc = createFakeDocument({ withView: false });
    const button = installedButton(doc);

    button.click();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    const popover = doc.getElementById('control-help-popover');
    expect(popover.querySelector('strong').textContent).toBe('Add Domain');
    expect(popover.getAttribute('hidden')).toBe('');
  });
});

describe('installControlHelp rescan and ambient wiring', () => {
  afterEach(restoreAmbientGlobals);

  it('observes live UI regions and rescans once per mutation burst', () => {
    expect.hasAssertions();
    installMutationObserverGlobal();
    const doc = createFakeDocument();
    const sidebar = addControl(doc, 'div', { className: 'sidebar' });
    const canvas = addControl(doc, 'div', { className: 'canvas' });
    const canvasExplorer = addControl(doc, 'div', { className: 'code-explorer' }, canvas);
    addControl(doc, 'button', { id: 'add-domain-btn' }, sidebar);

    installControlHelp(doc);

    expect(FakeMutationObserver.instances).toHaveLength(1);
    const observer = FakeMutationObserver.instances[0];
    expect(observer.observed).toStrictEqual([
      { region: sidebar, options: { childList: true, subtree: true } }
    ]);
    // Regions inside the canvas are deliberately not observed.
    expect(observer.observed.map((entry: { region: any }) => entry.region))
      .not.toContain(canvasExplorer);

    // A mutation burst queues a single rescan, no matter how many callbacks fire.
    const late = addControl(doc, 'button', { id: 'quick-undo-btn', textContent: 'Undo' }, sidebar);
    observer.trigger();
    observer.trigger();
    expect(doc.defaultView.pendingAnimationFrames()).toBe(1);
    expect(doc.getElementById('control-help-quick-undo-btn')).toBeNull();

    doc.defaultView.flushAnimationFrames();

    expect(doc.defaultView.pendingAnimationFrames()).toBe(0);
    expect(doc.getElementById('control-help-quick-undo-btn')).not.toBeNull();
    expect(doc.getElementById('control-help-quick-undo-btn-btn')).not.toBeNull();
    expect(late.getAttribute('aria-describedby')).toBe('control-help-quick-undo-btn');
    expect(sidebar.dataset.controlHelpScanQueued).toBeUndefined();
    expect(doc.body.dataset.controlHelpScanQueued).toBe('false');
  });

  it('rescans through a setTimeout fallback when requestAnimationFrame is unavailable', async () => {
    expect.hasAssertions();
    installMutationObserverGlobal();
    const doc = createFakeDocument({ raf: false });
    const sidebar = addControl(doc, 'div', { className: 'sidebar' });
    installControlHelp(doc);
    const observer = FakeMutationObserver.instances[0];

    addControl(doc, 'button', { id: 'quick-redo-btn', textContent: 'Redo' }, sidebar);
    observer.trigger();
    // The fallback timer was scheduled before this one, so it has already run.
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(doc.getElementById('control-help-quick-redo-btn-btn')).not.toBeNull();
  });

  it('installs without an observer when MutationObserver does not exist', () => {
    expect.hasAssertions();
    delete (globalThis as any).MutationObserver;
    const doc = createFakeDocument();
    addControl(doc, 'button', { id: 'undo-btn', textContent: 'Undo' });

    installControlHelp(doc);

    expect(FakeMutationObserver.instances).toHaveLength(0);
    expect(doc.getElementById('control-help-undo-btn-btn')).not.toBeNull();
  });

  it('defaults to the ambient document when called with no argument', () => {
    expect.hasAssertions();
    const doc = createFakeDocument();
    addControl(doc, 'button', { id: 'redo-btn', textContent: 'Redo' });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });

    installControlHelp();

    expect(doc.getElementById('control-help-redo-btn-btn')).not.toBeNull();
  });

  it('works against a bare element root with no body and no popover to close', async () => {
    expect.hasAssertions();
    installMutationObserverGlobal();
    const doc = createFakeDocument();
    // A body-less root: `rootDocument.body || rootDocument` falls back to the
    // element itself — in install, in closeAll and in the mutation-driven
    // rescan. No controls means no description append (which would
    // legitimately require a body).
    const root = createFakeElement(doc, 'div', { className: 'sidebar' });

    installControlHelp(root);

    expect(root.dataset.controlHelpInstalled).toBe('true');
    root.dispatch('keydown', { key: 'Escape' });
    root.dispatch('click', {});
    expect(root.getElementById('control-help-popover')).toBeNull();

    // The observer rescan also tolerates the body-less root: it schedules on
    // the element, and the queued rescan re-runs the installer harmlessly.
    expect(FakeMutationObserver.instances).toHaveLength(1);
    FakeMutationObserver.instances[0].trigger();
    expect(root.dataset.controlHelpScanQueued).toBe('true');
    // The root has no defaultView, so the rescan uses the setTimeout fallback.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(root.dataset.controlHelpScanQueued).toBe('false');
  });
});
