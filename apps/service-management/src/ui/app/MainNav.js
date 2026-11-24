/**
 * MainNav — hamburger expands/collapses labels on the vertical icon rail.
 * Destinations stay visible and clickable in both states.
 */

import { Component } from '../component/Component.js';

const STORAGE_KEY = 'jumentix.serviceManagement.mainNav';

/**
 * @typedef {Object} MainNavOptions
 * @property {Element} shell `.service-management-shell`
 * @property {Element|null} [toggleBtn]
 * @property {Storage|null} [storage]
 * @property {Component|null} [host]
 */

export class MainNav extends Component {
  /**
   * @param {MainNavOptions} options
   */
  constructor(options) {
    super({ el: options.shell || null, host: options.host || null });
    this.shell = options.shell;
    this.toggleBtn = options.toggleBtn || null;
    this.storage = options.storage
      || (typeof localStorage !== 'undefined' ? localStorage : null);
    this._open = true;
    try {
      const stored = this.storage?.getItem?.(STORAGE_KEY);
      if (stored === 'closed') this._open = false;
      if (stored === 'open') this._open = true;
    } catch {
      this._open = true;
    }
  }

  /** @returns {boolean} */
  get open() {
    return this._open;
  }

  wire() {
    if (this.toggleBtn) {
      this.on(this.toggleBtn, 'click', () => this.toggle());
    }
    this.apply();
  }

  toggle() {
    this.setOpen(!this._open);
  }

  /**
   * @param {boolean} open
   */
  setOpen(open) {
    this._open = Boolean(open);
    try {
      this.storage?.setItem?.(STORAGE_KEY, this._open ? 'open' : 'closed');
    } catch {
      /* ignore quota */
    }
    this.apply();
  }

  apply() {
    if (this.shell?.dataset) {
      this.shell.dataset.mainNav = this._open ? 'open' : 'closed';
    }
    if (this.toggleBtn) {
      this.toggleBtn.setAttribute('aria-expanded', this._open ? 'true' : 'false');
      this.toggleBtn.title = this._open ? 'Collapse menu labels' : 'Expand menu labels';
    }
  }
}
