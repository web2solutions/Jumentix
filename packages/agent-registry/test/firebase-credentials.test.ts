import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultDatabaseUrl,
  hasFirebaseCredentials,
  loadServiceAccount,
  resolveDatabaseUrl
} from '../src/firebase-credentials';

describe('firebase-credentials', () => {
  const previousKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const previousFile = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;
  const previousUrl = process.env.FIREBASE_DATABASE_URL;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    else process.env.FIREBASE_SERVICE_ACCOUNT_KEY = previousKey;
    if (previousFile === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;
    else process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE = previousFile;
    if (previousUrl === undefined) delete process.env.FIREBASE_DATABASE_URL;
    else process.env.FIREBASE_DATABASE_URL = previousUrl;
  });

  it('derives the default RTDB URL from project_id', () => {
    expect.hasAssertions();
    expect(defaultDatabaseUrl('jumentix-service-registry')).toBe(
      'https://jumentix-service-registry-default-rtdb.firebaseio.com'
    );
  });

  it('loads credentials from FIREBASE_SERVICE_ACCOUNT_KEY_FILE', () => {
    expect.hasAssertions();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_DATABASE_URL;

    const filePath = path.join(
      os.tmpdir(),
      `jumentix-sa-${Date.now()}.json`
    );
    fs.writeFileSync(filePath, JSON.stringify({
      project_id: 'jumentix-service-registry',
      private_key: 'line-one\\nline-two',
      client_email: 'registry@example.test'
    }));
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE = filePath;

    try {
      expect(hasFirebaseCredentials()).toBe(true);
      const account = loadServiceAccount();
      expect(account.project_id).toBe('jumentix-service-registry');
      expect(resolveDatabaseUrl(account)).toBe(
        'https://jumentix-service-registry-default-rtdb.firebaseio.com'
      );
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it('prefers an explicit FIREBASE_DATABASE_URL over the derived default', () => {
    expect.hasAssertions();
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: 'jumentix-service-registry',
      private_key: 'k',
      client_email: 'a@b.c'
    });
    process.env.FIREBASE_DATABASE_URL = 'https://custom.example.firebasedatabase.app';

    expect(resolveDatabaseUrl()).toBe('https://custom.example.firebasedatabase.app');
  });

  it('fails closed when neither key nor key file is set', () => {
    expect.hasAssertions();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;

    expect(hasFirebaseCredentials()).toBe(false);
    expect(() => loadServiceAccount()).toThrow('Missing Firebase credentials');
  });
});
