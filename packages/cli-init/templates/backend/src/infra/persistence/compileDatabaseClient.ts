import { buildDatabaseClientCompilers } from '@jumentix/database-client-factory';

import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';

const compilers = buildDatabaseClientCompilers<IDatabaseClient>({
  inMemoryClient: InMemoryDbClient
});

export const {
  compileDatabaseClient,
  compileDatabaseClientByDriver,
  compileMongoDbClient,
  compilePostgreSqlDbClient,
  compileMySqlDbClient,
  compileMsSqlDbClient,
  compileOracleDbClient,
  compileSqliteDbClient,
  compileDynamoDbClient,
  compileCassandraDbClient,
  compileFirebaseDbClient,
  compileAuroraDbClient,
  compileRdsDbClient
} = compilers;
