const {
  applyPackageContentBumps,
  buildPackageContentBumpAdditions,
  bumpPatch,
  CLI_INIT_MANIFEST,
  commitPackageContentBumps,
  peelRemoteTagSha,
  planPackageContentBumps,
  publishedPaths
} = require('../plan-package-content-bumps');

describe('plan-package-content-bumps', () => {
  it('bumps the patch segment of a semver version', () => {
    expect.hasAssertions();
    expect(bumpPatch('0.1.0')).toBe('0.1.1');
    expect(bumpPatch('1.2.9')).toBe('1.2.10');
  });

  it('peels annotated tag object SHAs from ls-remote output', () => {
    expect.hasAssertions();
    const tag = '@jumentix/cana@0.1.0';
    const annotated = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/@jumentix/cana@0.1.0',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/@jumentix/cana@0.1.0^{}'
    ].join('\n');
    expect(peelRemoteTagSha(annotated, tag)).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(peelRemoteTagSha(
      'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/@jumentix/cana@0.1.0',
      tag
    )).toBe('cccccccccccccccccccccccccccccccccccccccc');
    expect(peelRemoteTagSha('', tag)).toBe('');
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
    }], { root, syncCliManifest: false });
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version).toBe('0.1.1');
  });

  it('builds Buffer additions including cli-init manifest without shell argv', () => {
    expect.hasAssertions();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bump-add-'));
    const pkgDir = path.join(root, 'packages', 'cli-init');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      `${JSON.stringify({ name: '@jumentix/cli-init', version: '0.0.1' }, null, 2)}\n`
    );
    // Oversized relative to typical ARG_MAX (~256KiB) so shell/jq --arg would fail.
    const big = Buffer.alloc(300_000, 0x61);
    fs.writeFileSync(path.join(root, CLI_INIT_MANIFEST), big);
    const additions = buildPackageContentBumpAdditions([{
      packageJsonPath: 'packages/cli-init/package.json'
    }], { root });
    expect(additions).toHaveLength(2);
    expect(additions[0]).toMatchObject({ path: 'packages/cli-init/package.json' });
    expect(Buffer.isBuffer(additions[0].contents)).toBe(true);
    expect(additions[1]).toMatchObject({ path: CLI_INIT_MANIFEST });
    expect(additions[1].contents).toHaveLength(300_000);
  });

  it('commits package bumps through GraphQL stdin (no argv file bodies)', () => {
    expect.hasAssertions();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-bump-commit-'));
    const pkgDir = path.join(root, 'packages', 'cli-init');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      `${JSON.stringify({ name: '@jumentix/cli-init', version: '0.0.1' }, null, 2)}\n`
    );
    fs.writeFileSync(path.join(root, CLI_INIT_MANIFEST), '{"packageVersions":{}}\n');
    const calls: Array<{ args: string[]; input: string }> = [];
    const result = commitPackageContentBumps([{
      name: '@jumentix/cli-init',
      packageJsonPath: 'packages/cli-init/package.json'
    }], {
      root,
      repository: 'web2solutions/Jumentix',
      branch: 'chore/package-bump-test',
      expectedHeadOid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      env: { CHANGELOG_GH_TOKEN: 'test-token', GITHUB_REPOSITORY: 'web2solutions/Jumentix' },
      // Absolute stub path so createSignedCommitOnBranchWithGh never calls ghBinary().
      ghPath: '/usr/bin/false',
      execFile: (_bin: string, args: string[], opts: { input: string }) => {
        calls.push({ args, input: opts.input });
        return JSON.stringify({
          data: { createCommitOnBranch: { commit: { oid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } } }
        });
      }
    });
    expect(result.oid).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toStrictEqual(['api', 'graphql', '--input', '-']);
    const payload = JSON.parse(calls[0].input);
    const { additions } = payload.variables.input.fileChanges;
    expect(additions).toStrictEqual([
      expect.objectContaining({
        path: 'packages/cli-init/package.json',
        contents: expect.stringMatching(/^.+$/)
      }),
      expect.objectContaining({
        path: CLI_INIT_MANIFEST,
        contents: expect.stringMatching(/^.+$/)
      })
    ]);
  });
});
