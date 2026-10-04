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

## Pin do Bun na Vercel

A imagem Bun padrão da Vercel pode ficar atrás do pin do repositório (`.bun-version` / `packageManager`).
`apps/jumentix-website/vercel.json` força (monorepo a partir do Root Directory do app):

- `installCommand`: `cd ../.. && bunx bun@1.3.13 install --frozen-lockfile`
- `buildCommand`: `cd ../.. && bunx bun@1.3.13 run website:deps:build && cd apps/jumentix-website && bunx bun@1.3.13 run build`

Pacotes workspace (`@jumentix/cana`, etc.) publicam `dist/` ignorado pelo git, então a Vercel
precisa buildar as deps do site antes do build Next.js.

## Configuração

Arquivo:

- `apps/jumentix-website/vercel.json`

Valores configurados:

- `framework`: `nextjs`
- `installCommand`: install Bun na raiz do monorepo (ver acima)
- `buildCommand`: `website:deps:build` e depois `build` do app (ver acima)
- `devCommand`: `bun run dev`
- `outputDirectory`: `.next`

## Ambiente obrigatório na Vercel

Como `web2solutions/Jumentix` é privado, chamadas não autenticadas à API do GitHub retornam 404.
Defina no projeto Vercel (Production + Preview):

| Nome           | Propósito                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | Variável legada opcional. Nada em runtime precisa dela: `/changelog` e `/api/github-releases` empacotam seus dados em build (`scripts/sync-changelog.mjs`, `scripts/sync-releases.mjs`). O snapshot de releases a utiliza em build quando presente. |

Analytics da Vercel é montado no layout raiz do App Router via
`@vercel/analytics/react` (`<Analytics />`) e não exige variável de
ambiente customizada.

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
- Promoções de produção para `main` devem usar um PR `dev`→`main` (ou um head de release/changelog gerado permitido). Heads ad hoc `cursor/release/*` apontando para `main` falham na classificação de contexto do CI.
  contextos Vercel de conta pessoal e conta de equipe.
- O link de projeto do Vercel CLI (`.vercel/project.json`, criado por `vercel link` ou deploy
  manual) é configuração local da máquina. Está no .gitignore da raiz do repositório e nunca
  deve ser commitado.
