# Bun Engineering Guide

Canonical reference for internal engineering workflows on Bun. Deliverable of Linear task JUM-39, project
`[Tooling] Replace Internal Node and pnpm Workflows with Bun`, under Requirement `096`.

This is the epic's dedicated documentation Issue under Requirement `094`: the Project cannot be completed
until it is Done.

## 1. Toolchain

Bun is pinned exactly. One version, identical locally and in CI — a range is how "works on my machine" gets
committed.

| Source of truth | Value |
| --- | --- |
| `.bun-version` | `1.3.14` |
| `package.json#packageManager` | `bun@1.3.14` |
| `package.json#engines.bun` | `>=1.3.14` |

`ci-cd/check-bun-version.js` enforces all three and fails closed. It runs as `preinstall`, so it is
dependency-free by design: on a cold clone `node_modules` does not exist yet, and requiring `semver` there
would make the guard fail for a reason unrelated to the toolchain.

```bash
bun run check-bun-version
```

## 2. Installing

```bash
bun install                    # local, may update bun.lock
bun install --frozen-lockfile  # CI, refuses to change the lockfile
```

`bun.lock` is committed in text format. CI always installs frozen. The previous pnpm CI steps used
`--no-frozen-lockfile`, which let CI resolve versions the lockfile never recorded; that hole is closed.

If `--frozen-lockfile` fails, the manifest and lockfile genuinely disagree. Run a plain `bun install`
deliberately, review the lockfile diff, and commit it — do not reach for a flag that hides the drift.

### Dependency pins are security controls

Every entry in `package.json#overrides` exists because a CVE or an incompatibility demanded it. Losing one is
a **silent security regression**: nothing breaks, the vulnerable transitive version simply resolves again.

`ci-cd/check-dependency-override-integrity.js` freezes the baseline — 16 pins, 1 resolution, 1 patch — and
fails closed on a dropped pin, a changed range, a reintroduced pnpm nested selector, a missing patch file, or
a resurrected pnpm surface.

```bash
bun run deps:check-overrides
```

**Nested selectors do not exist in Bun.** pnpm's `"restify>find-my-way"` form is an invalid package name for
both npm and Bun, so the pin is silently inert. All seven nested selectors were converted to flat pins, which
is strictly stronger: a flat override applies to every dependent rather than one.

> **Do not run `bun install` with `pnpm-workspace.yaml` present.** Bun treats it as an input and overwrites
> conflicting `package.json` values — measured: it injected `.` into `workspaces`, produced the corrupted
> patch key `nextra-theme-docs@4.6.1@4.6.1`, injected all seven nested selectors, and **silently downgraded
> `overrides.postcss` from a deliberate `^8.5.23` back to `^8.5.18`**. The pnpm surfaces are removed; if one
> ever reappears, the override guard fails.

## 3. Running commands

| Purpose | Command |
| --- | --- |
| Repository script | `bun run <script>` |
| Package binary | `bunx <binary>` |
| All workspaces | `bun run --filter '*' <script>` |
| One workspace | `bun run --filter @jumentix/website <script>` |

`bun run --filter` replaces `pnpm -r --if-present`. Note the argument order differs from pnpm, and the
behaviour is **better**: it exits 1 when no package matches the filter, where `--if-present` exited 0. That
former silence was a false green.

## 4. `[run] bun = false` — read this before changing it

`bunfig.toml` sets `[run] bun = false`, deliberately. Setting it to `true` reroutes *every* Node-shebang
binary in `node_modules` onto Bun, including third-party ones. Jest is not Bun-compatible: `jest-runtime`
assigns to a property Bun treats as readonly.

Measured on this tree:

| `[run] bun` | Result |
| --- | --- |
| `true` | 97 suites failed, **0 tests ran** |
| `false` | 97 suites passed, **547 tests passed** |

The failure mode is what makes this dangerous rather than merely wrong: every suite dies at load with
`TypeError: Attempted to assign to readonly property`, which reads like a repository bug and not like a
runtime setting.

This flag can be flipped once the unit suites move from Jest to `bun:test` — delivered by the Hexagonal Test
Pyramid project (JUM-434–436), not by this epic.

## 5. Testing

```bash
bun run test:unit          # canonical unit gate — Jest on Node, 547 tests
bun run test:integration   # integration targets
bun run ci:gate            # the full branch gate
```

### Declared runtime boundaries (Requirement 096 §4)

Node survives only as an **explicit, declared** target. There are exactly two:

1. **Jest** runs on Node until the `bun:test` migration lands (see §4).
2. **`compat:check-node-version`** validates the consumer-facing Node contract and must run on real Node.

Anything else invoking Node inside internal tooling is a defect.

### Where `bun test` stands today

`bun test` is not yet the gate runner, but it is measured, because the gap is the migration's remaining work:

