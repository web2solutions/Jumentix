<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-WORKSPACE-PACKAGES.md
Idioma alvo: Português (Brasil)
-->
# Pacotes de espaço de trabalho JumentiX

Este documento rastreia o mapa de pacotes atual para ondas de migração monorepo.

## Pacotes de tempo de execução e arquitetura

- `@jumentix/message-mediator`
- `@jumentix/armazenamento de valor-chave`
- `@jumentix/persistence-contracts`
- `@jumentix/mutex-service`
- `@jumentix/external-persistence-core`
- `@jumentix/external-store-proxy`
- `@jumentix/external-db-repositories`
- `@jumentix/database-client-factory`
- `@jumentix/runtime-infra`
- `@jumentix/adapter-runtime-bootstrap`

## Pacotes de desenvolvedor/produto

- `@jumentix/cli-init`
- `@jumentix/sdk-rest-client`
- `@jumentix/sdk-websocket-client`
- `@jumentix/sdk-grpc-client`

## Espaços de trabalho de aplicativos

- `@jumentix/backend-template` (espaço reservado durante a migração)
- `@jumentix/service-management` (espaço reservado durante a migração)

## Notas

- Os pacotes SDK agora possuem scripts de origem e de construção em nível de pacote.
- O legado `sdk-clients/` permanece como uma ponte compatível com versões anteriores que reexporta de `packages/sdk-*`.
- O contrato de ponte de compatibilidade está documentado em `documentation/md/SDK-COMPATIBILITY-BRIDGE.md`.
- O pacote CLI agora possui implementação de bootstrap canônico.
- O ponto de entrada Root CLI permanece como wrapper de compatibilidade.
