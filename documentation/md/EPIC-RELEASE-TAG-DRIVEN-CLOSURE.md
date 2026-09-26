# Epic closure record — Tag-driven changelog, GitHub Releases and npm publish

**Epic:** [P-JUM-32](https://linear.app/jumentix/project/epicrelease-git-tags-drive-changelog-github-releases-and-npm-publish-1488546fc45e)  
**Issues:** JUM-882 … JUM-889  
**Status (Req 130):** application tags and GitHub Releases are proven end to end; npm publication was re-planned and automated by JUM-894 (see below).

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

## End-to-end proof

Baseline at epic open (2026-09-23): `git ls-remote --tags origin` → 0 tags; no GitHub Releases; no `@jumentix/*` on npm.

Measured 2026-09-26:

1. Application tags: `git ls-remote --tags origin` lists `v0.1.0` through `v0.2.15`; `gh release list` shows a GitHub Release per tag (latest `v0.2.15`, 2026-09-26T15:25:33Z).
2. npm: the only dispatch of **Publish npm packages** (run 35822469950, 2026-09-23) failed before the `id-token: write` fix landed and was never re-run. JUM-894 (epic `[EPIC][Docs] Unified Jumentix Documentation`) fixed two further publisher defects and made publication automatic after each application release; its first publish is recorded on that Issue.

## Operator prerequisites

- GitHub Environment `secrets` must expose `CHANGELOG_GH_TOKEN` with contents + pull-requests write (already required by `sync-changelog`).
- `NPM_CI_CD` in the same environment authenticates the automated npm publish (Requirement 070, amended 2026-09-26).
