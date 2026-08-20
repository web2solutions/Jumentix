# Database Adapters

Choose the database adapter by data model, operational profile, and the smoke test that confirms connection lifecycle.

## Database adapter comparison

| Adapter | Integrated technology | Data model | Best fit | Smoke test |
| --- | --- | --- | --- | --- |
| [InMemory](/docs/jumentix/adapters/databases/inmemory) | Process-local memory store | Keyed objects | Unit tests, demos, and browser-free contract examples. | `bun run smoke:db:inmemory` |
| [PostgreSQL](/docs/jumentix/adapters/databases/postgresql) | PostgreSQL through the SQL client profile | Relational SQL | Transactional systems with relational integrity, indexing, and reporting needs. | `bun run smoke:db:postgresql` |
| [MySQL](/docs/jumentix/adapters/databases/mysql) | MySQL through the SQL client profile | Relational SQL | Common relational workloads, SaaS CRUD, and teams with MySQL operational experience. | `bun run smoke:db:mysql` |
| [SQL Server](/docs/jumentix/adapters/databases/mssql) | Microsoft SQL Server through the SQL client profile | Relational SQL | Enterprise environments standardized on Microsoft data platforms. | `bun run smoke:db:mssql` |
| [Oracle](/docs/jumentix/adapters/databases/oracle) | Oracle Database through the SQL client profile | Relational SQL | Enterprise systems already invested in Oracle operations and governance. | `bun run smoke:db:oracle` |
| [SQLite](/docs/jumentix/adapters/databases/sqlite) | Embedded SQL database file | Embedded relational SQL | Local development, edge prototypes, tests, and single-node utilities. | `bun run smoke:db:sqlite` |
| [MongoDB](/docs/jumentix/adapters/databases/mongodb) | MongoDB through Mongoose repository wiring | Document database | Document-centric domains, flexible schemas, and aggregate-shaped persistence. | `bun run smoke:db:mongodb` |
| [DynamoDB](/docs/jumentix/adapters/databases/dynamodb) | AWS DynamoDB key-value and document database | Key-value/document | AWS-native services that need managed scale and access-pattern-first modeling. | `bun run smoke:db:dynamodb` |
| [Cassandra](/docs/jumentix/adapters/databases/cassandra) | Apache Cassandra wide-column database | Wide-column | Very high write volume, multi-node distribution, and query patterns known in advance. | `bun run smoke:db:cassandra` |
| [Firebase](/docs/jumentix/adapters/databases/firebase) | Firebase emulator-backed database profile | Document/realtime app data | Rapid product surfaces that benefit from Firebase tooling and local emulator validation. | `bun run smoke:db:firebase` |
| [Aurora](/docs/jumentix/adapters/databases/aurora) | Amazon Aurora-compatible relational profile | Managed relational SQL | AWS relational workloads needing managed operations and cloud scaling paths. | `bun run smoke:db:aurora` |
| [RDS](/docs/jumentix/adapters/databases/rds) | Amazon RDS-compatible relational profile | Managed relational SQL | AWS teams standardizing managed relational databases without changing domain code. | `bun run smoke:db:rds` |

## Fast guide

- Use **InMemory** for tests, demos, and examples.
- Use SQL databases when the domain needs relationships, transactions, and reporting.
- Use **SQLite** for local, single-node, and file-backed environments.
- Use **MongoDB** when aggregates are documents.
- Use **DynamoDB** or **Cassandra** when access patterns and write scale are central.
- Use **Firebase** when Firebase tooling and emulators help the product.

## Complete selection example

```ts
type DatabaseAdapterChoice = {
  driver: string;
  smokeTest: string;
  durable: boolean;
};

const databaseChoices: DatabaseAdapterChoice[] = [
  { driver: 'InMemory', smokeTest: 'bun run smoke:db:inmemory', durable: false },
  { driver: 'PostgreSQL', smokeTest: 'bun run smoke:db:postgresql', durable: true },
  { driver: 'Mongo', smokeTest: 'bun run smoke:db:mongodb', durable: true },
  { driver: 'DynamoDB', smokeTest: 'bun run smoke:db:dynamodb', durable: true },
  { driver: 'SQLite', smokeTest: 'bun run smoke:db:sqlite', durable: true }
];

export function selectDatabaseAdapter(driver: string): DatabaseAdapterChoice {
  const choice = databaseChoices.find((item) => item.driver === driver);

  if (!choice) {
    throw new Error('Unsupported database driver: ' + driver);
  }

  return choice;
}
```
