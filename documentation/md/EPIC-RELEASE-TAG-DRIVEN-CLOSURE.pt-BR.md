# Registro de fechamento do épico — Changelog, GitHub Releases e publicação npm guiados por tags

**Épico:** [P-JUM-32](https://linear.app/jumentix/project/epicrelease-git-tags-drive-changelog-github-releases-and-npm-publish-1488546fc45e)  
**Issues:** JUM-882 … JUM-889  
**Status (Req 130):** tags de aplicação e GitHub Releases estão provados de ponta a ponta; a publicação npm foi replanejada e automatizada pelo JUM-894 (veja abaixo).

## Entregue

| Peça | Caminho / superfície |
| --- | --- |
| Convenções de tag do Req 060 | `.agents/requirements/project/060-jumentix-release-versioning-policy-governance.md` |
| Regra da próxima versão | `ci-cd/lib/next-version.js` + `ci-cd/test/next-version.test.ts` |
| Tag de aplicação em `main` | `ci-cd/create-app-release-tag.js --github-api` + `.github/workflows/app-release.yml` |
| GitHub Release a partir da tag | `ci-cd/create-github-release.js` (mesmo workflow, após a tag) |
| Tags de pacote + guarda contra republicação | `ci-cd/publish-npm-cohort.js` + `.github/workflows/npm-publish.yml` |
| Filtro de tag de aplicação no changelog | `ci-cd/update-changelog.js` (`/^v\d+\.\d+\.\d+$/`) |
| Scripts locais de bump aposentados | removidos `ci-cd/bumpTag.ts`, `ci-cd/bumpPackage.ts` |
| Docs EN/PT | `documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md` (+pt-BR), `NPM-PACKAGE-PUBLISHING.md` (+pt-BR) |

## Por que o GitHub Actions é dono das tags de aplicação (e não a CircleCI)

O job `create-app-release-tag` da CircleCI falhou fechado em `main` (build 562) com
`Missing GH_TOKEN or GITHUB_TOKEN`. Mesmo com token, a `main` protegida exige
commits verificados e um ruleset de pull request — um `git commit` + `git push`
simples a partir da CircleCI não entra. O repositório já usa `CHANGELOG_GH_TOKEN` +
`createCommitOnBranch` para o `sync-changelog` (exceção sempre ativa do Req 113).
Os releases da aplicação reutilizam essa mesma credencial e caminho de assinatura.

## Prova de ponta a ponta

Baseline na abertura do épico (2026-09-23): `git ls-remote --tags origin` → 0 tags; nenhum GitHub Release; nenhum `@jumentix/*` no npm.

Medido em 2026-09-26:

1. Tags de aplicação: `git ls-remote --tags origin` lista de `v0.1.0` a `v0.2.15`; `gh release list` mostra um GitHub Release por tag (mais recente `v0.2.15`, 2026-09-26T15:25:33Z).
2. npm: o único disparo de **Publish npm packages** (run 35822469950, 2026-09-23) falhou antes de a correção `id-token: write` entrar e nunca foi reexecutado. O JUM-894 (épico `[EPIC][Docs] Unified Jumentix Documentation`) corrigiu mais dois defeitos do publicador e tornou a publicação automática após cada release da aplicação; a primeira publicação fica registrada naquela Issue.

## Pré-requisitos de operação

- O Environment `secrets` do GitHub precisa expor `CHANGELOG_GH_TOKEN` com escrita em contents + pull-requests (já exigido pelo `sync-changelog`).
- `NPM_CI_CD` no mesmo environment autentica a publicação npm automatizada (Requisito 070, emendado em 2026-09-26).
