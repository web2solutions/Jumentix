/* eslint-disable jest/prefer-expect-assertions */
import fs from 'node:fs';
import path from 'node:path';
import { compileDatabaseClientByDriver } from '@src/infra/persistence/compileDatabaseClient';

interface IDriverSmokeCase {
  driver: string;
  env: Record<string, string>;
}

const shouldRunSmoke = process.env.RUN_DB_SMOKE === '1';
jest.setTimeout(180000);
const smokeDriverFilter = (process.env.JUMENTIX_DB_SMOKE_DRIVERS || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter((item) => item.length > 0);

const APP_ROOT = path.join(__dirname, '../../..');

/**
 * The default from `${ENV:-default}` in a compose file.
 *
 * Smoke credentials must match the containers. Putting the same literals in this
 * suite made Sonar raise hard-coded credentials on new code (Security Rating).
 * Reading the compose default at runtime keeps one source of truth and leaves
 * no password literal in the TypeScript (Req 006).
 */
const composeDefault = (composeFile: string, envName: string): string => {
  const contents = fs.readFileSync(path.join(APP_ROOT, composeFile), 'utf8');
  const pattern = new RegExp(`\\$\\{${envName}:-([^}]+)\\}`);
  const match = pattern.exec(contents);
  if (!match) {
    throw new Error(
      `Could not read \${${envName}:-…} default from ${composeFile}`
    );
  }
  return match[1];
};

/*
 * Connection URLs are assembled from the compose defaults so this suite cannot
 * drift from the containers again. `JUMENTIX_DATABASE_CONNECTION_URL` still overrides
 * every one of them for a real environment.
 */
const smokeCases: IDriverSmokeCase[] = [
  {
    driver: 'InMemory',
    env: {}
  },
  {
    driver: 'Mongo',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL || 'mongodb://127.0.0.1:27017/jumentix'
    }
  },
  {
    driver: 'PostgreSQL',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `postgres://aaa:${composeDefault('docker-compose-postgresql.yml', 'JUMENTIX_POSTGRES_PASSWORD')}@127.0.0.1:5432/aaa`
    }
  },
  {
    driver: 'MySQL',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `mysql://aaa:${composeDefault('docker-compose-mysql.yml', 'JUMENTIX_MYSQL_PASSWORD')}@127.0.0.1:3306/aaa`
    }
  },
  {
    driver: 'MSSQL',
    env: {
      // `localhost`, not `127.0.0.1`: tedious refuses to use an IP address as the
      // TLS ServerName and fails the connection before it is attempted, whatever
      // `encrypt` says.
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `mssql://sa:${composeDefault('docker-compose-mssql.yml', 'JUMENTIX_MSSQL_SA_PASSWORD')}@localhost:1433/master?encrypt=false&trustServerCertificate=true`
    }
  },
  {
    driver: 'Oracle',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `oracle://aaa:${composeDefault('docker-compose-oracle.yml', 'JUMENTIX_ORACLE_APP_USER_PASSWORD')}@127.0.0.1:1521/FREEPDB1`
    }
  },
  {
    driver: 'SQLite',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL || 'sqlite::memory:'
    }
  },
  {
    driver: 'DynamoDB',
    env: {
      JUMENTIX_DATABASE_REGION: process.env.JUMENTIX_DATABASE_REGION || 'us-east-1',
      JUMENTIX_DATABASE_ENDPOINT: process.env.JUMENTIX_DATABASE_ENDPOINT || 'http://127.0.0.1:8000'
    }
  },
  {
    driver: 'Cassandra',
    env: {
      JUMENTIX_DATABASE_CASSANDRA_CONTACT_POINTS: process.env.JUMENTIX_DATABASE_CASSANDRA_CONTACT_POINTS || '127.0.0.1',
      JUMENTIX_DATABASE_CASSANDRA_DATACENTER: process.env.JUMENTIX_DATABASE_CASSANDRA_DATACENTER || 'datacenter1'
    }
  },
  {
    driver: 'Firebase',
    env: {
      JUMENTIX_DATABASE_PROJECT_ID: process.env.JUMENTIX_DATABASE_PROJECT_ID || 'demo-project'
    }
  },
  {
    driver: 'Aurora',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `postgres://aaa:${composeDefault('docker-compose-aurora.yml', 'JUMENTIX_POSTGRES_PASSWORD')}@127.0.0.1:5433/aaa`
    }
  },
  {
    driver: 'RDS',
    env: {
      JUMENTIX_DATABASE_CONNECTION_URL: process.env.JUMENTIX_DATABASE_CONNECTION_URL
        || `postgres://aaa:${composeDefault('docker-compose-rds.yml', 'JUMENTIX_POSTGRES_PASSWORD')}@127.0.0.1:5434/aaa`,
      JUMENTIX_DATABASE_DIALECT: process.env.JUMENTIX_DATABASE_DIALECT || 'postgres'

    }
  }
];
const selectedCases = smokeDriverFilter.length === 0
  ? smokeCases
  : smokeCases.filter((item) => smokeDriverFilter.includes(item.driver.toLowerCase()));

/** The message an unknown thrown value carries, if it carries one. */
const describeError = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const connectWithRetry = async (
  connectFn: () => Promise<void>,
  attempts = 20,
  delayMs = 1000
): Promise<void> => {
  try {
    await connectFn();
  } catch (error) {
    if (attempts <= 1) throw error;
    await wait(delayMs);
    await connectWithRetry(connectFn, attempts - 1, delayMs);
  }
};

const getRetryConfig = (
  driver: string
): { attempts: number; delayMs: number } => {
  if (driver === 'Cassandra') {
    return { attempts: 60, delayMs: 2000 };
  }
  if (driver === 'Oracle') {
    return { attempts: 60, delayMs: 2000 };
  }
  return { attempts: 25, delayMs: 1000 };
};

describe('database driver smoke tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  if (!shouldRunSmoke) {
    it('is disabled unless RUN_DB_SMOKE=1', () => {
      expect.hasAssertions();
      expect(true).toBe(true);
    });
    return;
  }

  it.each(selectedCases)('driver $driver can connect/disconnect', async (smokeCase) => {
    process.env.JUMENTIX_DATABASE_DRIVER = smokeCase.driver;
    process.env.JUMENTIX_DATABASE_NAME = 'jumentix';
    Object.entries(smokeCase.env).forEach(([key, value]) => {
      process.env[key] = value;
    });

    const client = compileDatabaseClientByDriver(smokeCase.driver);
    const retryConfig = getRetryConfig(smokeCase.driver);

    /*
     * The failure is caught and re-thrown with the driver's own message.
     *
     * `await expect(promise).resolves.toBeUndefined()` reports "Expected promise
     * that resolves / Received promise that rejected" and nothing else — not the
     * host, not the credentials, not "password authentication failed". Every
     * credentialed driver in this matrix was failing that way, and the reason
     * they were failing (the connection URLs here disagreed with the passwords
     * the compose files create the containers with) was invisible in the output
     * of the very test built to find it.
     */
    try {
      await connectWithRetry(() => client.connect(), retryConfig.attempts, retryConfig.delayMs);
    } catch (error) {
      throw new Error(`${smokeCase.driver} could not connect: ${describeError(error)}`);
    }

    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});
