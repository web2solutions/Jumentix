# Cache Service and Read Caching

## Purpose

Provide a contract-based cache layer that can be reused by services without coupling domain logic to a specific storage engine.

## Implementation

- Cache contract and implementation:
  - `apps/backend-template/src/infra/cache/ICacheService.ts`
  - `apps/backend-template/src/infra/cache/CacheService.ts`
- Storage adapter dependency:
  - `apps/backend-template/src/infra/persistence/KeyValueStorage/IKeyValueStorageClient.ts`

The cache uses key-value envelopes:

```ts
{
  value: any;
  expiresAt?: number;
}
```

`expiresAt` is optional and is evaluated on reads.

## Invalidation model

The implementation uses namespace versioning:

- `cache:version:users`
- `cache:version:organizations`

Read keys include the current namespace version (`vN`).  
Write operations bump namespace version, invalidating previous read keys without wildcard deletes.

## Endpoint read caching behavior

Current read-through integration:

- `UserService`
  - `getOneById`
  - `getAll`
- `OrganizationService`
  - `getOneById`
  - `getAll`

Current write-trigger invalidation:

- User aggregate mutations:
  - create/update/delete
  - updatePassword
  - create/update/delete document
  - create/update/delete phone
  - create/update/delete email
- Organization aggregate mutations:
  - create/update/delete
  - create/update/delete address
  - create/update/delete phone
  - create/update/delete email

## Composition wiring

`composeUsersAuthServices` now compiles and injects `CacheService` when `keyValueStorageClient` is available.

## Tests

- `apps/backend-template/test/unit/infra/cache/CacheService.test.ts`
- `apps/backend-template/test/unit/modules/Users/service/UserService.test.ts`
- `apps/backend-template/test/unit/modules/Users/service/OrganizationService.test.ts`

