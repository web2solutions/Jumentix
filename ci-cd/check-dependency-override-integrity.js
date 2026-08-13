/**
 * Dependency override integrity guard.
 *
 * Every override in this repository exists because a CVE or an incompatibility
 * demanded it. Losing one is a *silent security regression*, not a build
 * failure — nothing breaks, the vulnerable transitive version simply comes
 * back. That asymmetry is why this guard exists and why it fails closed.
 *
 * Original purpose (JUM-537) was to detect `bun install` mutating the
 * pnpm-managed tree: the JUM-23 baseline recorded that it dropped
 * `pnpm.patchedDependencies` and merged pnpm-scoped selectors such as
 * `restify>find-my-way` into npm's `overrides`, a form npm rejects with
 * EINVALIDTAGNAME. Once the migration completes there is no pnpm tree left to
 * mutate, so the guard protects the thing that actually still matters: that the
 * full set of security pins survived translation and stays present.
 *
 * The baseline below is frozen from the pre-migration state, which was spread
 * across three disagreeing surfaces:
 *
 *   - pnpm-workspace.yaml `overrides`      — 22 entries (15 flat + 7 nested)
 *   - package.json `pnpm.overrides`        — 2 entries
 *   - package.json `overrides` (npm form)  — 10 entries, flat only
 *
 * Nested selectors were converted to flat pins. That does not widen exposure:
 * a flat override applies to every dependent, which is strictly stronger than
 * pinning one dependent. Six of the seven nested selectors already had an
 * identical flat pin in force, so their behaviour is unchanged. The seventh,
 * `cassandra-driver>adm-zip`, had no flat equivalent and became one.
 *
 * `postcss` was the one genuine conflict: ^8.5.18 in two places, ^8.5.23 in
 * `pnpm.overrides`. Resolved to ^8.5.23 — the higher floor. Both ranges admit
 * 8.5.23, so the only difference is the minimum, and taking the lower value
 * would have quietly relaxed a security floor.
 */

const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

/**
 * Frozen pre-migration security baseline. Keys are package names; values are
 * the minimum acceptable range. Changing an entry is a deliberate act that
 * belongs in a reviewed commit with the CVE or incompatibility that justifies
 * it — never a side effect of a lockfile refresh.
 */
const REQUIRED_OVERRIDES = {
  'form-data': '^4.0.4',
  uuid: '^11.1.1',
  // Raised on 2026-08-11: GHSA-5p4m-2wfm-xmqj has no 4.x backport.
  'js-yaml': '^5.2.3',
  send: '^1.2.0',
  ws: '^8.18.3',
  tar: '^7.5.17',
  'find-my-way': '^9.7.0',
  // Raised on 2026-08-11: postcss 8.5.26 lifts nanoid to the fixed 3.3.17+ line.
  postcss: '^8.5.26',
  nanoid: '^3.3.18',
  // Raised on 2026-08-11: GHSA-7p8r-x3mc-p8w7 affects fast-uri 3.x.
  'fast-uri': '^4.1.2',
  svgo: '^4.0.2',
  'fast-xml-parser': '^5.10.1',
  'shell-quote': '^1.9.0',
  // Raised from ^2.1.2 on 2026-07-30 and again on 2026-08-11:
  // GHSA-rgw5-rvv9-x895 affects 5.0.8. Found by the
  // first-party OSV scanner, including the complete transitive dependency tree.
  'brace-expansion': '^5.0.9',
  sharp: '^0.35.0',
  protobufjs: '^7.6.5',
  // Was `cassandra-driver>adm-zip` under pnpm; the only nested selector with no
  // flat counterpart, so the flat pin below is what carries it forward.
  'adm-zip': '^0.6.0',
};

/** Resolutions that must survive alongside the overrides. */
const REQUIRED_RESOLUTIONS = {
  serverless: '^4.41.0',
  // Raised on 2026-08-11: undici 6.28.0 keeps the serverless/node-gyp major while
  // clearing the current moderate advisories.
  undici: '^6.28.0',
  mermaid: '^11.16.1',
  dompurify: '^3.4.13',
};

/**
 * Patches keyed by the exact `name@version` they apply to. A patch silently
 * dropped is the same class of failure as a dropped override.
 */
