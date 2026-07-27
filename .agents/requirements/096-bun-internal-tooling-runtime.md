# 096 - Bun as the Internal Engineering Runtime and Package Manager

- Status: Active (phased adoption)
- Nature: NFR (runtime/operations, governance)
- Source: Linear project `[Tooling] Replace Internal Node and pnpm Workflows with Bun` (slug `5c38372a8e45`), task JUM-22. Accountable agent: `claude-fable-001`.

## Requirement

1. A pinned Bun toolchain becomes the sole runtime, package manager, script runner and test platform for **internal engineering workflows** (tooling, tests, builds, development orchestration, CI/CD and release automation).
2. Installs use Bun workspaces with a frozen, text-format `bun.lock`. pnpm `overrides`, `resolutions` and `patchedDependencies` must be migrated explicitly; `bun install` must not run against the pnpm-managed tree before that migration lands (see evidence: it mutates `package.json` and fails to link `uWebSockets.js`).
3. TypeScript typechecking remains mandatory through `tsc` (Bun transpiles without typechecking).
4. Node.js may remain **only** as an explicit, declared, consumer-facing compatibility target for published Jumentix artifacts, independently validated; Node must not be an undeclared internal execution dependency.
5. Quality gates, coverage thresholds (99/99/99/90) and fail-closed/false-green protections must be preserved or strengthened under Bun; intentional-failure evidence is required at cutover.

## Phased supersession

- Requirements `001` (Node 22 runtime), `012` (CircleCI npm/Node compatibility) and `048` (pnpm monorepo productization) **remain authoritative for internal tooling until the cutover task (JUM-40, milestone M5) completes** with full evidence.
- At cutover, their internal-tooling scope is superseded by this requirement. The consumer-facing Node compatibility contracts embedded in `001` survive as explicit compatibility declarations (JUM-37).
- Any interim change may not introduce new hard Node/pnpm dependencies in internal tooling without recording a rationale in this requirement's Linear project.

## Enforcement

- Pinned Bun version + bootstrap check mirroring `ci-cd/check-node-version.js` (JUM-24).
- Frozen `bun.lock` verified in CI; gates executed through Bun from milestone M3 onward.
- False-green resistance, rollback and performance evidence at cutover (JUM-38).

## Evidence and references

- Baseline research: `documentation/md/BUN-MIGRATION-BASELINE.md` (JUM-23): jest 518/518 in 157.6s vs bun:test 306/369 in 1.78s (~88x) with a finite failure taxonomy; `bun install` risks documented.
- Delivery governance: one task = one worktree = one branch = one PR targeting `dev`; full real test matrix on commit, push and PR.
