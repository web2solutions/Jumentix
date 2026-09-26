import { configs as _airbnbConfigs, helpers as airbnbHelpers } from 'eslint-config-airbnb-extended';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import pluginVue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

import type { FlatConfig, VueProfileOptions } from '../types.js';

const VUE_EXTENSIONS = [
  '.vue',
  '.js',
  '.cjs',
  '.mjs',
  '.jsx',
  '.ts',
  '.cts',
  '.mts',
  '.tsx',
  '.d.ts',
  '.json'
];

/**
 * Vue 3 + accessibility profile (JUM-868) for `apps/frontend` and the
 * `cli-init` frontend template.
 *
 * Non-strict keeps the current seed green: Vue essential tier only (parity
 * with the hand-rolled config this replaces). Strict adds the
 * strongly-recommended and recommended tiers, the `vuejs-accessibility`
 * recommended set (the Vue-template equivalent of `jsx-a11y`) and type-aware
 * linting of `<script setup>` via the shared TypeScript wiring.
 *
 * `vue/multi-word-component-names` stays off on purpose: the seed ships
 * single-word SFC names (`App.vue`, `Users.vue`) as its public component
 * contract, and renaming them would break generated frontends.
 */
export function vue(options: VueProfileOptions = {}): FlatConfig[] {
  // SFC imports (@/* aliases, package specifiers) need the same resolver the
  // typescript profile wires for js/ts — .vue is just another extension here.
  const vueResolverBlock: FlatConfig | null = options.resolverProjects
    ? {
        name: 'jumentix/vue-import-resolver',
        files: ['**/*.vue'],
        settings: {
          'import-x/core-modules': ['bun', 'bun:test'],
          'import-x/resolver-next': [
            createNodeResolver({ extensions: VUE_EXTENSIONS }),
            airbnbHelpers.createAutoTypeScriptImportResolver({
              project: options.resolverProjects
            })
          ]
        },
        rules: {
          // importing a .vue module is the bundler's resolution — TS cannot
          // see it, so no-unresolved would false-positive on every SFC import.
          'import-x/no-unresolved': ['error', { ignore: ['\\.vue$'] }]
        }
      }
    : null;

  const jumentixVue: FlatConfig = {
    name: 'jumentix/vue',
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
        ...(options.strict
          ? {
              projectService: true,
              tsconfigRootDir: options.tsconfigRootDir
            }
          : {})
      }
    },
    // The airbnb import-x plugin block covers js/ts globs only — SFCs need
    // the plugin registered for their own glob so parity rules resolve.
    plugins: {
      'import-x': importX
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  };

  const a11yBlocks = (
    vueA11y as unknown as {
      configs: Record<string, FlatConfig[]>;
    }
  ).configs['flat/recommended'].map((block, index) => ({
    ...block,
    name: index === 0 ? 'jumentix/vue-a11y' : `jumentix/vue-a11y/${index}`
  }));

  return [
    ...(vueResolverBlock ? [vueResolverBlock] : []),
    ...pluginVue.configs['flat/essential'],
    ...(options.strict
      ? [
          ...pluginVue.configs['flat/strongly-recommended'],
          ...pluginVue.configs['flat/recommended'],
          ...a11yBlocks
        ]
      : []),
    jumentixVue
  ];
}

export function vueStrict(options: VueProfileOptions = {}): FlatConfig[] {
  return vue({ ...options, strict: true });
}
