/**
 * DomainDesignerTab — stub TabApplication (legacy canvas/inspectors still in shell).
 * Full peel: subsequent PR (createCanvas + sidebarGroups + inspector slices).
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class DomainDesignerTab extends LegacyTabApplication {
  static key = 'domain-designer';

  /**
   * @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options
   */
  constructor(options) {
    super({
      ...options,
      key: DomainDesignerTab.key
    });
  }
}
