# Requirement 119 - API-First Service Orchestration (GitHub via `gh`)

- Status: Active
- Nature: NFR (governance, multi-agent operations, integrations)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Relates to: `081`, `089`, `095`, `102`, `114`.

## Requirement

1. **When orchestrating work with external services** (Linear, GitHub, and any
   other planning, forge, CI, messaging, or project-management system), agents
   and automation MUST prefer the service's **HTTP/API / CLI that wraps that
   API** over driving a browser UI, desktop app, or GUI automation — whenever
   an API or official CLI exists and can complete the operation.

2. **GitHub operations MUST use the official GitHub CLI (`gh`).** Agents MUST
   not use the GitHub web UI, browser automation, or ad-hoc scraped HTML as the
   primary path for issues, pull requests, checks, reviews, releases, or
   repository metadata when `gh` can perform the action. Prefer
   `gh api` / GraphQL via `gh` when a higher-level `gh` subcommand is missing.

3. **Linear operations MUST use the Linear GraphQL API** (Requirement `095`),
   reading the key from `../.linear` (or the operator-confirmed equivalent
   outside the clone). Browser clicks in Linear are not an acceptable
   substitute for creating, updating, commenting, or publishing Project Updates
   when the API can do the work.

4. **Other services follow the same rule.** Use the vendor API, SDK, or
   official CLI first. Browser or app automation is allowed only when:
   - no usable API/CLI exists for that operation, **or**
   - the operator explicitly requires a human-in-the-loop UI step, **or**
   - the API path is blocked (auth, outage) and the agent records that blocker
     in the Linear Project Update before falling back.

5. **Fail closed on secret handling.** API keys, tokens, and `gh` auth must
   follow existing security requirements (`089`, `095`). Never commit, log, or
   paste credentials into issues, PRs, or chat.

## Evidence

- This requirement file
- Agent instruction parity (`AGENTS.md`, `CLAUDE.md`, `GROK.md`)
- Delivery evidence using `gh` for GitHub and Linear GraphQL for planning SoT
- Project Updates that do not rely on browser orchestration when APIs exist
