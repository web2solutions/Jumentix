<!--
Arquivo gerado automaticamente a partir de: sdk-clients/README.md
Idioma alvo: Português (Brasil)
-->
# sdk-clients (camada de compatibilidade)

Superfície de compatibilidade legada para importações de SDK.

## Propósito

Este diretório é mantido para evitar a interrupção das importações existentes enquanto a migração monorepo move a propriedade do SDK para pacotes de espaço de trabalho:

- `@jumentix/sdk-rest-client`
- `@jumentix/sdk-websocket-client`
- `@jumentix/sdk-grpc-client`

## Comportamento atual

- `sdk-clients/rest/RestApiClient.ts` reexporta de `packages/sdk-rest-client`.
- `sdk-clients/websocket/WebSocketApiClient.ts` reexportações de `packages/sdk-websocket-client`.
- `sdk-clients/grpc/GrpcApiClient.ts` reexporta de `packages/sdk-grpc-client`.
- `sdk-clients/spec/loadSpecs.ts` agrega carregadores de especificações por pacote.

## Orientação de migração

Use pacotes de espaço de trabalho diretamente para novo código. Mantenha esta camada de compatibilidade apenas para compatibilidade com versões anteriores até a transição completa.
