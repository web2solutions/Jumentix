# @jumentix/config-eslint

Jumentix shared ESLint 9 flat configuration, built on `eslint-config-airbnb-extended`. This package
is the single source of every ESLint rule in the monorepo (Requirement 138).

## Profiles

Each profile is a function returning a composable flat-config array; every one has a `*Strict`
variant, and the repository runs the strict variants everywhere:

- `base` / `baseStrict` — Airbnb Extended recommended + the Jumentix parity layer.
- `typescript` / `typescriptStrict` — per-workspace `projectService` resolution, `untypedFiles`
  fallback, workspace-alias import resolution (`resolverProjects`).
- `node` / `nodeStrict` — `eslint-plugin-n` runtime rules, ESM/CJS scoping.
- `vue` / `vueStrict` — Vue 3 tiers + `vuejs-accessibility` (strict) + typed `<script setup>`.
- `reactNextA11y` / `reactNextA11yStrict` — React, Hooks, jsx-a11y, Next.js core web vitals.
- `test` / `testStrict` — Jest rules scoped to test files, with the docker-gated / bun:test /
  Cypress-Mocha exception blocks.
- `stylistic` / `stylisticStrict` — `eslint-config-prettier`; always the last array entry.

## Usage

```js
import { baseStrict, stylistic, typescriptStrict } from '@jumentix/config-eslint';

export default [
  ...baseStrict(),
  ...typescriptStrict({ tsconfigRootDir: import.meta.dirname }),
  ...stylistic()
];
```

## Tests

`bun test` — positive/negative fixtures per profile, effective-config snapshots, export resolution,
empty-glob detection and an external-consumption fixture project. The suite fails if a profile drops
a rule or a glob matches nothing.

Full developer guide: `documentation/md/ESLINT-AND-FORMATTING-GUIDE.md` (+ `.pt-BR.md`).
