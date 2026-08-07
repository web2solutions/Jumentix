import {
  AuroraRepository,
  CassandraRepository,
  DynamoDbRepository,
  FirebaseRepository,
  MongoMongooseRepository,
  OracleRepository,
  RdsRepository,
  SqlSequelizeRepository
} from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * Eight adapters, each a thin layer between the application and a database
 * driver, and every one of them previously covered only by whatever the backend
 * application happened to exercise. Thin is the point: what these classes do is
 * resolve a module, assemble a configuration and set a flag, and all three are
 * the kind of thing that is wrong silently. A pool size that never reaches the
 * driver, a `connected` flag set before the connection succeeded, a
 * `disconnect` that leaves the client in place — none of them fail loudly, and
 * all of them are visible from here.
 *
 * No servers and no doubles. Where a driver can work offline it is used for
 * real: `postgres` and the DynamoDB SDK build clients without opening a socket,
 * and Sequelize assembles and closes a real connection pool when told not to
 * authenticate on connect. Where a driver must reach a host, the
 * connection is allowed to fail against a port with nothing on it — that failure
 * runs the same code, and what it proves is that the failure is reported rather
 * than swallowed and that no half-built state is left behind. Every one of them
 * fails in under a second.
 *
 * What is deliberately not here: anything that needs a live Mongo, Cassandra,
 * Oracle or Firestore. That is the integration suite's, and this file says so
 * rather than pretending.
 */

/** Reaches the protected connection state that every repository shares. */
const state = (repository: object) => repository as unknown as {
  isConnected(): boolean;
  getProviderName(): string;
  getClient(): unknown;
};

describe('provider names', () => {
  /**
   * The provider name appears in every error these repositories raise. A wrong
   * one sends whoever is reading the logs to the wrong database.
   */
  it.each([
    ['mongoose-mongo', new MongoMongooseRepository({})],
    ['sequelize-postgres', new SqlSequelizeRepository({ dialect: 'postgres' })],
    ['sequelize-mysql', new SqlSequelizeRepository({ dialect: 'mysql' })],
    ['sequelize-sqlite', new SqlSequelizeRepository({ dialect: 'sqlite' })],
    ['aws-dynamodb', new DynamoDbRepository({})],
    ['cassandra', new CassandraRepository({})],
    ['firebase', new FirebaseRepository({})],
    ['amazon-aurora', new AuroraRepository({})],
    ['amazon-rds', new RdsRepository({})],
    ['oracle', new OracleRepository({})]
  ])('is %p', (provider: string, repository: object) => {
    expect.hasAssertions();

    expect(state(repository).getProviderName()).toBe(provider);
  });

  /**
   * The provider is set by each subclass over whatever the caller passed. A
   * caller that supplies its own must not be able to mislabel the connector.
   */
  it('overrides a provider supplied by the caller', () => {
    expect.hasAssertions();

    expect(state(new DynamoDbRepository({ provider: 'not-dynamo' })).getProviderName())
      .toBe('aws-dynamodb');
  });
});

describe('the state every repository starts in', () => {
  const built = () => [
    new MongoMongooseRepository({}),
    new SqlSequelizeRepository({ dialect: 'postgres' }),
    new DynamoDbRepository({}),
    new CassandraRepository({}),
    new FirebaseRepository({}),
    new AuroraRepository({}),
    new RdsRepository({}),
    new OracleRepository({})
  ];

  it('is disconnected, with no client', () => {
    expect.hasAssertions();

    for (const repository of built()) {
      expect(state(repository).isConnected()).toBe(false);
      expect(state(repository).getClient()).toBeNull();
    }
  });

  /**
   * `disconnect` before `connect` has to be safe. Shutdown paths call it
   * unconditionally, and a throw there masks whatever actually went wrong.
   */
  it('survives a disconnect that was never preceded by a connect', async () => {
    expect.hasAssertions();

    const repositories = built();

    await Promise.all(repositories.map(
      (repository) => expect((repository as { disconnect(): Promise<void> }).disconnect())
        .resolves.toBeUndefined()
    ));

    for (const repository of repositories) {
      expect(state(repository).isConnected()).toBe(false);
    }
  });
});

