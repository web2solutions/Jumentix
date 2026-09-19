/* eslint-disable @typescript-eslint/no-var-requires */
const integrationFs = require('node:fs');
const integrationOs = require('node:os');
const integrationPath = require('node:path');
const {
  INTEGRATION_CONTRACTS,
  run,
  runIfMain,
  validateCanonicalIntegrations
} = require('../check-canonical-integrations');

const canonicalIntegrationRoot = integrationPath.resolve(__dirname, '../..');

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
      .replace('sonar.projectKey=web2solutions_Jumentix', '');
    integrationFs.writeFileSync(sonarPath, sonar);

    expect(validateCanonicalIntegrations(fixtureRoot)).toContain(
      '[integrations] sonar-project.properties is missing marker: '
      + 'sonar.projectKey=web2solutions_Jumentix'
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
