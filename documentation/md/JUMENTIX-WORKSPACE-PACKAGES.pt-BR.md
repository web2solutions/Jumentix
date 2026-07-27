# Pacotes do Workspace Jumentix

Este documento rastreia o mapa de pacotes e aplicações implementado em `dev`.

## Pacotes de tempo de execução e arquitetura

- `@jumentix/message-mediator`
- `@jumentix/key-value-storage`
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

## Placeholders Privados de Configuração e Contratos

- `@jumentix/config-eslint`
- `@jumentix/config-jest`
- `@jumentix/config-ts`
- `@jumentix/shared-contracts`

Esses quatro workspaces são placeholders privados de migração. Seus scripts de ciclo de vida
informam intencionalmente que a migração está pendente. A configuração executável e os contratos de
API canônicos permanecem na raiz e em `spec/` até que essas migrações sejam implementadas.

## Workspaces de Aplicações

- `@jumentix/backend-template` - aplicação/template backend TypeScript com composição REST,
  realtime, CLI, persistência, mensageria, serverless e PM2.
- `@jumentix/service-management` - servidor e interface de gestão em JavaScript; os testes de
  integração são delegados ao runner raiz.
- `@jumentix/website` - website comercial e documental em Next.js/Nextra/Mantine, com sincronização
  bilíngue, Storybook, verificações estáticas e comandos Vercel.

## Notas

- Os pacotes SDK agora possuem scripts de origem e de construção em nível de pacote.
- O legado `sdk-clients/` permanece como uma ponte compatível com versões anteriores que reexporta de `packages/sdk-*`.
- O contrato de ponte de compatibilidade está documentado em `documentation/md/SDK-COMPATIBILITY-BRIDGE.md`.
- O pacote CLI agora possui implementação de bootstrap canônico.
- O ponto de entrada Root CLI permanece como wrapper de compatibilidade.
- Estados, links e READMEs de cada pacote estão indexados em `packages/README.pt-BR.md`.
- Node.js 22 e pnpm 9.15.3 formam o contrato de runtime e gerenciador de pacotes.
