# Extensões OAS (vocabulário de contrato v2)

Linear: [JUM-787](https://linear.app/jumentix/issue/JUM-787) … [JUM-794](https://linear.app/jumentix/issue/JUM-794).
English: [OAS-VENDOR-EXTENSIONS.md](./OAS-VENDOR-EXTENSIONS.md).

Documento canônico: `spec/1.0.0.yml`. O frontend consome o JSON empacotado (`apps/frontend/src/contracts/openapi.json`).

## Migração: `x-references` → `x-relation`

`x-references` (`entity`, `operationId`, `labelField`) saiu. Sem alias. Candidatos da lista vêm da operação cujo schema 200 é `<Entity>ArrayOf`.

`x-relations` do designer (nível de documento) é outro conceito e permanece.

## `x-label`

Legendas localizadas (`en`, `pt-BR`). Consumidor: labels do frontend.

## `x-hide`

`true`: a propriedade fica no contrato e não renderiza no formulário.

## `x-validation`

Máscaras/checksums. Consumidor: `apps/frontend/src/contracts/validation`.

## `x-list-capabilities`

Nas operações de lista: `sortable`, `filterable`, `searchable`, `defaultSize`, `maxSize`, `includeDeleted` opcional. Ver [PAGINATED-LIST-CONTRACT.pt-BR.md](./PAGINATED-LIST-CONTRACT.pt-BR.md).

## `x-relation`

Relação no campo (JUM-787): `field`, `entity`, `match`, `display`, `kind` (`belongsTo` | `hasMany`). `field` default = nome da propriedade; `match` default = `x-primary-key` do alvo.

## `x-primary-key`

Campo-chave no schema da entidade (`id` em User e Organization). Gate: `oas:check-relations`.

## `x-rbac`

Matriz papel→escopo no documento. Nas operações, o mesmo `x-rbac` da lista vale para métricas.

## `x-service-id`

Em `servers[]`: id em `x-services[]`.

## `x-services` / `x-service` / `servers`

Lista de serviços no documento; cada `servers[]` leva `x-service-id`. Operação/schema: `x-service` (default `core`). `RestApiClient` resolve a URL por operação. Vite: `/api` no monólito; `VITE_API_PROXY_TARGETS` JSON opcional.

## `x-sync`

`cursorField: updatedAt`, `includeDeletedParam: includeDeleted`. Página de sync: `sort=updatedAt:asc,id:asc`, filtro `gt` no cursor, `includeDeleted=true`. Empate em `updatedAt` quebra na chave primária.

## `x-metrics-capabilities`

`groupable` e `series`. Ver [ENTITY-METRICS-CONTRACT.pt-BR.md](./ENTITY-METRICS-CONTRACT.pt-BR.md).

## Tombstones `deletedAt`

`DELETE` grava `deletedAt`; sem delete físico nesta entrega. Lista omite tombstones salvo `includeDeleted=true`. GET de tombstone → 404 sem a flag.

**Unicidade:** tombstone **libera** o valor (`username`, `name`). Login ignora tombstones. Purge fica fora de escopo.

## Verificação

`bun run oas:check-routes` e `bun run oas:check-relations`.
