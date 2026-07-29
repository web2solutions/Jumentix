/* eslint-disable @typescript-eslint/no-var-requires */
const integrationFs = require('fs');
const integrationOs = require('os');
const integrationPath = require('path');
const {
  INTEGRATION_CONTRACTS,
  validateCanonicalIntegrations
} = require('../../../../../ci-cd/check-canonical-integrations');

const canonicalIntegrationRoot = integrationPath.resolve(__dirname, '../../../../..');

describe('check-canonical-integrations', () => {
  it('accepts the canonical repository-owned provider contracts', () => {
    expect.assertions(1);

    expect(validateCanonicalIntegrations(canonicalIntegrationRoot)).toStrictEqual([]);
  });

  it('fails closed when a required provider marker is missing', () => {
    expect.assertions(1);

    const fixtureRoot = integrationFs.mkdtempSync(
      integrationPath.join(integrationOs.tmpdir(), 'jumentix-integrations-')
    );

    INTEGRATION_CONTRACTS.forEach(({ file }: { file: string }) => {
      const source = integrationPath.join(canonicalIntegrationRoot, file);
      const target = integrationPath.join(fixtureRoot, file);
      integrationFs.mkdirSync(integrationPath.dirname(target), { recursive: true });
      integrationFs.copyFileSync(source, target);
    });

    const sonarPath = integrationPath.join(fixtureRoot, 'sonar-project.properties');
    const sonar = integrationFs.readFileSync(sonarPath, 'utf8')
      .replace('sonar.projectKey=XpertMinds_Jumentix', '');
    integrationFs.writeFileSync(sonarPath, sonar);

    expect(validateCanonicalIntegrations(fixtureRoot)).toContain(
      '[integrations] sonar-project.properties is missing marker: '
      + 'sonar.projectKey=XpertMinds_Jumentix'
    );
  });
});
