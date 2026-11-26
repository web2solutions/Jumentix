/**
 * Component — base UI class for Service Management (class-component model).
 *
 * Vanilla ES; no framework. Subclasses own a root `el`, optional children,
 * and explicit mount/destroy. DOM globals are never required — inject `el`
 * (and document via `host.document` when needed) so unit tests stay shim-free.
 */

/**
 * @typedef {Object} ComponentOptions
 * @property {Element|null} [el] Root element this component owns or decorates.
 * @property {Component|null} [host] Parent component (App / Tab / another child).
 * @property {Document|null} [documentRef] Document used for createElement (tests).
 */

export class Component {
  /**
   * @param {ComponentOptions} [options]
   */
  constructor(options = {}) {
    this.el = options.el || null;
    this.host = options.host || null;
    this.documentRef = options.documentRef
      || (typeof document !== 'undefined' ? document : null);
    /** @type {Component[]} */
    this.children = [];
    /** @type {Array<{ target: EventTarget, type: string, handler: EventListener, options?: boolean|AddEventListenerOptions }>} */
    this._listeners = [];
    this._mounted = false;
    this._destroyed = false;
  }

  /** @returns {boolean} */
  get mounted() {
    return this._mounted;
  }

  /** @returns {boolean} */
  get destroyed() {
    return this._destroyed;
  }

  /**
   * Register a child. Mounts it immediately when this component is already mounted.
   * @template {Component} T
   * @param {T} child
   * @returns {T}
   */
  addChild(child) {
    if (!child || this._destroyed) return child;
    child.host = this;
    this.children.push(child);
    if (this._mounted && !child.mounted) child.mount();
    return child;
  }

  /**
   * @param {Component} child
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index < 0) return;
    this.children.splice(index, 1);
    if (child.mounted) child.destroy();
    child.host = null;
  }

  /**
   * Bind an event and track it for destroy(). Prefer this over raw addEventListener.
   * @param {EventTarget|null|undefined} target
   * @param {string} type
   * @param {EventListener} handler
   * @param {boolean|AddEventListenerOptions} [options]
   */
  on(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    this._listeners.push({
      target, type, handler, options
    });
  }

  /**
   * @param {string} selector
   * @param {ParentNode|null} [root]
   * @returns {Element|null}
   */
  query(selector, root = this.el) {
    if (!root || typeof root.querySelector !== 'function') return null;
    return root.querySelector(selector);
  }

  /**
   * @param {string} selector
   * @param {ParentNode|null} [root]
   * @returns {Element[]}
   */
  queryAll(selector, root = this.el) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    return Array.from(root.querySelectorAll(selector));
  }

  /**
   * Subclasses override for one-time wiring. Called once from mount().
   */
  wire() {}

  /**
   * Subclasses override for paint. Safe to call before mount (no-op by default).
   */
  render() {}

  mount() {
    if (this._destroyed || this._mounted) return this;
    this.wire();
    this._mounted = true;
    this.children.forEach((child) => {
      if (!child.mounted) child.mount();
    });
    this.render();
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    [...this.children].forEach((child) => this.removeChild(child));
    this.children = [];
    this._listeners.forEach(({
      target, type, handler, options
    }) => {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(type, handler, options);
      }
    });
    this._listeners = [];
    this._mounted = false;
    this._destroyed = true;
  }
}
