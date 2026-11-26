/**
 * ServiceManagementApp — class host for the Service Management SPA shell.
 *
 * Owns TabHost + registered TabApplication instances. Domain state still comes
 * from designer-core via the shell `ctx`; this class does not reimplement model
 * or persistence.
 */

import { Component } from '../component/Component.js';
import { TabHost } from './TabHost.js';
import { MainNav } from './MainNav.js';

/**
 * @typedef {Object} ServiceManagementAppOptions
 * @property {Object} state
 * @property {Object} dom
 * @property {Object} actions
 * @property {Function} saveState
 * @property {Function} [beforeTabChange]
 * @property {Function} [afterTabChange]
 * @property {Element|null} [el]
 * @property {Element|null} [mainNavToggle]
 * @property {Window|null} [windowRef]
 * @property {Document|null} [documentRef]
 */

export class ServiceManagementApp extends Component {
  /**
   * @param {ServiceManagementAppOptions} options
   */
  constructor(options) {
    super({
      el: options.el || null,
      documentRef: options.documentRef
    });
    this.state = options.state;
    this.dom = options.dom;
    this.actions = options.actions || {};
    this.saveState = options.saveState;
    this.tabHost = this.addChild(new TabHost({
      state: options.state,
      saveState: options.saveState,
      beforeTabChange: options.beforeTabChange,
      afterTabChange: options.afterTabChange,
      windowRef: options.windowRef,
      host: this
    }));
    this.mainNav = this.addChild(new MainNav({
      shell: options.el || null,
      toggleBtn: options.mainNavToggle || null,
      host: this
    }));
  }

  /** Shared context passed into every TabApplication. */
  get ctx() {
    return {
      state: this.state,
      dom: this.dom,
      actions: this.actions
    };
  }

  /**
   * @param {import('../component/TabApplication.js').TabApplication} tab
   */
  registerTab(tab) {
    tab.host = this;
    tab.ctx = this.ctx;
    this.tabHost.register(tab);
    this.addChild(tab);
    return tab;
  }

  /**
   * @param {string} key
   * @returns {import('../component/TabApplication.js').TabApplication|undefined}
   */
  getTab(key) {
    return this.tabHost.tabs.find((tab) => tab.key === key);
  }

  setActiveTab(key) {
    this.tabHost.setActiveTab(key);
  }

  renderTabs() {
    this.tabHost.renderTabs();
  }

  applyHashTab(options) {
    return this.tabHost.applyHashTab(options);
  }

  /**
   * Paint the active tab application (and any always-on shell children).
   */
  render() {
    const activeKey = this.state.activeTab || 'domain-designer';
    const active = this.getTab(activeKey);
    if (active && typeof active.render === 'function') active.render();
  }
}
