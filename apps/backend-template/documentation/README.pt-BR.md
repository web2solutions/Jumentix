<!--
Arquivo gerado automaticamente a partir de: apps/backend-template/documentation/README.md
Idioma alvo: Português (Brasil)
-->
# Hub de documentação de modelo de back-end

Este é o centro de documentação técnica para o aplicativo de modelo de back-end usado pela Jumentix para inicializar serviços de back-end.

## Índice

- Guias
  - [Criando API REST com Jumentix](./guides/CREATING-REST-API-WITH-JUMENTIX.md)
  - [Criando API em tempo real com Jumentix](./guides/CREATING-REALTIME-API-WITH-JUMENTIX.md)
- Arquitetura e estrutura
  - [Arquitetura e Estrutura](../../../documentation/md/ARCHITECTURE-AND-STRUCTURE.md)
  - [Migração hexagonal baseada em recursos](../../../documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md)
- Tempo de execução e adaptadores
  - [Contratos de ambiente de tempo de execução](../../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md)
  - [Adaptadores HTTP](../../../documentation/md/adapters/http/README.md)
  - [API WebSocket em tempo real](../../../documentation/md/adapters/realtime/WEBSOCKET-API.md)
  - [API gRPC em tempo real](../../../documentation/md/adapters/realtime/GRPC-API.md)
- Dados e persistência
  - [Adaptadores de banco de dados](../../../documentation/md/adapters/databases/README.md)
  - [Testes de fumaça de drivers de banco de dados](../../../documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md)
- Contratos e qualidade
  - [Especificações OpenAPI](../../../spec/1.0.0.yml)
  - [Mapa de eventos e mensagens](../../../documentation/md/EVENTS-AND-MESSAGES-MAP.md)
  - [Erro de contratos e respostas](../../../documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md)
  - [Teste, CI e Qualidade](../../../documentation/md/TESTING-CI-AND-QUALITY.md)

## O que este componente oferece

- Contrate primeiro serviços de back-end com OpenAPI 3.1 e AsyncAPI.
- Linha de base da arquitetura DDD + Hexagonal para evolução modular de monólitos e microsserviços.
- Matriz de adaptador de tempo de execução para contextos REST, em tempo real e sem servidor.
- Camadas de persistência e mensagens conectáveis ​​através de pacotes `@jumentix/*` compartilhados.

## Principais pontos de entrada

- Carregadores e adaptadores de tempo de execução REST em `apps/backend-template/src/interface/HTTP`.
- Carregadores e adaptadores de tempo de execução em tempo real em `apps/backend-template/src/interface/WebSocket` e `apps/backend-template/src/interface/gRPC`.
- Perfis PM2 do repo root `pm2/` para orquestração de processos de desenvolvimento/preparação/produção.

## Instantâneo da arquitetura

- Os módulos de domínio expõem casos de uso e controladores por meio de adaptadores de entrada.
- As preocupações de saída (banco de dados, valor-chave, mensagens) são injetadas por meio de pacotes de tempo de execução compartilhados.
- Os contratos de API são OpenAPI first para REST e AsyncAPI first para canais em tempo real.

## Exemplos de integração

Perfil REST com seleção explícita de estrutura:

```bash
AAA_HTTP_FRAMEWORK=fastify pnpm run dev:http
```

Perfil substituto WebSocket + REST:

```bash
AAA_REALTIME_API=yes AAA_REALTIME_API_PROTOCOL=websocket pnpm run dev:websocket
```

Perfil substituto gRPC + REST:

```bash
AAA_REALTIME_API=yes AAA_REALTIME_API_PROTOCOL=grpc pnpm run dev:grpc
```

