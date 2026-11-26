/**
 * MonitoringTab — stub wrapping createMonitoringController hooks from the shell.
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class MonitoringTab extends LegacyTabApplication {
  static key = 'monitoring';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: MonitoringTab.key
    });
  }
}
