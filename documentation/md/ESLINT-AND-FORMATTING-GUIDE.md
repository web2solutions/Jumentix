# ESLint and Formatting Guide

> pt-BR: [ESLINT-AND-FORMATTING-GUIDE.pt-BR.md](ESLINT-AND-FORMATTING-GUIDE.pt-BR.md)

Normative source: `.agents/requirements/software/138-eslint-9-flat-config-governance.md` (Requirement 138).

## The platform in one paragraph

Every ESLint rule in this monorepo lives in **`@jumentix/config-eslint`**
(`packages/config-eslint`), a shared flat-config package built on
`eslint-config-airbnb-extended` (the flat-config Airbnb Extended successor).
The repository pins **one** ESLint major (9.x) across every workspace.
Prettier owns formatting (`prettier.config.mjs`); ESLint never fights it
because `eslint-config-prettier` closes every consumer's config array.

## Commands

| Command                                     | What it does                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                              | Lints the whole repository from the root config with `--max-warnings=0` (via `ci-cd/run-lint.js`, which also proves non-empty coverage and reports the file count). |
| `bun run lint:fix`                          | Same scope with auto-fix.                                                                                                                                           |
| `bun run --cwd apps/frontend lint`          | Lints the frontend seed (Vue 3 SFCs included).                                                                                                                      |
| `bun run --cwd apps/jumentix-website lint`  | Lints the website (React/Next/a11y, `.tsx` included).                                                                                                               |
| `bun run format`                            | Prettier `--write` across the repository.                                                                                                                           |
| `bun run format:check`                      | Prettier `--check` — the CI gate form.                                                                                                                              |
| `bun run --cwd packages/config-eslint test` | The shared config's contract suite (fixtures, snapshots, empty-glob proof).                                                                                         |

## Architecture

`@jumentix/config-eslint` exports composable flat-config arrays; every profile
has a `strict` variant (`baseStrict`, `typescriptStrict`, …) and the
repository runs the strict variants everywhere:

| Profile         | Consumers                      | Contents                                                                                                                                                                                                   |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`          | root, frontend, website        | Airbnb Extended recommended + Jumentix parity layer (`no-console`, `no-async-foreach`, dependency-declaration guard, legacy relaxations with reasons).                                                     |
| `typescript`    | all                            | Airbnb TS rules + per-workspace `projectService` resolution (each file lints against its own workspace `tsconfig.json`); trees with no tsconfig coverage get the non-type-aware fallback (`untypedFiles`). |
| `node`          | root, frontend                 | `eslint-plugin-n`: runtime APIs, deprecated APIs, ESM/CJS scoping.                                                                                                                                         |
| `vue`           | frontend (+ cli-init template) | Vue essential/strongly-recommended/recommended tiers + `vuejs-accessibility` (strict) + typed `<script setup>`.                                                                                            |
| `reactNextA11y` | website                        | React, Hooks, `jsx-a11y`, `@next/eslint-plugin-next` core web vitals.                                                                                                                                      |
| `test`          | all                            | Jest rules scoped to test files only (JUM-619 lesson), docker-gated and bun:test exceptions, Cypress/Mocha browser globals.                                                                                |
| `stylistic`     | all (last)                     | `eslint-config-prettier` — disables every formatting rule so ESLint and Prettier never conflict.                                                                                                           |

Consumer configs (`eslint.config.mjs` at root, `apps/frontend/`,
`apps/jumentix-website/`) only wire profiles, declares `ignores`, and attach
scoped `languageOptions.globals` — they never define rules. The `cli-init`
frontend template mirrors `apps/frontend/eslint.config.mjs` verbatim and is
guarded by `bun run cli:check-template-freshness`.

## Exception policy

- An exception is a single-line `// eslint-disable-next-line <rule> -- <reason>`,
  reviewed case by case. Whole-file and directory-wide disables are banned,
  except the established `/* eslint-disable no-console */` header in pure
  reporter scripts (CI checks that exist to print).
- Scoped rule relaxations in a consumer config (surface-specific options) must
  name the surface and the reason in a comment — see the service-management
  no-bundler runtime block in the root `eslint.config.mjs` for the pattern.
- `// @ts-expect-error` must carry a description
  (`@typescript-eslint/ban-ts-comment` with `minimumDescriptionLength: 3`).
- Fire-and-forget promises: `no-void` and `@typescript-eslint/no-floating-promises`
  are both active, so the compliant form is `expr.catch(() => undefined)` —
  never bare `void expr` and never a bare call.

## Upgrading ESLint or a plugin

1. Bump the version in `packages/config-eslint/package.json` **and** every
   consumer `package.json` (one version repo-wide — Requirement 138 §2).
2. `bun install`, then `bun run --cwd packages/config-eslint test` — the
   effective-config snapshots catch silent rule drops; review every snapshot
   diff deliberately.
3. `bun run lint` and `bun run format:check` must stay green; remediate new
   violations in the same change.

## Onboarding for a new agent

1. Read Requirement 138 first, then this guide.
2. Never edit rules inside a consumer config — profiles live in
   `packages/config-eslint/src/profiles/`.
3. Before claiming "lint is green", paste the command and its exit code
   (Requirement 130). The gate is only trustworthy because it is proven to
   fail (`ci-cd/test/run-lint.test.ts` exercises the negative fixture).
