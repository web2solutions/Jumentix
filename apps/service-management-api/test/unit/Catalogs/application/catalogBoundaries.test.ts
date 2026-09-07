/* eslint-disable jest/max-expects */
import { CatalogCreateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogCreateRequestEvent';
import { CatalogUpdateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogUpdateRequestEvent';
import { CatalogDeleteRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogDeleteRequestEvent';
import { CatalogRestoreRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogRestoreRequestEvent';
import { CatalogGetAllRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetAllRequestEvent';
import { CatalogGetOneRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetOneRequestEvent';
import { CatalogService } from '@service-management-api/modules/Catalogs/service/CatalogService';
import { CatalogDataRepository } from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { CatalogUseCases } from '@service-management-api/modules/Catalogs/application/use-cases/CatalogUseCases';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';

/**
 * Boundary suite for the shared catalog (JUM-491): every request-event class
 * fails closed on an incomplete message, and every service method surfaces
 * its error channel instead of throwing past the `IServiceResponse`
 * contract — the failure modes the HTTP layer relies on.
 */
describe('catalog request events fail closed', () => {
  const cases: Array<[string, any, Record<string, any>]> = [
    ['create', CatalogCreateRequestEvent, { input: { name: 'Billing' } }],
    ['update', CatalogUpdateRequestEvent, { params: { id: 'x' }, input: { version: 1 } }],
    ['delete', CatalogDeleteRequestEvent, { params: { id: 'x' }, queryString: { version: '1' } }],
    ['restore', CatalogRestoreRequestEvent, { params: { id: 'x' }, input: { version: 1 } }],
    ['getAll', CatalogGetAllRequestEvent, { queryString: { page: '1' } }],
    ['getOneById', CatalogGetOneRequestEvent, { params: { id: 'x' } }]
  ];

  it.each(cases)('%s rejects a message without authorization', (_name, EventClass, message) => {
    expect.hasAssertions();
    expect(() => new EventClass(message)).toThrow('message.authorization can not be empty');
  });

  it.each(cases)('%s carries entity Catalog and its action', (name, EventClass, message) => {
    expect.hasAssertions();
    const event = new EventClass({ ...message, authorization: 'Bearer token' });
    expect(event.entity).toBe('Catalog');
    expect(event.action).toBe(name);
  });
});

describe('catalogService error channels', () => {
  const createStack = () => {
    const store = new InMemoryRelationalStore<ICatalog>({ relationIndexes: ['organization'] });
    const databaseClient = {
      stores: { Catalog: store },
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve()
    } as unknown as IDatabaseClient;
    const dataRepository = CatalogDataRepository.compile({ databaseClient });
    const catalogService = CatalogService.compile({ dataRepository, services: {} });
    return CatalogUseCases.compile(catalogService);
  };

  it('create surfaces a domain validation error instead of throwing', async () => {
    expect.hasAssertions();
    const catalogUseCases = createStack();
    const { result, error } = await catalogUseCases.create({
      organization: 'org-1', name: '', design: {}
    });
    expect(result).toBeUndefined();
    expect((error as any).message).toContain('name can not be empty');
  });

  it('getOneById surfaces an invalid id', async () => {
    expect.hasAssertions();
    const catalogUseCases = createStack();
    const { error } = await catalogUseCases.getOneById('not-a-uuid');
    expect(error).toBeDefined();
  });

  it('delete surfaces an invalid id', async () => {
    expect.hasAssertions();
    const catalogUseCases = createStack();
    const { error } = await catalogUseCases.delete('not-a-uuid', 1);
    expect(error).toBeDefined();
  });

  it('restore surfaces an invalid id', async () => {
    expect.hasAssertions();
    const catalogUseCases = createStack();
    const { error } = await catalogUseCases.restore('not-a-uuid', 1);
    expect(error).toBeDefined();
  });

  it('getAll surfaces a paging error', async () => {
    expect.hasAssertions();
    const catalogUseCases = createStack();
    await catalogUseCases.create({ organization: 'org-1', name: 'Billing', design: {} });
    const { error } = await catalogUseCases.getAll({}, { page: 99, size: 10 });
    expect(error).toBeDefined();
  });
});
