# Requirement 129 - Mandatory Firebase RTDB Agent Progress Bus

- Status: Active
- Nature: NFR (governance, multi-agent operations, realtime coordination)
- Source: Project owner decision — agents must consume the Firebase communication script.
- Relates to: `089`, `090`, `095`, `101`, `102`, `114`, `116`, `120`, `121`, `127`.

## Requirement

1. **Agents MUST publish material progress on the Firebase Realtime Database
   agent bus** via the repository CLI (`bun run agent-bus:publish`) or the
   equivalent `@jumentix/agent-registry` package API (`publishProgress`).
   Material progress includes task start, meaningful implementation steps,
   blockers, handoffs, conflicts, and completion.

2. **Before starting or resuming a task, and while waiting on remote checks,
   agents MUST consume the bus** with `bun run agent-bus:status` and/or
   `bun run agent-bus:watch` for the focused epic, then reconcile that view
   with the Firestore Agent Registry and Linear Project Updates required by
   `121`.

3. **Firestore remains the ownership SSOT.** Assignment, registration, and
   heartbeat authority stay in Firestore (`089`). RTDB carries progress events
   and non-authoritative presence only — agents MUST NOT treat RTDB as the
   source of task ownership.

4. **Credentials and fail-closed behaviour.** Bus operations require
   `FIREBASE_SERVICE_ACCOUNT_KEY` and `FIREBASE_DATABASE_URL`. Credentials must
   never be committed or logged. Missing credentials, RTDB unavailability, or
   publish/watch/status transport failures fail closed — silent local-only
   progress is non-compliant.

5. **Lifecycle mirroring.** `agent-registry:heartbeat`, `assign`, and
   `complete` MUST mirror presence into RTDB after a successful Firestore write
   when the bus is in use. A presence mirror failure fails the command.

6. **Linear Project Updates remain required** for human-readable epic
   broadcast (`102` / `121`). The RTDB bus is the machine-readable peer channel;
   it does not replace Project Updates.

## Canonical Bus Backend

- Firebase Realtime Database under path `agent-bus/`
- Presence: `agent-bus/presence/{agentId}`
- Events: `agent-bus/events/{epicId}/{pushId}`
- Organization: XpertMinds (same Firebase project as the agent registry)
- Expected env: `FIREBASE_DATABASE_URL=https://<project>-default-rtdb.<region>.firebasedatabase.app`

## Acceptance Criteria

1. Package and CLI expose `publish`, `watch`, and `status` against RTDB.
2. Heartbeat/assign/complete mirror presence when `FIREBASE_DATABASE_URL` is set.
3. Requirement docs and agent operating guides instruct agents to consume the bus.
4. Unit tests cover bus commands with mocked RTDB (no live Firebase required in CI).
5. `bun run requirements:check` includes this requirement.

## Evidence

- `packages/agent-registry/src/rtdb-client.ts`
- `packages/agent-registry/src/bus-commands.ts`
- `ci-cd/agent-registry-cli.js`
- `bun run agent-bus:publish|watch|status`
- `documentation/md/AGENT-OPERATING-REQUIREMENTS-114-121.md` (+ pt-BR)
- `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md` (+ pt-BR)
