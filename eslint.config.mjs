import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import globals from 'globals';

import {
  baseStrict,
  nodeStrict,
  stylistic,
  testStrict,
  typescriptStrict
} from '@jumentix/config-eslint';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Monorepo package.json roots consulted by the dependency-declaration guard:
// the root plus every workspace — an import must be declared in SOME
// workspace package.json (union semantics, matching the legacy list but
// self-maintaining). Undeclared-nowhere imports still fail.
const workspaceDirs = (scope) =>
  readdirSync(new URL(`${scope}/`, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => fileURLToPath(new URL(`${scope}/${entry.name}/`, import.meta.url)));

const packageDirs = [rootDir, ...workspaceDirs('apps'), ...workspaceDirs('packages')];

// TS trees no tsconfig covers (see the typescript profile docs).
const untypedFiles = [
  // apps/frontend test root is excluded from the app tsconfig (bun:test
  // suites, JUM-760); its cypress tree has its own tsconfig.
  'apps/frontend/test/**',
  // The website tsconfig excludes tests and cypress by design (Next.js
  // app tsconfig); they lint with the non-type-aware ruleset here.
  'apps/jumentix-website/**/*.test.ts',
  'apps/jumentix-website/**/*.test.mjs',
  'apps/jumentix-website/cypress/**',
  // Package tsconfigs include only src; test/cypress trees get the
  // non-type-aware ruleset (legacy gave them the same effective coverage).
  'packages/*/test/**',
  'packages/*/cypress/**',
  // Package example scripts are not part of any build tsconfig.
  'packages/*/examples/**',
  // Website storybook config and test utils sit outside the Next tsconfig.
  'apps/jumentix-website/.storybook/**',
  'apps/jumentix-website/test-utils/**',
  // cli-init template mirrors are byte-identical copies of the app seeds,
  // guarded by the cli:check-template-freshness gate, not by a tsconfig.
  'packages/cli-init/templates/**'
];

export default [
  {
    name: 'jumentix/root-ignores',
    ignores: [
      // Next.js generated ambient types (legacy parity).
      'apps/jumentix-website/next-env.d.ts',
      // Vendored, frozen third-party CoreUI catalog — reference only (legacy parity).
      'apps/frontend/template/**',
      // Build outputs.
      '**/dist/**',
      '**/coverage/**',
      '**/.build/**',
      'apps/jumentix-website/.next/**',
      // Vendored / generated third-party bundles (never hand-edited):
      // Swagger UI ships inside the backend OASdoc surface and the
      // service-management vendor sync; .browser-tests are generated cypress
      // bundles; _pagefind is the website's generated search index.
      'apps/backend-template/OASdoc/**',
      'apps/backend-template/AsyncAPIdoc/**',
      'apps/service-management/vendor/**',
      '.browser-tests/**',
      // Generated Pagefind search index bundle (website public assets).
      'apps/jumentix-website/public/_pagefind/**',
      // .vue SFCs are linted by apps/frontend's own flat config (vue profile);
      // website .tsx by apps/jumentix-website's own config (reactNextA11y profile).
      'apps/frontend/src/**/*.vue',
      'apps/jumentix-website/**/*.tsx',
      // config-eslint contract-test fixtures contain deliberate violations
      // (positive/negative samples per profile, JUM-14).
      'packages/config-eslint/test/fixtures/**'
    ]
  },
  ...baseStrict({ packageDirs }),
  ...typescriptStrict({
    tsconfigRootDir: rootDir,
    packageDirs,
    untypedFiles,
    // The root tsconfig declares @src/* and @jumentix/*; the app tsconfigs
    // declare their own aliases (frontend's @/*, website paths).
    resolverProjects: [
      fileURLToPath(new URL('tsconfig.json', import.meta.url)),
      fileURLToPath(new URL('apps/frontend/tsconfig.json', import.meta.url)),
      fileURLToPath(new URL('apps/frontend/tsconfig.eslint.json', import.meta.url)),
      fileURLToPath(new URL('apps/jumentix-website/tsconfig.json', import.meta.url))
    ]
  }),
  ...nodeStrict({
    noUnsupportedFeaturesOffFiles: [
      // Bun/Node-22-pinned tooling and script dirs (import.meta.main is a Bun
      // API; the monorepo runtime is Bun 1.3 + Node 22 per root engines).
      'ci-cd/**',
      'tooling/**',
      'apps/*/scripts/**',
      'packages/*/scripts/**',
      'packages/cli-init/templates/**',
      // Browser-runtime surfaces: n flags browser globals (navigator, crypto,
      // URL.createObjectURL) as experimental Node features.
      'apps/frontend/src/**',
      'apps/frontend/test/**',
      'apps/service-management/src/**',
      'apps/service-management/test/**',
      'apps/service-management/script.js'
    ]
  }),
  ...testStrict({ untypedFiles }),
  ...stylistic(),
  {
    // Next.js App Router contracts REQUIRE named exports (HTTP method
    // handlers, useMDXComponents) — same exemption as the website's own
    // config; the root run lints the app's .ts files (JUM-11 boundary).
    name: 'jumentix/website-next-contracts',
    files: [
      'apps/jumentix-website/app/**/route.ts',
      'apps/jumentix-website/app/**/route.tsx',
      'apps/jumentix-website/mdx-components.ts'
    ],
    rules: {
      'import-x/prefer-default-export': 'off'
    }
  },
  {
    // Req 138 §5 scoped relaxation — the cli-init template mirrors are
    // byte-identical copies of the app seeds; their bare specifiers (vue,
    // pinia, …) only resolve in the generated app after npm install.
    // `cli:check-template-freshness` owns their fidelity, not the resolver.
    name: 'jumentix/template-mirrors',
    files: [
      'packages/cli-init/templates/**/*.ts',
      'packages/cli-init/templates/**/*.tsx',
      'packages/cli-init/templates/**/*.js',
      'packages/cli-init/templates/**/*.mjs',
      'packages/cli-init/templates/**/*.cjs'
    ],
    rules: {
      'import-x/no-unresolved': 'off',
      // import-x/order groups by the RESOLVED path location; a mirror resolves
      // @src/* outside packages/cli-init while the seed resolves it inside
      // apps/backend-template, so the same imports classify differently.
      // Ordering fidelity belongs to the seed + freshness gate.
      'import-x/order': 'off',
      // The untyped fallback context (no projectService) also changes
      // consistent-type-imports' fix-style behavior vs the typed seed.
      '@typescript-eslint/consistent-type-imports': 'off'
    }
  },
  {
    // Browser-runtime scripts (service workers): no bundler, no Node globals.
    name: 'jumentix/browser-scripts',
    files: [
      'apps/frontend/public/sw.js',
      'apps/service-management/sw.js',
      'packages/cli-init/templates/frontend/public/sw.js'
    ],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser
      }
    }
  },
  {
    // The service-management dashboard is a hand-written browser runtime
    // (no bundler): document/window/navigator are its environment.
    name: 'jumentix/browser-service-management',
    files: [
      'apps/service-management/script.js',
      'apps/service-management/src/**/*.js',
      'apps/service-management/src/**/*.ts'
    ],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      // JUM-18 scoped override: this no-bundler runtime is built on factory
      // injection — the injected state/dom/interaction objects are mutated by
      // design (that IS the architecture of the designer/canvas runtime).
      // Direct parameter reassignment stays banned; property mutation on the
      // injected objects is allowed here and nowhere else.
      'no-param-reassign': ['error', { props: false }],
      // Same scoped override: these files organize themselves as hoisted
      // function declarations consumed by render cycles below them; forcing
      // definition order would permute ~60-function modules for zero gain.
      'no-use-before-define': ['error', { functions: false }]
    }
  }
];
