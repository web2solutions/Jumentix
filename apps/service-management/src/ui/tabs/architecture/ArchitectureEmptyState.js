/**
 * ArchitectureEmptyState — first-run CTA when no domains exist.
 */

import { Component } from '../../component/Component.js';

export class ArchitectureEmptyState extends Component {
  /**
   * @param {Object} options
   * @param {Element|null} options.el
   * @param {() => void} [options.onLoadSample]
   * @param {() => void} [options.onOpenDomainDesigner]
   * @param {Element|null} [options.loadSampleBtn]
   * @param {Element|null} [options.openDomainBtn]
   */
  constructor(options) {
    super({ el: options.el || null, host: options.host || null });
    this.onLoadSample = options.onLoadSample;
    this.onOpenDomainDesigner = options.onOpenDomainDesigner;
    this.loadSampleBtn = options.loadSampleBtn || null;
    this.openDomainBtn = options.openDomainBtn || null;
  }

  wire() {
    if (this.loadSampleBtn && typeof this.onLoadSample === 'function') {
      this.on(this.loadSampleBtn, 'click', () => this.onLoadSample());
    }
    if (this.openDomainBtn && typeof this.onOpenDomainDesigner === 'function') {
      this.on(this.openDomainBtn, 'click', () => this.onOpenDomainDesigner());
    }
  }

  /**
   * @param {boolean} empty
   */
  setEmpty(empty) {
    if (this.el) this.el.hidden = !empty;
  }
}
