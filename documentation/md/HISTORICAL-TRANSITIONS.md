# Historical Transitions

This is the sole in-repository audit summary for material retired from active
Jumentix guidance. It records why a source was retired and where current
instructions live. It is not an operational runbook, planning source, or
delivery checklist.

| Retired topic | Former material | Current authority | Transition evidence |
| --- | --- | --- | --- |
| Internal Node/pnpm workflow | Requirements `001`, `012`, `048`; Bun baseline research | Requirement `096`, `bun.lock`, `.bun-version`, package scripts | Bun `1.3.13` is pinned; `bun.lock` is committed; pnpm lockfiles are absent. Node 22 remains only for declared compatibility and tool boundaries. |
| GitHub Project and local TODO tracking | Requirements `056`, `064`; `.agents/project-todos.md` | Requirement `095` and Linear | Linear owns planning, delivery status, estimation, and PR traceability. |
| Hosted CI bridge | Requirements `014`, `107` | Requirement `113`, `.github/workflows/ci.yml`, `.circleci/config.yml` | GitHub Actions is canonical; CircleCI is the secondary public mirror; repository-owned coverage gates remain authoritative. |
| Repository migration and Wave 5 cutover | Requirement `103`, `123`; migration plans, inventories, and Wave 5 snapshots | Requirement `124`, current `apps/*` and `packages/*` layout, `documentation/md/CANONICAL-REPOSITORY-MIGRATION.md` | `web2solutions/Jumentix` is canonical and the monorepo layout is implemented. Legacy repository links are historical evidence only. |

The removed files remain recoverable from Git history. Generated changelog
entries and `.agents/AGENT-REGISTRY.md` remain separate immutable audit
artifacts and are intentionally outside this consolidation.
