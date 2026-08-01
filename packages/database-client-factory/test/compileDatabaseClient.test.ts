import { buildDatabaseClientCompilers } from '../src';
import type { IDatabaseClientLike } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * This factory is how an application picks its database. It reads one
 * environment variable and returns a client, and getting the mapping wrong is
 * close to invisible: every branch returns a working-looking object, so a
 * copy-paste slip that points `MySQL` at the MSSQL connector produces an
 * application that starts, connects to nothing, and fails at the first query
 * with an error about the wrong database.
 *
 * So the thirteen driver routes are each asserted end to end — alias in,
 * connector out. Nothing is faked: the real repositories are constructed, which
 * is safe because none of them opens a connection until `connect()` is called,
 * and `connect()` is never called here. What is asserted is which connector was
 * built and what configuration it was given.
 */

/** A stand-in for the application's own in-memory client, identifiable by reference. */
const inMemoryClient = {
  connect: async () => {},
  disconnect: async () => {},
  stores: { User: {}, Organization: {} }
} as IDatabaseClientLike;

/**
 * What the factory actually decided, read off the client it returned.
 *
 * The driver name and the connector live inside the store proxy. They are
 * private, and this reaches past that deliberately: they are the only record of
 * which branch ran, and a test that cannot tell the branches apart is a test
 * that would pass with all thirteen of them wired to the same connector.
 */
const chosen = (client: IDatabaseClientLike) => {
  const proxy = client.stores.User as unknown as {
    driver: string;
    connector: {
      getProviderName(): string;
      options: { database?: string; region?: string; extra?: Record<string, unknown> };
    };
  };

  return {
    driver: proxy.driver,
    provider: proxy.connector.getProviderName(),
    options: proxy.connector.options
  };
};

/** Runs `body` with the environment applied, and puts it back afterwards. */
async function withEnvironment<T>(
  values: Record<string, string | undefined>,
  body: () => T | Promise<T>
): Promise<T> {
  const previous = Object.keys(values).map((name): [string, string | undefined] => [
    name, process.env[name]
  ]);

  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return await body();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const compilers = (indexedDbClient?: () => IDatabaseClientLike) => buildDatabaseClientCompilers({
  inMemoryClient,
  indexedDbClient
});

describe('driver aliases', () => {
  /**
   * The spellings a deployment actually writes. Each is a documented input, so
   * each is asserted rather than assumed — 'sql server' with a space is easy to
   * lose in a refactor and impossible to notice until production.
   */
  it.each([
    ['mongo', 'Mongo', 'mongoose-mongo'],
    ['mongodb', 'Mongo', 'mongoose-mongo'],
    ['mongoose', 'Mongo', 'mongoose-mongo'],
    ['MONGO', 'Mongo', 'mongoose-mongo'],
    ['  mongo  ', 'Mongo', 'mongoose-mongo'],
    ['postgres', 'PostgreSQL', 'sequelize-postgres'],
    ['postgresql', 'PostgreSQL', 'sequelize-postgres'],
    ['mysql', 'MySQL', 'sequelize-mysql'],
    ['mssql', 'MSSQL', 'sequelize-mssql'],
    ['ms sql', 'MSSQL', 'sequelize-mssql'],
    ['sqlserver', 'MSSQL', 'sequelize-mssql'],
    ['sql server', 'MSSQL', 'sequelize-mssql'],
    ['oracle', 'Oracle', 'oracle'],
    ['sqlite', 'SQLite', 'sequelize-sqlite'],
    ['sql lite', 'SQLite', 'sequelize-sqlite'],
    ['dynamodb', 'DynamoDB', 'aws-dynamodb'],
    ['dynamo', 'DynamoDB', 'aws-dynamodb'],
    ['cassandra', 'Cassandra', 'cassandra'],
    ['firebase', 'Firebase', 'firebase'],
    ['aurora', 'Aurora', 'amazon-aurora'],
    ['rds', 'RDS', 'amazon-rds']
  ])('routes %p to the %s driver on %s', (
    alias: string,
    driver: string,
    provider: string
  ) => {
    expect.hasAssertions();

    const client = compilers().compileDatabaseClientByDriver(alias);

    expect(chosen(client)).toMatchObject({ driver, provider });
  });

  it.each(['inmemory', 'in-memory', 'memory', 'InMemory', '  MEMORY  '])(
    'routes %p to the in-memory client it was given',
    (alias: string) => {
      expect.hasAssertions();

      expect(compilers().compileDatabaseClientByDriver(alias)).toBe(inMemoryClient);
    }
  );

  /**
   * An unrecognised driver falls back to in-memory rather than failing. That is
   * a decision worth pinning: a typo in the variable produces a database that
   * loses everything on restart, silently, which is either the right default
   * for a template or the worst possible one — but either way it should not
   * change by accident.
   */
  it.each([['', 'empty'], ['   ', 'blank'], ['postgre', 'a typo'], ['couchdb', 'an unsupported driver']])(
    'falls back to in-memory for %p (%s)',
    (alias: string) => {
      expect.hasAssertions();

      expect(compilers().compileDatabaseClientByDriver(alias)).toBe(inMemoryClient);
    }
  );
});

describe('reading the driver from the environment', () => {
  it('uses AAA_DATABASE_DRIVER', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_DRIVER: 'cassandra' },
      () => compilers().compileDatabaseClient()
    );

    expect(chosen(client).driver).toBe('Cassandra');
  });

  it('falls back to in-memory when the variable is unset', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_DRIVER: undefined },
      () => compilers().compileDatabaseClient()
    );

    expect(client).toBe(inMemoryClient);
  });
});

