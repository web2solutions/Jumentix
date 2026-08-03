/* eslint-disable @typescript-eslint/no-explicit-any */
const mockInitializeApp = jest.fn();
const mockCert = jest.fn((value) => ({ credential: value }));
const mockGetApps = jest.fn();
const mockDeleteApp = jest.fn(async () => undefined);
const mockFirestore = { collection: jest.fn() };
const mockGetFirestore = jest.fn(() => mockFirestore);

jest.mock('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
  deleteApp: mockDeleteApp
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore
}));

import * as registry from '../src';
import {
  closeFirestore,
  createFirestoreClient
} from '../src/firestore-client';

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
  });

  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
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
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credential: expect.any(Object) }
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

    expect(() => createFirestoreClient())
      .toThrow('Missing required environment variable: FIREBASE_SERVICE_ACCOUNT_KEY');

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

    expect(registry.createFirestoreClient).toBe(createFirestoreClient);
    expect(registry.closeFirestore).toBe(closeFirestore);
    expect(typeof registry.registerAgent).toBe('function');
    expect(typeof registry.checkSnapshot).toBe('function');
  });
});
