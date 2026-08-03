/* eslint-disable @typescript-eslint/no-var-requires */

const {
  isFirestoreUnavailable,
  shouldSkipCiRegistryCheck
} = require('../../../../../ci-cd/agent-registry-cli') as {
  isFirestoreUnavailable: (error: unknown) => boolean;
  shouldSkipCiRegistryCheck: (command: string, error: unknown) => boolean;
};

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
});
