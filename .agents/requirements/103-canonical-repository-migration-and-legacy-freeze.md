# Requirement 103 - Canonical Repository Migration and Legacy Freeze

## Status

Active and mandatory.

## Requirement

1. `XpertMinds/Jumentix` is the private canonical repository for the Jumentix
   product, source, requirements, specifications, documentation, issues,
   branches, pull requests, checks, releases, and automation.
2. `XpertMinds/jumentix-agent-registry` is the private canonical repository for
   agent registration, assignment, branch-check, and coordination state.
3. `web2solutions/aaa-typescript-boilerplate` and
   `web2solutions/jumentix-agent-registry` are deprecated, read-only legacy
   origins.
4. The deprecated repositories accept no new modifications, tasks, branches,
   commits, pull requests, releases, or automation changes after their final
   migration pull requests are merged to `dev`.
5. Both deprecated repositories must remain archived. Historical links may be
   retained only as audit evidence and must be labelled as legacy evidence.
6. Every active clone, remote, bootstrap command, edit link, changelog source,
   registry consumer, CI integration, and contributor instruction must use the
   appropriate `XpertMinds` canonical repository.
7. The canonical repositories remain private. Automated consumers must use
   authorized credentials without exposing, logging, sharing, or committing
   them.
8. Review approval count is optional. Required CI, quality, coverage, security,
   governance, traceability, and conversation-resolution checks remain
   mandatory and must be terminally successful.
9. Administrative bypass must not convert a failed, missing, skipped,
   cancelled, timed-out, or incomplete required check into success.

## Acceptance Criteria

1. Every active repository reference resolves to an `XpertMinds` canonical
   location unless it is explicitly marked as historical or deprecated.
2. The canonical agent-registry mirror is pinned to an immutable commit from
   `XpertMinds/jumentix-agent-registry`.
3. English and Portuguese documentation identifies the canonical application
   and both deprecated legacy origins.
4. The two legacy repositories contain a final deprecation requirement and are
   archived after their final `dev` PRs merge.
5. Repository migration policy is mapped in the NFR registry, traceability
   ledger, coverage attestation, governance specs, and documentation indexes.

## Evidence

- Linear epic: `JUM-562`
- Canonical documentation task: `JUM-563`
- Canonical registry task: `JUM-565`
- Legacy application freeze task: `JUM-566`
- Legacy registry freeze task: `JUM-567`
