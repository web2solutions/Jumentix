<!--
Arquivo gerado automaticamente a partir de: packages/README.md
Idioma alvo: Português (Brasil)
-->
# Pacotes do workspace Jumentix

Esta pasta contém os pacotes npm reutilizáveis e os pacotes privados de configuração compartilhados
pelas aplicações Jumentix.

## Índice de pacotes

### Runtime e persistência

- [`@jumentix/adapter-runtime-bootstrap`](./adapter-runtime-bootstrap/README.pt-BR.md) - composição compartilhada do runtime de adapters.
- [`@jumentix/cana`](./cana/README.pt-BR.md) - adaptador IndexedDB offline com documentação e playgrounds para o consumidor.
- [`@jumentix/database-client-factory`](./database-client-factory/README.pt-BR.md) - compilação do cliente de banco por driver selecionado.
- [`@jumentix/external-db-repositories`](./external-db-repositories/README.pt-BR.md) - repositórios reutilizáveis para bancos externos.
- [`@jumentix/external-persistence-core`](./external-persistence-core/README.pt-BR.md) - contratos e implementações-base de persistência externa.
- [`@jumentix/external-store-proxy`](./external-store-proxy/README.pt-BR.md) - pontes entre clientes nativos e `IStore`.
- [`@jumentix/key-value-storage`](./key-value-storage/README.pt-BR.md) - contratos e adapters in-memory/Redis.
- [`@jumentix/mutex-service`](./mutex-service/README.pt-BR.md) - compiler e adapter reutilizável de mutex.
- [`@jumentix/persistence-contracts`](./persistence-contracts/README.pt-BR.md) - abstrações `IDatabaseClient` e `IStore`.
- [`@jumentix/runtime-infra`](./runtime-infra/README.pt-BR.md) - utilitários de ambiente e infraestrutura de runtime.

### Mensageria, bootstrap e contratos

- [`@jumentix/cli-init`](./cli-init/README.pt-BR.md) - CLI de bootstrap de estruturas de projeto.
- [`@jumentix/message-mediator`](./message-mediator/README.pt-BR.md) - mediador de eventos e request/response.
- [`@jumentix/shared-contracts`](./shared-contracts/README.pt-BR.md) - auxiliares compartilhados de resolução de specs canônicas OpenAPI/AsyncAPI.

### Clientes SDK

- [`@jumentix/sdk-rest-client`](./sdk-rest-client/README.pt-BR.md) - cliente SDK REST.
- [`@jumentix/sdk-websocket-client`](./sdk-websocket-client/README.pt-BR.md) - cliente SDK WebSocket.
- [`@jumentix/sdk-grpc-client`](./sdk-grpc-client/README.pt-BR.md) - cliente SDK gRPC.

### Service Management

- [`@jumentix/designer-core`](./designer-core/README.pt-BR.md) - núcleo do designer livre de framework (modelo, validação, exportadores, importadores, versionamento de pacotes de domínio); ESM seguro para navegador, publicação somente dry-run.

### Configuração privada do workspace

- [`@jumentix/config-eslint`](./config-eslint/README.pt-BR.md) - configuração ESLint compartilhada reservada.
- [`@jumentix/config-jest`](./config-jest/README.pt-BR.md) - configuração Jest compartilhada reservada.
- [`@jumentix/config-ts`](./config-ts/README.pt-BR.md) - configuração TypeScript compartilhada reservada.

Pacotes descritos como **reservados** são placeholders privados intencionais no `dev` atual. Seus
scripts informam que a onda de migração está pendente; eles não devem ser apresentados como
publicados ou prontos para produção.

## Padrão de uso

Cada pacote possui README em inglês e português, scripts e limites de propriedade. Importe os
pacotes nas aplicações em vez de duplicar lógica de adapter. O runtime canônico dos fluxos internos
de engenharia é Bun 1.3.13, com Node.js 22 mantido como alvo explícito de compatibilidade para
artefatos de runtime expostos a consumidores.

## Documentos relacionados

- [Pacotes Jumentix Workspace (Arquitetura)](/docs/jumentix/concepts/architecture)
- [Ponte de compatibilidade do SDK](/docs/jumentix/packages)
