# Requirement 060 - Jumentix Release and Versioning Policy Governance

## Context

Jumentix monorepo needs a deterministic release/version policy to avoid drift across apps/packages and keep CI release checks reliable.

## Requirement

- The canonical policy file `release-policy.json` must exist at repository root.
- Policy model:
  - `packages/*` follow independent versioning.
  - `apps/*` follow locked versioning tied to root `package.json` version.
- Release governance checks must fail CI when policy or metadata contracts are violated.

### Git tag conventions (JUM-882)

Two annotated tag families, both created by CI only — never by a local developer script:

1. **Application release tag** — format `v<appLockedVersion>` (example: `v0.0.3`).
   Matches `release-policy.json.appLockedVersion` after the promotion bump. Created on
   the version-bump commit by `ci-cd/create-app-release-tag.js --github-api` from the
   always-on GitHub Actions workflow `.github/workflows/app-release.yml` on `main`
   (Req 113 always-on exception alongside `sync-changelog`: signed
   `createCommitOnBranch` + annotated tag via GitHub API, using `CHANGELOG_GH_TOKEN`
   from the protected `secrets` Environment). CircleCI does not own this path because
   protected `main` requires verified commits and a pull-request ruleset.
2. **Package publish tag** — format `@jumentix/<pkg>@<version>` (example: `@jumentix/cana@0.1.0`).
   Matches that package's `package.json.version` at the moment of a successful
   `npm publish`. Created by `ci-cd/publish-npm-cohort.js` inside
   `.github/workflows/npm-publish.yml` after publish succeeds.

Supporting scripts:

- `ci-cd/lib/next-version.js` — deterministic next `appLockedVersion` from Conventional
  Commits / PR `[Nature]` prefixes since the last application tag.
- `ci-cd/create-github-release.js` — GitHub Release notes from the matching
  `CHANGELOG.md` section (invoked by `app-release.yml` after the application tag).
- `ci-cd/update-changelog.js` — sections only on application tags (`/^v\d+\.\d+\.\d+$/`).

Superseded (removed): `ci-cd/bumpTag.ts`, `ci-cd/bumpPackage.ts`. Local commits must not
bump versions; promotion CI owns the app bump; npm publish owns package tags.

The protected `secrets` GitHub Environment for npm publish (Requirement 070) remains a
manual, human-approved gate. Tagging is additive and never bypasses that approval.

## Enforcement

- `npm run release:governance:check` is mandatory and included in `npm run ci:gate`.
- App workspaces must be `private: true` and their `version` must match `release-policy.json.appLockedVersion`.
- Publishable packages must have valid semver and non-empty `files` metadata.
- Root release scripts (`changelog:*`, `release:dry-run*`, `release:next-version`,
  `release:app-tag`, `release:github-release`, `release:publish-cohort`) must remain present.

## Documentation Sync

- Keep `documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md` updated.
- Keep README Documentation Index linked to the release strategy document.
