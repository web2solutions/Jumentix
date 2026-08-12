# Requirement 134 - No Flaky Tests

## Context

Two failures on CI in one session, neither reproducible locally:

```
● express -> User createPhone suite › ... with unknown field
  Expected: "Bad Request - The property invalidFieldName ... does not exist."
  Received: undefined

● restify -> /localhost suite › localhost should return 200
  Expected: 200
  Received: 401
```

The second had a cause: the suite sent credentials for a user nothing had
created, and never waited for the server to listen. It passed on a quiet
machine and failed on a loaded one. Ten local runs never showed it.

That is the shape of every flake in this repository so far — a test that
depends on something it did not establish, and gets away with it because the
timing usually goes its way. The damage is not the red build. It is that a
re-run turns it green, and after the third re-run nobody reads the next red at
all.

The quarantined `packages/cana/test/performance.test.ts` is the other shape:
wall-clock ratios on shared CI hardware, which fail under load and, when they
pass, certify a fake rather than the real engine.

## Mandatory Rules

1. **A test establishes everything it depends on.** Users it authenticates as,
   servers it calls, connections it uses, files it reads. Nothing is inherited
   from another suite, from run order, or from a previous run.
2. **No sleep as synchronisation.** Waiting a fixed number of milliseconds for
   something to happen is a race with a comfortable margin. Wait on the event,
   the promise, or a bounded poll of the condition itself.
3. **No wall-clock assertions.** Durations, ratios and timeouts measured
   against real time fail on loaded hardware. Where timing is the subject,
   inject the clock.
4. **No dependence on run order, and none on a shared process.** A suite passes
   run alone and run last. Process-global singletons are reset by the suite
   that touches them.
5. **A re-run is not a result.** An intermittent failure is recorded as an
   issue with the run URL and the verbatim output, before any re-run. Merging
   on a green re-run without that record is forbidden.
6. **Quarantine is bounded.** A quarantined suite carries the issue that owns
   it and is either fixed or deleted; it does not sit in the tree unrun.
7. **Randomness is seeded, and the seed is printed on failure.**

## Acceptance Criteria

1. `bun run test:*` passes on ten consecutive runs of the affected suite before
   a flake is called fixed.
2. Every intermittent failure has an issue with the run URL and the output.
3. `test-map.json` quarantine entries each name an owning issue.

## Evidence and Scope

- Applies to every suite under `apps/**/test` and `packages/*/test`, and to the
  Cypress suites.
- Partly machine-verifiable: `ci-cd/check-test-integrity.js` catches the
  mechanical patterns — fixed sleeps and unmapped suites — and **runs inside
  `ci:gate` since JUM-683**, with every register empty. Rules `1` and `5` are
  judgement and are stated as attestation, in the manner of `130`.
- Complements requirements `112`, `115`, `130`, `135`.
