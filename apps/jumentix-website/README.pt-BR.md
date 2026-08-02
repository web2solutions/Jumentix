<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/README.md
Idioma alvo: Português (Brasil)
-->
# Site Jumentix

Aplicativo de site comercial para venda da Jumentix como uma fábrica de software empresarial.

## Linha de base do modelo

Este aplicativo usa a linha de base da arquitetura do modelo Vercel:

- [MantineUI + Nextra](https://vercel.com/templates/next.js/mantine-ui-nextra)
- Repositório de modelos de origem: `gfazioli/next-app-nextra-template`

## Propósito

- Apresentar uma narrativa comercial orientada para a conversão para compradores empresariais.
- Reutilize a documentação de markdown como fonte de conteúdo estático.
- Publicar estaticamente no Vercel.
- Exponha uma página pública de changelog apoiada pelo histórico de commits do GitHub com paginação.

## Centro de Documentação

- [Índice de documentação do site](./documentation/README.md)

## Correr

```bash
bun run --filter @jumentix/website dev
```

## Construir

```bash
bun run --filter @jumentix/website build
```

## Planejando artefatos

- [IA do site e plano de conversão](./documentation/WEBSITE-IA-AND-CONVERSION-PLAN.md)
- [Pipeline de conteúdo de marcação](./documentation/CONTENT-PIPELINE.md)
- [Página do changelog](./documentation/CHANGELOG-PAGE.md)
- [SEO e linha de base de desempenho](./documentation/SEO-AND-PERFORMANCE-BASELINE.md)
- [Implantação Vercel](./documentation/VERCEL-DEPLOYMENT.md)
- [Integração NPM e Vercel](./documentation/NPM-AND-VERCEL-INTEGRATION.md)
