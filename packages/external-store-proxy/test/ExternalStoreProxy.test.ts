import { BaseExternalDataRepository } from '@jumentix/external-persistence-core';
import {
  DynamoDbRepository,
  MongoMongooseRepository
} from '@jumentix/external-db-repositories';
import { ExternalStoreProxy, createExternalStores } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The file it covers carries `istanbul ignore file`, and that pragma was there
 * before this suite: nine tenths of `ExternalStoreProxy` is driver work —
 * building a Dynamo item, a Cassandra statement, a Firestore document — and
 * there is no honest way to run that without the database it is talking to.
 * Those paths belong to the integration suite and this file does not pretend
 * otherwise.
 *
 * What is here is the tenth that runs anywhere, and it is not the unimportant
 * tenth. It is the dispatch table that decides which driver serves a call, the
 * guards that refuse to work against a client nobody connected, and the entity
 * configuration that decides which table a store writes to. A fault in any of
 * them is a store that silently reads or writes the wrong thing.
 */

/** A connector that was never connected — the state every guard is about. */
const unconnected = () => new DynamoDbRepository({}) as BaseExternalDataRepository;

const proxyFor = (
  driver: string,
  entity = 'User',
  connector = unconnected()
) => new ExternalStoreProxy(driver as never, entity, connector);

/** Reaches the private configuration, which is the only record of the decision. */
const configOf = (proxy: object) => (proxy as unknown as {
  config: {
    collectionName: string;
    tableName: string;
    uniqueFields?: string[];
    caseInsensitiveUniqueFields?: string[];
    relationFields?: string[];
  };
}).config;

type TDynamoAttribute = { S?: string; NULL?: boolean };

const statics = ExternalStoreProxy as unknown as {
  parsePayload(item: Record<string, unknown> | undefined | null): Record<string, unknown> | null;
  toDynamoItem(
    id: string,
    value: Record<string, unknown>
  ): Record<string, TDynamoAttribute>;
  fromDynamoItem(item: Record<string, unknown> | undefined): Record<string, unknown> | null;
};

describe('the store map', () => {
  it('builds a User and an Organization store over one connector', () => {
    expect.hasAssertions();

    const connector = unconnected();
    const stores = createExternalStores('Mongo' as never, connector);

    expect(Object.keys(stores)).toStrictEqual(['User', 'Organization']);
    expect(stores.User).toBeInstanceOf(ExternalStoreProxy);
    expect(stores.Organization).toBeInstanceOf(ExternalStoreProxy);
  });

  /**
   * One connector, two stores. Two connectors would mean two connections where
   * the application believes there is one, and a transaction spanning both
   * would silently not be one.
   */
  it('gives both stores the same connector', () => {
    expect.hasAssertions();

    const connector = unconnected();
    const stores = createExternalStores('Mongo' as never, connector);
    const connectorOf = (store: unknown) => (store as unknown as {
      connector: BaseExternalDataRepository;
    }).connector;

    expect(connectorOf(stores.User)).toBe(connector);
    expect(connectorOf(stores.Organization)).toBe(connector);
  });
});

describe('entity configuration', () => {
  it('maps User to the users table and collection', () => {
    expect.hasAssertions();

    expect(configOf(proxyFor('Mongo', 'User'))).toMatchObject({
      collectionName: 'users',
      tableName: 'users',
      uniqueFields: ['username'],
      caseInsensitiveUniqueFields: ['username'],
      relationFields: ['organization']
    });
  });

  it('maps Organization to the organizations table and collection', () => {
    expect.hasAssertions();

    expect(configOf(proxyFor('Mongo', 'Organization'))).toMatchObject({
      collectionName: 'organizations',
      tableName: 'organizations',
      uniqueFields: ['name'],
      caseInsensitiveUniqueFields: ['name']
    });
  });

  /**
   * An entity with no configuration gets a lowercased name and no uniqueness
   * rules. The lowercasing matters: on a case-sensitive database, `Invoice`
   * and `invoice` are different tables, and one of them is empty.
   */
  it('falls back to the lowercased entity name', () => {
    expect.hasAssertions();

    expect(configOf(proxyFor('Mongo', 'Invoice'))).toStrictEqual({
      collectionName: 'invoice',
      tableName: 'invoice'
    });
  });

  it('leaves an unconfigured entity with no uniqueness rules', () => {
    expect.hasAssertions();

    const config = configOf(proxyFor('Mongo', 'Invoice'));

    expect(config.uniqueFields).toBeUndefined();
    expect(config.caseInsensitiveUniqueFields).toBeUndefined();
  });
});