describe('the named compilers', () => {
  /**
   * Twelve one-line functions, each delegating to the same table. They are the
   * API applications actually call, and a wrong delegation here is a wrong
   * database with no error anywhere.
   */
  it.each([
    ['compileMongoDbClient', 'Mongo'],
    ['compilePostgreSqlDbClient', 'PostgreSQL'],
    ['compileMySqlDbClient', 'MySQL'],
    ['compileMsSqlDbClient', 'MSSQL'],
    ['compileOracleDbClient', 'Oracle'],
    ['compileSqliteDbClient', 'SQLite'],
    ['compileDynamoDbClient', 'DynamoDB'],
    ['compileCassandraDbClient', 'Cassandra'],
    ['compileFirebaseDbClient', 'Firebase'],
    ['compileAuroraDbClient', 'Aurora'],
    ['compileRdsDbClient', 'RDS']
  ])('%s builds the %s client', (method: string, driver: string) => {
    expect.hasAssertions();

    const built = compilers() as unknown as Record<string, () => IDatabaseClientLike>;

    expect(chosen(built[method]())).toMatchObject({ driver });
  });

  it('gives every external client a User and an Organization store', () => {
    expect.hasAssertions();

    expect(Object.keys(compilers().compileMongoDbClient().stores))
      .toStrictEqual(['User', 'Organization']);
  });

  /**
   * The delegation, actually exercised.
   *
   * DynamoDB is the driver that allows it: its `connect` builds an SDK client
   * and opens no socket, so calling it here is real rather than a stand-in.
   * The other connectors reach for a server — Oracle's `connect` spends its
   * time failing to reach port 1521 — so they are the integration suite's.
   *
   * Worth exercising at all because the client the factory returns is a plain
   * object with two arrow functions closing over the connector: if either
   * forgot to call through, `connect()` would resolve without connecting and
   * the application would start against a database it never opened.
   */
  it('wires connect and disconnect through to the connector', async () => {
    expect.hasAssertions();

    const client = compilers().compileDynamoDbClient();
    const { connector } = client.stores.User as unknown as {
      connector: { isConnected(): boolean };
    };

    expect(connector.isConnected()).toBe(false);

    await client.connect();

    expect(connector.isConnected()).toBe(true);

    await client.disconnect();

    expect(connector.isConnected()).toBe(false);
  });
});

