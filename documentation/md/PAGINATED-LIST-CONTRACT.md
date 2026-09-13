# Paginated List Contract (`page`, `size`, `filter`, `sort`, `q`)

Linear: [JUM-777](https://linear.app/jumentix/issue/JUM-777) · Epic `[EPIC][Frontend] Frontend seed and X-CRUD kit hardening` · Requirements `036`, `115`, `118`, `126` (error style), `136`.

A versão em português está em [PAGINATED-LIST-CONTRACT.pt-BR.md](./PAGINATED-LIST-CONTRACT.pt-BR.md).

## Why

`GET /users` and `GET /organizations` used to declare one `page` parameter (`in: path`, a string that
never validated) and answer a bare array. The backend already paged and filtered internally; the
contract did not say so, so every consumer loaded the whole collection and sorted, searched and
paged in memory. The X-CRUD kit targets generated domains (payments, stock, CRM) where that does
not scale. JUM-777 makes the list behaviour part of the OpenAPI document.

## Request

| Parameter | In | Type | Meaning |
| --- | --- | --- | --- |
| `page` | query | integer ≥ 1, default 1 | 1-based page number |
| `size` | query | integer 1…`maxSize`, default `defaultSize` | page size |
| `filter` | query | string | base64 of a JSON object keyed by a **filterable** field |
| `sort` | query | string | comma-separated `field:asc\|desc` pairs over **sortable** fields |
| `q` | query | string (≤ 200) | case-insensitive free text over the **searchable** fields |

`filter` values: a scalar means equality (`{ "roles": "admin" }` matches an array field that
contains the value); an object applies an operator:

```json
{ "firstName": { "operator": "contains", "value": "an" },
  "createdAt": { "operator": "between", "value": ["2026-01-01", "2026-01-31T23:59:59.999Z"] } }
```

Accepted operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `ilike`, `like`,
`between`, `exists`. ISO-8601 strings compare as instants; numbers numerically; text
case-insensitively (`contains`).

Query strings are coerced before validation: `page=2` satisfies `type: integer`, `page=two` is a
400 (`ci-cd`-free change in `validateRequestParams`).

## `x-list-capabilities`

Each list operation declares what a client may do — the frontend renders affordances from it and
the server rejects anything outside it:

```yaml
x-list-capabilities:
  sortable: [firstName, lastName, username, organization, createdAt, updatedAt]
  filterable: { firstName: text, lastName: text, username: text, organization: uuid,
                roles: enum, createdAt: date, updatedAt: date }
  searchable: [firstName, lastName, username]
  defaultSize: 30
  maxSize: 100
```

An operation **without** the extension keeps the legacy behaviour (paging + base64 filter, no
validation, no `sort`/`q`); clients treat it as "load everything".

## Response

`UserArrayOf` / `OrganizationArrayOf` are the page envelope:

```json
{ "result": [ …User ], "page": 1, "size": 30, "total": 6 }
```

`total` counts every record matching `filter` and `q`, across pages.

## Errors (400, `GENERIC.INVALID_INPUT`)

Every rejection names the accepted values, in the style Requirement `126` uses for enums:

- `The sort field "password" is not sortable. Accepted: firstName, lastName, username, organization, createdAt, updatedAt.`
- `The filter field "password" is not filterable. Accepted: firstName, roles, createdAt.`
- `The filter operator "regex" on "firstName" is not accepted. Accepted: …`
- `The parameter size must be between 1 and 100; received 101.`
- `page number must be smaller than the number of total pages` — a page past the last one is a
  malformed request, not an empty page (a client paging on a stale `total` after a delete steps back
  one page).
- `The parameter q is not supported by this operation: it declares no x-list-capabilities.searchable.`

## Implementation

- `packages/persistence-contracts/src/listQuery.ts` — one implementation of filters, search, sort
  and paging (`runListQuery`), shared by `InMemoryRelationalStore` and `ExternalStoreProxy`
  (every SQL/NoSQL driver), so no driver drifts from the document. `IPagingRequest` carries
  `sort`, `q` and `searchFields`.
- `apps/backend-template/src/modules/port/setListQuery.ts` — parses and validates the query
  against `x-list-capabilities` of `event.schemaOAS`; used by `UserController.getAll` and
  `OrganizationController.getAll`.
- `apps/backend-template/src/interface/HTTP/validators/validateRequestParams.ts` — query-string
  coercion for `integer`/`number`/`boolean` schemas.

## Evidence

- `bun test packages/persistence-contracts/test` — `listQuery.test.ts` pins operators, search,
  sort (nulls last, ISO instants), paging bounds.
- `bun test apps/backend-template/test/unit/modules/port/setListQuery.test.ts` — accepted-list
  errors, defaults, legacy operations.
- `bun test apps/backend-template/test/integration/Express/Users/getAll.test.ts` — real Express
  server: paging + total, sort both directions, `roles=admin`, `contains`, `q`, the 400s.
- `bun run oas:check-routes` — Requirement `036` still holds for the envelope schemas.
