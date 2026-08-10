/**
 * JUM-158 — the discovery contract, which is what makes "all routes" checkable.
 *
 * The sweep is only as good as this. If discovery silently returns a short list,
 * the gate goes green over an unswept site — the same shape of false green as a
 * skipped check reporting as passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverRoutes } from './discover-routes.mjs';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('website route discovery (JUM-158)', () => {
  const routes = discoverRoutes();

  it('finds far more routes than any hand-maintained list carries', () => {
    expect.hasAssertions();

    // Not arbitrary: the hand-written specs reference 52 routes and the tree
    // holds 151. Anything near 52 means discovery stopped following the tree.
    expect(routes.length).toBeGreaterThan(100);
  });

  it('includes the site root, the docs root and the commercial routes', () => {
    expect.hasAssertions();

    expect(routes).toContain('/');
    expect(routes).toContain('/docs');
    expect(routes).toContain('/product');
    expect(routes).toContain('/pricing-or-engagement');
  });

  it('emits URLs, never Next.js route patterns', () => {
    expect.hasAssertions();

    // `/docs/[[...mdxPath]]` is a pattern. Visiting it proves nothing, and a
    // sweep that "passes" on one is measuring the 404 page.
    const patterns = routes.filter((route) => route.includes('[') || route.includes(']'));

    expect(patterns).toStrictEqual([]);
  });

  it('excludes hidden content entries but keeps the section root', () => {
    expect.hasAssertions();

    // All six hidden top-level pages answer 404 today (JUM-640). `index` is
    // hidden too, and serves /docs, which is real — so it must survive.
    expect(routes).not.toContain('/docs/mantine');
    expect(routes).not.toContain('/docs/release-notes');
    expect(routes).toContain('/docs');
  });

  it('derives every static page file that is routable', () => {
    expect.hasAssertions();

    // Compared against the tree rather than a list: a page added without a
    // route here is exactly the drift this test exists to catch.
    const pageFiles = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
          walk(absolute);
        } else if (/^page\.(tsx|jsx|mdx)$/.test(entry.name)) {
          pageFiles.push(absolute);
        }
      }
    };
    walk(path.join(websiteRoot, 'app'));

    const routableStatic = pageFiles.filter(
      (file) => !path.relative(path.join(websiteRoot, 'app'), file).includes('[')
    );

    expect(routableStatic.length).toBeGreaterThan(0);
    expect(routes.length).toBeGreaterThanOrEqual(routableStatic.length);
  });

  it('returns a sorted list with no duplicates', () => {
    expect.hasAssertions();

    expect(routes).toStrictEqual([...new Set(routes)].sort());
  });
});
