/**
 * The screenshot freshness contract: stale captures warn, a broken manifest
 * fails. A manifest that silently stops matching the images would turn the
 * warning off without anyone noticing, so every way it can drift is a failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkScreenshotFreshness, defaultIo } from './check-screenshot-freshness.mjs';

const productDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'product');

function fakeIo({
  manifest = { screenshots: [{ file: 'a.png', capturedAt: 'abc123', watch: ['apps/x/src'] }] },
  images = ['a.png'],
  commits = {},
  known = ['abc123'],
  shallow = false,
} = {}) {
  return {
    readManifest: () => {
      if (manifest instanceof Error) throw manifest;
      return manifest;
    },
    listImages: () => images,
    isShallow: () => shallow,
    commitExists: (sha) => known.includes(sha),
    commitsSince: (sha) => commits[sha] ?? [],
  };
}

describe('screenshot freshness', () => {
  it('passes quietly when nothing watched changed since the capture', () => {
    expect.hasAssertions();

    expect(checkScreenshotFreshness(fakeIo())).toStrictEqual({ failures: [], warnings: [] });
  });

  it('warns, without failing, when a watched path changed after the capture', () => {
    expect.hasAssertions();

    const result = checkScreenshotFreshness(fakeIo({ commits: { abc123: ['d4e5f6 fix(x): new toolbar'] } }));

    expect(result.failures).toStrictEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('a.png may be stale');
    expect(result.warnings[0]).toContain('d4e5f6 fix(x): new toolbar');
  });

  it('fails when an image on disk is missing from the manifest', () => {
    expect.hasAssertions();

    const result = checkScreenshotFreshness(fakeIo({ images: ['a.png', 'b.png'] }));

    expect(result.failures).toStrictEqual(['b.png: not listed in screenshots.json']);
  });

  it('fails when the manifest lists an image that does not exist', () => {
    expect.hasAssertions();

    const result = checkScreenshotFreshness(fakeIo({ images: [] }));

    expect(result.failures).toStrictEqual(['a.png: listed in screenshots.json but missing from public/product']);
  });

  it('fails on an entry without a watch list', () => {
    expect.hasAssertions();

    const manifest = { screenshots: [{ file: 'a.png', capturedAt: 'abc123', watch: [] }] };
    const result = checkScreenshotFreshness(fakeIo({ manifest }));

    expect(result.failures[0]).toContain('needs "file", "capturedAt" and a non-empty "watch" list');
  });

  it('fails on an unknown commit in a full clone and only warns in a shallow one', () => {
    expect.hasAssertions();

    expect(checkScreenshotFreshness(fakeIo({ known: [] })).failures).toStrictEqual([
      'a.png: capturedAt abc123 is not a commit in this repository',
    ]);

    const shallow = checkScreenshotFreshness(fakeIo({ known: [], shallow: true }));

    expect(shallow.failures).toStrictEqual([]);
    expect(shallow.warnings[0]).toContain('outside this shallow clone');
  });

  it('fails on an unreadable manifest or one without a screenshots array', () => {
    expect.hasAssertions();

    expect(checkScreenshotFreshness(fakeIo({ manifest: new Error('boom') })).failures).toStrictEqual([
      'screenshots.json is unreadable: boom',
    ]);
    expect(checkScreenshotFreshness(fakeIo({ manifest: {} })).failures).toStrictEqual([
      'screenshots.json must hold a "screenshots" array',
    ]);
  });

  it('lists every product image in the committed manifest', () => {
    expect.hasAssertions();

    const images = fs.readdirSync(productDir).filter((file) => file.endsWith('.png')).sort();
    const listed = defaultIo.readManifest().screenshots.map((entry) => entry.file).sort();

    expect(listed).toStrictEqual(images);
  });
});
