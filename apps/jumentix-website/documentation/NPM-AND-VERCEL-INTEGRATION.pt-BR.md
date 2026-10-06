<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/NPM-AND-VERCEL-INTEGRATION.md
Idioma alvo: Português (Brasil)
-->
# Integração NPM e Vercel

## Organização NPM

Organização alvo para publicação de pacotes:

- `jumentix`

Configurado na raiz `.npmrc`:

- `@jumentix:registry=https://registry.npmjs.org/`
- `always-auth=true`
- `provenance=true`

Comandos de validação:

```bash
bun run npm:whoami
bun run npm:org:check:jumentix
bun run npm:packages:check
```

Observação:

- Esses comandos não publicam.
- O gate de artefatos valida o conjunto aprovado de release `@jumentix/*` em um consumidor externo.

### Publicação automática em `main`

1. `app-release.yml` roda em todo push para `main` e chama `npm-publish.yml`.
2. `npm-publish.yml` publica cada pacote público cuja versão em `package.json` ainda não está no npm.
3. Quando o conteúdo publicado muda em `main` sem bump de versão, `package-content-bump.yml`
   abre um PR assinado de patch-bump (branch via refs API + commit GraphQL via stdin em
   `ci-cd/plan-package-content-bumps.js --commit`, sem passar `templates.manifest.json` pelo
   `ARG_MAX` do shell) para a próxima publicação (JUM-917).

Não publique de um laptop. Faça bump da versão no PR de entrega ou confie no follow-up automático.

## Integração Vercel

Conta Vercel alvo:

- `web2solutions` (conta pessoal)

Comandos raiz:

```bash
bun run website:vercel:link
bun run website:vercel:pull:preview
bun run website:vercel:pull:prod
bun run website:deploy:vercel:preview
bun run website:deploy:vercel
```

Comandos do aplicativo (`apps/jumentix-website`):

```bash
bun run vercel:link
bun run vercel:pull:preview
bun run vercel:pull:prod
bun run deploy:vercel:preview
bun run deploy:vercel
```

Esses comandos são configurados para funcionar sem sinalizadores de escopo forçados e não exigem publicação/implantação imediata.

### Deploy automático de produção em `main`

A integração Git da Vercel faz deploy de `jumentix-website` nos pushes para `main`.
`website-deploy-verify.yml` espera o status de commit da Vercel e falha fechado se o deploy
não suceder (JUM-917 / Req 070). `website:publish` manual é só recuperação.

## Nota importante sobre o tempo de execução

Os comandos de implantação agora são independentes de escopo por padrão (sem sinalizador `--scope` forçado), porque
Vercel rejeita escopos explícitos de contas pessoais em alguns contextos CLI. Isso mantém a implantação
confiável para configurações de contas pessoais e de equipe.
