# Adapters de bancos de dados

Escolha o adapter de banco pelo modelo de dados, pelo perfil operacional e pelo smoke test que confirma o ciclo de vida de conexão.

## Tabela de comparação dos bancos integrados

| Adapter | Tecnologia integrada | Modelo de dados | Melhor uso | Smoke test |
| --- | --- | --- | --- | --- |
| [InMemory](/docs/pt-BR/jumentix/adapters/databases/inmemory) | Store em memória local ao processo | Objetos com chave | Testes unitários, demos e exemplos de contrato sem browser. | `bun run smoke:db:inmemory` |
| [PostgreSQL](/docs/pt-BR/jumentix/adapters/databases/postgresql) | PostgreSQL pelo perfil de cliente SQL | SQL relacional | Sistemas transacionais com integridade relacional, índices e relatórios. | `bun run smoke:db:postgresql` |
| [MySQL](/docs/pt-BR/jumentix/adapters/databases/mysql) | MySQL pelo perfil de cliente SQL | SQL relacional | Workloads relacionais comuns, CRUD SaaS e times com experiência operacional em MySQL. | `bun run smoke:db:mysql` |
| [SQL Server](/docs/pt-BR/jumentix/adapters/databases/mssql) | Microsoft SQL Server pelo perfil de cliente SQL | SQL relacional | Ambientes enterprise padronizados em plataformas de dados Microsoft. | `bun run smoke:db:mssql` |
| [Oracle](/docs/pt-BR/jumentix/adapters/databases/oracle) | Oracle Database pelo perfil de cliente SQL | SQL relacional | Sistemas enterprise já investidos em operação e governança Oracle. | `bun run smoke:db:oracle` |
| [SQLite](/docs/pt-BR/jumentix/adapters/databases/sqlite) | Banco SQL embarcado em arquivo | SQL relacional embarcado | Desenvolvimento local, protótipos edge, testes e utilitários single-node. | `bun run smoke:db:sqlite` |
| [MongoDB](/docs/pt-BR/jumentix/adapters/databases/mongodb) | MongoDB por wiring de repositório Mongoose | Banco de documentos | Domínios centrados em documentos, schemas flexíveis e persistência no formato de agregados. | `bun run smoke:db:mongodb` |
| [DynamoDB](/docs/pt-BR/jumentix/adapters/databases/dynamodb) | Banco key-value e documento AWS DynamoDB | Key-value/documento | Serviços AWS-native que precisam de escala gerenciada e modelagem por padrão de acesso. | `bun run smoke:db:dynamodb` |
| [Cassandra](/docs/pt-BR/jumentix/adapters/databases/cassandra) | Banco wide-column Apache Cassandra | Wide-column | Volume muito alto de escrita, distribuição multi-node e padrões de consulta conhecidos antes. | `bun run smoke:db:cassandra` |
| [Firebase](/docs/pt-BR/jumentix/adapters/databases/firebase) | Perfil de banco Firebase com suporte a emulator | Dados de app documento/realtime | Superfícies de produto rápidas que aproveitam tooling Firebase e validação local com emulator. | `bun run smoke:db:firebase` |
| [Aurora](/docs/pt-BR/jumentix/adapters/databases/aurora) | Perfil relacional compatível com Amazon Aurora | SQL relacional gerenciado | Workloads relacionais na AWS que precisam de operação gerenciada e caminhos de escala cloud. | `bun run smoke:db:aurora` |
| [RDS](/docs/pt-BR/jumentix/adapters/databases/rds) | Perfil relacional compatível com Amazon RDS | SQL relacional gerenciado | Times AWS padronizando bancos relacionais gerenciados sem mudar código de domínio. | `bun run smoke:db:rds` |

## Guia rápido

- Use **InMemory** para testes, demos e exemplos.
- Use bancos SQL quando o domínio pede relações, transações e relatórios.
- Use **SQLite** para local, single-node e arquivo.
- Use **MongoDB** quando agregados são documentos.
- Use **DynamoDB** ou **Cassandra** quando padrões de acesso e escala de escrita são centrais.
- Use **Firebase** quando o ecossistema Firebase e emulator ajudam o produto.

## Exemplo completo de seleção

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
