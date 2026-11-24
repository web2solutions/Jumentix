/**
 * ArchitectureCoach — next-steps coach when only Core exists.
 */

import { Component } from '../../component/Component.js';

const COACH_DISMISS_KEY = 'jumentix.architecture.coachDismissed';

export class ArchitectureCoach extends Component {
  /**
   * @param {Object} options
   * @param {Element|null} options.el
   * @param {Element|null} [options.dismissBtn]
   * @param {Storage|null} [options.storage]
   */
  constructor(options) {
    super({ el: options.el || null, host: options.host || null });
    this.dismissBtn = options.dismissBtn || null;
    this.storage = options.storage
      || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.dismissed = false;
    try {
      this.dismissed = this.storage?.getItem?.(COACH_DISMISS_KEY) === '1';
    } catch {
      this.dismissed = false;
    }
  }

  wire() {
    if (this.dismissBtn) {
      this.on(this.dismissBtn, 'click', () => this.dismiss());
    }
  }

  dismiss() {
    this.dismissed = true;
    try {
      this.storage?.setItem?.(COACH_DISMISS_KEY, '1');
    } catch {
      /* ignore quota */
    }
    this.setVisible(false);
  }

  /**
   * @param {{ hasDomains: boolean, onlyCore: boolean, noLinks: boolean }} flags
   */
  sync(flags) {
    const show = Boolean(flags.hasDomains && flags.onlyCore && flags.noLinks && !this.dismissed);
    this.setVisible(show);
  }

  /**
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
  }
}
