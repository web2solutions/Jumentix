# Agent Support Declaration

Canonical mechanism added 2026-08-05 under Linear
[JUM-604](https://linear.app/jumentix/issue/JUM-604) and Requirement `125`.

## What supporting an agent means

An engineering agent is supported by this repository when all of the following hold:

1. It has an entry in `.agents/supported-agents.json` with `platformId`, `branchPrefix`,
   `displayName`, and `instructionsFile`.
2. Its root instructions file (for example `KIMI.md`) exists and follows the working-rules
   pattern shared by `AGENTS.md`, `CLAUDE.md`, `GROK.md`, and `OPENCODE.md`.
3. It is registered in the canonical Firestore agent registry (Requirement `089`) via
   `bun run agent-registry:register`.
4. It commits with an identity authorized in `.agents/AUTHORIZED-COMMITTERS.json`
   (Requirement `111`).
5. Its task branches use the declared `branchPrefix` in the form
   `<prefix>/<nature>/<issue-id>-<short-slug>` (Requirement `122`).

## Declaration file

`.agents/supported-agents.json` is the single declared set of supported agents:

```json
[
  {
    "platformId": "kimi",
    "branchPrefix": "kimi",
    "displayName": "Kimi Code CLI",
    "instructionsFile": "KIMI.md"
  }
]
```

`ci-cd/check-pr-governance.js` derives the accepted task-branch prefixes from this file — for
both the strict `agent/nature/JUM-NNN-slug` match and the legacy `agent/nature/slug` match — and
fails closed with a clear diagnostic when the declaration is missing or malformed. The same gate
(`bun run pr:governance:check`, wired into CI) also verifies that every declared agent's
`instructionsFile` exists, so a declaration pointing at nothing fails the gate.

## Adding a new agent

Adding the next agent is a data change, not a code change:

1. Register the agent in Firestore (`bun run agent-registry:register`) and authorize its commit
   identity (Requirement `111`).
2. Add the platform's root instructions file mirroring the existing working rules.
3. Add one entry to `.agents/supported-agents.json`.
4. Run `bun run pr:governance:check` and `bun run requirements:check` to confirm the gates stay
   green.

No edit to `ci-cd/check-pr-governance.js` is required.

## Currently declared platforms

| Platform | Branch prefix | Instructions file |
| --- | --- | --- |
| Codex | `codex` | `AGENTS.md` |
| Claude Code | `claude` | `CLAUDE.md` |
| Grok | `grok` | `GROK.md` |
| OpenCode | `opencode` | `OPENCODE.md` |
| Kimi Code CLI | `kimi` | `KIMI.md` |

## Related requirements

- `077` Multi-agent platform support
- `089` Agent registry external single source of truth (Firestore)
- `111` Authorized commit identities
- `122` Task-owned branch and PR naming governance
- `125` Agent support declaration

## Evidence

- `.agents/supported-agents.json`
- `ci-cd/check-pr-governance.js`
- `apps/backend-template/test/unit/ci-cd/check-pr-governance.test.ts`
- `bun run pr:governance:check`
