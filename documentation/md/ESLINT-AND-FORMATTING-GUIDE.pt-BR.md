# Guia de ESLint e Formatação

> EN: [ESLINT-AND-FORMATTING-GUIDE.md](ESLINT-AND-FORMATTING-GUIDE.md)

Fonte normativa: `.agents/requirements/software/138-eslint-9-flat-config-governance.md` (Requisito 138).

## A plataforma em um parágrafo

Toda regra de ESLint deste monorepo vive em **`@jumentix/config-eslint`**
(`packages/config-eslint`), um pacote de configuração flat compartilhado
construído sobre `eslint-config-airbnb-extended` (o sucessor flat-config do
Airbnb Extended). O repositório pinad **uma** única major de ESLint (9.x) em
todos os workspaces. O Prettier é o dono da formatação
(`prettier.config.mjs`); o ESLint nunca briga com ele porque
`eslint-config-prettier` fecha o array de configuração de cada consumidor.

## Comandos

| Comando                                     | O que faz                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                              | Lint de todo o repositório pela config raiz com `--max-warnings=0` (via `ci-cd/run-lint.js`, que também prova cobertura não-vazia e reporta a contagem de arquivos). |
| `bun run lint:fix`                          | Mesmo escopo com auto-fix.                                                                                                                                           |
| `bun run --cwd apps/frontend lint`          | Lint do seed frontend (SFCs Vue 3 incluídos).                                                                                                                        |
| `bun run --cwd apps/jumentix-website lint`  | Lint do website (React/Next/a11y, `.tsx` incluídos).                                                                                                                 |
| `bun run format`                            | Prettier `--write` no repositório inteiro.                                                                                                                           |
| `bun run format:check`                      | Prettier `--check` — a forma de gate de CI.                                                                                                                          |
| `bun run --cwd packages/config-eslint test` | Suíte de contrato da config compartilhada (fixtures, snapshots, prova de glob vazio).                                                                                |

## Arquitetura

O `@jumentix/config-eslint` exporta arrays flat-config componíveis; cada perfil
tem uma variante `strict` (`baseStrict`, `typescriptStrict`, …) e o
repositório roda as variantes strict em todo lugar:

| Perfil          | Consumidores                   | Conteúdo                                                                                                                                                                                                        |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`          | raiz, frontend, website        | Airbnb Extended recommended + camada de paridade Jumentix (`no-console`, `no-async-foreach`, guarda de declaração de dependências, relaxamentos legados com razões).                                            |
| `typescript`    | todos                          | Regras TS do Airbnb + resolução `projectService` por workspace (cada arquivo linta contra o seu próprio `tsconfig.json`); árvores sem cobertura de tsconfig recebem o fallback não-type-aware (`untypedFiles`). |
| `node`          | raiz, frontend                 | `eslint-plugin-n`: APIs de runtime, APIs deprecadas, escopo ESM/CJS.                                                                                                                                            |
| `vue`           | frontend (+ template cli-init) | Tiers Vue essential/strongly-recommended/recommended + `vuejs-accessibility` (strict) + `<script setup>` tipado.                                                                                                |
| `reactNextA11y` | website                        | React, Hooks, `jsx-a11y`, core web vitals do `@next/eslint-plugin-next`.                                                                                                                                        |
| `test`          | todos                          | Regras Jest escopadas apenas para arquivos de teste (lição JUM-619), exceções docker-gated e bun:test, globals de browser Cypress/Mocha.                                                                        |
| `stylistic`     | todos (por último)             | `eslint-config-prettier` — desliga toda regra de formatação para que ESLint e Prettier nunca conflitem.                                                                                                         |

As configs consumidoras (`eslint.config.mjs` na raiz, `apps/frontend/`,
`apps/jumentix-website/`) apenas montam perfis, declaram `ignores` e ligam
`languageOptions.globals` escopados — nunca definem regras. O template
frontend do `cli-init` espelha `apps/frontend/eslint.config.mjs` verbatim e é
guardado por `bun run cli:check-template-freshness`.

## Política de exceções

- Uma exceção é um `// eslint-disable-next-line <regra> -- <razão>` de linha
  única, revisado caso a caso. Disables de arquivo ou diretório inteiros são
  proibidos, exceto o cabeçalho estabelecido `/* eslint-disable no-console */`
  em scripts repórteres puros (checks de CI que existem para imprimir).
- Relaxamentos escopados de regra numa config consumidora (opções por
  superfície) devem nomear a superfície e a razão num comentário — veja o
  bloco do runtime sem bundler do service-management no `eslint.config.mjs`
  raiz como padrão.
- `// @ts-expect-error` deve carregar uma descrição
  (`@typescript-eslint/ban-ts-comment` com `minimumDescriptionLength: 3`).
- Promises fire-and-forget: `no-void` e `@typescript-eslint/no-floating-promises`
  estão ambas ativas, então a forma compatível é `expr.catch(() => undefined)` —
  nunca `void expr` solto e nunca uma chamada solta.

## Atualizando ESLint ou um plugin

1. Suba a versão no `packages/config-eslint/package.json` **e** em cada
   `package.json` consumidor (uma versão no repositório — Requisito 138 §2).
2. `bun install`, depois `bun run --cwd packages/config-eslint test` — os
   snapshots de config efetiva capturam quedas silenciosas de regras; revise
   cada diff de snapshot deliberadamente.
3. `bun run lint` e `bun run format:check` devem continuar verdes; remedie
   novas violações na mesma mudança.

## Onboarding para um novo agente

1. Leia o Requisito 138 primeiro, depois este guia.
2. Nunca edite regras dentro de uma config consumidora — os perfis vivem em
   `packages/config-eslint/src/profiles/`.
3. Antes de afirmar "lint está verde", cole o comando e o seu exit code
   (Requisito 130). O gate só é confiável porque é provado falhar
   (`ci-cd/test/run-lint.test.ts` exercita o fixture negativo).
