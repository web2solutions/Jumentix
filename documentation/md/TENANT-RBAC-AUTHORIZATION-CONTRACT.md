# Tenant and RBAC Authorization Contract

## Scope

This decision table is a derived reference for Users-domain tenant access. The canonical
sources are `User.ts`, `Organization.ts`, `Rbac.ts`, and
`TenantAuthorizationPolicy.ts`. OpenAPI and this document must follow those domain files.
Permission scopes are checked first by `Authorize`; the tenant policy then constrains an
otherwise permitted operation.

## Principal classes

| Principal | Organization rule | Data boundary |
|---|---|---|
| `superadmin` | Optional | Global |
| `admin` | Required | Own organization |
| `user` | Required | Own user record and own organization |
| Legacy direct-scope principal | Not a normalized tenant role | Global backward-compatible boundary, constrained by explicit scopes |
| Guest or missing identity | Not applicable | No protected access |

Legacy direct scopes remain supported with the global behavior defined by `Rbac.ts`.
They do not acquire normalized `admin` or `user` tenant semantics implicitly.

## Operation decision table

| Operation | `superadmin` | `admin` | `user` | Legacy direct scopes |
|---|---|---|---|---|
| Create organization | Allow | Allow through `create_organization` | Deny by role scopes | Allow when explicit `create_organization` scope exists |
| List/read organization | Any organization | Own organization | Own organization when scope permits | Any organization when explicit scope permits |
| Mutate/delete organization | Any organization | Own organization when scope permits | Deny by role scopes | Any organization when explicit scope permits |
| Create user | Any organization or unbound | Own organization; missing organization is auto-bound | Deny by role scopes | Any organization or unbound when explicit scope permits |
| List users | All users | Users in own organization | Own user only | All users when explicit scope permits |
| Read/mutate one user | Any user | User in own organization when scope permits | Own user only when scope permits | Any user when explicit scope permits |

## Denial rules

1. A normalized `admin` or `user` operation without an organization fails with
   `organization scope is required`.
2. A target outside the principal's organization fails with
   `cross organization access is forbidden`.
3. A normalized `user` targeting another user fails with
   `user scope is restricted to the authenticated user`.
4. Scope/role failures remain owned by `Authorize` and retain the existing
   `user must have the <scope> role` message.

## Enforcement and evidence

- Domain files are the source of truth; OpenAPI, adapters, fixtures, and documentation
  are downstream representations.
- Pure tenant decisions belong to `modules/Users/domain/security`.
- Controllers apply decisions after authentication and before use-case execution.
- HTTP adapters share the same controllers and must return equivalent results.
- Positive and negative tests must cover global, same-tenant, cross-tenant, self, and
  missing-organization cases.

Related requirements: `029`, `031`, `044`, `071`, `072`, and `076`.
