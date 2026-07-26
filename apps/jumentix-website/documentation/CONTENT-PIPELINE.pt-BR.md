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
3. Reescreve links Markdown relativos ao repositório:
   - links para outra fonte publicada se tornam rotas `/docs/jumentix/<slug>`;
   - links para documentos fora do conjunto publicado se tornam URLs GitHub `blob/dev` válidas.
4. Gera uma página `.mdx` por fonte em `content/jumentix`.
5. Gera `content/jumentix/_meta.ts` para navegação.
6. Adiciona uma linha de rastreabilidade da origem em cada página gerada.

## Regras de substituição

- `título` ausente: inferido de `slug`.
- `descrição` ausente: gerada a partir do título final.
- Arquivo de origem ausente com página gerada válida: preserva a página gerada. Isso suporta
  builds isolados da Vercel quando as fontes externas ao aplicativo não estão no contexto de build.
- Arquivo de origem ausente sem página gerada válida: falha o build.
- Uma página contendo `Source file not found:` é inválida e nunca é aceita como fallback.

## Runtime da documentação

- As rotas canônicas usam `/docs/jumentix/<slug>`.
- Links existentes no formato `/docs/<slug>` continuam compatíveis e resolvem pela árvore canônica.
- O layout Nextra fornece navegação global, busca, sidebar, índice da página, navegação
  anterior/próxima, feedback, edição no GitHub e footer.
- Páginas de demonstração do template ficam ocultas da navegação pública.

## Comandos

Da raiz do repositório:

```bash
pnpm --dir apps/jumentix-website content:sync
```

Na área de trabalho do site:

```bash
pnpm run content:sync
```

`predev` e `prebuild` executam automaticamente `content:sync`.

O gate de pré-publicação valida rotas canônicas e legadas e rejeita marcadores de fonte ausente,
erros de provider do Nextra, componentes inválidos e erros internos do servidor.
