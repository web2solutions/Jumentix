/* eslint-disable @typescript-eslint/no-var-requires */
const integrationFs = require('node:fs');
const integrationOs = require('node:os');
const integrationPath = require('node:path');
const {
  INTEGRATION_CONTRACTS,
  run,
  runIfMain,
  validateCanonicalIntegrations
} = require('../../../../../ci-cd/check-canonical-integrations');

const canonicalIntegrationRoot = integrationPath.resolve(__dirname, '../../../../..');

describe('check-canonical-integrations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts the canonical repository-owned provider contracts', () => {
    expect.assertions(4);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(validateCanonicalIntegrations(canonicalIntegrationRoot)).toStrictEqual([]);
    expect(run(canonicalIntegrationRoot)).toBe(0);
    expect(validateCanonicalIntegrations()).toStrictEqual([]);
    expect(run()).toBe(0);
  });

  it('fails closed when a required provider marker is missing', () => {
    expect.assertions(2);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

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
      .replace('sonar.projectKey=Jumentix', '');
    integrationFs.writeFileSync(sonarPath, sonar);

    expect(validateCanonicalIntegrations(fixtureRoot)).toContain(
      '[integrations] sonar-project.properties is missing marker: '
      + 'sonar.projectKey=Jumentix'
    );
    expect(run(fixtureRoot)).toBe(1);
  });

  it('fails closed when a required provider contract is absent', () => {
    expect.assertions(1);

    const fixtureRoot = integrationFs.mkdtempSync(
      integrationPath.join(integrationOs.tmpdir(), 'jumentix-integrations-')
    );

    expect(validateCanonicalIntegrations(fixtureRoot)).toContain(
      '[integrations] missing required file: sonar-project.properties'
    );
  });

  it('fails closed when CircleCI returns without declaring the temporary bridge', () => {
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
    const circleCi = integrationPath.join(fixtureRoot, '.circleci', 'config.yml');
    integrationFs.mkdirSync(integrationPath.dirname(circleCi), { recursive: true });
    integrationFs.writeFileSync(circleCi, 'version: 2.1\n');

    expect(validateCanonicalIntegrations(fixtureRoot)).toContain(
      '[integrations] retired provider contract is still present: .circleci/config.yml'
    );
  });

  it('accepts CircleCI when it declares the temporary bridge marker', () => {
    expect.assertions(1);

    // Requirement 113's bridge amendment: while the GitHub Actions allowance
    // is quota-blocked, a marked CircleCI config is the bridge executor, not
    // a retired contract returning in silence.
    const fixtureRoot = integrationFs.mkdtempSync(
      integrationPath.join(integrationOs.tmpdir(), 'jumentix-integrations-')
    );
    INTEGRATION_CONTRACTS.forEach(({ file }: { file: string }) => {
      const source = integrationPath.join(canonicalIntegrationRoot, file);
      const target = integrationPath.join(fixtureRoot, file);
      integrationFs.mkdirSync(integrationPath.dirname(target), { recursive: true });
      integrationFs.copyFileSync(source, target);
    });
    const circleCi = integrationPath.join(fixtureRoot, '.circleci', 'config.yml');
    integrationFs.mkdirSync(integrationPath.dirname(circleCi), { recursive: true });
    integrationFs.writeFileSync(
      circleCi,
      'version: 2.1\n# x-jumentix-temporary-bridge: github-actions-billing-2026-08\n'
    );

    expect(validateCanonicalIntegrations(fixtureRoot)).toStrictEqual([]);
  });

  it('runs only when invoked as the entry module', () => {
    expect.assertions(3);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const previousExitCode = process.exitCode;

    expect(runIfMain(null, 'entry.js', canonicalIntegrationRoot)).toBeUndefined();
    expect(
      runIfMain({ filename: 'other.js' }, 'entry.js', canonicalIntegrationRoot)
    ).toBeUndefined();

    runIfMain({ filename: 'entry.js' }, 'entry.js', canonicalIntegrationRoot);
    expect(process.exitCode).toBe(0);
    process.exitCode = previousExitCode;
  });
});
