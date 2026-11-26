/**
 * ArchitectureTab — Architecture tab application (class-component model).
 *
 * Owns child Components (empty state, coach) and the canvas controller
 * migrated from the former createArchitectureCanvas factory.
 */

import { TabApplication } from '../../component/TabApplication.js';
import { createArchitectureCanvas } from '../../architectureCanvas.js';
import { ArchitectureEmptyState } from './ArchitectureEmptyState.js';
import { ArchitectureCoach } from './ArchitectureCoach.js';

export class ArchitectureTab extends TabApplication {
  static key = 'architecture';

  /**
   * @param {import('../../component/TabApplication.js').TabApplicationOptions & {
   *   onLoadSample?: () => void,
   *   onOpenDomainDesigner?: () => void
   * }} options
   */
  constructor(options) {
    super({
      ...options,
      key: ArchitectureTab.key
    });
    this.onLoadSample = options.onLoadSample;
    this.onOpenDomainDesigner = options.onOpenDomainDesigner;
    /** @type {ReturnType<typeof createArchitectureCanvas>|null} */
    this.controller = null;
    /** @type {ArchitectureEmptyState|null} */
    this.emptyState = null;
    /** @type {ArchitectureCoach|null} */
    this.coach = null;
  }

  wire() {
    const { dom } = this;
    this.emptyState = this.addChild(new ArchitectureEmptyState({
      el: dom.architectureEmptyState || null,
      loadSampleBtn: dom.architectureEmptyLoadSampleBtn || null,
      openDomainBtn: dom.architectureEmptyOpenDomainBtn || null,
      onLoadSample: () => {
        if (typeof this.onLoadSample === 'function') this.onLoadSample();
      },
      onOpenDomainDesigner: () => {
        if (typeof this.onOpenDomainDesigner === 'function') this.onOpenDomainDesigner();
      }
    }));
    this.coach = this.addChild(new ArchitectureCoach({
      el: dom.architectureCoach || null,
      dismissBtn: dom.architectureCoachDismissBtn || null
    }));

    this.controller = createArchitectureCanvas({
      dom,
      state: this.state,
      actions: this.actions,
      chrome: { ownEmptyState: true, ownCoach: true }
    });
  }

  activate() {
    super.activate();
    this.render();
  }

  render() {
    if (this.controller) this.controller.renderArchitecture();
    const snap = this.controller?.chromeSnapshot?.() || {
      empty: !(this.state.domains || []).length,
      hasDomains: false,
      onlyCore: true,
      noLinks: true
    };
    this.emptyState?.setEmpty(snap.empty);
    this.coach?.sync({
      hasDomains: snap.hasDomains,
      onlyCore: snap.onlyCore,
      noLinks: snap.noLinks
    });
  }

  /**
   * @param {string} key
   */
  revealPanel(key) {
    this.controller?.revealArchitecturePanel?.(key);
  }
}