describe('the IndexedDB driver', () => {
  const indexedDbClient = {
    connect: async () => {},
    disconnect: async () => {},
    stores: {}
  } as IDatabaseClientLike;

  /** Runs `body` with an `indexedDB` global present, and removes it afterwards. */
  const withIndexedDbGlobal = <T>(body: () => T): T => {
    const host = globalThis as unknown as { indexedDB?: unknown };
    const had = 'indexedDB' in host;
    const previous = host.indexedDB;
    host.indexedDB = { open: () => {} };

    try {
      return body();
    } finally {
      if (had) host.indexedDB = previous;
      else delete host.indexedDB;
    }
  };

  /** The mirror image: runs `body` with no `indexedDB` global, and restores it. */
  const withoutIndexedDbGlobal = <T>(body: () => T): T => {
    const host = globalThis as unknown as { indexedDB?: unknown };
    const had = 'indexedDB' in host;
    const previous = host.indexedDB;
    delete host.indexedDB;

    try {
      return body();
    } finally {
      if (had) host.indexedDB = previous;
    }
  };

  it('builds the injected client when the runtime has indexedDB', () => {
    expect.hasAssertions();

    const built = withIndexedDbGlobal(
      () => compilers(() => indexedDbClient).compileIndexedDbClient()
    );

    expect(built).toBe(indexedDbClient);
  });

  it('builds it lazily, only when the driver is selected', () => {
    expect.hasAssertions();

    let built = 0;
    const factory = () => { built += 1; return indexedDbClient; };

    const compile = compilers(factory);

    // An offline application opens its database at startup; a different driver
    // must not pay for that.
    expect(built).toBe(0);

    withIndexedDbGlobal(() => compile.compileIndexedDbClient());

    expect(built).toBe(1);
  });

  /**
   * Selected but not wired must throw. Falling back to in-memory would start an
   * offline application on a database that disappears when the tab closes,
   * while reporting nothing — it would look fine and lose everything.
   */
  it('refuses to fall back when no factory was provided', () => {
    expect.hasAssertions();

    expect(() => withIndexedDbGlobal(() => compilers().compileIndexedDbClient()))
      .toThrow('no indexedDbClient factory was provided');
  });

  it('names the driver and the fix in that message', () => {
    expect.hasAssertions();

    expect(() => withIndexedDbGlobal(() => compilers().compileIndexedDbClient()))
      .toThrow(/createCanaDatabaseClient from @jumentix\/cana/);
  });

  /**
   * Selected in a runtime with no `indexedDB` — a server-side render, or a node
   * process. Saying so is more useful than the DOMException the driver raises
   * later, several frames away from the cause.
   */
  it('refuses when the runtime has no indexedDB global', () => {
    expect.hasAssertions();

    expect(() => withoutIndexedDbGlobal(
      () => compilers(() => indexedDbClient).compileIndexedDbClient()
    )).toThrow('this runtime has no indexedDB global');
  });

  it.each(['indexeddb', 'indexed-db', 'cana', 'IndexedDB'])(
    'routes the alias %p to it',
    (alias: string) => {
      expect.hasAssertions();

      const built = withIndexedDbGlobal(
        () => compilers(() => indexedDbClient).compileDatabaseClientByDriver(alias)
      );

      expect(built).toBe(indexedDbClient);
    }
  );
});

