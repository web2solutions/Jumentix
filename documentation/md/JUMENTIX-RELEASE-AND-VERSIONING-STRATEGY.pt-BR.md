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

## Aplicação da Governança

O portão CI impõe a política de lançamento por meio de:

- `bun run release:governance:check`
- incluído em `bun run ci:gate`

A validação inclui:

- existem scripts de lançamento necessários na raiz (`changelog:*`, `release:dry-run*`)
- `release-policy.json` existe e é válido
- pacotes publicáveis possuem metadados semver e `files` válidos
- os espaços de trabalho do aplicativo são privados e sua versão é igual a `appLockedVersion`

## Fluxo de Trabalho Operacional

1. Atualize a versão root intencionalmente.
2. Atualize `release-policy.json` `appLockedVersion` para o mesmo valor.
3. Mantenha as versões do espaço de trabalho do aplicativo sincronizadas com o valor bloqueado.
4. Execute:
   - `bun run release:governance:check`
   - `bun run release:dry-run`
5. PR aberto com rastreabilidade para questões relacionadas ao projeto Jumentix.

## Evolução Futura

Se a orquestração da versão passar para Changesets, este documento e
`release-policy.json` continua sendo a fonte da política; a automação pode ser trocada sem
mudar a intenção de governação.
