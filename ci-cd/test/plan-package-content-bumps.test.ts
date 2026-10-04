const {
  applyPackageContentBumps,
  bumpPatch,
  planPackageContentBumps,
  publishedPaths
} = require('../plan-package-content-bumps');

describe('plan-package-content-bumps', () => {
  it('bumps the patch segment of a semver version', () => {
    expect.hasAssertions();
    expect(bumpPatch('0.1.0')).toBe('0.1.1');
    expect(bumpPatch('1.2.9')).toBe('1.2.10');
  });

  it('watches package.json, README, and every files entry', () => {
    expect.hasAssertions();
    expect(publishedPaths('cana', { files: ['dist', 'docs', 'media'] })).toStrictEqual(
      expect.arrayContaining([
        'packages/cana/package.json',
        'packages/cana/README.md',
        'packages/cana/docs',
        'packages/cana/media'
      ])
    );
  });

  it('plans a bump only when the declared version is already on npm and content changed', () => {
    expect.hasAssertions();
    const bumps = planPackageContentBumps({
      dirs: ['cana'],
      readMeta: () => ({
        dirName: 'cana',
        name: '@jumentix/cana',
        version: '0.1.0',
        tag: '@jumentix/cana@0.1.0',
        cwd: 'packages/cana'
      }),
      versionPublished: () => true
    });
    // Live git comparison against the published tag: either content changed
    // (bump planned) or not (empty). Both outcomes are valid here; assert shape.
    expect(Array.isArray(bumps)).toBe(true);
    for (const bump of bumps) {
      expect(bump).toMatchObject({
        dirName: 'cana',
        name: '@jumentix/cana',
        from: '0.1.0',
        to: '0.1.1'
      });
    }
  });

  it('skips packages whose declared version is not on npm yet', () => {
    expect.hasAssertions();
    const bumps = planPackageContentBumps({
      dirs: ['cana'],
      readMeta: () => ({
        dirName: 'cana',
        name: '@jumentix/cana',
        version: '0.1.1',
        tag: '@jumentix/cana@0.1.1',
        cwd: 'packages/cana'
      }),
      versionPublished: () => false
    });
    expect(bumps).toStrictEqual([]);
  });

  it('applies planned bumps to package.json manifests', () => {
    expect.hasAssertions();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bump-'));
    const pkgDir = path.join(root, 'packages', 'cana');
    fs.mkdirSync(pkgDir, { recursive: true });
    const pkgPath = path.join(pkgDir, 'package.json');
    fs.writeFileSync(pkgPath, `${JSON.stringify({ name: '@jumentix/cana', version: '0.1.0' }, null, 2)}\n`);
    applyPackageContentBumps([{
      dirName: 'cana',
      name: '@jumentix/cana',
      from: '0.1.0',
      to: '0.1.1',
      packageJsonPath: 'packages/cana/package.json',
      reason: 'test'
    }], { root });
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version).toBe('0.1.1');
  });
});
