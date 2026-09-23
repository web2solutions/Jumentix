<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md
Idioma alvo: Português (Brasil)
-->
# Estratégia de lançamento e versionamento do Jumentix

## Política

Jumentix usa uma estratégia híbrida:

- `packages/*`: **versionamento independente**
- `apps/*`: **versionamento bloqueado** vinculado à versão raiz do projeto

Fonte política canônica:

- `release-policy.json`

Valores atuais:

- `packageVersioning`: `independente`
- `appVersioning`: `bloqueado`
- `appLockedVersion`: deve corresponder à versão raiz `package.json`

## Famílias de tags git (Requisito 060)

Duas famílias de tags anotadas, ambas criadas por CI — nunca a partir de uma máquina de desenvolvedor:

| Família | Formato | Quando | Dono |
| --- | --- | --- | --- |
| Aplicação | `v<appLockedVersion>` (ex.: `v0.0.3`) | Após cada bump bem-sucedido em `main` | GitHub Actions `app-release.yml` → `bun ci-cd/create-app-release-tag.js --github-api` |
| Pacote | `@jumentix/<pkg>@<version>` | Após cada `npm publish` bem-sucedido | GitHub Actions `npm-publish.yml` → `bun run release:publish-cohort` |

A próxima versão de aplicação é calculada por `ci-cd/lib/next-version.js` a partir dos commits
desde a última tag de aplicação (ou do histórico completo quando não houver nenhuma):

- major: `BREAKING CHANGE`, `type!`, Nature `Breaking`
- minor: Feature / feat
- patch: Fix / Bug / Security / Perf / Refactor
- ignore: Docs / Chore / Test / CI / Style / Release (+ commits de sync do changelog)

Seções de `CHANGELOG.md` só em tags de aplicação (`/^v\d+\.\d+\.\d+$/`). Cada tag de
aplicação também gera um GitHub Release via `bun run release:github-release`
(mesmo job `app-release.yml` após a tag; notas = seção correspondente do changelog;
pré-1.0 marcado como prerelease).

## Aplicação da Governança

O portão CI impõe a política de lançamento por meio de:

- `bun run release:governance:check`
- incluído em `bun run ci:gate`

A validação inclui:

- existem scripts de lançamento necessários na raiz (`changelog:*`, `release:dry-run*`,
  `release:next-version`, `release:app-tag`, `release:github-release`,
  `release:publish-cohort`)
- `release-policy.json` existe e é válido
- pacotes publicáveis possuem metadados semver e `files` válidos
- os espaços de trabalho do aplicativo são privados e sua versão é igual a `appLockedVersion`

## Fluxo de Trabalho Operacional

1. Faça merge de PRs de tarefa em `dev` normalmente (commits locais **não** fazem bump de versão).
2. Abra um PR de promoção `dev`→`main`. Após o merge, `.github/workflows/app-release.yml`
   roda em `main` com `CHANGELOG_GH_TOKEN` (exceção always-on do Req 113): calcula a
   próxima versão, abre um PR squash assinado com o bump, faz merge, cria a tag
   anotada de aplicação no commit squash, regenera `CHANGELOG.md` e cria o
   GitHub Release.
3. Quando for publicar pacotes, dispare **Publish npm packages** em `main`
   (Environment protegido `secrets`, Requisito 070). O workflow ignora qualquer
   pacote cuja tag `@jumentix/<pkg>@<version>` já exista, publica o restante e
   cria as tags de pacote no sucesso.
4. Verifique com `bun run release:governance:check`, `bun run release:dry-run`,
   `gh release list` e `npm view @jumentix/<package>`.

Helpers de dry-run:

- `bun run release:next-version -- --dry-run` (ou `bun ci-cd/lib/next-version.js --dry-run`)
- `bun run release:app-tag -- --dry-run`
- `bun run release:github-release -- --dry-run vX.Y.Z`
- `bun run release:publish-cohort -- --dry-run <cohort>`

Substituídos: `ci-cd/bumpTag.ts` e `ci-cd/bumpPackage.ts` (removidos).

## Evolução Futura

Se a orquestração da versão passar para Changesets, este documento e
`release-policy.json` continua sendo a fonte da política; a automação pode ser trocada sem
mudar a intenção de governação.
