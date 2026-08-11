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
 * Content entries marked `display: 'hidden'` in a `_meta` file.
 *
 * These are excluded because they 404, but the flag is **not** the reason —
 * that was my first reading and it was wrong. The docs route resolver rewrites
 * every single-segment path into the `jumentix/` subtree:
 *
 *   `app/docs/[[...mdxPath]]/page.tsx`
 *   return [alias ? ['jumentix', ...alias] : ['jumentix', ...normalized]];
 *
 * So `/docs/api` looks for `content/jumentix/api`, while the file sits at
 * `content/api.mdx`. Every top-level content file is orphaned by that rewrite,
 * hidden or not, and `content/index.mdx` with it — `/docs` is served by
 * `content/jumentix/index.mdx`, not by the top-level index.
 *
 * The `display: 'hidden'` set happens to name exactly the orphaned files today,
 * which is why filtering on it works. It is a proxy, not the cause, and it will
 * stop matching the moment someone adds a top-level page without hiding it.
 * JUM-640 carries the decision: delete the four Nextra template leftovers, and
 * decide whether `release-notes` and `versioning` — real Jumentix documentation
 * — should move into `content/jumentix/` to become reachable.
 *
 * `index` is kept in discovery because `/docs` is a real, reachable route,
 * whatever file serves it.
 */
function hiddenContentKeys(metaFile) {
  if (!fs.existsSync(metaFile)) return new Set();
  const source = fs.readFileSync(metaFile, 'utf8');
  const hidden = new Set();
  for (const match of source.matchAll(/'?([\w-]+)'?\s*:\s*\{[^{}]*display\s*:\s*'hidden'[^{}]*\}/g)) {
    if (match[1] !== 'index') hidden.add(match[1]);
  }
  return hidden;
}

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
  const hidden = hiddenContentKeys(path.join(contentRoot, '_meta.ts'));
  const docsRoutes = walk(
    contentRoot,
    (file) => /\.mdx?$/.test(file) && !/(^|[\\/])_meta\./.test(file)
  )
    .filter((file) => !hidden.has(path.basename(file).replace(/\.mdx?$/, '')))
    .map(routeFromContentFile);

  return [...new Set([...staticRoutes, ...docsRoutes])].sort();
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
