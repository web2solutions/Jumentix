# Requirement 125 - Agent Support Declaration

- Status: Active
- Nature: NFR (governance, multi-agent operations)
- Source: Project owner decision, 2026-08-05 (JUM-604).
- Relates to: `077` (multi-agent platform support), `089` (agent registry single source of truth),
  `111` (authorized commit identities), `122` (branch and PR naming governance).

## Context

Supporting an engineering agent used to mean editing several disconnected places: a hardcoded
branch-prefix regex in `ci-cd/check-pr-governance.js`, one root instructions file per platform,
and the agent registry in Firestore (Requirement `089`). Nothing tied those together, so an
unlisted agent's every PR failed the gate with `invalid task branch format`. The set of supported
agents is data, and adding the next agent must be a data change rather than a code change.

## Requirement

1. The set of supported agents must be declared as data in `.agents/supported-agents.json`, an
   array of entries recording `platformId`, `branchPrefix`, `displayName`, and
   `instructionsFile` for each platform.
2. `ci-cd/check-pr-governance.js` must derive its accepted task-branch prefixes from that
   declaration — for both the strict `agent/nature/JUM-NNN-slug` match and the legacy
   `agent/nature/slug` match — and must fail closed with a clear diagnostic when the declaration
   is missing or malformed.
3. The PR governance gate must verify that every declared agent's `instructionsFile` exists at
   the referenced path, so a declaration pointing at nothing fails the gate.
4. Before an agent is declared in `.agents/supported-agents.json`, all of the following must be
   true:
   - a root instructions file for the platform exists and follows the established working-rules
     pattern of the other platform files;
   - the agent is registered in the canonical Firestore agent registry under Requirement `089`;
   - the agent commits with an identity authorized under Requirement `111`;
   - the agent's task branches use the declared `branchPrefix` and satisfy Requirement `122`.
5. Adding support for a new agent must require only a declaration entry plus its instructions
   file and registry record — no code change to the governance gate.

## Acceptance Criteria

1. `.agents/supported-agents.json` lists every supported platform (Codex, Claude Code, Grok,
   OpenCode, Kimi Code CLI) with `platformId`, `branchPrefix`, `displayName`, and
   `instructionsFile`.
2. `bun run pr:governance:check` derives branch prefixes from the declaration, accepts declared
   prefixes such as `kimi/governance/JUM-604-...`, rejects undeclared prefixes, and fails closed
   on a missing or malformed declaration.
3. The gate fails when a declared agent's instructions file is absent.
4. `KIMI.md` exists at the repository root and mirrors the working rules of the other platform
   instruction files.
5. Requirement registry, NFR registry, traceability ledger, coverage status, and bilingual
   documentation remain synchronized.

## Evidence

- `.agents/supported-agents.json`
- `ci-cd/check-pr-governance.js` (`loadSupportedAgents`, `agentBranchPatterns`,
  `validateSupportedAgents`)
- `KIMI.md`
- `ci-cd/test/check-pr-governance.test.ts`
- `documentation/md/AGENT-SUPPORT-DECLARATION.md` (+ pt-BR)
- `bun run pr:governance:check` and `bun run requirements:check` green
