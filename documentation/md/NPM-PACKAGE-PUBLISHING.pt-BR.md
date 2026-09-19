<!--
Arquivo gerado automaticamente a partir de: documentation/md/NPM-PACKAGE-PUBLISHING.md
Idioma alvo: Português (Brasil)
-->
# Publicacao de Pacotes npm

O Jumentix publica bibliotecas publicas sob o escopo npm `@jumentix`. O primeiro conjunto de release e:

1. `@jumentix/cana`
2. `@jumentix/cana-react`
3. `@jumentix/cana-vue`
4. `@jumentix/designer-core`

A CLI, os templates, os SDKs e os pacotes de infraestrutura permanecem privados.

## Gate de Release

Execute o gate de artefatos antes de solicitar um release:

```bash
bun run npm:packages:check
```

Ele recompila cada pacote publico a partir de uma saida limpa, inspeciona o tarball npm e instala todos os tarballs em um consumidor externo temporario antes de importar seus pontos de entrada publicos. Ele nao autentica nem publica.

## Publicacao

Use o workflow `Publish npm packages` do GitHub Actions a partir de `main`. Ele e manual e usa o ambiente protegido `npm-publish`. O workflow executa o gate de artefatos, publica Cana antes das integracoes React e Vue e mapeia o segredo GitHub `NPM_JUMENTIX_CI_CD` para `NODE_AUTH_TOKEN` somente no `npm publish`.

Configure o ambiente `npm-publish` com revisores obrigatorios antes do primeiro release. Nunca imprima, versione ou armazene o token em um arquivo do projeto.

## Verificacao e Rollback

Depois de um release aprovado, verifique as paginas dos pacotes npm, instale as versoes publicadas com Bun e npm em projetos consumidores limpos e inspecione os metadados de proveniencia. Versoes npm sao imutaveis; avance com uma versao corrigida e descontinue uma versao defeituosa em vez de tentar substitui-la.
