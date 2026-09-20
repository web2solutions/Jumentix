# Requirement 037 - Factory Generator CLI (v2)

- Status: Active
- Nature: Functional (productization / CLI)
- Source: Linear epic `[EPIC][CLI] @jumentix/cli-init v1: factory generator
  (init/add/upgrade/doctor)` (JUM-843…856), 2026-09-19.
- Supersedes: v1 clone-the-monorepo bootstrap (five service types,
  `.jumentix/service-profile.json`).
- Relates to: `050` (distributable packages), `059` (factory matrices),
  `062`/`137` (CLI must not deep-import `ci-cd/` or `apps/*` at runtime —
  templates are data), `065`/`128` (release governance for published
  packages), `070` (npm org), `094` (epic documentation Issue), `115`/`118`
  (generator proven by generating and running output).

## Context

Engineers install one CLI and generate a **lean, runnable Bun workspace** for
one factory mode from a designer export, OAS, catalog URL, or the Users
preset — with `@jumentix/*` as published npm dependencies — not a clone of the
entire monorepo.

## Requirement

1. **Package and entrypoints.** Canonical implementation lives in
   `packages/cli-init` (`@jumentix/cli-init`). Default binary is `jumentix`.
   Aliases `jumentix-init` and `jumentix-bootstrap` remain. Root
   `bin/jumentix-bootstrap.js` continues to delegate to the package.

2. **Commands.** The CLI exposes exactly these commands:
   - `init` — create a new workspace
   - `add` — `add domain <name>`, `add service <name>`, `add frontend`
   - `upgrade` — template three-way merge (supports `--dry-run`)
   - `doctor` — environment and project diagnostics
   Each command documents `--help`. Exit codes: `0` success, `1` user error
   (names the flag/answer), `2` environment failure. No telemetry.

3. **Factory modes (`init --mode`).** Lean output only — never emit `.agents`,
   website, or service-management into the generated tree:
   - `monolith` — Modular Monolith
   - `services` — Multi-service Backend Group
   - `hybrid` — Hybrid Backend + Frontend
   - `frontend` — Frontend-only SPA/PWA

4. **Accepted sources.** Generation input is one of:
   - designer JSON export
   - OpenAPI 3.1 document (file)
   - catalog URL (`https://…`)
   - Users preset (`--preset users`) when no `--from` is given
   Sources normalize to one **GenerationPlan** before any files are written.

5. **Template packaging and freshness gate.** Backend and frontend seeds are
   packaged inside the CLI under `packages/cli-init/templates/{backend,frontend}/`
   (committed data so `npx` works offline). Rebuild script:
   `packages/cli-init/scripts/build-templates.js`. Freshness gate script:
   `packages/cli-init/scripts/check-template-freshness.js`, invoked by root
   `bun run cli:check-template-freshness` and wired into `ci:gate`. The gate
   fails closed when `templates/` differs from the seeds at HEAD.

6. **Generated-project contract.** Every generated workspace MUST contain:
   - `.jumentix/project.json` — plan/answers consumed by `add` / `upgrade` /
     `doctor` (replaces and retires `.jumentix/service-profile.json`)
   - `.jumentix/manifest.json` — sha256 of every generated file (upgrade
     three-way merge)
   - `jumentix.init.json` — reproducible answers (`--config` round-trip)
   - root Bun workspace `package.json`, lockfile, `.gitignore`, `README.md`,
     and `docker-compose.yml` for the chosen database when a backend exists
   - merged OAS under `spec/` when a backend exists
   Generated projects MUST pass their own `lint` / `test` / `build` and boot
   in Docker.

7. **Published dependencies.** Generated apps depend on published `@jumentix/*`
   packages pinned to the CLI release version. The CLI itself is publishable
   under release governance (Req `065` / `128` / `070`).

8. **Non-interactive parity.** `--non-interactive` requires every answer from
   flags and/or `--config jumentix.init.json`. Guided prompts remain available
   when interactive. Legacy
   `jumentix-init --service-type=… --project-name=… --non-interactive` maps to
   `init --mode monolith` (with equivalent HTTP defaults) and prints a
   deprecation notice.

9. **Runtime ownership boundary.** At runtime the published CLI may depend on
   other published `@jumentix/*` packages only. It must never module-import
   `ci-cd/**` or `apps/**` source. Templates are opaque data copied into the
   target.

## Validation

- Requirement file: `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- Freshness gate: `packages/cli-init/scripts/check-template-freshness.js`
  (`bun run cli:check-template-freshness`)
- Package suites under `packages/cli-init/test/**` (Req `112` / `115`)
- Generation e2e matrix (Docker) once registered (epic C12 / JUM-854)
- `bun run requirements:check`

## Epic Project Update cadence

For the Linear Project
`[EPIC][CLI] @jumentix/cli-init v1: factory generator (init/add/upgrade/doctor)`
every child Issue publishes Project Updates at:

1. **Start** — agent_identifier, branch, intended deliverable
2. **Each command or capability shipped** — what landed, measured evidence
3. **Review-ready** — PR URL, exact required-check states (never claim pending /
   failed / skipped as green)
4. **Final handoff** — merge SHA, remaining blockers, next Issue in the chain

Epic Project completion waits on the dedicated documentation Issue (Req `094`
/ JUM-856).
