# Jumentix Release and Versioning Strategy

## Policy

Jumentix uses a hybrid strategy:

- `packages/*`: **independent versioning**
- `apps/*`: **locked versioning** tied to root project version

Canonical policy source:

- `release-policy.json`

Current values:

- `packageVersioning`: `independent`
- `appVersioning`: `locked`
- `appLockedVersion`: must match root `package.json` version

## Git tag families (Requirement 060)

Two annotated tag families, both created by CI — never from a developer machine:

| Family | Format | When | Owner |
| --- | --- | --- | --- |
| Application | `v<appLockedVersion>` (e.g. `v0.0.3`) | After each successful version bump on `main` | GitHub Actions `app-release.yml` → `bun ci-cd/create-app-release-tag.js --github-api` |
| Package | `@jumentix/<pkg>@<version>` | After each successful `npm publish` | GitHub Actions `npm-publish.yml` → `bun run release:publish-cohort` |

The next application version is computed by `ci-cd/lib/next-version.js` from commits
since the last application tag (or full history when none exist):

- major: `BREAKING CHANGE`, `type!`, Nature `Breaking`
- minor: Feature / feat
- patch: Fix / Bug / Security / Perf / Refactor
- ignore: Docs / Chore / Test / CI / Style / Release (+ changelog sync commits)

`CHANGELOG.md` sections only on application tags (`/^v\d+\.\d+\.\d+$/`). Each
application tag also gets a GitHub Release via `bun run release:github-release`
(same `app-release.yml` job after the tag; notes = matching changelog section;
pre-1.0 marked prerelease).

## Governance Enforcement

The CI gate enforces release policy through:

- `bun run release:governance:check`
- included in `bun run ci:gate`

Validation includes:

- required release scripts exist in root (`changelog:*`, `release:dry-run*`,
  `release:next-version`, `release:app-tag`, `release:github-release`,
  `release:publish-cohort`)
- `release-policy.json` exists and is valid
- publishable packages have valid semver and `files` metadata
- app workspaces are private and their version equals `appLockedVersion`

## Operational Workflow

1. Merge task PRs to `dev` as usual (local commits do **not** bump versions).
2. Open a `dev`→`main` promotion PR. After it merges, `.github/workflows/app-release.yml`
   runs on `main` with `CHANGELOG_GH_TOKEN` (Req 113 always-on exception): computes the
   next version, opens a signed squash PR for the locked-version bump, merges it,
   creates the annotated application tag on the squash commit, regenerates
   `CHANGELOG.md`, and creates the GitHub Release.
3. When ready to publish packages, dispatch **Publish npm packages** on `main`
   (protected `secrets` Environment, Requirement 070). The workflow skips any
   package whose `@jumentix/<pkg>@<version>` tag already exists, publishes the rest,
   and creates package tags on success.
4. Verify with `bun run release:governance:check`, `bun run release:dry-run`,
   `gh release list`, and `npm view @jumentix/<package>`.

Dry-run helpers:

- `bun run release:next-version -- --dry-run` (or `bun ci-cd/lib/next-version.js --dry-run`)
- `bun run release:app-tag -- --dry-run`
- `bun run release:github-release -- --dry-run vX.Y.Z`
- `bun run release:publish-cohort -- --dry-run <cohort>`

Superseded: `ci-cd/bumpTag.ts` and `ci-cd/bumpPackage.ts` (removed).

## Future Evolution

If release orchestration moves to Changesets, this document and
`release-policy.json` remain the policy source; automation can be swapped without
changing governance intent.
