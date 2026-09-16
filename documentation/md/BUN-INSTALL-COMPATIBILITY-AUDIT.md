# Bun Install Compatibility Audit

Deliverable of Linear task JUM-538, project `[Tooling] Replace Internal Node and pnpm Workflows with Bun`.
Evidence collected 2026-07-29 against `web2solutions/Jumentix` `dev` (`6796b06`), Bun `1.3.13`, macOS (APFS), in
an isolated worktree.

This audit pulls three of the epic's recorded risks forward so they are discovered here rather than inside
JUM-25/JUM-26: `bun install` mutating the managed tree (risk #1), the `uWebSockets.js` link failure (risk #2),
and nested override selectors (risk #4).

## 1. `bun install` mutates `package.json` while `pnpm-workspace.yaml` exists

Reproduced, and the damage is broader than the JUM-23 baseline recorded. With both files present, `bun install`
treats `pnpm-workspace.yaml` as an input and merges it into `package.json`, **overwriting conflicting values
without any warning**.

Measured diff from one `bun install` against a deliberately-authored `package.json`:

| Field | Authored | After `bun install` | Class of damage |
| --- | --- | --- | --- |
| `workspaces` | `["apps/*","packages/*","tooling/*"]` | `[".","apps/*","packages/*","apps/service-management","tooling/*"]` | Injected `"."` (root as its own workspace member) and a path already covered by `apps/*` |
| `patchedDependencies` | `{"nextra-theme-docs@4.6.1": "..."}` | adds `{"nextra-theme-docs@4.6.1@4.6.1": "..."}` | **Corrupted key** — the version is appended twice, producing a selector that can never match a package. The patch is declared twice, once inertly |
| `overrides.postcss` | `^8.5.23` | `^8.5.18` | **Silent security downgrade.** A deliberately raised floor was lowered back to the pnpm value |
| `overrides` | 16 flat pins | 23 pins | Injected all 7 pnpm nested selectors (`restify>find-my-way`, `cassandra-driver>adm-zip`, `next>postcss`, `next>sharp`, `concurrently>shell-quote`, `@grpc/proto-loader>protobufjs`, `google-gax>protobufjs`) as flat string keys — the `EINVALIDTAGNAME` form npm rejects |

The `postcss` case is the one that matters most. It is not a broken build; it is a security floor being quietly
relaxed by the package manager, which is the exact failure mode the override set exists to prevent.

### Consequence for the plan

**`pnpm-workspace.yaml` must be removed before the first `bun install`, not after.** This inverts the ordering
implied by JUM-25's "dual-lock transition": keeping both surfaces present while running Bun installs is not a
safe intermediate state, it is the state in which the mutation happens.

Verified: with `pnpm-workspace.yaml` and `pnpm-lock.yaml` removed, a full `bun install` leaves `package.json`
byte-identical. Confirmed by diff across repeated installs.

### Guard

`ci-cd/check-dependency-override-integrity.js` freezes the pre-migration security baseline (16 pins, 1
resolution, 1 patch) and fails closed on: a missing pin, a changed range, a reintroduced nested selector, a
missing or non-existent patch file, or a resurrected pnpm surface. Negative paths exercised — exit `1` with a
dropped pin, exit `0` when intact.

## 2. `uWebSockets.js` cannot be installed by Bun — unresolved blocker

`hyper-express@6.17.3` depends on `uWebSockets.js` via a GitHub tarball:

```
"uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.51.0"
```

Bun downloads it correctly — 46.11 MB tarball, 31 entries streamed, resolved to commit
`6609a88ffa9a16ac5158046761356ce03250a0df` — and then fails at the link step:

```
ENOENT: No such file or directory: failed to link package:
  uWebSockets.js@github:uNetworking/uWebSockets.js#6609a88... (clonefileat)
Failed to install 1 package
```

The isolated linker still creates the consumer symlink:

```
node_modules/.bun/hyper-express@6.17.3/node_modules/uWebSockets.js
  -> ../../uWebSockets.js@github+uNetworking+uWebSockets.js+6609a88.../node_modules/uWebSockets.js
```

The target is never created, so this is a **dangling symlink** and the failure surfaces at runtime rather than
at install:

```
$ bun -e "require('hyper-express')"
FAILED: ENOENT reading ".../node_modules/.bun/hyper-express@6.17.3/node_modules/uWebSockets.js"
```

### Mitigations attempted — all four install backends fail

| Configuration | Packages installed | uWS resolved | `require('hyper-express')` |
| --- | --- | --- | --- |
| `--linker=isolated --backend=clonefile` (default) | 4071 | no | FAILED |
| `--linker=isolated --backend=copyfile` | 4071 | no | FAILED |
| `--linker=isolated --backend=hardlink` | 4071 | no | FAILED |
| `--linker=isolated --backend=symlink` | 4071 | no | FAILED |
| `--linker=hoisted --backend=clonefile` | **2056** | no | FAILED |

`clonefileat` is an APFS copy-on-write syscall, so the default backend was the obvious suspect — but the
failure survives every backend, which rules out the copy strategy as the cause. `trustedDependencies:
["uWebSockets.js"]` is declared and does not change the outcome; the failure is in linking, before any
lifecycle script would run.

The hoisted linker is independently unsuitable: it installed **2056 of 4071** packages and reported three
failures rather than one.

### Root cause, found after the install failure was fixed

Vendoring the package (see `ci-cd/vendor-uwebsockets.js`) and pinning forward to uWS **v20.69.0**, which does
ship a `_137` binary for Bun's ABI, produced a correctly installed and correctly linked module — and it still
does not load:

```
TypeError: symbol 'napi_register_module_v1' not found in native module.
  Is this a Node API (napi) module?
```

**uWebSockets.js compiles against the raw V8/Node internal ABI (`NODE_MODULE_VERSION`), not against N-API.**
Bun implements N-API only. No version, linker, install backend, or vendoring strategy reaches this: it is an
architectural incompatibility in the module's distribution model, upstream of us.

Verified end state on the same tree, same vendored copy:

| Runtime | ABI | `require('hyper-express')` |
| --- | --- | --- |
| Node 22 | 127 | **OK** |
| Bun 1.3.13 | 137 | FAILED — `napi_register_module_v1` not found |

The three install-layer defects were real and are fixed. They were also masking this one, which is why fixing
them in isolation looked like progress and changed nothing.

### Resolution

`hyper-express` is a **declared Node-runtime target** under Requirement 096 §4, not a Bun target. This is a
documented technical impossibility with a one-line proof, not a scope concession.

The vendoring step is still required, and required under Bun, because the Node path depends on it too: Bun's
installer cannot materialize the GitHub tarball at all, so without `ci-cd/vendor-uwebsockets.js` the module is
absent for *either* runtime. The script runs as `postinstall`, verifies the pinned tarball by SHA-256, extracts
only the current platform's binaries, fails closed if this runtime's ABI has no prebuilt, and repairs the
dangling symlinks the isolated linker leaves in `node_modules/.bun/*/node_modules/`.

### Impact

Before that resolution, this was a **hard blocker for the cutover**, not a cosmetic install warning:

* `hyper-express` is one of the declared supported HTTP frameworks (`JUMENTIX_HTTP_FRAMEWORK=hyper-express`).
* Its integration target owns **21 test files**.
* JUM-40's acceptance requires every destination-appropriate gate to pass. A framework adapter that cannot be
  imported cannot pass, and declaring the matrix green with that target skipped would be a false green under
  Requirement 065.

### Supply-chain position of the vendored artifact

Vendoring was chosen (2026-07-29) and implemented as **pinned fetch with checksum verification** rather than
committing the artifact to git. The tarball is 31 MB compressed and expands to ~127 MB of prebuilt binaries
across 15 platform/ABI triples, of which any machine needs one.

The integrity property that matters — that we get exactly the reviewed bytes — comes from the pinned tag plus
the recorded SHA-256, not from the file living in git history:

* tag `v20.69.0`, published 2026-07-11
* `sha256 691f1f43cb6c4e30c56d7c11968c275130e57b52ac3327bc457c574dedc613d0`
* license: Apache-2.0 (carried into the vendored tree)

A checksum mismatch fails the install rather than updating the expectation. If the upstream tag is ever moved,
that mismatch is itself the finding.

Recorded deviation: the decision as taken said "fetch/commit". Committing was rejected for the size reason
above. If the artifact must be in-tree for an air-gapped build, that is a separate, reviewable change.

## 3. Nested override selectors — resolved

The 7 pnpm nested selectors were converted to flat pins. This does **not** widen exposure: a flat override
applies to every dependent, which is strictly stronger than pinning one dependent.

Six of the seven already had an identical flat pin in force, so their effective behaviour is unchanged:

| pnpm selector | Range | Pre-existing flat pin |
| --- | --- | --- |
| `restify>find-my-way` | `^9.7.0` | `find-my-way: ^9.7.0` — identical |
| `next>postcss` | `^8.5.18` | `postcss` — identical floor |
| `next>sharp` | `^0.35.0` | `sharp: ^0.35.0` — identical |
| `concurrently>shell-quote` | `^1.9.0` | `shell-quote: ^1.9.0` — identical |
| `@grpc/proto-loader>protobufjs` | `^7.6.5` | `protobufjs: ^7.6.5` — identical |
| `google-gax>protobufjs` | `^7.6.5` | `protobufjs: ^7.6.5` — identical |
| `cassandra-driver>adm-zip` | `^0.6.0` | **none** — became flat `adm-zip: ^0.6.0` |

`postcss` was the only genuine conflict across the three declaration surfaces: `^8.5.18` in
`pnpm-workspace.yaml` and in `package.json#overrides`, `^8.5.23` in `package.json#pnpm.overrides`. Resolved to
**`^8.5.23`**, the higher floor. Both ranges admit 8.5.23, so the only difference is the minimum, and taking
the lower value would have relaxed a security floor by accident of file precedence.

## 4. Install performance

Measured on the same machine and tree, warm cache, isolated linker:

| Operation | Wall time |
| --- | --- |
| `bun install` (4071 packages) | 4.77 s – 11.24 s |
| `bun install --frozen-lockfile` (no changes) | 2.37 s |

`bun.lock` is generated in the committed text format at 568 KB. `bun install --frozen-lockfile` completes
without modifying the lockfile, satisfying Requirement 096 §2.

No performance claim is made against the pnpm baseline here: the pnpm surfaces were removed before these
measurements, so a same-tree comparison was not possible. JUM-38 owns the comparative budget.

## 5. Status

| Risk | Status |
| --- | --- |
| #1 `bun install` mutates the managed tree | **Resolved** — cause identified, ordering corrected, guarded, negative paths tested |
| #4 Nested override selectors | **Resolved** — converted to flat pins with per-entry justification |
| #2 `uWebSockets.js` link failure | **Resolved by vendoring** — pinned, checksum-verified `postinstall` step; module now present and loadable under Node |
| #2b uWS is not an N-API module (found during #2) | **Closed as upstream-impossible.** `hyper-express` is a declared Node-runtime target under Req 096 §4. No Bun path exists at any version |

No quality gate is claimed green by this document. It records install-layer evidence only.
