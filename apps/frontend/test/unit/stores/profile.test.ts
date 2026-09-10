import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/auth';
import { useProfileStore, type UserRecord } from '@/stores/profile';

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

const recorded: RecordedCall[] = [];
let responseBody: unknown = {};

const recordFixture: UserRecord = {
  id: 'user-1',
  firstName: 'Abraham',
  lastName: '',
  avatar: 'avatar.png',
  username: 'me@mydomain.com',
  emails: [{
    id: 'email-9', type: 'work', email: 'me@mydomain.com', isPrimary: true
  }],
  documents: [],
  phones: []
};

describe('profile store (JUM-761)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    recorded.length = 0;
    responseBody = recordFixture;
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'user-1';
    // mock() inside the hook (see the bun:test exception block in .eslintrc.js).
    globalThis.fetch = mock((url: string, init: { method: string; body?: string }) => {
      recorded.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(responseBody),
        text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads the current user with getOneById and the bearer token', async () => {
    expect.assertions(3);
    const profile = useProfileStore();

    await profile.load();

    expect(recorded[0].method).toBe('GET');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1');
    expect(profile.record?.firstName).toBe('Abraham');
  });

  it('saves scalar fields with update — full record merged (backend validates the whole User)', async () => {
    expect.assertions(4);
    const profile = useProfileStore();
    await profile.load();
    recorded.length = 0;

    await profile.saveScalars({ firstName: 'Maria', lastName: 'Silva' });

    expect(recorded[0].method).toBe('PUT');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1');
    const body = recorded[0].body as Record<string, unknown>;
    expect(body).toMatchObject({
      id: 'user-1',
      firstName: 'Maria',
      lastName: 'Silva',
      username: 'me@mydomain.com'
    });
    expect(Array.isArray(body.emails)).toBe(true);
  });

  it('rejects scalar saves before the record is loaded', async () => {
    expect.assertions(2);
    const profile = useProfileStore();

    await expect(profile.saveScalars({ firstName: 'X' })).rejects.toThrow('Profile not loaded.');
    expect(recorded).toHaveLength(0);
  });

  it('rejects a new password shorter than the OAS minimum before HTTP', async () => {
    expect.assertions(2);
    const profile = useProfileStore();

    await expect(profile.changePassword('short')).rejects.toThrow(
      'Password must be at least 8 characters.'
    );
    expect(recorded).toHaveLength(0);
  });

  it('updates the password with updatePassword', async () => {
    expect.assertions(2);
    const profile = useProfileStore();

    await profile.changePassword('NewStrongPass#9');

    expect(recorded[0].method).toBe('PUT');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/updatePassword');
  });

  it('adds an email with createEmail and reloads the record', async () => {
    expect.assertions(4);
    const profile = useProfileStore();

    await profile.addEmail({ email: 'other@mydomain.com', type: 'personal', isPrimary: false });

    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/createEmail');
    expect(recorded[0].body).toEqual({ email: 'other@mydomain.com', type: 'personal', isPrimary: false });
    expect(recorded[1].method).toBe('GET');
  });

  it('updates and deletes emails through their OAS sub-resources', async () => {
    expect.assertions(4);
    const profile = useProfileStore();

    await profile.updateEmail('email-9', { type: 'personal' });
    expect(recorded[0].method).toBe('PUT');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/updateEmail/email-9');

    await profile.removeEmail('email-9');
    expect(recorded[2].method).toBe('DELETE');
    expect(recorded[2].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/deleteEmail/email-9');
  });

  it('adds documents and phones through createDocument/createPhone', async () => {
    expect.assertions(4);
    const profile = useProfileStore();

    await profile.addDocument({ type: 'CPF', countryIssue: 'BR', data: '123.456.789-00' });
    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/createDocument');

    await profile.addPhone({
      countryCode: '+55', localCode: '11', number: '98765-4321', isPrimary: true
    });
    expect(recorded[2].method).toBe('POST');
    expect(recorded[2].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/createPhone');
  });

  it('deletes documents and phones through deleteDocument/deletePhone', async () => {
    expect.assertions(4);
    const profile = useProfileStore();

    await profile.removeDocument('doc-1');
    expect(recorded[0].method).toBe('DELETE');
    expect(recorded[0].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/deleteDocument/doc-1');

    await profile.removePhone('phone-1');
    expect(recorded[2].method).toBe('DELETE');
    expect(recorded[2].url).toBe('http://localhost:3001/api/1.0.0/users/user-1/deletePhone/phone-1');
  });

  it('fails every action without an authenticated user id', async () => {
    expect.assertions(2);
    const auth = useAuthStore();
    auth.userId = '';
    const profile = useProfileStore();

    await expect(profile.load()).rejects.toThrow('No authenticated session.');
    expect(recorded).toHaveLength(0);
  });

  it('treats a 404 on delete as benign and reloads (JUM-765)', async () => {
    expect.assertions(3);
    const originalResponse = responseBody;
    globalThis.fetch = mock((url: string, init: { method: string; body?: string }) => {
      recorded.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      const isDelete = init.method === 'DELETE';
      return Promise.resolve({
        ok: !isDelete,
        status: isDelete ? 404 : 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(isDelete ? {} : originalResponse),
        text: () => Promise.resolve('not found')
      } as unknown as Response);
    });

    const profile = useProfileStore();
    const outcome = await profile.removeEmail('email-9');

    expect(outcome).toBe('already-removed');
    expect(recorded.some((call) => call.method === 'GET')).toBe(true);
    expect(profile.record?.id).toBe('user-1');
  });
});
