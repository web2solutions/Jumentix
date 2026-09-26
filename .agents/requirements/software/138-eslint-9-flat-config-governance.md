# 138 - ESLint 9 Flat Configuration Governance

- Status: Active
- Nature: NFR (tooling, CI/CD, governance)
- Source: Linear epic "Adopt Airbnb Extended ESLint 9 Flat Configuration"
  (JUM-5…JUM-21, JUM-44, JUM-866…JUM-869), 2026-09-23.
- Relates to: `065` (fail-closed gates), `112` (every package owns its suite),
  `124` (workspace ownership), `130` (measured claims), `137` (suite and
  tooling ownership placement).

## Requirement

1. **One shared flat-config source.** `@jumentix/config-eslint`
   (`packages/config-eslint`) is the only place ESLint rules are defined in
   this repository. Root, `apps/frontend`, `apps/jumentix-website` and the
   `cli-init` frontend template import its profiles (`base`, `typescript`,
   `node`, `vue`, `reactNextA11y`, `test`, `stylistic`, and their `*Strict`
   variants). No workspace may keep an independent hand-rolled ESLint config:
   every `eslint.config.*` file composes the shared profiles; workspace-local
   blocks are limited to `ignores` and `languageOptions.globals` wiring, each
   with a one-line justification comment.

2. **One pinned ESLint major.** Every workspace runs the same ESLint version
   (9.x), pinned in each `package.json`; `deps:check-overrides` and
   `bun install --frozen-lockfile` must stay green with zero peer-dependency
   warnings in the ESLint family.

3. **Prettier is the sole formatting authority.** Formatting is owned by
   `prettier.config.mjs` and enforced by `bun run format:check`. ESLint never
   fights Prettier: `eslint-config-prettier` closes every consumer's
   flat-config array, `eslint-plugin-prettier` is banned, and formatting-only
   changes land in their own commits, never mixed into behavior fixes.

4. **Zero-warning gates with false-green proof.** Every `lint` invocation
   (root, frontend, website) runs with `--max-warnings=0`. A lint or format
   gate must be proven to fail: an empty file-discovery glob is a hard
   failure, not "0 problems"; file counts are reported per run so shrinking
   coverage is visible; no `|| true` or swallowed exit code exists anywhere in
   the gate chain (`ci-cd/check-lint-coverage.js` and the
   `ci-cd/test/run-lint*.test.ts` negative fixtures enforce this).

5. **Exception policy.** An exception to an active rule is a narrowly scoped
   `// eslint-disable-next-line <rule> -- <reason>` with a one-line reason,
   reviewed case by case. Whole-file and directory-wide disables are banned
   except the established `/* eslint-disable no-console */` header in pure
   reporter scripts. Scoped rule relaxations (surface-specific rule options in
   a consumer config) must name the surface and the reason in a comment.

6. **Contract tests.** `@jumentix/config-eslint` owns its contract suite
   (positive/negative fixtures per profile, effective-config snapshots,
   export resolution, empty-glob detection, external-consumption fixture).
   A profile change that drops a rule or empties a glob fails the suite
   (`bun run --cwd packages/config-eslint test`, Requirement 112).

## Enforcement

- `bun run lint` / `bun run format:check` — repository-wide, zero warnings.
- `bun run ci:gate` — chains the above plus `packages:check-suites`,
  `packages:check-build-freshness` and `cli:check-template-freshness`.
- `bun run requirements:check` — registry and ledger consistency.
