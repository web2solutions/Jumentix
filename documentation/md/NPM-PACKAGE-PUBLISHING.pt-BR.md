<!--
Arquivo gerado automaticamente a partir de: documentation/md/NPM-PACKAGE-PUBLISHING.md
Idioma alvo: Português (Brasil)
-->
# Publicacao de Pacotes npm

O Jumentix publica bibliotecas publicas sob o escopo npm `@jumentix`. O conjunto de release publico e:

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

Pacotes internos do workspace (`config-*`, `agent-registry`, `security-scanner` e similares) permanecem privados.

## Politica de versao

- Pacotes de biblioteca versionam de forma independente em cada `package.json`.
- A versao bloqueada de aplicacao / root so sobe no CircleCI em `main` via
  `ci-cd/lib/next-version.js` + `ci-cd/create-app-release-tag.js` (nao por scripts locais de commit).
- Apos um `npm publish` bem-sucedido, a CI cria uma tag anotada de pacote
  `@jumentix/<pkg>@<version>` para mapear a versao publicada a um commit exato.
- Uma execucao posterior ignora qualquer pacote cuja tag de pacote ja exista, e uma versao ja
  publicada no npm sem tag tem a tag reparada em vez de falhar com `EPUBLISHCONFLICT`.
- A versao de `@jumentix/cli-init` acompanha o cohort de templates da fabrica que ela gera; projetos gerados fixam versoes publicadas de `@jumentix/*` em vez de `workspace:*`.
- Pre-releases usam dist-tags npm (por exemplo `0.1.0-rc.1`) e exigem o ambiente protegido `secrets`.

## Gate de Release

Execute o gate de artefatos antes de solicitar um release:

```bash
bun run npm:packages:check
bun run release:dry-run:packages
```

`npm:packages:check` recompila cada pacote publico a partir de uma saida limpa, inspeciona o tarball npm e instala todos os tarballs em um consumidor externo temporario antes de importar seus pontos de entrada publicos. Ele nao autentica nem publica. `release:dry-run:packages` tambem executa dry-runs de pack do Bun para cada pacote nao privado.

## Publicacao

A publicacao e automatizada. Depois de cada release da aplicacao em `main`, `.github/workflows/app-release.yml` chama o workflow `Publish npm packages` (`.github/workflows/npm-publish.yml`) com o cohort `all`; subir a `version` de um pacote e promover para `main` e o que o publica. O mesmo workflow continua disponivel via `workflow_dispatch` para reexecutar um cohort manualmente. Ele usa o ambiente `secrets`. O workflow verifica o acesso a org `@jumentix`, executa o gate de artefatos e depois roda `bun run release:publish-cohort <cohort>` (`ci-cd/publish-npm-cohort.js`), que ignora versoes ja tagueadas ou ja publicadas, empacota cada pacote com `bun pm pack` (reescrevendo faixas `workspace:*` para versoes concretas), publica esse tarball e faz push da tag de pacote no sucesso. Ele mapeia o segredo GitHub `NPM_CI_CD` para `NODE_AUTH_TOKEN` no check de org e no `npm publish`, concede `id-token: write` para proveniencia npm (`.npmrc` raiz com `provenance=true`) e concede `contents: write` para push das tags de pacote.

Nunca imprima, versione ou armazene o token em um arquivo do projeto.

Instale a CLI apos uma publicacao bem-sucedida:

```bash
npx @jumentix/cli-init init
```

## Verificacao e Rollback

Depois de um release aprovado, verifique as paginas dos pacotes npm (`npm view @jumentix/<package>`), as tags de pacote (`git ls-remote --tags origin '@jumentix/*'`), instale as versoes publicadas com Bun e npm em projetos consumidores limpos e inspecione os metadados de proveniencia. Versoes npm sao imutaveis; avance com uma versao corrigida e descontinue uma versao defeituosa em vez de tentar substitui-la.

Se `NPM_TOKEN` / `NPM_CI_CD` estiver indisponivel no ambiente do operador, entregue apenas publicabilidade e evidencia de dry-run — nao declare uma publicacao real no registry.
