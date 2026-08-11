/* eslint-disable @typescript-eslint/no-explicit-any, import/first */
const mockInitializeApp = jest.fn();
const mockCert = jest.fn((value) => ({ credential: value }));
const mockGetApps = jest.fn();
const mockDeleteApp = jest.fn(async () => undefined);
const mockDatabase = { ref: jest.fn() };
const mockGetDatabase = jest.fn(() => mockDatabase);

jest.mock<typeof import('firebase-admin/app')>('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
  deleteApp: mockDeleteApp
}));

jest.mock<typeof import('firebase-admin/database')>('firebase-admin/database', () => ({
  getDatabase: mockGetDatabase
} as unknown as typeof import('firebase-admin/database')));

import { closeRtdb, createRtdbClient, sanitizeRtdbKey } from '../src/rtdb-client';

function setServiceAccount() {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    project_id: 'jumentix-service-registry',
    private_key: 'line-one\\nline-two',
    client_email: 'registry@example.test'
  });
}

describe('agent-registry rtdb client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([]);
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;
    delete process.env.FIREBASE_DATABASE_URL;
  });

  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;
    delete process.env.FIREBASE_DATABASE_URL;
  });

  it('sanitizes RTDB path segments', () => {
    expect.hasAssertions();
    expect(sanitizeRtdbKey('https://linear.app/jumentix/project/cana')).toBe(
      'https:__linear_app_jumentix_project_cana'
    );
    expect(sanitizeRtdbKey('a/b#c$[d]')).toBe('a_b_c__d_');
    expect(sanitizeRtdbKey('   ')).toBe('unknown');
    expect(sanitizeRtdbKey('x'.repeat(250))).toHaveLength(200);
  });

  it('initializes RTDB with an explicit database URL', () => {
    expect.hasAssertions();
    setServiceAccount();
    process.env.FIREBASE_DATABASE_URL = 'https://example-default-rtdb.firebaseio.com';

    expect(createRtdbClient()).toBe(mockDatabase);
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credential: expect.any(Object) },
      databaseURL: 'https://example-default-rtdb.firebaseio.com'
    });
    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
  });

  it('derives the RTDB URL from the service-account project_id when unset', () => {
    expect.hasAssertions();
    setServiceAccount();

    expect(createRtdbClient()).toBe(mockDatabase);
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credential: expect.any(Object) },
      databaseURL: 'https://jumentix-service-registry-default-rtdb.firebaseio.com'
    });
  });

  it('fails closed when FIREBASE_SERVICE_ACCOUNT_KEY is invalid JSON', () => {
    expect.hasAssertions();
    process.env.FIREBASE_DATABASE_URL = 'https://example-default-rtdb.firebaseio.com';
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '{';

    expect(() => createRtdbClient()).toThrow('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
  });

  it('fails closed when FIREBASE_SERVICE_ACCOUNT_KEY is missing required fields', () => {
    expect.hasAssertions();
    process.env.FIREBASE_DATABASE_URL = 'https://example-default-rtdb.firebaseio.com';
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'only-project' });

    expect(() => createRtdbClient()).toThrow('Invalid service account structure');
  });

  it('fails closed when an app exists without databaseURL', () => {
    expect.hasAssertions();
    setServiceAccount();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]', options: {} }]);

    expect(() => createRtdbClient()).toThrow('already initialized without a Realtime Database URL');
  });

  it('reuses an app that already has the matching databaseURL', () => {
    expect.hasAssertions();
    process.env.FIREBASE_DATABASE_URL = 'https://example-default-rtdb.firebaseio.com';
    mockGetApps.mockReturnValue([{
      name: '[DEFAULT]',
      options: { databaseURL: 'https://example-default-rtdb.firebaseio.com' }
    }]);

    expect(createRtdbClient()).toBe(mockDatabase);
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('fails closed when an existing app has a different databaseURL', () => {
    expect.hasAssertions();
    process.env.FIREBASE_DATABASE_URL = 'https://expected-default-rtdb.firebaseio.com';
    mockGetApps.mockReturnValue([{
      name: '[DEFAULT]',
      options: { databaseURL: 'https://other-default-rtdb.firebaseio.com' }
    }]);

    expect(() => createRtdbClient()).toThrow('databaseURL does not match');
  });

  it('closes all initialized Firebase apps', async () => {
    expect.hasAssertions();
    const apps = [{ name: 'one' }, { name: 'two' }];
    mockGetApps.mockReturnValue(apps);

    await closeRtdb();

    expect(mockDeleteApp).toHaveBeenCalledTimes(2);
    expect(mockDeleteApp).toHaveBeenNthCalledWith(1, apps[0]);
    expect(mockDeleteApp).toHaveBeenNthCalledWith(2, apps[1]);
  });
});
