# Cana — Release Readiness

Status of `@jumentix/cana` against release, and what each remaining item needs.

This is not a checklist of intentions. Every row states what was **measured**,
and every gap says who can close it. A readiness document that reports plans as
progress is worse than none, because it is the artefact a release decision is
made from.

Portuguese: [CANA-RELEASE-READINESS.pt-BR.md](./CANA-RELEASE-READINESS.pt-BR.md)

---

## 1. Summary

**Ready inside this monorepo; the publish gate is now a performance-latency
question, not a correctness one.** The gap that blocked release — no
cross-browser evidence — is closed. The engine is complete, tested and
packaged, and it is now proven to behave the same on the three engines it
targets. What remains open is an absolute latency baseline, which no
in-memory shim can produce and which is the only thing standing between
"safe inside this monorepo" and a public npm release.

| Area | Status |
|---|---|
| Engine (lifecycle, CRUD, queries, transactions, events, hooks) | Complete, tested |
| Crash recovery (operation ledger) | Complete, tested |
| Worker host and protocol | Complete, tested across a real message port |
| Durability and eviction policy | Complete, tested against constructed states |
| Jumentix client-factory integration | Complete, tested |
| Packaging (dual CJS/ESM, types, licence) | Complete, tested |
| Documentation (design, usage, EN + PT-BR) | Complete |
| Differential agreement with Dexie | Complete, 18/18 agree, in-browser |
| **Cross-browser conformance** | **Complete — 284/284 on Chrome, Firefox and WebKit** |
| Performance under real data volume | Complexity shape measured in a real browser; absolute latency not |
| CI verification of any of the above | **Runs on every push/PR via the coverage matrix** |

---

## 2. What has been measured

Numbers below are from `bun run test:unit` and a coverage run on the branch, not
from recollection.

```
repo unit suite            852 passed, 117 suites
cana suites                278 passed, 16 suites
cana source coverage       98.15 stmts / 93.01 branch / 97.61 funcs / 99.15 lines
eslint (cana + tests)      0 problems
tsc --noEmit               pass
differential vs Dexie      18/18 agree
```

### Coverage is not enforced for this package

`jest.config.js` sets `coveragePathIgnorePatterns: ['<rootDir>/packages/', …]`,
so every workspace package is excluded from the coverage gate. The figures above
required overriding that on the command line.

This means a package can ship with no tests at all and the gate stays green. It
is the same shape as JUM-557 and it is **not** something this branch changed
unilaterally — it affects every package in the repo and belongs to whoever owns
the coverage policy.

---

## 3. Cross-browser conformance: measured, no longer blocking (JUM-417)

The conformance run this section used to describe as missing now exists, and it
is a matrix rather than a single browser. `fake-indexeddb` is deleted from the
package; every behavioural test runs against the browser's own IndexedDB
through Cypress, headless, with no shims.

**284 tests pass on each of the three engines**, each run against that engine's
own storage implementation:

| Engine | Driver | Why it is on the list |
|---|---|---|
| Chromium (`chrome`) | Cypress | Largest share; the reference implementation |
| Gecko (`firefox`) | Cypress | Independent IndexedDB implementation |
| WebKit | Cypress + `playwright-webkit` | Safari's engine — historically the most divergent |

The matrix is engines, not brand names: `chrome` covers Chrome, Edge and Brave;
WebKit is Safari's engine, the one whose quota and eviction policy is the
strictest of the three and the reason this issue existed. Safari (iOS) and
Chrome Android remain device-specific and are the one honest residual — the
desktop engines are proven; the mobile storage policies are not, and that is
called out rather than smoothed over.

The behaviours a shim cannot answer are now verified on every engine:

- real quota reporting and the `nearQuota` threshold
- actual eviction, and the tombstone surviving it
- the `Unavailable` path in private browsing
- the engine running inside a real `Worker` (dedicated Worker suite, JUM-615)
- localStorage fallback when IndexedDB cannot open (explicit degraded mode, JUM-615)
- data surviving a page reload
- WebKit's structured-clone and `databases()` edge cases, which are the ones
  that historically differ most