| | Baseline | After the `import type` codemod |
| --- | --- | --- |
| pass | 344 | **471** |
| load errors | 30 | **3** |
| tests discovered | 399 | **531** |
| wall time | 0.79 s | 1.72 s |

Jest takes roughly 28 s for the same suites.

The remaining failures are `bun:test` API gaps — `jest.resetModules` (13), `jest.doMock` (2),
`jest.requireActual` (2), plus mock-ordering differences. They belong to JUM-434–436.

### Type-only imports are a runtime concern under Bun

Bun's ESM runtime resolves named bindings at runtime, so a TypeScript type imported *or re-exported* as a
value has no runtime export and Bun rejects the whole module:

```
SyntaxError: export 'IMessageResponse' not found in './contracts'
```

Use `import type` and `export type`. Both sides matter: a consumer's `import type` cannot help if the barrel
it reads uses a value `export {}`.

Classify by **declaration**, not by name prefix. The repository has counterexamples in both directions:
`MessageHandler` is a `type` with no `I` prefix, and `ESqlDialect` is a `type` despite the `E` prefix.

## 6. Fail-closed verification

```bash
bun run ci:fail-closed
```

A gate that has never been observed failing is not a gate. `ci-cd/check-fail-closed.js` injects a deliberate
fault per gate class, asserts a non-zero exit, and restores the tree. It covers eight classes: toolchain pin
mismatch, dropped security pin, reintroduced nested selector, manifest/lockfile drift, type error, lint
violation, failing unit test, and a filtered workspace run with no matching script.

The harness is itself fail-closed: if a fixture cannot be restored it exits `2` rather than leaving the tree
corrupt.

## 7. Patches

```bash
bun patch <pkg>@<version>          # prepare a writable copy
# edit node_modules/<pkg>
bun patch --commit node_modules/<pkg>
```

Patches are recorded in `package.json#patchedDependencies` and the guard verifies the file exists on disk.

**Patches are content-level, not graph-level.** They cannot remove a dependency: Bun resolves the graph from
the lockfile, which reads the original manifest. Attempting to drop a transitive dependency by patching its
parent's `package.json` has no effect on resolution — verified.

## 8. CI

| System | Setup |
| --- | --- |
| GitHub Actions | `oven-sh/setup-bun` pinned by commit SHA; matrix axis `bun-version` |
| CircleCI | `oven/bun:1.3.14`; caches keyed on `bun.lock` |

Both install with `--frozen-lockfile` and assert the toolchain guard before anything else.

The private agent registry (`XpertMinds/jumentix-agent-registry`) needs a `contents:read` token.
GitHub Actions inject `GH_TOKEN: secrets.AGENT_REGISTRY_TOKEN`; CircleCI exports the same with a
`GH_TOKEN` / `GITHUB_TOKEN` / `AGENT_REGISTRY_TOKEN` precedence chain. Locally, `gh auth login` is enough —
the check falls back to `gh auth token`.

## 9. Development runtime (PM2)

PM2 runs applications under the Bun interpreter:

```
pm2 start <entry> --interpreter bun --interpreter-args='--env-file=...'
```

`-r` is a documented alias of `--preload` in Bun, and `--env-file` is supported, so the previous Node
interpreter args carry over. The `ts-node` preload chain is gone — Bun executes TypeScript directly.

Verified lifecycle: `exec_interpreter bun`, `online`, 0 restarts after 66 s, HTTP 200.

`-r tsconfig-paths/register` is now redundant, because Bun resolves tsconfig `paths` natively. It is harmless
and left in place.

## 10. Rollback

The migration is reversible at the commit level; there is no data migration and no published artifact
involved. To roll back, revert the epic's commits and restore `pnpm-lock.yaml` and `pnpm-workspace.yaml` from
history.

Two things must be restored together or not at all: the lockfile **and** the override surface. Reverting one
without the other reintroduces exactly the three-way disagreement (`postcss` at `^8.5.18` in two places and
`^8.5.23` in a third) that this migration collapsed into one source of truth.

## 11. Known gaps

| Gap | Owner |
| --- | --- |
| Unit suites still on Jest; `[run] bun` cannot be `true` yet | Test Pyramid JUM-434–436 |
| 60 `bun test` failures from `bun:test` API gaps | Test Pyramid JUM-434–436 |
| Branch coverage is not enforced by `bun test` (it has no branch metric) | JUM-437 / this guide §5 |
| 4 workspace `test` scripts are `echo` placeholders; 15 more alias `typecheck` | Test Pyramid JUM-557 |

The last row is a live false green: `mono:test` reports success while almost no workspace runs a test.

## References

- Requirement `096` — Bun as the internal engineering runtime and package manager
- `documentation/md/BUN-MIGRATION-BASELINE.md` — JUM-23 baseline evidence
- `documentation/md/BUN-INSTALL-COMPATIBILITY-AUDIT.md` — JUM-538 install-layer audit
