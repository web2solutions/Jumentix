/* eslint-disable jest/max-expects, jest/prefer-expect-assertions */
import { CatalogService } from '@src/modules/Catalogs/service/CatalogService';
import { CatalogDataRepository } from '@src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { CatalogUseCases } from '@src/modules/Catalogs/application/use-cases/CatalogUseCases';
import { deleteCatalogById } from '@src/modules/Catalogs/features/deleteCatalogById';
import { getAllCatalogs } from '@src/modules/Catalogs/features/getAllCatalogs';
import { restoreCatalog } from '@src/modules/Catalogs/features/restoreCatalog';
import { updateCatalog } from '@src/modules/Catalogs/features/updateCatalog';
import { CatalogIntegrationEventName } from '@src/modules/Catalogs/events/contracts/CatalogIntegrationEventName';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
// eslint-disable-next-line import/no-unresolved
import { InMemoryMessageMediatorAdapter } from '@jumentix/message-mediator';

/**
 * Core unit suite for the shared catalog (JUM-491), running the REAL service,
 * the REAL repository and the REAL in-memory store, with the REAL in-memory
 * mediator adapter — the optimistic-concurrency model and the event flow
 * asserted here are the production behavior, not a description of it:
 *
 * - the concurrency unit is the catalog record (one shared domain design);
 * - `version` is the server-managed token: create starts at 1, every write
 *   bumps it, and a stale expected version is rejected with a ConflictError
 *   whose metadata carries the current version AND the current record — the
 *   reviewable rejection path (the client reconciles, the edit is not lost);
 * - deletion is a tombstone: the record survives, propagates through the
 *   includeDeleted feed, and is recoverable via restore;
 * - every successful write publishes its `catalogs.catalog.*` integration
 *   event on the mediator with the new version, and a failing event bus never
 *   breaks the primary write.
 */

const createDatabaseClient = (): {
  databaseClient: IDatabaseClient;
  store: InMemoryRelationalStore<ICatalog>;
} => {
  const store = new InMemoryRelationalStore<ICatalog>({ relationIndexes: ['organization'] });
  const databaseClient = {
    stores: { Catalog: store },
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve()
  } as unknown as IDatabaseClient;
  return { databaseClient, store };
};

const createServiceStack = (eventBus?: any) => {
  const { databaseClient, store } = createDatabaseClient();
  const dataRepository = CatalogDataRepository.compile({ databaseClient });
  const catalogService = CatalogService.compile({
    dataRepository,
    services: { eventBus }
  });
  const catalogUseCases = CatalogUseCases.compile(catalogService);
  return {
    store, dataRepository, catalogService, catalogUseCases
  };
};

const designV1 = { entities: [{ name: 'Invoice', fields: [{ name: 'total', type: 'number' }] }] };

