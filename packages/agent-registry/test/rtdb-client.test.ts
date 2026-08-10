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

import { createRtdbClient, sanitizeRtdbKey } from '../src/rtdb-client';

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
    delete process.env.FIREBASE_DATABASE_URL;
  });

  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_DATABASE_URL;
  });

  it('sanitizes RTDB path segments', () => {
    expect.hasAssertions();
    expect(sanitizeRtdbKey('https://linear.app/jumentix/project/cana')).toBe(
      'https:__linear_app_jumentix_project_cana'
    );
    expect(sanitizeRtdbKey('a/b#c$[d]')).toBe('a_b_c__d_');
    expect(sanitizeRtdbKey('   ')).toBe('unknown');
  });

  it('initializes RTDB with service account and database URL', () => {
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

  it('fails closed when FIREBASE_DATABASE_URL is missing', () => {
    expect.hasAssertions();
    setServiceAccount();
    expect(() => createRtdbClient())
      .toThrow('Missing required environment variable: FIREBASE_DATABASE_URL');
  });

  it('fails closed when an app exists without databaseURL', () => {
    expect.hasAssertions();
    setServiceAccount();
    process.env.FIREBASE_DATABASE_URL = 'https://example-default-rtdb.firebaseio.com';
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]', options: {} }]);

    expect(() => createRtdbClient()).toThrow('already initialized without FIREBASE_DATABASE_URL');
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
});
