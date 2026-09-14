# OAS vendor extensions (contract vocabulary v2)

Linear: [JUM-787](https://linear.app/jumentix/issue/JUM-787) … [JUM-794](https://linear.app/jumentix/issue/JUM-794).
Portuguese: [OAS-VENDOR-EXTENSIONS.pt-BR.md](./OAS-VENDOR-EXTENSIONS.pt-BR.md).

Canonical document: `spec/1.0.0.yml`. Frontend consumes the bundled JSON (`apps/frontend/src/contracts/openapi.json`).

## Migration: `x-references` → `x-relation`

`x-references` (`entity`, `operationId`, `labelField`) is removed. There is no alias. List candidates come from the operation whose 200 schema is `<Entity>ArrayOf`, not from the extension.

Designer `x-relations` (document-level name/fromSchema/toSchema) is a different concept and stays.

## `x-label`

Localized captions (`en`, `pt-BR`) on a property. Consumer: `apps/frontend/src/contracts` labels.

## `x-hide`

When `true`, the property stays in the contract but does not render in OAS-driven forms.

## `x-validation`

Masks/checksums for form fields. Consumer: `apps/frontend/src/contracts/validation`.

## `x-list-capabilities`

On list operations: `sortable`, `filterable`, `searchable`, `defaultSize`, `maxSize`, optional `includeDeleted`. See [PAGINATED-LIST-CONTRACT.md](./PAGINATED-LIST-CONTRACT.md). Consumer: `listSchema.ts`, `setListQuery.ts`.

## `x-relation`

Property-level relation (JUM-787):

```yaml
x-relation:
  field: organization   # optional; defaults to the property name
  entity: Organization
  match: id             # optional; defaults to the target's x-primary-key
  display: name
  kind: belongsTo       # or hasMany for arrays of ids
```

Consumer: `formSchema.ts` (`FieldDescriptor.relation`), X-CRUD. Backend metadata: `@belongsTo` / `@hasMany` + `getModelRelations`.

## `x-primary-key`

Schema-level key field (`id` on User and Organization). Repeated on the entity schema; `allOf` / `*ArrayOf` inherit through `$ref`. Consumer: `entityPrimaryKey()`. Gate: `oas:check-relations`.

## `x-rbac`

Document-level role-to-scope matrix. Operation-level `x-rbac` repeats the same scopes as the matching list/metrics pair.

## `x-service-id`

On `servers[]`: which `x-services[].id` that URL belongs to.

## `x-services` / `x-service` / `servers`

Document-level:

```yaml
x-services:
  - id: core
    name: Core
    kind: core
    url: http://localhost:3000/api/1.0.0
    description: Merged Core service (monolith).
servers:
  - url: http://localhost:3000/api/1.0.0
    x-service-id: core
```

Operation/schema `x-service: core` (default `core` when absent). Consumer: `RestApiClient` resolves the base URL per operation. Frontend Vite keeps `/api` for the monolith; optional `VITE_API_PROXY_TARGETS` is a JSON map `id → url` for extra prefixes `/api-<id>`.

## `x-sync`

On list operations:

```yaml
x-sync:
  cursorField: updatedAt
  includeDeletedParam: includeDeleted
```

Sync page: `sort=updatedAt:asc,id:asc`, filter `updatedAt` `gt` last cursor, `includeDeleted=true`. Ties on `updatedAt` break on the primary key (`applyListSort`).

## `x-metrics-capabilities`

On list and metrics operations: `groupable` (enum/boolean/reference), `series` (date fields). See [ENTITY-METRICS-CONTRACT.md](./ENTITY-METRICS-CONTRACT.md).

## `deletedAt` tombstones

Every entity schema carries `deletedAt` (`string | null`, `format: date-time`, read-only). `DELETE` sets the timestamp; there is no physical delete in this delivery. Lists exclude tombstones unless `includeDeleted=true`. `GET` of a tombstone is 404 without that flag.

**Uniqueness:** a tombstone **releases** unique values (`username`, organization `name`). A new live record may reuse them. Login ignores tombstones.

Purge of tombstones is out of scope.

## Verification

- `bun run oas:check-routes` — path → handler → controller (Req 036).
- `bun run oas:check-relations` — `x-relation` / `x-primary-key` ↔ `@belongsTo` / `@hasMany` / model key, both directions.
