# Requirement 089 - Agent Registry External Single Source of Truth

## Context

Agent coordination must be centralized across repositories and runtimes. Keeping registry state only inside this repository can create drift between collaborating services and agents.

## Requirement

1. The agent registry must be tracked in Firestore Database.
2. Firestore is the single source of truth for agent **ownership** coordination
   (registration, assignment, authoritative heartbeat fields). Realtime progress
   events and non-authoritative presence live on the Firebase RTDB agent bus
   required by `129` and do not replace this SSOT.
3. Agent registration, heartbeat, assignment, and completion are written directly to Firestore through the `agent-registry` CLI.
4. A local snapshot `.agents/registry-snapshot.json` may be generated with `bun run agent-registry:sync` for offline consultation. It is regenerable, must be ignored by Git, and is not a source of truth.
5. Quality gates validate the local snapshot against Firestore when the snapshot exists. A missing snapshot does not fail the gate; a stale snapshot fails with guidance to run `bun run agent-registry:sync`.
6. Firestore access requires the service account JSON in `FIREBASE_SERVICE_ACCOUNT_KEY`. CI must inject it via `secrets.FIREBASE_SERVICE_ACCOUNT_KEY`. Credentials must never be committed.
7. Transport failures, Firestore unavailability, or snapshot mismatches fail closed without falling back to local files. Diagnostics distinguish missing credentials from out-of-sync state and never expose credentials.
8. The Firestore project is private under XpertMinds. Only identities explicitly authorized in Linear may write agent records.

## Canonical Registry Backend

- Firestore Database (collection: `agents`)
- Organization: XpertMinds
- Authorized writers: identities explicitly authorized by the project owner in Linear

## Integration Plan

1. Phase 1 - Backend foundation:
   - provision Firestore project and collection;
   - deploy service account with restricted write scope.
2. Phase 2 - Local integration:
   - add `@jumentix/agent-registry` package with Firestore client and commands;
   - add CLI wrapper and package.json scripts.
3. Phase 3 - Governance enforcement:
   - include registry snapshot check in local/CI quality flow;
   - document operation and fallback behavior.
4. Phase 4 - Operational lifecycle:
   - agents register/heartbeat/assign/complete directly in Firestore;
   - sync snapshots for offline consultation when needed.

## Acceptance Criteria

1. Firestore project exists and is accessible via service account.
2. This repository has executable commands to register, heartbeat, assign, complete, sync, and check agent state.
3. Governance docs clearly identify Firestore as the single source of truth.
4. CI validation of a committed snapshot is reproducible when another agent updates Firestore during the job.
5. Missing, unreachable, or unauthorized Firestore access fails the gate.
6. The canonical registry remains writable only by authorized identities.

## Evidence

- `packages/agent-registry/`
- `ci-cd/agent-registry-cli.js`
- `ci-cd/migrate-agent-registry-to-firestore.js`
- Firestore project: `jumentix-service-registry` (collection `agents`).
- Migration executed 2026-08-03: 10 agents upserted from the legacy markdown
  mirror; `bun run agent-registry:sync` + `bun run agent-registry:check` green
  (11 agents after re-registration of `kimi-code-primary-001`).
