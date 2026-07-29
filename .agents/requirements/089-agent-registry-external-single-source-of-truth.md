# Requirement 089 - Agent Registry External Single Source of Truth

## Context

Agent coordination must be centralized across repositories and runtimes. Keeping registry state only inside this repository can create drift between collaborating services and agents.

## Requirement

1. The agent registry must be tracked in an independent GitHub repository.
2. That independent repository is the single source of truth for agent coordination.
3. This repository must treat `.agents/AGENT-REGISTRY.md` as a mirrored copy of the external canonical registry.
4. Local mirror synchronization must be automated through executable tooling.
5. Every mirrored copy must record the immutable canonical commit revision from which it was
   synchronized.
6. Quality gates must validate the local mirror against that recorded immutable revision. A
   concurrent update to the canonical `main` branch must not retroactively invalidate an already
   committed and tested mirror.
7. The synchronization command must resolve the latest canonical `main` revision first, then
   update the mirror and its recorded revision as one reviewable change.
8. Quality-gate validation of a pinned revision must fetch immutable content. The private
   canonical repository uses the authenticated Contents API when `GITHUB_TOKEN`/`GH_TOKEN` is
   present. The existing raw fallback may be attempted for transport diagnostics, but private
   raw content is not an access mechanism and normally returns 404. Missing credentials,
   HTTP 401/403/404, unreachable canonical content, or an invalid pin/path must fail closed
   with guidance that never exposes credentials.
9. Branch-to-revision resolution is allowed only for explicit synchronization, must fail closed,
   and may use `GITHUB_TOKEN` or `GH_TOKEN` when available without exposing credentials.
10. Raw-content and Contents API URLs must contain the complete immutable SHA and safely encoded
    path segments.
11. The canonical registry repository is private under `XpertMinds`; only the owner account
    associated with `web2solucoes@gmail.com` (`web2solutions`) and identities explicitly
    authorized in Linear may read, push, or publish changes.

## Canonical Registry Repository

- `https://github.com/XpertMinds/jumentix-agent-registry` (private)
- Organization: `XpertMinds`
- Authorized publisher: GitHub user `web2solutions` (`web2solucoes@gmail.com`) and identities
  explicitly authorized by the project owner in Linear
- Branch: `main`
- Canonical file: `AGENT-REGISTRY.md`

## Integration Plan

1. Phase 1 - Repository foundation:
   - create/publish independent registry repo;
   - store canonical `AGENT-REGISTRY.md`.
2. Phase 2 - Local integration:
   - add source configuration in this repository;
   - add executable `check` and `sync` commands.
3. Phase 3 - Governance enforcement:
   - include registry source check in local/CI quality flow;
   - document operation and fallback behavior.
4. Phase 4 - Operational lifecycle:
   - update canonical registry first;
   - sync mirrors in consumer repositories.

## Acceptance Criteria

1. Independent registry repository exists and is published.
2. This repository has executable commands to check and sync the mirrored registry file.
3. Governance docs clearly identify the external repo as single source of truth.
4. CI validation of a committed mirror is reproducible even when another agent updates the
   canonical registry during the job.
5. Pinned mirror checks authenticate to private immutable content and fail closed without
   credentials.
6. Missing, unreachable, mutable, mismatched, or unauthorized canonical content fails the gate.
7. The canonical registry remains writable only by the designated owner account
   (`web2solutions` / `web2solucoes@gmail.com`) and explicitly authorized identities.

## Evidence

- GitHub issue `#192`
- Linear issue `JUM-505`
- `ci-cd/check-agent-registry-source.js`
- `apps/backend-template/test/unit/ci-cd/check-agent-registry-source.test.ts`
