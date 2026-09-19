# `ci-cd/` — monorepo gates and runners

Root of repository-owned CI/CD tooling (Requirement 137).

## Layout

| Path | Owns |
| --- | --- |
| `ci-cd/*.js` | Monorepo gates, runners, test-map, release and governance checks |
| `ci-cd/lib/` | Shared helpers for those gates |
| `ci-cd/test/` | Proof suites for the scripts above |
| `ci-cd/ownership-placement-allowlist.json` | Shrink-only debt register for Req 137 (steady state: `[]`) |

Component-specific scripts do **not** live here. They belong under
`apps/<A>/scripts/`, `packages/<P>/scripts/`, or `bin/`. Root `package.json`
keeps every public script name and delegates to the owning path.

## Ownership placement gate

```bash
bun run arch:check-ownership-placement
```

Runs `ci-cd/check-workspace-ownership-placement.js`. See
[TESTING-CI-AND-QUALITY.md](../documentation/md/TESTING-CI-AND-QUALITY.md)
and Requirement
[137](../.agents/requirements/software/137-workspace-suite-and-tooling-ownership.md).
