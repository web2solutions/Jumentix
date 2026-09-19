# Tooling do Jumentix

Automação documental mantida pelo repositório e executada pelos scripts do pacote raiz.

## Scripts

- `scripts/generate-ptbr-docs.mjs` gera documentação governada em português a partir das fontes em
  inglês e registra o marcador de origem nos arquivos gerados.
- `scripts/patch-ptbr-links.mjs` direciona links dos artefatos em português para seus equivalentes
  traduzidos quando eles existem.
- `scripts/generate-consumer-package-scripts-docs.mjs` lê os manifests reais da raiz e dos
  workspaces e regenera a referência de scripts para consumidores.

## Comandos na Raiz

```bash
bun run docs:translate:ptbr
bun run docs:translate:ptbr:links
bun run docs:consumers:package-scripts
```

Arquivos gerados em português não devem ser editados independentemente da fonte em inglês. Regenere,
revise o diff de terminologia e links e então execute as verificações de integridade do website e da
documentação.
