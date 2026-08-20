# Requirement 132 - No Orphaned Published Artifacts

## Context

Seven files under `apps/jumentix-website/content/` cannot be served. The docs
resolver rewrites every single-segment path into the `jumentix/` subtree, so
`content/api.mdx` is looked for at `content/jumentix/api` and answers 404. Two of
the seven are real Jumentix documentation, reachable by nobody who has the URL.

The route sweep skipped them by filtering `display: 'hidden'`, which named
exactly the orphaned files on the day it was written. That is a coincidence: the
first top-level page added without hiding it 404s while the sweep stays green.

An artifact that exists, is committed, and cannot be reached is worse than a
missing one. Nothing reports it, and its author believes it shipped.

## Mandatory Rules

1. Every committed content artifact intended for publication must resolve to a
   route the application can actually serve.
2. An artifact that cannot be served must be recorded in a declared register
   with the issue that owns the decision and the reason.
3. The register **fails in both directions**: an unreachable artifact that is
   unlisted fails, and a listed artifact that has become reachable also fails.
   A stale exemption hides the next real one.
4. A register entry naming a file that no longer exists fails.
5. Reachability is decided by mirroring the application's own resolution rules,
   with a comment pointing at the code that owns them, so a routing change
   forces the check to change with it.
6. `bun run website:check-content-routes` enforces this and runs in `ci:gate`.

## Acceptance Criteria

1. An unreachable, unlisted content file fails the gate, naming the file and the
   resolution rule it violates.
2. Removing an obsolete register entry is required by the gate rather than left
   to memory.
3. Requirement registry, NFR registry, traceability ledger, coverage status and
   bilingual documentation stay synchronized.

## Evidence and Scope

- Applies to `apps/jumentix-website/content/` today, and to any future published
  content tree resolved through a rewrite.
- Evidence is the gate output and the declared register.
- Complements requirements `065`, `126`, `130`, `131`.
