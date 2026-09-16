/**
 * Double for `nextra-theme-docs` (JUM-728).
 *
 * The theme package is ESM-only and its transitive graph does not load under
 * jsdom, so a suite that renders a component importing it fails at resolution
 * rather than at anything the suite is testing. `MDXMonacoPre` needs exactly one
 * thing from the theme — the `pre` it delegates shell fences to — so the double
 * provides a `pre` that keeps the props (the copy attribute among them) and the
 * highlighted children, which is the contract the component depends on.
 *
 * The real theme `pre`, including its copy button, is exercised by the Cypress
 * suites against a real build.
 */
import type { HTMLAttributes } from 'react';

function ThemePre(props: HTMLAttributes<HTMLPreElement>) {
  return <pre data-nextra-theme-pre="" {...props} />;
}

export function useMDXComponents(components?: Record<string, unknown>) {
  return { pre: ThemePre, ...components };
}