/**
 * The real Sequelize, with authentication on connect turned off.
 *
 * That flag is what separates "the pool was assembled" from "the database
 * answered", and turning it off is a supported configuration rather than a
 * testing trick — it is how an application defers the first connection to its
 * first query. So the client below is real, its configuration is real, and
 * `close()` really closes it; only the round trip to a server is absent, and
 * the last test in this block is the one that requires it.
 *
 * SQLite in memory would have made even that unnecessary, but it needs the
 * `sqlite3` package, and adding a dependency to the whole repository — through
 * an install that runs a vulnerability scan over every package — to make one
 * test marginally more direct is not a trade worth making.
 */
describe('the Sequelize repository', () => {
  const deferred = (extra: Record<string, unknown> = {}) => new SqlSequelizeRepository({
    dialect: 'postgres',
    connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger',
    extra: { sequelizeAuthenticateOnConnect: false, ...extra }
  });

  it('builds a client and reports connected', async () => {
    expect.hasAssertions();

    const repository = deferred();

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
      expect(repository.getClient()).not.toBeNull();
    } finally {
      await repository.disconnect();
    }
  });

  it('closes the client and forgets it on disconnect', async () => {
    expect.hasAssertions();

    const repository = deferred();
    await repository.connect();
    await repository.disconnect();

    // Forgotten, not merely closed: a stale handle would be reused by the next
    // connect and every query would fail against a closed connection.
    expect(repository.getClient()).toBeNull();
    expect(repository.isConnected()).toBe(false);
  });

  it('reports its dialect', () => {
    expect.hasAssertions();

    expect(new SqlSequelizeRepository({ dialect: 'mssql' }).getDialect()).toBe('mssql');
  });

  /**
   * The pool settings are the reason `extra` exists. Passed but never applied,
   * an application would run on Sequelize's defaults while its configuration
   * said otherwise — invisible until the connection count is wrong in
   * production.
   */
  it('passes the pool settings to the driver', async () => {
    expect.hasAssertions();

    const repository = deferred({
      poolMax: 3,
      poolMin: 1,
      poolAcquireMs: 111,
      poolIdleMs: 222,
      poolEvictMs: 333
    });

    try {
      await repository.connect();

      expect((repository.getClient() as { options: { pool: unknown } }).options.pool)
        .toMatchObject({
          max: 3, min: 1, acquire: 111, idle: 222, evict: 333
        });
    } finally {
      await repository.disconnect();
    }
  });

  it('applies its own pool defaults when none are given', async () => {
    expect.hasAssertions();

    const repository = deferred();

    try {
      await repository.connect();

      expect((repository.getClient() as { options: { pool: unknown } }).options.pool)
        .toMatchObject({
          max: 15, min: 0, acquire: 30000, idle: 10000, evict: 1000
        });
    } finally {
      await repository.disconnect();
    }
  });

  /**
   * Authentication on connect is the difference between "the object was built"
   * and "the database answered". It defaults to on, and turning it off is what
   * lets this test build a client for a server that is not there.
   */
  it('skips authentication when told to, building the client anyway', async () => {
    expect.hasAssertions();

    const repository = new SqlSequelizeRepository({
      dialect: 'postgres',
      database: 'orders',
      extra: { sequelizeAuthenticateOnConnect: false }
    });

    try {
      await repository.connect();

      // No server was reached, and the default connection URL was assembled
      // from the dialect and the database name.
      expect(repository.isConnected()).toBe(true);
      expect((repository.getClient() as { config: { database: string } }).config.database)
        .toBe('orders');
    } finally {
      await repository.disconnect();
    }
  });

  it('names the database "app" when none was configured', async () => {
    expect.hasAssertions();

    const repository = new SqlSequelizeRepository({
      dialect: 'postgres',
      extra: { sequelizeAuthenticateOnConnect: false }
    });

    try {
      await repository.connect();

      expect((repository.getClient() as { config: { database: string } }).config.database)
        .toBe('app');
    } finally {
      await repository.disconnect();
    }
  });

  /** Authentication on by default: an unreachable server must fail the connect. */
  it('fails the connect when the database does not answer', async () => {
    expect.hasAssertions();

    const repository = new SqlSequelizeRepository({
      dialect: 'postgres',
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/none'
    });

    await expect(repository.connect()).rejects.toThrow(/ECONNREFUSED|connect/i);
    // Not connected, because the connection was not made.
    expect(repository.isConnected()).toBe(false);
  }, 30000);
});

