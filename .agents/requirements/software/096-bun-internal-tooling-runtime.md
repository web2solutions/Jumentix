# 096 - Bun as the Internal Engineering Runtime and Package Manager

- Status: Active
- Nature: NFR (runtime, operations, governance)
- Source: Linear project `[Tooling] Replace Internal Node and pnpm Workflows with Bun`.

## Requirement

1. Bun `1.3.13` is the pinned internal package manager and repository command
   interface for installation, tooling, builds, tests, CI/CD, and release work.
2. Installs use committed `bun.lock` with `bun install --frozen-lockfile` in CI.
3. TypeScript typechecking and repository quality gates remain mandatory.
4. Node 22 is permitted only for explicitly declared compatibility or tool
   boundaries, including the Node compatibility check, Jest's declared runtime,
   and CI host setup. New undeclared Node or pnpm execution paths are prohibited.
5. Coverage, fail-closed, and security gates remain repository-owned and cannot
   be weakened by the runtime transition.

## Enforcement

- `.bun-version`, `package.json`, and `ci-cd/check-bun-version.js` pin Bun.
- `ci-cd/check-dependency-override-integrity.js` rejects restored pnpm surfaces.
- `documentation/md/BUN-ENGINEERING-GUIDE.md` is the active engineering guide.
- `documentation/md/HISTORICAL-TRANSITIONS.md` records retired migration evidence.

