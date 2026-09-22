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

- Pacotes de biblioteca usam `bumpPackage` / conventional commits do repositorio para semver.
- A versao de `@jumentix/cli-init` acompanha o cohort de templates da fabrica que ela gera; projetos gerados fixam versoes publicadas de `@jumentix/*` em vez de `workspace:*`.
- Pre-releases usam dist-tags npm (por exemplo `0.1.0-rc.1`) e exigem o segredo do ambiente protegido `npm-publish`.

## Gate de Release

Execute o gate de artefatos antes de solicitar um release:

```bash
bun run npm:packages:check
bun run release:dry-run:packages
```

`npm:packages:check` recompila cada pacote publico a partir de uma saida limpa, inspeciona o tarball npm e instala todos os tarballs em um consumidor externo temporario antes de importar seus pontos de entrada publicos. Ele nao autentica nem publica. `release:dry-run:packages` tambem executa dry-runs de pack do Bun para cada pacote nao privado.

## Publicacao

Use o workflow `Publish npm packages` do GitHub Actions a partir de `main`. Ele e manual e usa o ambiente protegido `npm-publish`. O workflow executa o gate de artefatos, publica Cana antes das integracoes React e Vue, depois publica contratos, runtime, SDKs e a CLI em ordem de dependencia, e mapeia o segredo GitHub `NPM_CI_CD` para `NODE_AUTH_TOKEN` somente no `npm publish`.

Configure o ambiente `npm-publish` com revisores obrigatorios antes do primeiro release. Nunca imprima, versione ou armazene o token em um arquivo do projeto.

Instale a CLI apos uma publicacao bem-sucedida:

```bash
npx @jumentix/cli-init init
```

## Verificacao e Rollback

Depois de um release aprovado, verifique as paginas dos pacotes npm (`npm view @jumentix/<package>`), instale as versoes publicadas com Bun e npm em projetos consumidores limpos e inspecione os metadados de proveniencia. Versoes npm sao imutaveis; avance com uma versao corrigida e descontinue uma versao defeituosa em vez de tentar substitui-la.

Se `NPM_TOKEN` / `NPM_CI_CD` estiver indisponivel no ambiente do operador, entregue apenas publicabilidade e evidencia de dry-run — nao declare uma publicacao real no registry.
