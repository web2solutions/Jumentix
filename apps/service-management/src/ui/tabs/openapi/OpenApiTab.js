/**
 * OpenApiTab — stub; shell still owns createSwaggerTab until the next peel PR.
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class OpenApiTab extends LegacyTabApplication {
  static key = 'openapi';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: OpenApiTab.key
    });
  }
}
