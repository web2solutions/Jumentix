# Cana — Release Readiness

Status of `@jumentix/cana` against release, and what each remaining item needs.

This is not a checklist of intentions. Every row states what was **measured**,
and every gap says who can close it. A readiness document that reports plans as
progress is worse than none, because it is the artefact a release decision is
made from.

Portuguese: [CANA-RELEASE-READINESS.pt-BR.md](./CANA-RELEASE-READINESS.pt-BR.md)

---

## 1. Summary

**Not ready to publish.** One gap is blocking, and it is not a code defect: no
cross-browser evidence exists. The engine is complete, tested and packaged; what
is missing is proof it behaves in the browsers it targets.

| Area | Status |
|---|---|
| Engine (lifecycle, CRUD, queries, transactions, events, hooks) | Complete, tested |
| Crash recovery (operation ledger) | Complete, tested |
| Worker host and protocol | Complete, tested across a real message port |
| Durability and eviction policy | Complete, tested against constructed states |
| Jumentix client-factory integration | Complete, tested |
| Packaging (dual CJS/ESM, types, licence) | Complete, tested |
| Documentation (design, usage, EN + PT-BR) | Complete |
| Differential agreement with Dexie | Complete, 18/18 agree |
| **Cross-browser conformance** | **Not run — blocking** |
| Performance under real data volume | Complexity shape measured; absolute latency not |
| CI verification of any of the above | **Never executed — billing** |

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

## 3. The blocking gap: cross-browser conformance (JUM-417)

Every automated test runs against `fake-indexeddb`. It is a faithful shim, and
the differential harness shows Cana and Dexie agree on it — but it is not a
browser. It has no real quota, no eviction, no `navigator.storage`, and no
separate thread.

So the following are **unverified in any browser**:

- real quota reporting and the `nearQuota` threshold
- actual eviction, and the tombstone surviving it
- the `Unavailable` path in private browsing
- the engine running inside a real `Worker`
- data surviving a page reload
- Safari's IndexedDB quirks specifically, which are the ones that historically
  differ most

### How to close it

The conformance suite already exists and is already verified. It is a plain
function over an injected environment, `runConformance`, exercised by the unit
suite so it cannot rot — meaning when it is pointed at a browser, the only new
variable is the browser.

```bash
cd packages/cana
bun run build
bunx serve conformance    # or any static server
```

Open the page in each browser on the matrix and press **Run conformance**. The
report prints to the page and to the console as JSON, so a driver can scrape it.

Checks a shim cannot answer report `skipped` with a reason, never `passed`, and
`describeCoverage()` refuses to summarise a partial run as clean.

### The matrix

| Browser | Minimum | Why it is on the list |
|---|---|---|
| Chrome / Edge | 110 | Largest share; the reference implementation |
| Firefox | 110 | Independent IndexedDB implementation |
| Safari (macOS) | 16.4 | Historically the most divergent |
| Safari (iOS) | 16.4 | Separate storage policy and far tighter eviction |
| Chrome Android | 110 | Eviction behaviour differs from desktop |

Safari is the one that matters most: it lacked `IDBFactory.databases()` for
years, which is exactly the case the eviction classifier was fixed for in this
epic.

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

**No CI job has ever run on this work.** Every push to PR #15 failed at the
runner in under two seconds:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

Those red marks are **pending, not failing** — no test executed, so they are not
evidence in either direction. Under Requirement 065 they must not be described
as passing, and they must not be dismissed as unrelated either.

Unblocking needs the account owner, in **Settings → Billing & plans**.

Separately, `agent-registry:check` is the only failure inside `bun run ci:gate`.
It is pre-existing on `dev` at `077030d` — verified by running it there — and
needs the JUM-568 owner to publish the local mirror upward and re-pin.
`bun run agent-registry:sync` must **not** be used: it writes remote over local
and would discard the evidence.

---

## 7. Release gate

Publishing should wait on all of these:

1. **Cross-browser conformance run**, with the report attached to the release.
   Owner: whoever has the devices. This is the blocking item.
2. **CI green**, which requires billing resolved first.
3. **`agent-registry:check`** resolved by its owner.
4. **A latency baseline in a real browser.** The complexity shape is measured;
   absolute numbers are not, and cannot be from an in-memory shim.

Items 1 and 4 are the ones that change what an application may honestly claim to
its users. Items 2 and 3 are process gates that must nonetheless be green before
a release is defensible.

### What is safe today

Using Cana **inside this monorepo**, on Chrome, with the caveats in the design
document understood. That is a materially different claim from publishing it to
npm for arbitrary consumers on arbitrary browsers, and the difference is the
subject of this document.

---

## 8. Related

- [CANA-INDEXEDDB-ADAPTER.md](./CANA-INDEXEDDB-ADAPTER.md) — design rationale and
  the full "what is NOT proven" list
- [CANA-USAGE-GUIDE.md](./CANA-USAGE-GUIDE.md) — API reference and guide
- `packages/cana/conformance/index.html` — the browser conformance runner
- `packages/cana/test/` — the suites behind every number above
