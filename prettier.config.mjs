// Jumentix formatting authority (JUM-13): Prettier owns every formatting
// decision; ESLint never fights it (eslint-config-prettier closes every
// @jumentix/config-eslint consumer array). These options encode the style
// the legacy .eslintrc.js enforced — single quotes, semicolons, no trailing
// commas — so the migration diff is mechanical, not a style change.
export default {
  singleQuote: true,
  semi: true,
  trailingComma: 'none',
  printWidth: 100,
  tabWidth: 2,
  overrides: [
    {
      // YAML double-quoted scalars are load-bearing: text gates match
      // `cron: "17 3 * * *"` verbatim (ci-cd/check-ci-provider.js).
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: false
      }
    }
  ]
};
