<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/CONTENT-PIPELINE.md
Idioma alvo: Português (Brasil)
-->
# Pipeline de conteúdo de redução

Rastreamento de problemas:

- Épico: [#124](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/124)
- Tarefa: [#127](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/127)

## Propósito

Converta documentos markdown selecionados do repositório Jumentix em páginas estáticas de documentação de sites em `apps/jumentix-website/content/jumentix`.

## Configuração de origem

Arquivo:

- `apps/jumentix-website/config/content-sources.json`

Cada item define:

- `slug` (obrigatório)
- `title` (substituição opcional do slug)
- `descrição` (substituição opcional do título)
- `source` (caminho obrigatório relativo à raiz do aplicativo do site)

## Script Gerador

Arquivo:

- `apps/jumentix-website/scripts/sync-markdown-content.mjs`

Comportamento:

1. Lê `content-sources.json`.
2. Carrega cada arquivo markdown de origem.
3. Gera uma página `.mdx` por fonte em `content/jumentix`.
4. Gera `content/jumentix/_meta.ts` para navegação.
5. Adiciona linha de rastreabilidade de origem em cada página gerada.

## Regras de substituição

- `título` ausente: inferido de `slug`.
- `descrição` ausente: gerada a partir do título final.
- Arquivo de origem ausente: a página gerada inclui uma mensagem explícita "Arquivo de origem não encontrado" (fallback seguro para compilação).

## Comandos

Da raiz do repositório:

```bash
node apps/jumentix-website/scripts/sync-markdown-content.mjs
```

Na área de trabalho do site:

```bash
pnpm run content:sync
```

`predev` e `prebuild` executam automaticamente `content:sync`.
