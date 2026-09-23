# Epic closure record — Tag-driven changelog, GitHub Releases and npm publish

**Epic:** [P-JUM-32](https://linear.app/jumentix/project/epicrelease-git-tags-drive-changelog-github-releases-and-npm-publish-1488546fc45e)  
**Issues:** JUM-882 … JUM-889  
**Status (Req 130):** **Partial delivery** — tooling for F1–F7 is in tree; end-to-end proof is pending.

## Shipped in this delivery

| Piece | Path / surface |
| --- | --- |
| Req 060 tag conventions | `.agents/requirements/project/060-jumentix-release-versioning-policy-governance.md` |
| Next version rule | `ci-cd/lib/next-version.js` + `ci-cd/test/next-version.test.ts` |
| Application tag on `main` | `ci-cd/create-app-release-tag.js` + CircleCI job `create-app-release-tag` |
| GitHub Release from app tag | `ci-cd/create-github-release.js` + CircleCI job `create-github-release` |
| Package tags + re-publish guard | `ci-cd/publish-npm-cohort.js` + `.github/workflows/npm-publish.yml` |
| Changelog app-tag filter | `ci-cd/update-changelog.js` (`/^v\d+\.\d+\.\d+$/`) |
| Retired local bump scripts | removed `ci-cd/bumpTag.ts`, `ci-cd/bumpPackage.ts` |
| Docs EN/PT | `documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md` (+pt-BR), `NPM-PACKAGE-PUBLISHING.md` (+pt-BR) |

## Pending E2E proof (blocks JUM-889 Done + Project Completed)

Measured baseline at epic open (2026-09-23): `git ls-remote --tags origin` → 0 tags; no GitHub Releases; no `@jumentix/*` on npm.

After this change reaches `main`:

1. Next `dev`→`main` promotion must produce exactly one new application tag `vX.Y.Z` and a matching GitHub Release (`gh release list`).
2. First approved dispatch of **Publish npm packages** must publish at least one package and create its `@jumentix/<pkg>@<version>` tag (`npm view`, `git ls-remote --tags`).

Paste those command outputs into a Linear Project Update before marking JUM-889 Done and the Project Completed (Req 094 / 102 / 130).

## Operator prerequisites

- CircleCI context must expose `GH_TOKEN` or `GITHUB_TOKEN` with permission to push tags and create Releases (jobs fail closed if missing).
- GitHub Environment `secrets` + `NPM_CI_CD` remain the human gate for npm publish (Req 070).
