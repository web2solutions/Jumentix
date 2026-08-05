<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/VERCEL-DEPLOYMENT.md
Idioma alvo: Português (Brasil)
-->
# Implantação Vercel

Rastreamento de problemas:

- Épico: [JUM-390](https://linear.app/jumentix/issue/JUM-390/epicwebsite-rebuild-the-jumentix-open-source-product-and-documentation)
- Release: [JUM-397](https://linear.app/jumentix/issue/JUM-397/release-deploy-and-verify-the-rebuilt-jumentix-website-on-vercel)

URL de produção: `https://jumentix-website.vercel.app/`

## Comandos de implantação

Da raiz do repositório:

```bash
bun run website:deploy:vercel
```

Pré-visualização da implantação:

```bash
bun run website:deploy:vercel:preview
```

Diretamente do espaço de trabalho do aplicativo:

```bash
bun run --filter @jumentix/website deploy:vercel
```

Caminho seguro (gate de pré-publicação antes da produção):

```bash
bun run --filter @jumentix/website deploy:vercel:safe
```

Autenticação:

```bash
bunx vercel login
bun run website:vercel:link
```

## Configuração

Arquivo:

- `apps/jumentix-website/vercel.json`

Valores configurados:

- `framework`: `nextjs`
- `installCommand`: `bun install --frozen-lockfile`
- `buildCommand`: `bun run build`
- `devCommand`: `bun run dev`
- `outputDirectory`: `.next`

## Ambiente obrigatório na Vercel

Como `XpertMinds/Jumentix` é privado, chamadas não autenticadas à API do GitHub retornam 404.
Defina no projeto Vercel (Production + Preview):

| Nome | Propósito |
| --- | --- |
| `GITHUB_TOKEN` | Commits do changelog + API de releases (`ChangelogPage`, `/api/github-releases`) |

Opcional:

| Nome | Propósito |
| --- | --- |
| `NEXT_PUBLIC_VERCEL_ENV` | Habilita Vercel Analytics apenas quando definido pela plataforma |

## Verificação pós-deploy

Smoke mínimo:

- `/`, `/product`, `/use-cases`, `/roadmap`, `/community`, `/changelog`
- `/pt-BR`, `/pt-BR/product`
- `/docs/jumentix`, `/docs/jumentix/packages/cana`, `/docs/jumentix/concepts`
- `/docs/pt-BR/jumentix`
- `/sitemap.xml`, `/robots.txt`

Rollback: use a implantação de Production anterior no painel do projeto Vercel (Promote / Instant Rollback).

## Notas

- O conteúdo do site é estático e gerado a partir de fontes de markdown usando `content:sync`.
- `prebuild` executa a sincronização de conteúdo automaticamente antes da construção.
- A documentação gerada permanece disponível quando um build isolado da Vercel não consegue
  acessar arquivos-fonte externos ao aplicativo no monorepo.
- Builds locais e da Vercel usam o lockfile Bun do workspace e seus patches de dependência.
- Os scripts de implantação raiz são intencionalmente independentes de escopo (sem `--scope` forçado) para suportar
  contextos Vercel de conta pessoal e conta de equipe.
