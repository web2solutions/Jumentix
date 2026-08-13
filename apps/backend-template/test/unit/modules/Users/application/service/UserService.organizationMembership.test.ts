import { UserService } from '@src/modules/Users/service/UserService';

/**
 * Concurrent membership edits, and the update they used to lose (JUM-687).
 *
 * `syncOrganizationUsers` reads an organization, edits its `users` array and
 * writes the whole thing back. Two of those interleaved lose one edit — both
 * read the same array, and the second write erases the first. The user exists
 * and is not a member, which is what a request about it sees as a 404 or a 403
 * depending on which check runs first.
 *
 * The repository double below makes the interleaving explicit rather than
 * hoping for it: its `getOneById` resolves on a later turn than its `update`,
 * which is what any real store does and what a loaded runner does more often.
 * **Run against the unserialised code, the last assertion here fails**, which is
 * the point — this is the failure the queue prevents, not a test of the queue.
 *
 * What it does not prove: that this is the cause of the three CI observations on
 * JUM-687. Those have never reproduced locally, and this is hardening on the
 * path whose symptoms match, not a demonstrated fix.
 */
type Organization = { id: string; name: string; users: string[] };

function slowOrganizationRepository(organization: Organization) {
  const state: Organization = { ...organization, users: [...organization.users] };
  const reads: number[] = [];

  return {
    state,
    reads,
    async getOneById() {
      // Two turns of the loop between read and write: enough for a second
      // caller to read the same array before the first one writes it back.
      await Promise.resolve();
      await Promise.resolve();
      reads.push(state.users.length);
      return { ...state, users: [...state.users] };
    },
    async update(id: string, data: { users: string[] }) {
      state.users = [...data.users];
      return { ...state };
    }
  };
}

/** Reaches the private sync through the instance, without a full composition. */
function syncFor(repository: unknown) {
  const service = Object.create(UserService.prototype) as Record<string, unknown>;
  service.organizationDataRepository = repository;
  return (userId: string, previous: string, next: string): Promise<void> => (
    service as unknown as {
      syncOrganizationUsers: (u: string, p: string, n: string) => Promise<void>;
    }
  ).syncOrganizationUsers.call(service, userId, previous, next);
}

describe('organization membership under concurrency (JUM-687)', () => {
  it('keeps every concurrent member, losing none to the last writer', async () => {
    expect.hasAssertions();

    const repository = slowOrganizationRepository({ id: 'org-1', name: 'Acme', users: [] });
    const sync = syncFor(repository);
    const ids = Array.from({ length: 12 }, (_, index) => `user-${String(index)}`);

    await Promise.all(ids.map((id) => sync(id, '', 'org-1')));

    // Unserialised, this array holds one or two ids: every writer read an empty
    // list and wrote its own.
    expect([...repository.state.users].sort()).toStrictEqual([...ids].sort());
  });

  it('removes a member without dropping the ones added beside it', async () => {
    expect.hasAssertions();

    // The other direction: a move out of an organization races the moves in.
    const repository = slowOrganizationRepository({
      id: 'org-1', name: 'Acme', users: ['leaving']
    });
    const sync = syncFor(repository);

    await Promise.all([
      sync('leaving', 'org-1', ''),
      sync('arriving-1', '', 'org-1'),
      sync('arriving-2', '', 'org-1')
    ]);

    expect([...repository.state.users].sort()).toStrictEqual(['arriving-1', 'arriving-2']);
  });

  it('does not let one failed write poison the ones queued behind it', async () => {
    expect.hasAssertions();

    // A queue that chains on `then` alone would reject every later write after
    // the first failure, turning one bad edit into an outage.
    const repository = slowOrganizationRepository({ id: 'org-1', name: 'Acme', users: [] });
    const sync = syncFor(repository);
    const originalUpdate = repository.update.bind(repository);
    // The first write fails and every later one succeeds, expressed as a queue
    // of behaviours rather than a branch — the lint rule against conditionals in
    // tests is right that a branch here can hide which case actually ran.
    const behaviours: Array<(id: string, data: { users: string[] }) => Promise<unknown>> = [
      async () => { throw new Error('store unavailable'); },
      originalUpdate
    ];
    repository.update = async (id: string, data: { users: string[] }) => {
      const [behaviour = originalUpdate] = behaviours.splice(0, 1);
      return behaviour(id, data) as Promise<{ id: string; name: string; users: string[] }>;
    };

    const results = await Promise.allSettled([
      sync('user-a', '', 'org-1'),
      sync('user-b', '', 'org-1')
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(repository.state.users).toStrictEqual(['user-b']);
  });
});
