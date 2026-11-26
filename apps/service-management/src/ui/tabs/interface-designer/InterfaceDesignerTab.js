/**
 * InterfaceDesignerTab — stub (inspectors.renderInterfaceAdapters still in shell).
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class InterfaceDesignerTab extends LegacyTabApplication {
  static key = 'interface-designer';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: InterfaceDesignerTab.key
    });
  }
}
