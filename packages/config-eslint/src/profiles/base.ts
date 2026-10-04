import {
  configs as airbnb,
  plugins as airbnbPlugins,
  rules as airbnbRules
} from 'eslint-config-airbnb-extended';

import { jumentixParity, jumentixStrictParity } from '../parity.js';

import type { BaseProfileOptions, FlatConfig } from '../types.js';

/**
 * Base profile — Airbnb Extended (flat) for JavaScript and TypeScript plus the
 * Jumentix parity layer. This is the Airbnb equivalent of the legacy
 * `airbnb-base` extends, running on ESLint 9 flat config.
 */
export function base(options: BaseProfileOptions = {}): FlatConfig[] {
  const packageDirs = options.packageDirs ?? [process.cwd()];
  return [
    airbnbPlugins.stylistic,
    airbnbPlugins.importX,
    ...airbnb.base.recommended,
    jumentixParity(packageDirs),
    ...(options.strict
      ? [airbnbRules.base.strict, airbnbRules.base.importsStrict, jumentixStrictParity]
      : [])
  ];
}

export function baseStrict(options: BaseProfileOptions = {}): FlatConfig[] {
  return base({ ...options, strict: true });
}
