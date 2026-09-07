import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      'template/**',
      '.claude/**',
      '.openclaude/**',
      '.wwebjs_auth/**',
      '.wwebjs_cache/**',
      'exports/**',
      'node_modules/**',
      'eslint.config.mjs',
    ],
  },
  ...eslintPluginVue.configs['flat/essential'],
  {
    files: ['src/**/*.{ts,vue}', 'vite.config.mjs'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        extraFileExtensions: ['.vue'],
        parser: tsParser,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
]
