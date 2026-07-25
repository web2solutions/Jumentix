<!--
Arquivo gerado automaticamente a partir de: packages/README.md
Idioma alvo: Português (Brasil)
-->
# Pacotes de espaço de trabalho Jumentix

Esta pasta contém pacotes npm reutilizáveis ​​compartilhados entre aplicativos Jumentix.

## Índice de pacotes

- `@jumentix/cli-init` - bootstrap CLI para criar estruturas de projeto.
- `@jumentix/message-mediator` - mediador de evento/solicitação-resposta baseado em contrato.
- `@jumentix/key-value-storage` - contratos e adaptadores de armazenamento de valor-chave.
- `@jumentix/mutex-service` - camada de contrato de serviço de bloqueio distribuído.
- `@jumentix/persistence-contracts` - Abstrações `IDatabaseClient` e `IStore`.
- `@jumentix/external-persistence-core` - contratos/implementações de repositório base.
- `@jumentix/external-store-proxy` - traduz clientes nativos do banco de dados para `IStore`.
- `@jumentix/external-db-repositories` - Adaptadores de repositório de banco de dados.
- `@jumentix/database-client-factory` - compilação do cliente de banco de dados por driver.
- `@jumentix/runtime-infra` - infra ajudantes do ambiente de tempo de execução.
- `@jumentix/adapter-runtime-bootstrap` - composição de bootstrap do adaptador compartilhado.
- `@jumentix/sdk-rest-client` - cliente REST SDK.
- `@jumentix/sdk-websocket-client` - cliente WebSocket SDK.
- `@jumentix/sdk-grpc-client` - cliente gRPC SDK.

## Padrão de uso

Cada pacote tem seu próprio `README.md`, scripts e limites de propriedade. Importe pacotes de aplicativos em vez de duplicar a lógica do adaptador em cada aplicativo.

## Documentos relacionados

- [Pacotes Jumentix Workspace (Arquitetura)](../documentation/md/JUMENTIX-WORKSPACE-PACKAGES.md)
- [Ponte de compatibilidade do SDK](../documentation/md/SDK-COMPATIBILITY-BRIDGE.md)