describe('connector configuration', () => {
  it('passes the pool settings through to a SQL connector', async () => {
    expect.hasAssertions();

    const client = await withEnvironment({
      AAA_DATABASE_POOL_MAX: '42',
      AAA_DATABASE_POOL_MIN: '7',
      AAA_DATABASE_POOL_ACQUIRE_MS: '1000',
      AAA_DATABASE_POOL_IDLE_MS: '2000',
      AAA_DATABASE_POOL_EVICT_MS: '3000'
    }, () => compilers().compilePostgreSqlDbClient());

    expect(chosen(client).options.extra).toMatchObject({
      poolMax: 42, poolMin: 7, poolAcquireMs: 1000, poolIdleMs: 2000, poolEvictMs: 3000
    });
  });

  /**
   * A non-numeric pool size must not become NaN. Sequelize takes NaN without
   * complaint and the pool then behaves in ways nobody can explain from the
   * configuration.
   */
  it.each([['not-a-number'], [''], ['   ']])(
    'falls back to the default pool size for %p',
    async (value: string) => {
      expect.hasAssertions();

      const client = await withEnvironment(
        { AAA_DATABASE_POOL_MAX: value },
        () => compilers().compilePostgreSqlDbClient()
      );

      expect(chosen(client).options.extra).toMatchObject({ poolMax: 15 });
    }
  );

  it('defaults the region for DynamoDB', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_REGION: undefined },
      () => compilers().compileDynamoDbClient()
    );

    expect(chosen(client).options.region).toBe('us-east-1');
  });

  it('uses the configured region for DynamoDB', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_REGION: 'sa-east-1' },
      () => compilers().compileDynamoDbClient()
    );

    expect(chosen(client).options.region).toBe('sa-east-1');
  });

  it('splits Cassandra contact points on commas, trimming each', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_CASSANDRA_CONTACT_POINTS: ' 10.0.0.1 , 10.0.0.2 ,, ' },
      () => compilers().compileCassandraDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({
      contactPoints: ['10.0.0.1', '10.0.0.2']
    });
  });

  it.each([[undefined], ['']])('defaults Cassandra to loopback for %p', async (value) => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_CASSANDRA_CONTACT_POINTS: value },
      () => compilers().compileCassandraDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({ contactPoints: ['127.0.0.1'] });
  });

  it('defaults the Cassandra data centre', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_CASSANDRA_DATACENTER: undefined },
      () => compilers().compileCassandraDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({ localDataCenter: 'datacenter1' });
  });

  it('parses the Firebase service account JSON', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"p","private_key":"k"}' },
      () => compilers().compileFirebaseDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({
      serviceAccount: { project_id: 'p', private_key: 'k' }
    });
  });

  /**
   * Malformed JSON becomes undefined rather than throwing at startup. Whether
   * that is right is arguable — a mistyped service account produces a client
   * that fails to authenticate later rather than a process that refuses to
   * start — but it is the behaviour, and it should not change silently.
   */
  it.each([['{not json'], ['"a string"'], ['42'], ['null'], [''], ['  ']])(
    'reads the service account %p as undefined',
    async (value: string) => {
      expect.hasAssertions();

      const client = await withEnvironment(
        { AAA_FIREBASE_SERVICE_ACCOUNT_JSON: value },
        () => compilers().compileFirebaseDbClient()
      );

      expect((chosen(client).options.extra as { serviceAccount?: unknown }).serviceAccount)
        .toBeUndefined();
    }
  );

  /**
   * A JSON array is accepted, because the check is `typeof parsed === 'object'`
   * and an array passes it. The declared return type says
   * `Record<string, unknown>`, so this is the type lying rather than the code
   * deciding — a Firebase service account is never an array, and one that is
   * would be better refused here than three frames into the SDK.
   *
   * Pinned as it stands. Narrowing the check is a one-line change but it turns
   * a startup that limps into a startup that stops, and that is a decision for
   * whoever owns the deployment.
   */
  it('accepts a JSON array as a service account, which it should not', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_FIREBASE_SERVICE_ACCOUNT_JSON: '[1,2]' },
      () => compilers().compileFirebaseDbClient()
    );

    expect((chosen(client).options.extra as { serviceAccount?: unknown }).serviceAccount)
      .toStrictEqual([1, 2]);
  });

  it('defaults the Oracle credentials', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_USER: undefined, AAA_DATABASE_PASSWORD: undefined },
      () => compilers().compileOracleDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({ user: 'aaa', password: 'aaa' });
  });

  it.each([
    ['mysql', 'mysql'],
    ['MYSQL', 'mysql'],
    ['  mssql  ', 'mssql'],
    ['sqlite', 'sqlite'],
    ['oracle', 'oracle'],
    ['postgres', 'postgres']
  ])('reads the RDS dialect %p as %p', async (configured: string, expected: string) => {
    expect.hasAssertions();

    const client = await withEnvironment(
      { AAA_DATABASE_DIALECT: configured },
      () => compilers().compileRdsDbClient()
    );

    expect(chosen(client).options.extra).toMatchObject({ dialect: expected });
  });

  it.each([[undefined], ['cockroach'], ['']])(
    'falls back to postgres for the RDS dialect %p',
    async (value) => {
      expect.hasAssertions();

      const client = await withEnvironment(
        { AAA_DATABASE_DIALECT: value },
        () => compilers().compileRdsDbClient()
      );

      expect(chosen(client).options.extra).toMatchObject({ dialect: 'postgres' });
    }
  );
});
