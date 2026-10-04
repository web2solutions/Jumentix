import {
  configs as airbnb,
  plugins as airbnbPlugins,
  rules as airbnbRules
} from 'eslint-config-airbnb-extended';

import type { FlatConfig, ReactNextA11yProfileOptions } from '../types.js';

/**
 * React + Hooks + Next.js + accessibility profile (JUM-11) for
 * `apps/jumentix-website`.
 *
 * Non-strict is Airbnb Extended's `next.recommended`: React (101 rules),
 * `jsx-a11y` (36), `react-hooks` (17) and `@next/eslint-plugin-next` core web
 * vitals (21), covering server components, client components and `.tsx`.
 * Strict adds the Airbnb React strict rule set.
 */
export function reactNextA11y(options: ReactNextA11yProfileOptions = {}): FlatConfig[] {
  const strictParity: FlatConfig = {
    // airbnb's strict tier demands arrow-function components while its own
    // recommended tier (which this repo already follows) demands function
    // declarations. A bare 'error' re-declares the rule with the plugin's
    // default — function declarations.
    name: 'jumentix/react-strict-parity',
    rules: {
      'react/function-component-definition': 'error'
    }
  };
  return [
    airbnbPlugins.react,
    airbnbPlugins.reactA11y,
    airbnbPlugins.reactHooks,
    airbnbPlugins.next,
    airbnbPlugins.importX,
    ...airbnb.next.recommended,
    {
      // Jumentix writes every React component as .tsx — the airbnb default
      // only allows JSX in .jsx files.
      name: 'jumentix/react-tsx',
      rules: {
        'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
        // TypeScript enforces prop optionality statically and React 19
        // deprecates Component.defaultProps on function components; the
        // rule's defaultArguments mode would only force `= undefined`
        // boilerplate on genuinely optional props. Standard TS-React: off.
        'react/require-default-props': 'off'
      }
    },
    ...(options.strict ? [airbnbRules.react.strict, strictParity] : [])
  ];
}

export function reactNextA11yStrict(options: ReactNextA11yProfileOptions = {}): FlatConfig[] {
  return reactNextA11y({ ...options, strict: true });
}