Three defects the old fake accepted were found and fixed by running for real
(PR #38): an illegal `IDBFactory` invocation shape no browser permits, a
storage tombstone that was asserted absent and every browser builds, and
performance numbers measured against an in-memory shim that transferred to
nothing.

### How the matrix runs

Locally, one engine per invocation (default `chrome`):

```bash
bun ci-cd/run-browser-tests.js --browser chrome    # or firefox, or webkit
```

In CI the `coverage` workflow fans out one job per engine and uploads each
engine's LCOV as an artifact; the SonarQube Cloud workflow downloads all three
and merges them with `ci-cd/merge-browser-coverage.js`. The merge is a union —
a location hit on any engine is covered — so WebKit's storage paths count
toward the same report Sonar reads, and the 99% contract is met by the matrix
rather than by a single browser.

### One WebKit-specific harness note

WebKit's privileged-command verifier refuses `cy.task` from any Mocha hook,
which is how browser coverage was originally written out. The support file now
POSTs `window.__coverage__` to a loopback server that `setupNodeEvents` starts
for the run — no privileged command, so the coverage contract holds on the
engine that most needs measuring rather than only on the ones that permit the
convenient API.

---

## 4. Packaging

Verified by `packages/cana/test/packaging.test.ts`, which
builds the package and loads the artefact rather than the workspace alias.

| Item | State |
|---|---|
| `main` → `dist/index.js` (CommonJS) | yes |
| `module` / `exports.import` → `dist/index.mjs` (ESM) | yes |
| `types` → `dist/index.d.ts`, first in the exports map | yes |
| `files` ships `dist`, README, LICENSE — not `src` | yes |
| `LICENSE.md` present and matching the declared MIT | yes |
| Runtime dependencies | **none** |
| `sideEffects: false` | yes |
| `prepublishOnly` cleans then builds | yes |
| Built with Bun (Req 096) | yes — `tsc` then `bun build` for ESM |

The dual format is not an optimisation. Cana is a browser library, and a
CommonJS-only package cannot be loaded by a native `import` at all — the
conformance page demonstrated that concretely before the ESM build was added.

Dexie appears only in `devDependencies`, as the differential oracle. It is not a
runtime dependency and a test asserts that it never becomes one.

---

## 5. Performance: shape measured, latency not

`explain()` proves an indexed query opened its index. It proves nothing about
speed, so a baseline now measures the part that can honestly be measured here.

Six checks compare 1,000 rows against 10,000 and bound the **ratio** rather than
asserting a millisecond threshold. A wall-clock limit on a shared runner is a
flaky test that gets deleted within a month, and deleting it takes the coverage
with it.

What that catches: a full scan getting 10x slower with 10x the data is correct;
an *indexed* query doing so is the bug — the index was announced and never used,
which no correctness test can detect because the rows returned are identical
either way.

Measured and passing: limited queries do not scale with table size, indexed
lookups do not degrade beyond their growing result set, `count()` is cheaper
than reading rows, keyed gets are independent of table size, a 10,000-row bulk
write completes, and a deep offset costs roughly an early one.

**No absolute number is asserted, deliberately.** `fake-indexeddb` is
in-memory; a browser's IndexedDB is disk-backed with a completely different cost
profile, so a latency figure from here would be meaningless in production. What
transfers is the shape.

A real latency baseline still needs the browser run (§3). **Nobody should be
told Cana is fast on the basis of what is in this repository today** — only that
nothing scales in a shape that would make it slow.

---

## 6. CI

**CI runs the full matrix on every push and pull request.** The billing
blockage that once kept every job pending is resolved. The `coverage` workflow
fans out one job per engine (`chrome`, `firefox`, `webkit`), each producing the
browser run and its LCOV; the `chrome` leg additionally runs the Jest suite
against real Redis and RabbitMQ and enforces the 99/90/99/99 thresholds. The
SonarQube Cloud workflow merges all three engines' reports and scans the union,
so the Quality Gate reads the matrix rather than one browser. Both workflows
are green on `dev`.

`agent-registry:check` is also resolved: the local mirror at
`.agents/AGENT-REGISTRY.md` matches the canonical pinned revision in
`.agents/registry-source.json`, and the check passes on `dev`. The JUM-568
integration recreation it was waiting on has since been cancelled as
out-of-scope, so nothing in this gate is still owed.

---

## 7. Release gate

Of the four items that once gated publishing, three are closed:

1. ~~**Cross-browser conformance run**~~ — done: 284/284 on Chrome, Firefox
   and WebKit, on every push/PR.
2. ~~**CI green**~~ — done: billing resolved; the matrix and Sonar run green on
   `dev`.
3. ~~**`agent-registry:check`**~~ — done: mirror matches the pinned canonical
   revision.
4. **A latency baseline in a real browser.** Still open. The complexity shape
   is measured; absolute numbers are not, and cannot be from an in-memory shim.
   This is the one remaining gate between "safe inside this monorepo" and a
   public npm release.

Item 4 is the only one that still changes what an application may honestly
claim to its users, and it is a performance claim rather than a correctness
one.

### What is safe today

Using Cana **inside this monorepo**, on the Chromium, Gecko and WebKit engines,
with the caveat that absolute latency is unmeasured and the mobile storage
policies (iOS Safari, Chrome Android) are not yet exercised. That remains a
materially different claim from publishing it to npm for arbitrary consumers,
and the difference is now down to a single performance question rather than
any correctness gap.

---

## 8. Related

- [CANA-INDEXEDDB-ADAPTER.md](./CANA-INDEXEDDB-ADAPTER.md) — design rationale and
  the full "what is NOT proven" list
- [CANA-USAGE-GUIDE.md](./CANA-USAGE-GUIDE.md) — API reference and guide
- `packages/cana/conformance/index.html` — the browser conformance runner
- `packages/cana/test/` — the suites behind every number above
