import { BaseExternalDataRepository } from '@jumentix/external-persistence-core';
import {
  AuroraRepository,
  CassandraRepository,
  DynamoDbRepository,
  FirebaseRepository,
  MongoMongooseRepository,
  OracleRepository,
  RdsRepository,
  SqlSequelizeRepository
} from '@jumentix/external-db-repositories';
import { createExternalStores } from '@jumentix/external-store-proxy';

export type DriverName =
  | 'InMemory'
  /**
   * Cana, over IndexedDB, in the browser.
   *
   * A first-class driver: Jumentix supports applications that are 100% offline
   * with no backend at all, and for those IndexedDB is not an exception case —
   * it is the database. It is supplied by injection rather than constructed
   * here so this server-side package never imports a browser-only one.
   */
  | 'IndexedDB'
  | 'Mongo'
  | 'PostgreSQL'
  | 'MySQL'
  | 'MSSQL'
  | 'Oracle'
  | 'SQLite'
  | 'DynamoDB'
  | 'Cassandra'
  | 'Firebase'
  | 'Aurora'
  | 'RDS';

/**
 * Drivers backed by an external connector.
 *
 * Excludes both locally-hosted drivers: `InMemory` has no connector, and
 * `IndexedDB` is the browser's own store — neither has a host to connect to.
 */
type ExternalDriverName = Exclude<DriverName, 'InMemory' | 'IndexedDB'>;

export interface IDatabaseClientLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  stores: Record<string, any>;
}

export interface IBuildDatabaseClientCompilersOptions<TDatabaseClient extends IDatabaseClientLike> {
  inMemoryClient: TDatabaseClient;
  /**
   * Builds the IndexedDB (Cana) client, in applications that run in a browser.
   *
   * A factory rather than an instance, because an offline application opens its
   * database as part of startup and should not pay for that when a different
   * driver is selected.
   */
  indexedDbClient?: () => TDatabaseClient;
}

const DEFAULT_DRIVER: DriverName = 'InMemory';

const SQL_DIALECT_TO_DRIVER: Record<
  'postgres' | 'mysql' | 'mssql' | 'oracle' | 'sqlite',
  ExternalDriverName
> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mssql: 'MSSQL',
  oracle: 'Oracle',
  sqlite: 'SQLite'
};

const sanitize = (value: string): string => value.trim().toLowerCase();

