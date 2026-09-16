import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import { usePermissions } from '@/contracts/usePermissions';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore, type UserRecord } from '@/stores/profile';

const recordFixture: UserRecord = {
  id: 'user-1',
  firstName: 'Abraham',
  username: 'me@mydomain.com',
  roles: ['user'],
  emails: [{
    id: 'e1', type: 'work', email: 'me@mydomain.com', isPrimary: true
  }],
  documents: [],
  phones: []
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

/** usePermissions (JUM-772): roles come from the profile record, loaded on demand. */
describe('usePermissions (JUM-772)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    resetSharedApiClient();
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'user-1';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads the profile on demand and exposes role-based checks', async () => {
    expect.hasAssertions();
    globalThis.fetch = mock(
      async () => jsonResponse(200, recordFixture)
    ) as unknown as typeof fetch;
    const { roles, ensure, canOp } = usePermissions();
    expect([...roles.value]).toStrictEqual([]);
    await ensure();
    expect([...roles.value]).toStrictEqual(['user']);
    expect(canOp('getAll').value).toBe(true);
    expect(canOp('getAllOrganizations').value).toBe(false);
  });

  it('fails closed when the profile cannot be loaded', async () => {
    expect.hasAssertions();
    globalThis.fetch = mock(async () => jsonResponse(500, { message: 'boom' })) as unknown as typeof fetch;
    const { roles, ensure, canOp } = usePermissions();
    await ensure();
    expect([...roles.value]).toStrictEqual([]);
    expect(useProfileStore().record).toBeNull();
    expect(canOp('getAll').value).toBe(false);
  });
});
