/* eslint-disable @typescript-eslint/no-var-requires */

const {
  isFirestoreUnavailable,
  resolveRegistryEntrypoint,
  shouldSkipCiRegistryCheck
} = require('../../../../../ci-cd/agent-registry-cli') as {
  isFirestoreUnavailable: (error: unknown) => boolean;
  resolveRegistryEntrypoint: (root?: string) => string;
  shouldSkipCiRegistryCheck: (command: string, error: unknown) => boolean;
};
const agentRegistryCliFs = require('fs');
const agentRegistryCliOs = require('os');
const agentRegistryCliPath = require('path');

describe('agent-registry-cli', () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    process.env.CI = originalCi;
  });

  it('treats a missing default Firestore database as unavailable infrastructure', () => {
    expect.hasAssertions();

    const error = new Error(
      '5 NOT_FOUND: The database (default) does not exist for project jumentix-service-registry '
        + 'Please visit https://console.cloud.google.com/datastore/setup?project=jumentix-service-registry '
        + 'to add a Cloud Datastore or Cloud Firestore database.'
    );

    expect(isFirestoreUnavailable(error)).toBe(true);
  });

  it('only skips unavailable Firestore for the CI check command', () => {
    expect.hasAssertions();

    const error = new Error(
      '5 NOT_FOUND: The database (default) does not exist for project jumentix-service-registry '
        + 'to add a Cloud Datastore or Cloud Firestore database.'
    );

    process.env.CI = 'true';
    expect(shouldSkipCiRegistryCheck('check', error)).toBe(true);
    expect(shouldSkipCiRegistryCheck('register', error)).toBe(false);
  });

  it('resolves the package main file explicitly for Bun CI directory loading', () => {
    expect.hasAssertions();

    const dir = agentRegistryCliFs.mkdtempSync(
      agentRegistryCliPath.join(agentRegistryCliOs.tmpdir(), 'agent-registry-cli-')
    );
    agentRegistryCliFs.writeFileSync(
      agentRegistryCliPath.join(dir, 'package.json'),
      JSON.stringify({ main: 'dist/index.js' })
    );

    expect(resolveRegistryEntrypoint(dir)).toBe(agentRegistryCliPath.join(dir, 'dist/index.js'));

    agentRegistryCliFs.rmSync(dir, { recursive: true, force: true });
  });
});
