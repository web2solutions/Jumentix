# Users Domain Value Objects

## Scope
Value objects used by the Users domain:
- `EmailValueObject`
- `DocumentValueObject`
- `PhoneValueObject`
- `AddressValueObject` (used by `Organization`)

## Source of truth
- `apps/backend-template/src/modules/ddd/valueObjects/EmailValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/DocumentValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/PhoneValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/AddressValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EEmailType.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EDocumentType.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EAddressType.ts`

---

## `DocumentValueObject`

### Intent
Represents a user document payload with normalized, immutable attributes and constructor-level invariants.

### Constructor payload
`IDocumentValueObjectPayload`:

| Field | Type | Required | Normalization | Validation |
|---|---|---|---|---|
| `id` | `string` | No | UUID parse if provided, generated if absent | UUID parse/generation |
| `type` | `EDocumentType \| string` | Yes | trimmed; supports enum values and `'PASSPORT'` alias | must be one of `CPF`, `RG`, `SSN`, `passport` |
| `countryIssue` | `string` | Yes | trimmed + uppercased | must not be empty |
| `data` | `string` | Yes | trimmed | must not be empty |

### Behavioral semantics
- Immutable attributes (`readonly`).
- Constructor-level normalization + invariant validation centralize value-object consistency.

### DDD note
This project keeps a technical `id` for document list update/delete operations. Business value still relies on normalized `type/countryIssue/data`.

---

## `EmailValueObject`

| Field | Type | Required | Normalization | Validation |
|---|---|---|---|---|
| `id` | `string` | No | UUID parse/generate | UUID parse/generation |
| `email` | `string` | Yes | none | `canNotBeEmpty('email')` |
| `type` | `EEmailType` | Yes | none | `canNotBeEmpty('type')` |
| `isPrimary` | `boolean` | No | coercion with `!!isPrimary` | defaults to `false` |

---

## `PhoneValueObject`

| Field | Type | Required | Normalization | Validation |
|---|---|---|---|---|
| `id` | `string` | No | UUID parse/generate | UUID parse/generation |
| `countryCode` | `string` | Yes | none | `canNotBeEmpty('countryCode')` |
| `localCode` | `string` | Yes | none | `canNotBeEmpty('localCode')` |
| `number` | `string` | Yes | none | `canNotBeEmpty('number')` |
| `isPrimary` | `boolean` | No | coercion with `!!isPrimary` | defaults to `false` |

---

## `AddressValueObject`

| Field | Type | Required | Normalization | Validation |
|---|---|---|---|---|
| `id` | `string` | No | UUID parse/generate | UUID parse/generation |
| `email` | `string` | Yes | none | `canNotBeEmpty('email')` |
| `type` | `EAddressType` | Yes | none | must be one of `work`, `home`, `vacation` |
| `isPrimary` | `boolean` | No | coercion with `!!isPrimary` | defaults to `false` |

## OpenAPI alignment notes
- OpenAPI models `countryCode` and `localCode` as strings, matching the domain value object.
- OpenAPI accepts the domain document types `CPF`, `RG`, `SSN`, and `passport`.
- OpenAPI accepts `countryIssue` as a non-empty string; the domain normalizes it to uppercase.
- `AddressValueObject.email` field name is preserved by project requirement and currently carries address payload string semantics.