const normalizeDriver = (value?: string): DriverName => {
  if (!value || value.trim() === '') return DEFAULT_DRIVER;
  const normalized = sanitize(value);
  if (['indexeddb', 'indexed-db', 'cana'].includes(normalized)) return 'IndexedDB';
  if (['inmemory', 'in-memory', 'memory'].includes(normalized)) return 'InMemory';
  if (['mongo', 'mongodb', 'mongoose'].includes(normalized)) return 'Mongo';
  if (['postgres', 'postgresql'].includes(normalized)) return 'PostgreSQL';
  if (['mysql'].includes(normalized)) return 'MySQL';
  if (['mssql', 'ms sql', 'sqlserver', 'sql server'].includes(normalized)) return 'MSSQL';
  if (['oracle'].includes(normalized)) return 'Oracle';
  if (['sqlite', 'sql lite'].includes(normalized)) return 'SQLite';
  if (['dynamodb', 'dynamo'].includes(normalized)) return 'DynamoDB';
  if (['cassandra'].includes(normalized)) return 'Cassandra';
  if (['firebase'].includes(normalized)) return 'Firebase';
  if (['aurora'].includes(normalized)) return 'Aurora';
  if (['rds'].includes(normalized)) return 'RDS';
  return DEFAULT_DRIVER;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseContactPoints = (value: string | undefined): string[] => {
  if (!value || value.trim() === '') return ['127.0.0.1'];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const parseJson = (value: string | undefined): Record<string, unknown> | undefined => {
  if (!value || value.trim() === '') return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch (_error) {
    return undefined;
  }
  return undefined;
};

const toExternalClient = <TDatabaseClient extends IDatabaseClientLike>(
  driver: ExternalDriverName,
  connector: BaseExternalDataRepository
): TDatabaseClient => {
  return {
    stores: createExternalStores(driver, connector),
    connect: () => connector.connect(),
    disconnect: () => connector.disconnect()
  } as unknown as TDatabaseClient;
};

export const buildDatabaseClientCompilers = <TDatabaseClient extends IDatabaseClientLike>({
  inMemoryClient,
  indexedDbClient
}: IBuildDatabaseClientCompilersOptions<TDatabaseClient>) => {
  const createIndexedDbClient = (): TDatabaseClient => {
    if (!indexedDbClient) {
      // Selected but not wired. Falling back to InMemory here would start the
      // application on a database that disappears when the tab closes, while
      // reporting nothing — the offline app would look fine and lose everything.
      throw new Error(
        'Database driver "IndexedDB" was selected but no indexedDbClient factory was provided. '
          + 'Pass one to buildDatabaseClientCompilers, built with createCanaDatabaseClient from '
          + '@jumentix/cana. It is injected rather than imported so this package stays free of '
          + 'browser-only dependencies.'
      );
    }
    if (typeof indexedDB === 'undefined') {
      // Reached when an offline-capable build is executed somewhere without the
      // global — a server-side render, or a test runner in node. Saying so is
      // more useful than the DOMException the driver would raise later.
      throw new Error(
        'Database driver "IndexedDB" was selected but this runtime has no indexedDB global. '
          + 'Cana runs in the browser; select a server driver for server-side processes.'
      );
    }
    return indexedDbClient();
  };

  const createSqlClient = (
    dialect: 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'sqlite'
  ): TDatabaseClient => {
    const connector = new SqlSequelizeRepository({
      dialect,
      connectionUrl: process.env.JUMENTIX_DATABASE_CONNECTION_URL,
      database: process.env.JUMENTIX_DATABASE_NAME,
      extra: {
        poolMax: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MAX, 15),
        poolMin: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MIN, 0),
        poolAcquireMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_ACQUIRE_MS, 30000),
        poolIdleMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_IDLE_MS, 10000),
        poolEvictMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_EVICT_MS, 1000)
      }
    });
    return toExternalClient<TDatabaseClient>(SQL_DIALECT_TO_DRIVER[dialect], connector);
  };

  const createMongoClient = (): TDatabaseClient => {
    const serverSelectionMs = process.env.JUMENTIX_DATABASE_SERVER_SELECTION_MS;
    const connector = new MongoMongooseRepository({
      connectionUrl: process.env.JUMENTIX_DATABASE_CONNECTION_URL,
      database: process.env.JUMENTIX_DATABASE_NAME,
      extra: {
        maxPoolSize: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MAX, 20),
        minPoolSize: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MIN, 0),
        serverSelectionTimeoutMS: parseNumber(serverSelectionMs, 5000),
        socketTimeoutMS: parseNumber(process.env.JUMENTIX_DATABASE_SOCKET_TIMEOUT_MS, 45000)
      }
    });
    return toExternalClient<TDatabaseClient>('Mongo', connector);
  };

  const createDynamoClient = (): TDatabaseClient => {
    const connector = new DynamoDbRepository({
      region: process.env.JUMENTIX_DATABASE_REGION || 'us-east-1',
      endpoint: process.env.JUMENTIX_DATABASE_ENDPOINT
    });
    return toExternalClient<TDatabaseClient>('DynamoDB', connector);
  };

  const createCassandraClient = (): TDatabaseClient => {
    const connector = new CassandraRepository({
      database: process.env.JUMENTIX_DATABASE_NAME,
      extra: {
        contactPoints: parseContactPoints(process.env.JUMENTIX_DATABASE_CASSANDRA_CONTACT_POINTS),
        localDataCenter: process.env.JUMENTIX_DATABASE_CASSANDRA_DATACENTER || 'datacenter1',
        keyspace: process.env.JUMENTIX_DATABASE_NAME
      }
    });
    return toExternalClient<TDatabaseClient>('Cassandra', connector);
  };

  const createFirebaseClient = (): TDatabaseClient => {
    const connector = new FirebaseRepository({
      extra: {
        projectId: process.env.JUMENTIX_DATABASE_PROJECT_ID,
        serviceAccount: parseJson(process.env.JUMENTIX_FIREBASE_SERVICE_ACCOUNT_JSON)
      }
    });
    return toExternalClient<TDatabaseClient>('Firebase', connector);
  };

  const createAuroraClient = (): TDatabaseClient => {
    const connector = new AuroraRepository({
      connectionUrl: process.env.JUMENTIX_DATABASE_CONNECTION_URL,
      database: process.env.JUMENTIX_DATABASE_NAME,
      region: process.env.JUMENTIX_DATABASE_REGION || 'us-east-1',
      endpoint: process.env.JUMENTIX_DATABASE_ENDPOINT,
      extra: {
        poolMax: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MAX, 20)
      }
    });
    return toExternalClient<TDatabaseClient>('Aurora', connector);
  };

  const createOracleClient = (): TDatabaseClient => {
    const connector = new OracleRepository({
      connectionUrl: process.env.JUMENTIX_DATABASE_CONNECTION_URL,
      database: process.env.JUMENTIX_DATABASE_NAME,
      extra: {
        user: process.env.JUMENTIX_DATABASE_USER || 'jumentix',
        password: process.env.JUMENTIX_DATABASE_PASSWORD || 'jumentix',
        connectString: process.env.JUMENTIX_DATABASE_CONNECT_STRING
      }
    });
    return toExternalClient<TDatabaseClient>('Oracle', connector);
  };

  const createRdsClient = (): TDatabaseClient => {
    const dialectRaw = sanitize(process.env.JUMENTIX_DATABASE_DIALECT || 'postgres');
    const dialect = (['postgres', 'mysql', 'mssql', 'oracle', 'sqlite'].includes(dialectRaw)
      ? dialectRaw
      : 'postgres') as 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'sqlite';
    const connector = new RdsRepository({
      connectionUrl: process.env.JUMENTIX_DATABASE_CONNECTION_URL,
      database: process.env.JUMENTIX_DATABASE_NAME,
      extra: {
        dialect,
        poolMax: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MAX, 20),
        poolMin: parseNumber(process.env.JUMENTIX_DATABASE_POOL_MIN, 0),
        poolAcquireMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_ACQUIRE_MS, 30000),
        poolIdleMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_IDLE_MS, 10000),
        poolEvictMs: parseNumber(process.env.JUMENTIX_DATABASE_POOL_EVICT_MS, 1000)
      }
    });
    return toExternalClient<TDatabaseClient>('RDS', connector);
  };

  const buildByDriver = (driver: DriverName): TDatabaseClient => {
    if (driver === 'InMemory') return inMemoryClient;
    if (driver === 'IndexedDB') return createIndexedDbClient();
    if (driver === 'Mongo') return createMongoClient();
    if (driver === 'PostgreSQL') return createSqlClient('postgres');
    if (driver === 'MySQL') return createSqlClient('mysql');
    if (driver === 'MSSQL') return createSqlClient('mssql');
    if (driver === 'Oracle') return createOracleClient();
    if (driver === 'SQLite') return createSqlClient('sqlite');
    if (driver === 'DynamoDB') return createDynamoClient();
    if (driver === 'Cassandra') return createCassandraClient();
    if (driver === 'Firebase') return createFirebaseClient();
    if (driver === 'Aurora') return createAuroraClient();
    if (driver === 'RDS') return createRdsClient();
    /* istanbul ignore next -- unreachable: `normalizeDriver` returns one of the
       names above or 'InMemory', so this line runs only if a name is added to
       `DriverName` without a branch here. Kept as the safe answer if that
       happens, and left uncovered rather than reached through a cast that would
       assert nothing about real behaviour. */
    return inMemoryClient;
  };

  const compileDatabaseClient = (): TDatabaseClient => {
    const driver = normalizeDriver(process.env.JUMENTIX_DATABASE_DRIVER);
    return buildByDriver(driver);
  };

  const compileDatabaseClientByDriver = (driver: string): TDatabaseClient => {
    return buildByDriver(normalizeDriver(driver));
  };

  return {
    compileDatabaseClient,
    compileDatabaseClientByDriver,
    compileIndexedDbClient: (): TDatabaseClient => buildByDriver('IndexedDB'),
    compileMongoDbClient: (): TDatabaseClient => buildByDriver('Mongo'),
    compilePostgreSqlDbClient: (): TDatabaseClient => buildByDriver('PostgreSQL'),
    compileMySqlDbClient: (): TDatabaseClient => buildByDriver('MySQL'),
    compileMsSqlDbClient: (): TDatabaseClient => buildByDriver('MSSQL'),
    compileOracleDbClient: (): TDatabaseClient => buildByDriver('Oracle'),
    compileSqliteDbClient: (): TDatabaseClient => buildByDriver('SQLite'),
    compileDynamoDbClient: (): TDatabaseClient => buildByDriver('DynamoDB'),
    compileCassandraDbClient: (): TDatabaseClient => buildByDriver('Cassandra'),
    compileFirebaseDbClient: (): TDatabaseClient => buildByDriver('Firebase'),
    compileAuroraDbClient: (): TDatabaseClient => buildByDriver('Aurora'),
    compileRdsDbClient: (): TDatabaseClient => buildByDriver('RDS')
  };
};
