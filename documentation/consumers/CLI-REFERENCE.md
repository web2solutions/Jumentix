# Jumentix CLI reference

The Jumentix CLI (`@jumentix/cli-init`) creates a new project from your domain
model or an OpenAPI contract, extends it as the product grows, and keeps it in
step with newer templates. This page lists every command and option.

## Run it

You need [Bun](https://bun.sh) 1.3.13 or newer. Docker is optional and only
used when your project runs a database server or Redis.

```bash
npx @jumentix/cli-init init my-product
```

`bunx @jumentix/cli-init init my-product` works the same way. The package's
command is `jumentix`; install it once to call it directly, which is how the
examples below are written:

```bash
bun add -g @jumentix/cli-init
jumentix --help
jumentix <command> --help
```

Without a global install, replace `jumentix` with `npx @jumentix/cli-init`.

Exit codes: `0` success, `1` a problem with the input or the project, `2` a
problem with the environment (for example Bun is missing).

## `init` — create a project

```bash
jumentix init [dir] [options]
```

| Option | Values | Default |
| --- | --- | --- |
| `--mode` | `monolith`, `services`, `hybrid`, `frontend` | inferred: one service becomes `monolith` |
| `--from` | a Domain Designer export (`.json`), an OpenAPI 3.x file (`.yml`/`.json`), or an `https://` catalog URL | the Users preset |
| `--preset` | `users` | `users` when `--from` is omitted |
| `--http` | `express`, `fastify`, `restify` | `express` |
| `--realtime` | `none`, `websocket`, `grpc` | `none` |
| `--db` | `sqlite`, `postgres`, `mysql`, `mongo`, `inmemory` | `sqlite` |
| `--frontend` | include `apps/frontend` | on for `hybrid` and `frontend` modes |
| `--offline` | keep the offline-first data layer in the frontend | off |
| `--git` | run `git init` and make a first commit | off |
| `--install` | run `bun install` after generation | off |
| `--config` | read answers from a `jumentix.init.json` file | — |
| `--non-interactive` | never prompt; use flags and defaults | off |

Modes:

| Mode | What you get |
| --- | --- |
| `monolith` | One backend service with every domain in-process |
| `services` | One backend service per service in your model |
| `hybrid` | Backend services plus `apps/frontend` |
| `frontend` | `apps/frontend` only, pointed at an existing API |

Examples:

```bash
# Users preset, one service, Express and SQLite, no prompts
npx @jumentix/cli-init init my-product \
  --mode=monolith --preset=users --http=express --realtime=none --db=sqlite \
  --non-interactive

# Your own OpenAPI contract, backend plus frontend with offline support
npx @jumentix/cli-init init my-product \
  --from=./openapi.yml --mode=hybrid --offline --db=postgres --install --git
```

The model is validated before anything is written. Generation stops with a
named error when a model has no core service, an entity has no primary key, a
relation crosses a service boundary in `monolith` mode, an interface is not
supported, or two domains declare the same entity name.

### What is generated

```text
my-product/
├── apps/
│   ├── <service>/            # one backend per service (REST API, OpenAPI spec, tests)
│   └── frontend/             # hybrid and frontend modes
├── docker-compose.yml        # the chosen database, plus Redis when realtime is on
├── package.json              # Bun workspace with dev / test / lint / build
├── README.md                 # how to run, ports, seeded accounts
├── jumentix.init.json        # your answers, reusable with --config
└── .jumentix/                # project metadata used by add, upgrade and doctor
```

Run the project:

```bash
cd my-product
bun install
bun run dev
```

`bun run test`, `bun run lint` and `bun run build` run the same script in every
app. The API listens on `http://localhost:3000` and the frontend on
`http://localhost:5173`; the generated README lists the database port and the
seeded sign-in accounts.

## `add` — extend a project

Run inside a project created by `init`.

| Command | Effect |
| --- | --- |
| `jumentix add domain <name> [--from <source>] [--service <id>]` | Add a domain to the core service (or to `--service`) and refresh the frontend modules when a frontend exists |
| `jumentix add service <name> --domains a,b` | Create `apps/<name>` and move the listed domains into it (`services` and `hybrid` modes) |
| `jumentix add frontend [--offline]` | Add `apps/frontend` to a backend-only project; the mode becomes `hybrid` |

`add` refuses to overwrite generated files you have edited. Pass `--force` to
proceed anyway.

## `upgrade` — take newer templates

```bash
jumentix upgrade --dry-run
jumentix upgrade
```

`upgrade` merges the templates of the installed CLI version into your project,
file by file, without discarding your edits:

| Status | Meaning |
| --- | --- |
| updated | You had not changed the file, or both changes merged cleanly |
| conflicted | You and the template changed the same lines; conflict markers are left in the file |
| skipped | The template did not change, or only you changed the file |
| added / removed | New template files are added; retired files are reported and kept |

`--dry-run` prints the report without writing. An upgrade refuses to run on a
git working tree with uncommitted changes unless you pass `--force`. Applied
upgrades write a report to `.jumentix/upgrade-<version>.md`.

## `doctor` — check the environment and the project

```bash
jumentix doctor
```

| Area | Checks |
| --- | --- |
| environment | Bun version (required), Node.js 20 or newer when installed, Docker availability |
| project | project metadata and mode, template version against the installed CLI, expected `apps/*` directories, edited generated files |

`doctor` exits `0` when healthy, `1` when the project needs attention and `2`
when the environment does.

## Related

- [Getting started](./GETTING-STARTED.md)
- [Architecture](./ARCHITECTURE.md)
- [Runtime environment contracts](./RUNTIME-CAPABILITIES.md)