/**
 * The dispatch table.
 *
 * Six methods, each a chain of driver comparisons ending in a throw. The throw
 * is the part worth pinning: `InMemory` and `IndexedDB` are real drivers this
 * proxy does not serve — they have their own stores — and a proxy that fell
 * through silently would return undefined where a record was expected.
 */
describe('an unsupported driver', () => {
  type TStore = ExternalStoreProxy<Record<string, unknown>>;
  const calls: Array<[string, (store: TStore) => Promise<unknown>]> = [
    ['create', (store) => store.create('1', { id: '1' })],
    ['update', (store) => store.update('1', { id: '1' })],
    ['delete', (store) => store.delete('1')],
    ['getOneById', (store) => store.getOneById('1')],
    ['getAll', (store) => store.getAll({}, { page: 1, size: 10 })]
  ];

  it.each(calls)('refuses %s, naming the driver and the store', async (
    _method: string,
    call: (store: TStore) => Promise<unknown>
  ) => {
    expect.hasAssertions();

    await expect(call(proxyFor('InMemory', 'User')))
      .rejects.toThrow(
        '[Database:InMemory] Store "User" is not supported by ExternalStoreProxy yet.'
      );
  });

  it.each(calls)('refuses %s for IndexedDB too', async (
    _method: string,
    call: (store: TStore) => Promise<unknown>
  ) => {
    expect.hasAssertions();

    await expect(call(proxyFor('IndexedDB', 'Organization')))
      .rejects.toThrow('[Database:IndexedDB] Store "Organization" is not supported');
  });

  it('names the entity it was asked about', async () => {
    expect.hasAssertions();

    await expect(proxyFor('InMemory', 'Invoice').delete('1'))
      .rejects.toThrow('Store "Invoice" is not supported');
  });
});

/**
 * The guards, against connectors that are real and genuinely not connected.
 *
 * Every driver family has one, and they all say the same thing for the same
 * reason: a store used before `connect()` must say so rather than fail deep
 * inside a driver with a message about a null client.
 */
describe('a client nobody connected', () => {
  it.each([
    ['DynamoDB', 'DynamoDB client is not connected'],
    ['Cassandra', 'Cassandra client is not connected'],
    ['Firebase', 'Firebase client is not connected'],
    ['Oracle', 'Oracle client is not connected'],
    ['PostgreSQL', 'SQL client is not connected']
  ])('is refused by the %s store', async (driver: string, expected: string) => {
    expect.hasAssertions();

    await expect(proxyFor(driver, 'User').getAll({}, { page: 1, size: 10 }))
      .rejects.toThrow(expected);
  });

  it('is refused by the Mongo store', async () => {
    expect.hasAssertions();

    const proxy = proxyFor('Mongo', 'User', new MongoMongooseRepository({}));

    await expect(proxy.getAll({}, { page: 1, size: 10 }))
      .rejects.toThrow('Mongo client is not connected');
  });

  /** The message tells the caller what to do, not only what went wrong. */
  it('says which call was missing', async () => {
    expect.hasAssertions();

    await expect(proxyFor('DynamoDB', 'User').getOneById('1'))
      .rejects.toThrow('Call databaseClient.connect() before accessing stores.');
  });

  it.each(['create', 'update', 'delete', 'getOneById'])('refuses %s as well', async (
    method: string
  ) => {
    expect.hasAssertions();

    const proxy = proxyFor('DynamoDB', 'User') as unknown as Record<
      string, (...args: unknown[]) => Promise<unknown>
    >;

    await expect(proxy[method]('1', { id: '1' })).rejects.toThrow('is not connected');
  });
});

