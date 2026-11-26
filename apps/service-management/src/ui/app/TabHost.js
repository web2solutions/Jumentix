/**
 * TabHost — shell chrome for the Service Management tablist.
 *
 * Owns hash sync, ARIA keyboard pattern, and activate/deactivate of registered
 * TabApplication instances. Extracted from the former createTabs factory.
 */

import { Component } from '../component/Component.js';

const DEFAULT_TAB = 'domain-designer';

/**
 * @typedef {Object} TabHostOptions
 * @property {Object} state
 * @property {Function} saveState
 * @property {Function} [beforeTabChange]
 * @property {Function} [afterTabChange]
 * @property {Window|null} [windowRef]
 * @property {Location|null} [locationRef]
 * @property {History|null} [historyRef]
 * @property {Component|null} [host]
 */

export class TabHost extends Component {
  /**
   * @param {TabHostOptions} options
   */
  constructor(options) {
    super({ host: options.host || null });
    this.state = options.state;
    this.saveState = options.saveState;
    this.beforeTabChange = options.beforeTabChange;
    this.afterTabChange = options.afterTabChange;
    this.windowRef = options.windowRef
      || (typeof window !== 'undefined' ? window : null);
    this.locationRef = options.locationRef
      || (typeof location !== 'undefined' ? location : null);
    this.historyRef = options.historyRef
      || (typeof history !== 'undefined' ? history : null);
    /** @type {import('../component/TabApplication.js').TabApplication[]} */
    this.tabs = [];
  }

  /**
   * @param {import('../component/TabApplication.js').TabApplication} tab
   */
  register(tab) {
    if (!tab || this.tabs.some((entry) => entry.key === tab.key)) return tab;
    this.tabs.push(tab);
    if (this.mounted && !tab.mounted) tab.mount();
    if (tab.button) {
      this.on(tab.button, 'click', () => this.setActiveTab(tab.key));
      this.on(tab.button, 'keydown', (event) => this._onTabKeydown(event, tab));
    }
    return tab;
  }

  /** @returns {string[]} */
  keys() {
    return this.tabs.map((tab) => tab.key);
  }

  tabKeyFromHash() {
    const raw = this.locationRef ? String(this.locationRef.hash || '').replace(/^#/, '') : '';
    if (!raw) return null;
    return this.tabs.some((tab) => tab.key === raw) ? raw : null;
  }

  syncHash(tabKey) {
    if (!this.historyRef || !this.locationRef) return;
    const next = `#${tabKey}`;
    if (this.locationRef.hash === next) return;
    const path = this.locationRef.pathname || '';
    const search = this.locationRef.search || '';
    this.historyRef.replaceState(null, '', `${path}${search}${next}`);
  }

  /**
   * @param {string} tabKey
   */
  setActiveTab(tabKey) {
    const previous = this.state.activeTab || DEFAULT_TAB;
    if (typeof this.beforeTabChange === 'function') this.beforeTabChange(previous, tabKey);
    this.state.activeTab = tabKey;
    this.renderTabs();
    if (typeof this.saveState === 'function') this.saveState();
    if (typeof this.afterTabChange === 'function') this.afterTabChange(previous, tabKey);
  }

  renderTabs() {
    const activeTab = this.state.activeTab || DEFAULT_TAB;
    this.tabs.forEach((tab) => {
      if (tab.key === activeTab) tab.activate();
      else tab.deactivate();
    });
    this.syncHash(activeTab);
  }

  applyHashTab({ persist = false } = {}) {
    const hashTab = this.tabKeyFromHash();
    if (!hashTab || hashTab === this.state.activeTab) return false;
    if (persist) {
      this.setActiveTab(hashTab);
      return true;
    }
    this.state.activeTab = hashTab;
    this.renderTabs();
    return true;
  }

  wire() {
    if (this.windowRef) {
      this.on(this.windowRef, 'hashchange', () => {
        this.applyHashTab({ persist: true });
      });
    }
  }

  /**
   * @param {KeyboardEvent} event
   * @param {import('../component/TabApplication.js').TabApplication} tab
   */
  _onTabKeydown(event, tab) {
    const wired = this.tabs.filter((entry) => entry.button);
    const index = wired.indexOf(tab);
    if (index < 0) return;
    let nextIndex = null;
    // Vertical main nav: Up/Down. Keep Left/Right for parity with WAI tabs pattern.
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % wired.length;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + wired.length) % wired.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = wired.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    const next = wired[nextIndex];
    this.setActiveTab(next.key);
    if (next.button && typeof next.button.focus === 'function') next.button.focus();
  }
}
