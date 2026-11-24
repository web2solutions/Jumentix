/**
 * DeployManagementTab — stub (inspectors.renderDeployments still in shell).
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class DeployManagementTab extends LegacyTabApplication {
  static key = 'deploy-management';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: DeployManagementTab.key
    });
  }
}
