# Requirement 128 - Requirement Changes Take Precedence in the Release Process

## Context

Requirements are what every agent must read before executing under Requirement `099`. They are the
input to delivery, not a record of it.

A requirement merged into `dev` but not promoted to `main` is a rule that exists in one place and not
the other. Agents working from the released state follow the superseded rule, correctly, because it
is the rule they can see. Nothing reports the gap: no gate compares the requirement registry across
branches, and the ledger tracks coverage, not promotion.

The longer a requirement change waits behind unrelated work, the longer the fleet operates under a
rule the repository has already decided to replace.

## Mandatory Rules

1. A change under `.agents/requirements/` is promoted ahead of feature, fix, refactor and chore work
   competing for the same release.
2. A merged requirement change must not be deferred to a later release in order to keep a batch
   tidy, to align with a feature, or to reduce the number of promotions.
3. Where a release is assembled from several merged changes, the presence of a requirement change
   makes that release ready to promote as soon as its gates pass; it does not wait for unrelated
   work to finish.
4. Priority applies to **sequence only**. It confers no exemption from any gate.

## Priority Is Not a Bypass

Rule 4 is the operative constraint and is deliberately stated twice.

A requirement change passes exactly the same CI, coverage, security, and governance checks as any
other change. Nothing about its priority permits:

- merging with a pending, missing, cancelled, timed-out, skipped or failed required check;
- describing an unfinished check as passing;
- lowering a coverage threshold, quarantining a suite, or widening an exemption register to make a
  promotion fit a deadline;
- promoting from a branch whose gates have not reported.

Requirement `065` forbids false greens. "Top priority" is the phrase most likely to be offered later
as justification for skipping a check under time pressure, which is why this requirement refuses it
in advance. **Faster in the queue, never lighter at the gate.**

## Acceptance Criteria

1. Release and promotion procedures state the precedence of requirement changes and the
   sequence-only limit.
2. A release containing a requirement change is promoted on its own gate results, without waiting
   for unrelated merged work.
3. No gate, threshold, quarantine entry or exemption is relaxed on the grounds of requirement
   priority.
4. Requirement registry, NFR registry, traceability ledger, coverage status, and bilingual
   documentation remain synchronized.

## Evidence and Scope

- Applies to every promotion of `dev` to `main` across the monorepo.
- Evidence is the promotion pull request: its contents, its gate results, and the interval between
  the requirement change merging and being promoted.
- **Partially machine-verifiable.** Gate results are observable and already enforced. Ordering intent
  is not: no check can tell a release that waited from one that was ready. Whether to add a
  promotion-lag report comparing requirement registry state between `dev` and `main` is a separate
  decision and belongs to its own issue.
- Complements requirements `060`, `065`, `079`, `099`, and `127`.
