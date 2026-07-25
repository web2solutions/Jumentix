# Requirement 061 - Cache Service and Read Endpoint Caching Governance

## Context

Read endpoints for Users and Organizations can benefit from contract-based caching without coupling domain logic to a specific cache engine.

## Requirement

1. Caching must be implemented through a service contract (`ICacheService`) over `IKeyValueStorageClient`.
2. Read operations (`getOneById`, `getAll`) may use read-through caching.
3. Write/mutation operations must invalidate read cache deterministically.
4. Invalidation must not require wildcard delete support from concrete key-value adapters.

## Acceptance criteria

- `apps/backend-template/src/infra/cache/CacheService.ts` exists and is wired through module composition.
- `UserService` and `OrganizationService` read operations use cache when available.
- Mutations in `UserService` and `OrganizationService` bump cache namespace versions.
- Unit tests cover cache envelope behavior, namespace versioning, and service-level cache integration.
- Documentation exists and is linked from README:
  - `documentation/md/CACHE-SERVICE-AND-ENDPOINT-CACHING.md`

