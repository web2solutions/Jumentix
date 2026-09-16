# Camada de dados offline do frontend

The English version is at [FRONTEND-OFFLINE-DATA-LAYER.md](./FRONTEND-OFFLINE-DATA-LAYER.md).

`apps/frontend` é offline-first sobre `@jumentix/cana`. A OAS é lida no boot, o IndexedDB abre **antes** do login, a primeira sessão autenticada faz carga completa atrás de uma tela de progresso, e o X-CRUD lê e grava a cópia local. O SDK REST serve auth, sync e replay da outbox — não as listagens depois que o Cana está aberto.

## Boot (JUM-802)

1. `src/data/canaSchema.ts` deriva um store por entidade OAS com operação de lista (`User` → `users`, `Organization` → `organizations`). `keyPath` é `x-primary-key`. Índices: campos sortable/filterable + `updatedAt` + `deletedAt` + cada `x-relation.field`, mais `meta` e `outbox`.
2. A `version` do schema é um inteiro positivo estável (hash do conjunto de stores). Se a fingerprint em `meta` diverge, o banco é **apagado e recriado** (resync completo). Upgrades do Cana são só aditivos; este seed não migra linhas no lugar.
3. `src/data/db.ts` chama `createClient({ fallback: false }).open()` antes de `app.mount`. Sem IndexedDB → tela de erro (i18n). Sem fallback para localStorage.

## Repositório local (JUM-803)

`src/data/localRepository.ts` lista pelo Cana (usa índice quando a ordenação primária está indexada e não há busca/filtro) e aplica `runListQuery` de `@jumentix/persistence-contracts`. `resolveRelations` carrega belongsTo. Listeners acompanham eventos Cana da entidade e dos alvos de relação.

## Modo local do X-CRUD (JUM-804)

Com Cana aberto, `entityStore` lista local e mutações passam pela outbox. Testes de componente que nunca chamam `openCana()` mantêm o caminho de servidor. Depois do sync, listagens não precisam de `GET /api/.../users`. Totais do dashboard usam contagens locais. Linhas de lista omitem arrays aninhados; o sync completa com GET-by-id (`getOneById` / `getOrganizationById`) quando falta um campo array. O store de perfil lê o usuário autenticado no Cana; saves de escalares passam pela outbox de User. Sub-recursos email/documento/telefone ainda usam REST e gravam a cópia GET de volta no Cana.

## Sync (JUM-805)

O login vai para `/sync`. `fullLoad` pagina cada listagem em `maxSize` (100), `updatedAt:asc,id:asc`. `deltaSync` usa `updatedAt gt lastSync` e `includeDeleted=true`. Outro username apaga o banco e faz full load. O shell só roteia depois de `meta.session.lastSyncAt`.

## Outbox (JUM-806 / JUM-807)

A UI grava no Cana primeiro com `_sync: 'pending'`. Intents na store `outbox` na mesma transação. Replay por `createdAt`; 2xx troca o registro local pela cópia do servidor; 5xx/rede ficam pending; 4xx definitivo compensa e notifica com “reabrir com meus dados”. 401 segue o expiry de sessão e mantém a outbox do mesmo usuário.

## PWA (JUM-808)

Worker escrito à mão em `public/sw.js` (sem `vite-plugin-pwa`). Registro em build de produção, ou com `VITE_PWA=1`. O processo `vite` (não produção) não registra o worker; o e2e Cypress contra `vite` prova leitura local falhando `/api` depois do sync. `public/manifest.json` usa `info.title` da OAS, com ícones 192/512 (`purpose` `any` / `any maskable`).

Lighthouse PWA (comando que produziu o número):

```bash
rtk proxy bun run --filter @jumentix/frontend build
rtk proxy bun run --filter @jumentix/frontend preview -- --host 127.0.0.1 --port 4173
npx lighthouse@11.7.1 http://127.0.0.1:4173/ --only-categories=pwa --chrome-flags="--headless --no-sandbox"
```

Resultado: **score da categoria PWA 1** (`lighthouse` 11.7.1). `installable-manifest` 1, `splash-screen` 1, `themed-omnibox` 1, `maskable-icon` 1, `content-width` 1, `viewport` 1. `lighthouse` 12.8.2 devolve `categories.pwa` vazio — essa release removeu a categoria PWA.

## Testes (JUM-809)

`fake-indexeddb` `6.2.5` no preload `test/setup/indexeddb.ts`. Cypress: `cy.goOffline()`, `cy.goOnline()`, `cy.serverCreate()`. Specs: `offline-boot.cy.ts`, `offline-sync.cy.ts`, `offline-writes.cy.ts`, `offline-pwa.cy.ts`. `rtk proxy bun run --filter @jumentix/frontend test:e2e` → **20 passing / 0 failing** em 9 specs.