const REQUIRED_PATCHES = {
  'nextra-theme-docs@4.6.1': 'patches/nextra-theme-docs@4.6.1.patch',
  // JUM-664: removes the IntersectionObserver gate from the Mermaid component
  // the MDX compiler imports. Without it, no ```mermaid fence on the
  // documentation site renders — the container it observes is empty, an empty
  // box has no area, and a box with no area never intersects. Dropped silently,
  // the site goes back to shipping blank spaces where diagrams should be.
  '@theguild/remark-mermaid@0.3.0': 'patches/@theguild%2Fremark-mermaid@0.3.0.patch',
};

/**
 * Pure validation over an already-parsed manifest.
 *
 * Structured as pure validation plus a thin CLI, matching the other ci-cd guards,
 * so the logic is unit-testable without spawning a process.
 *
 * @param {object} pkg parsed package.json
 * @param {string[]} retiredSurfacesPresent labels of pnpm surfaces still on disk
 * @param {(patchPath: string) => boolean} patchExists resolves a declared patch file
 * @returns {string[]} human-readable failures; empty means the pin set is intact
 */
function validateOverrideIntegrity(pkg, retiredSurfacesPresent = [], patchExists = () => true) {
  const failures = [];
  const overrides = pkg.overrides || {};
  const resolutions = pkg.resolutions || {};
  const patches = pkg.patchedDependencies || {};

  for (const [name, expected] of Object.entries(REQUIRED_OVERRIDES)) {
    const actual = overrides[name];
    if (actual === undefined) {
      failures.push(
        `override "${name}" is missing. It was pinned to ${expected} before the Bun migration; `
          + 'removing it lets the vulnerable transitive version resolve again.',
      );
    } else if (actual !== expected) {
      failures.push(
        `override "${name}" is "${actual}", expected "${expected}". If this change is intentional, `
          + 'update REQUIRED_OVERRIDES in this guard in the same commit, with the reason.',
      );
    }
  }

  for (const [name, expected] of Object.entries(REQUIRED_RESOLUTIONS)) {
    if (resolutions[name] !== expected) {
      failures.push(`resolution "${name}" is "${resolutions[name]}", expected "${expected}".`);
    }
  }

  for (const [target, patchPath] of Object.entries(REQUIRED_PATCHES)) {
    if (patches[target] !== patchPath) {
      failures.push(
        `patchedDependencies is missing "${target}" -> "${patchPath}". The JUM-23 baseline recorded `
          + '`bun install` dropping this field entirely; that is exactly what this check catches.',
      );
    } else if (!patchExists(patchPath)) {
      failures.push(`patch file "${patchPath}" is declared but does not exist on disk.`);
    }
  }

  // npm and Bun both reject `a>b` as a package name; it resolves to nothing, so
  // the pin is silently inert rather than merely unusual.
  for (const name of Object.keys(overrides)) {
    if (name.includes('>')) {
      failures.push(
        `override key "${name}" uses pnpm nested-selector syntax, which Bun and npm do not accept `
          + '(npm reports EINVALIDTAGNAME). Convert it to a flat pin, which is strictly stronger.',
      );
    }
  }

  // A second surface that CI does not read is a stale pin waiting to be trusted.
  for (const label of retiredSurfacesPresent) {
    failures.push(
      `${label} still exists. Overrides are now declared once, in package.json. A second surface `
        + 'that CI does not read is a stale pin waiting to be trusted.',
    );
  }

  if (pkg.pnpm !== undefined) {
    failures.push('package.json still declares a "pnpm" section. Its contents must move to the Bun equivalents.');
  }

  return failures;
}

/**
 * Dependents whose declared major an override must not cross.
 *
 * An override is a blunt instrument: it replaces a transitive dependency for
 * *every* dependent, including ones that were never consulted. When the
 * replacement crosses a major boundary the dependent still loads — it just
 * loads a package with a different API.
 *
 * That is not hypothetical. `send: ^1.2.0` was pinned while Express 4 declared
 * `send: ~0.19.0`. `send@0.19` was what put `mime@1` in the tree, and Express 4's
 * `response.js` calls the v1 API `mime.charsets.lookup(...)`. With `send@1` in
 * force there was no `mime@1` to find, so every `res.json()` and `res.send()`
 * threw `TypeError: undefined is not an object` — in production, on the normal
 * response path. Nothing failed at install; nothing failed at boot. Only the
 * integration suites saw it, and they were not in the branch gate (JUM-587).
 *
 * Fixed by upgrading to Express 5, which declares `send: ^1.1.0` and no longer
 * uses the `mime@1` API. This guard exists so the next such override is caught
 * where it is introduced rather than months later.
 */
