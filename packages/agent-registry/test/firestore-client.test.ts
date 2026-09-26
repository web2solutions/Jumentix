/* eslint-disable import-x/first, import-x/order --
 * The deferred SUT import is the point of this file's layout: jest hoists
 * jest.mock above imports, so the firebase mocks must be registered and
 * initialized before the module under test loads (see the comment above the
 * import). Top-level ordering cannot express that requirement. */
import type { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import type { getFirestore } from 'firebase-admin/firestore';

interface FirebaseAdminAppModule {
  initializeApp: typeof initializeApp;
  cert: typeof cert;
  getApps: typeof getApps;
  deleteApp: typeof deleteApp;
}

interface FirebaseAdminFirestoreModule {
  getFirestore: typeof getFirestore;
}

const mockInitializeApp = jest.fn();
const mockCert = jest.fn((value) => ({ credential: value }));
const mockGetApps = jest.fn();
const mockDeleteApp = jest.fn(async () => undefined);
const mockFirestore = { collection: jest.fn() };
const mockGetFirestore = jest.fn(() => mockFirestore);

jest.mock<FirebaseAdminAppModule>('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
  deleteApp: mockDeleteApp
}));

jest.mock<FirebaseAdminFirestoreModule>('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore
}));

// The SUT imports stay below the mock registrations: the jest.mock factories
// execute when firebase-admin loads during the SUT import, so every mock
// binding must already be initialized (jest hoists jest.mock above imports).
import {
  busStatus,
  checkSnapshot,
  createRtdbClient,
  publishProgress,
  registerAgent,
  watchBus
} from '../src';
import { closeFirestore, createFirestoreClient } from '../src/firestore-client';


function setServiceAccount(overrides: Record<string, unknown> = {}) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    project_id: 'jumentix-service-registry',
    private_key: 'line-one\\nline-two',
    client_email: 'registry@example.test',
    ...overrides
  });
}

describe('agent-registry firestore client', () => {
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

  it('initializes Firestore from the service account JSON', () => {
    expect.hasAssertions();
    setServiceAccount();

    expect(createFirestoreClient()).toBe(mockFirestore);

    expect(mockCert).toHaveBeenCalledWith({
      projectId: 'jumentix-service-registry',
      privateKey: 'line-one\nline-two',
      clientEmail: 'registry@example.test'
    });
    // Same project as the agent bus: derive default RTDB URL when unset.
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credential: expect.any(Object) },
      databaseURL: 'https://jumentix-service-registry-default-rtdb.firebaseio.com'
    });
    expect(mockGetFirestore).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing app when Firebase is already initialized', () => {
    expect.hasAssertions();
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);

    expect(createFirestoreClient()).toBe(mockFirestore);

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockCert).not.toHaveBeenCalled();
  });

  it('rejects missing, invalid, and incomplete service account values', () => {
    expect.hasAssertions();

    expect(() => createFirestoreClient()).toThrow('Missing Firebase credentials');

    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = 'not-json';
    expect(() => createFirestoreClient()).toThrow('not valid JSON');

    setServiceAccount({ private_key: '' });
    expect(() => createFirestoreClient()).toThrow('Invalid service account structure');
  });

  it('closes every initialized Firebase app', async () => {
    expect.hasAssertions();
    const apps = [{ name: 'one' }, { name: 'two' }];
    mockGetApps.mockReturnValue(apps);

    await closeFirestore();

    expect(mockDeleteApp).toHaveBeenCalledTimes(2);
    expect(mockDeleteApp).toHaveBeenCalledWith(apps[0]);
    expect(mockDeleteApp).toHaveBeenCalledWith(apps[1]);
  });

  it('exposes the runtime registry package surface from the index', () => {
    expect.hasAssertions();

    expect({
      createFirestoreClient,
      closeFirestore,
      registerAgent: typeof registerAgent,
      checkSnapshot: typeof checkSnapshot,
      createRtdbClient: typeof createRtdbClient,
      publishProgress: typeof publishProgress,
      watchBus: typeof watchBus,
      busStatus: typeof busStatus
    }).toStrictEqual({
      createFirestoreClient,
      closeFirestore,
      registerAgent: 'function',
      checkSnapshot: 'function',
      createRtdbClient: 'function',
      publishProgress: 'function',
      watchBus: 'function',
      busStatus: 'function'
    });
  });
});
