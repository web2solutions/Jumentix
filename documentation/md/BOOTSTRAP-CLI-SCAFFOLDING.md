# Bootstrap CLI Scaffolding

This boilerplate now exposes registry-installable bootstrap CLI commands:

- `jumentix-bootstrap`
- `jumentix-init`

The command clones `web2solutions/Jumentix` into a target folder and writes initial service profile metadata.

Workspace ownership:

- `packages/cli-init` contains the canonical bootstrap implementation.
- root `bin/jumentix-bootstrap.js` delegates to `packages/cli-init` to keep behavior consistent during monorepo migration.

## Usage

Install globally (or run with `bun x` from the package registry):

```bash
bun add --global @jumentix/cli-init
jumentix-init
jumentix-bootstrap
```

Local repository usage:

```bash
bun run cli:bootstrap
```

Non-interactive usage:

```bash
jumentix-init --service-type=rest --project-name=my-service --git-branch=main --install-deps=false
```

CLI help:

```bash
jumentix-init --help
```

Supported flags:

- `--service-type` (`rest|websocket|grpc|graphql|functions`)
- `--project-name`
- `--git-branch`
- `--install-deps` (`y|n|true|false`)
- `--repo` (override template repository URL)

## Supported Scaffold Profiles

1. HTTP/REST server (OpenAPI/Swagger + static assets)
2. WebSocket server (+ static assets)
3. gRPC server (+ static assets)
4. GraphQL server (+ static assets)
5. Functions bundle (AWS/Google/Azure/Vercel/Cloudflare)

## Generated Metadata

After scaffolding, the CLI writes:

- `.jumentix/service-profile.json`

Example fields:

- selected service type
- profile flags (`interface`, `functions`, `staticAssets`)
- repository and branch used for scaffold
- generation timestamp
