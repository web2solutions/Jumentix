/**
 * TabApplication — one Service Management tab as its own application class.
 *
 * Extends Component. The shell activates exactly one tab at a time; children
 * (canvas, rail, coach, …) live under the tab and must not import siblings
 * from other tabs — shared UI goes through `src/ui/shared/`.
 */

import { Component } from './Component.js';

/**
 * @typedef {Object} TabContext
 * @property {Object} state Shared designer state (mutated in place).
 * @property {Object} dom Resolved element map from the shell.
 * @property {Object} actions Shell actions (`withPersist`, `saveState`, `render`, …).
 */

/**
 * @typedef {Object} TabApplicationOptions
 * @property {string} key Stable tab id (matches `state.activeTab` / URL hash).
 * @property {Element|null} [el] Tab panel root (`#tab-*`).
 * @property {Element|null} [button] Tablist button for this tab.
 * @property {TabContext} ctx
 * @property {Component|null} [host]
 * @property {Document|null} [documentRef]
 */

export class TabApplication extends Component {
  /**
   * @param {TabApplicationOptions} options
   */
  constructor(options) {
    super({
      el: options.el || null,
      host: options.host || null,
      documentRef: options.documentRef
    });
    if (!options.key) throw new Error('TabApplication requires options.key');
    if (!options.ctx) throw new Error('TabApplication requires options.ctx');
    this.key = options.key;
    this.button = options.button || null;
    this.ctx = options.ctx;
    this._active = false;
  }

  /** @returns {boolean} */
  get active() {
    return this._active;
  }

  /** @returns {Object} */
  get state() {
    return this.ctx.state;
  }

  /** @returns {Object} */
  get dom() {
    return this.ctx.dom;
  }

  /** @returns {Object} */
  get actions() {
    return this.ctx.actions;
  }

  /**
   * Called when this tab becomes the visible application.
   * Subclasses may override; must call super.activate().
   */
  activate() {
    this._active = true;
    if (this.el && this.el.classList) this.el.classList.add('active');
    if (this.button) {
      this.button.classList.add('active');
      this.button.setAttribute('aria-selected', 'true');
      this.button.tabIndex = 0;
    }
    this.render();
  }

  /**
   * Called when another tab takes focus.
   * Subclasses may override; must call super.deactivate().
   */
  deactivate() {
    this._active = false;
    if (this.el && this.el.classList) this.el.classList.remove('active');
    if (this.button) {
      this.button.classList.remove('active');
      this.button.setAttribute('aria-selected', 'false');
      this.button.tabIndex = -1;
    }
  }
}
