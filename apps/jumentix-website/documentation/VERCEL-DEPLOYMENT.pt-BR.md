<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/VERCEL-DEPLOYMENT.md
Idioma alvo: Português (Brasil)
-->
#Implantação Vercel

Rastreamento de problemas:

- Épico: [#124](https://github.com/XpertMinds/Jumentix/issues/124)
- Tarefa: [#130](https://github.com/XpertMinds/Jumentix/issues/130)

## Comandos de implantação

Da raiz do repositório:

```bash
pnpm run website:deploy:vercel
```

Pré-visualização da implantação:

```bash
pnpm run website:deploy:vercel:preview
```

Diretamente do espaço de trabalho do aplicativo:

```bash
pnpm --filter @jumentix/website deploy:vercel
```

## Configuração

Arquivo:

- `apps/jumentix-website/vercel.json`

Valores configurados:

- `estrutura`: `nextjs`
- `installCommand`: `pnpm install --frozen-lockfile`
- `buildCommand`: `pnpm run build`
- `devCommand`: `pnpm run dev`
- `outputDirectory`: `.next`

## Notas

- O conteúdo do site é estático e gerado a partir de fontes de markdown usando `content:sync`.
- `prebuild` executa a sincronização de conteúdo automaticamente antes da construção.
- A documentação gerada permanece disponível quando um build isolado da Vercel não consegue
  acessar arquivos-fonte externos ao aplicativo no monorepo.
- Builds locais e da Vercel usam o lockfile do workspace pnpm e seus patches de dependência.
- Os scripts de implantação raiz são intencionalmente independentes de escopo (sem `--scope` forçado) para suportar
  contextos Vercel de conta pessoal e conta de equipe.
