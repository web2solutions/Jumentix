# Project vs Software Requirements

Jumentix requirements are split into two namespaces so that contributors can quickly tell whether a rule governs *how we work* (project) or *what the product does* (software).

## Requirement namespaces

| Namespace | Location | Concerns |
|---|---|---|
| **Project / Governance** | `.agents/requirements/project/` | Process, planning, branch/PR policy, agent operations, Linear/GitHub workflow, documentation process, compliance procedure. |
| **Software / Product** | `.agents/requirements/software/` | Architecture, runtime, persistence, adapters, APIs, contracts, code behavior, test mechanics. |

## Why the split matters

- **Clarity**: a new engineer can read only the software requirements to understand the product, and only the project requirements to understand how to deliver changes.
- **Traceability**: coverage and traceability checks can report separately on product behavior vs delivery governance.
- **Evolution**: changes to delivery process do not mix with changes to product behavior in the same file tree, making diffs and reviews easier.

## How to decide where a new requirement belongs

Ask: *if this requirement were removed, would the product still build and behave the same way?*

- **Yes** — it is a **project** requirement (governs delivery, not behavior).
- **No** — it is a **software** requirement (governs product behavior).

### Examples

| Requirement | Namespace | Reason |
|---|---|---|
| `001` Node 22 runtime | `software` | Defines the runtime the product uses. |
| `015` DDD + EDA + Hexagonal architecture | `software` | Defines the product's architecture. |
| `065` Commit/push integrity | `project` | Defines how contributors must use git hooks and CI gates. |
| `081` Agent registration playbook | `project` | Defines how AI agents must register and operate. |
| `105` Hexagonal Test Pyramid | `software` | Defines how the product's test layers are organized. |
| `114`–`119` Agent operating pack | `project` | Defines agent worktree, tests, Docker, and API-first orchestration rules. |

## File naming

Files keep their stable three-digit ID prefix and slug. The namespace is encoded only by the parent directory:

```text
.agents/requirements/project/081-agent-registration-and-operating-playbook.md
.agents/requirements/software/015-architecture-nfr-ddd-eda-hexagonal.md
```

## Historical duplicate IDs

Three IDs (`055`, `060`, `079`) previously had two independently binding files each. They were resolved by renumbering the secondary files:

| Old ID | Old file | New ID | New file |
|---|---|---|---|
| `055` | `055-wave5-app-rehoming-cutover-governance.md` | `120` | `project/120-wave5-app-rehoming-cutover-governance.md` |
| `060` | `060-monorepo-root-layout-governance.md` | `121` | `project/121-monorepo-root-layout-governance.md` |
| `079` | `079-task-owned-branch-and-pr-naming-governance.md` | `122` | `project/122-task-owned-branch-and-pr-naming-governance.md` |

## Related documents

- [Requirements index (project + software)](../../.agents/README.md)
- [NFR Registry](../../.agents/NFR-REGISTRY.md)
- [Requirements traceability ledger](SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md)
- [Requirements coverage status](SPEC-REQUIREMENTS-COVERAGE-STATUS.md)
- [Portuguese version](PROJECT-VS-SOFTWARE-REQUIREMENTS.pt-BR.md)
