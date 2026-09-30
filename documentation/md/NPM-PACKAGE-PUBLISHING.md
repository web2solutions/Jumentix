# npm Package Publishing

Jumentix publishes public libraries under the `@jumentix` npm scope. The public release cohort is:

1. `@jumentix/cana`
2. `@jumentix/cana-react`
3. `@jumentix/cana-vue`
4. `@jumentix/designer-core`
5. `@jumentix/persistence-contracts`
6. `@jumentix/shared-contracts`
7. `@jumentix/external-persistence-core`
8. `@jumentix/external-store-proxy`
9. `@jumentix/external-db-repositories`
10. `@jumentix/key-value-storage`
11. `@jumentix/database-client-factory`
12. `@jumentix/message-mediator`
13. `@jumentix/mutex-service`
14. `@jumentix/dead-letter-queue`
15. `@jumentix/runtime-infra`
16. `@jumentix/adapter-runtime-bootstrap`
17. `@jumentix/sdk-grpc-client`
18. `@jumentix/sdk-rest-client`
19. `@jumentix/sdk-websocket-client`
20. `@jumentix/cli-init`

Internal workspace packages (`config-*`, `agent-registry`, `security-scanner`, and similar) remain private.

## Version policy

- Library packages version independently in each package's `package.json`.
- Application / root locked version is bumped only by CircleCI on `main` via
  `ci-cd/lib/next-version.js` + `ci-cd/create-app-release-tag.js` (not by local commit scripts).
- After a successful `npm publish`, CI creates an annotated package tag
  `@jumentix/<pkg>@<version>` so the published version maps to an exact commit.
- A later run skips any package whose package tag already exists, and a version already on
  npm without its tag gets the tag repaired instead of failing with `EPUBLISHCONFLICT`.
- `@jumentix/cli-init` version tracks the factory template cohort it scaffolds; generated projects pin published `@jumentix/*` package versions rather than `workspace:*`.
- Pre-releases use npm dist-tags (for example `0.1.0-rc.1`) and require the protected `secrets` environment.

## Release Gate

Run the release artifact gate before requesting a release:

```bash
bun run npm:packages:check
bun run release:dry-run:packages
```

`npm:packages:check` rebuilds each public package from clean output, inspects its npm tarball, and installs all tarballs in a temporary external consumer before importing their public entry points. It does not authenticate or publish. `release:dry-run:packages` additionally runs Bun pack dry-runs for every non-private package.

## Publication

Publication is automated. After every application release on `main`, `.github/workflows/app-release.yml` calls the `Publish npm packages` workflow (`.github/workflows/npm-publish.yml`) with the `all` cohort, so bumping a package's `version` and promoting it to `main` is what publishes it. The same workflow stays available through `workflow_dispatch` for a manual cohort re-run. It uses the `secrets` environment. The workflow verifies `@jumentix` org access, runs the artifact gate, then runs `bun run release:publish-cohort <cohort>` (`ci-cd/publish-npm-cohort.js`), which skips already-tagged or already-published versions, packs each package with `bun pm pack` (rewriting `workspace:*` ranges to concrete versions), publishes that tarball, and pushes the package tag on success. It maps the GitHub secret `NPM_CI_CD` to `NODE_AUTH_TOKEN` for org check and `npm publish`, grants `id-token: write` so npm provenance (root `.npmrc` `provenance=true`) can attest the GitHub Actions run, and grants `contents: write` so package tags can be pushed.

Never print, commit, or store the token in a project file.

Install the CLI after a successful publish:

```bash
npx @jumentix/cli-init init
```

## Verification and Rollback

After an approved release, verify the npm package pages (`npm view @jumentix/<package>`), the package tags (`git ls-remote --tags origin '@jumentix/*'`), install the published versions with Bun and npm in clean consumer projects, and inspect their provenance metadata. npm versions are immutable; roll forward with a patched version and deprecate a defective version rather than attempting to replace it.

If `NPM_TOKEN` / `NPM_CI_CD` is unavailable in the operator environment, land publishability and dry-run evidence only — do not claim a live registry publish.
