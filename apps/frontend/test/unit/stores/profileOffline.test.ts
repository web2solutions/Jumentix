import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import { getLocal } from '@/data/localRepository';
import { listOutbox } from '@/data/outbox';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore, type UserRecord } from '@/stores/profile';

const DB = 'jumentix-frontend-test-profile-offline';

const recordFixture: UserRecord = {
  id: 'user-1',
  firstName: 'Abraham',
  lastName: '',
  username: 'me@mydomain.com',
  emails: [{
    id: 'email-9', type: 'work', email: 'me@mydomain.com', isPrimary: true
  }],
  documents: [],
  phones: []
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

const seedLocalUser = async (): Promise<void> => {
  await getCanaClient().table('users').put({
    ...JSON.parse(JSON.stringify(recordFixture)),
    _sync: 'synced'
  });
};

/** Profile store with Cana open (JUM-803/804): local reads, outbox writes. */
describe('profile store with Cana open (JUM-803/804)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    setActivePinia(createPinia());
    resetSharedApiClient();
    await openCana(DB);
    await wipeCanaDatabase();
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.username = 'me@mydomain.com';
    auth.userId = 'user-1';
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('serves the profile from Cana without any HTTP call', async () => {
    expect.hasAssertions();
    await seedLocalUser();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse(200, recordFixture);
    }) as unknown as typeof fetch;

    const profile = useProfileStore();
    await profile.load();

    expect(calls).toBe(0);
    expect(profile.record?.firstName).toBe('Abraham');
    expect(profile.record?.emails[0].email).toBe('me@mydomain.com');
  });

  it('persists the remote record into Cana after a remote load', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async () => jsonResponse(200, recordFixture)) as unknown as typeof fetch;

    const profile = useProfileStore();
    await profile.load();

    expect(profile.record?.username).toBe('me@mydomain.com');
    const local = await getLocal<Record<string, unknown>>('User', 'user-1');
    expect(local?._sync).toBe('synced');
    expect((local?.emails as { email: string }[])[0].email).toBe('me@mydomain.com');
  });

  it('saves scalars through the outbox and re-reads the local record', async () => {
    expect.hasAssertions();
    await seedLocalUser();
    globalThis.fetch = (async () => jsonResponse(503, { message: 'offline' })) as unknown as typeof fetch;
    const profile = useProfileStore();
    await profile.load();

    await profile.saveScalars({ firstName: 'Maria' });

    expect(profile.record?.firstName).toBe('Maria');
    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe('update');
    const local = await getLocal<Record<string, unknown>>('User', 'user-1');
    expect(local?.firstName).toBe('Maria');
    expect(local?._sync).toBe('pending');
  });

  it('maps updateDocument to the OAS sub-resource and reloads', async () => {
    expect.hasAssertions();
    const recorded: Array<{ url: string; method: string }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      recorded.push({ url: String(url), method: String(init?.method ?? 'GET') });
      return jsonResponse(200, recordFixture);
    }) as unknown as typeof fetch;

    const profile = useProfileStore();
    const outcome = await profile.updateDocument('doc-1', { type: 'CPF' });

    expect(outcome).toBe('updated');
    expect(recorded[0].method).toBe('PUT');
    expect(recorded[0].url).toContain('/users/user-1/updateDocument/doc-1');
    expect(recorded[1].method).toBe('GET');
  });
});
