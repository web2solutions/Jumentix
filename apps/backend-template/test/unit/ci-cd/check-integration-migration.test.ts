/* eslint-disable @typescript-eslint/no-var-requires */

const {
  INTEGRATION_MARKERS,
  validateCanonicalConfig,
  validateIntegrationPolicy
} = require('../../../../../ci-cd/check-integration-migration');

describe('check-integration-migration', () => {
  it('requires the complete canonical application integration inventory', () => {
    expect.hasAssertions();
    const valid = INTEGRATION_MARKERS.join('\n');
    expect(validateIntegrationPolicy(valid)).toStrictEqual([]);
    expect(validateIntegrationPolicy('incomplete integration policy').length).toBeGreaterThan(0);
  });

  it('requires repository-owned configuration to target web2solutions', () => {
    expect.hasAssertions();
    expect(validateCanonicalConfig(process.cwd())).toStrictEqual([]);
  });
});