describe('the RDS repository', () => {
  it('builds a Sequelize client with the dialect it was given', async () => {
    expect.hasAssertions();

    const repository = new RdsRepository({
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger',
      extra: { dialect: 'postgres', sequelizeAuthenticateOnConnect: false }
    });

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
      expect(repository.getClient()).not.toBeNull();
    } finally {
      await repository.disconnect();
    }
  });

  it('passes its own pool defaults, which differ from the plain SQL adapter', async () => {
    expect.hasAssertions();

    const repository = new RdsRepository({
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger',
      extra: { dialect: 'postgres', sequelizeAuthenticateOnConnect: false }
    });

    try {
      await repository.connect();

      // 20, not 15: RDS carries a larger default and the difference is
      // deliberate.
      expect((repository.getClient() as { options: { pool: { max: number } } }).options.pool.max)
        .toBe(20);
    } finally {
      await repository.disconnect();
    }
  });

  it('defaults to postgres when no dialect is configured', async () => {
    expect.hasAssertions();

    const repository = new RdsRepository({
      database: 'ledger',
      extra: { sequelizeAuthenticateOnConnect: false }
    });

    try {
      await repository.connect();

      expect((repository.getClient() as { options: { dialect: string } }).options.dialect)
        .toBe('postgres');
    } finally {
      await repository.disconnect();
    }
  });

  /** Authentication is on by default here too, and an absent server fails it. */
  it('fails the connect when the database does not answer', async () => {
    expect.hasAssertions();

    const repository = new RdsRepository({
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/none',
      extra: { dialect: 'postgres' }
    });

    await expect(repository.connect()).rejects.toThrow(/ECONNREFUSED|connect/i);
    expect(repository.isConnected()).toBe(false);
  }, 30000);

  it('closes and forgets the client on disconnect', async () => {
    expect.hasAssertions();

    const repository = new RdsRepository({
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger',
      extra: { dialect: 'postgres', sequelizeAuthenticateOnConnect: false }
    });

    await repository.connect();
    await repository.disconnect();

    expect(repository.getClient()).toBeNull();
    expect(repository.isConnected()).toBe(false);
  });
});

/**
 * The DynamoDB SDK builds a client without opening a socket, so this adapter
 * runs end to end offline.
 */
describe('the DynamoDB repository', () => {
  it('builds a client and reports connected', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({ region: 'sa-east-1' });

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
      expect(repository.getClient()).not.toBeNull();
    } finally {
      await repository.disconnect();
    }
  });

  it('prefers the region on the options', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({
      region: 'eu-west-1',
      extra: { region: 'ignored' }
    });

    try {
      await repository.connect();
      const client = repository.getClient() as { config: { region: () => Promise<string> } };

      await expect(client.config.region()).resolves.toBe('eu-west-1');
    } finally {
      await repository.disconnect();
    }
  });

  it('falls back to the region in extra', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({ extra: { region: 'ap-south-1' } });

    try {
      await repository.connect();
      const client = repository.getClient() as { config: { region: () => Promise<string> } };

      await expect(client.config.region()).resolves.toBe('ap-south-1');
    } finally {
      await repository.disconnect();
    }
  });

  it('falls back to us-east-1', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({});

    try {
      await repository.connect();
      const client = repository.getClient() as { config: { region: () => Promise<string> } };

      await expect(client.config.region()).resolves.toBe('us-east-1');
    } finally {
      await repository.disconnect();
    }
  });

  /** The endpoint override is how a local DynamoDB is reached. */
  it('passes the endpoint through', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({ endpoint: 'http://127.0.0.1:8000' });

    try {
      await repository.connect();
      const client = repository.getClient() as {
        config: { endpoint?: () => Promise<{ hostname: string; port: number }> };
      };

      await expect(client.config.endpoint?.()).resolves.toMatchObject({
        hostname: '127.0.0.1',
        port: 8000
      });
    } finally {
      await repository.disconnect();
    }
  });

  /**
   * The optional health check is the difference between "a client object
   * exists" and "the credentials and the endpoint work". Off by default,
   * because it costs a round trip on every startup; when it is on, a failure
   * must fail the connect rather than be swallowed.
   *
   * Here it is the credentials that stop it — there are none in this
   * environment, and the SDK says so before it ever reaches the endpoint. That
   * is the same finding a deployment would get, and it is exactly what the
   * health check is for: without it the connect would have succeeded and the
   * first real query would have failed instead.
   */
  it('fails the connect when the health check does not succeed', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({
      endpoint: 'http://127.0.0.1:8999',
      extra: { healthCheckOnConnect: true }
    });

    await expect(repository.connect()).rejects.toThrow(/credentials|ECONNREFUSED/i);
    expect(repository.isConnected()).toBe(false);
  }, 30000);

  it('destroys the client and forgets it', async () => {
    expect.hasAssertions();

    const repository = new DynamoDbRepository({});
    await repository.connect();
    await repository.disconnect();

    expect(repository.getClient()).toBeNull();
    expect(repository.isConnected()).toBe(false);
  });
});