describe('catalogService — optimistic concurrency and events', () => {
  it('creates a record at version 1 and publishes catalogs.catalog.created', async () => {
    expect.hasAssertions();
    const mediator = new InMemoryMessageMediatorAdapter();
    const observed: any[] = [];
    mediator.subscribe(CatalogIntegrationEventName.Created, (event) => { observed.push(event); });
    const { catalogUseCases } = createServiceStack(mediator);

    const { result, error } = await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    }, 'admin@xpertminds.dev');

    expect(error).toBeUndefined();
    expect(result?.version).toBe(1);
    expect(result?.organization).toBe('org-1');
    expect(result?.createdBy).toBe('admin@xpertminds.dev');
    expect(observed).toHaveLength(1);
    expect(observed[0].payload).toMatchObject({
      id: result?.id, organization: 'org-1', version: 1, actor: 'admin@xpertminds.dev'
    });
  });

  it('updates with the current version, bumps the token and publishes catalogs.catalog.updated', async () => {
    expect.hasAssertions();
    const mediator = new InMemoryMessageMediatorAdapter();
    const observed: any[] = [];
    mediator.subscribe(CatalogIntegrationEventName.Updated, (event) => { observed.push(event); });
    const { catalogUseCases } = createServiceStack(mediator);
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    }, 'admin@xpertminds.dev')).result!;

    const designV2 = { entities: [{ name: 'Invoice', fields: [{ name: 'total', type: 'number' }, { name: 'dueAt', type: 'date' }] }] };
    const { result, error } = await catalogUseCases.update(created.id, {
      version: 1, design: designV2
    }, 'user@xpertminds.dev');

    expect(error).toBeUndefined();
    expect(result?.version).toBe(2);
    expect(result?.design).toStrictEqual(designV2);
    expect(result?.updatedBy).toBe('user@xpertminds.dev');
    expect(observed).toHaveLength(1);
    expect(observed[0].payload).toMatchObject({ id: created.id, version: 2 });
  });

  it('rejects a stale update with the current version and record in the error metadata', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack();
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;
    await catalogUseCases.update(created.id, { version: 1, description: 'moved on' });

    const { result, error } = await catalogUseCases.update(created.id, {
      version: 1, description: 'stale edit'
    });

    expect(result).toBeUndefined();
    expect(error).toBeDefined();
    expect((error as any).code).toBe('GENERIC.CONFLICT');
    const metadata = (error as any).metadata as any;
    expect(metadata.catalogId).toBe(created.id);
    expect(metadata.expectedVersion).toBe(1);
    expect(metadata.currentVersion).toBe(2);
    expect(metadata.current.description).toBe('moved on');
  });

  it('a rejected stale write leaves the server record untouched — the loser reconciles', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack();
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;
    await catalogUseCases.update(created.id, { version: 1, description: 'winner' });
    await catalogUseCases.update(created.id, { version: 1, description: 'loser' });

    const current = (await catalogUseCases.getOneById(created.id)).result!;
    expect(current.description).toBe('winner');
    expect(current.version).toBe(2);
  });

  it('delete tombstones the record: it survives, leaves the default feed and publishes catalogs.catalog.deleted', async () => {
    expect.hasAssertions();
    const mediator = new InMemoryMessageMediatorAdapter();
    const observed: any[] = [];
    mediator.subscribe(CatalogIntegrationEventName.Deleted, (event) => { observed.push(event); });
    const { catalogUseCases } = createServiceStack(mediator);
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;

    const { result, error } = await catalogUseCases.delete(created.id, 1, 'admin@xpertminds.dev');
    expect(error).toBeUndefined();
    expect(result).toBe(true);

    const tombstoned = (await catalogUseCases.getOneById(created.id)).result!;
    expect(tombstoned.deletedAt).not.toBe('');
    expect(tombstoned.version).toBe(2);

    const active = await catalogUseCases.getAll({}, { page: 1, size: 10 });
    expect(active.result).toHaveLength(0);
    const withDeleted = await catalogUseCases.getAll(
      {},
      { page: 1, size: 10 },
      { includeDeleted: true }
    );
    expect(withDeleted.result).toHaveLength(1);
    expect(withDeleted.result?.[0].deletedAt).not.toBe('');

    expect(observed).toHaveLength(1);
    expect(observed[0].payload).toMatchObject({ id: created.id, version: 2 });
  });

  it('rejects a stale delete', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack();
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;
    await catalogUseCases.update(created.id, { version: 1, description: 'moved on' });

    const { result, error } = await catalogUseCases.delete(created.id, 1);
    expect(result).toBeUndefined();
    expect((error as any).code).toBe('GENERIC.CONFLICT');
    const current = (await catalogUseCases.getOneById(created.id)).result!;
    expect(current.deletedAt).toBe('');
  });

  it('restore recovers a tombstoned record, bumps the version and publishes catalogs.catalog.restored', async () => {
    expect.hasAssertions();
    const mediator = new InMemoryMessageMediatorAdapter();
    const observed: any[] = [];
    mediator.subscribe(CatalogIntegrationEventName.Restored, (event) => { observed.push(event); });
    const { catalogUseCases } = createServiceStack(mediator);
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;
    await catalogUseCases.delete(created.id, 1);

    const { result, error } = await catalogUseCases.restore(created.id, 2, 'admin@xpertminds.dev');
    expect(error).toBeUndefined();
    expect(result?.deletedAt).toBe('');
    expect(result?.version).toBe(3);

    const active = await catalogUseCases.getAll({}, { page: 1, size: 10 });
    expect(active.result).toHaveLength(1);
    expect(observed).toHaveLength(1);
    expect(observed[0].payload).toMatchObject({ id: created.id, version: 3 });
  });

  it('a failing event bus never breaks the primary write', async () => {
    expect.hasAssertions();
    const failingBus = { publish: () => Promise.reject(new Error('broker down')) };
    const { catalogUseCases } = createServiceStack(failingBus);
    const { result, error } = await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    });
    expect(error).toBeUndefined();
    expect(result?.version).toBe(1);
  });

  it('writes without any event bus configured still succeed', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack(undefined);
    const created = (await catalogUseCases.create({
      organization: 'org-1', name: 'Billing', design: designV1
    })).result!;
    const { error } = await catalogUseCases.update(created.id, { version: 1, description: 'no bus' });
    expect(error).toBeUndefined();
  });

  it('scopes the collection by organization filter', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack();
    await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design: designV1 });
    await catalogUseCases.create({ organization: 'org-2', name: 'Shipping', design: designV1 });

    const orgOne = await catalogUseCases.getAll({ organization: 'org-1' }, { page: 1, size: 10 });
    expect(orgOne.result).toHaveLength(1);
    expect(orgOne.result?.[0].name).toBe('Billing');
  });

  it('rejects an update of a missing record as not found', async () => {
    expect.hasAssertions();
    const { catalogUseCases } = createServiceStack();
    const { error } = await catalogUseCases.update(
      '123e4567-e89b-42d3-a456-426614174000',
      { version: 1, description: 'ghost' }
    );
    expect((error as any).code).toBe('GENERIC.NOT_FOUND');
  });
});

describe('catalog feature functions — repository port mapping', () => {
  it('serializes empty list results and forwards default actors', async () => {
    expect.hasAssertions();
    const repository = {
      getAll: jest.fn().mockResolvedValue({
        result: undefined, page: 1, size: 10, total: 0
      }),
      delete: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue({ serialize: () => ({ id: 'catalog-1', version: 2 }) }),
      restore: jest.fn().mockResolvedValue({ serialize: () => ({ id: 'catalog-1', version: 3 }) })
    };

    await expect(getAllCatalogs({ organization: 'org-1' }, { page: 1, size: 10 }, repository as never))
      .resolves.toMatchObject({ result: [] });
    await expect(deleteCatalogById('catalog-1', 2, repository as never)).resolves.toBe(true);
    await expect(updateCatalog('catalog-1', { version: 1 }, repository as never))
      .resolves.toStrictEqual({ id: 'catalog-1', version: 2 });
    await expect(restoreCatalog('catalog-1', 2, repository as never))
      .resolves.toStrictEqual({ id: 'catalog-1', version: 3 });

    expect(repository.delete).toHaveBeenCalledWith('catalog-1', 2, '');
    expect(repository.update).toHaveBeenCalledWith('catalog-1', { version: 1 }, '');
    expect(repository.restore).toHaveBeenCalledWith('catalog-1', 2, '');
  });
});
