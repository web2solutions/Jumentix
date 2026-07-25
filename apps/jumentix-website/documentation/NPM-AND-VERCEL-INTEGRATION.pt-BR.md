<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/NPM-AND-VERCEL-INTEGRATION.md
Idioma alvo: Português (Brasil)
-->
# Integração NPM e Vercel

## Organização NPM

Organização alvo para publicação de pacotes:

- `xpertminds`

Configurado na raiz `.npmrc`:

- `@xpertminds:registry=https://registry.npmjs.org/`
- `sempre-auth=true`
- `proveniência=verdade`

Comandos de validação:

```bash
pnpm run npm:whoami
pnpm run npm:org:check:xpertminds
pnpm run npm:publish:dry-run:packages
```

Observação:

- A publicação **não** é executada por esses comandos.
- Avisos de simulação para pacotes que ainda não estão no escopo `@xpertminds/*`.

## Integração Vercel

Conta Vercel alvo:

- `web2solutions` (conta pessoal)

Comandos raiz:

```bash
pnpm run website:vercel:link
pnpm run website:vercel:pull:preview
pnpm run website:vercel:pull:prod
pnpm run website:deploy:vercel:preview
pnpm run website:deploy:vercel
```

Comandos do aplicativo (`apps/jumentix-website`):

```bash
pnpm run vercel:link
pnpm run vercel:pull:preview
pnpm run vercel:pull:prod
pnpm run deploy:vercel:preview
pnpm run deploy:vercel
```

Esses comandos são configurados para funcionar sem sinalizadores de escopo forçados e não exigem publicação/implantação imediata.

## Nota importante sobre o tempo de execução

Os comandos de implantação agora são independentes de escopo por padrão (sem sinalizador `--scope` forçado), porque
Vercel rejeita escopos explícitos de contas pessoais em alguns contextos CLI. Isso mantém a implantação
confiável para configurações de contas pessoais e de equipe.