/**
 * `postgres` connects lazily — the client is built and the first query opens
 * the socket — so this adapter also runs offline.
 */
describe('the Aurora repository', () => {
  it('builds a client from a connection url', async () => {
    expect.hasAssertions();

    const repository = new AuroraRepository({
      connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger'
    });

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
      expect(repository.getClient()).not.toBeNull();
    } finally {
      await repository.disconnect();
    }
  });

  it('accepts the connection url from extra', async () => {
    expect.hasAssertions();

    const repository = new AuroraRepository({
      extra: { connectionUrl: 'postgres://user:pass@127.0.0.1:5999/ledger' }
    });

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
    } finally {
      await repository.disconnect();
    }
  });

  /**
   * With no DSQL connector installed and no URL there is nothing to connect to,
   * and saying so is the only useful answer. Silently building a client that
   * fails on first query would move the error somewhere unrelated.
   */
  it('refuses to connect with neither a DSQL connector nor a url', async () => {
    expect.hasAssertions();

    await expect(new AuroraRepository({}).connect())
      .rejects.toThrow('AuroraRepository requires a "connectionUrl"');
  });

  it('leaves nothing behind when it refuses', async () => {
    expect.hasAssertions();

    const repository = new AuroraRepository({});

    await expect(repository.connect()).rejects.toThrow('requires a "connectionUrl"');

    expect(repository.isConnected()).toBe(false);
    expect(repository.getClient()).toBeNull();
  });
});

/**
 * The adapters that must reach a host. The connection is allowed to fail
 * against a port with nothing on it: the same code runs, and what is asserted
 * is that the failure surfaces and that no half-built state is left behind.
 * Their successful paths belong to the integration suite.
 */
/**
 * `firebase-admin` initialises without credentials and without reaching
 * Google, so this adapter runs end to end offline. Only reads and writes
 * against Firestore need the network, and those are the integration suite's.
 */
describe('the Firebase repository', () => {
  it('initialises an app and a Firestore handle', async () => {
    expect.hasAssertions();

    const repository = new FirebaseRepository({ extra: { projectId: 'a-project' } });

    try {
      await repository.connect();

      expect(repository.isConnected()).toBe(true);
      expect(repository.getClient()).not.toBeNull();
    } finally {
      await repository.disconnect();
    }
  });

  /**
   * A service account turns into a credential, and the credential is real:
   * `cert()` parses the PEM and refuses a key that is not one. That refusal is
   * the assertion — it can only come from the credential path having run.
   *
   * Dropped silently, the app would initialise with ambient credentials, which
   * in a deployment means reading somebody else's project, or none.
   */
  it('builds a real credential from the service account', async () => {
    expect.hasAssertions();

    const repository = new FirebaseRepository({
      extra: {
        projectId: 'a-project',
        serviceAccount: {
          projectId: 'a-project',
          clientEmail: 'nobody@a-project.iam.gserviceaccount.com',
          // A syntactically valid, throwaway key: `cert()` parses it, and
          // nothing here ever presents it to Google.
          privateKey: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n'
        }
      }
    });

    try {
      await expect(repository.connect()).rejects.toThrow(/private key|PEM|certificate/i);
      // Refused before anything was built, rather than half-initialised.
      expect(repository.isConnected()).toBe(false);
    } finally {
      await repository.disconnect();
    }
  });

  it('deletes the app and forgets both handles on disconnect', async () => {
    expect.hasAssertions();

    const repository = new FirebaseRepository({ extra: { projectId: 'a-project' } });
    await repository.connect();
    await repository.disconnect();

    expect(repository.getClient()).toBeNull();
    expect(repository.isConnected()).toBe(false);
  });
});