const OVERRIDE_MAJOR_COMPATIBILITY = [
  { dependent: 'express', overridden: 'send', requiredMajor: 1 }
];

/** The leading major of a semver range such as `^1.2.0`, `~0.19.0`, `1.x`. */
function rangeMajor(range) {
  const match = String(range).match(/(\d+)/);
  return match === null ? null : Number(match[1]);
}

/**
 * Reject an override that would hand a dependent a different major than it
 * declares.
 *
 * Reads the dependent's own manifest rather than a hardcoded expectation, so
 * upgrading the dependent updates the constraint instead of leaving a stale
 * number here to be discovered later.
 */
function validateOverrideMajors(pkg, readDependentRange) {
  const failures = [];
  const overrides = pkg.overrides || {};

  for (const { dependent, overridden, requiredMajor } of OVERRIDE_MAJOR_COMPATIBILITY) {
    const overrideRange = overrides[overridden];
    if (overrideRange === undefined) continue;

    const declaredRange = readDependentRange(dependent, overridden);
    if (declaredRange === null) {
      failures.push(
        `"${dependent}" no longer depends on "${overridden}", but this guard still pairs them. `
          + 'Remove the entry from OVERRIDE_MAJOR_COMPATIBILITY, or remove the override if it has '
          + 'no remaining purpose.',
      );
      continue;
    }

    const declaredMajor = rangeMajor(declaredRange);
    const overrideMajor = rangeMajor(overrideRange);

    if (declaredMajor !== overrideMajor) {
      failures.push(
        `override "${overridden}": "${dependent}" declares ${declaredRange} but the override `
          + `forces ${overrideRange}. Crossing a major means ${dependent} loads a package with a `
          + 'different API — it will not fail to install and it will not fail to boot. See '
          + 'JUM-587: this exact shape broke every Express response.',
      );
      continue;
    }

    if (declaredMajor !== requiredMajor) {
      failures.push(
        `"${dependent}" now declares ${overridden} ${declaredRange}, but this guard expects major `
          + `${requiredMajor}. Update OVERRIDE_MAJOR_COMPATIBILITY deliberately, after confirming `
          + 'the override is still correct for the new major.',
      );
    }
  }

  return failures;
}

/** Read a dependent's declared range for one of its dependencies, from the installed tree. */
function readInstalledDependentRange(dependent, overridden) {
  try {
    const manifestPath = require.resolve(`${dependent}/package.json`, { paths: [repoRoot] });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return (manifest.dependencies || {})[overridden] ?? null;
  } catch {
    return null;
  }
}

/** pnpm surfaces that must stay retired, reported by label when still on disk. */
function detectRetiredSurfaces() {
  return ['pnpm-workspace.yaml', 'pnpm-lock.yaml']
    .filter((label) => fs.existsSync(path.join(repoRoot, label)));
}

function main() {
  if (!fs.existsSync(packageJsonPath)) {
    console.error('Dependency override integrity guard failed: package.json is missing.');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const failures = [
    ...validateOverrideIntegrity(
      pkg,
      detectRetiredSurfaces(),
      (patchPath) => fs.existsSync(path.join(repoRoot, patchPath)),
    ),
    ...validateOverrideMajors(pkg, readInstalledDependentRange),
  ];

  if (failures.length > 0) {
    console.error('Dependency override integrity guard failed:\n');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(
    `Dependency override integrity guard passed: ${Object.keys(REQUIRED_OVERRIDES).length} pins, `
      + `${Object.keys(REQUIRED_RESOLUTIONS).length} resolutions, `
      + `${Object.keys(REQUIRED_PATCHES).length} patch(es) intact, `
      + `${OVERRIDE_MAJOR_COMPATIBILITY.length} major-compatibility pair(s) verified.`,
  );
}

if (isEntryPoint(module)) {
  main();
}

module.exports = {
  OVERRIDE_MAJOR_COMPATIBILITY,
  rangeMajor,
  readInstalledDependentRange,
  validateOverrideMajors,
  REQUIRED_OVERRIDES,
  REQUIRED_PATCHES,
  REQUIRED_RESOLUTIONS,
  detectRetiredSurfaces,
  main,
  validateOverrideIntegrity,
};
