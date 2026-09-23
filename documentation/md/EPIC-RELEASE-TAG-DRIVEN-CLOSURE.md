# Epic closure record — Tag-driven changelog, GitHub Releases and npm publish

**Epic:** [P-JUM-32](https://linear.app/jumentix/project/epicrelease-git-tags-drive-changelog-github-releases-and-npm-publish-1488546fc45e)  
**Issues:** JUM-882 … JUM-889  
**Status (Req 130):** **Partial delivery** — tooling for F1–F7 is in tree; end-to-end proof is pending the next `main` push after `app-release.yml` lands.

## Shipped in this delivery

| Piece | Path / surface |
| --- | --- |
| Req 060 tag conventions | `.agents/requirements/project/060-jumentix-release-versioning-policy-governance.md` |
| Next version rule | `ci-cd/lib/next-version.js` + `ci-cd/test/next-version.test.ts` |
| Application tag on `main` | `ci-cd/create-app-release-tag.js --github-api` + `.github/workflows/app-release.yml` |
| GitHub Release from app tag | `ci-cd/create-github-release.js` (same workflow after tag) |
| Package tags + re-publish guard | `ci-cd/publish-npm-cohort.js` + `.github/workflows/npm-publish.yml` |
| Changelog app-tag filter | `ci-cd/update-changelog.js` (`/^v\d+\.\d+\.\d+$/`) |
| Retired local bump scripts | removed `ci-cd/bumpTag.ts`, `ci-cd/bumpPackage.ts` |
| Docs EN/PT | `documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md` (+pt-BR), `NPM-PACKAGE-PUBLISHING.md` (+pt-BR) |

## Why GitHub Actions owns application tags (not CircleCI)

CircleCI job `create-app-release-tag` failed closed on `main` (build 562) with
`Missing GH_TOKEN or GITHUB_TOKEN`. Even with a token, protected `main` requires
verified commits and a pull-request ruleset — a raw `git commit` + `git push`
from CircleCI cannot land. The repository already uses `CHANGELOG_GH_TOKEN` +
`createCommitOnBranch` for `sync-changelog` (Req 113 always-on exception).
Application releases reuse that same credential and signing path.

## Pending E2E proof (blocks JUM-889 Done + Project Completed)

Measured baseline at epic open (2026-09-23): `git ls-remote --tags origin` → 0 tags; no GitHub Releases; no `@jumentix/*` on npm.

After `app-release.yml` reaches `main`:

1. The next `main` push must produce exactly one new application tag `vX.Y.Z` and a matching GitHub Release (`gh release list`).
2. First approved dispatch of **Publish npm packages** must publish at least one package and create its `@jumentix/<pkg>@<version>` tag (`npm view`, `git ls-remote --tags`).

Paste those command outputs into a Linear Project Update before marking JUM-889 Done and the Project Completed (Req 094 / 102 / 130).

## Operator prerequisites

- GitHub Environment `secrets` must expose `CHANGELOG_GH_TOKEN` with contents + pull-requests write (already required by `sync-changelog`).
- `NPM_CI_CD` remains the human gate for npm publish (Req 070).
