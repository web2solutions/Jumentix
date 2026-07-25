<!--
Arquivo gerado automaticamente a partir de: documentation/md/EXTERNAL-DATA-ADAPTER-FOUNDATIONS.md
Idioma alvo: Português (Brasil)
-->
# Fundações do adaptador de dados externos

Para suportar topologias de implantação heterogêneas, o projeto inclui bases iniciais de adaptadores para provedores de persistência externos.

## Localização

- `apps/backend-template/src/infra/persistence/external/`

## Fundações incluídas

- `SqlSequelizeRepositório`
  - Dialetos: `postgres`, `mysql`, `mssql`, `oracle`, `sqlite`
- `MongoMongooseRepositório`
- `DynamoDbRepositório`
- `CassandraRepositório`
- `FirebaseRepositório`
- `OracleRepositório`
- `AuroraRepositório`
- `RdsRepositório`

Todos os provedores estendem `BaseExternalDataRepository` e expõem métodos de ciclo de vida de conexão/desconexão sem forçar o acoplamento rígido em tempo de execução quando não são usados.

`compileDatabaseClient` agora mapeia provedores externos para proxies de armazenamento rápidos, de forma que a falta de fiação de repositório/loja seja explícita durante a execução, em vez de usar silenciosamente armazenamentos na memória.

Para validação de fumaça ponta a ponta com Docker por banco de dados, consulte:

- [Testes de fumaça de drivers de banco de dados](./DATABASE-DRIVERS-SMOKE-TESTS.md)

## Repositório de solicitação/resposta de fila

Para padrões de solicitação-resposta assíncronos em transportes semelhantes a filas:

- `apps/backend-template/src/infra/messages/repositories/QueueRequestResponseRepository.ts`

Esta classe é baseada em contrato e funciona por meio da abstração do mediador de mensagens, que pode ser apoiada por:

- InMemory
- CoelhoMQ
- BullMQ
