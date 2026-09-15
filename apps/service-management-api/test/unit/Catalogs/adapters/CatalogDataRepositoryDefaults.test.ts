import { CatalogDataRepository } from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';

/**
 * The catalog repository called the way the service calls it (JUM-681/JUM-491).
 *
 * The boundary suite drives this adapter through the use cases, which always
 * pass a complete request: every field, an explicit version, an actor. The
 * HTTP layer does not — a PATCH carries the one field that changed, a delete
 * carries no actor when the token has no subject, and a listing carries no
 * paging at all.
 *
 * Each of those lands on a fallback here, and each fallback decides something
 * real: a `?? current.name` that resolved to `undefined` would blank the field
 * the caller did not mention, and an `expectedVersion ?? -1` that defaulted to
 * the current version instead would let an unconditional delete through the
 * optimistic-concurrency check.
 *
 * The store is the repository's real in-memory one — no doubles here.
 */
const makeRepository = (limit?: number) => {
  const store = new InMemoryRelationalStore<ICatalog>({ relationIndexes: ['organization'] });
  const databaseClient = {
    stores: { Catalog: store },
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve()
  } as unknown as IDatabaseClient;

  return CatalogDataRepository.compile({ databaseClient, limit }) as CatalogDataRepository;
};

const seed = (repository: CatalogDataRepository) => repository.create({
  organization: 'org-1',
  name: 'Billing',
  description: 'the billing domain',
  design: { kind: 'domain-package', version: 1 },
  provenance: { author: 'a' }
} as never);

describe('catalog repository fallbacks (JUM-681)', () => {
  it('keeps every field the update did not mention', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const created = await seed(repository);

    const updated = await repository.update(created.id, { version: 1 } as never);

    expect(updated.name).toBe('Billing');
    expect(updated.description).toBe('the billing domain');
    expect(updated.design).toStrictEqual({ kind: 'domain-package', version: 1 });
    expect(updated.provenance).toStrictEqual({ author: 'a' });
    expect(updated.version).toBe(2);
  });

  it('replaces only the fields the update did mention', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const created = await seed(repository);

    const updated = await repository.update(
      created.id,
      { version: 1, name: 'Invoicing' } as never,
      'actor-1'
    );

    expect(updated.name).toBe('Invoicing');
    expect(updated.description).toBe('the billing domain');
  });

  it('refuses a stale update, carrying the current version and record', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const created = await seed(repository);

    const conflict = await repository.update(created.id, { version: 9 } as never)
      .then(() => null)
      .catch((error: unknown) => error as Error & { metadata?: { currentVersion?: number } });

    expect(conflict?.message).toContain('expected 9, current is 1');
    expect(conflict?.metadata?.currentVersion).toBe(1);
  });

  it('refuses a delete that names no version at all', async () => {
    expect.hasAssertions();

    // No `expectedVersion` means the caller has not read the record, so the
    // check must fail rather than default to whatever the current version is —
    // an unconditional delete is exactly what the concurrency check exists to
    // stop.
    const repository = makeRepository();
    const created = await seed(repository);

    await expect(repository.delete(created.id)).rejects.toThrow('expected -1, current is 1');
  });

  it('tombstones with the version the caller read, and with no actor', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const created = await seed(repository);

    const deleted = await repository.delete(created.id, 1);
    const stored = await repository.getOneById(created.id);

    expect(deleted).toBe(true);
    expect(stored.deletedAt).not.toBe('');
  });

  it('restores a tombstoned record at its current version', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const created = await seed(repository);
    await repository.delete(created.id, 1);
    const tombstoned = await repository.getOneById(created.id);

    const restored = await repository.restore(created.id, tombstoned.version);

    expect(restored.deletedAt).toBe('');
  });

  it('hides tombstoned records from a listing unless asked for them', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    const kept = await seed(repository);
    const removed = await seed(repository);
    await repository.delete(removed.id, 1);

    const listed = await repository.getAll({}, { page: 1, size: 10 });
    const withDeleted = await repository.getAll(
      {},
      { page: 1, size: 10 },
      { includeDeleted: true }
    );

    expect(listed.result.map((row) => row.id)).toStrictEqual([kept.id]);
    expect(withDeleted.result).toHaveLength(2);
  });

  it('falls back to the configured page size when the request carries no paging', async () => {
    expect.hasAssertions();

    // The listing endpoint accepts a bare query. The store answers a request
    // with no page or size with nothing — the repository's job here is to
    // report the paging it actually applied, so the client can ask again with
    // real numbers instead of reading an empty page as an empty catalog.
    const repository = makeRepository(7);
    await seed(repository);

    const listed = await repository.getAll({}, {} as never);

    expect(listed.page).toBe(1);
    expect(listed.size).toBe(7);
  });

  it('uses the default page size when the repository was configured without one', async () => {
    expect.hasAssertions();

    const repository = makeRepository();
    await seed(repository);

    const listed = await repository.getAll({}, {} as never);

    expect(listed.size).toBeGreaterThan(0);
  });

  it('refuses to create a catalog with no name', async () => {
    expect.hasAssertions();

    await expect(makeRepository().create({ organization: 'org-1', name: '' } as never))
      .rejects.toThrow('name can not be empty');
  });

  it('reports a missing record rather than returning an empty one', async () => {
    expect.hasAssertions();

    await expect(makeRepository().getOneById('00000000-0000-4000-8000-000000000000'))
      .rejects.toThrow('Record not found');
  });
});

describe('catalog repository paging fallbacks with a minimal driver', () => {
  it('reports the paging it applied when the driver omits page, size and result', async () => {
    expect.hasAssertions();

    // IPagingResponse marks page/size/result optional: a driver that answers
    // only `total` still satisfies the contract, and the repository must fall
    // back to the paging it sent rather than echo undefined to the client.
    const store = {
      getAll: async () => ({ total: 0 })
    };
    const databaseClient = {
      stores: { Catalog: store },
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve()
    } as unknown as IDatabaseClient;
    const repository = CatalogDataRepository.compile({ databaseClient, limit: 7 });

    const listed = await repository.getAll({}, {} as never);

    expect(listed).toStrictEqual({
      page: 1,
      size: 7,
      total: 0,
      result: []
    });
  });
});
