<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-MIGRATION-INVENTORY-AND-ROLLBACK.md
Idioma alvo: Português (Brasil)
-->
# Inventário e reversão de migração Jumentix

Este documento define proteções de migração concretas para a transformação Jumentix monorepo.

## Escopo e critérios de onda

### Onda 1 (obrigatório)

- Mantenha estável o comportamento atual do tempo de execução e os contratos de API públicos.
- Estabeleça espaços de trabalho pnpm e limites de pacotes já estruturados em `apps/` e `packages/`.
- Mantenha os scripts de compatibilidade raiz operacionais enquanto a propriedade do aplicativo/pacote é movida progressivamente.
- Atualizar documentos e requisitos `.agents` no mesmo PR conforme alterações de código.

### Onda 2+ (melhorias)

- Transferência total do tempo de execução para caminhos de propriedade do aplicativo (`apps/backend-template`, `apps/service-management`).
- Matriz CI nativa do espaço de trabalho (`pnpm -r`) como padrão.
- Automação independente de lançamento de pacotes para adaptadores e SDKs reutilizáveis.

## Decisões de nomenclatura

- Nome do produto: `Jumentix`.
- Nome do pacote CLI: `@jumentix/cli-init`.
- Comando de inicialização:
  - comando de compatibilidade atual: `jumentix-bootstrap`
  - destino oficial de instalação global: `pnpm add -g @jumentix/cli-init`
  - comando de tempo de execução: `jumentix-init`

## Estratégia de ramificação, tag e reversão

## Convenções de filial

- Ramo de integração principal: `dev`.
- Ramos de migração por onda:
  - `codex/jumentix-wave0-guardrails`
  - `codex/jumentix-wave1-topologia`
  - `codex/jumentix-wave2-foundation`
  - `codex/jumentix-wave3-packages`
  - `codex/jumentix-wave4-cli`
  - `codex/jumentix-wave5-app-rehoming`

## Liberar pontos de verificação (tags)

- Etiqueta de ponto de verificação pré-onda:
  - `jumentix-pre-waveX-<aaaammdd>`
- Etiqueta de ponto de verificação pós-onda:
  - `jumentix-post-waveX-<aaaammdd>`

## Procedimento de reversão por onda

1. Identifique o ramo da onda com falha e a etiqueta pré-onda estável mais recente.
2. Reverter onda PR(s) de `dev` na ordem inversa se parcialmente mesclada.
3. Execute novamente os portões obrigatórios:
   - `pnpm executar ci:gate`
   - `cobertura de execução pnpm:patch`
4. Se a reversão for necessária em ramificações de produção, avance apenas a partir da tag pré-onda e aplique novamente os commits seguros.

## Mapeamento de inventário (atual -> destino)

## Aplicativos

- `apps/backend-template/src/` + bootstraps de tempo de execução -> `apps/backend-template/src/` (migração em etapas com scripts de compatibilidade).
- `apps/service-management/` -> `apps/service-management/`.

## Pacotes

- `bin/jumentix-bootstrap.js` + lógica de bootstrap -> `packages/cli-init/`.
- `apps/backend-template/src/infra/messages/*` + `apps/backend-template/src/modules/port/IMessage*` -> `packages/message-mediator/`.
- `apps/backend-template/src/infra/persistence/KeyValueStorage/*` -> `packages/key-value-storage/`.
- `apps/backend-template/src/infra/mutex/*` -> `pacotes/mutex-service/`.
- `apps/backend-template/src/infra/ports/persistence/IStore.ts` + `apps/backend-template/src/infra/persistence/port/IDatabaseClient.ts` -> `packages/persistence-contracts/`.
- `apps/backend-template/src/infra/persistence/external/BaseExternalDataRepository.ts` -> `packages/external-persistence-core/`.
- `apps/backend-template/src/infra/persistence/external/ExternalStoreProxy.ts` -> `packages/external-store-proxy/`.
- `apps/backend-template/src/infra/persistence/external/*.ts` adaptadores de banco de dados concretos -> `packages/external-db-repositories/`.
- `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts` -> `packages/database-client-factory/`.
- `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts` + uso do compilador infra de tempo de execução -> `packages/runtime-infra/`.
- auxiliares de composição de bootstrap do adaptador -> `packages/adapter-runtime-bootstrap/`.
- `sdk-clients/rest|websocket|grpc` fontes canônicas -> `packages/sdk-*` (o legado `sdk-clients` permanece como ponte de compatibilidade).

## Bloqueadores e restrições preparadas

- As suposições do caminho raiz nas configurações do PM2 e nos scripts de pacote ainda exigem uma camada de compatibilidade durante a transição.
- CI ainda executa fluxos npm-root como linha de base; A porta recursiva pnpm se tornará primária após a estabilização completa do arquivo de bloqueio.
- Os aliases de importação em `tsconfig.json` devem permanecer com mapeamento duplo até que a realocação completa da fonte seja concluída.
