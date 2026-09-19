# Requirement 133 - Declared Indexes for Ordered Queries

## Context

The Requirement `129` agent bus read its recent events with
`.orderByChild('ts').limitToLast(50)` on `/agent-bus/events/<epicKey>`.

Realtime Database builds no index on its own. With no `.indexOn` in the
security rules the query is still answered: the server sends every child under
the path, the client sorts in memory, and `limitToLast` trims after the whole
node has already been downloaded. Nothing throws. No test fails. The only
signal is a warning in the Firebase log, and the cost grows linearly with the
number of records — invisible while a feature is new, expensive once it is
used.

Two things made it undetectable. The query was correct, so behaviour tests
could not see it. And the rules it depended on lived only in the Firebase
console: no file in the repository could be read to find out whether the index
existed.

## Mandatory Rules

1. **A query that orders by a field declares its index.** Any ordered or
   filtered query against a store that requires explicit indexes — Realtime
   Database `.indexOn`, Firestore composite indexes — is accompanied by the
   index declaration in the same change.
2. **Index declarations live in the repository.** Rules and index definitions
   are version-controlled files, reviewable in a pull request. Console-only
   configuration is not a declaration.
3. **Versioned rules are seeded from the live project, never authored blind.**
   A rules deploy replaces the entire ruleset, so the first version of the file
   is an export of what is running (`bun run rtdb:export-rules`). Edits come
   after, as a reviewable diff.
4. **Prefer an ordering that needs no index.** Where keys already carry the
   ordering — Realtime Database push keys are assigned from the server clock
   and indexed by default — order by key rather than adding an index for a
   field that duplicates it.
5. **Client-written timestamps do not order records.** A timestamp string set
   by the caller is compared lexicographically and depends on every writer
   using the same format and zone. Ordering that must be reliable uses a
   server-assigned value.

## Acceptance Criteria

1. `bun run rtdb:check-indexes` passes: every `orderByChild` in the source has
   a matching `.indexOn` in `database.rules.json`.
2. The check fails when the rules file is absent, rather than passing for lack
   of anything to compare.
3. `database.rules.json` matches the live project at the time it was exported.

## Evidence and Scope

- Machine-verifiable: `ci-cd/check-rtdb-indexes.js`, wired into `ci:gate`.
- Its negative control is the query that shipped before JUM-656, which passed
  every test in this repository —
  `ci-cd/test/check-rtdb-indexes.test.ts`.
- Deploying rules is owner-side and needs project credentials; the gate covers
  the declaration, not the deploy.
- Complements requirements `129`, `130`, `131`, `132`.
