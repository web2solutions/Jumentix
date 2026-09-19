/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Build the `@jumentix/designer-core` artifact exactly once per test run, even
 * when several suites need it.
 *
 * Three suites in this package assert against `dist/`, and each builds rather
 * than branching on whether `dist` happens to exist — the cana packaging suite
 * documented why that branch reports green in a fresh clone where nothing was
 * ever built. But three builders racing `rm -rf dist` is its own failure mode
 * (Jest runs test files in parallel workers), so the build is serialized
 * through a lock directory: `mkdir` is atomic on every supported filesystem,
 * which makes it a valid cross-process mutex.
 *
 * The lock lives outside `dist/` because the build's first step is deleting
 * `dist/` — a lock inside it would be deleted mid-build by the very build it
 * is guarding. A lock abandoned by a crashed process goes stale after ten
 * minutes and is broken, so a crash degrades into one redundant build rather
 * than a permanent deadlock.
 */

const LOCK_STALE_MS = 10 * 60 * 1000;
const LOCK_RETRY_MS = 200;
const LOCK_TIMEOUT_MS = 180_000;

/**
 * One wait step behind a held lock: break it if it has gone stale, then sleep
 * a retry interval. Extracted from the acquisition loop so the loop body
 * reads as acquire-or-wait.
 */
async function waitForLockRelease(lockPath: string, deadline: number): Promise<void> {
  try {
    const stat = fs.statSync(lockPath);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      fs.rmSync(lockPath, { recursive: true, force: true });
      return;
    }
  } catch {
    // The holder released between our mkdir and stat: return immediately.
    return;
  }
  if (Date.now() > deadline) {
    throw new Error(`Timed out waiting for the designer-core build lock at ${lockPath}`);
  }
  await new Promise((resolve) => { setTimeout(resolve, LOCK_RETRY_MS); });
}

export async function ensureDesignerCoreBuilt(packageRoot: string): Promise<void> {
  const lockPath = path.join(packageRoot, '.build-lock');
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  let acquired = false;
  while (!acquired) {
    try {
      fs.mkdirSync(lockPath);
      acquired = true;
    } catch {
      // Another process holds the lock — or left it behind. A lock whose
      // holder crashed goes stale and is broken; a live one is awaited.
      // Polling is the point here: there is no event to subscribe to.
      /* eslint-disable-next-line no-await-in-loop */
      await waitForLockRelease(lockPath, deadline);
    }
  }

  try {
    execFileSync('bun', ['run', 'build'], { cwd: packageRoot, stdio: 'pipe' });
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

/**
 * The module closure the build publishes, relative to `src/` (the barrel
 * `index.js` excluded — the entry point is asserted separately).
 *
 * Derived by walking `src/`, because the package src/ IS the boundary: any
 * module placed there is package surface by definition and must land in
 * `dist/`. The DOM-free suite scans exactly this set plus the barrel, so a
 * module joining the closure joins the proof in the same commit.
 */
export function builtModuleList(packageRoot: string): string[] {
  const srcRoot = path.join(packageRoot, 'src');
  const walk = (dir: string, prefix: string): string[] => fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return walk(path.join(dir, rel), rel);
      return entry.name.endsWith('.js') && entry.name !== 'index.js' ? [rel] : [];
    });
  const modules = walk(srcRoot, '').sort((a, b) => a.localeCompare(b));
  if (modules.length === 0) throw new Error('packages/designer-core/src holds no modules');
  return modules;
}