describe('reading a stored payload', () => {
  it.each([[undefined], [null]])('reads %p as nothing', (item) => {
    expect.hasAssertions();

    expect(statics.parsePayload(item)).toBeNull();
  });

  it('prefers a payload that is already an object', () => {
    expect.hasAssertions();

    expect(statics.parsePayload({ payload: { id: '1' }, payload_json: '{"id":"2"}' }))
      .toStrictEqual({ id: '1' });
  });

  it('parses a payload_json column', () => {
    expect.hasAssertions();

    expect(statics.parsePayload({ payload_json: '{"id":"1","name":"a"}' }))
      .toStrictEqual({ id: '1', name: 'a' });
  });

  it('parses a payload stored as a string', () => {
    expect.hasAssertions();

    expect(statics.parsePayload({ payload: '{"id":"1"}' })).toStrictEqual({ id: '1' });
  });

  /**
   * A row that is the record itself, with no payload column. Returning the row
   * is what makes a store readable when it was written by something other than
   * this proxy.
   */
  it('takes the row itself when there is no payload column', () => {
    expect.hasAssertions();

    expect(statics.parsePayload({ id: '1', username: 'a' }))
      .toStrictEqual({ id: '1', username: 'a' });
  });
});

describe('the Dynamo item shape', () => {
  /**
   * DynamoDB has no schema, so these attribute names are the schema. The `_ci`
   * columns are what uniqueness is checked against, and a record written
   * without them is a record that can be duplicated.
   */
  it('writes the record, its id and the indexed columns', () => {
    expect.hasAssertions();

    expect(statics.toDynamoItem('u-1', {
      username: 'Alice', organization: 'org-1'
    })).toStrictEqual({
      id: { S: 'u-1' },
      payload_json: { S: JSON.stringify({ username: 'Alice', organization: 'org-1', id: 'u-1' }) },
      username: { S: 'Alice' },
      username_ci: { S: 'alice' },
      name: { NULL: true },
      name_ci: { NULL: true },
      organization: { S: 'org-1' }
    });
  });

  /**
   * The id in the payload is the one passed in, not one the caller may have put
   * in the record. Two ids that disagree is a record that cannot be found by
   * the key it was stored under.
   */
  it('overwrites an id the record disagrees about', () => {
    expect.hasAssertions();

    const item = statics.toDynamoItem('authoritative', { id: 'from-the-record' });

    expect(JSON.parse(item.payload_json.S as string).id).toBe('authoritative');
  });

  it('writes NULL for the columns the record does not fill', () => {
    expect.hasAssertions();

    expect(statics.toDynamoItem('x-1', {})).toMatchObject({
      username: { NULL: true },
      username_ci: { NULL: true },
      name: { NULL: true },
      name_ci: { NULL: true },
      organization: { NULL: true }
    });
  });

  it('lowercases the case-insensitive columns', () => {
    expect.hasAssertions();

    expect(statics.toDynamoItem('o-1', { name: 'ACME Ltd' })).toMatchObject({
      name: { S: 'ACME Ltd' },
      name_ci: { S: 'acme ltd' }
    });
  });

  it('reads a record back out of a stored item', () => {
    expect.hasAssertions();

    const stored = statics.toDynamoItem('u-1', { username: 'Alice' });

    expect(statics.fromDynamoItem(stored)).toStrictEqual({ username: 'Alice', id: 'u-1' });
  });

  it.each([
    ['no item at all', undefined],
    ['an item with no payload', {}],
    ['an item whose payload is a null attribute', { payload_json: { NULL: true } }]
  ])('reads %s as nothing', (_case: string, item) => {
    expect.hasAssertions();

    expect(statics.fromDynamoItem(item as Record<string, unknown>)).toBeNull();
  });
});

describe('finding a record by name', () => {
  /**
   * `getByName` looks up the entity's first unique field. An entity with none
   * has nothing to look up by, and saying "not found" is the honest answer —
   * the alternative would be a query on `undefined`, which most drivers accept
   * and answer with everything.
   */
  it('reports not found for an entity with no unique field', async () => {
    expect.hasAssertions();

    await expect(proxyFor('DynamoDB', 'Invoice').getByName('anything'))
      .rejects.toThrow('Record not found');
  });
});
