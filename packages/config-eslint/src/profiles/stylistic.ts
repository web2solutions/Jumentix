import prettierCompat from 'eslint-config-prettier';

import type { FlatConfig, StylisticProfileOptions } from '../types.js';

/**
 * Stylistic profile (JUM-13) — Prettier is the sole formatting authority in
 * the Jumentix monorepo. This profile carries `eslint-config-prettier` (every
 * formatting rule ESLint could fight Prettier over, disabled, including the
 * `@stylistic/*` set from the Airbnb Extended stylistic config) plus the few
 * code-structure rules Prettier does not own.
 *
 * It must be the LAST block of every consumer's flat-config array so nothing
 * re-enables a formatting rule after it. There is deliberately no
 * `eslint-plugin-prettier`: Prettier never runs as an ESLint rule.
 */
export function stylistic(_options: StylisticProfileOptions = {}): FlatConfig[] {
  return [
    {
      name: 'jumentix/stylistic-prettier-compat',
      rules: {
        ...prettierCompat.rules
      }
    }
  ];
}

export function stylisticStrict(options: StylisticProfileOptions = {}): FlatConfig[] {
  return stylistic(options);
}
