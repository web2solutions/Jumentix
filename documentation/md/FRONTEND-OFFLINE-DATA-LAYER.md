# Frontend offline data layer

The Portuguese version is at [FRONTEND-OFFLINE-DATA-LAYER.pt-BR.md](./FRONTEND-OFFLINE-DATA-LAYER.pt-BR.md).

`apps/frontend` is offline-first on `@jumentix/cana`. The OAS is parsed at boot, IndexedDB opens **before** the login form, the first signed-in session runs a full load behind a progress view, and X-CRUD reads and writes the local copy. The REST SDK is used for auth, sync, and outbox replay — not for grid reads after Cana is open.

## Boot (JUM-802)

1. `src/data/canaSchema.ts` derives one store per OAS entity that has a list operation (`User` → `users`, `Organization` → `organizations`). `keyPath` is `x-primary-key`. Indexes are sortable and filterable fields plus `updatedAt`, `deletedAt`, and every `x-relation.field`, plus internal stores `meta` and `outbox`.
2. Schema `version` is a stable positive integer hash of that store set. When the fingerprint in `meta` disagrees, the database is **dropped and recreated** (full resync). Cana upgrades are additive; this seed does not migrate rows in place.
3. `src/data/db.ts` calls `createClient({ fallback: false }).open()` before `app.mount`. IndexedDB unavailable → boot error view (i18n). No localStorage fallback.

## Local repository (JUM-803)

`src/data/localRepository.ts` lists through Cana (`query` uses an index when the primary sort field is indexed and there is no search/filter) and then `runListQuery` from `@jumentix/persistence-contracts`. `resolveRelations` loads belongsTo rows. Live listeners subscribe to Cana events on the entity store and its relation targets.

## X-CRUD local mode (JUM-804)

When Cana is open, `entityStore` lists locally and mutations go through the outbox. Component tests that never call `openCana()` keep the previous server path (`x-list-capabilities`). After sync, listings do not need `GET /api/.../users`. Dashboard totals use local counts. List rows omit nested arrays, so sync follows each list page with GET-by-id (`getOneById` / `getOrganizationById`) when an array field is missing. The profile store then reads the signed-in user from Cana; scalar saves go through the User outbox. Email/document/phone sub-resources still call REST and write the GET copy back into Cana.

## Sync (JUM-805)

Login routes to `/sync`. `fullLoad` pages each list operation at `maxSize` (100), sorted `updatedAt:asc,id:asc`. `deltaSync` uses `updatedAt gt lastSync` and `includeDeleted=true`. A different username wipes the database and full-loads again. The shell is routed only after `meta.session.lastSyncAt` is written.

## Outbox (JUM-806 / JUM-807)

UI writes Cana first with `_sync: 'pending'`. Intents live in `outbox` in the same transaction. Replay order follows `createdAt`; 2xx replaces the local row with the server copy; 5xx/network stay pending; definitive 4xx compensates (create → delete, update/delete → `beforeImage`) and pushes a notification with “reopen with my data”. 401 uses the existing session-expiry path and keeps the outbox for the same user.

## PWA (JUM-808)

Hand-written `public/sw.js` (no `vite-plugin-pwa` — pinning and third-party review cost more than a small worker). Registration runs in production builds, or when `VITE_PWA=1`. The non-production `vite` process does not register the worker, so Cypress e2e against `vite` proves local reads by failing `/api` after sync, not by stopping the origin server. `public/manifest.json` uses the OAS `info.title` (`Jumentix API`), plus 192/512 icons (`purpose` `any` / `any maskable`).

Lighthouse PWA (command that produced the number):

```bash
rtk proxy bun run --filter @jumentix/frontend build
rtk proxy bun run --filter @jumentix/frontend preview -- --host 127.0.0.1 --port 4173
npx lighthouse@11.7.1 http://127.0.0.1:4173/ --only-categories=pwa --chrome-flags="--headless --no-sandbox"
```

Result: **PWA category score 1** (`lighthouse` 11.7.1). `installable-manifest` 1, `splash-screen` 1, `themed-omnibox` 1, `maskable-icon` 1, `content-width` 1, `viewport` 1. `lighthouse` 12.8.2 returns `categories.pwa` empty — that release dropped the PWA category, so 11.7.1 is the audit that still grades installability.

## Tests (JUM-809)

`fake-indexeddb` `6.2.5` is preloaded from `test/setup/indexeddb.ts`. Cypress helpers: `cy.goOffline()`, `cy.goOnline()`, `cy.serverCreate()`. Specs: `offline-boot.cy.ts`, `offline-sync.cy.ts`, `offline-writes.cy.ts`, `offline-pwa.cy.ts`. `rtk proxy bun run --filter @jumentix/frontend test:e2e` → **20 passing / 0 failing** across 9 specs.
