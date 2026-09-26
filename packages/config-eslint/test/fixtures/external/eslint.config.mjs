import { base, stylistic, typescript } from '@jumentix/config-eslint';

export default [
  ...base(),
  ...typescript({
    tsconfigRootDir: import.meta.dirname,
    untypedFiles: ['src/**']
  }),
  ...stylistic()
];
