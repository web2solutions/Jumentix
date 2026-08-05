# Component Ownership Registry

This registry records the accountable owner for repository components whose public
contracts are pinned by software requirements. It was established by Requirement
`125` (Linear `JUM-465`) after the Wave 5 re-homing showed that an unowned component
drifts silently: `apps/service-management` served default env values for months
because nobody owned the contract that a re-homing broke.

## Convention

- One entry per owned component: the component path, the owning agent identifier
  (as registered in the canonical Firestore agent registry, Requirement `089`), the
  requirement pinning its public contracts, and the registration date.
- Ownership means: changes to the component's public contracts update the pinning
  requirement in the same PR, and the owner is the first reviewer of drift.
- Registering ownership here does not grant exclusive edit rights; it assigns
  accountability for contract integrity.

## Entries

| Component | Owner agent | Contract requirement | Registered |
|---|---|---|---|
| `apps/service-management` | `kimi-code-primary-001` | `125` | 2026-08-05 |
