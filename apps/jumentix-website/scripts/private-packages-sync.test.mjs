/**
 * JUM-680: no import of `bun:test`.
 *
 * The website's suites run under its own Jest config, and this one imported
 * Bun's test module — so it failed to load and had never run. Nothing noticed,
 * because the website's suites were absent from `test-map.json` entirely.
 * `describe`, `it` and `expect` come from the runner's globals, as they do in
 * every sibling here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function isPrivate(pkgDir) {
  const meta = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  return Boolean(meta.private);
}

const NEVER = new Set([
  'config-eslint', 'config-jest', 'config-ts', 'agent-registry', 'security-scanner', 'cli-init'
]);

describe('public site package policy', () => {
  it('marks config-eslint private and deny-listed', () => {
    expect.hasAssertions();
    expect(isPrivate(path.join(root, 'packages/config-eslint'))).toBe(true);
    expect(NEVER.has('config-eslint')).toBe(true);
  });

  it('keeps cana publishable (not private)', () => {
    expect.hasAssertions();
    expect(isPrivate(path.join(root, 'packages/cana'))).toBe(false);
  });

  it('generated content has no deny-listed package pages', () => {
    expect.hasAssertions();
    const dir = path.join(root, 'apps/jumentix-website/content/jumentix/packages');
    for (const slug of NEVER) {
      expect(fs.existsSync(path.join(dir, `${slug}.mdx`))).toBe(false);
      expect(fs.existsSync(path.join(dir, slug))).toBe(false);
    }
  });
});
