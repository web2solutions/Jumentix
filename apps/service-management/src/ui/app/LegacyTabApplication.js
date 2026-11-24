/**
 * LegacyTabApplication — thin TabApplication adapter for tabs not yet peeled
 * into dedicated classes. Delegates activate/render/deactivate to shell hooks
 * so ServiceManagementApp can own every tab key while migration proceeds.
 */

import { TabApplication } from '../component/TabApplication.js';

/**
 * @typedef {Object} LegacyTabHooks
 * @property {() => void} [onActivate]
 * @property {() => void} [onDeactivate]
 * @property {() => void} [onRender]
 */

export class LegacyTabApplication extends TabApplication {
  /**
   * @param {import('../component/TabApplication.js').TabApplicationOptions & { hooks?: LegacyTabHooks }} options
   */
  constructor(options) {
    super(options);
    this.hooks = options.hooks || {};
  }

  activate() {
    super.activate();
    if (typeof this.hooks.onActivate === 'function') this.hooks.onActivate();
  }

  deactivate() {
    const wasActive = this.active;
    super.deactivate();
    if (wasActive && typeof this.hooks.onDeactivate === 'function') this.hooks.onDeactivate();
  }

  render() {
    if (typeof this.hooks.onRender === 'function') this.hooks.onRender();
  }
}
