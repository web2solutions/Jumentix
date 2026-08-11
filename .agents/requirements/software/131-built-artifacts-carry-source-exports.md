# Requirement 131 - Built Artifacts Must Carry Their Source Exports

## Context

`packages/agent-registry/dist/index.js` shipped without `createRtdbClient` while
`src/index.ts` exported it. Nothing failed at load time — a stale build
`require()`s perfectly well and is simply missing the newer names — so the defect
surfaced only when a caller reached for one:

```
registry.createRtdbClient is not a function
```

By then the agent bus made mandatory by Requirement `129` had been unusable for
every agent, and the consuming CLI's own auto-build fallback had not helped: it
ran only when `require()` threw, covering "never built" and not "built from
older source", which is the case that actually occurs.

A stale build is invisible by construction. It is a valid module that answers
every question except the newest one.

## Mandatory Rules

1. Every workspace package publishing a built entrypoint (`main` under `dist/`)
   must have a built file containing every runtime value its source barrel
   exports.
2. `bun run packages:check-build-freshness` enforces this and runs in `ci:gate`.
3. Consumers that load a built package and depend on specific exports must
   verify those exports are present and **fail closed naming what is missing**,
   rather than proceeding into a call-time `undefined`.
4. Timestamps are not evidence. `dist` newer than `src` says nothing about
   content and is meaningless after a clone or a cache restore. The checked
   property is presence of the exported names.
5. Type-only exports are excluded: they are erased at runtime and cannot appear
   in the built output.

## Acceptance Criteria

1. A built entrypoint missing a source export fails the gate, naming package,
   file and missing export.
2. The check passes on a correctly built tree and does not fail on an unbuilt
   one, which is a different problem with its own remedy.
3. Requirement registry, NFR registry, traceability ledger, coverage status and
   bilingual documentation stay synchronized.

## Evidence and Scope

- Applies to all 17 workspace packages that publish `dist/index.js`.
- Evidence is the gate output naming the package and the missing exports.
- Complements requirements `106`, `110`, `129`, `130`.
