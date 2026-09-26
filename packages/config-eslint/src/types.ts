import type { Linter } from 'eslint';

export type FlatConfig = Linter.Config;

export interface BaseProfileOptions {
  /** Enable the strict variant (Airbnb strict sets + the six JUM-44 legacy rules). */
  strict?: boolean;
  /**
   * Repository roots used by `import-x/no-extraneous-dependencies` to decide
   * which package.json declares a dependency. Defaults to the consumer cwd.
   */
  packageDirs?: string[];
}

export interface TypeScriptProfileOptions {
  strict?: boolean;
  /** Consumer config directory (pass `import.meta.dirname`) for tsconfig resolution. */
  tsconfigRootDir?: string;
  /**
   * Same packageDir list as the base profile. The airbnb typescript import-x
   * block re-declares `import-x/no-extraneous-dependencies` without
   * `packageDir`; when provided, the Jumentix options are re-asserted here.
   */
  packageDirs?: string[];
  /**
   * TS trees no tsconfig covers (test roots excluded from their workspace
   * tsconfig, template mirrors, scripts). They receive the full
   * non-type-aware TypeScript ruleset; type-aware rules stay off there.
   */
  untypedFiles?: string[];
  /** Extra extensions parsed as TypeScript (e.g. `['.vue']`). */
  extraFileExtensions?: string[];
  /** File globs the type-aware wiring applies to. */
  files?: string[];
  /**
   * tsconfig set handed to eslint-import-resolver-typescript (JUM-12).
   * When set, the resolver checks these projects for path aliases instead of
   * only the nearest tsconfig — required for `@src/*` and `@jumentix/*`.
   */
  resolverProjects?: string[];
}

export interface NodeProfileOptions {
  strict?: boolean;
  /**
   * Surfaces where `n/no-unsupported-features/node-builtins` misfires (Bun
   * runtime APIs, browser code, script dirs pinned to the Bun/Node floor).
   */
  noUnsupportedFeaturesOffFiles?: string[];
}

export interface VueProfileOptions {
  strict?: boolean;
  tsconfigRootDir?: string;
  /** Same tsconfig set as the typescript profile — wires import resolution for SFCs. */
  resolverProjects?: string[];
}

export interface ReactNextA11yProfileOptions {
  strict?: boolean;
}

export interface TestProfileOptions {
  strict?: boolean;
  /** Docker-gated integration suite globs (default root-relative). */
  integrationFiles?: string[];
  /** bun:test suite globs for apps/frontend (pass app-relative when consumed per-app). */
  frontendTestFiles?: string[];
  /** Cypress/Mocha browser suite globs. */
  cypressFiles?: string[];
  /** Restify legacy allow-list block — only meaningful for the root consumer. */
  restifyAllowList?: boolean;
  /** Trees no tsconfig covers — type-aware jest rules stay off there. */
  untypedFiles?: string[];
}

export interface StylisticProfileOptions {
  strict?: boolean;
}
