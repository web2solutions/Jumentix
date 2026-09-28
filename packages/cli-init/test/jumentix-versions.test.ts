/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const { readPackageVersions, resolveJumentixPin } = require('../dist/generators/jumentixVersions');

function scratch(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-jumentix-versions-'));
}

function writeManifest(root: string, contents: unknown) {
  fs.writeFileSync(
    path.join(root, 'templates.manifest.json'),
    typeof contents === 'string' ? contents : JSON.stringify(contents)
  );
}

describe('readPackageVersions', () => {
  it('returns an empty map when templates.manifest.json is absent', () => {
    expect.hasAssertions();
    const root = scratch();

    expect(readPackageVersions(root)).toStrictEqual({});
  });

  it('returns the recorded packageVersions map', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { packageVersions: { '@jumentix/cana': '1.2.3' } });

    expect(readPackageVersions(root)).toStrictEqual({ '@jumentix/cana': '1.2.3' });
  });

  it('returns an empty map when packageVersions is missing from the manifest', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { otherField: true });

    expect(readPackageVersions(root)).toStrictEqual({});
  });

  it('returns an empty map when packageVersions is not an object', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { packageVersions: 'not-an-object' });

    expect(readPackageVersions(root)).toStrictEqual({});
  });

  it('returns an empty map when the manifest is not valid JSON', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, '{not json');

    expect(readPackageVersions(root)).toStrictEqual({});
  });
});

describe('resolveJumentixPin', () => {
  it('pins every package to the override, ignoring the manifest', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { packageVersions: { '@jumentix/cana': '1.2.3' } });

    const pin = resolveJumentixPin(root, '9.9.9');

    expect(pin('@jumentix/cana')).toBe('9.9.9');
    expect(pin('@jumentix/anything-unrecorded')).toBe('9.9.9');
  });

  it('resolves a recorded package to its manifest version', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { packageVersions: { '@jumentix/cana': '1.2.3' } });

    const pin = resolveJumentixPin(root);

    expect(pin('@jumentix/cana')).toBe('1.2.3');
  });

  it('fails closed for a package with no recorded version', () => {
    expect.hasAssertions();
    const root = scratch();
    writeManifest(root, { packageVersions: { '@jumentix/cana': '1.2.3' } });

    const pin = resolveJumentixPin(root);

    expect(() => pin('@jumentix/unrecorded')).toThrow(
      'No published version recorded for @jumentix/unrecorded in templates.manifest.json'
      + ' (packageVersions). Rebuild templates with `bun run cli:build-templates`.'
    );
  });
});
