/* eslint-disable no-console -- CLI freshness check: stdout is its report channel. */
/**
 * Screenshot freshness.
 *
 * `public/product/screenshots.json` records, per product screenshot, the
 * commit it was captured against and the source paths of the screen it shows.
 * When any of those paths changed after that commit, the screenshot may no
 * longer match the product, and this check says which one and why.
 *
 * It warns and exits 0 on staleness: whether a change is visible enough to
 * recapture is a human judgement, and an unrelated PR must not be blocked by
 * it. It fails (exit 1) only when the manifest itself is wrong — unreadable,
 * naming a missing image, an image the manifest does not list, or a commit
 * git cannot resolve — because a broken manifest silently stops the warning.
 *
 * Recapture: `bun run --filter @jumentix/website screenshots:capture`, which
 * rewrites every entry's `capturedAt` to the commit it captured.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(websiteRoot, '..', '..');
const productDir = path.join(websiteRoot, 'public', 'product');
export const MANIFEST_PATH = path.join(productDir, 'screenshots.json');

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

export const defaultIo = {
  readManifest: () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
  listImages: () => fs.readdirSync(productDir).filter((file) => file.endsWith('.png')),
  isShallow: () => git(['rev-parse', '--is-shallow-repository']) === 'true',
  commitExists: (sha) => {
    try {
      git(['cat-file', '-e', `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  },
  commitsSince: (sha, paths) => {
    const out = git(['log', '--format=%h %s', `${sha}..HEAD`, '--', ...paths]);
    return out ? out.split('\n') : [];
  }
};

export function checkScreenshotFreshness(io = defaultIo) {
  const failures = [];
  const warnings = [];
  let manifest;
  try {
    manifest = io.readManifest();
  } catch (error) {
    return { failures: [`screenshots.json is unreadable: ${error.message}`], warnings };
  }
  const entries = Array.isArray(manifest?.screenshots) ? manifest.screenshots : null;
  if (!entries) return { failures: ['screenshots.json must hold a "screenshots" array'], warnings };

  const listed = new Set(entries.map((entry) => entry.file));
  for (const image of io.listImages()) {
    if (!listed.has(image)) failures.push(`${image}: not listed in screenshots.json`);
  }
  const images = new Set(io.listImages());
  for (const entry of entries) {
    if (
      !entry.file ||
      !entry.capturedAt ||
      !Array.isArray(entry.watch) ||
      entry.watch.length === 0
    ) {
      failures.push(
        `${entry.file ?? '<unnamed>'}: needs "file", "capturedAt" and a non-empty "watch" list`
      );
      continue;
    }
    if (!images.has(entry.file)) {
      failures.push(`${entry.file}: listed in screenshots.json but missing from public/product`);
      continue;
    }
    if (!io.commitExists(entry.capturedAt)) {
      // A shallow clone may simply not hold the commit; only a full history can
      // prove the manifest wrong.
      if (io.isShallow()) {
        warnings.push(
          `${entry.file}: capturedAt ${entry.capturedAt} is outside this shallow clone; freshness not checked`
        );
      } else {
        failures.push(
          `${entry.file}: capturedAt ${entry.capturedAt} is not a commit in this repository`
        );
      }
      continue;
    }
    const commits = io.commitsSince(entry.capturedAt, entry.watch);
    if (commits.length > 0) {
      warnings.push(
        `${entry.file} may be stale — ${commits.length} commit(s) touched ${entry.watch.join(', ')} since ${entry.capturedAt}: ${commits
          .slice(0, 3)
          .join('; ')}`
      );
    }
  }
  return { failures, warnings };
}

function main() {
  const { failures, warnings } = checkScreenshotFreshness();
  warnings.forEach((warning) => console.warn(`[screenshots] WARN ${warning}`));
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`[screenshots] ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log(`[screenshots] manifest valid; ${warnings.length} screenshot(s) possibly stale.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
