/**
 * Dependency vulnerability audit (JUM-540).
 *
 * Runs the first-party OSV scanner over the resolved tree as an explicit gate step
 * rather than as a `bun install` hook, and this is a limitation worth recording
 * rather than hiding:
 *
 *   Bun refuses to install when the scanner named in `[install.security]` is not
 *   already installed — `SecurityScannerNotInDependencies`. For a workspace-local
 *   scanner that is circular, and it was measured: with the scanner wired into
 *   bunfig, `bun install` on a tree with no node_modules exits 1. That is exactly
 *   what CI does on every run, so the install hook is unusable until the scanner is
 *   a published package.
 *
 *   Wired into bunfig on a warm tree it works and is fast: "Scanning 2139 packages
 *   took 3668ms". So the hook is the right destination once the package is
 *   published; publishing is a release decision (Req 070), not this task's.
 *
 * As a gate step the blocking property is preserved where it matters: the gate
 * fails, so the PR fails. It is the install itself that is no longer guarded.
 *
 * Reads the resolved set from the isolated store, which is the tree actually
 * installed — not a compatibility lockfile translation or partial dependency view.
 */

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePackages } from './src/index.js';

const repoRoot = process.cwd();
const storeDir = join(repoRoot, 'node_modules', '.bun');

/**
 * Recover `name@version` from isolated-store directory names.
 *
 * Bun encodes them as `name@version+hash`, and scoped packages arrive as
 * `@scope+name@version`, so the split has to be on the last `@` and the scope
 * separator restored.
 */
function readResolvedPackages() {
  if (!existsSync(storeDir)) {
    throw new Error(
      `Cannot audit: ${storeDir} does not exist. Run \`bun install\` first — auditing `
        + 'a tree that was never resolved would report a clean result for an empty set.',
    );
  }

  const packages = [];
  for (const entry of readdirSync(storeDir)) {
    if (entry.startsWith('.')) continue;
    const at = entry.lastIndexOf('@');
    if (at <= 0) continue;

    const name = entry.slice(0, at).replace(/^([^+]+)\+/, '@$1/');
    const version = entry.slice(at + 1).split('+')[0];
    if (/^\d/.test(version)) packages.push({ name, version });
  }
  return packages;
}

const packages = readResolvedPackages();
if (packages.length === 0) {
  console.error('Cannot audit: the resolved store is empty. Refusing to report a clean audit.');
  process.exit(1);
}

console.log(`[deps:audit] scanning ${packages.length} resolved packages via OSV.dev`);
const advisories = await evaluatePackages(packages);

const fatal = advisories.filter((entry) => entry.level === 'fatal');
const warn = advisories.filter((entry) => entry.level !== 'fatal');

for (const advisory of [...fatal, ...warn]) {
  const marker = advisory.level === 'fatal' ? 'FATAL' : 'WARN ';
  console.log(`  ${marker}  ${advisory.package}`);
  console.log(`         ${advisory.description}`);
  console.log(`         ${advisory.url}`);
}

if (advisories.length === 0) {
  console.log('[deps:audit] no blocking advisories.');
  process.exit(0);
}

console.error(
  `\n[deps:audit] ${fatal.length} fatal and ${warn.length} warning advisory(ies). `
    + 'Raise the pin, or record the advisory id in ACCEPTED_RISK with an expiry and a reason.',
);
process.exit(1);
