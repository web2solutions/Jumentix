# Requirement 130 - Measured Claims and Bounded Work

## Context

Two failure modes cost real time in this repository, and neither is a coding
mistake. Both are reporting mistakes.

**Unmeasured claims.** A baseline was published as "four Cypress specs visiting
four routes" after counting `it(` with grep. The specs are parameterised, so the
real numbers were 62 tests across 52 routes. The whole justification for a task
was built on a number nobody had run the suite to obtain.

**Proxies mistaken for causes.** Six website pages returning 404 were recorded as
404ing *because* they were marked `display: 'hidden'`. The real cause was the
docs resolver rewriting single-segment paths into the `jumentix/` subtree. The
flag happened to name the same files. A filter written against the proxy passes
today and stops working the moment the coincidence breaks.

Both were caught late, by re-reading output, and both had already been published
as fact. A gate cannot catch either; only the discipline below can.

## Mandatory Rules

1. **A quantitative claim must carry the command that produced it.** Counts,
   coverage, timings, route totals and pass/fail tallies are reported with the
   invocation and its output, not from reading source or from memory.
2. **Grep is not a measurement of behaviour.** Counting occurrences in source
   establishes what the text contains, never what the code does. Loops,
   parameterised tests and generated cases make the two diverge.
3. **A cause is stated only when it has been isolated.** Where a correlation is
   used because the cause is not yet known, it is named as a proxy in the same
   sentence, with what would distinguish it from the real cause.
4. **A published claim found to be wrong is corrected where it was published**,
   in the same channel, naming the correct value. Silent replacement is
   forbidden.
5. **Work is bounded before it starts.** A task states what it will deliver and
   what it will not. Scope discovered mid-task is recorded as its own issue
   rather than absorbed silently.
6. **Partial delivery is reported as partial**, naming the part not delivered
   and why. A task is not described as complete while any acceptance criterion
   is unmet.
7. **"Done" requires evidence.** Completion is claimed with gate results,
   verbatim, including any check that is pending, skipped, cancelled or failed.

## Vague Work Is a Defect

A task whose outcome cannot be checked is not a task. Before execution, an
executable task must have:

- a stated deliverable a reader can hold;
- acceptance criteria that can fail;
- a verification method that is not the author's opinion.

Where an obligation cannot be machine-verified — Requirements `127` and `129`
are examples — the requirement says so in its own text, so nobody mistakes an
attestation for a gate.

## Acceptance Criteria

1. Agent instruction files carry the measured-claim and bounded-work rules.
2. Corrections to published claims are visible in the channel that carried the
   original.
3. Issues and pull requests state scope, non-scope, and what was not delivered.

## Evidence and Scope

- Applies to every registered agent and to human contributors reporting results.
- Evidence is the report itself: commands quoted, outputs verbatim, proxies
  labelled, corrections published where the error was published.
- **Not machine-verifiable.** No gate reads intent. This is attestation-based in
  the same way as `127` and `129`, and is stated as such rather than implied.
- Complements requirements `065`, `094`, `102`, `127`, `128`, `129`, `131`, `132`.