describe('the Oracle connection url', () => {
  /**
   * Oracle takes a user, a password and a connect string rather than a URL, so
   * the adapter parses one. Credentials are percent-encoded in a URL and must
   * be decoded before they are presented — a password with an `@` or a `/` in
   * it fails to authenticate otherwise, with an error that says nothing about
   * encoding.
   */
  const parse = (url?: string) => (OracleRepository as unknown as {
    parseConnectionUrl(connectionUrl?: string): {
      user?: string; password?: string; connectString?: string;
    };
  }).parseConnectionUrl(url);

  it('splits a url into user, password and connect string', () => {
    expect.hasAssertions();

    expect(parse('oracle://scott:tiger@db.internal:1522/ORCLPDB1')).toStrictEqual({
      user: 'scott',
      password: 'tiger',
      connectString: 'db.internal:1522/ORCLPDB1'
    });
  });

  it('decodes a percent-encoded password', () => {
    expect.hasAssertions();

    expect(parse('oracle://scott:p%40ss%2Fword@db.internal:1522/ORCLPDB1').password)
      .toBe('p@ss/word');
  });

  it('defaults the port to 1521', () => {
    expect.hasAssertions();

    expect(parse('oracle://scott:tiger@db.internal/ORCLPDB1').connectString)
      .toBe('db.internal:1521/ORCLPDB1');
  });

  it.each([[undefined], [''], ['   ']])('reads %p as nothing configured', (url) => {
    expect.hasAssertions();

    expect(parse(url)).toStrictEqual({});
  });

  /**
   * Not a URL is taken as an Oracle connect string, which is what an operator
   * most likely typed: `host:port/service` is the native form and is not a
   * valid URL.
   */
  it('takes a value that is not a url as the connect string itself', () => {
    expect.hasAssertions();

    expect(parse('127.0.0.1:1521/FREEPDB1')).toStrictEqual({
      connectString: '127.0.0.1:1521/FREEPDB1'
    });
  });

  it('leaves the user undefined when the url carries no credentials', () => {
    expect.hasAssertions();

    expect(parse('oracle://db.internal:1522/ORCLPDB1')).toMatchObject({
      user: undefined,
      password: undefined
    });
  });
});

describe('the repositories that need a server', () => {
  it('reports a Mongo server that is not there', async () => {
    expect.hasAssertions();

    const repository = new MongoMongooseRepository({
      // Bounded deliberately: the default is five seconds, and a suite should
      // not spend five seconds discovering something it already knows.
      extra: { serverSelectionTimeoutMS: 300 }
    });

    await expect(repository.connect()).rejects.toThrow(/ECONNREFUSED|ServerSelection/i);
    expect(repository.isConnected()).toBe(false);
    expect(repository.getClient()).toBeNull();
  }, 30000);

  /**
   * Points at a port nothing listens on, rather than at Cassandra's default.
   *
   * It used to use 9042 with no port given, so it passed only while no
   * Cassandra was running on the machine — and failed the moment the docker
   * matrix brought one up beside it (JUM-602). A unit test whose result depends
   * on what else happens to be listening is not measuring the code.
   */
  it('reports a Cassandra cluster that is not there', async () => {
    expect.hasAssertions();

    const repository = new CassandraRepository({
      extra: {
        contactPoints: ['127.0.0.1:59942'],
        localDataCenter: 'datacenter1'
      }
    });

    await expect(repository.connect()).rejects.toThrow(/All host\(s\) tried for query failed/);
    expect(repository.isConnected()).toBe(false);
  }, 30000);

  it('reports an Oracle instance that is not there', async () => {
    expect.hasAssertions();

    const repository = new OracleRepository({
      extra: {
        user: 'test',
        password: 'test',
        connectString: '127.0.0.1:1521/none'
      }
    });

    // NJS-503 is oracledb's "connection could not be established".
    await expect(repository.connect()).rejects.toThrow(/NJS-|ORA-/);
    expect(repository.isConnected()).toBe(false);
  }, 30000);
});

