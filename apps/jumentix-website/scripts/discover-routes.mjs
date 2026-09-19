#!/usr/bin/env bun
/**
 * JUM-158 — enumerate every public route from the tree, not from a hand-list.
 *
 * The acceptance criterion is "all public routes are discovered and exercised".
 * A hard-coded array cannot satisfy that: it covers the site on the day it is
 * written and silently stops the first time somebody adds a page.
 *
 * The existing specs are not neglect — they reference 52 distinct routes with
 * real content assertions. But 151 routes exist, so 99 were never requested,
 * and every one of the 52 had to be typed by hand.
 *
 * Two sources, because the site has two:
 *
 *  - `app/**\/page.tsx` for static routes. Dynamic segments (`[slug]`,
 *    `[[...mdxPath]]`) are deliberately excluded here — a route pattern is not
 *    a URL, and visiting `/docs/[[...mdxPath]]` proves nothing.
 *  - `content/**\/*.mdx` for the documentation routes those catch-alls serve,
 *    which is where the real URLs live.
 *
 * Exported as a function so tests can assert on the discovery itself, and
 * runnable so `--json` can feed Cypress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A segment Next.js fills at request time: `[slug]`, `[...rest]`, `[[...opt]]`. */
const isDynamicSegment = (segment) => segment.startsWith('[');

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(absolute, predicate, out);
      continue;
    }
    if (predicate(absolute)) out.push(absolute);
  }
  return out;
}

/**
 * Route groups — `(marketing)` — organise files without appearing in the URL,
 * and private folders — `_components` — are not routable at all.
 */
function routeFromPageFile(absolute) {
  const relative = path.relative(path.join(websiteRoot, 'app'), absolute);
  const segments = path.dirname(relative).split(path.sep).filter((s) => s && s !== '.');
  if (segments.some((s) => s.startsWith('_'))) return null;
  if (segments.some(isDynamicSegment)) return null;
  const visible = segments.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return `/${visible.join('/')}`.replace(/\/+$/, '') || '/';
}

/**
 * `/docs` with no segments, which no content path spells.
 *
 * The resolver answers the bare route from the `jumentix/` index:
 *
 *   `app/docs/[[...mdxPath]]/page.tsx`
 *   if (normalized.length === 0) return [['jumentix']];
 *
 * so `content/jumentix/index.mdx` maps to `/docs/jumentix` by the rule below
 * and `/docs` would be discovered by nothing. It is the site's most-visited
 * documentation URL, so it is named here rather than left out.
 *
 * Until JUM-640 this list was instead filtered by `display: 'hidden'` in
 * `content/_meta.ts`, which happened to name the seven orphaned top-level files
 * — a proxy for the real cause (the rewrite above), and one that would have
 * stopped matching the first time somebody added a top-level page without
 * hiding it. Those files are gone; `apps/jumentix-website/scripts/check-content-routes.js` now
 * asks the reachability question directly, on every content file.
 */
const RESOLVER_ONLY_ROUTES = ['/docs'];

/** `content/foo/bar.mdx` serves `/docs/foo/bar`; `index.mdx` serves the parent. */
function routeFromContentFile(absolute) {
  const relative = path.relative(path.join(websiteRoot, 'content'), absolute);
  const withoutExtension = relative.replace(/\.mdx?$/, '');
  const segments = withoutExtension.split(path.sep).filter(Boolean);
  if (segments[segments.length - 1] === 'index') segments.pop();
  return `/docs/${segments.join('/')}`.replace(/\/+$/, '') || '/docs';
}

export function discoverRoutes() {
  const staticRoutes = walk(
    path.join(websiteRoot, 'app'),
    (file) => /(^|[\\/])page\.(tsx|jsx|mdx)$/.test(file)
  )
    .map(routeFromPageFile)
    .filter(Boolean);

  const contentRoot = path.join(websiteRoot, 'content');
  const docsRoutes = walk(
    contentRoot,
    (file) => /\.mdx?$/.test(file) && !/(^|[\\/])_meta\./.test(file)
  ).map(routeFromContentFile);

  return [...new Set([...staticRoutes, ...docsRoutes, ...RESOLVER_ONLY_ROUTES])]
    .sort((a, b) => a.localeCompare(b));
}

if (import.meta.main) {
  const routes = discoverRoutes();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(routes, null, 2)}\n`);
  } else {
    routes.forEach((route) => process.stdout.write(`${route}\n`));
    process.stdout.write(`\n${routes.length} routes\n`);
  }
}
