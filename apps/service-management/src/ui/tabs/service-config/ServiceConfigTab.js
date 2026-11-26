/**
 * ServiceConfigTab — stub (inspectors.renderServiceConfiguration still in shell).
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class ServiceConfigTab extends LegacyTabApplication {
  static key = 'service-config';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: ServiceConfigTab.key
    });
  }
}
