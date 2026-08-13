# Bun Compatibility and Migration Baseline

Deliverable of Linear task [JUM-23] (project: `[Tooling] Replace Internal Node and pnpm Workflows with Bun`). Research evidence collected on 2026-07-26, Bun `1.3.13` (Homebrew, macOS), dedicated worktree from `origin/dev` (`63ecaef`).

## 1. Inventory (current Node/pnpm surface)

| Dimension | Count |
| --- | --- |
| `package.json` files (root + workspaces) | 22 |
| Total npm scripts | 333 |
| Scripts invoking `pnpm` / `npm` | 115 / 115 |
| Scripts invoking `node` | 81 (67 at root) |
| Scripts invoking `tsc` | 46 |
| Scripts invoking `pm2` | 40 |
| Scripts invoking `jest` | 26 |
| Scripts invoking `ts-node` | 15 |
| `ci-cd/*.js` governance scripts | 28 (plain Node, dependency-free) |
| Unit/integration test files | 199 |

Jest API census across 199 test files: `jest.fn` 592, `jest.spyOn` 54, `jest.mock` 40, `clearAllMocks` 6, `resetModules` 5, `requireActual` 2, `setTimeout` 4, fake timers 1.

## 2. `bun install` trial

- 4069 packages installed in **37.5s** (cold-ish cache).
- 1 failure: `uWebSockets.js` (GitHub tarball dependency, `clonefileat` link error) — needs `trustedDependencies`/override handling in JUM-26.
- The full jest unit suite runs **green (518/518)** on top of Bun-installed `node_modules` — strong evidence that Bun's linker layout satisfies the repo's runtime resolution.

## 3. `bun test` trial (zero adaptation)

| Runner | Tests | Result | Wall time |
| --- | --- | --- | --- |
| Jest (`pnpm run test:unit`, with coverage) | 518/518, 94 suites | green | **157.6s** |
| `bun test test/unit` (no changes) | 369 discovered, 306 pass, 63 fail, 31 load errors | partial | **1.78s (~88x)** |

Discovery gap (518 vs 369) is caused by load errors aborting whole files.

## 4. Failure taxonomy (finite, addressable)

1. **Type-only imports without `import type`** (~30 direct errors; 340 candidate import lines repo-wide, `I*` interface convention). Bun's ESM runtime cannot resolve erased TS types imported as values. Fix: mechanical codemod to `import type` (safe for jest too). Largest single blocker; unblocks most of the 31 load errors.
2. **`jest.resetModules` (13) and `jest.doMock` (2)** — no `bun:test` equivalent. Fix: refactor affected suites to explicit factory/reset patterns or `mock.module`; candidates for the Node-compat validation boundary (JUM-37) if refactor is disproportionate.
3. **cwd-dependent file reads (5 ENOENT)** — jest `rootDir` assumption; fix with `import.meta.dir`-relative resolution.
4. **Residual (4)**: mock ordering (`shouldStartFallbackRestApi`), readonly assignment, one undefined access — individual investigation.

Supported natively by `bun:test` (no action): `jest.fn`, `jest.spyOn`, lifecycle hooks, `expect` matchers used in the codebase, tsconfig path aliases (`@src`, `@test`, `@jumentix/*`).

## 5. Migration order recommendation (feeds JUM-24..31)

1. JUM-24 toolchain pin (`.bun-version`, `bunfig.toml`, bootstrap check mirroring `check-node-version`).
2. `import type` codemod (repo-wide, runner-neutral, zero risk) — do before any runner switch.
3. JUM-26: `uWebSockets.js` trusted/override handling; verify `pnpm.overrides` → `overrides` migration.
4. JUM-29 unit migration in layer order (domain → application → adapters), parity gate per layer (same discovered count, coverage delta < 0.1%, 0 flakes / 20 runs — see Test Pyramid JUM-432/434..436).
5. `jest.resetModules/doMock` refactors as scoped sub-changes inside JUM-29.
6. Coverage/reporters under Bun (JUM-31): `bun test --coverage --coverage-reporter=lcov`; validate thresholds 99/99/99/90 and Codecov single-upload (Req 014).

## 6. Risks and constraints

- `bun test` does not read `jest.config.js` (env bootstrap via `ci-cd/loadEnvironment.js` must move to `--preload` or `bunfig.toml` `[test].preload`).
- TypeScript typechecking remains mandatory (`tsc` stays; Bun transpiles without typechecking).
- GitHub-tarball dependencies need explicit trust configuration.
- **`bun install` mutates `package.json`**: it removed `pnpm.patchedDependencies` and merged pnpm-scoped overrides (e.g. `restify>find-my-way`) into npm's `overrides` field — a format npm rejects (`EINVALIDTAGNAME`), breaking any npm/npx-based tooling (including the husky gate). JUM-25/26 must handle overrides/patches migration explicitly and `bun install` must not run against the pnpm-managed tree until cutover.
- **`bun install` mutates `package.json`**: it removed `pnpm.patchedDependencies` and merged pnpm-scoped overrides (e.g. `restify>find-my-way`) into npm's `overrides` field, a format npm rejects (`EINVALIDTAGNAME`), breaking npm/npx tooling including the husky gates. It also failed to link `uWebSockets.js`, which breaks the hyper-express integration target. `bun install` must not run against the pnpm-managed tree until JUM-25/26 handle lockfile, overrides and patches migration explicitly.
- Requirements 001/012/048 mandate Node/pnpm and must be superseded (JUM-22) before any cutover.

## 7. Evidence

- Raw logs: `bun install`, `bun test` (`/tmp/bun-unit.log`), jest baseline (`/tmp/jest-unit.log`) — summarized above; timings measured on the same machine, same tree.
- No quality gate is claimed green by this document beyond the reproduced jest run; this is research evidence for M1.
