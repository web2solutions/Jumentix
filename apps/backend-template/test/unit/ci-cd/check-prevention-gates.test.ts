/* eslint-disable @typescript-eslint/no-var-requires */

// Imported rather than required so this file is a module: two `fs`/`path`
// declarations at global scope collide across the ci-cd suites (TS2451), and
// that only surfaces when the whole set compiles together.
import gateFs from 'fs';
import gateOs from 'os';
import gatePath from 'path';

const {
  sourceExports,
  validatePackageBuilds
} = require('../../../../../ci-cd/check-package-build-freshness');
const {
  ACCEPTED_UNREACHABLE,
  isReachable,
  validateWebsiteContentRoutes
} = require('../../../../../ci-cd/check-website-content-routes');

const repoRoot = gatePath.resolve(__dirname, '../../../../..');

/**
 * Requirement 131 — a stale build loads cleanly and is missing only the newest
 * names, which is why `require()` succeeding proves nothing.
 */
describe('package build freshness (JUM-655, Requirement 131)', () => {
  it('reads the export forms these barrels actually use', () => {
    expect.hasAssertions();

    const names = sourceExports([
      'export { createRtdbClient, publishProgress } from \'./rtdb\';',
      'export { internal as publicName } from \'./x\';',
      'export type { OnlyAType } from \'./types\';',
      'export async function heartbeat() {}',
      'export const registryPath = 1;',
      'export class AgentRegistry {}'
    ].join('\n'));

    expect(names).toStrictEqual(expect.arrayContaining([
      'createRtdbClient', 'publishProgress', 'publicName', 'heartbeat', 'registryPath', 'AgentRegistry'
    ]));
    // Erased at runtime, so it can never appear in the built output. Asserting
    // on it would make the gate fail on every correctly built package.
    expect(names).not.toContain('OnlyAType');
  });

  it('passes against the repository as built', () => {
    expect.hasAssertions();

    expect(validatePackageBuilds(repoRoot)).toStrictEqual([]);
  });

  it('fails when a built entrypoint drops an export, naming it', () => {
    expect.hasAssertions();

    const root = gateFs.mkdtempSync(gatePath.join(gateOs.tmpdir(), 'jum655-build-'));
    const pkg = gatePath.join(root, 'packages', 'sample');
    gateFs.mkdirSync(gatePath.join(pkg, 'src'), { recursive: true });
    gateFs.mkdirSync(gatePath.join(pkg, 'dist'), { recursive: true });
    gateFs.writeFileSync(
      gatePath.join(pkg, 'package.json'),
      JSON.stringify({ name: '@jumentix/sample', main: 'dist/index.js' })
    );
    gateFs.writeFileSync(
      gatePath.join(pkg, 'src', 'index.ts'),
      'export { createRtdbClient, stillHere } from \'./x\';\n'
    );
    // The JUM-654 shape exactly: valid module, one export short.
    gateFs.writeFileSync(gatePath.join(pkg, 'dist', 'index.js'), 'exports.stillHere = 1;\n');

    const failures = validatePackageBuilds(root);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('createRtdbClient');
    expect(failures[0]).toContain('rebuild the package');

    gateFs.rmSync(root, { recursive: true, force: true });
  });

  it('stays quiet about a package that was never built', () => {
    expect.hasAssertions();

    // A different problem with its own remedy. Failing here would make the gate
    // red on every fresh clone, which teaches people to ignore it.
    const root = gateFs.mkdtempSync(gatePath.join(gateOs.tmpdir(), 'jum655-unbuilt-'));
    const pkg = gatePath.join(root, 'packages', 'sample');
    gateFs.mkdirSync(gatePath.join(pkg, 'src'), { recursive: true });
    gateFs.writeFileSync(
      gatePath.join(pkg, 'package.json'),
      JSON.stringify({ name: '@jumentix/sample', main: 'dist/index.js' })
    );
    gateFs.writeFileSync(gatePath.join(pkg, 'src', 'index.ts'), 'export { a } from \'./x\';\n');

    expect(validatePackageBuilds(root)).toStrictEqual([]);

    gateFs.rmSync(root, { recursive: true, force: true });
  });
});

/**
 * Requirement 132 — an artifact that exists, is committed and cannot be reached
 * is worse than a missing one: nothing reports it and its author believes it
 * shipped.
 */
describe('website content reachability (JUM-655, Requirement 132)', () => {
  it('mirrors the resolver: only jumentix/ and pt-BR/jumentix/ are servable', () => {
    expect.hasAssertions();

    expect(isReachable(gatePath.join('jumentix', 'reference', 'errors-responses.mdx'))).toBe(true);
    expect(isReachable(gatePath.join('pt-BR', 'jumentix', 'index.mdx'))).toBe(true);
    // The seven orphans: the resolver rewrites `/docs/api` to `jumentix/api`.
    expect(isReachable('api.mdx')).toBe(false);
    expect(isReachable('release-notes.mdx')).toBe(false);
  });

  it('passes against the repository, with the orphans declared', () => {
    expect.hasAssertions();

    expect(validateWebsiteContentRoutes(repoRoot)).toStrictEqual([]);
    expect(ACCEPTED_UNREACHABLE).toHaveLength(7);
    const declared = ACCEPTED_UNREACHABLE as Array<{ issue: string }>;

    expect(declared.every((entry) => Boolean(entry.issue))).toBe(true);
  });

  it('fails an unreachable file that nobody declared', () => {
    expect.hasAssertions();

    const root = gateFs.mkdtempSync(gatePath.join(gateOs.tmpdir(), 'jum655-content-'));
    const content = gatePath.join(root, 'apps/jumentix-website/content');
    gateFs.mkdirSync(gatePath.join(content, 'jumentix'), { recursive: true });
    gateFs.writeFileSync(gatePath.join(content, 'jumentix', 'index.mdx'), '# ok\n');
    gateFs.writeFileSync(gatePath.join(content, 'brand-new-page.mdx'), '# orphan\n');

    const failures = validateWebsiteContentRoutes(root);
    const orphan = failures.filter((f: string) => f.includes('brand-new-page.mdx'));

    expect(orphan).toHaveLength(1);
    expect(orphan[0]).toContain('cannot be served');

    gateFs.rmSync(root, { recursive: true, force: true });
  });

  it('fails a register entry whose file is gone', () => {
    expect.hasAssertions();

    // The direction registers usually miss. A stale exemption hides the next
    // real one, so it has to be as loud as a missing entry.
    const root = gateFs.mkdtempSync(gatePath.join(gateOs.tmpdir(), 'jum655-stale-'));
    const content = gatePath.join(root, 'apps/jumentix-website/content');
    gateFs.mkdirSync(gatePath.join(content, 'jumentix'), { recursive: true });
    gateFs.writeFileSync(gatePath.join(content, 'jumentix', 'index.mdx'), '# ok\n');

    const failures = validateWebsiteContentRoutes(root);

    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f: string) => f.includes('no longer exists'))).toBe(true);

    gateFs.rmSync(root, { recursive: true, force: true });
  });
});
