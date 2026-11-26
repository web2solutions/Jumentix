/**
 * CodeWorkspaceTab — stub; Monaco/workspace logic still inline in script.js.
 */

import { LegacyTabApplication } from '../../app/LegacyTabApplication.js';

export class CodeWorkspaceTab extends LegacyTabApplication {
  static key = 'code-workspace';

  /** @param {import('../../component/TabApplication.js').TabApplicationOptions & { hooks?: object }} options */
  constructor(options) {
    super({
      ...options,
      key: CodeWorkspaceTab.key
    });
  }
}
