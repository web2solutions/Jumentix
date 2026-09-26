# @jumentix/config-eslint

Configuração flat ESLint 9 compartilhada do Jumentix, construída sobre
`eslint-config-airbnb-extended`. Este pacote é a única fonte de regras ESLint do monorepo
(Requisito 138).

## Perfis

Cada perfil é uma função que retorna um array flat-config componível; todos têm uma variante
`*Strict`, e o repositório roda as variantes strict em todo lugar:

- `base` / `baseStrict` — Airbnb Extended recommended + a camada de paridade Jumentix.
- `typescript` / `typescriptStrict` — resolução `projectService` por workspace, fallback
  `untypedFiles`, resolução de imports com aliases do monorepo (`resolverProjects`).
- `node` / `nodeStrict` — regras de runtime do `eslint-plugin-n`, escopo ESM/CJS.
- `vue` / `vueStrict` — tiers Vue 3 + `vuejs-accessibility` (strict) + `<script setup>` tipado.
- `reactNextA11y` / `reactNextA11yStrict` — React, Hooks, jsx-a11y, core web vitals do Next.js.
- `test` / `testStrict` — regras Jest escopadas a arquivos de teste, com os blocos de exceção
  docker-gated / bun:test / Cypress-Mocha.
- `stylistic` / `stylisticStrict` — `eslint-config-prettier`; sempre a última entrada do array.

## Uso

```js
import { baseStrict, stylistic, typescriptStrict } from '@jumentix/config-eslint';

export default [
  ...baseStrict(),
  ...typescriptStrict({ tsconfigRootDir: import.meta.dirname }),
  ...stylistic()
];
```

## Testes

`bun test` — fixtures positivos/negativos por perfil, snapshots de config efetiva, resolução de
exports, detecção de glob vazio e um projeto fixture de consumo externo. A suíte falha se um perfil
derrubar uma regra ou um glob não casar nada.

Guia completo do desenvolvedor: `documentation/md/ESLINT-AND-FORMATTING-GUIDE.pt-BR.md` (+ EN).