/**
 * The guards and branches the issue expected to be unreachable (JUM-602).
 *
 * JUM-602 listed the "unable to resolve" guards, and Aurora's DSQL branch, as
 * needing module substitution — which JUM-583 established does not behave the
 * same under bun and Jest — and therefore as candidates for an `istanbul
 * ignore` with a note.
 *
 * They are reachable. `loadModule` is `protected` on
 * `BaseExternalDataRepository`, so a subclass can hand back whatever module
 * shape a test wants. That is an injection seam, it works identically under
 * both runners, and no pragma is needed: nothing here is excused from
 * measurement.
 *
 * What these guards protect against is a driver that installs but exports
 * something other than what the adapter reaches for — a major-version rename,
 * or an ESM/CJS interop difference. Without them the adapter calls `undefined`
 * as a constructor and reports a TypeError about `new`, which says nothing
 * about which dependency is at fault.
 */

/** The shape every repository constructor shares, for the seam below. */
type RepositoryConstructor = new (options: Record<string, unknown>) => object;

type ModuleResolver = (moduleName: string) => unknown;

interface SeamRepository {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * A repository whose module loader answers from `resolve`.
 *
 * One class, defined once, rather than an inline subclass per test: five copies
 * of the same override is five places for them to drift apart, and the
 * repository lints `max-classes-per-file` at 1 for that reason. The branching
 * each test needs lives in a module-scope resolver instead, which also keeps
 * conditionals out of test bodies.
 */
function withModuleResolver(
  RepositoryClass: unknown,
  resolve: ModuleResolver,
  options: Record<string, unknown> = {}
): SeamRepository {
  // Through `unknown`: the eight repositories have different option types, and
  // this helper deliberately does not care which one it is handed — what it
  // overrides is a method they all inherit.
  class Injected extends (RepositoryClass as RepositoryConstructor) {
    // The override replaces instance behaviour with a closure, so `this` is
    // genuinely unused — which is the whole point of the seam.
    // eslint-disable-next-line class-methods-use-this
    protected async loadModule(moduleName: string): Promise<unknown> {
      return resolve(moduleName);
    }
  }

  return new Injected(options) as unknown as SeamRepository;
}

/**
 * A module that resolved but carries nothing the adapter can use.
 *
 * `{}` rather than `{ default: {} }`: several adapters fall back to
 * `module.default` itself, and an empty object is truthy — that fixture would
 * resolve `{}` as the constructor and sail past the guard.
 */
const emptyModule: ModuleResolver = () => ({});

/** Answers `postgres` with a working client and everything else by throwing. */
const dsqlOnly = (created: Array<Record<string, unknown>>): ModuleResolver => (moduleName) => {
  if (moduleName.startsWith('@aws/aurora-dsql')) {
    return {
      createClient: async (config: Record<string, unknown>) => {
        created.push(config);
        return { end: async () => undefined };
      }
    };
  }
  // Aurora loads `postgres` before it looks for a DSQL connector, so this has
  // to answer even though the test never reaches the fallback that uses it.
  if (moduleName === 'postgres') {
    return { default: () => ({ end: async () => undefined }) };
  }
  throw new Error(`not installed: ${moduleName}`);
};

/** A postgres client exposing `close` rather than `end`, and a count of calls. */
function postgresWithCloseOnly(): { resolve: ModuleResolver; closes(): number } {
  let closes = 0;
  return {
    resolve: (moduleName) => {
      if (moduleName === 'postgres') {
        return { default: () => ({ close: async () => { closes += 1; } }) };
      }
      throw new Error(`not installed: ${moduleName}`);
    },
    closes: () => closes
  };
}

/** Firebase's app module resolves; its firestore module does not carry getFirestore. */
const firebaseAppOnly: ModuleResolver = (moduleName) => {
  if (moduleName === 'firebase-admin/app') {
    return { initializeApp: () => ({ name: 'test-app' }), getApps: () => [], cert: (v: unknown) => v };
  }
  return {};
};

/** An oracledb whose `getConnection` records what it was given. */
function oracleDriver(): {
  resolve: ModuleResolver;
  received(): Array<Record<string, unknown>>;
  closes(): number;
  } {
  const received: Array<Record<string, unknown>> = [];
  let closes = 0;
  return {
    resolve: () => ({
      getConnection: async (config: Record<string, unknown>) => {
        received.push(config);
        return { close: async () => { closes += 1; } };
      }
    }),
    received: () => received,
    closes: () => closes
  };
}

describe('the guards against a driver that resolves but exports the wrong thing', () => {
  it.each([
    ['cassandra', CassandraRepository, /cassandra-driver Client/],
    ['dynamodb', DynamoDbRepository, /DynamoDBClient/],
    ['oracle', OracleRepository, /getConnection/],
    ['rds', RdsRepository, /Sequelize constructor/],
    ['sequelize', SqlSequelizeRepository, /Sequelize constructor/]
  ])('%s reports which export it could not resolve', async (
    _name: string,
    RepositoryClass: unknown,
    expected: RegExp
  ) => {
    expect.hasAssertions();

    const repository = withModuleResolver(RepositoryClass, emptyModule, {
      connectionUrl: 'postgres://127.0.0.1:59999/x',
      database: 'x'
    });

    await expect(repository.connect()).rejects.toThrow(expected);
  });

  it('firebase reports a missing initializeApp', async () => {
    expect.hasAssertions();

    const repository = withModuleResolver(FirebaseRepository, emptyModule);

    await expect(repository.connect()).rejects.toThrow(/initializeApp/);
  });

  /**
   * Firebase resolves two modules, so it has two guards. The second only runs
   * once the first has succeeded, which a single empty module cannot reach.
   */
  it('firebase reports a missing getFirestore once the app resolved', async () => {
    expect.hasAssertions();

    const repository = withModuleResolver(FirebaseRepository, firebaseAppOnly, {
      extra: { serviceAccount: { project_id: 'p', private_key: 'k', client_email: 'e' } }
    });

    await expect(repository.connect()).rejects.toThrow(/getFirestore/);
  });
});

describe('the branches a particular driver shape reaches', () => {
  /**
   * Aurora's DSQL branch, which the issue listed as needing
   * `@aws/aurora-dsql-*` — a package that is not installed and is not going to
   * be. The seam reaches it without installing anything.
   */
  it('aurora uses the DSQL connector when one resolves', async () => {
    expect.hasAssertions();

    const created: Array<Record<string, unknown>> = [];
    const repository = withModuleResolver(AuroraRepository, dsqlOnly(created), {
      region: 'eu-west-1',
      endpoint: 'dsql.example.test',
      database: 'jumentix'
    });

    await repository.connect();

    // The configuration reached the connector, which is the only thing this
    // branch does and the only way to know it did it correctly.
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      region: 'eu-west-1',
      endpoint: 'dsql.example.test',
      database: 'jumentix'
    });

    await repository.disconnect();
  });

  /**
   * Both adapters branch on which method the client exposes, and both branches
   * matter: an adapter that closed nothing would leak a connection pool per
   * restart, silently, until the server refused new connections.
   */
  it('aurora falls back to close() when the client has no end()', async () => {
    expect.hasAssertions();

    const driver = postgresWithCloseOnly();
    const repository = withModuleResolver(
      AuroraRepository,
      driver.resolve,
      { connectionUrl: 'postgres://127.0.0.1:59999/x' }
    );

    await repository.connect();
    await repository.disconnect();

    expect(driver.closes()).toBe(1);
  });

  it('oracle opens a connection with the credentials it was given, and closes it', async () => {
    expect.hasAssertions();

    const driver = oracleDriver();
    const repository = withModuleResolver(
      OracleRepository,
      driver.resolve,
      { extra: { user: 'scott', password: 'tiger', connectString: 'localhost/XEPDB1' } }
    );

    await repository.connect();

    expect(driver.received()[0]).toMatchObject({
      user: 'scott', connectString: 'localhost/XEPDB1'
    });

    await repository.disconnect();

    expect(driver.closes()).toBe(1);
  });
});
