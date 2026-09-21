# Factory Generator CLI (`@jumentix/cli-init`)

Requirement `037` (v2) defines `@jumentix/cli-init` as the **factory generator**:
it produces a lean Bun workspace for one factory mode instead of cloning the
entire monorepo.

Workspace ownership:

- `packages/cli-init` owns the CLI implementation, packaged templates, and
  freshness gate.
- Root `bin/jumentix-bootstrap.js` delegates to the package for compatibility.

## Commands

| Command | Purpose |
| --- | --- |
| `jumentix init` | Create a workspace (`monolith` / `services` / `hybrid` / `frontend`) |
| `jumentix add domain\|service\|frontend` | Extend an existing generated project |
| `jumentix upgrade` | Template three-way merge (`--dry-run` supported) |
| `jumentix doctor` | Environment and project diagnostics |

Aliases `jumentix-init` and `jumentix-bootstrap` remain; legacy
`--service-type` invocations map to `init --mode monolith` with a deprecation
notice.

## Sources

- Designer JSON export, OAS 3.1 file, or catalog URL via `--from`
- Users preset via `--preset users` when `--from` is omitted
- Reproducible answers via `--config jumentix.init.json`
- `--non-interactive` requires every answer from flags/config

## Templates and freshness

Templates are committed under `packages/cli-init/templates/{backend,frontend}/`
and rebuilt with `packages/cli-init/scripts/build-templates.js`.

Freshness gate (fails closed when templates drift from seeds):

```bash
bun run cli:check-template-freshness
```

Script: `packages/cli-init/scripts/check-template-freshness.js` (wired into
`ci:gate`).

## Generated-project contract

Every generated workspace includes:

- `.jumentix/project.json` — plan consumed by `add` / `upgrade` / `doctor`
- `.jumentix/manifest.json` — sha256 of generated files (upgrade merge)
- `jumentix.init.json` — answers for `--config` round-trips

`.jumentix/service-profile.json` is retired.

Backend generation (JUM-847) writes lean `apps/<service>` slices from the
packaged seed: renamed `@<project>/<service>` package, `.env.dev` from plan
interfaces/db, unused integration suites / db compose files pruned, Users +
auth retained on core, and designer domains injected via
`buildHexagonalBundle` into `src/modules/<Domain>/…` with registration in
`compositionRoot.ts`.

Frontend generation (JUM-848) writes `apps/frontend` for hybrid/frontend
modes: packaged seed copy, merged OAS baked into `src/contracts/openapi.json`,
one module per domain (entity configs from OAS operation ids and
`x-list-capabilities`), `.env` with Core/service URLs, and optional Cana
offline layer via `--offline`.

Workspace assembly (JUM-849) writes the Bun root after generation: `package.json`
with workspaces `apps/*` and fan-out `dev|test|lint|build`, `.gitignore`,
`docker-compose.yml` for the chosen database (+ Redis when realtime is enabled),
generated `README.md` (run steps, ports, seeded accounts), `.jumentix/project.json`,
`.jumentix/manifest.json` (sha256 per file), and `jumentix.init.json`. Optional
`--install` runs `bun install`; `--git` runs `git init` and the first commit.

Generated projects must pass their own `lint` / `test` / `build` and boot in
Docker. Runtime dependencies are published `@jumentix/*` packages pinned to the
CLI version.

## Local development

```bash
bun run --cwd packages/cli-init test
node packages/cli-init/bin/jumentix.js --help
```

Until the factory commands are fully shipped (epic Issues JUM-844…854), the
package may still expose the legacy clone path; the normative contract is this
document and Requirement `037` v2.
